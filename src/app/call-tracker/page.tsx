"use client";

import { useEffect, useState, useCallback } from "react";
import AuthGuard from "@/components/layout/auth-guard";
import AppSidebar from "@/components/layout/app-sidebar";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Phone,
  PhoneCall,
  ChevronRight,
  Upload,
  Send,
  Clock,
  ExternalLink,
  Plus,
  Pencil,
  Trash2,
  CheckCircle,
  SkipForward,
} from "lucide-react";
import type { Contact, Note, CallLog, CallLogResponse } from "@/types";
import Link from "next/link";
import { Device, Call } from "@twilio/voice-sdk";

export default function CallTrackerPage() {
  return (
    <AuthGuard>
      {(user) => (
        <div className="flex h-screen overflow-hidden">
          <AppSidebar user={user} />
          <main className="relative flex-1 overflow-y-auto bg-background">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-primary/30 via-primary/70 to-primary/30" />
            <CallTracker />
          </main>
        </div>
      )}
    </AuthGuard>
  );
}

function CallTracker() {
  const [contact, setContact] = useState<Contact | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [outcome, setOutcome] = useState<string>("");
  const [newNote, setNewNote] = useState("");
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [smsDialogOpen, setSmsDialogOpen] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [outcomeRequired, setOutcomeRequired] = useState(false);
  const [twilioDevice, setTwilioDevice] = useState<Device | null>(null);
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [callStatus, setCallStatus] = useState<string>("");
  const [outcomeSaved, setOutcomeSaved] = useState(false);
  const [outcomeDialogOpen, setOutcomeDialogOpen] = useState(false);
  const [queueEmpty, setQueueEmpty] = useState(false);

  const claimNext = useCallback(async () => {
    setLoading(true);
    setOutcome("");
    setOutcomeSaved(false);
    setOutcomeRequired(false);
    setCalls([]);
    setNotes([]);
    try {
      const next = await apiFetch<Contact | null>("/calls/next", { method: "POST" });
      if (next && next.id) {
        setContact(next);
        setQueueEmpty(false);
      } else {
        setContact(null);
        setQueueEmpty(true);
      }
    } catch (err) {
      console.error(err);
      setContact(null);
      setQueueEmpty(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    claimNext();
  }, [claimNext]);

  const fetchContactData = useCallback(async () => {
    if (!contact) return;
    setOutcome(contact.call_outcome || "");
    setOutcomeRequired(false);
    const [n, c] = await Promise.all([
      apiFetch<Note[]>(`/contacts/${contact.id}/notes`).catch(() => []),
      apiFetch<CallLog[]>(`/calls/contact/${contact.id}`).catch(() => []),
    ]);
    setNotes(n);
    setCalls(c);
  }, [contact]);

  useEffect(() => {
    fetchContactData();
  }, [fetchContactData]);

  const initTwilioDevice = async (): Promise<Device> => {
    if (twilioDevice) return twilioDevice;
    const { token } = await apiFetch<{ token: string }>("/calls/token", { method: "POST" });
    const device = new Device(token, { edge: "ashburn", closeProtection: true });
    await device.register();
    setTwilioDevice(device);
    return device;
  };

  const handleCall = async (phone: string, method: "browser" | "bridge") => {
    if (!contact) return;
    setOutcomeRequired(true);

    if (method === "browser") {
      try {
        setCallStatus("Connecting...");
        const device = await initTwilioDevice();
        const call = await device.connect({ params: { To: phone } });
        setActiveCall(call);
        setCallStatus("Ringing...");

        call.on("accept", () => setCallStatus("Connected"));
        call.on("disconnect", () => {
          setCallStatus("Call ended");
          setActiveCall(null);
          setOutcomeDialogOpen(true);
          setTimeout(() => setCallStatus(""), 3000);
        });
        call.on("cancel", () => {
          setCallStatus("");
          setActiveCall(null);
        });
        call.on("error", (err) => {
          setCallStatus(`Error: ${err.message}`);
          setActiveCall(null);
        });
      } catch (err) {
        setCallStatus(err instanceof Error ? err.message : "Call failed");
      }
    } else {
      setCallStatus("Bridge calling not yet configured — use Browser calling");
    }
  };

  const handleHangUp = () => {
    if (activeCall) {
      activeCall.disconnect();
      setActiveCall(null);
      setCallStatus("Call ended");
      setOutcomeDialogOpen(true);
      setTimeout(() => setCallStatus(""), 3000);
    }
  };

  const handleLogCall = async () => {
    if (!contact || !outcome) return;
    try {
      const result = await apiFetch<CallLogResponse>("/calls/log", {
        method: "POST",
        body: JSON.stringify({
          contact_id: contact.id,
          call_method: "browser",
          phone_number_called: contact.mobile_phone,
          outcome,
        }),
      });
      setCalls((prev) => [result.call_log, ...prev]);
      setOutcomeRequired(false);
      setOutcomeDialogOpen(false);
      setOutcomeSaved(true);
      setTimeout(() => setOutcomeSaved(false), 3000);

      setContact((prev) =>
        prev ? { ...prev, call_outcome: outcome, call_occasion_count: result.occasion_count, times_called: result.times_called } : prev
      );

      if (result.sms_prompt_needed) {
        setSmsDialogOpen(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleNext = async () => {
    if (outcomeRequired && !outcome) {
      alert("Please select a call outcome before proceeding.");
      return;
    }
    await claimNext();
  };

  const handleSkip = async () => {
    if (contact) {
      try {
        await apiFetch(`/calls/release/${contact.id}`, { method: "POST" });
      } catch {
        // Ignore release errors
      }
    }
    await claimNext();
  };

  const hasLoggedThisCall = outcomeSaved || (!outcomeRequired && calls.length > 0 && outcome !== "");

  const handleSendSms = async () => {
    if (!contact) return;
    try {
      await apiFetch("/sms/send", {
        method: "POST",
        body: JSON.stringify({ contact_id: contact.id }),
      });
      setSmsDialogOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleScheduleSms = async () => {
    if (!contact || !scheduledDate) return;
    try {
      await apiFetch("/sms/schedule", {
        method: "POST",
        body: JSON.stringify({
          contact_id: contact.id,
          scheduled_at: new Date(scheduledDate).toISOString(),
        }),
      });
      setSmsDialogOpen(false);
      setScheduledDate("");
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddNote = async () => {
    if (!contact || !newNote.trim()) return;
    try {
      const note = await apiFetch<Note>(`/contacts/${contact.id}/notes`, {
        method: "POST",
        body: JSON.stringify({ content: newNote }),
      });
      setNotes((prev) => [note, ...prev]);
      setNewNote("");
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateNote = async (noteId: string) => {
    try {
      const updated = await apiFetch<Note>(`/notes/${noteId}`, {
        method: "PATCH",
        body: JSON.stringify({ content: editContent }),
      });
      setNotes((prev) => prev.map((n) => (n.id === noteId ? updated : n)));
      setEditingNote(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      await apiFetch(`/notes/${noteId}`, { method: "DELETE" });
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
    } catch (err) {
      console.error(err);
    }
  };

  const formatOutcome = (val: string | null) => {
    const labels: Record<string, string> = {
      didnt_pick_up: "Didn't Pick Up",
      not_interested: "Not Interested",
      interested: "Interested",
    };
    return val ? labels[val] || val : "—";
  };

  if (loading) {
    return <div className="p-6 text-muted-foreground">Loading next contact...</div>;
  }

  if (queueEmpty || !contact) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-muted-foreground">No more contacts to call right now.</p>
        <p className="text-sm text-muted-foreground">All contacts have been called or are claimed by other users.</p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={claimNext}>
            Check again
          </Button>
          <Link href="/import">
            <Button>
              <Upload size={14} className="mr-2" /> Import contacts
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const phones: [string, string | null][] = [
    ["Mobile", contact.mobile_phone ?? null],
    ["Work", contact.work_direct_phone ?? null],
    ["Corporate", contact.corporate_phone ?? null],
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Navigation */}
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" size="sm" onClick={handleSkip}>
          <SkipForward size={14} className="mr-1" /> Skip
        </Button>
        <span className="text-sm text-muted-foreground">
          Assigned to you
        </span>
        <Button variant="outline" size="sm" onClick={handleNext}>
          Next <ChevronRight size={14} className="ml-1" />
        </Button>
      </div>

      <div className="space-y-6">
        {/* Contact Card */}
        <div className="border border-border bg-card p-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                {contact.first_name} {contact.last_name}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {contact.title} at {contact.company_name}
              </p>
              {contact.company_description && (
                <p className="mt-2 text-sm text-muted-foreground/80 leading-relaxed border-l-2 border-primary/30 pl-3">
                  {contact.company_description}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-3xl font-mono font-bold">{contact.score ?? "—"}</p>
              <Badge variant="outline" className="mt-1">
                {contact.company_type || "unscored"}
              </Badge>
            </div>
          </div>

          <Separator className="my-4" />

          <div className="grid grid-cols-3 gap-4 text-sm">
            {contact.employees && (
              <div>
                <p className="text-xs text-muted-foreground">Employees</p>
                <p>{contact.employees}</p>
              </div>
            )}
            {contact.city && (
              <div>
                <p className="text-xs text-muted-foreground">Location</p>
                <p>{contact.city}{contact.country ? `, ${contact.country}` : ""}</p>
              </div>
            )}
            {contact.email && (
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p>{contact.email}</p>
              </div>
            )}
            {contact.website && (
              <div>
                <p className="text-xs text-muted-foreground">Website</p>
                <a
                  href={contact.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center gap-1"
                >
                  {contact.website.replace(/^https?:\/\/(www\.)?/, "").slice(0, 30)}
                  <ExternalLink size={10} />
                </a>
              </div>
            )}
            {contact.person_linkedin_url && (
              <div>
                <p className="text-xs text-muted-foreground">LinkedIn</p>
                <a
                  href={contact.person_linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center gap-1"
                >
                  Profile <ExternalLink size={10} />
                </a>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground">Times called</p>
              <p>{contact.times_called ?? 0}</p>
            </div>
          </div>
        </div>

        {/* Phone Numbers + Dialer */}
        <div className="border border-border bg-card p-6">
          <h2 className="text-sm font-semibold mb-3">Phone Numbers</h2>
          <div className="space-y-2">
            {phones.map(([label, phone]) =>
              phone ? (
                <div key={label} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-sm font-mono">{phone}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCall(phone, "browser")}
                    >
                      <PhoneCall size={12} className="mr-1" /> Browser
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCall(phone, "bridge")}
                    >
                      <Phone size={12} className="mr-1" /> Phone
                    </Button>
                  </div>
                </div>
              ) : null
            )}
            {phones.every(([, p]) => !p) && (
              <p className="text-sm text-muted-foreground">
                {contact.enrichment_status === "pending_enrichment" || contact.enrichment_status === "enriching"
                  ? "Phone numbers pending enrichment via Apollo..."
                  : "No phone numbers available."}
              </p>
            )}
          </div>
          {(callStatus || activeCall) && (
            <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
              <p className="text-sm font-medium">{callStatus}</p>
              {activeCall && (
                <Button size="sm" variant="destructive" onClick={handleHangUp}>
                  Hang up
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Call Outcome */}
        <div className="border border-border bg-card p-6">
          <h2 className="text-sm font-semibold mb-3">Call Outcome</h2>
          <div className="flex items-center gap-3">
            <Select value={outcome} onValueChange={setOutcome}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Select outcome..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="didnt_pick_up">Didn&apos;t Pick Up</SelectItem>
                <SelectItem value="not_interested">Not Interested</SelectItem>
                <SelectItem value="interested">Interested</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleLogCall} disabled={!outcome || hasLoggedThisCall}>
              {hasLoggedThisCall ? "Outcome Saved" : "Save Outcome"}
            </Button>
            {outcomeSaved && (
              <span className="flex items-center gap-1 text-sm text-green-600">
                <CheckCircle size={14} /> Saved
              </span>
            )}
          </div>
        </div>

        {/* Notes */}
        <div className="border border-border bg-card p-6">
          <h2 className="text-sm font-semibold mb-3">Notes</h2>
          <div className="flex gap-2 mb-4">
            <Textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Write a note..."
              className="min-h-[60px]"
            />
            <Button onClick={handleAddNote} disabled={!newNote.trim()} className="self-end">
              <Plus size={14} />
            </Button>
          </div>
          <div className="space-y-2">
            {notes.map((note) => (
              <div key={note.id} className="border border-border p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-muted-foreground">{note.note_date}</p>
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        setEditingNote(note.id);
                        setEditContent(note.content);
                      }}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => handleDeleteNote(note.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
                {editingNote === note.id ? (
                  <div className="flex gap-2">
                    <Textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="min-h-[40px]"
                    />
                    <Button
                      size="sm"
                      onClick={() => handleUpdateNote(note.id)}
                    >
                      Save
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm">{note.content}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Call History */}
        {calls.length > 0 && (
          <div className="border border-border bg-card p-6">
            <h2 className="text-sm font-semibold mb-3">Call History</h2>
            <div className="space-y-2">
              {calls.map((call) => (
                <div
                  key={call.id}
                  className="flex items-center justify-between py-2 border-b border-border last:border-0 text-sm"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground">{call.call_date}</span>
                    <Badge variant="secondary" className="capitalize">
                      {call.call_method === "browser" ? "Browser Call" : "Phone Call"}
                    </Badge>
                  </div>
                  <Badge
                    variant={
                      call.outcome === "interested"
                        ? "default"
                        : call.outcome === "not_interested"
                        ? "destructive"
                        : "outline"
                    }
                  >
                    {formatOutcome(call.outcome)}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* SMS Dialog */}
      <Dialog open={smsDialogOpen} onOpenChange={setSmsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send SMS to {contact?.first_name}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This contact has been called {contact?.times_called ?? 0} times.
            Would you like to send a text message?
          </p>
          <div className="space-y-3 mt-2">
            <div>
              <Label>Or schedule for later</Label>
              <Input
                type="datetime-local"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSmsDialogOpen(false)}>
              Cancel
            </Button>
            {scheduledDate ? (
              <Button onClick={handleScheduleSms}>
                <Clock size={14} className="mr-1" /> Schedule
              </Button>
            ) : (
              <Button onClick={handleSendSms}>
                <Send size={14} className="mr-1" /> Send now
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Outcome Prompt Dialog — appears after call ends */}
      <Dialog open={outcomeDialogOpen} onOpenChange={setOutcomeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>How did the call go?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Select the outcome for your call with {contact?.first_name} {contact?.last_name}.
          </p>
          <div className="mt-3">
            <Select value={outcome} onValueChange={setOutcome}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select outcome..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="didnt_pick_up">Didn&apos;t Pick Up</SelectItem>
                <SelectItem value="not_interested">Not Interested</SelectItem>
                <SelectItem value="interested">Interested</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOutcomeDialogOpen(false)}>
              Skip
            </Button>
            <Button onClick={handleLogCall} disabled={!outcome || hasLoggedThisCall}>
              Save Outcome
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
