import { prisma } from "./prisma";
import { SleeperPlayer } from "./sleeperApi";

// ─── Constants ────────────────────────────────────────────────────────────────

export const ROSTER_SLOTS = {
  QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, K: 1, DEF: 1, BENCH: 6,
} as const;

export const TOTAL_ROSTER_SIZE = Object.values(ROSTER_SLOTS).reduce((a, b) => a + b, 0); // 15
export const PICK_TIMER_SECONDS = 90;
export const AUCTION_BUDGET = 200;

// FLEX eligible positions
const FLEX_POSITIONS = new Set(["RB", "WR", "TE"]);

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DraftTeam {
  id: string;
  userId: string;
  name: string;
  draftOrder: number;
  roster: { playerId: string; slot: string }[];
  auctionBudget?: number; // auction only
  nominationIndex?: number; // auction: how many times this team has nominated
}

export interface SnakePick {
  pickNumber: number;
  round: number;
  teamId: string;
  playerId: string | null; // null = not yet picked
  playerName?: string;
  playerPosition?: string;
  playerTeam?: string;
  isAutoPick?: boolean;
}

export interface AuctionNomination {
  nominatingTeamId: string;
  playerId: string;
  playerName: string;
  playerPosition: string;
  playerTeam: string | null;
  currentBid: number;
  currentBidTeamId: string | null;
  bids: { teamId: string; amount: number; at: number }[];
  endsAt: number; // timestamp
}

export interface DraftState {
  leagueId: string;
  draftType: "SNAKE" | "AUCTION";
  status: "WAITING" | "ACTIVE" | "COMPLETE";
  teams: DraftTeam[];
  // Snake
  picks: SnakePick[];
  currentPickNumber: number;
  currentRound: number;
  currentTeamId: string;
  timerEndsAt: number;
  // Auction
  currentNomination: AuctionNomination | null;
  nominationQueue: string[]; // teamIds in nomination order
  completedAuctionPicks: { teamId: string; playerId: string; amount: number; playerName: string; playerPosition: string }[];
}

// In-memory store of active drafts
const activeDrafts = new Map<string, DraftState>();

// ─── Initialize draft ─────────────────────────────────────────────────────────

export async function initDraft(leagueId: string): Promise<DraftState> {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    include: {
      teams: { where: { paid: true }, orderBy: { createdAt: "asc" } },
    },
  });

  if (!league) throw new Error("League not found");
  if (league.status !== "SETUP") throw new Error("Draft already started or complete");

  const paidTeams = league.teams;
  if (paidTeams.length < 2) throw new Error("Need at least 2 paid teams to start draft");

  // Randomize draft order
  const shuffled = [...paidTeams].sort(() => Math.random() - 0.5);
  const teams: DraftTeam[] = shuffled.map((t, i) => ({
    id: t.id,
    userId: t.userId,
    name: t.name,
    draftOrder: i + 1,
    roster: [],
    ...(league.draftType === "AUCTION" ? { auctionBudget: AUCTION_BUDGET, nominationIndex: 0 } : {}),
  }));

  // Assign draft order in DB
  await Promise.all(
    teams.map((t) => prisma.team.update({ where: { id: t.id }, data: { draftOrder: t.draftOrder } }))
  );

  // Update league status
  await prisma.league.update({ where: { id: leagueId }, data: { status: "DRAFTING" } });

  const totalPicks = TOTAL_ROSTER_SIZE * teams.length;

  let state: DraftState;

  if (league.draftType === "SNAKE") {
    const picks: SnakePick[] = [];
    for (let pick = 1; pick <= totalPicks; pick++) {
      const round = Math.ceil(pick / teams.length);
      const posInRound = ((pick - 1) % teams.length);
      const teamIndex = round % 2 === 1 ? posInRound : teams.length - 1 - posInRound;
      picks.push({
        pickNumber: pick,
        round,
        teamId: teams[teamIndex].id,
        playerId: null,
      });
    }

    state = {
      leagueId,
      draftType: "SNAKE",
      status: "ACTIVE",
      teams,
      picks,
      currentPickNumber: 1,
      currentRound: 1,
      currentTeamId: picks[0].teamId,
      timerEndsAt: Date.now() + PICK_TIMER_SECONDS * 1000,
      currentNomination: null,
      nominationQueue: [],
      completedAuctionPicks: [],
    };
  } else {
    // Auction
    const nominationQueue = teams.map((t) => t.id);
    state = {
      leagueId,
      draftType: "AUCTION",
      status: "ACTIVE",
      teams,
      picks: [],
      currentPickNumber: 0,
      currentRound: 1,
      currentTeamId: nominationQueue[0],
      timerEndsAt: Date.now() + PICK_TIMER_SECONDS * 1000,
      currentNomination: null,
      nominationQueue,
      completedAuctionPicks: [],
    };
  }

  activeDrafts.set(leagueId, state);
  return state;
}

// ─── Get draft state ──────────────────────────────────────────────────────────

