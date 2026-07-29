import { ApiResponse } from "@rivyl/shared";

const BASE = (import.meta.env.VITE_API_URL ?? "") + "/api";

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = localStorage.getItem("accessToken");

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const json = await res.json();

  // Auto-refresh on 401
  if (res.status === 401 && path !== "/auth/refresh" && path !== "/auth/login") {
    const refreshed = await refreshTokens();
    if (refreshed) {
      return request<T>(path, options);
    }
  }

  return json as ApiResponse<T>;
}

async function refreshTokens(): Promise<boolean> {
  const refreshToken = localStorage.getItem("refreshToken");
  if (!refreshToken) return false;

  const res = await fetch(`${BASE}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  if (!res.ok) {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    window.location.href = "/login";
    return false;
  }

  const json = await res.json();
  if (json.ok) {
    localStorage.setItem("accessToken", json.data.accessToken);
    localStorage.setItem("refreshToken", json.data.refreshToken);
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
