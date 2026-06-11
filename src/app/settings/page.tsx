"use client";

import { useEffect, useState, useRef, type RefObject } from "react";
import { useSearchParams } from "next/navigation";
import AuthGuard from "@/components/layout/auth-guard";
import AppShell from "@/components/layout/app-shell";
import { apiFetch, ensureFreshToken } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, Lock, Mail, Unlink, MessageSquare, Phone, RotateCcw, ChevronDown, Palette, Sun, Moon, RefreshCw } from "lucide-react";
import { useTheme } from "@/lib/theme";
import type { Settings } from "@/types";

const MAIN_VARIABLES = ["<first_name>", "<company_name>", "<your_name>", "<type>"];
const ADVANCED_VARIABLES = ["<last_name>", "<title>", "<website>"];
const ALL_VARIABLES = [...MAIN_VARIABLES, ...ADVANCED_VARIABLES];

function insertAtCursor(ref: RefObject<HTMLTextAreaElement | HTMLInputElement | null>, value: string, setter: (v: string) => void) {
  const el = ref.current;
  if (!el) return;
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? start;
  const before = el.value.slice(0, start);
  const after = el.value.slice(end);
  const updated = before + value + after;
  setter(updated);
  requestAnimationFrame(() => {
    el.focus();
    const pos = start + value.length;
    el.setSelectionRange(pos, pos);
  });
}

