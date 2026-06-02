// Deterministic per-person colors for the To-Do List.
//
// The five known platform users get a fixed, distinct color so their tasks are
// always recognizable. Anyone else falls back to a stable hash of their name so
// the feature still works if the user roster changes.

interface PersonColor {
  pill: string;
  dot: string;
}

// Soft pastel fills with deep, high-contrast text. Intentionally no `dark:`
// variants: the app renders on a light surface, and Tailwind's default `dark:`
// keys off the OS color-scheme — which previously made these pills muddy with
// unreadable text whenever the user's Mac was in dark mode.
const PALETTE: PersonColor[] = [
  { pill: "bg-sky-100 text-sky-800 border-sky-200", dot: "bg-sky-400" },
  { pill: "bg-emerald-100 text-emerald-800 border-emerald-200", dot: "bg-emerald-400" },
  { pill: "bg-violet-100 text-violet-800 border-violet-200", dot: "bg-violet-400" },
  { pill: "bg-amber-100 text-amber-800 border-amber-200", dot: "bg-amber-400" },
  { pill: "bg-rose-100 text-rose-800 border-rose-200", dot: "bg-rose-400" },
  { pill: "bg-teal-100 text-teal-800 border-teal-200", dot: "bg-teal-400" },
  { pill: "bg-pink-100 text-pink-800 border-pink-200", dot: "bg-pink-400" },
  { pill: "bg-indigo-100 text-indigo-800 border-indigo-200", dot: "bg-indigo-400" },
];

const KNOWN_PEOPLE: Record<string, number> = {
  ishaan: 0,
  srijan: 1,
  sanuka: 2,
  aurideep: 3,
  // Teal instead of rose so Mann's pill doesn't read as the red "overdue" styling.
  mann: 5,
};

const UNASSIGNED: PersonColor = {
  pill: "bg-slate-100 text-slate-600 border-slate-200",
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
