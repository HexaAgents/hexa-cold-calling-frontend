"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import AuthGuard from "@/components/layout/auth-guard";
import AppShell from "@/components/layout/app-shell";
import { apiUpload, apiFetch, apiDownload } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Upload, FileText, AlertCircle, CreditCard, RefreshCw, CheckCircle2, Loader2, Download } from "lucide-react";
import type { ImportBatch } from "@/types";

type EnrichmentHealth = {
  counts_by_status: {
    pending_enrichment: number;
    enriching: number;
    enriched: number;
    enrichment_failed: number;
    enrichment_no_phone: number;
  };
  out_of_credits_count: number;
  exhausted_retries_count: number;
  stale_enriching_count: number;
  out_of_credits: boolean;
};

export default function ImportPage() {
  return (
    <AuthGuard>
      {(user) => (
        <AppShell user={user} title="Import">
          <ImportContent />
        </AppShell>
      )}
    </AuthGuard>
  );
}

function ImportContent() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const hasProcessing = batches.some((b) => b.status === "processing");

  const fetchBatches = useCallback(async () => {
    try {
      const data = await apiFetch<ImportBatch[]>("/imports/recent");
      setBatches(data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void fetchBatches();
    }, 0);
    return () => clearTimeout(timeout);
  }, [fetchBatches]);

  useEffect(() => {
    if (!hasProcessing) return;

    const interval = setInterval(fetchBatches, 2000);
    return () => clearInterval(interval);
  }, [hasProcessing, fetchBatches]);

  const handleUpload = async (file: File) => {
    if (!file.name.endsWith(".csv")) {
      setError("Please select a CSV file.");
      return;
    }

    setError("");
    setUploading(true);

    try {
      const result = await apiUpload<{ batch_id: string; total_rows: number }>(
        "/imports/upload",
        file
      );
      setBatches((prev) => [
        {
          id: result.batch_id,
          user_id: "",
          filename: file.name,
          total_rows: result.total_rows,
          processed_rows: 0,
          stored_rows: 0,
          discarded_rows: 0,
          enriched_rows: 0,
          enrichment_error: null,
          status: "processing",
          has_filtered_csv: false,
          has_discarded_csv: false,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  };

  return (
    <div className="p-4 sm:p-6 max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight mb-1">Import</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Upload an Apollo CSV export to score and import contacts.
      </p>

      <EnrichmentHealthBanner />

      <RefeedBanner />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`border-2 border-dashed p-6 sm:p-12 text-center transition-colors ${
          dragOver
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50"
        }`}
      >
        <Upload size={32} className="mx-auto text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground mb-3">
          <span className="hidden sm:inline">Drag &amp; drop a CSV file here, or click to browse</span>
          <span className="sm:hidden">Upload an Apollo CSV export</span>
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
          }}
        />
        <Button
          variant="outline"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? "Uploading..." : "Choose file"}
        </Button>
      </div>

      {error && (
        <div className="mt-4 flex items-center gap-2 text-sm text-destructive">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {batches.length > 0 && (
        <div className="mt-8 space-y-3">
          <h2 className="text-sm font-semibold">Imports</h2>
          {batches.map((batch) => (
            <ImportRow key={batch.id} batch={batch} />
          ))}
        </div>
      )}
    </div>
  );
}

function ImportRow({ batch }: { batch: ImportBatch }) {
  const total = batch.total_rows || 1;
  const decided = batch.stored_rows + batch.discarded_rows;
  const pct = Math.round((decided / total) * 100);
  const displayPct = batch.status === "completed" ? 100 : pct;
  const isComplete = batch.status === "completed";
  const isFailed = batch.status === "failed";
  const isProcessing = batch.status === "processing";
  const enriched = batch.enriched_rows ?? 0;
  const [downloadingKind, setDownloadingKind] = useState<"filtered" | "discarded" | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const fillClass = isFailed
    ? "progress-fill-destructive"
    : isComplete
    ? "progress-fill-complete"
    : "progress-fill";

  const handleDownload = async (kind: "filtered" | "discarded") => {
    setDownloadError(null);
    setDownloadingKind(kind);
    try {
      const base = batch.filename.toLowerCase().endsWith(".csv")
        ? batch.filename.slice(0, -4)
        : batch.filename;
      const suggested = `${base}.${kind}.csv`;
      await apiDownload(`/imports/${batch.id}/${kind}-csv`, suggested);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloadingKind(null);
    }
  };

  return (
    <div className="border border-border bg-card p-4 transition-all duration-300 hover:border-primary/30">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <FileText size={14} className="text-muted-foreground shrink-0" />
          <span className="text-sm font-medium truncate">{batch.filename}</span>
          {isProcessing && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5">
              <Loader2 size={10} className="animate-spin" />
              Processing
            </span>
          )}
          {isComplete && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5">
              <CheckCircle2 size={10} />
              Complete
            </span>
          )}
          {isFailed && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-destructive bg-destructive/10 px-1.5 py-0.5">
              <AlertCircle size={10} />
              Failed
            </span>
          )}
          {batch.has_filtered_csv && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs"
              onClick={() => handleDownload("filtered")}
              disabled={downloadingKind !== null}
              title="Download the original CSV with only the contacts that passed scoring"
            >
              {downloadingKind === "filtered" ? (
                <Loader2 size={11} className="mr-1 animate-spin" />
              ) : (
                <Download size={11} className="mr-1" />
              )}
              Filtered CSV
            </Button>
          )}
          {batch.has_discarded_csv && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs"
              onClick={() => handleDownload("discarded")}
              disabled={downloadingKind !== null}
              title="Download the original CSV with only the contacts that were rejected or scored zero"
            >
              {downloadingKind === "discarded" ? (
                <Loader2 size={11} className="mr-1 animate-spin" />
              ) : (
                <Download size={11} className="mr-1" />
              )}
              Discarded CSV
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-mono tabular-nums">
            {decided} / {batch.total_rows}
          </span>
          <span className="text-xs font-semibold font-mono tabular-nums text-foreground/70">
            {displayPct}%
          </span>
        </div>
      </div>

      <div className="progress-track h-3.5 w-full overflow-hidden">
        <div
          className={`h-full transition-all duration-700 ease-out ${fillClass} ${
            isProcessing ? "progress-shimmer progress-processing" : ""
          }`}
          style={{ width: `${displayPct}%` }}
        />
      </div>

      <div className="flex items-center justify-between mt-2.5">
        <p className="text-xs text-muted-foreground">
          {isFailed
            ? `${batch.stored_rows} stored, ${batch.discarded_rows} discarded before error`
            : isComplete
            ? `${batch.stored_rows} stored, ${batch.discarded_rows} discarded${enriched > 0 ? `, ${enriched} enriched` : ""}`
            : `${batch.stored_rows} stored · ${batch.discarded_rows} discarded${enriched > 0 ? ` · ${enriched} enriching` : ""}`}
        </p>
        <span className="text-[10px] text-muted-foreground/60">
          {new Date(batch.created_at ?? "").toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </span>
      </div>

      {batch.enrichment_error && (
        <div className="mt-2.5 flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-2">
          <AlertCircle size={12} className="shrink-0" />
          <span>{batch.enrichment_error} — contacts saved as pending. Add credits and re-import to retry.</span>
        </div>
      )}

      {downloadError && (
        <div className="mt-2.5 flex items-center gap-2 text-xs text-destructive">
          <AlertCircle size={12} className="shrink-0" />
          <span>{downloadError}</span>
        </div>
      )}
    </div>
  );
}

