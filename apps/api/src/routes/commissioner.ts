import { Router, Response } from "express";
import { body, validationResult } from "express-validator";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { calculateAndIssuePayouts, PAYOUT_SPLITS, notifyMany } from "../lib/payouts";
import { getStandings } from "../lib/scheduleGenerator";

const router = Router();
router.use(requireAuth);

// ─── Middleware: require commissioner ─────────────────────────────────────────

async function requireCommissioner(req: AuthRequest, res: Response, leagueId: string): Promise<boolean> {
  const league = await prisma.league.findUnique({ where: { id: leagueId } });
  if (!league) {
    res.status(404).json({ ok: false, error: "League not found" });
    return false;
  }
  if (league.commissionerId !== req.userId) {
    res.status(403).json({ ok: false, error: "Commissioner only" });
    return false;
  }
  return true;
}

// ─── GET /commissioner/:leagueId/panel ────────────────────────────────────────

router.get("/:leagueId/panel", async (req: AuthRequest, res: Response): Promise<void> => {
  const { leagueId } = req.params;
  if (!(await requireCommissioner(req, res, leagueId))) return;

  const [league, standings, payouts] = await Promise.all([
    prisma.league.findUnique({
      where: { id: leagueId },
      include: {
        teams: { include: { user: { select: { username: true, email: true } }, _count: { select: { rosterSlots: true } } } },
        payments: { orderBy: { createdAt: "desc" } },
      },
    }),
    getStandings(leagueId),
    prisma.payment.findMany({
      where: { leagueId, type: "PAYOUT" },
      include: { user: { select: { username: true } } },
    }),
  ]);

  if (!league) { res.status(404).json({ ok: false, error: "Not found" }); return; }

  const paidTeams = league.teams.filter((t) => t.paid).length;
  const prizePool = league.buyIn * paidTeams;
  const splits = PAYOUT_SPLITS[league.payoutPreset] ?? [1.0];
  const payoutPreview = splits.map((pct, i) => ({
    place: i + 1,
    amountCents: Math.floor(prizePool * pct),
  }));

  res.json({
    ok: true,
    data: {
      league: {
        id: league.id,
        name: league.name,
        status: league.status,
        payoutPreset: league.payoutPreset,
        buyIn: league.buyIn,
        scoringType: league.scoringType,
        draftType: league.draftType,
        inviteCode: league.inviteCode,
      },
      teams: league.teams,
      prizePool,
      payoutPreview,
      payouts,
      standings,
    },
  });
});

// ─── POST /commissioner/:leagueId/trigger-payouts ─────────────────────────────

router.post("/:leagueId/trigger-payouts", async (req: AuthRequest, res: Response): Promise<void> => {
  const { leagueId } = req.params;
  if (!(await requireCommissioner(req, res, leagueId))) return;

  const league = await prisma.league.findUnique({ where: { id: leagueId } });
  if (league?.status !== "PLAYOFFS") {
    res.status(400).json({ ok: false, error: "League must be in playoffs to issue payouts" });
    return;
  }

  const existing = await prisma.payment.findFirst({ where: { leagueId, type: "PAYOUT" } });
  if (existing) {
    res.status(400).json({ ok: false, error: "Payouts already issued" });
    return;
  }

  const results = await calculateAndIssuePayouts(leagueId);
  res.json({ ok: true, data: { results } });
});

// ─── POST /commissioner/:leagueId/notify — Send custom notification ───────────

router.post(
  "/:leagueId/notify",
  [body("title").notEmpty(), body("body").notEmpty()],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ ok: false, error: "title and body required" });
      return;
    }

    const { leagueId } = req.params;
    if (!(await requireCommissioner(req, res, leagueId))) return;

    const teams = await prisma.team.findMany({ where: { leagueId }, select: { userId: true } });
    await notifyMany(
      teams.map((t) => t.userId),
      "LEAGUE_INVITE",
      req.body.title,
      req.body.body,
      leagueId
    );

    res.json({ ok: true, data: { sent: teams.length } });
  }
);

// ─── PATCH /commissioner/:leagueId/settings ───────────────────────────────────

router.patch(
  "/:leagueId/settings",
  [body("payoutPreset").optional().isIn(["WINNER_TAKES_ALL", "TOP_TWO", "TOP_THREE"])],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { leagueId } = req.params;
    if (!(await requireCommissioner(req, res, leagueId))) return;

    const { payoutPreset } = req.body;
    const data: any = {};
    if (payoutPreset) data.payoutPreset = payoutPreset;

    const updated = await prisma.league.update({ where: { id: leagueId }, data });
    res.json({ ok: true, data: { payoutPreset: updated.payoutPreset } });
  }
);

export default router;
