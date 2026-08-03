import AsyncStorage from "@react-native-async-storage/async-storage";
import { ApiResponse } from "@rivyl/shared";

const BASE = "https://rivyl-production.up.railway.app";

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = await AsyncStorage.getItem("accessToken");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(`${BASE}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
    clearTimeout(timeout);
    const json = await res.json();
    if (res.status === 401 && path !== "/auth/refresh" && path !== "/auth/login") {
      const refreshed = await refreshTokens();
      if (refreshed) return request<T>(path, options);
    }
    return json as ApiResponse<T>;
  } catch (err: any) {
    clearTimeout(timeout);
    const message = err?.name === "AbortError" ? "Request timed out" : (err?.message ?? "Network error");
    return { ok: false, error: message } as ApiResponse<T>;
  }
}

async function refreshTokens(): Promise<boolean> {
  const refreshToken = await AsyncStorage.getItem("refreshToken");
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) { await AsyncStorage.multiRemove(["accessToken", "refreshToken"]); return false; }
    const json = await res.json();
    if (json.ok) {
      await AsyncStorage.setItem("accessToken", json.data.accessToken);
      await AsyncStorage.setItem("refreshToken", json.data.refreshToken);
      return true;
    }
  } catch {}
  return false;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
