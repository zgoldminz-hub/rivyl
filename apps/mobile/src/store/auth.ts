import AsyncStorage from "@react-native-async-storage/async-storage";
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
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: true,

  login: async (email, password) => {
    const res = await api.post<{ accessToken: string; refreshToken: string; user: UserPublic }>(
      "/auth/login",
      { email, password }
    );
    if (!res.ok) return res.error;
    await AsyncStorage.setItem("accessToken", res.data.accessToken);
    await AsyncStorage.setItem("refreshToken", res.data.refreshToken);
    set({ user: res.data.user });
    return null;
  },

  register: async (email, username, password) => {
    const res = await api.post<{ accessToken: string; refreshToken: string; user: UserPublic }>(
      "/auth/register",
      { email, username, password }
    );
    if (!res.ok) return res.error;
    await AsyncStorage.setItem("accessToken", res.data.accessToken);
    await AsyncStorage.setItem("refreshToken", res.data.refreshToken);
    set({ user: res.data.user });
    return null;
  },

  logout: async () => {
    const refreshToken = await AsyncStorage.getItem("refreshToken");
    await api.post("/auth/logout", { refreshToken });
    await AsyncStorage.multiRemove(["accessToken", "refreshToken"]);
    set({ user: null });
  },

  fetchMe: async () => {
    set({ loading: true });
    const token = await AsyncStorage.getItem("accessToken");
    if (!token) {
      set({ loading: false });
      return;
    }
    const res = await api.get<{ user: UserPublic }>("/auth/me");
    if (res.ok) set({ user: res.data.user });
    set({ loading: false });
  },
}));
