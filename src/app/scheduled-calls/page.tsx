"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import AuthGuard from "@/components/layout/auth-guard";
import AppSidebar from "@/components/layout/app-sidebar";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CalendarClock,
  CheckCircle2,
  XCircle,
  Clock,
  Building2,
  User as UserIcon,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import type { ScheduledCall, User } from "@/types";

const USER_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-pink-500",
  "bg-indigo-500",
  "bg-orange-500",
  "bg-teal-500",
];

const USER_BORDER_COLORS = [
  "border-l-blue-500",
  "border-l-emerald-500",
  "border-l-violet-500",
  "border-l-amber-500",
  "border-l-rose-500",
  "border-l-cyan-500",
  "border-l-pink-500",
  "border-l-indigo-500",
  "border-l-orange-500",
  "border-l-teal-500",
];

function getUserColor(userId: string, variant: "dot" | "border" = "dot"): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % USER_COLORS.length;
  return variant === "border" ? USER_BORDER_COLORS[idx] : USER_COLORS[idx];
}

export default function ScheduledCallsPage() {
  return (
    <AuthGuard>
      {(user) => (
        <div className="flex h-screen overflow-hidden">
          <AppSidebar user={user} />
          <main className="relative flex-1 overflow-y-auto bg-background">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-primary/30 via-primary/70 to-primary/30" />
            <ScheduledCallsContent user={user} />
          </main>
        </div>
      )}
    </AuthGuard>
  );
}

function getCountdown(scheduledAt: string): { text: string; urgency: "hidden" | "normal" | "warning" | "urgent" | "overdue" } {
  const target = new Date(scheduledAt).getTime();
  const now = Date.now();
  const diffMs = target - now;

  if (diffMs < 0) {
    const overdue = Math.abs(diffMs);
    const mins = Math.floor(overdue / 60000);
    if (mins < 60) return { text: `${mins}m overdue`, urgency: "overdue" };
    const hrs = Math.floor(mins / 60);
    return { text: `${hrs}h ${mins % 60}m overdue`, urgency: "overdue" };
  }

  const totalMins = Math.floor(diffMs / 60000);
  const THREE_HOURS = 180;

  if (totalMins > THREE_HOURS) return { text: "", urgency: "hidden" };

  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  const text = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;

  if (totalMins <= 15) return { text, urgency: "urgent" };
  if (totalMins <= 60) return { text, urgency: "warning" };
  return { text, urgency: "normal" };
}

function CountdownBadge({ scheduledAt }: { scheduledAt: string }) {
  const [countdown, setCountdown] = useState(() => getCountdown(scheduledAt));

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(getCountdown(scheduledAt));
    }, 30_000);
    return () => clearInterval(interval);
  }, [scheduledAt]);

  if (countdown.urgency === "hidden") return null;

  const styles: Record<string, string> = {
    normal: "bg-muted text-muted-foreground",
    warning: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
    urgent: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
    overdue: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400 animate-pulse",
  };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${styles[countdown.urgency]}`}>
      {countdown.urgency === "overdue" ? <AlertTriangle size={12} /> : <Clock size={12} />}
      {countdown.text}
    </span>
  );
}

function ScheduledCallsContent({ user }: { user: User }) {
  const [calls, setCalls] = useState<ScheduledCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "mine">("all");

  const fetchCalls = useCallback(async () => {
    try {
      const params = filter === "mine" ? "?mine=true" : "";
      const data = await apiFetch<ScheduledCall[]>(`/calls/scheduled${params}`);
      setCalls(data);
    } catch {
      setCalls([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchCalls();
    const interval = setInterval(fetchCalls, 60_000);
    return () => clearInterval(interval);
  }, [fetchCalls]);

  const handleComplete = async (id: string) => {
    try {
      await apiFetch(`/calls/scheduled/${id}/complete`, { method: "POST" });
      setCalls((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await apiFetch(`/calls/scheduled/${id}/cancel`, { method: "POST" });
      setCalls((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        Loading...
      </div>
    );
  }

  return (
    <div className="py-8 px-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Scheduled Calls</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {calls.length} upcoming follow-up{calls.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border p-1">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              filter === "all" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All Users
          </button>
          <button
            onClick={() => setFilter("mine")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              filter === "mine" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            My Calls
          </button>
        </div>
      </div>

      {calls.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-4">
            <CalendarClock size={24} className="text-muted-foreground" />
          </div>
          <h3 className="text-sm font-semibold">No scheduled calls</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">
            When you mark a contact as &quot;Interested&quot; in the Call Tracker, you&apos;ll be prompted to schedule a follow-up call.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {calls.map((call) => {
            const borderColor = getUserColor(call.user_id, "border");
            const dotColor = getUserColor(call.user_id, "dot");
            const isOverdue = new Date(call.scheduled_at).getTime() < Date.now();

            return (
              <div
                key={call.id}
                className={`rounded-lg border border-border bg-card overflow-hidden border-l-4 ${borderColor} ${
                  isOverdue ? "ring-1 ring-red-200 dark:ring-red-900/40" : ""
                }`}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <Link
                          href={`/contacts/${call.contact_id}`}
                          className="text-base font-semibold hover:text-primary transition-colors flex items-center gap-1"
                        >
                          {call.contact_name}
                          <ExternalLink size={12} className="text-muted-foreground" />
                        </Link>
                        <CountdownBadge scheduledAt={call.scheduled_at} />
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Building2 size={12} />
                          {call.company_name || "—"}
                        </span>
                        <span className="text-muted-foreground/40">|</span>
                        <span className="flex items-center gap-1.5">
                          <div className={`h-2 w-2 rounded-full ${dotColor}`} />
                          {call.user_name}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs gap-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                        onClick={() => handleComplete(call.id)}
                      >
                        <CheckCircle2 size={13} /> Complete
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-destructive"
                        onClick={() => handleCancel(call.id)}
                      >
                        <XCircle size={13} /> Cancel
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <CalendarClock size={13} />
                      <span>
                        {new Date(call.scheduled_at).toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                        {" at "}
                        {new Date(call.scheduled_at).toLocaleTimeString(undefined, {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    {call.notes && (
                      <>
                        <span className="text-muted-foreground/40">|</span>
                        <p className="text-muted-foreground truncate max-w-md">{call.notes}</p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
