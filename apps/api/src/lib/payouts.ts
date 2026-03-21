import { prisma } from "./prisma";
import { NotificationType } from "@prisma/client";

// ─── Notification helpers ─────────────────────────────────────────────────────

export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  leagueId?: string
) {
  return prisma.notification.create({
    data: { userId, type, title, body, leagueId },
  });
}

export async function notifyMany(
  userIds: string[],
  type: NotificationType,
  title: string,
  body: string,
  leagueId?: string
) {
  await prisma.notification.createMany({
    data: userIds.map((userId) => ({ userId, type, title, body, leagueId })),
  });
}

// ─── Payout calculation ───────────────────────────────────────────────────────

export const PAYOUT_SPLITS: Record<string, number[]> = {
  WINNER_TAKES_ALL: [1.0],
  TOP_TWO: [0.7, 0.3],
  TOP_THREE: [0.6, 0.25, 0.15],
};

interface PayoutResult {
  place: number;
  teamId: string;
  teamName: string;
  userId: string;
  amountCents: number;
}

/**
 * Calculate and record payouts after Week 17 championship.
 * Returns final places determined by:
 *   1st = Week 17 championship winner
 *   2nd = Week 17 championship loser
 *   3rd = Week 16 consolation winner
 */
export async function calculateAndIssuePayouts(leagueId: string): Promise<PayoutResult[]> {
  const league = await prisma.league.findUniqueOrThrow({
    where: { id: leagueId },
    include: { teams: { include: { user: true } } },
  });

  // Prize pool = buy-in × paid teams
  const paidTeams = await prisma.team.count({ where: { leagueId, paid: true } });
  const prizePool = league.buyIn * paidTeams; // cents

  const splits = PAYOUT_SPLITS[league.payoutPreset] ?? [1.0];

  // Determine final places from playoff matchups
  const week17 = await prisma.matchup.findFirst({
    where: { leagueId, week: 17, isPlayoff: true },
    include: { homeTeam: { include: { user: true } }, awayTeam: { include: { user: true } } },
    orderBy: { createdAt: "asc" },
  });

  const week16 = await prisma.matchup.findMany({
    where: { leagueId, week: 16, isPlayoff: true },
    include: { homeTeam: { include: { user: true } }, awayTeam: { include: { user: true } } },
    orderBy: { createdAt: "asc" },
  });

  const places: { teamId: string; teamName: string; userId: string }[] = [];

  // 1st and 2nd from Week 17 championship
  if (week17) {
    const champ =
      week17.homeScore >= week17.awayScore
        ? { teamId: week17.homeTeamId, teamName: week17.homeTeam.name, userId: week17.homeTeam.userId }
        : { teamId: week17.awayTeamId, teamName: week17.awayTeam.name, userId: week17.awayTeam.userId };
    const runnerUp =
      week17.homeScore >= week17.awayScore
        ? { teamId: week17.awayTeamId, teamName: week17.awayTeam.name, userId: week17.awayTeam.userId }
        : { teamId: week17.homeTeamId, teamName: week17.homeTeam.name, userId: week17.homeTeam.userId };
    places.push(champ, runnerUp);
  }

  // 3rd from Week 16 consolation (second matchup created)
  const consolation = week16[1];
  if (consolation) {
    const third =
      consolation.homeScore >= consolation.awayScore
        ? { teamId: consolation.homeTeamId, teamName: consolation.homeTeam.name, userId: consolation.homeTeam.userId }
        : { teamId: consolation.awayTeamId, teamName: consolation.awayTeam.name, userId: consolation.awayTeam.userId };
    places.push(third);
  }

  // Record payout payments + notifications
  const results: PayoutResult[] = [];

  for (let i = 0; i < Math.min(places.length, splits.length); i++) {
    const amountCents = Math.floor(prizePool * splits[i]);
    const { teamId, teamName, userId } = places[i];

    await prisma.payment.create({
      data: {
        leagueId,
        userId,
        amountCents,
        type: "PAYOUT",
        status: "COMPLETED", // In production: trigger Stripe transfer here
      },
    });

    await createNotification(
      userId,
      "PAYOUT_ISSUED",
      `You finished ${ordinal(i + 1)} in ${league.name}!`,
      `Payout of $${(amountCents / 100).toFixed(2)} recorded. Your commissioner will distribute funds.`,
      leagueId
    );

    results.push({ place: i + 1, teamId, teamName, userId, amountCents });
  }

  // Mark league complete
  await prisma.league.update({ where: { id: leagueId }, data: { status: "COMPLETE" } });

  // Notify all members
  const allUserIds = league.teams.map((t) => t.userId);
  const winnerName = places[0]?.teamName ?? "Unknown";
  await notifyMany(
    allUserIds.filter((uid) => uid !== places[0]?.userId),
    "PAYOUT_ISSUED",
    `${league.name} champion: ${winnerName}`,
    `The season is over. Check the final standings and payouts.`,
    leagueId
  );

  return results;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
