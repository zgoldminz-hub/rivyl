import { Router, Response } from "express";
import { param, validationResult } from "express-validator";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { initDraft, getDraftState } from "../lib/draftEngine";
import { getPlayers } from "../lib/sleeperApi";

const router = Router();
router.use(requireAuth);

// ─── POST /draft/:leagueId/start — Commissioner starts draft ─────────────────

router.post(
  "/:leagueId/start",
  [param("leagueId").notEmpty()],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ ok: false, error: "Validation failed" });
      return;
    }

    const league = await prisma.league.findUnique({
      where: { id: req.params.leagueId },
      include: { _count: { select: { teams: { where: { paid: true } } } } },
    });

    if (!league) {
      res.status(404).json({ ok: false, error: "League not found" });
      return;
    }
    if (league.commissionerId !== req.userId) {
      res.status(403).json({ ok: false, error: "Only the commissioner can start the draft" });
      return;
    }
    if (league.status !== "SETUP") {
      res.status(400).json({ ok: false, error: "Draft already started" });
      return;
    }
    if (league._count.teams < 2) {
      res.status(400).json({ ok: false, error: "Need at least 2 paid teams to start" });
      return;
    }

    try {
      // Pre-warm the player cache
      getPlayers().catch(console.error);

      const state = await initDraft(req.params.leagueId);
      res.json({ ok: true, data: { status: state.status, draftType: state.draftType, teamCount: state.teams.length } });
    } catch (err: any) {
      res.status(400).json({ ok: false, error: err.message });
    }
  }
);

// ─── GET /draft/:leagueId/state — Get current draft state ────────────────────

router.get(
  "/:leagueId/state",
  async (req: AuthRequest, res: Response): Promise<void> => {
    const leagueId = req.params.leagueId;

    // Check membership
    const team = await prisma.team.findFirst({ where: { leagueId, userId: req.userId } });
    if (!team) {
      res.status(403).json({ ok: false, error: "Not a member of this league" });
      return;
    }

    const state = getDraftState(leagueId);
    if (!state) {
      // Return picks from DB if draft is complete
      const league = await prisma.league.findUnique({ where: { id: leagueId } });
      if (league?.status === "ACTIVE" || league?.status === "PLAYOFFS" || league?.status === "COMPLETE") {
        const picks = await prisma.draftPick.findMany({
          where: { leagueId },
          orderBy: { pickNumber: "asc" },
        });
        res.json({ ok: true, data: { status: "COMPLETE", picks } });
        return;
      }
      res.json({ ok: true, data: null });
      return;
    }

    res.json({ ok: true, data: state });
  }
);

// ─── GET /draft/:leagueId/players — Search players ───────────────────────────

router.get("/:leagueId/players", async (req: AuthRequest, res: Response): Promise<void> => {
  const { q = "", position } = req.query as { q?: string; position?: string };

  const state = getDraftState(req.params.leagueId);
  const draftedIds = state
    ? new Set([
        ...state.picks.filter((p) => p.playerId).map((p) => p.playerId!),
        ...state.completedAuctionPicks.map((p) => p.playerId),
      ])
    : new Set<string>();

  const { searchPlayers } = await import("../lib/sleeperApi");
  const players = await searchPlayers(q, position, draftedIds);

  res.json({ ok: true, data: { players } });
});

export default router;