function VariableButtons({
  textareaRef,
  setter,
}: {
  textareaRef: RefObject<HTMLTextAreaElement | HTMLInputElement | null>;
  setter: (v: string) => void;
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const displayed = showAdvanced ? ALL_VARIABLES : MAIN_VARIABLES;

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1">
        {displayed.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => insertAtCursor(textareaRef, v, setter)}
            className="inline-flex items-center rounded border border-border bg-muted/50 px-2 py-0.5 text-xs font-mono text-muted-foreground transition-colors hover:bg-primary hover:text-primary-foreground hover:border-primary cursor-pointer"
          >
            {v}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="inline-flex items-center gap-0.5 rounded px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {showAdvanced ? "Less" : "More"}
          <ChevronDown size={11} className={`transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
        </button>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <AuthGuard>
      {(user) => (
        <AppShell user={user} title="Settings">
          <SettingsContent />
        </AppShell>
      )}
    </AuthGuard>
  );
}

function SettingsContent() {
  const searchParams = useSearchParams();
  const { isDark, toggleTheme } = useTheme();
  const [threshold, setThreshold] = useState(3);
  const [retryDays, setRetryDays] = useState(3);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  const [emailSubjectDidntPickUp, setEmailSubjectDidntPickUp] = useState("");
  const [emailTemplateDidntPickUp, setEmailTemplateDidntPickUp] = useState("");
  const [emailSubjectInterested, setEmailSubjectInterested] = useState("");
  const [emailTemplateInterested, setEmailTemplateInterested] = useState("");
  const [emailSaved, setEmailSaved] = useState(false);

  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailAddress, setGmailAddress] = useState<string | null>(null);
  const [gmailLoading, setGmailLoading] = useState(true);

  const [refeeding, setRefeeding] = useState(false);
  const [refeedMessage, setRefeedMessage] = useState<string | null>(null);
  const [refeedError, setRefeedError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Settings>("/settings")
      .then((s) => {
        setThreshold(s.sms_call_threshold);
        setRetryDays(s.retry_days);
        setEmailSubjectDidntPickUp(s.email_subject_didnt_pick_up || "");
        setEmailTemplateDidntPickUp(s.email_template_didnt_pick_up || "");
        setEmailSubjectInterested(s.email_subject_interested || "");
        setEmailTemplateInterested(s.email_template_interested || "");
      })
      .catch(console.error)
      .finally(() => setLoading(false));

    apiFetch<{ connected: boolean; gmail_address: string | null }>("/email/oauth/status")
      .then((s) => {
        setGmailConnected(s.connected);
        setGmailAddress(s.gmail_address);
      })
      .catch(() => {})
      .finally(() => setGmailLoading(false));
  }, []);

  useEffect(() => {
    if (searchParams.get("gmail") !== "connected") return;

    const timeout = setTimeout(() => {
      apiFetch<{ connected: boolean; gmail_address: string | null }>("/email/oauth/status")
        .then((s) => {
          setGmailConnected(s.connected);
          setGmailAddress(s.gmail_address);
        })
        .catch(() => {});
    }, 0);
    return () => clearTimeout(timeout);
  }, [searchParams]);

  const handleSave = async () => {
    try {
      const updated = await apiFetch<Settings>("/settings", {
        method: "PUT",
        body: JSON.stringify({
          sms_call_threshold: threshold,
          retry_days: retryDays,
        }),
      });
      setThreshold(updated.sms_call_threshold);
      setRetryDays(updated.retry_days);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveEmailTemplates = async () => {
    try {
      const updated = await apiFetch<Settings>("/settings", {
        method: "PUT",
        body: JSON.stringify({
          email_subject_didnt_pick_up: emailSubjectDidntPickUp,
          email_template_didnt_pick_up: emailTemplateDidntPickUp,
          email_subject_interested: emailSubjectInterested,
          email_template_interested: emailTemplateInterested,
        }),
      });
      setEmailSubjectDidntPickUp(updated.email_subject_didnt_pick_up || "");
      setEmailTemplateDidntPickUp(updated.email_template_didnt_pick_up || "");
      setEmailSubjectInterested(updated.email_subject_interested || "");
      setEmailTemplateInterested(updated.email_template_interested || "");
      setEmailSaved(true);
      setTimeout(() => setEmailSaved(false), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleConnectGmail = async () => {
    try {
      await ensureFreshToken();
      const { url } = await apiFetch<{ url: string }>("/email/oauth/url");
      window.location.href = url;
    } catch (err) {
      console.error(err);
    }
  };

  const handleDisconnectGmail = async () => {
    try {
      await apiFetch("/email/oauth/disconnect", { method: "DELETE" });
      setGmailConnected(false);
      setGmailAddress(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRefeed = async () => {
    setRefeedError(null);
    setRefeedMessage(null);
    setRefeeding(true);
    try {
      const res = await apiFetch<{ status: string; reactivated: number }>(
        "/apollo/reactivate-stale",
        { method: "POST" }
      );
      setRefeedMessage(
        res.reactivated > 0
          ? `Refed ${res.reactivated} contact${res.reactivated === 1 ? "" : "s"} back into the call pool.`
          : "No eligible contacts to refeed right now."
      );
    } catch (err) {
      setRefeedError(err instanceof Error ? err.message : "Failed to refeed contacts");
    } finally {
      setRefeeding(false);
    }
  };

  const emailSubjectDPURef = useRef<HTMLInputElement>(null);
  const emailBodyDPURef = useRef<HTMLTextAreaElement>(null);
  const emailSubjectIntRef = useRef<HTMLInputElement>(null);
  const emailBodyIntRef = useRef<HTMLTextAreaElement>(null);

  const handleChangePassword = async () => {
    setPasswordError("");
    if (!currentPassword || !newPassword) {
      setPasswordError("All fields are required.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters.");
      return;
    }
    try {
      await apiFetch("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      setPasswordSaved(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPasswordSaved(false), 3000);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Failed to change password");
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full text-muted-foreground">Loading...</div>;
  }

  const sections = [
    { id: "appearance", label: "Appearance" },
    { id: "calling", label: "Calling" },
    { id: "gmail", label: "Gmail" },
    { id: "templates", label: "Email Templates" },
    { id: "security", label: "Security" },
    { id: "refeed", label: "Refeed" },
  ];

  return (
    <div className="flex justify-center py-6 sm:py-10 px-4 sm:px-6">
      <div className="w-full max-w-2xl space-y-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your calling preferences, email integration, and account.
          </p>
          <nav className="flex flex-wrap gap-1 mt-4">
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                className="px-3 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                {s.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Appearance */}
        <section id="appearance" className="rounded-lg border border-border bg-card overflow-hidden scroll-mt-6">
          <div className="flex items-center gap-2.5 px-6 py-4 border-b border-border bg-muted/30">
            <Palette size={15} className="text-muted-foreground" />
            <h2 className="text-sm font-semibold">Appearance</h2>
          </div>
          <div className="p-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  {isDark ? <Moon size={16} /> : <Sun size={16} />}
                </div>
                <div>
                  <p className="text-sm font-medium">Dark mode</p>
                  <p className="text-xs text-muted-foreground">
                    {isDark
                      ? "Dark theme is active across the platform."
                      : "Switch to a dark theme across the platform."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={isDark}
                aria-label="Toggle dark mode"
                onClick={toggleTheme}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                  isDark ? "bg-primary" : "bg-input"
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                    isDark ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
          </div>
        </section>

        {/* Calling Preferences */}
        <section id="calling" className="rounded-lg border border-border bg-card overflow-hidden scroll-mt-6">
          <div className="flex items-center gap-2.5 px-6 py-4 border-b border-border bg-muted/30">
            <Phone size={15} className="text-muted-foreground" />
            <h2 className="text-sm font-semibold">Calling Preferences</h2>
          </div>
          <div className="p-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <Label htmlFor="threshold">Stop after N call occasions</Label>
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
                  After this many separate-day attempts, stop showing this
                  contact in the call tracker. The contact stays in your
                  database and contacts list. Lowering this immediately
                  silences contacts that are already over the limit.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="retryDays">Retry after N days</Label>
                <Input
                  id="retryDays"
                  type="number"
                  min={1}
                  max={90}
                  value={retryDays}
                  onChange={(e) => setRetryDays(parseInt(e.target.value) || 1)}
                  className="w-24"
                />
                <p className="text-xs text-muted-foreground">
                  Re-queue &quot;didn&apos;t pick up&quot; contacts after this many days.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <Button onClick={handleSave} size="sm">Save preferences</Button>
              {saved && (
                <span className="flex items-center gap-1 text-sm text-green-600 animate-in fade-in duration-200">
                  <CheckCircle size={13} /> Saved
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Gmail Connection */}
        <section id="gmail" className="rounded-lg border border-border bg-card overflow-hidden scroll-mt-6">
          <div className="flex items-center gap-2.5 px-6 py-4 border-b border-border bg-muted/30">
            <Mail size={15} className="text-muted-foreground" />
            <h2 className="text-sm font-semibold">Gmail Connection</h2>
          </div>
          <div className="p-6">
            {gmailLoading ? (
              <p className="text-sm text-muted-foreground">Checking connection...</p>
            ) : gmailConnected ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  <span className="text-sm">
                    Connected as <span className="font-medium">{gmailAddress}</span>
                  </span>
                </div>
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={handleDisconnectGmail}>
                  <Unlink size={13} className="mr-1.5" /> Disconnect
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm">No Gmail account connected.</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Connect to send follow-up emails from the call tracker.</p>
                </div>
                <Button size="sm" className="self-start" onClick={handleConnectGmail}>
                  <Mail size={13} className="mr-1.5" /> Connect Gmail
                </Button>
              </div>
            )}
          </div>
        </section>

        {/* Email Templates */}
        <section id="templates" className="rounded-lg border border-border bg-card overflow-hidden scroll-mt-6">
          <div className="flex items-center gap-2.5 px-6 py-4 border-b border-border bg-muted/30">
            <MessageSquare size={15} className="text-muted-foreground" />
            <h2 className="text-sm font-semibold">Email Templates</h2>
          </div>
          <div className="p-6 space-y-6">
            <p className="text-xs text-muted-foreground">
              Default templates for follow-up emails. Click a variable tag to insert it at your cursor position. Users can edit before sending.
            </p>

            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-3">
                <RotateCcw size={13} className="text-muted-foreground" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Didn&apos;t Pick Up
                </span>
              </div>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="emailSubjectDPU" className="text-xs">Subject line</Label>
                  <Input
                    id="emailSubjectDPU"
                    ref={emailSubjectDPURef}
                    value={emailSubjectDidntPickUp}
                    onChange={(e) => setEmailSubjectDidntPickUp(e.target.value)}
                    placeholder="Following up"
                  />
                  <VariableButtons textareaRef={emailSubjectDPURef} setter={setEmailSubjectDidntPickUp} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="emailTemplateDPU" className="text-xs">Email body</Label>
                  <Textarea
                    id="emailTemplateDPU"
                    ref={emailBodyDPURef}
                    value={emailTemplateDidntPickUp}
                    onChange={(e) => setEmailTemplateDidntPickUp(e.target.value)}
                    rows={4}
                    placeholder="Hi <first_name>, I tried reaching you by phone..."
                  />
                  <VariableButtons textareaRef={emailBodyDPURef} setter={setEmailTemplateDidntPickUp} />
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle size={13} className="text-muted-foreground" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Interested
                </span>
              </div>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="emailSubjectInt" className="text-xs">Subject line</Label>
                  <Input
                    id="emailSubjectInt"
                    ref={emailSubjectIntRef}
                    value={emailSubjectInterested}
                    onChange={(e) => setEmailSubjectInterested(e.target.value)}
                    placeholder="Great chatting with you"
                  />
                  <VariableButtons textareaRef={emailSubjectIntRef} setter={setEmailSubjectInterested} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="emailTemplateInt" className="text-xs">Email body</Label>
                  <Textarea
                    id="emailTemplateInt"
                    ref={emailBodyIntRef}
                    value={emailTemplateInterested}
                    onChange={(e) => setEmailTemplateInterested(e.target.value)}
                    rows={4}
                    placeholder="Hi <first_name>, great speaking with you today..."
                  />
                  <VariableButtons textareaRef={emailBodyIntRef} setter={setEmailTemplateInterested} />
                </div>
              </div>
            </div>

            <Separator />

            <div className="flex items-center gap-3">
              <Button onClick={handleSaveEmailTemplates} size="sm">Save templates</Button>
              {emailSaved && (
                <span className="flex items-center gap-1 text-sm text-green-600 animate-in fade-in duration-200">
                  <CheckCircle size={13} /> Saved
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Account Security */}
        <section id="security" className="rounded-lg border border-border bg-card overflow-hidden scroll-mt-6">
          <div className="flex items-center gap-2.5 px-6 py-4 border-b border-border bg-muted/30">
            <Lock size={15} className="text-muted-foreground" />
            <h2 className="text-sm font-semibold">Change Password</h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 gap-4 max-w-sm">
              <div className="space-y-1">
                <Label htmlFor="current-password" className="text-xs">Current Password</Label>
                <Input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="new-password" className="text-xs">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="confirm-password" className="text-xs">Confirm New Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>

            {passwordError && (
              <p className="text-sm text-destructive">{passwordError}</p>
            )}

            <div className="flex items-center gap-3 pt-1">
              <Button onClick={handleChangePassword} size="sm">Update Password</Button>
              {passwordSaved && (
                <span className="flex items-center gap-1 text-sm text-green-600 animate-in fade-in duration-200">
                  <CheckCircle size={13} /> Password updated
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Refeed */}
        <section id="refeed" className="rounded-lg border border-border bg-card overflow-hidden scroll-mt-6">
          <div className="flex items-center gap-2.5 px-6 py-4 border-b border-border bg-muted/30">
            <RefreshCw size={15} className="text-muted-foreground" />
            <h2 className="text-sm font-semibold">Refeed Contacts</h2>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <p className="text-sm font-medium">Refeed stale &quot;didn&apos;t pick up&quot; contacts</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xl">
                Puts contacts that didn&apos;t pick up after 2+ call occasions, and
                whose last attempt was over a week ago, back into the shared call
                pool for anyone to call. Contacts are not re-enriched or re-scored.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button onClick={handleRefeed} size="sm" disabled={refeeding}>
                <RefreshCw size={13} className={`mr-1.5 ${refeeding ? "animate-spin" : ""}`} />
                {refeeding ? "Refeeding..." : "Refeed"}
              </Button>
              {refeedMessage && (
                <span className="flex items-center gap-1 text-sm text-green-600 animate-in fade-in duration-200">
                  <CheckCircle size={13} /> {refeedMessage}
                </span>
              )}
              {refeedError && (
                <span className="text-sm text-destructive animate-in fade-in duration-200">{refeedError}</span>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