function RefeedBanner() {
  const [refeeding, setRefeeding] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRefeed = async () => {
    setError(null);
    setMessage(null);
    setRefeeding(true);
    try {
      const res = await apiFetch<{ status: string; reactivated: number }>(
        "/apollo/reactivate-stale",
        { method: "POST" }
      );
      setMessage(
        res.reactivated > 0
          ? `Refed ${res.reactivated} contact${res.reactivated === 1 ? "" : "s"} back into the call pool — re-enriching in the background.`
          : "No eligible contacts to refeed right now."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refeed contacts");
    } finally {
      setRefeeding(false);
    }
  };

  return (
    <div className="mb-6 border border-border bg-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="flex items-start gap-2 flex-1">
          <RefreshCw size={16} className="text-muted-foreground mt-0.5 shrink-0" />
          <div className="space-y-1 text-sm">
            <p className="font-medium">Refeed stale &quot;didn&apos;t pick up&quot; contacts</p>
            <p className="text-xs text-muted-foreground max-w-xl">
              Puts contacts that didn&apos;t pick up after 2+ call occasions, with their last
              attempt over a week ago, back into the shared call pool for anyone to call. Their
              Apollo numbers are refreshed in the background so new numbers replace the old ones.
              Contacts are not re-scored.
            </p>
            {message && (
              <p className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                <CheckCircle2 size={12} className="shrink-0" /> {message}
              </p>
            )}
            {error && <p className="text-xs text-destructive mt-1">{error}</p>}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefeed}
          disabled={refeeding}
          className="shrink-0 self-start"
        >
          <RefreshCw size={14} className={`mr-1 ${refeeding ? "animate-spin" : ""}`} />
          {refeeding ? "Refeeding..." : "Refeed"}
        </Button>
      </div>
    </div>
  );
}

