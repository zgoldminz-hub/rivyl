import { create } from "zustand";
import { api } from "../api/client";

export interface League {
  id: string;
  name: string;
  commissionerId: string;
  maxTeams: number;
  buyIn: number;
  payoutPreset: "WINNER_TAKES_ALL" | "TOP_TWO" | "TOP_THREE";
  scoringType: "FULL_PPR" | "HALF_PPR";
  draftType: "SNAKE" | "AUCTION";
  visibility: "PRIVATE" | "PUBLIC";
  status: "SETUP" | "DRAFTING" | "ACTIVE" | "PLAYOFFS" | "COMPLETE";
  inviteCode: string;
  memberCount: number;
  createdAt: string;
  // joined-league extras
  teamId?: string;
  teamName?: string;
  paid?: boolean;
  isCommissioner?: boolean;
}

export interface LeagueDetail extends League {
  teams: {
    id: string;
    name: string;
    paid: boolean;
    userId: string;
    username: string;
    isCommissioner: boolean;
  }[];
  isMember: boolean;
  payoutSplit: { place: number; percent: number }[];
}

interface LeaguesState {
  myLeagues: League[];
  publicLeagues: League[];
  loadingMine: boolean;
  loadingPublic: boolean;
  fetchMine: () => Promise<void>;
  fetchPublic: () => Promise<void>;
  createLeague: (data: CreateLeagueData) => Promise<{ league: League; error?: string }>;
}

export interface CreateLeagueData {
  name: string;
  maxTeams: number;
  buyIn: number;
  payoutPreset: string;
  scoringType: string;
  draftType: string;
  visibility: string;
}

export const useLeagues = create<LeaguesState>((set) => ({
  myLeagues: [],
  publicLeagues: [],
  loadingMine: false,
  loadingPublic: false,

  fetchMine: async () => {
    set({ loadingMine: true });
    const res = await api.get<{ leagues: League[] }>("/leagues/mine");
    if (res.ok) set({ myLeagues: res.data.leagues });
    set({ loadingMine: false });
  },

  fetchPublic: async () => {
    set({ loadingPublic: true });
    const res = await api.get<{ leagues: League[]; total: number }>("/leagues");
    if (res.ok) set({ publicLeagues: res.data.leagues });
    set({ loadingPublic: false });
  },

  createLeague: async (data) => {
    const res = await api.post<{ league: League }>("/leagues", data);
    if (!res.ok) return { league: {} as League, error: res.error };
    set((s) => ({ myLeagues: [{ ...res.data.league, isCommissioner: true }, ...s.myLeagues] }));
    return { league: res.data.league };
  },
}));
