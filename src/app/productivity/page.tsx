"use client";

import { useEffect, useState, useCallback } from "react";
import AuthGuard from "@/components/layout/auth-guard";
import AppShell from "@/components/layout/app-shell";
import { apiFetch } from "@/lib/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Phone,
  PhoneMissed,
  ThumbsUp,
  ThumbsDown,
  PhoneOff,
  ArrowRight,
  Users,
  TrendingUp,
  Clock,
} from "lucide-react";
import type {
  ProductivityResponse,
  OutcomeBreakdown,
  BestCallTimesResponse,
} from "@/types";

export default function ProductivityPage() {
  return (
    <AuthGuard>
      {(user) => (
        <AppShell user={user} title="Productivity">
          <ProductivityContent />
        </AppShell>
      )}
    </AuthGuard>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function pct(n: number, total: number) {
  if (total === 0) return "0";
  return Math.round((n / total) * 100).toString();
}

function OutcomeBar({ breakdown }: { breakdown: OutcomeBreakdown }) {
  const t = breakdown.total || 1;
  const segments = [
    { key: "didnt_pick_up", value: breakdown.didnt_pick_up, label: "Didn't Pick Up", className: "bg-amber-400/70" },
    { key: "interested", value: breakdown.interested, label: "Interested", className: "bg-emerald-400/70" },
    { key: "not_interested", value: breakdown.not_interested, label: "Not Interested", className: "bg-rose-400/70" },
    { key: "bad_number", value: breakdown.bad_number, label: "Bad Number", className: "bg-zinc-300 dark:bg-zinc-500" },
  ];
  if (breakdown.other > 0) {
    segments.push({ key: "other", value: breakdown.other, label: "Other", className: "bg-slate-300 dark:bg-slate-500" });
  }

  return (
    <div className="space-y-2">
      <div className="flex h-3 rounded-full overflow-hidden bg-muted">
        {segments.map((s) =>
          s.value > 0 ? (
            <div
              key={s.key}
              className={`${s.className} transition-all`}
              style={{ width: `${(s.value / t) * 100}%` }}
              title={`${s.label}: ${s.value} (${pct(s.value, t)}%)`}
            />
          ) : null
        )}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {segments.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className={`h-2 w-2 rounded-full ${s.className}`} />
            <span>{s.label}</span>
            <span className="font-medium text-foreground tabular-nums">{s.value}</span>
            <span>({pct(s.value, t)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProductivityContent() {
  const [data, setData] = useState<ProductivityResponse | null>(null);
  const [bestTimes, setBestTimes] = useState<BestCallTimesResponse | null>(null);
  const [days, setDays] = useState("30");
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [resp, times] = await Promise.all([
        apiFetch<ProductivityResponse>(`/productivity?days=${days}`),
        apiFetch<BestCallTimesResponse>(`/productivity/best-call-times?days=${days}`),
      ]);
      setData(resp);
      setBestTimes(times);
    } catch (err) {
      console.error("Failed to fetch productivity:", err);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void fetchData();
    }, 0);
    return () => clearTimeout(timeout);
  }, [fetchData]);

  const users = data?.users || [];
  const rows = data?.rows || [];
  const overall = data?.overall_breakdown;
  const perUser = data?.per_user_breakdown || [];

  const totals: Record<string, number> = {};
  for (const u of users) totals[u.id] = 0;
  for (const row of rows) {
    for (const [uid, count] of Object.entries(row.counts)) {
      totals[uid] = (totals[uid] || 0) + count;
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Productivity</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Call outcomes, conversion flow, and team performance.
          </p>
        </div>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-[150px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="14">Last 14 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary cards */}
      {overall && overall.total > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <SummaryCard
            icon={<Phone size={16} />}
            label="Total Calls"
            value={overall.total}
          />
          <SummaryCard
            icon={<PhoneMissed size={16} />}
            label="Didn't Pick Up"
            value={overall.didnt_pick_up}
            sub={`${pct(overall.didnt_pick_up, overall.total)}%`}
            className="text-amber-500/80"
          />
          <SummaryCard
            icon={<ThumbsUp size={16} />}
            label="Interested"
            value={overall.interested}
            sub={`${pct(overall.interested, overall.total)}%`}
            className="text-emerald-500/80"
          />
          <SummaryCard
            icon={<ThumbsDown size={16} />}
            label="Not Interested"
            value={overall.not_interested}
            sub={`${pct(overall.not_interested, overall.total)}%`}
            className="text-rose-500/80"
          />
          <SummaryCard
            icon={<PhoneOff size={16} />}
            label="Bad Number"
            value={overall.bad_number}
            sub={`${pct(overall.bad_number, overall.total)}%`}
            className="text-zinc-400"
          />
        </div>
      )}

      {/* Call Flow */}
      {overall && overall.total > 0 && (
        <section className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-2.5 px-6 py-4 border-b border-border bg-muted/30">
            <TrendingUp size={15} className="text-muted-foreground" />
            <h2 className="text-sm font-semibold">Call Outcome Flow</h2>
          </div>
          <div className="p-4 sm:p-6">
            <div className="flex flex-col items-stretch gap-3 lg:flex-row lg:items-stretch lg:justify-center lg:gap-0">
              <div className="flex items-center">
                <FlowNode label="Total Calls" value={overall.total} className="w-full lg:w-auto border-primary/50 bg-primary/5" />
              </div>
              <div className="hidden lg:flex items-center px-2">
                <div className="w-8 border-t-2 border-dashed border-muted-foreground/30" />
                <ArrowRight size={16} className="text-muted-foreground/50 -ml-1" />
              </div>
              <div className="flex flex-col gap-2">
                <FlowNode label="Didn't Pick Up" value={overall.didnt_pick_up} pctVal={pct(overall.didnt_pick_up, overall.total)} barPct={(overall.didnt_pick_up / (overall.total || 1)) * 100} barColor="bg-amber-400/70" className="border-border" />
                <FlowNode label="Interested" value={overall.interested} pctVal={pct(overall.interested, overall.total)} barPct={(overall.interested / (overall.total || 1)) * 100} barColor="bg-emerald-400/70" className="border-border" />
                <FlowNode label="Not Interested" value={overall.not_interested} pctVal={pct(overall.not_interested, overall.total)} barPct={(overall.not_interested / (overall.total || 1)) * 100} barColor="bg-rose-400/70" className="border-border" />
                <FlowNode label="Bad Number" value={overall.bad_number} pctVal={pct(overall.bad_number, overall.total)} barPct={(overall.bad_number / (overall.total || 1)) * 100} barColor="bg-zinc-300 dark:bg-zinc-500" className="border-border" />
              </div>
            </div>
            <Separator className="my-6" />
            <OutcomeBar breakdown={overall} />
          </div>
        </section>
      )}

      {/* Best time to call */}
      {bestTimes && bestTimes.total_calls > 0 && (
        <BestTimeToCall data={bestTimes} />
      )}

      {/* Per-user breakdown */}
      {perUser.length > 0 && (
        <section className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-2.5 px-6 py-4 border-b border-border bg-muted/30">
            <Users size={15} className="text-muted-foreground" />
            <h2 className="text-sm font-semibold">Per-User Breakdown</h2>
          </div>
          <div className="divide-y divide-border">
            {perUser
              .sort((a, b) => b.breakdown.total - a.breakdown.total)
              .map((u) => (
              <div key={u.user_id} className="p-4 sm:p-6 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                      {u.first_name[0]}
                    </div>
                    <span className="font-medium">{u.first_name}</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="tabular-nums text-xs">
                      {u.breakdown.total} call{u.breakdown.total !== 1 ? "s" : ""}
                    </Badge>
                    {u.breakdown.interested > 0 && (
                      <Badge variant="outline" className="text-xs tabular-nums text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800">
                        {u.breakdown.interested} interested
                      </Badge>
                    )}
                  </div>
                </div>
                <OutcomeBar breakdown={u.breakdown} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Daily log table */}
      <section className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="flex items-center gap-2.5 px-6 py-4 border-b border-border bg-muted/30">
          <Phone size={15} className="text-muted-foreground" />
          <h2 className="text-sm font-semibold">Daily Call Log</h2>
        </div>
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[160px]">Date</TableHead>
              {users.map((u) => (
                <TableHead key={u.id} className="text-center">
                  {u.first_name}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={1 + users.length}
                  className="text-center py-14 text-muted-foreground"
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                      <Phone size={16} className="text-muted-foreground" />
                    </div>
                    <p className="text-sm">No call outcomes logged in this period.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              <>
                {rows.map((row) => (
                  <TableRow key={row.date}>
                    <TableCell className="font-medium text-sm">
                      {formatDate(row.date)}
                    </TableCell>
                    {users.map((u) => (
                      <TableCell key={u.id} className="text-center tabular-nums">
                        {row.counts[u.id] || 0}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-semibold">
                  <TableCell className="text-sm">Total</TableCell>
                  {users.map((u) => (
                    <TableCell key={u.id} className="text-center tabular-nums">
                      {totals[u.id] || 0}
                    </TableCell>
                  ))}
                </TableRow>
              </>
            )}
          </TableBody>
        </Table>
        </div>
      </section>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  sub,
  className = "",
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sub?: string;
  className?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className={`flex items-center gap-2 text-muted-foreground mb-2 ${className}`}>
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold tabular-nums">{value}</span>
        {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
      </div>
    </div>
  );
}

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function formatHour(h: number) {
  const period = h < 12 ? "am" : "pm";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}${period}`;
}

function formatHourRange(h: number) {
  return `${formatHour(h)}–${formatHour((h + 1) % 24)}`;
}

function BestTimeToCall({ data }: { data: BestCallTimesResponse }) {
  const { hours, heatmap, best_hour, best_window, min_sample, total_calls, overall_pickup_rate } = data;

  // Restrict both views to the active hour range so the charts stay compact.
  const activeHours = hours.filter((h) => h.total > 0).map((h) => h.hour);
  const minHour = activeHours.length ? Math.min(...activeHours) : 0;
  const maxHour = activeHours.length ? Math.max(...activeHours) : 23;
  const hourRange: number[] = [];
  for (let h = minHour; h <= maxHour; h++) hourRange.push(h);

  const hourByKey = new Map(hours.map((h) => [h.hour, h]));
  const maxPickupRate = Math.max(0.0001, ...hours.map((h) => h.pickup_rate));

  // Heatmap lookup + scaling.
  const cellByKey = new Map(heatmap.map((c) => [`${c.weekday}-${c.hour}`, c]));
  const maxCellRate = Math.max(0.0001, ...heatmap.filter((c) => c.total >= min_sample).map((c) => c.pickup_rate));

  return (
    <section className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2.5 px-4 py-3 border-b border-border bg-muted/30">
        <Clock size={15} className="text-muted-foreground" />
        <h2 className="text-sm font-semibold">Best Time to Call</h2>
        <span className="ml-auto text-xs text-muted-foreground">
          San Francisco time (PT) · {total_calls.toLocaleString()} calls
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* Best-window callouts */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="rounded-md border border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20 px-3 py-2">
            <p className="text-[11px] font-medium text-muted-foreground">Best hour</p>
            {best_hour ? (
              <p className="text-base font-bold tabular-nums leading-tight">
                {formatHourRange(best_hour.hour)}{" "}
                <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                  {Math.round(best_hour.pickup_rate * 100)}%
                </span>
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Not enough data</p>
            )}
          </div>
          <div className="rounded-md border border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20 px-3 py-2">
            <p className="text-[11px] font-medium text-muted-foreground">Best day + hour</p>
            {best_window ? (
              <p className="text-base font-bold tabular-nums leading-tight">
                {WEEKDAY_LABELS[best_window.weekday]} {formatHourRange(best_window.hour)}{" "}
                <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                  {Math.round(best_window.pickup_rate * 100)}%
                </span>
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Not enough data</p>
            )}
          </div>
          <div className="rounded-md border border-border bg-card px-3 py-2">
            <p className="text-[11px] font-medium text-muted-foreground">Overall pickup</p>
            <p className="text-base font-bold tabular-nums leading-tight">{Math.round(overall_pickup_rate * 100)}%</p>
          </div>
        </div>

        {/* Hour-of-day bar chart */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Pickup rate by hour
            </h3>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-emerald-400/60" /> Picked up
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-emerald-500" /> Interested
              </span>
            </div>
          </div>
          <div className="flex items-end gap-1.5 h-24">
            {hourRange.map((h) => {
              const bucket = hourByKey.get(h);
              const total = bucket?.total ?? 0;
              const pickupRate = bucket?.pickup_rate ?? 0;
              const interestedRate = bucket?.interested_rate ?? 0;
              const lowSample = total > 0 && total < min_sample;
              const barHeightPct = (pickupRate / maxPickupRate) * 100;
              const interestedPortion = pickupRate > 0 ? (interestedRate / pickupRate) * 100 : 0;
              return (
                <div key={h} className="flex flex-1 flex-col items-center gap-1 min-w-0">
                  <span className="text-[10px] font-medium tabular-nums text-foreground/80">
                    {total > 0 ? `${Math.round(pickupRate * 100)}%` : ""}
                  </span>
                  <div className="relative flex w-full flex-1 items-end">
                    <div
                      className={`w-full overflow-hidden rounded-t-sm bg-emerald-400/60 transition-all ${
                        lowSample ? "opacity-40" : ""
                      }`}
                      style={{ height: `${Math.max(barHeightPct, total > 0 ? 2 : 0)}%` }}
                      title={
                        total > 0
                          ? `${formatHourRange(h)} · ${total} calls · ${Math.round(
                              pickupRate * 100,
                            )}% pickup · ${Math.round(interestedRate * 100)}% interested`
                          : `${formatHourRange(h)} · no calls`
                      }
                    >
                      <div
                        className="absolute bottom-0 w-full bg-emerald-500"
                        style={{ height: `${interestedPortion}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-[9px] tabular-nums text-muted-foreground leading-none">{formatHour(h)}</span>
                  <span className="text-[8px] tabular-nums text-muted-foreground/60 leading-none">{total || ""}</span>
                </div>
              );
            })}
          </div>
          <p className="mt-1.5 text-[10px] text-muted-foreground/70">
            Bottom number = call volume. Faded bars have &lt;{min_sample} calls (excluded from picks).
          </p>
        </div>

        {/* Weekday x hour heatmap */}
        <div>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Pickup rate by day &amp; hour
          </h3>
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full">
              {/* Hour header */}
              <div className="flex">
                <div className="w-10 flex-shrink-0" />
                {hourRange.map((h) => (
                  <div
                    key={h}
                    className="flex-1 min-w-[26px] text-center text-[9px] tabular-nums text-muted-foreground"
                  >
                    {formatHour(h)}
                  </div>
                ))}
              </div>
              {WEEKDAY_LABELS.map((label, weekday) => (
                <div key={weekday} className="flex items-center">
                  <div className="w-10 flex-shrink-0 text-[10px] font-medium text-muted-foreground">{label}</div>
                  {hourRange.map((h) => {
                    const cell = cellByKey.get(`${weekday}-${h}`);
                    const total = cell?.total ?? 0;
                    const rate = cell?.pickup_rate ?? 0;
                    const lowSample = total > 0 && total < min_sample;
                    const intensity = total >= min_sample ? Math.min(1, rate / maxCellRate) : 0;
                    const isBest =
                      best_window && best_window.weekday === weekday && best_window.hour === h;
                    return (
                      <div key={h} className="flex-1 min-w-[22px] p-[1.5px]">
                        <div
                          className={`h-4 w-full rounded-sm border ${
                            isBest ? "border-emerald-500 ring-1 ring-emerald-500" : "border-transparent"
                          } ${total === 0 ? "bg-muted/40" : lowSample ? "bg-emerald-400/10" : ""}`}
                          style={
                            total >= min_sample
                              ? { backgroundColor: `rgb(16 185 129 / ${0.12 + intensity * 0.78})` }
                              : undefined
                          }
                          title={
                            total > 0
                              ? `${label} ${formatHourRange(h)} · ${total} calls · ${Math.round(
                                  rate * 100,
                                )}% pickup`
                              : `${label} ${formatHourRange(h)} · no calls`
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
            <span>Lower</span>
            <div className="flex h-2.5 w-28 overflow-hidden rounded-full">
              {[0.12, 0.3, 0.5, 0.7, 0.9].map((a) => (
                <div key={a} className="flex-1" style={{ backgroundColor: `rgb(16 185 129 / ${a})` }} />
              ))}
            </div>
            <span>Higher pickup rate</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function FlowNode({
  label,
  value,
  pctVal,
  barPct,
  barColor,
  className = "",
}: {
  label: string;
  value: number;
  pctVal?: string;
  barPct?: number;
  barColor?: string;
  className?: string;
}) {
  return (
    <div className={`rounded-lg border bg-card px-4 py-2.5 min-w-[200px] overflow-hidden relative ${className}`}>
      {barPct !== undefined && barColor && (
        <div
          className={`absolute inset-y-0 left-0 ${barColor} opacity-[0.07]`}
          style={{ width: `${Math.max(barPct, 2)}%` }}
        />
      )}
      <div className="relative flex items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="flex items-baseline gap-1.5">
          <span className="text-base font-bold tabular-nums">{value}</span>
          {pctVal && <span className="text-[10px] text-muted-foreground">{pctVal}%</span>}
        </div>
      </div>
    </div>
  );
}
