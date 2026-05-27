import { create } from "zustand";
import { io, Socket } from "socket.io-client";

export interface MatchupScore {
  id: string;
  homeTeamId: string;
  homeTeamName: string;
  homeScore: number;
  awayTeamId: string;
  awayTeamName: string;
  awayScore: number;
}

export interface LeagueScores {
  leagueId: string;
  week: number;
  matchups: MatchupScore[];
  updatedAt?: number;
}

interface ScoresStore {
  socket: Socket | null;
  liveScores: Record<string, LeagueScores>;
  connect: (leagueIds: string[], token: string) => void;
  disconnect: () => void;
}

export const useScores = create<ScoresStore>((set, get) => ({
  socket: null,
  liveScores: {},

  connect: (leagueIds, token) => {
    const existing = get().socket;
    if (existing) existing.disconnect();

    const socket = io(import.meta.env.VITE_API_URL ?? "http://localhost:4000", {
      auth: { token },
    });

    socket.on("connect", () => {
      for (const id of leagueIds) {
        socket.emit("scores:join", { leagueId: id });
      }
    });

    socket.on("scores:update", (data: LeagueScores) => {
      set((s) => ({
        liveScores: {
          ...s.liveScores,
          [data.leagueId]: { ...data, updatedAt: Date.now() },
        },
      }));
    });

    set({ socket });
  },

  disconnect: () => {
    get().socket?.disconnect();
    set({ socket: null, liveScores: {} });
  },
}));
