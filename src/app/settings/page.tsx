"use client";

import { useEffect, useState } from "react";
import AuthGuard from "@/components/layout/auth-guard";
import AppSidebar from "@/components/layout/app-sidebar";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CheckCircle } from "lucide-react";
import type { Settings } from "@/types";

export default function SettingsPage() {
  return (
    <AuthGuard>
      {(user) => (
        <div className="flex h-screen overflow-hidden">
          <AppSidebar user={user} />
          <main className="relative flex-1 overflow-y-auto bg-background">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-primary/30 via-primary/70 to-primary/30" />
            <SettingsContent />
          </main>
        </div>
      )}
    </AuthGuard>
  );
}

function SettingsContent() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [threshold, setThreshold] = useState(3);
  const [template, setTemplate] = useState("");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Settings>("/settings")
      .then((s) => {
        setSettings(s);
        setThreshold(s.sms_call_threshold);
        setTemplate(s.sms_template);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    try {
      const updated = await apiFetch<Settings>("/settings", {
        method: "PUT",
        body: JSON.stringify({
          sms_call_threshold: threshold,
          sms_template: template,
        }),
      });
      setSettings(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return <div className="p-6 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="p-6 max-w-xl">
      <h1 className="text-2xl font-semibold tracking-tight mb-1">Settings</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Configure auto-SMS and messaging templates.
      </p>

      <div className="space-y-6 border border-border bg-card p-6">
        <div className="space-y-2">
          <Label htmlFor="threshold">Auto-SMS after N call occasions</Label>
          <Input
            id="threshold"
            type="number"
            min={1}
            max={100}
            value={threshold}
            onChange={(e) => setThreshold(parseInt(e.target.value) || 1)}
            className="w-24"
          />
          <p className="text-xs text-muted-foreground">
            After this many separate-day call attempts, the platform will prompt
            you to send an SMS.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="template">SMS Template</Label>
          <Textarea
            id="template"
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            rows={4}
          />
          <p className="text-xs text-muted-foreground">
            Available variables:{" "}
            {["<first_name>", "<last_name>", "<company_name>", "<title>", "<website>"].map(
              (v) => (
                <Badge key={v} variant="outline" className="mr-1 mb-1 text-xs">
                  {v}
                </Badge>
              )
            )}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={handleSave}>Save settings</Button>
          {saved && (
            <span className="flex items-center gap-1 text-sm text-green-600">
              <CheckCircle size={14} /> Saved
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
