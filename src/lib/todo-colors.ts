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
  { pill: "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800", dot: "bg-blue-500" },
  { pill: "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800", dot: "bg-emerald-500" },
  { pill: "bg-violet-100 text-violet-700 border-violet-300 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800", dot: "bg-violet-500" },
  { pill: "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800", dot: "bg-amber-500" },
  { pill: "bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800", dot: "bg-rose-500" },
  { pill: "bg-cyan-100 text-cyan-700 border-cyan-300 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800", dot: "bg-cyan-500" },
  { pill: "bg-pink-100 text-pink-700 border-pink-300 dark:bg-pink-950/40 dark:text-pink-300 dark:border-pink-800", dot: "bg-pink-500" },
  { pill: "bg-indigo-100 text-indigo-700 border-indigo-300 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800", dot: "bg-indigo-500" },
];

const KNOWN_PEOPLE: Record<string, number> = {
  ishaan: 0,
  srijan: 1,
  sanuka: 2,
  aurideep: 3,
  mann: 4,
};

const UNASSIGNED: PersonColor = {
  pill: "bg-muted text-muted-foreground border-border",
  dot: "bg-muted-foreground/40",
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
