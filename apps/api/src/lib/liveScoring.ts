import { Server as SocketServer } from "socket.io";
import { prisma } from "./prisma";
import { getCurrentNFLWeek } from "./scoringEngine";

// Short-lived cache (55s TTL) separate from scoringEngine's 24h cache
const liveCache = new Map<string, { data: Record<string, any>; expiresAt: number }>();

let interval: NodeJS.Timeout | null = null;

function inGameWindow(): boolean {
  const h = new Date().getUTCHours();
  return h >= 14 || h < 6; // 9am–1am ET covers all NFL game days
}

async function fetchLiveStats(year: number, week: number): Promise<Record<string, any>> {
  const key = `${year}-${week}`;
  const cached = liveCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const res = await fetch(
    `https://api.sleeper.app/v1/stats/nfl/regular/${year}/${week}`
  );
  if (!res.ok) throw new Error(`Sleeper stats ${res.status}`);
  const data = await res.json();
  liveCache.set(key, { data, expiresAt: Date.now() + 55_000 });
  return data;
}

async function runScoreUpdate(io: SocketServer) {
  if (!inGameWindow()) return;

  const { year, week } = getCurrentNFLWeek();
  const stats = await fetchLiveStats(year, week);

  const leagues = await prisma.league.findMany({
    where: { status: { in: ["ACTIVE", "PLAYOFFS"] } },
    include: {
      matchups: {
        where: { week },
        include: {
          homeTeam: { include: { rosterSlots: true } },
          awayTeam: { include: { rosterSlots: true } },
        },
      },
    },
  });

  let updated = 0;
  for (const league of leagues) {
    if (!league.matchups.length) continue;

    const matchupData = league.matchups.map((m) => {
      function score(slots: { playerId: string; slot: string }[]) {
        return slots
          .filter((s) => s.slot !== "BENCH")
          .reduce((sum, s) => {
            const raw = stats[s.playerId];
            if (!raw) return sum;
            const pts =
              league.scoringType === "FULL_PPR"
                ? (raw.pts_ppr ?? 0)
                : (raw.pts_half_ppr ?? 0);
            return sum + pts;
          }, 0);
      }
      return {
        id: m.id,
        homeTeamId: m.homeTeamId,
        homeTeamName: m.homeTeam.name,
        homeScore: Math.round(score(m.homeTeam.rosterSlots) * 10) / 10,
        awayTeamId: m.awayTeamId,
        awayTeamName: m.awayTeam.name,
        awayScore: Math.round(score(m.awayTeam.rosterSlots) * 10) / 10,
      };
    });

    io.to("scores:" + league.id).emit("scores:update", {
      leagueId: league.id,
      week,
      matchups: matchupData,
    });
    updated++;
  }

  if (updated > 0) console.log(`[LiveScoring] Updated ${updated} leagues`);
}

export function startLiveScoring(io: SocketServer) {
  if (interval) return;
  interval = setInterval(async () => {
    try {
      await runScoreUpdate(io);
    } catch (err) {
      console.error("[LiveScoring] Error:", err);
    }
  }, 60_000);
  console.log("[LiveScoring] Started — polling every 60s during game windows");
}