export function getDraftState(leagueId: string): DraftState | null {
  return activeDrafts.get(leagueId) ?? null;
}

// ─── Snake: make a pick ───────────────────────────────────────────────────────

export async function makeSnakePick(
  leagueId: string,
  teamId: string,
  player: SleeperPlayer,
  isAutoPick = false
): Promise<{ state: DraftState; pick: SnakePick }> {
  const state = activeDrafts.get(leagueId);
  if (!state || state.draftType !== "SNAKE") throw new Error("No active snake draft");
  if (state.status !== "ACTIVE") throw new Error("Draft is not active");
  if (state.currentTeamId !== teamId && !isAutoPick) throw new Error("Not your turn");

  const alreadyDrafted = state.picks.some((p) => p.playerId === player.player_id);
  if (alreadyDrafted) throw new Error("Player already drafted");

  const currentPick = state.picks[state.currentPickNumber - 1];
  currentPick.playerId = player.player_id;
  currentPick.playerName = player.full_name;
  currentPick.playerPosition = player.position;
  currentPick.playerTeam = player.team ?? undefined;
  currentPick.isAutoPick = isAutoPick;

  // Add to team roster
  const team = state.teams.find((t) => t.id === teamId)!;
  const slot = assignRosterSlot(team.roster, player.position);
  team.roster.push({ playerId: player.player_id, slot });

  // Persist pick to DB
  await prisma.draftPick.create({
    data: {
      leagueId,
      teamId,
      playerId: player.player_id,
      round: currentPick.round,
      pickNumber: currentPick.pickNumber,
    },
  });
  await prisma.rosterSlot.create({
    data: { teamId, playerId: player.player_id, slot },
  });

  // Advance to next pick
  const nextPickNumber = state.currentPickNumber + 1;
  const totalPicks = TOTAL_ROSTER_SIZE * state.teams.length;

  if (nextPickNumber > totalPicks) {
    state.status = "COMPLETE";
    state.currentPickNumber = nextPickNumber;
    await finalizeDraft(leagueId);
  } else {
    state.currentPickNumber = nextPickNumber;
    state.currentRound = Math.ceil(nextPickNumber / state.teams.length);
    state.currentTeamId = state.picks[nextPickNumber - 1].teamId;
    state.timerEndsAt = Date.now() + PICK_TIMER_SECONDS * 1000;
  }

  return { state, pick: currentPick };
}

// ─── Auction: nominate a player ───────────────────────────────────────────────

export function nominatePlayer(
  leagueId: string,
  teamId: string,
  player: SleeperPlayer,
  openingBid: number
): DraftState {
  const state = activeDrafts.get(leagueId);
  if (!state || state.draftType !== "AUCTION") throw new Error("No active auction draft");
  if (state.currentTeamId !== teamId) throw new Error("Not your turn to nominate");
  if (state.currentNomination) throw new Error("Nomination already in progress");

  const alreadyDrafted = state.completedAuctionPicks.some((p) => p.playerId === player.player_id);
  if (alreadyDrafted) throw new Error("Player already drafted");

  const team = state.teams.find((t) => t.id === teamId)!;
  const remaining = TOTAL_ROSTER_SIZE - team.roster.length;
  const minBudgetNeeded = remaining - 1; // $1 per remaining spot after this
  if ((team.auctionBudget ?? 0) - openingBid < minBudgetNeeded) {
    throw new Error("Not enough budget");
  }

  state.currentNomination = {
    nominatingTeamId: teamId,
    playerId: player.player_id,
    playerName: player.full_name,
    playerPosition: player.position,
    playerTeam: player.team ?? null,
    currentBid: openingBid,
    currentBidTeamId: teamId,
    bids: [{ teamId, amount: openingBid, at: Date.now() }],
    endsAt: Date.now() + 30 * 1000, // 30s auction window
  };

  return state;
}

// ─── Auction: place a bid ─────────────────────────────────────────────────────

export function placeBid(leagueId: string, teamId: string, amount: number): DraftState {
  const state = activeDrafts.get(leagueId);
  if (!state || state.draftType !== "AUCTION") throw new Error("No active auction draft");
  if (!state.currentNomination) throw new Error("No active nomination");

  const nom = state.currentNomination;
  if (amount <= nom.currentBid) throw new Error(`Bid must be higher than $${nom.currentBid}`);

  const team = state.teams.find((t) => t.id === teamId)!;
  const remaining = TOTAL_ROSTER_SIZE - team.roster.length;
  const minBudgetNeeded = remaining - 1;
  if ((team.auctionBudget ?? 0) - amount < minBudgetNeeded) throw new Error("Not enough budget");

  nom.currentBid = amount;
  nom.currentBidTeamId = teamId;
  nom.bids.push({ teamId, amount, at: Date.now() });
  // Extend timer if bid placed in last 5s
  if (nom.endsAt - Date.now() < 5000) {
    nom.endsAt = Date.now() + 5000;
  }

  return state;
}

