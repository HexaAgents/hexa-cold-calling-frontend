// Deterministic per-person colors for the To-Do List.
//
// The five known platform users get a fixed, distinct color so their tasks are
// always recognizable. Anyone else falls back to a stable hash of their name so
// the feature still works if the user roster changes.

const PALETTE: string[] = [
  "bg-sky-500/90 text-white dark:bg-sky-600",
  "bg-emerald-500/90 text-white dark:bg-emerald-600",
  "bg-violet-500/90 text-white dark:bg-violet-600",
  "bg-amber-400/95 text-amber-950 dark:bg-amber-500",
  "bg-rose-500/90 text-white dark:bg-rose-600",
  "bg-teal-500/90 text-white dark:bg-teal-600",
  "bg-pink-500/90 text-white dark:bg-pink-600",
  "bg-indigo-500/90 text-white dark:bg-indigo-600",
  "bg-orange-500/90 text-white dark:bg-orange-600",
  "bg-cyan-500/90 text-white dark:bg-cyan-600",
  "bg-pink-200 text-pink-800 dark:bg-pink-300 dark:text-pink-950",
];

const KNOWN_PEOPLE: Record<string, number> = {
  ishaan: 0,
  srijan: 1,
  sanuka: 2,
  aurideep: 3,
  // Mann uses a lighter pastel pink by request.
  mann: 10,
};

const UNASSIGNED = "bg-slate-300 text-slate-700 dark:bg-zinc-700 dark:text-zinc-300";

// The API only sends first names, so the known users' last-name initials are
// hardcoded (Ishaan Makkar, Srijan Tyagi, Sanuka Gunawardena, Aurideep Nayak,
// Mann Patira). Unknown names fall back to their first two letters.
const KNOWN_INITIALS: Record<string, string> = {
  ishaan: "IM",
  srijan: "ST",
  sanuka: "SG",
  aurideep: "AN",
  mann: "MP",
};

export function getPersonInitials(name: string): string {
  const trimmed = name.trim();
  const key = trimmed.toLowerCase();
  if (key in KNOWN_INITIALS) return KNOWN_INITIALS[key];
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  return trimmed.slice(0, 2).toUpperCase();
}

export function getPersonAvatarClasses(name?: string | null): string {
  if (!name) return UNASSIGNED;
  const key = name.trim().toLowerCase();
  if (key in KNOWN_PEOPLE) return PALETTE[KNOWN_PEOPLE[key]];
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = key.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}
