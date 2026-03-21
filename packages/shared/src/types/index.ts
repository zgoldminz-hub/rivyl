// ─── Auth ────────────────────────────────────────────────────────────────────

export interface RegisterBody {
  email: string;
  username: string;
  password: string;
}

export interface LoginBody {
  email: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: UserPublic;
}

export interface UserPublic {
  id: string;
  email: string;
  username: string;
  createdAt: string;
}

// ─── League ───────────────────────────────────────────────────────────────────

export type ScoringType = "FULL_PPR" | "HALF_PPR";
export type DraftType = "SNAKE" | "AUCTION";
export type LeagueStatus = "SETUP" | "DRAFTING" | "ACTIVE" | "PLAYOFFS" | "COMPLETE";
export type LeagueVisibility = "PRIVATE" | "PUBLIC";

export type PayoutPreset =
  | "WINNER_TAKES_ALL"    // 100%
  | "TOP_TWO"             // 70% / 30%
  | "TOP_THREE";          // 60% / 25% / 15%

export interface LeagueSettings {
  name: string;
  teamCount: number;           // 8, 10, 12
  buyIn: number;               // $10–$1000
  payoutPreset: PayoutPreset;
  scoringType: ScoringType;
  draftType: DraftType;
  visibility: LeagueVisibility;
}

export interface LeaguePublic {
  id: string;
  name: string;
  commissionerId: string;
  teamCount: number;
  buyIn: number;
  payoutPreset: PayoutPreset;
  scoringType: ScoringType;
  draftType: DraftType;
  visibility: LeagueVisibility;
  status: LeagueStatus;
  memberCount: number;
  inviteCode: string;
  createdAt: string;
}

// ─── Roster Positions ─────────────────────────────────────────────────────────

export type RosterSlot = "QB" | "RB" | "WR" | "TE" | "FLEX" | "K" | "DEF" | "BENCH";

// ─── API Envelope ─────────────────────────────────────────────────────────────

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiError {
  ok: false;
  error: string;
  details?: unknown;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;
