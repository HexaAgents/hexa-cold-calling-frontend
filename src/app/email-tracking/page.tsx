"use client";

import { useEffect, useState, useCallback } from "react";
import AuthGuard from "@/components/layout/auth-guard";
import AppSidebar from "@/components/layout/app-sidebar";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  MailSearch,
  RefreshCw,
  Send,
  Inbox,
  ArrowLeft,
  Clock,
  CheckCircle2,
  Circle,
  Mail,
  Building2,
  User as UserIcon,
} from "lucide-react";
import type { TrackedContact, TrackedEmail } from "@/types";

export default function EmailTrackingPage() {
  return (
    <AuthGuard>
      {(user) => (
        <div className="flex h-screen overflow-hidden">
          <AppSidebar user={user} />
          <main className="relative flex-1 overflow-y-auto bg-background">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-primary/30 via-primary/70 to-primary/30" />
            <EmailTrackingContent />
          </main>
        </div>
      )}
    </AuthGuard>
  );
}

function StatusDot({ status }: { status: string }) {
  if (status === "replied")
    return <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" title="Replied" />;
  if (status === "awaiting_reply")
    return <div className="h-2.5 w-2.5 rounded-full bg-amber-500" title="Awaiting reply" />;
  return <div className="h-2.5 w-2.5 rounded-full bg-zinc-400" title="No emails" />;
}

function StatusLabel({ status }: { status: string }) {
  if (status === "replied")
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
        <CheckCircle2 size={12} /> Replied
      </span>
    );
  if (status === "awaiting_reply")
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600">
        <Clock size={12} /> Awaiting reply
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
      <Circle size={12} /> No emails
    </span>
  );
}

function formatRelative(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString();
}

