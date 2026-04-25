"use client";

import { useEffect, useState, useCallback } from "react";
import AuthGuard from "@/components/layout/auth-guard";
import AppSidebar from "@/components/layout/app-sidebar";
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
} from "lucide-react";
import type { ProductivityResponse, OutcomeBreakdown } from "@/types";

export default function ProductivityPage() {
  return (
    <AuthGuard>
      {(user) => (
        <div className="flex h-screen overflow-hidden">
          <AppSidebar user={user} />
          <main className="relative flex-1 overflow-y-auto bg-background">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-primary/30 via-primary/70 to-primary/30" />
            <ProductivityContent />
          </main>
        </div>
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
  const [days, setDays] = useState("30");
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await apiFetch<ProductivityResponse>(`/productivity?days=${days}`);
      setData(resp);
    } catch (err) {
      console.error("Failed to fetch productivity:", err);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchData();
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
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
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
          <div className="p-6">
            <div className="flex items-stretch justify-center gap-0">
              <div className="flex items-center">
                <FlowNode label="Total Calls" value={overall.total} className="border-primary/50 bg-primary/5" />
              </div>
              <div className="flex items-center px-2">
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
              <div key={u.user_id} className="p-6 space-y-3">
                <div className="flex items-center justify-between">
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
