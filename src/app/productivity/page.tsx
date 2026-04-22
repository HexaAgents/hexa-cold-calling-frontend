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
import type { ProductivityResponse } from "@/types";

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

  const totals: Record<string, number> = {};
  for (const u of users) totals[u.id] = 0;
  for (const row of rows) {
    for (const [uid, count] of Object.entries(row.counts)) {
      totals[uid] = (totals[uid] || 0) + count;
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Productivity</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Call outcomes logged per user per day
          </p>
        </div>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-[150px]">
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

      <div className="border border-border bg-card">
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
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={1 + users.length}
                  className="text-center py-10 text-muted-foreground"
                >
                  Loading...
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={1 + users.length}
                  className="text-center py-10 text-muted-foreground"
                >
                  No call outcomes logged in this period.
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
    </div>
  );
}