function EnrichmentHealthBanner() {
  const [health, setHealth] = useState<EnrichmentHealth | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [justRetried, setJustRetried] = useState(false);

  const fetchHealth = useCallback(async () => {
    try {
      const data = await apiFetch<EnrichmentHealth>("/apollo/enrich/status");
      setHealth(data);
    } catch (err) {
      console.error("Failed to fetch enrichment health", err);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void fetchHealth();
    }, 0);
    const interval = setInterval(fetchHealth, 15000);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [fetchHealth]);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await apiFetch("/apollo/enrich/retry-stale", { method: "POST" });
      setJustRetried(true);
      setTimeout(() => setJustRetried(false), 5000);
      setTimeout(fetchHealth, 3000);
    } catch (err) {
      console.error("Retry failed", err);
    } finally {
      setRetrying(false);
    }
  };

  if (!health) return null;

  const { counts_by_status, out_of_credits_count, stale_enriching_count, exhausted_retries_count, out_of_credits } = health;
  const pending = counts_by_status.pending_enrichment;
  const enriching = counts_by_status.enriching;
  const failed = counts_by_status.enrichment_failed;
  const noPhone = counts_by_status.enrichment_no_phone;
  const hasAnyIssue = failed > 0 || stale_enriching_count > 0 || out_of_credits || pending > 0;

  if (!hasAnyIssue) {
    return (
      <div className="mb-6 border border-border bg-card p-3 text-xs text-muted-foreground flex items-center gap-2">
        <CheckCircle2 size={14} className="text-emerald-500" />
        Apollo enrichment is up to date. {counts_by_status.enriched} contacts enriched
        {noPhone > 0 ? `, ${noPhone} with no mobile on file` : ""}.
      </div>
    );
  }

  return (
    <div className="mb-6 border border-border bg-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="flex items-start gap-2 flex-1">
          {out_of_credits ? (
            <CreditCard size={16} className="text-amber-500 mt-0.5 shrink-0" />
          ) : (
            <AlertCircle size={16} className="text-amber-500 mt-0.5 shrink-0" />
          )}
          <div className="space-y-1 text-sm">
            <p className="font-medium">
              {out_of_credits
                ? `Apollo is out of phone credits — ${out_of_credits_count} contacts waiting.`
                : "Enrichment has contacts that need attention."}
            </p>
            <p className="text-xs text-muted-foreground">
              {out_of_credits
                ? "Top up Apollo credits, then click Retry to flush the queue."
                : "Auto-retry runs every 10 min. Click Retry to flush now."}
            </p>
            <ul className="text-xs text-muted-foreground space-y-0.5 mt-2">
              {pending > 0 && <li>{pending} pending enrichment</li>}
              {enriching > 0 && (
                <li>
                  {enriching} currently enriching
                  {stale_enriching_count > 0 && ` (${stale_enriching_count} stuck, will be auto-retried)`}
                </li>
              )}
              {failed > 0 && (
                <li>
                  {failed} failed
                  {exhausted_retries_count > 0 && ` (${exhausted_retries_count} exhausted auto-retries — need manual retry)`}
                </li>
              )}
              {noPhone > 0 && <li>{noPhone} enriched but no mobile on file</li>}
            </ul>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRetry}
          disabled={retrying}
          className="shrink-0 self-start"
        >
          {justRetried ? (
            <>
              <CheckCircle2 size={14} className="mr-1" /> Queued
            </>
          ) : (
            <>
              <RefreshCw size={14} className={`mr-1 ${retrying ? "animate-spin" : ""}`} />
              {retrying ? "Retrying..." : "Retry"}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
