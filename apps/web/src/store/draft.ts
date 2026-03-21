import { create } from "zustand";
import { io, Socket } from "socket.io-client";

export interface DraftTeam {
  id: string;
  userId: string;
  name: string;
  draftOrder: number;
  roster: { playerId: string; slot: string }[];
  auctionBudget?: number;
}

export interface SnakePick {
  pickNumber: number;
  round: number;
  teamId: string;
  playerId: string | null;
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
  endsAt: number;
}

export interface DraftStateData {
  leagueId: string;
  draftType: "SNAKE" | "AUCTION";
  status: "WAITING" | "ACTIVE" | "COMPLETE";
  teams: DraftTeam[];
  picks: SnakePick[];
  currentPickNumber: number;
  currentRound: number;
  currentTeamId: string;
  timerEndsAt: number;
  currentNomination: AuctionNomination | null;
  nominationQueue: string[];
  completedAuctionPicks: { teamId: string; playerId: string; amount: number; playerName: string; playerPosition: string }[];
}

export interface PlayerResult {
  player_id: string;
  full_name: string;
  position: string;
  team: string | null;
  status: string | null;
  injury_status: string | null;
  search_rank: number | null;
}

interface DraftStore {
  socket: Socket | null;
  state: DraftStateData | null;
  searchResults: PlayerResult[];
  error: string | null;
  connect: (leagueId: string, token: string) => void;
  disconnect: () => void;
  search: (query: string, position?: string) => void;
  pick: (playerId: string) => void;
  nominate: (playerId: string, openingBid: number) => void;
  bid: (amount: number) => void;
  clearError: () => void;
}

export const useDraft = create<DraftStore>((set, get) => ({
  socket: null,
  state: null,
  searchResults: [],
  error: null,

  connect: (leagueId, token) => {
    const existing = get().socket;
    if (existing) existing.disconnect();

    const socket = io(import.meta.env.VITE_API_URL ?? "http://localhost:4000", {
      auth: { token },
    });

    socket.on("connect", () => {
      socket.emit("draft:join", { leagueId });
    });

    socket.on("draft:state", (state: DraftStateData) => set({ state }));
    socket.on("draft:picked", ({ state }: { state: DraftStateData }) => set({ state }));
    socket.on("draft:nominated", ({ state }: { state: DraftStateData }) => set({ state }));
    socket.on("draft:bidPlaced", ({ state }: { state: DraftStateData }) => set({ state }));
    socket.on("draft:auctionWon", ({ state }: { state: DraftStateData }) => set({ state }));
    socket.on("draft:complete", ({ state }: { state: DraftStateData }) => set({ state }));
    socket.on("draft:searchResults", ({ players }: { players: PlayerResult[] }) => set({ searchResults: players }));
    socket.on("draft:error", ({ message }: { message: string }) => set({ error: message }));

    set({ socket, state: null, searchResults: [], error: null });
  },

  disconnect: () => {
    get().socket?.disconnect();
    set({ socket: null, state: null });
  },

  search: (query, position) => {
    get().socket?.emit("draft:search", { query, position });
  },

  pick: (playerId) => {
    get().socket?.emit("draft:pick", { playerId });
  },

  nominate: (playerId, openingBid) => {
    get().socket?.emit("draft:nominate", { playerId, openingBid });
  },

  bid: (amount) => {
    get().socket?.emit("draft:bid", { amount });
  },

  clearError: () => set({ error: null }),
}));
