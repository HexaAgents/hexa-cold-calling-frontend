// Deterministic per-person colors for the To-Do List.
//
// The five known platform users get a fixed, distinct color so their tasks are
// always recognizable. Anyone else falls back to a stable hash of their name so
// the feature still works if the user roster changes.

interface PersonColor {
  pill: string;
  dot: string;
}

const PALETTE: PersonColor[] = [
  { pill: "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/45 dark:text-sky-200 dark:border-sky-800/70", dot: "bg-sky-400" },
  { pill: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/45 dark:text-emerald-200 dark:border-emerald-800/70", dot: "bg-emerald-400" },
  { pill: "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-950/45 dark:text-violet-200 dark:border-violet-800/70", dot: "bg-violet-400" },
  { pill: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/45 dark:text-amber-200 dark:border-amber-800/70", dot: "bg-amber-400" },
  { pill: "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/45 dark:text-rose-200 dark:border-rose-800/70", dot: "bg-rose-400" },
  { pill: "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-950/45 dark:text-teal-200 dark:border-teal-800/70", dot: "bg-teal-400" },
  { pill: "bg-pink-100 text-pink-800 border-pink-200 dark:bg-pink-950/45 dark:text-pink-200 dark:border-pink-800/70", dot: "bg-pink-400" },
  { pill: "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-950/45 dark:text-indigo-200 dark:border-indigo-800/70", dot: "bg-indigo-400" },
  { pill: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/45 dark:text-orange-200 dark:border-orange-800/70", dot: "bg-orange-400" },
  { pill: "bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-950/45 dark:text-cyan-200 dark:border-cyan-800/70", dot: "bg-cyan-400" },
  { pill: "bg-pink-50/70 text-pink-600 border-pink-100 dark:bg-pink-950/20 dark:text-pink-200 dark:border-pink-900/40", dot: "bg-pink-200" },
];

const KNOWN_PEOPLE: Record<string, number> = {
  ishaan: 0,
  srijan: 1,
  sanuka: 2,
  aurideep: 3,
  // Mann uses a lighter pastel pink by request.
  mann: 10,
};

const UNASSIGNED: PersonColor = {
  pill: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800",
  dot: "bg-slate-400",
};

function paletteFor(name: string): PersonColor {
  const key = name.trim().toLowerCase();
  if (key in KNOWN_PEOPLE) return PALETTE[KNOWN_PEOPLE[key]];
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = key.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export function getPersonPillClasses(name?: string | null): string {
  if (!name) return UNASSIGNED.pill;
  return paletteFor(name).pill;
}

export function getPersonDotClasses(name?: string | null): string {
  if (!name) return UNASSIGNED.dot;
  return paletteFor(name).dot;
}
