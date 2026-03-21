import { Router, Response } from "express";
import { param, body, validationResult } from "express-validator";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { getWeekStats, getPlayerPoints, getCurrentNFLWeek, getWeekLockTime } from "../lib/scoringEngine";
import { getStandings, generatePlayoffBracket, resolvePlayoffRound, REGULAR_SEASON_WEEKS } from "../lib/scheduleGenerator";

const router = Router();
router.use(requireAuth);

// ─── GET /season/:leagueId/standings ─────────────────────────────────────────

router.get("/:leagueId/standings", async (req: AuthRequest, res: Response): Promise<void> => {
  const { leagueId } = req.params;
  await assertMember(req.userId!, leagueId, res);
  if (res.headersSent) return;

  const standings = await getStandings(leagueId);
  const { week } = getCurrentNFLWeek();

  res.json({ ok: true, data: { standings, currentWeek: Math.min(week, REGULAR_SEASON_WEEKS) } });
});

// ─── GET /season/:leagueId/matchups/:week ─────────────────────────────────────

router.get("/:leagueId/matchups/:week", async (req: AuthRequest, res: Response): Promise<void> => {
  const { leagueId } = req.params;
  const week = parseInt(req.params.week);

  await assertMember(req.userId!, leagueId, res);
  if (res.headersSent) return;

  const matchups = await prisma.matchup.findMany({
    where: { leagueId, week },
    include: {
      homeTeam: { select: { id: true, name: true, userId: true } },
      awayTeam: { select: { id: true, name: true, userId: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  res.json({ ok: true, data: { matchups, week } });
});

// ─── GET /season/:leagueId/matchup/:matchupId ─────────────────────────────────

router.get("/:leagueId/matchup/:matchupId", async (req: AuthRequest, res: Response): Promise<void> => {
  const { leagueId, matchupId } = req.params;

  await assertMember(req.userId!, leagueId, res);
  if (res.headersSent) return;

  const matchup = await prisma.matchup.findFirst({
    where: { id: matchupId, leagueId },
    include: {
      homeTeam: { include: { rosterSlots: true, user: { select: { username: true } } } },
      awayTeam: { include: { rosterSlots: true, user: { select: { username: true } } } },
      league: { select: { scoringType: true } },
    },
  });

  if (!matchup) {
    res.status(404).json({ ok: false, error: "Matchup not found" });
    return;
  }

  // Fetch player stats for this week
  const { year } = getCurrentNFLWeek();
  let stats: Record<string, any> = {};
  try {
    stats = await getWeekStats(year, matchup.week);
  } catch {
    // Stats not available yet
  }

  function enrichRoster(slots: any[]) {
    return slots.map((s) => ({
      ...s,
      points: stats[s.playerId]
        ? getPlayerPoints(stats[s.playerId], matchup!.league.scoringType)
        : 0,
    }));
  }

  res.json({
    ok: true,
    data: {
      matchup: {
        ...matchup,
        homeTeam: { ...matchup.homeTeam, rosterSlots: enrichRoster(matchup.homeTeam.rosterSlots) },
        awayTeam: { ...matchup.awayTeam, rosterSlots: enrichRoster(matchup.awayTeam.rosterSlots) },
      },
    },
  });
});

// ─── GET /season/:leagueId/my-team ────────────────────────────────────────────

router.get("/:leagueId/my-team", async (req: AuthRequest, res: Response): Promise<void> => {
  const { leagueId } = req.params;

  const team = await prisma.team.findFirst({
    where: { leagueId, userId: req.userId },
    include: { rosterSlots: true, league: { select: { scoringType: true } } },
  });

  if (!team) {
    res.status(404).json({ ok: false, error: "You are not in this league" });
    return;
  }

  const { year, week } = getCurrentNFLWeek();
  const lockTime = getWeekLockTime(year, week);
  const isLocked = new Date() >= lockTime;

  let stats: Record<string, any> = {};
  try {
    stats = await getWeekStats(year, week);
  } catch {
    // Not available yet
  }

  const enriched = team.rosterSlots.map((s) => ({
    ...s,
    points: stats[s.playerId]
      ? getPlayerPoints(stats[s.playerId], team.league.scoringType)
      : null,
  }));

  res.json({
    ok: true,
    data: {
      team: { id: team.id, name: team.name },
      roster: enriched,
      currentWeek: week,
      isLocked,
      lockTime: lockTime.toISOString(),
    },
  });
});

// ─── PUT /season/:leagueId/lineup — Set starting lineup ──────────────────────

router.post(
  "/:leagueId/lineup",
  [body("slots").isArray()],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ ok: false, error: "Invalid lineup data" });
      return;
    }

    const { leagueId } = req.params;
    const { year, week } = getCurrentNFLWeek();
    const lockTime = getWeekLockTime(year, week);

    if (new Date() >= lockTime) {
      res.status(400).json({ ok: false, error: "Lineup is locked for this week" });
      return;
    }

    const team = await prisma.team.findFirst({ where: { leagueId, userId: req.userId } });
    if (!team) {
      res.status(404).json({ ok: false, error: "Team not found" });
      return;
    }

    // slots: [{ playerId, slot }]
    const slots: { playerId: string; slot: string }[] = req.body.slots;

    await Promise.all(
      slots.map((s) =>
        prisma.rosterSlot.updateMany({
          where: { teamId: team.id, playerId: s.playerId },
          data: { slot: s.slot, week },
        })
      )
    );

    res.json({ ok: true, data: { week } });
  }
);

// ─── POST /season/:leagueId/update-scores/:week — Score a week ───────────────
// This is called by a cron job (or manually by commissioner) after each NFL week.

router.post(
  "/:leagueId/update-scores/:week",
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { leagueId } = req.params;
    const week = parseInt(req.params.week);

    // Only commissioner can trigger
    const league = await prisma.league.findUnique({ where: { id: leagueId } });
    if (!league) {
      res.status(404).json({ ok: false, error: "League not found" });
      return;
    }
    if (league.commissionerId !== req.userId) {
      res.status(403).json({ ok: false, error: "Only commissioner can update scores" });
      return;
    }

    const matchups = await prisma.matchup.findMany({
      where: { leagueId, week },
      include: {
        homeTeam: { include: { rosterSlots: true } },
        awayTeam: { include: { rosterSlots: true } },
      },
    });

    const { year } = getCurrentNFLWeek();
    const stats = await getWeekStats(year, week);

    const updates = matchups.map(async (matchup) => {
      function teamScore(slots: { playerId: string; slot: string }[]): number {
        return slots
          .filter((s) => s.slot !== "BENCH")
          .reduce((total, s) => {
            const playerStats = stats[s.playerId];
            return total + (playerStats ? getPlayerPoints(playerStats, league!.scoringType) : 0);
          }, 0);
      }

      const homeScore = teamScore(matchup.homeTeam.rosterSlots);
      const awayScore = teamScore(matchup.awayTeam.rosterSlots);

      return prisma.matchup.update({
        where: { id: matchup.id },
        data: { homeScore, awayScore },
      });
    });

    await Promise.all(updates);

    // After week 14 — generate playoffs
    if (week === REGULAR_SEASON_WEEKS) {
      await generatePlayoffBracket(leagueId);
      await prisma.league.update({ where: { id: leagueId }, data: { status: "PLAYOFFS" } });
    }

    // After week 15/16 — advance playoff bracket
    if (week === 15 || week === 16) {
      await resolvePlayoffRound(leagueId, week);
    }

    res.json({ ok: true, data: { week, matchupsScored: matchups.length } });
  }
);

// ─── GET /season/:leagueId/bracket ───────────────────────────────────────────

router.get("/:leagueId/bracket", async (req: AuthRequest, res: Response): Promise<void> => {
  const { leagueId } = req.params;

  await assertMember(req.userId!, leagueId, res);
  if (res.headersSent) return;

  const playoffMatchups = await prisma.matchup.findMany({
    where: { leagueId, isPlayoff: true },
    include: {
      homeTeam: { select: { id: true, name: true } },
      awayTeam: { select: { id: true, name: true } },
    },
    orderBy: [{ week: "asc" }, { createdAt: "asc" }],
  });

  const standings = await getStandings(leagueId);
  const seeds = new Map(standings.map((s, i) => [s.teamId, i + 1]));

  res.json({
    ok: true,
    data: {
      bracket: playoffMatchups,
      seeds: Object.fromEntries(seeds),
    },
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function assertMember(userId: string, leagueId: string, res: Response) {
  const team = await prisma.team.findFirst({ where: { leagueId, userId } });
  if (!team) {
    res.status(403).json({ ok: false, error: "Not a member of this league" });
  }
}

export default router;
