import { create } from "zustand";
import { UserPublic } from "@rivyl/shared";
import { api } from "../api/client";

interface AuthState {
  user: UserPublic | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<string | null>;
  register: (email: string, username: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
  setUser: (user: UserPublic) => void;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: true,

  setUser: (user) => set({ user }),

  login: async (email, password) => {
    const res = await api.post<{ accessToken: string; refreshToken: string; user: UserPublic }>(
      "/auth/login",
      { email, password }
    );
    if (!res.ok) return res.error;
    localStorage.setItem("accessToken", res.data.accessToken);
    localStorage.setItem("refreshToken", res.data.refreshToken);
    set({ user: res.data.user });
    return null;
  },

  register: async (email, username, password) => {
    const res = await api.post<{ accessToken: string; refreshToken: string; user: UserPublic }>(
      "/auth/register",
      { email, username, password }
    );
    if (!res.ok) return res.error;
    localStorage.setItem("accessToken", res.data.accessToken);
    localStorage.setItem("refreshToken", res.data.refreshToken);
    set({ user: res.data.user });
    return null;
  },

  logout: async () => {
    const refreshToken = localStorage.getItem("refreshToken");
    await api.post("/auth/logout", { refreshToken });
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    set({ user: null });
  },

  fetchMe: async () => {
    set({ loading: true });
    const token = localStorage.getItem("accessToken");
    if (!token) { set({ loading: false }); return; }
    const res = await api.get<{ user: UserPublic }>("/auth/me");
    if (res.ok) set({ user: res.data.user });
    set({ loading: false });
  },
}));
