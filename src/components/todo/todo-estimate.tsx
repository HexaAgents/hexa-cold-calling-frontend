"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Sparkles, Clock } from "lucide-react";
import type { Todo } from "@/types";

const QUICK_PICK_HOURS = [0.5, 1, 2, 4, 8];

/** "2" -> "2h", 0.5 -> "0.5h" (trims trailing .0). */
export function formatHours(hours: number): string {
  const rounded = Math.round(hours * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded}h`;
}

export function formatEstimateRange(min: number, max: number): string {
  if (min === max) return formatHours(min);
  return `${formatHours(min).slice(0, -1)}–${formatHours(max)}`;
}

/**
 * AI time estimate for a task: pulsing "Estimating..." while the background
 * task runs, a sparkle badge with the hour range once done, and the reported
 * actual hours alongside for completed tasks.
 */
export function EstimateBadge({ todo }: { todo: Todo }) {
  const actual =
    todo.actual_hours != null ? (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" title="Reported actual time">
        <Clock size={11} className="opacity-70" />
        took {formatHours(todo.actual_hours)}
      </span>
    ) : null;

  if (todo.estimate_status === "pending") {
    return (
      <span className="inline-flex animate-pulse items-center gap-1.5 text-xs text-muted-foreground">
        <Sparkles size={12} className="opacity-70" />
        Estimating…
      </span>
    );
  }

  if (
    todo.estimate_status === "done" &&
    todo.estimated_hours_min != null &&
    todo.estimated_hours_max != null
  ) {
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        <span
          className="inline-flex items-center gap-1 border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
          title="AI time estimate"
        >
          <Sparkles size={11} />
          {formatEstimateRange(todo.estimated_hours_min, todo.estimated_hours_max)}
        </span>
        {actual}
      </span>
    );
  }

  if (actual) return actual;
  return <span className="text-xs text-muted-foreground">—</span>;
}

/**
 * Asked after a task is ticked off: "how long did this take?" The task is
 * already marked done before this opens, so skipping costs nothing. Reported
 * hours are sent as a single PATCH and feed the AI estimator's calibration.
 */
export function ActualHoursDialog({
  todo,
  onClose,
  onSaved,
}: {
  todo: Todo;
  onClose: () => void;
  onSaved: (updated: Todo) => void;
}) {
  const [hoursText, setHoursText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const parsed = Number(hoursText);
  const valid = hoursText.trim() !== "" && Number.isFinite(parsed) && parsed >= 0.1 && parsed <= 500;

  const save = async (hours: number) => {
    setSaving(true);
    setError("");
    try {
      const updated = await apiFetch<Todo>(`/todos/${todo.id}`, {
        method: "PATCH",
        body: JSON.stringify({ actual_hours: hours }),
      });
      onSaved(updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save hours.");
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock size={15} className="text-primary" />
            How long did this take?
          </DialogTitle>
        </DialogHeader>
        <p className="-mt-2 text-xs text-muted-foreground">
          “{todo.title}” is done. Reporting the real time makes future AI estimates more accurate — or skip if you’re not sure.
        </p>
        {todo.estimated_hours_min != null && todo.estimated_hours_max != null && (
          <p className="text-xs text-muted-foreground">
            <Sparkles size={11} className="mr-1 inline opacity-70" />
            The AI estimated {formatEstimateRange(todo.estimated_hours_min, todo.estimated_hours_max)}.
          </p>
        )}
        <div className="flex flex-wrap gap-1.5">
          {QUICK_PICK_HOURS.map((h) => (
            <button
              key={h}
              type="button"
              disabled={saving}
              onClick={() => void save(h)}
              className="border border-border px-3 py-1.5 text-sm transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary disabled:opacity-50"
            >
              {formatHours(h)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            inputMode="decimal"
            min={0.1}
            max={500}
            step={0.5}
            value={hoursText}
            onChange={(e) => setHoursText(e.target.value)}
            placeholder="Custom hours"
            aria-label="Actual hours"
          />
          <Button onClick={() => valid && void save(parsed)} disabled={saving || !valid}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Skip
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
