// Sleeper provides pre-calculated fantasy points — we use pts_ppr and pts_half_ppr directly.
// Raw stats are also available for custom scoring in the future.

import { ScoringType } from "@prisma/client";

const SLEEPER_STATS_BASE = "https://api.sleeper.app/v1/stats/nfl/regular";

// Cache per (year, week)
const statsCache = new Map<string, Record<string, SleeperPlayerStats>>();

export interface SleeperPlayerStats {
  player_id: string;
  pts_ppr: number | null;
  pts_half_ppr: number | null;
  pts_std: number | null;
  // raw stats (used for display)
  pass_yd?: number;
  pass_td?: number;
  pass_int?: number;
  rush_yd?: number;
  rush_td?: number;
  rec?: number;
  rec_yd?: number;
  rec_td?: number;
  fum_lost?: number;
}

export async function getWeekStats(
  year: number,
  week: number
): Promise<Record<string, SleeperPlayerStats>> {
  const key = `${year}-${week}`;
  if (statsCache.has(key)) return statsCache.get(key)!;

  const res = await fetch(`${SLEEPER_STATS_BASE}/${year}/${week}`);
  if (!res.ok) throw new Error(`Sleeper stats error: ${res.status}`);

  const raw = await res.json() as Record<string, any>;
  const parsed: Record<string, SleeperPlayerStats> = {};

  for (const [id, s] of Object.entries(raw)) {
    parsed[id] = {
      player_id: id,
      pts_ppr: s.pts_ppr ?? null,
      pts_half_ppr: s.pts_half_ppr ?? null,
      pts_std: s.pts_std ?? null,
      pass_yd: s.pass_yd,
      pass_td: s.pass_td,
      pass_int: s.pass_int,
      rush_yd: s.rush_yd,
      rush_td: s.rush_td,
      rec: s.rec,
      rec_yd: s.rec_yd,
      rec_td: s.rec_td,
      fum_lost: s.fum_lost,
    };
  }

  statsCache.set(key, parsed);
  return parsed;
}

export function getPlayerPoints(
  stats: SleeperPlayerStats,
  scoringType: ScoringType
): number {
  if (scoringType === "FULL_PPR") return stats.pts_ppr ?? 0;
  if (scoringType === "HALF_PPR") return stats.pts_half_ppr ?? 0;
  return stats.pts_std ?? 0;
}

export function getCurrentNFLWeek(): { year: number; week: number } {
  // NFL season starts first Thursday of September
  // Regular season ends ~January
  const now = new Date();
  const year = now.getFullYear();

  // Find Week 1 start (first Thursday of September)
  const sep1 = new Date(year, 8, 1); // September 1
  const dayOfWeek = sep1.getDay(); // 0=Sun
  const daysUntilThursday = (4 - dayOfWeek + 7) % 7;
  const week1Start = new Date(year, 8, 1 + daysUntilThursday);
  week1Start.setHours(0, 0, 0, 0);

  const msSinceWeek1 = now.getTime() - week1Start.getTime();
  if (msSinceWeek1 < 0) return { year: year - 1, week: 18 };

  const week = Math.min(18, Math.floor(msSinceWeek1 / (7 * 24 * 60 * 60 * 1000)) + 1);
  return { year, week };
}

export function getWeekLockTime(year: number, week: number): Date {
  // Games lock Sunday 1pm ET of NFL week
  const sep1 = new Date(year, 8, 1);
  const dayOfWeek = sep1.getDay();
  const daysUntilThursday = (4 - dayOfWeek + 7) % 7;
  const week1Start = new Date(year, 8, 1 + daysUntilThursday);

  const weekStart = new Date(week1Start.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000);
  // Sunday = weekStart + 3 days, 13:00 ET (18:00 UTC)
  const lockTime = new Date(weekStart.getTime() + 3 * 24 * 60 * 60 * 1000);
  lockTime.setUTCHours(18, 0, 0, 0);
  return lockTime;
}