// ─── Auction: finalize nomination (timer expired) ─────────────────────────────

export async function finalizeNomination(leagueId: string): Promise<DraftState> {
  const state = activeDrafts.get(leagueId);
  if (!state || !state.currentNomination) throw new Error("No active nomination");

  const nom = state.currentNomination;
  const winningTeamId = nom.currentBidTeamId!;
  const winningTeam = state.teams.find((t) => t.id === winningTeamId)!;

  // Deduct budget
  winningTeam.auctionBudget = (winningTeam.auctionBudget ?? 0) - nom.currentBid;

  // Assign to roster
  const slot = assignRosterSlot(winningTeam.roster, nom.playerPosition);
  winningTeam.roster.push({ playerId: nom.playerId, slot });

  state.completedAuctionPicks.push({
    teamId: winningTeamId,
    playerId: nom.playerId,
    amount: nom.currentBid,
    playerName: nom.playerName,
    playerPosition: nom.playerPosition,
  });

  // Persist
  await prisma.draftPick.create({
    data: { leagueId, teamId: winningTeamId, playerId: nom.playerId, amount: nom.currentBid },
  });
  await prisma.rosterSlot.create({
    data: { teamId: winningTeamId, playerId: nom.playerId, slot },
  });

  state.currentNomination = null;
  state.currentPickNumber += 1;

  // Advance nomination turn (round-robin, skip full teams)
  const totalSlots = TOTAL_ROSTER_SIZE * state.teams.length;
  if (state.completedAuctionPicks.length >= totalSlots) {
    state.status = "COMPLETE";
    await finalizeDraft(leagueId);
  } else {
    advanceAuctionNominator(state);
    state.timerEndsAt = Date.now() + PICK_TIMER_SECONDS * 1000;
  }

  return state;
}

// ─── Auto-pick (snake) ────────────────────────────────────────────────────────

export async function autoPickBestAvailable(
  leagueId: string,
  players: Map<string, SleeperPlayer>
): Promise<{ state: DraftState; pick: SnakePick } | null> {
  const state = activeDrafts.get(leagueId);
  if (!state || state.status !== "ACTIVE" || state.draftType !== "SNAKE") return null;

  const draftedIds = new Set(state.picks.filter((p) => p.playerId).map((p) => p.playerId!));
  const team = state.teams.find((t) => t.id === state.currentTeamId)!;

  // Find best available player by search_rank
  const available = Array.from(players.values())
    .filter((p) => !draftedIds.has(p.player_id))
    .filter((p) => needsPosition(team.roster, p.position))
    .sort((a, b) => (a.search_rank ?? 999999) - (b.search_rank ?? 999999));

  if (available.length === 0) return null;

  return makeSnakePick(leagueId, state.currentTeamId, available[0], true);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function assignRosterSlot(
  roster: { playerId: string; slot: string }[],
  position: string
): string {
  const counts = rosterCounts(roster);

  // Fill primary slot first
  const primary = position as keyof typeof ROSTER_SLOTS;
  if ((counts[primary] ?? 0) < (ROSTER_SLOTS[primary] ?? 0)) return primary;

  // Fill FLEX if eligible
  if (FLEX_POSITIONS.has(position) && (counts["FLEX"] ?? 0) < ROSTER_SLOTS.FLEX) return "FLEX";

  // Bench
  return "BENCH";
}

function needsPosition(roster: { playerId: string; slot: string }[], position: string): boolean {
  const counts = rosterCounts(roster);
  const primary = position as keyof typeof ROSTER_SLOTS;
  if ((counts[primary] ?? 0) < (ROSTER_SLOTS[primary] ?? 0)) return true;
  if (FLEX_POSITIONS.has(position) && (counts["FLEX"] ?? 0) < ROSTER_SLOTS.FLEX) return true;
  if ((counts["BENCH"] ?? 0) < ROSTER_SLOTS.BENCH) return true;
  return false;
}

function rosterCounts(roster: { slot: string }[]): Record<string, number> {
  return roster.reduce((acc, r) => {
    acc[r.slot] = (acc[r.slot] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

function advanceAuctionNominator(state: DraftState) {
  const fullTeams = new Set(
    state.teams.filter((t) => t.roster.length >= TOTAL_ROSTER_SIZE).map((t) => t.id)
  );

  let nextIdx = state.nominationQueue.indexOf(state.currentTeamId) + 1;
  for (let i = 0; i < state.teams.length; i++) {
    const candidateId = state.nominationQueue[(nextIdx + i) % state.nominationQueue.length];
    if (!fullTeams.has(candidateId)) {
      state.currentTeamId = candidateId;
      return;
    }
  }
}

async function finalizeDraft(leagueId: string) {
  await prisma.league.update({ where: { id: leagueId }, data: { status: "ACTIVE" } });
  // Auto-generate regular season schedule
  const { generateSchedule } = await import("./scheduleGenerator");
  await generateSchedule(leagueId).catch((err) =>
    console.error("Schedule generation failed:", err)
  );
}
