"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Repeat } from "lucide-react";
import type { RecurrenceUnit, Todo } from "@/types";

export interface RecurrenceValue {
  interval: number | null;
  unit: RecurrenceUnit | null;
}

const UNIT_LABELS: Record<RecurrenceUnit, [string, string]> = {
  day: ["day", "days"],
  week: ["week", "weeks"],
  month: ["month", "months"],
};

export function recurrenceLabel(interval: number | null, unit: RecurrenceUnit | null): string | null {
  if (!interval || !unit) return null;
  if (interval === 1) {
    return { day: "Daily", week: "Weekly", month: "Monthly" }[unit];
  }
  return `Every ${interval} ${UNIT_LABELS[unit][1]}`;
}

export function RecurrenceBadge({ todo, size = 12 }: { todo: Todo; size?: number }) {
  const label = recurrenceLabel(todo.recurrence_interval, todo.recurrence_unit);
  if (!label) return null;
  return (
    <span
      title={`Repeats: ${label.toLowerCase()}`}
      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-sky-300/30 bg-sky-500/8 px-2 py-0.5 text-[10px] font-medium text-sky-600/90 ring-1 ring-inset ring-sky-400/10 dark:text-sky-300/90"
    >
      <Repeat size={size - 2} /> {label}
    </span>
  );
}

type PresetKey = "none" | "daily" | "weekly" | "biweekly" | "monthly" | "custom";

const PRESETS: Record<Exclude<PresetKey, "custom">, RecurrenceValue> = {
  none: { interval: null, unit: null },
  daily: { interval: 1, unit: "day" },
  weekly: { interval: 1, unit: "week" },
  biweekly: { interval: 2, unit: "week" },
  monthly: { interval: 1, unit: "month" },
};

function presetFor(value: RecurrenceValue): Exclude<PresetKey, "custom"> | null {
  for (const [key, preset] of Object.entries(PRESETS)) {
    if (preset.interval === value.interval && preset.unit === value.unit) {
      return key as Exclude<PresetKey, "custom">;
    }
  }
  return null;
}

export function RecurrencePicker({
  value,
  onChange,
}: {
  value: RecurrenceValue;
  onChange: (value: RecurrenceValue) => void;
}) {
  // "Custom" stays selected while the user edits, even if the values happen to
  // match a preset (e.g. typing "1 week" on the way to "10 weeks").
  const [customMode, setCustomMode] = useState(false);
  const preset: PresetKey = customMode ? "custom" : (presetFor(value) ?? "custom");

  const handlePreset = (next: string) => {
    if (next === "custom") {
      setCustomMode(true);
      onChange({ interval: value.interval ?? 1, unit: value.unit ?? "week" });
      return;
    }
    setCustomMode(false);
    onChange(PRESETS[next as Exclude<PresetKey, "custom">]);
  };

  return (
    <div className="space-y-2">
      <Select value={preset} onValueChange={handlePreset}>
        <SelectTrigger className="w-full">
          <Repeat size={14} className="text-muted-foreground" />
          <SelectValue aria-label="Repeat" />
        </SelectTrigger>
        <SelectContent position="popper" sideOffset={6}>
          <SelectItem value="none">Doesn&apos;t repeat</SelectItem>
          <SelectItem value="daily">Daily</SelectItem>
          <SelectItem value="weekly">Weekly</SelectItem>
          <SelectItem value="biweekly">Every 2 weeks</SelectItem>
          <SelectItem value="monthly">Monthly</SelectItem>
          <SelectItem value="custom">Custom...</SelectItem>
        </SelectContent>
      </Select>
      {preset === "custom" && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Every</span>
          <Input
            type="number"
            min={1}
            max={365}
            value={value.interval ?? 1}
            aria-label="Repeat interval"
            onChange={(e) => {
              const n = Math.max(1, Math.min(365, Number(e.target.value) || 1));
              onChange({ interval: n, unit: value.unit ?? "week" });
            }}
            className="h-9 w-20"
          />
          <Select
            value={value.unit ?? "week"}
            onValueChange={(unit) =>
              onChange({ interval: value.interval ?? 1, unit: unit as RecurrenceUnit })
            }
          >
            <SelectTrigger className="h-9 flex-1" aria-label="Repeat unit">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" sideOffset={6}>
              <SelectItem value="day">{(value.interval ?? 1) === 1 ? "day" : "days"}</SelectItem>
              <SelectItem value="week">{(value.interval ?? 1) === 1 ? "week" : "weeks"}</SelectItem>
              <SelectItem value="month">{(value.interval ?? 1) === 1 ? "month" : "months"}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      {preset !== "none" && (
        <p className="text-xs text-muted-foreground">
          When this task is marked done, a new copy is created with the due date moved forward.
        </p>
      )}
    </div>
  );
}
