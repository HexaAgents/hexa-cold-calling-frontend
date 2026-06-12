import { apiFetch } from "@/lib/api";

const PREFIX = "cached-fetch:";
const DEFAULT_TTL_MS = 5 * 60 * 1000;

interface CacheEntry<T> {
  value: T;
  storedAt: number;
}

function readCache<T>(path: string, ttlMs: number): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PREFIX + path);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (Date.now() - entry.storedAt > ttlMs) return null;
    return entry.value;
  } catch {
    return null;
  }
}

function writeCache<T>(path: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    const entry: CacheEntry<T> = { value, storedAt: Date.now() };
    window.sessionStorage.setItem(PREFIX + path, JSON.stringify(entry));
  } catch {
    // Storage full or unavailable — caching is best-effort.
  }
}

/**
 * sessionStorage-backed TTL cache around apiFetch for static-ish GET data
 * (location dropdown options, settings, assignee lists). Revisits within the
 * TTL render instantly from cache; a background revalidation keeps the cache
 * fresh and invokes `onRevalidate` when the server returns newer data.
 */
export async function cachedFetch<T>(
  path: string,
  options?: { ttlMs?: number; onRevalidate?: (fresh: T) => void },
): Promise<T> {
  const ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;
  const cached = readCache<T>(path, ttlMs);

  if (cached !== null) {
    // Serve stale-but-valid data immediately; refresh in the background.
    void apiFetch<T>(path)
      .then((fresh) => {
        writeCache(path, fresh);
        options?.onRevalidate?.(fresh);
      })
      .catch(() => {});
    return cached;
  }

  const fresh = await apiFetch<T>(path);
  writeCache(path, fresh);
  return fresh;
}

/** Drop a cached entry (e.g. after a mutation that invalidates it). */
export function invalidateCachedFetch(path: string) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(PREFIX + path);
  } catch {
    // ignore
  }
}
