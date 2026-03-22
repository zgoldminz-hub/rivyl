import { Router, Response } from "express";
import { body, validationResult } from "express-validator";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

// ─── GET /trades/:leagueId ────────────────────────────────────────────────────
// All trades involving my team (pending, accepted, rejected)

router.get("/:leagueId", async (req: AuthRequest, res: Response): Promise<void> => {
  const { leagueId } = req.params;

  const team = await prisma.team.findFirst({ where: { leagueId, userId: req.userId } });
  if (!team) { res.status(403).json({ ok: false, error: "Not a member of this league" }); return; }

  const trades = await prisma.trade.findMany({
    where: {
      leagueId,
      OR: [{ proposingTeamId: team.id }, { receivingTeamId: team.id }],
    },
    include: {
      proposingTeam: { select: { id: true, name: true, userId: true } },
      receivingTeam: { select: { id: true, name: true, userId: true } },
      items: true,
    },
    orderBy: { createdAt: "desc" },
  });

  res.json({ ok: true, data: { trades, myTeamId: team.id } });
});

// ─── POST /trades/:leagueId ───────────────────────────────────────────────────
// Propose a trade

router.post(
  "/:leagueId",
  [
    body("receivingTeamId").isString().notEmpty(),
    body("offeredPlayerIds").isArray({ min: 1 }),
    body("requestedPlayerIds").isArray({ min: 1 }),
  ],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ ok: false, error: "offeredPlayerIds and requestedPlayerIds are required" }); return; }

    const { leagueId } = req.params;
    const { receivingTeamId, offeredPlayerIds, requestedPlayerIds, note } = req.body as {
      receivingTeamId: string;
      offeredPlayerIds: string[];
      requestedPlayerIds: string[];
      note?: string;
    };

    const league = await prisma.league.findUnique({ where: { id: leagueId } });
    if (!league || !["ACTIVE", "PLAYOFFS"].includes(league.status)) {
      res.status(400).json({ ok: false, error: "Trades are only open during active season" }); return;
    }

    const myTeam = await prisma.team.findFirst({
      where: { leagueId, userId: req.userId },
      include: { rosterSlots: true },
    });
    if (!myTeam) { res.status(403).json({ ok: false, error: "Not a member of this league" }); return; }
    if (myTeam.id === receivingTeamId) { res.status(400).json({ ok: false, error: "Cannot trade with yourself" }); return; }

    const theirTeam = await prisma.team.findFirst({
      where: { id: receivingTeamId, leagueId },
      include: { rosterSlots: true },
    });
    if (!theirTeam) { res.status(404).json({ ok: false, error: "Team not found" }); return; }

    // Validate offered players are on my roster
    const myPlayerIds = new Set(myTeam.rosterSlots.map((s) => s.playerId));
    for (const pid of offeredPlayerIds) {
      if (!myPlayerIds.has(pid)) {
        res.status(400).json({ ok: false, error: `Player ${pid} is not on your roster` }); return;
      }
    }

    // Validate requested players are on their roster
    const theirPlayerIds = new Set(theirTeam.rosterSlots.map((s) => s.playerId));
    for (const pid of requestedPlayerIds) {
      if (!theirPlayerIds.has(pid)) {
        res.status(400).json({ ok: false, error: `Player ${pid} is not on their roster` }); return;
      }
    }

    // Create trade with items
    const trade = await prisma.trade.create({
      data: {
        leagueId,
        proposingTeamId: myTeam.id,
        receivingTeamId,
        note: note ?? null,
        items: {
          create: [
            ...offeredPlayerIds.map((pid) => ({ fromTeamId: myTeam.id, playerId: pid })),
            ...requestedPlayerIds.map((pid) => ({ fromTeamId: receivingTeamId, playerId: pid })),
          ],
        },
      },
      include: { items: true },
    });

    // Notify receiving team
    await prisma.notification.create({
      data: {
        userId: theirTeam.userId,
        leagueId,
        type: "TRADE_PROPOSED",
        title: "Trade Offer",
        body: `${myTeam.name} sent you a trade offer. Check your trades tab.`,
      },
    });

    res.json({ ok: true, data: { trade } });
  }
);

// ─── POST /trades/:leagueId/:tradeId/accept ───────────────────────────────────
// Accept a trade — swap the players

