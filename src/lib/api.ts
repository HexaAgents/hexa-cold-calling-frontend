const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

function getToken(): string | null {
  return typeof window !== "undefined"
    ? localStorage.getItem("access_token")
    : null;
}

function forceLogout() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("user");
  window.location.href = "/login";
}

async function tryRefreshToken(): Promise<boolean> {
  const refreshToken =
    typeof window !== "undefined"
      ? localStorage.getItem("refresh_token")
      : null;

  if (!refreshToken) return false;

  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!res.ok) return false;

    const data = await res.json();
    localStorage.setItem("access_token", data.access_token);
    localStorage.setItem("refresh_token", data.refresh_token);
    return true;
  } catch {
    return false;
  }
}

async function refreshIfNeeded(): Promise<boolean> {
  if (isRefreshing) return refreshPromise!;

  isRefreshing = true;
  refreshPromise = tryRefreshToken().finally(() => {
    isRefreshing = false;
    refreshPromise = null;
  });
  return refreshPromise;
}

export async function ensureFreshToken(): Promise<void> {
  await tryRefreshToken();
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (res.status === 401 && path !== "/auth/login" && path !== "/auth/refresh") {
    const refreshed = await refreshIfNeeded();
    if (refreshed) {
      headers["Authorization"] = `Bearer ${getToken()}`;
      res = await fetch(`${API_URL}${path}`, { ...options, headers });
    } else {
      forceLogout();
      throw new Error("Session expired. Please log in again.");
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `API error: ${res.status}`);
  }

  return res.json();
}

export async function apiDownload(
  path: string,
  suggestedFilename: string,
): Promise<void> {
  const token = getToken();

  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let res = await fetch(`${API_URL}${path}`, { headers });

  if (res.status === 401) {
    const refreshed = await refreshIfNeeded();
    if (refreshed) {
      headers["Authorization"] = `Bearer ${getToken()}`;
      res = await fetch(`${API_URL}${path}`, { headers });
    } else {
      forceLogout();
      throw new Error("Session expired. Please log in again.");
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Download error: ${res.status}`);
  }

  // Prefer the server-provided filename when present so callers don't have
  // to keep their suggestion in sync with backend renames.
  const disposition = res.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="?([^";]+)"?/i);
  const filename = match ? match[1] : suggestedFilename;

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function apiUpload<T>(path: string, file: File): Promise<T> {
  const token = getToken();

  const form = new FormData();
  form.append("file", file);

  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers,
    body: form,
  });

  if (res.status === 401) {
    const refreshed = await refreshIfNeeded();
    if (refreshed) {
      headers["Authorization"] = `Bearer ${getToken()}`;
      res = await fetch(`${API_URL}${path}`, {
        method: "POST",
        headers,
        body: form,
      });
    } else {
      forceLogout();
      throw new Error("Session expired. Please log in again.");
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Upload error: ${res.status}`);
  }

  return res.json();
}
