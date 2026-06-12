"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/layout/auth-guard";
import AppShell from "@/components/layout/app-shell";
import { apiFetch } from "@/lib/api";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ListSkeleton } from "@/components/ui/skeleton";
import PageLoader from "@/components/ui/page-loader";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Building2,
  Search,
  ArrowLeft,
  ExternalLink,
  Users,
  Globe,
  Link2,
  MapPin,
  Phone,
  Mail,
} from "lucide-react";
import type { CompanySummary, CompanyDetail, Contact } from "@/types";

export default function CompaniesPage() {
  return (
    <AuthGuard>
      {(user) => (
        <AppShell user={user} title="Companies">
          <CompaniesContent />
        </AppShell>
      )}
    </AuthGuard>
  );
}

const OUTCOME_LABELS: Record<string, string> = {
  didnt_pick_up: "Didn't pick up",
  not_interested: "Not interested",
  interested: "Interested",
  bad_number: "Bad number",
};

function CompaniesContent() {
  const router = useRouter();
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);

  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [detail, setDetail] = useState<CompanyDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchCompanies = useCallback(async (q?: string) => {
    try {
      const params = q ? `?search=${encodeURIComponent(q)}` : "";
      const data = await apiFetch<CompanySummary[]>(`/companies${params}`);
      setCompanies(data);
    } catch {
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void fetchCompanies(debouncedSearch || undefined);
    }, 0);
    return () => clearTimeout(timeout);
  }, [fetchCompanies, debouncedSearch]);

  const handleSelectCompany = async (companyName: string) => {
    setSelectedCompany(companyName);
    setDetailLoading(true);
    try {
      const data = await apiFetch<CompanyDetail>(
        `/companies/detail?company_name=${encodeURIComponent(companyName)}`
      );
      setDetail(data);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const totalContacts = companies.reduce((a, c) => a + c.contact_count, 0);

  // --- DETAIL VIEW ---
  if (selectedCompany && detail) {
    const c = detail.company;
    const location = [c.city, c.state, c.country].filter(Boolean).join(", ");

    return (
      <div className="py-6 sm:py-8 px-4 sm:px-6 max-w-5xl mx-auto">
        <button
          onClick={() => {
            setSelectedCompany(null);
            setDetail(null);
          }}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft size={14} /> Back to companies
        </button>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-2">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{c.company_name}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-1.5">
              {c.industry_tag && (
                <Badge variant="secondary" className="text-xs">{c.industry_tag}</Badge>
              )}
              {location && (
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin size={12} /> {location}
                </span>
              )}
              {c.employees && (
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Users size={12} /> {c.employees} employees
                </span>
              )}
            </div>
          </div>
          <Badge variant="outline" className="self-start text-sm gap-1.5">
            <Users size={13} /> {detail.contacts.length} contacts
          </Badge>
        </div>

        {c.company_description && (
          <div className="mt-4 rounded-lg border border-border bg-muted/40 p-4">
            <p className="text-sm leading-relaxed">{c.company_description}</p>
          </div>
        )}

        <div className="flex flex-wrap gap-3 mt-4">
          {c.website && (
            <a
              href={c.website.startsWith("http") ? c.website : `https://${c.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <Globe size={13} />
              {c.website.replace(/^https?:\/\/(www\.)?/, "").slice(0, 40)}
              <ExternalLink size={10} />
            </a>
          )}
          {c.company_linkedin_url && (
            <a
              href={c.company_linkedin_url.startsWith("http") ? c.company_linkedin_url : `https://${c.company_linkedin_url}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <Link2 size={13} /> LinkedIn <ExternalLink size={10} />
            </a>
          )}
        </div>

        <Separator className="my-6" />

        <h2 className="text-sm font-semibold mb-3">Contacts at {c.company_name}</h2>

        {/* Mobile card list */}
        <div className="space-y-2 lg:hidden">
          {detail.contacts.map((ct: Contact) => {
            const phone = ct.mobile_phone || ct.work_direct_phone || ct.corporate_phone;
            return (
              <button
                key={ct.id}
                type="button"
                onClick={() => router.push(`/contacts/${ct.id}`)}
                className="w-full rounded-lg border border-border bg-card p-4 text-left transition-colors active:bg-muted/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {ct.first_name} {ct.last_name}
                    </p>
                    {ct.title && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{ct.title}</p>
                    )}
                  </div>
                  {ct.score != null && (
                    <span className="shrink-0 font-mono text-sm">{ct.score}</span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {ct.call_outcome && (
                    <Badge
                      variant={
                        ct.call_outcome === "interested" ? "default"
                        : ct.call_outcome === "not_interested" || ct.call_outcome === "bad_number" ? "destructive"
                        : "outline"
                      }
                      className="text-xs"
                    >
                      {OUTCOME_LABELS[ct.call_outcome] || ct.call_outcome}
                    </Badge>
                  )}
                  {phone && (
                    <a
                      href={`tel:${phone.replace(/[^+\d]/g, "")}`}
                      onClick={(e) => e.stopPropagation()}
                      className="font-mono text-xs text-primary underline-offset-2 hover:underline"
                    >
                      {phone}
                    </a>
                  )}
                  {ct.email && (
                    <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                      <Mail size={11} className="shrink-0" />
                      <span className="truncate">{ct.email}</span>
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="hidden rounded-lg border border-border bg-card overflow-hidden lg:block">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="text-xs">Name</TableHead>
                <TableHead className="text-xs">Title</TableHead>
                <TableHead className="text-xs">Email</TableHead>
                <TableHead className="text-xs">Phone</TableHead>
                <TableHead className="text-xs text-center">Score</TableHead>
                <TableHead className="text-xs">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.contacts.map((ct: Contact) => {
                const phone = ct.mobile_phone || ct.work_direct_phone || ct.corporate_phone;
                return (
                  <TableRow
                    key={ct.id}
                    className="cursor-pointer hover:bg-muted/40 transition-colors"
                    onClick={() => router.push(`/contacts/${ct.id}`)}
                  >
                    <TableCell className="text-sm font-medium">
                      {ct.first_name} {ct.last_name}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {ct.title || "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {ct.email ? (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Mail size={11} /> {ct.email}
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {phone ? (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Phone size={11} /> {phone}
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      {ct.score != null ? (
                        <span className="font-mono text-sm">{ct.score}</span>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      {ct.call_outcome ? (
                        <Badge
                          variant={
                            ct.call_outcome === "interested" ? "default"
                            : ct.call_outcome === "not_interested" || ct.call_outcome === "bad_number" ? "destructive"
                            : "outline"
                          }
                          className="text-xs"
                        >
                          {OUTCOME_LABELS[ct.call_outcome] || ct.call_outcome}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  // --- DETAIL LOADING ---
  if (selectedCompany && detailLoading) {
    return <PageLoader label="Loading company details" />;
  }

  // --- LIST VIEW ---
  return (
    <div className="py-6 sm:py-8 px-4 sm:px-6 max-w-5xl mx-auto">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Companies</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {companies.length} companies &middot; {totalContacts} contacts
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search companies..."
            className="pl-9 h-9 text-sm"
          />
        </div>
      </div>

      {loading ? (
        <ListSkeleton rows={8} />
      ) : companies.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-4">
            <Building2 size={24} className="text-muted-foreground" />
          </div>
          <h3 className="text-sm font-semibold">No companies found</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">
            {search ? "Try a different search term." : "Import contacts to see companies here."}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="hidden lg:grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-4 px-5 py-3 border-b border-border bg-muted/30 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <span>Company</span>
            <span className="text-center w-20">Contacts</span>
            <span className="text-center w-20">Avg Score</span>
            <span className="w-32">Industry</span>
            <span className="w-36">Location</span>
          </div>
          {companies.map((c) => {
            const location = [c.city, c.state, c.country].filter(Boolean).join(", ");
            return (
              <button
                key={c.company_name}
                onClick={() => handleSelectCompany(c.company_name)}
                className="w-full border-b border-border last:border-0 hover:bg-muted/40 active:bg-muted/40 transition-colors text-left px-4 py-3.5 lg:grid lg:grid-cols-[1fr_auto_auto_auto_auto] lg:items-center lg:gap-4 lg:px-5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{c.company_name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {c.website && (
                      <span className="text-xs text-muted-foreground truncate max-w-[200px] flex items-center gap-1">
                        <Globe size={10} />
                        {c.website.replace(/^https?:\/\/(www\.)?/, "").slice(0, 30)}
                      </span>
                    )}
                    {c.company_linkedin_url && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Link2 size={10} /> LinkedIn
                      </span>
                    )}
                  </div>
                  {/* Mobile-only meta row */}
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 lg:hidden">
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {c.contact_count} contact{c.contact_count === 1 ? "" : "s"}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono tabular-nums">
                      Score {c.avg_score ?? "—"}
                    </span>
                    {c.industry_tag && (
                      <span className="text-xs text-muted-foreground truncate">{c.industry_tag}</span>
                    )}
                    {location && (
                      <span className="text-xs text-muted-foreground truncate flex items-center gap-1">
                        <MapPin size={10} /> {location}
                      </span>
                    )}
                  </div>
                </div>
                <span className="hidden lg:inline text-sm text-center w-20 tabular-nums font-medium">
                  {c.contact_count}
                </span>
                <span className="hidden lg:inline text-sm text-center w-20 tabular-nums font-mono">
                  {c.avg_score ?? "—"}
                </span>
                <span className="hidden lg:inline text-xs text-muted-foreground w-32 truncate">
                  {c.industry_tag || "—"}
                </span>
                <span className="hidden lg:flex text-xs text-muted-foreground w-36 truncate items-center gap-1">
                  {location ? <><MapPin size={10} /> {location}</> : "—"}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
