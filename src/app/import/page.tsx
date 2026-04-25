"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import AuthGuard from "@/components/layout/auth-guard";
import AppSidebar from "@/components/layout/app-sidebar";
import { apiUpload, apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Upload, FileText, AlertCircle, CreditCard, RefreshCw, CheckCircle2, Loader2 } from "lucide-react";
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
        <div className="flex h-screen overflow-hidden">
          <AppSidebar user={user} />
          <main className="relative flex-1 overflow-y-auto bg-background">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-primary/30 via-primary/70 to-primary/30" />
            <ImportContent />
          </main>
        </div>
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
    fetchBatches();
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
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight mb-1">Import</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Upload an Apollo CSV export to score and import contacts.
      </p>

      <EnrichmentHealthBanner />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`border-2 border-dashed p-12 text-center transition-colors ${
          dragOver
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50"
        }`}
      >
        <Upload size={32} className="mx-auto text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground mb-3">
          Drag & drop a CSV file here, or click to browse
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

  const fillClass = isFailed
    ? "progress-fill-destructive"
    : isComplete
    ? "progress-fill-complete"
    : "progress-fill";

  return (
    <div className="border border-border bg-card p-4 transition-all duration-300 hover:border-primary/30">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FileText size={14} className="text-muted-foreground" />
          <span className="text-sm font-medium">{batch.filename}</span>
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
          {new Date(batch.created_at).toLocaleDateString(undefined, {
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
    fetchHealth();
    const interval = setInterval(fetchHealth, 15000);
    return () => clearInterval(interval);
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
      <div className="flex items-start justify-between gap-4">
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
          className="shrink-0"
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
