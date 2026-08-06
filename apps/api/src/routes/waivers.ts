import { Router, Response } from "express";
import { body, validationResult } from "express-validator";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { getPlayers, searchPlayers, enrichPlayers } from "../lib/sleeperApi";

const router = Router();
router.use(requireAuth);

// ─── GET /waivers/:leagueId/available ─────────────────────────────────────────
// All free agents (players not on any roster in this league)

router.get("/:leagueId/available", async (req: AuthRequest, res: Response): Promise<void> => {
  const { leagueId } = req.params;
  const { search, position } = req.query as { search?: string; position?: string };

  const team = await prisma.team.findFirst({ where: { leagueId, userId: req.userId } });
  if (!team) { res.status(403).json({ ok: false, error: "Not a member of this league" }); return; }

  // Get all drafted player IDs in this league
  const rostered = await prisma.rosterSlot.findMany({
    where: { team: { leagueId } },
    select: { playerId: true },
  });
  const rosteredIds = new Set(rostered.map((r) => r.playerId));

  const free = await searchPlayers(
    (search as string) ?? "",
    (position as string) ?? "ALL",
    rosteredIds
  );

  res.json({ ok: true, data: { players: free } });
});

// ─── GET /waivers/:leagueId/claims ────────────────────────────────────────────
// My team's pending waiver claims

router.get("/:leagueId/claims", async (req: AuthRequest, res: Response): Promise<void> => {
  const { leagueId } = req.params;

  const team = await prisma.team.findFirst({ where: { leagueId, userId: req.userId } });
  if (!team) { res.status(403).json({ ok: false, error: "Not a member of this league" }); return; }

  const claims = await prisma.waiverClaim.findMany({
    where: { teamId: team.id, status: "PENDING" },
    orderBy: { priority: "asc" },
  });

  const ids = claims.flatMap((c) => [c.addPlayerId, c.dropPlayerId].filter(Boolean) as string[]);
  const playerInfo = await enrichPlayers(ids);

  const enrichedClaims = claims.map((c) => ({
    ...c,
    addPlayer: playerInfo[c.addPlayerId] ?? null,
    dropPlayer: c.dropPlayerId ? playerInfo[c.dropPlayerId] ?? null : null,
  }));

  res.json({ ok: true, data: { claims: enrichedClaims } });
});

// ─── POST /waivers/:leagueId/claim ────────────────────────────────────────────
// Submit a waiver claim

router.post(
  "/:leagueId/claim",
  [body("addPlayerId").isString().notEmpty()],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ ok: false, error: "addPlayerId is required" }); return; }

    const { leagueId } = req.params;
    const { addPlayerId, dropPlayerId } = req.body as { addPlayerId: string; dropPlayerId?: string };

    const league = await prisma.league.findUnique({ where: { id: leagueId } });
    if (!league || !["ACTIVE", "PLAYOFFS"].includes(league.status)) {
      res.status(400).json({ ok: false, error: "Waivers are only open during active season" }); return;
    }

    const team = await prisma.team.findFirst({
      where: { leagueId, userId: req.userId },
      include: { rosterSlots: true },
    });
    if (!team) { res.status(403).json({ ok: false, error: "Not a member of this league" }); return; }

    // Check player isn't already rostered
    const alreadyRostered = await prisma.rosterSlot.findFirst({ where: { team: { leagueId }, playerId: addPlayerId } });
    if (alreadyRostered) { res.status(400).json({ ok: false, error: "Player is already on a roster" }); return; }

    // Check not already claimed by this team
    const existing = await prisma.waiverClaim.findFirst({
      where: { teamId: team.id, addPlayerId, status: "PENDING" },
    });
    if (existing) { res.status(400).json({ ok: false, error: "You already have a pending claim for this player" }); return; }

    // Priority = count of existing claims (FIFO within priority)
    const claimCount = await prisma.waiverClaim.count({ where: { teamId: team.id, status: "PENDING" } });

    const claim = await prisma.waiverClaim.create({
      data: { leagueId, teamId: team.id, addPlayerId, dropPlayerId: dropPlayerId ?? null, priority: claimCount },
    });

    res.json({ ok: true, data: { claim } });
  }
);

