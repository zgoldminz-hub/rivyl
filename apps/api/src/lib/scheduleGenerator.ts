import { prisma } from "./prisma";

export const REGULAR_SEASON_WEEKS = 14;
export const PLAYOFF_WEEKS = [15, 16, 17];
export const PLAYOFF_TEAMS = 4;

/**
 * Generate a round-robin regular season schedule (weeks 1-14)
 * then generate the playoff bracket (weeks 15-17) after week 14.
 */
export async function generateSchedule(leagueId: string): Promise<void> {
  const teams = await prisma.team.findMany({
    where: { leagueId, paid: true },
    orderBy: { draftOrder: "asc" },
  });

  if (teams.length < 2) throw new Error("Not enough teams");

  const rounds = roundRobin(teams.map((t) => t.id));
  const matchupsToCreate: { leagueId: string; week: number; homeTeamId: string; awayTeamId: string }[] = [];

  // Fill 14 weeks by cycling through rounds
  for (let week = 1; week <= REGULAR_SEASON_WEEKS; week++) {
    const round = rounds[(week - 1) % rounds.length];
    for (const [homeId, awayId] of round) {
      matchupsToCreate.push({ leagueId, week, homeTeamId: homeId, awayTeamId: awayId });
    }
  }

  await prisma.matchup.createMany({ data: matchupsToCreate });
}

/**
 * Generate playoff bracket after week 14 — called automatically.
 * Top 4 teams by record (tiebreaker: total points) qualify.
 * Week 15: Semifinal (1v4, 2v3)
 * Week 16: Consolation (losers) + Championship (winners)
 * Week 17: Championship (determines payout)
 */
export async function generatePlayoffBracket(leagueId: string): Promise<void> {
  const standings = await getStandings(leagueId);
  const top4 = standings.slice(0, PLAYOFF_TEAMS);

  // Week 15 semifinals: seed 1 vs 4, seed 2 vs 3
  await prisma.matchup.createMany({
    data: [
      { leagueId, week: 15, homeTeamId: top4[0].teamId, awayTeamId: top4[3].teamId, isPlayoff: true },
      { leagueId, week: 15, homeTeamId: top4[1].teamId, awayTeamId: top4[2].teamId, isPlayoff: true },
    ],
  });

  // Weeks 16-17 are generated dynamically after week 15 results
  // (see resolvePlayoffRound)
}

/**
 * Called after week 15 to generate week 16 matchups,
 * and after week 16 to generate week 17 championship.
 */
export async function resolvePlayoffRound(leagueId: string, completedWeek: number): Promise<void> {
  if (completedWeek === 15) {
    const semis = await prisma.matchup.findMany({
      where: { leagueId, week: 15, isPlayoff: true },
    });

    const winners: string[] = [];
    const losers: string[] = [];
    for (const m of semis) {
      if (m.homeScore >= m.awayScore) { winners.push(m.homeTeamId); losers.push(m.awayTeamId); }
      else { winners.push(m.awayTeamId); losers.push(m.homeTeamId); }
    }

    // Week 16: Championship + Consolation
    await prisma.matchup.createMany({
      data: [
        { leagueId, week: 16, homeTeamId: winners[0], awayTeamId: winners[1], isPlayoff: true },
        { leagueId, week: 16, homeTeamId: losers[0], awayTeamId: losers[1], isPlayoff: true },
      ],
    });
  }

  if (completedWeek === 16) {
    // Week 17: Championship (the same two teams who played in week 16 championship)
    const championship = await prisma.matchup.findFirst({
      where: { leagueId, week: 16, isPlayoff: true },
      orderBy: { createdAt: "asc" }, // first created = championship game
    });

    if (championship) {
      await prisma.matchup.create({
        data: {
          leagueId,
          week: 17,
          homeTeamId: championship.homeTeamId,
          awayTeamId: championship.awayTeamId,
          isPlayoff: true,
        },
      });
    }
  }
}

// ─── Standings ────────────────────────────────────────────────────────────────

export interface StandingsEntry {
  teamId: string;
  teamName: string;
  userId: string;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
}

export async function getStandings(leagueId: string): Promise<StandingsEntry[]> {
  const [teams, matchups] = await Promise.all([
    prisma.team.findMany({ where: { leagueId }, select: { id: true, name: true, userId: true } }),
    prisma.matchup.findMany({
      where: { leagueId, isPlayoff: false, week: { lte: REGULAR_SEASON_WEEKS } },
    }),
  ]);

  const map = new Map<string, StandingsEntry>();
  for (const t of teams) {
    map.set(t.id, { teamId: t.id, teamName: t.name, userId: t.userId, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 });
  }

  for (const m of matchups) {
    if (m.homeScore === 0 && m.awayScore === 0) continue; // not yet scored

    const home = map.get(m.homeTeamId);
    const away = map.get(m.awayTeamId);
    if (!home || !away) continue;

    home.pointsFor += m.homeScore;
    home.pointsAgainst += m.awayScore;
    away.pointsFor += m.awayScore;
    away.pointsAgainst += m.homeScore;

    if (m.homeScore > m.awayScore) { home.wins++; away.losses++; }
    else if (m.awayScore > m.homeScore) { away.wins++; home.losses++; }
    else { home.wins += 0.5; away.wins += 0.5; } // tie
  }

  return Array.from(map.values()).sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    return b.pointsFor - a.pointsFor; // tiebreaker: total points
  });
}

// ─── Round-robin algorithm ────────────────────────────────────────────────────

function roundRobin(teams: string[]): [string, string][][] {
  const list = teams.length % 2 === 0 ? [...teams] : [...teams, "BYE"];
  const n = list.length;
  const rounds: [string, string][][] = [];

  for (let r = 0; r < n - 1; r++) {
    const round: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      const home = list[i];
      const away = list[n - 1 - i];
      if (home !== "BYE" && away !== "BYE") {
        round.push([home, away]);
      }
    }
    rounds.push(round);
    // Rotate all except first element
    list.splice(1, 0, list.pop()!);
  }

  return rounds;
}
