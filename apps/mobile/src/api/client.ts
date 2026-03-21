import AsyncStorage from "@react-native-async-storage/async-storage";
import { ApiResponse } from "@rivyl/shared";

// Update this to your API URL (use your machine's local IP for device testing)
const BASE = __DEV__ ? "http://localhost:4000" : "https://api.rivyl.com";

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = await AsyncStorage.getItem("accessToken");

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const json = await res.json();

  if (res.status === 401 && path !== "/auth/refresh" && path !== "/auth/login") {
    const refreshed = await refreshTokens();
    if (refreshed) return request<T>(path, options);
  }

  return json as ApiResponse<T>;
}

async function refreshTokens(): Promise<boolean> {
  const refreshToken = await AsyncStorage.getItem("refreshToken");
  if (!refreshToken) return false;

  const res = await fetch(`${BASE}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  if (!res.ok) {
    await AsyncStorage.multiRemove(["accessToken", "refreshToken"]);
    return false;
  }

  const json = await res.json();
  if (json.ok) {
    await AsyncStorage.setItem("accessToken", json.data.accessToken);
    await AsyncStorage.setItem("refreshToken", json.data.refreshToken);
    return true;
  }

  return false;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
