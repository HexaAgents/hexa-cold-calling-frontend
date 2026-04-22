"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import AuthGuard from "@/components/layout/auth-guard";
import AppSidebar from "@/components/layout/app-sidebar";
import { apiUpload, apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Upload, FileText, AlertCircle } from "lucide-react";
import type { ImportBatch } from "@/types";

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
  const isComplete = batch.status === "completed";
  const isFailed = batch.status === "failed";
  const enriched = batch.enriched_rows ?? 0;

  return (
    <div className="border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <FileText size={14} className="text-muted-foreground" />
          <span className="text-sm font-medium">{batch.filename}</span>
        </div>
        <span className="text-xs text-muted-foreground font-mono">
          {decided} / {batch.total_rows}
        </span>
      </div>

      <div className="h-2 w-full bg-muted overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ${
            isFailed ? "bg-destructive" : "bg-primary"
          }`}
          style={{ width: `${isComplete ? 100 : pct}%` }}
        />
      </div>

      <p className="text-xs text-muted-foreground mt-2">
        {isFailed
          ? `Failed — ${batch.stored_rows} stored, ${batch.discarded_rows} discarded before error`
          : isComplete
          ? `Complete — ${batch.stored_rows} stored, ${batch.discarded_rows} discarded${enriched > 0 ? `, ${enriched} enriched` : ""}`
          : `${batch.stored_rows} stored · ${batch.discarded_rows} discarded${enriched > 0 ? ` · ${enriched} enriching` : ""}`}
      </p>

      {batch.enrichment_error && (
        <div className="mt-2 flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-2">
          <AlertCircle size={12} />
          <span>{batch.enrichment_error} — contacts saved as pending. Add credits and re-import to retry.</span>
        </div>
      )}
    </div>
  );
}