// ─── DELETE /waivers/:leagueId/claims/:claimId ───────────────────────────────
// Cancel a pending claim

router.delete("/:leagueId/claims/:claimId", async (req: AuthRequest, res: Response): Promise<void> => {
  const { leagueId, claimId } = req.params;

  const team = await prisma.team.findFirst({ where: { leagueId, userId: req.userId } });
  if (!team) { res.status(403).json({ ok: false, error: "Not a member of this league" }); return; }

  const claim = await prisma.waiverClaim.findFirst({ where: { id: claimId, teamId: team.id } });
  if (!claim) { res.status(404).json({ ok: false, error: "Claim not found" }); return; }
  if (claim.status !== "PENDING") { res.status(400).json({ ok: false, error: "Claim already processed" }); return; }

  await prisma.waiverClaim.update({ where: { id: claimId }, data: { status: "CANCELLED" } });
  res.json({ ok: true, data: {} });
});

// ─── DELETE /waivers/:leagueId/drop/:playerId ────────────────────────────────
// Immediately drop a player from your roster (no waiver needed to drop)

router.delete("/:leagueId/drop/:playerId", async (req: AuthRequest, res: Response): Promise<void> => {
  const { leagueId, playerId } = req.params;

  const league = await prisma.league.findUnique({ where: { id: leagueId } });
  if (!league || !["ACTIVE", "PLAYOFFS"].includes(league.status)) {
    res.status(400).json({ ok: false, error: "Cannot drop players outside of active season" }); return;
  }

  const team = await prisma.team.findFirst({ where: { leagueId, userId: req.userId }, include: { rosterSlots: true } });
  if (!team) { res.status(403).json({ ok: false, error: "Not a member of this league" }); return; }

  const slot = team.rosterSlots.find((s) => s.playerId === playerId);
  if (!slot) { res.status(404).json({ ok: false, error: "Player not on your roster" }); return; }

  await prisma.rosterSlot.delete({ where: { id: slot.id } });
  res.json({ ok: true, data: {} });
});

// ─── POST /waivers/:leagueId/process ──────────────────────────────────────────
// Commissioner processes all pending waiver claims (runs waivers)

router.post("/:leagueId/process", async (req: AuthRequest, res: Response): Promise<void> => {
  const { leagueId } = req.params;

  const league = await prisma.league.findUnique({ where: { id: leagueId } });
  if (!league) { res.status(404).json({ ok: false, error: "League not found" }); return; }
  if (league.commissionerId !== req.userId) { res.status(403).json({ ok: false, error: "Only commissioner can process waivers" }); return; }

  const claims = await prisma.waiverClaim.findMany({
    where: { leagueId, status: "PENDING" },
    include: { team: { include: { rosterSlots: true } } },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  });

  const processedAdds = new Set<string>(); // player IDs already claimed this run
  const results: { claimId: string; status: string }[] = [];

  for (const claim of claims) {
    // Check player still available
    const alreadyRostered = await prisma.rosterSlot.findFirst({ where: { team: { leagueId }, playerId: claim.addPlayerId } });
    if (alreadyRostered || processedAdds.has(claim.addPlayerId)) {
      await prisma.waiverClaim.update({ where: { id: claim.id }, data: { status: "FAILED" } });
      results.push({ claimId: claim.id, status: "FAILED" });
      continue;
    }

    // Drop player if specified
    if (claim.dropPlayerId) {
      await prisma.rosterSlot.deleteMany({ where: { teamId: claim.teamId, playerId: claim.dropPlayerId } });
    }

    // Add player to bench
    await prisma.rosterSlot.create({ data: { teamId: claim.teamId, playerId: claim.addPlayerId, slot: "BENCH" } });
    await prisma.waiverClaim.update({ where: { id: claim.id }, data: { status: "PROCESSED" } });

    // Notify user
    await prisma.notification.create({
      data: {
        userId: claim.team.userId,
        leagueId,
        type: "WAIVER_CLAIMED",
        title: "Waiver Claim Processed",
        body: `Your waiver claim for player ${claim.addPlayerId} was successful.`,
      },
    });

    processedAdds.add(claim.addPlayerId);
    results.push({ claimId: claim.id, status: "PROCESSED" });
  }

  res.json({ ok: true, data: { results } });
});

export default router;