router.post("/:leagueId/:tradeId/accept", async (req: AuthRequest, res: Response): Promise<void> => {
  const { leagueId, tradeId } = req.params;

  const myTeam = await prisma.team.findFirst({ where: { leagueId, userId: req.userId } });
  if (!myTeam) { res.status(403).json({ ok: false, error: "Not a member of this league" }); return; }

  const trade = await prisma.trade.findFirst({
    where: { id: tradeId, leagueId },
    include: {
      items: true,
      proposingTeam: true,
      receivingTeam: true,
    },
  });
  if (!trade) { res.status(404).json({ ok: false, error: "Trade not found" }); return; }
  if (trade.receivingTeamId !== myTeam.id) { res.status(403).json({ ok: false, error: "Only the receiving team can accept" }); return; }
  if (trade.status !== "PENDING") { res.status(400).json({ ok: false, error: "Trade is no longer pending" }); return; }

  // Execute the trade — swap roster slots
  for (const item of trade.items) {
    const toTeamId = item.fromTeamId === trade.proposingTeamId ? trade.receivingTeamId : trade.proposingTeamId;
    await prisma.rosterSlot.updateMany({
      where: { teamId: item.fromTeamId, playerId: item.playerId },
      data: { teamId: toTeamId, slot: "BENCH" },
    });
  }

  await prisma.trade.update({ where: { id: tradeId }, data: { status: "ACCEPTED" } });

  // Notify proposing team
  await prisma.notification.create({
    data: {
      userId: trade.proposingTeam.userId,
      leagueId,
      type: "TRADE_ACCEPTED",
      title: "Trade Accepted",
      body: `${trade.receivingTeam.name} accepted your trade offer!`,
    },
  });

  res.json({ ok: true, data: {} });
});

// ─── POST /trades/:leagueId/:tradeId/reject ───────────────────────────────────
// Reject a trade

router.post("/:leagueId/:tradeId/reject", async (req: AuthRequest, res: Response): Promise<void> => {
  const { leagueId, tradeId } = req.params;

  const myTeam = await prisma.team.findFirst({ where: { leagueId, userId: req.userId } });
  if (!myTeam) { res.status(403).json({ ok: false, error: "Not a member of this league" }); return; }

  const trade = await prisma.trade.findFirst({
    where: { id: tradeId, leagueId },
    include: { proposingTeam: true, receivingTeam: true },
  });
  if (!trade) { res.status(404).json({ ok: false, error: "Trade not found" }); return; }
  if (trade.receivingTeamId !== myTeam.id) { res.status(403).json({ ok: false, error: "Only the receiving team can reject" }); return; }
  if (trade.status !== "PENDING") { res.status(400).json({ ok: false, error: "Trade is no longer pending" }); return; }

  await prisma.trade.update({ where: { id: tradeId }, data: { status: "REJECTED" } });

  // Notify proposing team
  await prisma.notification.create({
    data: {
      userId: trade.proposingTeam.userId,
      leagueId,
      type: "TRADE_REJECTED",
      title: "Trade Rejected",
      body: `${trade.receivingTeam.name} rejected your trade offer.`,
    },
  });

  res.json({ ok: true, data: {} });
});

// ─── DELETE /trades/:leagueId/:tradeId ───────────────────────────────────────
// Cancel a trade (proposer only)

router.delete("/:leagueId/:tradeId", async (req: AuthRequest, res: Response): Promise<void> => {
  const { leagueId, tradeId } = req.params;

  const myTeam = await prisma.team.findFirst({ where: { leagueId, userId: req.userId } });
  if (!myTeam) { res.status(403).json({ ok: false, error: "Not a member of this league" }); return; }

  const trade = await prisma.trade.findFirst({ where: { id: tradeId, leagueId } });
  if (!trade) { res.status(404).json({ ok: false, error: "Trade not found" }); return; }
  if (trade.proposingTeamId !== myTeam.id) { res.status(403).json({ ok: false, error: "Only the proposer can cancel" }); return; }
  if (trade.status !== "PENDING") { res.status(400).json({ ok: false, error: "Trade is no longer pending" }); return; }

  await prisma.trade.update({ where: { id: tradeId }, data: { status: "CANCELLED" } });
  res.json({ ok: true, data: {} });
});

export default router;