function EmailTrackingContent() {
  const [contacts, setContacts] = useState<TrackedContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [gmailConnected, setGmailConnected] = useState<boolean | null>(null);

  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [thread, setThread] = useState<TrackedEmail[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);

  const fetchContacts = useCallback(async () => {
    try {
      const data = await apiFetch<TrackedContact[]>("/email/tracking");
      setContacts(data);
    } catch {
      setContacts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    apiFetch<{ connected: boolean }>("/email/oauth/status")
      .then((s) => setGmailConnected(s.connected))
      .catch(() => setGmailConnected(false));
    fetchContacts();
  }, [fetchContacts]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await apiFetch<{ synced: number }>("/email/tracking/sync", { method: "POST" });
      await fetchContacts();
    } catch {
      // silently handle
    } finally {
      setSyncing(false);
    }
  };

  const handleSelectContact = async (contactId: string) => {
    setSelectedContactId(contactId);
    setThreadLoading(true);
    try {
      const data = await apiFetch<TrackedEmail[]>(`/email/tracking/${contactId}`);
      setThread(data);
    } catch {
      setThread([]);
    } finally {
      setThreadLoading(false);
    }
  };

  const selectedContact = contacts.find((c) => c.contact_id === selectedContactId);

  const totalSent = contacts.reduce((a, c) => a + c.sent_count, 0);
  const totalReceived = contacts.reduce((a, c) => a + c.received_count, 0);
  const repliedCount = contacts.filter((c) => c.reply_status === "replied").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Loading...
      </div>
    );
  }

  if (gmailConnected === false) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
          <Mail size={28} className="text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Gmail not connected</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Connect your Gmail account in Settings to start tracking email conversations with your contacts.
          </p>
        </div>
        <Button size="sm" onClick={() => (window.location.href = "/settings#gmail")}>
          Go to Settings
        </Button>
      </div>
    );
  }

  if (selectedContactId && selectedContact) {
    return (
      <div className="py-8 px-6 max-w-4xl mx-auto">
        <button
          onClick={() => {
            setSelectedContactId(null);
            setThread([]);
          }}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft size={14} /> Back to all contacts
        </button>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {selectedContact.first_name} {selectedContact.last_name}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {selectedContact.company_name} &middot; {selectedContact.email}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="gap-1.5">
              <Send size={11} /> {selectedContact.sent_count} sent
            </Badge>
            <Badge variant="outline" className="gap-1.5">
              <Inbox size={11} /> {selectedContact.received_count} received
            </Badge>
            <StatusLabel status={selectedContact.reply_status} />
          </div>
        </div>

        <Separator className="mb-6" />

        {threadLoading ? (
          <div className="text-sm text-muted-foreground py-12 text-center">Loading thread...</div>
        ) : thread.length === 0 ? (
          <div className="text-sm text-muted-foreground py-12 text-center">
            No emails found. Try syncing to fetch the latest messages.
          </div>
        ) : (
          <div className="space-y-3">
            {thread.map((email) => (
              <div
                key={email.id}
                className={`rounded-lg border p-4 ${
                  email.direction === "received"
                    ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/20"
                    : "border-border bg-card"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-white ${
                        email.direction === "received" ? "bg-emerald-500" : "bg-zinc-500"
                      }`}
                    >
                      {email.direction === "received" ? (
                        <Inbox size={13} />
                      ) : (
                        <Send size={13} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{email.subject || "(no subject)"}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {email.direction === "received" ? "From" : "To"}: {email.direction === "received" ? email.from_address : email.to_address}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant="secondary" className="text-[10px]">
                      {email.direction}
                    </Badge>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(email.message_date).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
                {email.snippet && (
                  <p className="text-xs text-muted-foreground mt-2 pl-[38px] line-clamp-2">
                    {email.snippet}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="py-8 px-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Email Tracking</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor email conversations with contacts you&apos;ve called or emailed.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleSync}
          disabled={syncing}
          className="gap-2"
        >
          <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
          {syncing ? "Syncing..." : "Sync Now"}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <UserIcon size={14} />
            <span className="text-xs font-medium uppercase tracking-wider">Contacts</span>
          </div>
          <p className="text-2xl font-semibold">{contacts.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Send size={14} />
            <span className="text-xs font-medium uppercase tracking-wider">Sent</span>
          </div>
          <p className="text-2xl font-semibold">{totalSent}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Inbox size={14} />
            <span className="text-xs font-medium uppercase tracking-wider">Received</span>
          </div>
          <p className="text-2xl font-semibold">{totalReceived}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <CheckCircle2 size={14} />
            <span className="text-xs font-medium uppercase tracking-wider">Replied</span>
          </div>
          <p className="text-2xl font-semibold">{repliedCount}</p>
        </div>
      </div>

      {contacts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-4">
            <MailSearch size={24} className="text-muted-foreground" />
          </div>
          <h3 className="text-sm font-semibold">No tracked conversations yet</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">
            Email tracking starts automatically when you log a call outcome for a contact with an email address. Click &quot;Sync Now&quot; to pull in existing conversations.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-4 px-5 py-3 border-b border-border bg-muted/30 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <span>Contact</span>
            <span className="text-center w-16">Sent</span>
            <span className="text-center w-16">Received</span>
            <span className="text-center w-28">Status</span>
            <span className="text-right w-24">Last Activity</span>
          </div>
          {contacts.map((c) => {
            const lastActivity = c.last_received_at || c.last_sent_at;
            return (
              <button
                key={c.contact_id}
                onClick={() => handleSelectContact(c.contact_id)}
                className="w-full grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-4 px-5 py-3.5 border-b border-border last:border-0 hover:bg-muted/40 transition-colors text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <StatusDot status={c.reply_status} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {c.first_name} {c.last_name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate flex items-center gap-1.5">
                      <Building2 size={10} />
                      {c.company_name}
                      <span className="text-muted-foreground/50">&middot;</span>
                      {c.email}
                    </p>
                  </div>
                </div>
                <span className="text-sm text-center w-16 tabular-nums">
                  {c.sent_count}
                </span>
                <span className="text-sm text-center w-16 tabular-nums">
                  {c.received_count}
                </span>
                <div className="w-28 flex justify-center">
                  <StatusLabel status={c.reply_status} />
                </div>
                <span className="text-xs text-muted-foreground text-right w-24">
                  {formatRelative(lastActivity)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
