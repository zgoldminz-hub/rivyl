// Sleeper API player cache
// Fetches the full NFL player list once and caches it in memory for 24 hours.

export interface SleeperPlayer {
  player_id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  position: string; // QB, RB, WR, TE, K, DEF
  team: string | null;
  status: string | null; // Active, Injured Reserve, etc.
  injury_status: string | null;
  number: number | null;
  depth_chart_order: number | null;
  search_rank: number | null;
}

let cache: Map<string, SleeperPlayer> | null = null;
let cacheExpiry = 0;
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export async function getPlayers(): Promise<Map<string, SleeperPlayer>> {
  if (cache && Date.now() < cacheExpiry) return cache;

  console.log("Fetching NFL players from Sleeper API…");
  const res = await fetch("https://api.sleeper.app/v1/players/nfl");
  if (!res.ok) throw new Error(`Sleeper API error: ${res.status}`);

  const raw = await res.json() as Record<string, any>;

  cache = new Map();
  for (const [id, p] of Object.entries(raw)) {
    // Only include skill positions + DEF
    if (!["QB", "RB", "WR", "TE", "K", "DEF"].includes(p.position)) continue;
    // Skip players with no team (retired/inactive)
    if (!p.team && p.position !== "DEF") continue;

    cache.set(id, {
      player_id: id,
      first_name: p.first_name ?? "",
      last_name: p.last_name ?? "",
      full_name: p.full_name ?? `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim(),
      position: p.position,
      team: p.team ?? null,
      status: p.status ?? null,
      injury_status: p.injury_status ?? null,
      number: p.number ?? null,
      depth_chart_order: p.depth_chart_order ?? null,
      search_rank: p.search_rank ?? 999999,
    });
  }

  cacheExpiry = Date.now() + CACHE_TTL;
  console.log(`Player cache loaded: ${cache.size} players`);
  return cache;
}

export async function searchPlayers(
  query: string,
  position?: string,
  excludeIds: Set<string> = new Set()
): Promise<SleeperPlayer[]> {
  const players = await getPlayers();
  const q = query.toLowerCase();

  return Array.from(players.values())
    .filter((p) => {
      if (excludeIds.has(p.player_id)) return false;
      if (position && position !== "ALL" && p.position !== position) return false;
      if (q && !p.full_name.toLowerCase().includes(q) && !p.team?.toLowerCase().includes(q)) return false;
      return true;
    })
    .sort((a, b) => (a.search_rank ?? 999999) - (b.search_rank ?? 999999))
    .slice(0, 50);
}

export interface EnrichedPlayer {
  name: string;
  position: string;
  team: string | null;
  headshotUrl: string;
}

export async function enrichPlayers(
  playerIds: string[]
): Promise<Record<string, EnrichedPlayer>> {
  const players = await getPlayers();
  const result: Record<string, EnrichedPlayer> = {};
  for (const id of playerIds) {
    const p = players.get(id);
    result[id] = {
      name: p
        ? p.position === "DEF"
          ? `${p.team ?? id} D/ST`
          : p.full_name
        : id,
      position: p?.position ?? "UNK",
      team: p?.team ?? null,
      headshotUrl: `https://sleepercdn.com/content/nfl/players/thumb/${id}.jpg`,
    };
  }
  return result;
}
