import { storage } from "@/src/utils/storage";

export const API_BASE = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`;
export const SUPER_ADMIN_EMAIL = "myscraptv@gmail.com";
const TOKEN_KEY = "forge.token";

export async function getToken(): Promise<string | null> {
  return storage.secureGet<string>(TOKEN_KEY, "");
}
export async function setToken(token: string | null) {
  if (token) return storage.secureSet(TOKEN_KEY, token);
  return storage.secureRemove(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function apiFetch<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { detail: text };
  }
  if (!res.ok) {
    throw new ApiError(typeof data?.detail === "string" ? data.detail : "error.generic", res.status);
  }
  return data as T;
}

export async function apiUpload<T = any>(path: string, formData: FormData): Promise<T> {
  const token = await getToken();
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${API_BASE}${path}`, { method: "POST", headers, body: formData });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data?.detail || "error.generic", res.status);
  return data as T;
}

// Build an authenticated file URL for <img>/expo-image (token in query for web).
export function fileUrl(photoId: string, token: string | null) {
  return `${API_BASE}/files/${photoId}${token ? `?token=${token}` : ""}`;
}
