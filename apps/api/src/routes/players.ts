import { Router } from "express";
import axios from "axios";

const router = Router();

let playersCache: any[] | null = null;
let playersCacheAt = 0;
const PLAYERS_TTL = 60 * 60 * 1000;       // 1 hr — refreshes when Sleeper updates ADP
let statsCache: Record<string, any> = {};
let statsCacheAt = 0;
const STATS_TTL = 6 * 60 * 60 * 1000;     // 6 hr
let projCache: Record<string, any> = {};
let projCacheAt = 0;
const PROJ_TTL = 6 * 60 * 60 * 1000;      // 6 hr
const SKILL = new Set(["QB", "RB", "WR", "TE", "K", "DEF"]);
const NFL_GAMES = 17;


// ─── Yahoo Sports NFL News ────────────────────────────────────────────────────
let yahooNewsCache: { headline: string; description: string; published: string; link: string | null }[] = [];
let yahooNewsCacheAt = 0;
const YAHOO_NEWS_TTL = 10 * 60 * 1000; // 10 min

async function getYahooNFLNews() {
  if (yahooNewsCache.length && Date.now() - yahooNewsCacheAt < YAHOO_NEWS_TTL) return yahooNewsCache;
  try {
    const { data } = await axios.get("https://sports.yahoo.com/nfl/rss/", {
      timeout: 8000,
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    const items: typeof yahooNewsCache = [];
    const itemRe = /<item>([\s\S]*?)<\/item>/g;
    let m;
    while ((m = itemRe.exec(data)) !== null) {
      const block = m[1];
      const title   = /(?:<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>)/.exec(block);
      const desc    = /(?:<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>)/.exec(block);
      const pubDate = /<pubDate>(.*?)<\/pubDate>/.exec(block);
      const link    = /<link>(.*?)<\/link>/.exec(block);
      items.push({
        headline:    title   ? title[1].trim()                              : "",
        description: desc    ? desc[1].replace(/<[^>]*>/g, "").trim()      : "",
        published:   pubDate ? new Date(pubDate[1].trim()).toISOString()    : "",
        link:        link    ? link[1].trim()                               : null,
      });
    }
    yahooNewsCache   = items;
    yahooNewsCacheAt = Date.now();
    return items;
  } catch {
    return yahooNewsCache;
  }
}

async function getPlayers(): Promise<any[]> {
  if (playersCache && Date.now() - playersCacheAt < PLAYERS_TTL) return playersCache;
  try {
    const { data } = await axios.get("https://api.sleeper.app/v1/players/nfl", { timeout: 30000 });
    const all = Object.values(data as Record<string, any>);
    playersCache = all.filter((p: any) => {
      if (!p.active || !p.team) return false;
      if (!SKILL.has(p.position)) return false;
      if (p.position !== "DEF" && (p.search_rank == null || p.search_rank > 500)) return false;
      return true;
    });
    playersCacheAt = Date.now();
    return playersCache;
  } catch (err) {
    console.error("Sleeper players fetch failed:", err);
    return playersCache ?? [];
  }
}

async function getStats(): Promise<Record<string, any>> {
  if (statsCacheAt && Date.now() - statsCacheAt < STATS_TTL) return statsCache;
  try {
    const { data } = await axios.get("https://api.sleeper.app/v1/stats/nfl/regular/2025/0", { timeout: 15000 });
    statsCache = data ?? {};
  } catch { statsCache = {}; }
  statsCacheAt = Date.now();
  return statsCache;
}

async function getProjections(): Promise<Record<string, any>> {
  if (projCacheAt && Date.now() - projCacheAt < PROJ_TTL) return projCache;
  try {
    const { data } = await axios.get("https://api.sleeper.app/v1/projections/nfl/regular/2025/1", { timeout: 15000 });
    projCache = data ?? {};
  } catch { projCache = {}; }
  projCacheAt = Date.now();
  return projCache;
}


function ptsHalf(s: any): number {
  if (!s) return 0;
  if (s.pts_half_ppr != null) return Math.round(s.pts_half_ppr * 10) / 10;
  return Math.round(((s.pass_yd??0)*0.04+(s.pass_td??0)*4+(s.pass_int??0)*-2+(s.rush_yd??0)*0.1+(s.rush_td??0)*6+(s.rec??0)*0.5+(s.rec_yd??0)*0.1+(s.rec_td??0)*6+(s.fum_lost??0)*-2)*10)/10;
}
function ptsFull(s: any): number {
  if (!s) return 0;
  if (s.pts_ppr != null) return Math.round(s.pts_ppr * 10) / 10;
  return Math.round(((s.pass_yd??0)*0.04+(s.pass_td??0)*4+(s.pass_int??0)*-2+(s.rush_yd??0)*0.1+(s.rush_td??0)*6+(s.rec??0)*1+(s.rec_yd??0)*0.1+(s.rec_td??0)*6+(s.fum_lost??0)*-2)*10)/10;
}

function standardRank(p: any): number {
  const base = p.search_rank ?? 999;
  if (p.position === "QB")  return base + 48;
  if (p.position === "K")   return Math.max(base + 120, 190);
  if (p.position === "DEF") return Math.max(base + 120, 195);
  return base;
}

function formatPlayer(p: any, stats: Record<string, any>, proj: Record<string, any>) {
  const s  = stats[p.player_id] ?? {};
  const pr = proj[p.player_id]  ?? {};
  const hasStats = Object.keys(s).length  > 0;
  const hasProj  = Object.keys(pr).length > 0;

  const halfPpr2024 = ptsHalf(s);
  const fullPpr2024 = ptsFull(s);
  const games2024   = s.gms_active ?? null;
  const ppg2024Half = games2024 && halfPpr2024 > 0 ? Math.round(halfPpr2024 / games2024 * 10) / 10 : null;

  const projWeekHalf = ptsHalf(pr);
  const projWeekFull = ptsFull(pr);

  return {
    id:        p.player_id,
    name:      `${p.first_name} ${p.last_name}`,
    position:  p.position,
    team:      p.team ?? null,
    age:       p.age ?? null,
    yearsExp:  p.years_exp ?? null,
    college:   p.college ?? null,
    height:    p.height ?? null,
    weight:    p.weight ?? null,
    searchRank: standardRank(p),
    espnId:    p.espn_id ? String(p.espn_id) : null,
    // 2024 actuals
    fantasyPts2024:  { halfPpr: halfPpr2024, fullPpr: fullPpr2024 },
    ppg2024:         { halfPpr: ppg2024Half },
    // 2025 projections — Sleeper week 1 proj = expected PPG
    projPts2025:     { halfPpr: projWeekHalf, fullPpr: projWeekFull },
    projSeasonPts2025: {
      halfPpr: Math.round(projWeekHalf * NFL_GAMES * 10) / 10,
      fullPpr: Math.round(projWeekFull * NFL_GAMES * 10) / 10,
    },
    stats2024: hasStats ? {
      games: s.gms_active??null, passYds: s.pass_yd??null, passTds: s.pass_td??null, passInt: s.pass_int??null,
      rushAtt: s.rush_att??null, rushYds: s.rush_yd??null, rushTds: s.rush_td??null,
      rec: s.rec??null, targets: s.rec_tgt??null, recYds: s.rec_yd??null, recTds: s.rec_td??null,
    } : null,
    projStats2025: hasProj ? {
      passYds: pr.pass_yd??null, passTds: pr.pass_td??null, rushYds: pr.rush_yd??null,
      rushTds: pr.rush_td??null, rec: pr.rec??null, recYds: pr.rec_yd??null, recTds: pr.rec_td??null,
    } : null,
  };
}

router.get("/", async (req, res) => {
  try {
    const { position, q, limit = "300" } = req.query as Record<string, string>;
    const players = await getPlayers();
    if (players.length === 0) return res.status(503).json({ ok: false, error: "Player data unavailable" });
    const [stats, proj] = await Promise.all([getStats(), getProjections()]);
    let results = players.map(p => formatPlayer(p, stats, proj));
    if (position && position !== "ALL") results = results.filter(p => p.position === position);
    if (q) {
      const lq = q.toLowerCase();
      results = results.filter(p => p.name.toLowerCase().includes(lq) || (p.team ?? "").toLowerCase().includes(lq));
    }
    results.sort((a, b) => (a.searchRank ?? 999) - (b.searchRank ?? 999));
    const lim = parseInt(limit) || 300;
    const skills = results.filter(p => p.position !== "DEF" && p.position !== "K");
    const specials = results.filter(p => p.position === "DEF" || p.position === "K");
    const final = (position && position !== "ALL") ? results.slice(0, lim) : [...skills.slice(0, lim), ...specials];
    res.json({ ok: true, data: { players: final } });
  } catch (err) {
    console.error("GET /players:", err);
    res.status(500).json({ ok: false, error: "Failed to fetch players" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const players = await getPlayers();
    const player  = players.find((p: any) => p.player_id === id);
    if (!player) return res.status(404).json({ ok: false, error: "Not found" });
    const [stats, proj] = await Promise.all([getStats(), getProjections()]);
    const detail = formatPlayer(player, stats, proj);
    const allNews = await getYahooNFLNews();
    const fullName  = player.full_name ?? "";
    const lastName  = fullName.split(" ").slice(1).join(" ");
    const news = allNews.filter(n => {
      const h = n.headline.replace(/&#39;/g, "'").replace(/&amp;/g, "&");
      return lastName && (h.includes(lastName) || h.includes(fullName));
    }).slice(0, 5);
    res.json({ ok: true, data: { ...detail, news } });
  } catch (err) {
    console.error("GET /players/:id:", err);
    res.status(500).json({ ok: false, error: "Failed to fetch player" });
  }
});

export default router;
