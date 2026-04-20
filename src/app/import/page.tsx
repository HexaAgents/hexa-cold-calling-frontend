"use client";

import { useState, useRef, useEffect } from "react";
import AuthGuard from "@/components/layout/auth-guard";
import AppSidebar from "@/components/layout/app-sidebar";
import { apiUpload, apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, CheckCircle, AlertCircle } from "lucide-react";
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
  const [activeBatch, setActiveBatch] = useState<ImportBatch | null>(null);
  const [recentBatches, setRecentBatches] = useState<ImportBatch[]>([]);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    apiFetch<ImportBatch[]>("/imports/recent")
      .then(setRecentBatches)
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!activeBatch || activeBatch.status !== "processing") return;

    const interval = setInterval(async () => {
      try {
        const updated = await apiFetch<ImportBatch>(
          `/imports/${activeBatch.id}/status`
        );
        setActiveBatch(updated);
        if (updated.status !== "processing") {
          clearInterval(interval);
          apiFetch<ImportBatch[]>("/imports/recent")
            .then(setRecentBatches)
            .catch(console.error);
        }
      } catch {
        clearInterval(interval);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [activeBatch]);

  const handleUpload = async (file: File) => {
    if (!file.name.endsWith(".csv")) {
      setError("Please select a CSV file.");
      return;
    }

    setError("");
    setUploading(true);

    try {
      const result = await apiUpload<{ batch_id: string }>(
        "/imports/upload",
        file
      );
      setActiveBatch({
        id: result.batch_id,
        user_id: "",
        filename: file.name,
        total_rows: 0,
        processed_rows: 0,
        stored_rows: 0,
        discarded_rows: 0,
        status: "processing",
        created_at: new Date().toISOString(),
      });
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

  const progressPct =
    activeBatch && activeBatch.total_rows > 0
      ? Math.round((activeBatch.processed_rows / activeBatch.total_rows) * 100)
      : 0;

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight mb-1">Import</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Upload an Apollo CSV export to score and import contacts.
      </p>

      {/* Drop zone */}
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

      {/* Active import progress */}
      {activeBatch && (
        <div className="mt-6 border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <FileText size={14} className="text-muted-foreground" />
              <span className="text-sm font-medium">{activeBatch.filename}</span>
            </div>
            <Badge
              variant={
                activeBatch.status === "completed"
                  ? "default"
                  : activeBatch.status === "failed"
                  ? "destructive"
                  : "secondary"
              }
            >
              {activeBatch.status}
            </Badge>
          </div>

          {activeBatch.status === "processing" && (
            <div className="mt-3">
              <div className="h-2 w-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {activeBatch.processed_rows} / {activeBatch.total_rows} rows
                processed
              </p>
            </div>
          )}

          {activeBatch.status === "completed" && (
            <div className="mt-3 flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1 text-green-600">
                <CheckCircle size={14} /> {activeBatch.stored_rows} stored
              </span>
              <span className="text-muted-foreground">
                {activeBatch.discarded_rows} discarded
              </span>
            </div>
          )}
        </div>
      )}

      {/* Recent imports */}
      {recentBatches.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold mb-3">Recent imports</h2>
          <div className="space-y-2">
            {recentBatches.map((batch) => (
              <div
                key={batch.id}
                className="flex items-center justify-between border border-border p-3 text-sm"
              >
                <div className="flex items-center gap-2">
                  <FileText size={14} className="text-muted-foreground" />
                  <span>{batch.filename}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground">
                    {batch.stored_rows} stored, {batch.discarded_rows} discarded
                  </span>
                  <Badge
                    variant={
                      batch.status === "completed" ? "default" : "secondary"
                    }
                  >
                    {batch.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
