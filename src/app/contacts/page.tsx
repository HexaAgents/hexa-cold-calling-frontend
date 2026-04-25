"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/layout/auth-guard";
import AppSidebar from "@/components/layout/app-sidebar";
import { apiFetch } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import {
  ArrowUpDown,
  Search,
  Users,
  Loader2,
} from "lucide-react";
import type { Contact, ContactListResponse } from "@/types";

const OUTCOME_LABELS: Record<string, string> = {
  didnt_pick_up: "Didn't pick up",
  not_interested: "Not interested",
  interested: "Interested",
  bad_number: "Bad number",
};

const STATUS_LABELS: Record<string, string> = {
  to_be_messaged: "To be messaged",
  message_sent: "Message sent",
};

export default function ContactsPage() {
  return (
    <AuthGuard>
      {(user) => (
        <div className="flex h-screen overflow-hidden">
          <AppSidebar user={user} />
          <main className="relative flex-1 overflow-y-auto bg-background">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-primary/30 via-primary/70 to-primary/30" />
            <ContactsContent />
          </main>
        </div>
      )}
    </AuthGuard>
  );
}

function ContactsContent() {
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("asc");
  const [outcomeFilter, setOutcomeFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [enrichmentCounts, setEnrichmentCounts] = useState<Record<string, number>>({});
  const [enriching, setEnriching] = useState(false);
  const [creditError, setCreditError] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        sort_by: sortBy,
        sort_order: sortOrder,
        page: String(page),
        per_page: "50",
      });
      if (outcomeFilter) params.set("outcome_filter", outcomeFilter);
      if (debouncedSearch) params.set("search", debouncedSearch);

      const data = await apiFetch<ContactListResponse>(
        `/contacts?${params.toString()}`
      );
      setContacts(data.contacts);
      setTotal(data.total);
    } catch (err) {
      console.error("Failed to fetch contacts:", err);
    } finally {
      setLoading(false);
    }
  }, [sortBy, sortOrder, outcomeFilter, debouncedSearch, page]);

  const fetchEnrichmentStatus = useCallback(async () => {
    try {
      const data = await apiFetch<Record<string, number>>("/apollo/enrich/status");
      setEnrichmentCounts(data);
    } catch {
      // Apollo enrichment not configured
    }
  }, []);

  useEffect(() => {
    fetchContacts();
    fetchEnrichmentStatus();
  }, [fetchContacts, fetchEnrichmentStatus]);

  const handleEnrichAll = async () => {
    setEnriching(true);
    setCreditError(false);
    try {
      await apiFetch("/apollo/enrich", {
        method: "POST",
        body: JSON.stringify({ enrich_all: true }),
      });
      let prevPending = enrichmentCounts.pending_enrichment ?? 0;
      const poll = setInterval(async () => {
        const data = await apiFetch<Record<string, number>>("/apollo/enrich/status");
        setEnrichmentCounts(data);
        const pending = data.pending_enrichment || 0;
        const enrichingNow = data.enriching || 0;
        if (enrichingNow === 0) {
          clearInterval(poll);
          setEnriching(false);
          if (pending > 0 && pending >= prevPending) {
            setCreditError(true);
          }
          fetchContacts();
        }
        prevPending = pending;
      }, 5000);
    } catch (err) {
      console.error("Enrichment failed:", err);
      setEnriching(false);
      setCreditError(true);
    }
  };

  const toggleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
  };

  const displayStatus = (c: Contact) => {
    if (c.messaging_status) return STATUS_LABELS[c.messaging_status] || c.messaging_status;
    if (c.call_outcome) return OUTCOME_LABELS[c.call_outcome] || c.call_outcome;
    return "—";
  };

  const statusVariant = (c: Contact): "default" | "secondary" | "destructive" | "outline" => {
    if (c.messaging_status === "message_sent") return "default";
    if (c.messaging_status === "to_be_messaged") return "secondary";
    if (c.call_outcome === "interested") return "default";
    if (c.call_outcome === "not_interested") return "destructive";
    return "outline";
  };

  const phoneDisplay = (c: Contact) =>
    c.mobile_phone || c.work_direct_phone || c.corporate_phone || null;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Contacts</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {total} contact{total !== 1 ? "s" : ""}{debouncedSearch ? " matching" : " imported"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-[300px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
          <Select
            value={outcomeFilter || "all"}
            onValueChange={(v) => setOutcomeFilter(v === "all" ? "" : v)}
          >
            <SelectTrigger className="w-[170px] h-9">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="didnt_pick_up">Didn&apos;t pick up</SelectItem>
              <SelectItem value="not_interested">Not interested</SelectItem>
              <SelectItem value="interested">Interested</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Enrichment banner */}
      {(enrichmentCounts.pending_enrichment ?? 0) > 0 && (
        <div className={`mb-5 flex items-center justify-between rounded-lg border p-4 ${
          creditError
            ? "border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30"
            : "border-border bg-muted/40"
        }`}>
          <div>
            <p className="text-sm">
              {enrichmentCounts.pending_enrichment} contacts need phone numbers.
              {enrichmentCounts.enriching ? ` ${enrichmentCounts.enriching} enriching...` : ""}
            </p>
            {creditError && (
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                Apollo credits exhausted. Add credits to your Apollo account to continue enrichment.
              </p>
            )}
          </div>
          <Button size="sm" onClick={handleEnrichAll} disabled={enriching}>
            {enriching ? <><Loader2 size={13} className="mr-1.5 animate-spin" /> Enriching...</> : "Enrich via Apollo"}
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="font-semibold">
                <button onClick={() => toggleSort("created_at")} className="flex items-center gap-1">
                  Name {sortBy === "created_at" && <ArrowUpDown size={11} />}
                </button>
              </TableHead>
              <TableHead className="font-semibold">Company</TableHead>
              <TableHead className="font-semibold">Title</TableHead>
              <TableHead className="font-semibold">Phone</TableHead>
              <TableHead className="font-semibold">
                <button onClick={() => toggleSort("call_outcome")} className="flex items-center gap-1">
                  Status {sortBy === "call_outcome" && <ArrowUpDown size={11} />}
                </button>
              </TableHead>
              <TableHead className="font-semibold text-right">
                <button onClick={() => toggleSort("score")} className="flex items-center gap-1 ml-auto">
                  Score {sortBy === "score" && <ArrowUpDown size={11} />}
                </button>
              </TableHead>
              <TableHead className="font-semibold text-center">
                <button onClick={() => toggleSort("times_called")} className="flex items-center gap-1 justify-center">
                  Calls {sortBy === "times_called" && <ArrowUpDown size={11} />}
                </button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-16">
                  <div className="flex items-center justify-center text-muted-foreground">
                    <Loader2 size={18} className="mr-2 animate-spin" /> Loading contacts...
                  </div>
                </TableCell>
              </TableRow>
            ) : contacts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-16">
                  <div className="flex flex-col items-center gap-2">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                      <Users size={16} className="text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium">No contacts found</p>
                    <p className="text-xs text-muted-foreground">
                      {debouncedSearch ? "Try a different search term." : "Import a CSV to get started."}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              contacts.map((c) => (
                <TableRow
                  key={c.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => router.push(`/contacts/${c.id}`)}
                >
                  <TableCell className="font-medium">
                    {c.first_name} {c.last_name}
                  </TableCell>
                  <TableCell className="text-sm">
                    {c.company_name}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {c.title || "—"}
                  </TableCell>
                  <TableCell className="text-sm font-mono text-muted-foreground">
                    {phoneDisplay(c) || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(c)} className="text-[10px] h-5">
                      {displayStatus(c)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="font-mono text-sm">{c.score ?? "—"}</span>
                  </TableCell>
                  <TableCell className="text-center tabular-nums text-sm">
                    {c.times_called ?? 0}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {total > 50 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground tabular-nums">
            Page {page} of {Math.ceil(total / 50)}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page + 1)}
              disabled={page * 50 >= total}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
