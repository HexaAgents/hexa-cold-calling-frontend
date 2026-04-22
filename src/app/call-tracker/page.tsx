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
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Filter,
  History,
  ArrowLeft,
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

interface LocationOptions {
  cities: string[];
  states: string[];
  countries: string[];
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
  const [loading, setLoading] = useState(false);
  const [outcomeRequired, setOutcomeRequired] = useState(false);
  const [twilioDevice, setTwilioDevice] = useState<Device | null>(null);
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [callStatus, setCallStatus] = useState<string>("");
  const [outcomeSaved, setOutcomeSaved] = useState(false);
  const [outcomeDialogOpen, setOutcomeDialogOpen] = useState(false);
  const [queueEmpty, setQueueEmpty] = useState(false);

  const [locations, setLocations] = useState<LocationOptions>({ cities: [], states: [], countries: [] });
  const [filterCities, setFilterCities] = useState<string[]>([]);
  const [filterStates, setFilterStates] = useState<string[]>([]);
  const [filterCountries, setFilterCountries] = useState<string[]>([]);
  const [started, setStarted] = useState(false);
  const [loadingLocations, setLoadingLocations] = useState(true);

  const [sessionHistory, setSessionHistory] = useState<Contact[]>([]);
  const [viewingHistoryContact, setViewingHistoryContact] = useState<Contact | null>(null);

  const displayContact = viewingHistoryContact ?? contact;
  const isViewingHistory = viewingHistoryContact !== null;

  useEffect(() => {
    apiFetch<LocationOptions>("/contacts/locations")
      .then(setLocations)
      .catch(() => {})
      .finally(() => setLoadingLocations(false));
  }, []);

  const buildFilterQuery = useCallback(() => {
    const params = new URLSearchParams();
    filterCities.forEach((v) => params.append("cities", v));
    filterStates.forEach((v) => params.append("states", v));
    filterCountries.forEach((v) => params.append("countries", v));
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }, [filterCities, filterStates, filterCountries]);

  const claimNext = useCallback(async () => {
    setViewingHistoryContact(null);
    setLoading(true);
    setOutcome("");
    setOutcomeSaved(false);
    setOutcomeRequired(false);
    setCalls([]);
    setNotes([]);
    if (contact) {
      setSessionHistory((prev) => {
        if (prev.some((c) => c.id === contact.id)) return prev;
        return [...prev, contact];
      });
    }
    try {
      const next = await apiFetch<Contact | null>(`/calls/next${buildFilterQuery()}`, { method: "POST" });
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
  }, [buildFilterQuery, contact]);

  const handleStartCalling = async () => {
    setStarted(true);
    await claimNext();
  };

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

  const viewHistoryContact = async (historyContact: Contact) => {
    setOutcomeDialogOpen(false);
    setViewingHistoryContact(historyContact);
    setOutcome(historyContact.call_outcome || "");
    setOutcomeSaved(false);
    setOutcomeRequired(false);
    setNewNote("");
    setEditingNote(null);
    const [n, c] = await Promise.all([
      apiFetch<Note[]>(`/contacts/${historyContact.id}/notes`).catch(() => []),
      apiFetch<CallLog[]>(`/calls/contact/${historyContact.id}`).catch(() => []),
    ]);
    setNotes(n);
    setCalls(c);
  };

  const returnToCurrentContact = async () => {
    setViewingHistoryContact(null);
    setNewNote("");
    setEditingNote(null);
    if (!contact) return;
    setOutcome(contact.call_outcome || "");
    setOutcomeSaved(false);
    setOutcomeRequired(false);
    const [n, c] = await Promise.all([
      apiFetch<Note[]>(`/contacts/${contact.id}/notes`).catch(() => []),
      apiFetch<CallLog[]>(`/calls/contact/${contact.id}`).catch(() => []),
    ]);
    setNotes(n);
    setCalls(c);
  };

  const initTwilioDevice = async (): Promise<Device> => {
    if (twilioDevice) return twilioDevice;
    const { token } = await apiFetch<{ token: string }>("/calls/token", { method: "POST" });
    const device = new Device(token, { edge: "ashburn", closeProtection: true });
    await device.register();
    setTwilioDevice(device);
    return device;
  };

  const handleCall = async (phone: string, method: "browser" | "bridge") => {
    if (!contact || isViewingHistory) return;
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
    if (!displayContact || !outcome) return;
    try {
      const result = await apiFetch<CallLogResponse>("/calls/log", {
        method: "POST",
        body: JSON.stringify({
          contact_id: displayContact.id,
          call_method: "browser",
          phone_number_called: displayContact.mobile_phone,
          outcome,
        }),
      });
      setCalls((prev) => [result.call_log, ...prev]);
      setOutcomeRequired(false);
      setOutcomeDialogOpen(false);
      setOutcomeSaved(true);
      setTimeout(() => setOutcomeSaved(false), 3000);

      if (isViewingHistory) {
        setViewingHistoryContact((prev) =>
          prev ? { ...prev, call_outcome: outcome, call_occasion_count: result.occasion_count, times_called: result.times_called } : prev
        );
        setSessionHistory((prev) =>
          prev.map((c) =>
            c.id === displayContact.id
              ? { ...c, call_outcome: outcome, call_occasion_count: result.occasion_count, times_called: result.times_called }
              : c
          )
        );
      } else {
        setContact((prev) =>
          prev ? { ...prev, call_outcome: outcome, call_occasion_count: result.occasion_count, times_called: result.times_called } : prev
        );
      }

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

  const hasLoggedThisCall = isViewingHistory
    ? outcomeSaved
    : outcomeSaved || (!outcomeRequired && calls.length > 0 && outcome !== "");

  const handleSendSms = async () => {
    if (!displayContact) return;
    try {
      await apiFetch("/sms/send", {
        method: "POST",
        body: JSON.stringify({ contact_id: displayContact.id }),
      });
      setSmsDialogOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleScheduleSms = async () => {
    if (!displayContact || !scheduledDate) return;
    try {
      await apiFetch("/sms/schedule", {
        method: "POST",
        body: JSON.stringify({
          contact_id: displayContact.id,
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
    if (!displayContact || !newNote.trim()) return;
    try {
      const note = await apiFetch<Note>(`/contacts/${displayContact.id}/notes`, {
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

  if (loadingLocations) {
    return <div className="p-6 text-muted-foreground">Loading...</div>;
  }

  if (!started) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <h1 className="text-2xl font-semibold tracking-tight mb-1">Call Tracker</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Filter contacts by location, then start calling. Contacts without a location are always included.
        </p>
        <div className="border border-border bg-card p-6 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <LocationMultiSelect
              label="Country"
              options={locations.countries}
              selected={filterCountries}
              setSelected={setFilterCountries}
            />
            <LocationMultiSelect
              label="State"
              options={locations.states}
              selected={filterStates}
              setSelected={setFilterStates}
            />
            <LocationMultiSelect
              label="City"
              options={locations.cities}
              selected={filterCities}
              setSelected={setFilterCities}
            />
          </div>

          {(filterCities.length > 0 || filterStates.length > 0 || filterCountries.length > 0) && (
            <div className="flex flex-wrap gap-1.5">
              {[...filterCountries, ...filterStates, ...filterCities].map((v) => (
                <Badge key={v} variant="secondary" className="text-xs gap-1">
                  {v}
                  <button
                    onClick={() => {
                      setFilterCountries((p) => p.filter((x) => x !== v));
                      setFilterStates((p) => p.filter((x) => x !== v));
                      setFilterCities((p) => p.filter((x) => x !== v));
                    }}
                    className="ml-0.5 hover:text-foreground"
                  >
                    &times;
                  </button>
                </Badge>
              ))}
              <button
                onClick={() => { setFilterCountries([]); setFilterStates([]); setFilterCities([]); }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Clear all
              </button>
            </div>
          )}

          <Button className="w-full" onClick={handleStartCalling}>
            Start Calling
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="p-6 text-muted-foreground">Loading next contact...</div>;
  }

  if ((queueEmpty || !contact) && !isViewingHistory) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-muted-foreground">No more contacts to call right now.</p>
        <p className="text-sm text-muted-foreground">All contacts have been called or are claimed by other users.</p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={claimNext}>
            Check again
          </Button>
          <Button variant="outline" onClick={() => setStarted(false)}>
            <Filter size={14} className="mr-1" /> Change filters
          </Button>
          <Link href="/import">
            <Button>
              <Upload size={14} className="mr-2" /> Import contacts
            </Button>
          </Link>
        </div>
        {sessionHistory.length > 0 && (
          <div className="mt-2 border border-border bg-card p-4 w-full max-w-lg">
            <div className="flex items-center gap-2 mb-3">
              <History size={14} className="text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Previous Contacts</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {sessionHistory.map((h) => (
                <button
                  key={h.id}
                  onClick={() => viewHistoryContact(h)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-border rounded-md hover:bg-muted transition-colors"
                >
                  <span>{h.first_name} {h.last_name}</span>
                  {h.call_outcome && (
                    <Badge variant="outline" className="text-[10px] px-1 py-0">
                      {formatOutcome(h.call_outcome)}
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!displayContact) return null;

  const phones: [string, string | null][] = [
    ["Mobile", displayContact.mobile_phone ?? null],
    ["Work", displayContact.work_direct_phone ?? null],
    ["Corporate", displayContact.corporate_phone ?? null],
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Active filters indicator */}
      {(filterCities.length > 0 || filterStates.length > 0 || filterCountries.length > 0) && (
        <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground flex-wrap">
          <Filter size={12} />
          {[...filterCountries, ...filterStates, ...filterCities].map((v) => (
            <Badge key={v} variant="secondary" className="text-xs">{v}</Badge>
          ))}
          <button onClick={() => setStarted(false)} className="text-primary hover:underline ml-1">Change</button>
        </div>
      )}

      {/* Session History */}
      {sessionHistory.length > 0 && (
        <div className="mb-4 border border-border bg-card p-3">
          <div className="flex items-center gap-2 mb-2">
            <History size={14} className="text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Previous Contacts</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {sessionHistory.map((h) => (
              <button
                key={h.id}
                onClick={() => viewHistoryContact(h)}
                disabled={!!activeCall}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs border rounded-md transition-colors ${
                  viewingHistoryContact?.id === h.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:bg-muted"
                } ${activeCall ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <span>{h.first_name} {h.last_name}</span>
                {h.call_outcome && (
                  <Badge variant="outline" className="text-[10px] px-1 py-0">
                    {formatOutcome(h.call_outcome)}
                  </Badge>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Viewing history banner */}
      {isViewingHistory && (
        <div className="mb-4 flex items-center justify-between border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-3">
          <div className="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-200">
            <History size={14} />
            <span>Viewing previous contact — calling is disabled</span>
          </div>
          <Button size="sm" variant="outline" onClick={returnToCurrentContact}>
            <ArrowLeft size={14} className="mr-1" />
            {contact ? "Return to current contact" : "Back to queue"}
          </Button>
        </div>
      )}

      {/* Navigation */}
      {!isViewingHistory && (
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
      )}

      <div className="space-y-6">
        {/* Contact Card */}
        <div className="border border-border bg-card p-6">
          {displayContact.times_called > 0 && (
            <div className="flex items-center gap-2 mb-3">
              <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700">
                Callback
              </Badge>
              <span className="text-xs text-muted-foreground">
                Called {displayContact.times_called} time{displayContact.times_called !== 1 ? "s" : ""} previously
              </span>
            </div>
          )}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                {displayContact.first_name} {displayContact.last_name}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {displayContact.title} at {displayContact.company_name}
              </p>
              {displayContact.company_description && (
                <p className="mt-2 text-sm text-muted-foreground/80 leading-relaxed border-l-2 border-primary/30 pl-3">
                  {displayContact.company_description}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-3xl font-mono font-bold">{displayContact.score ?? "—"}</p>
              <Badge variant="outline" className="mt-1">
                {displayContact.company_type || "unscored"}
              </Badge>
            </div>
          </div>

          <Separator className="my-4" />

          <div className="grid grid-cols-3 gap-4 text-sm">
            {displayContact.employees && (
              <div>
                <p className="text-xs text-muted-foreground">Employees</p>
                <p>{displayContact.employees}</p>
              </div>
            )}
            {(displayContact.city || displayContact.state || displayContact.country) && (
              <div>
                <p className="text-xs text-muted-foreground">Location</p>
                <p>{[displayContact.city, displayContact.state, displayContact.country].filter(Boolean).join(", ")}</p>
              </div>
            )}
            {displayContact.email && (
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p>{displayContact.email}</p>
              </div>
            )}
            {displayContact.website && (
              <div>
                <p className="text-xs text-muted-foreground">Website</p>
                <a
                  href={displayContact.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center gap-1"
                >
                  {displayContact.website.replace(/^https?:\/\/(www\.)?/, "").slice(0, 30)}
                  <ExternalLink size={10} />
                </a>
              </div>
            )}
            {displayContact.person_linkedin_url && (
              <div>
                <p className="text-xs text-muted-foreground">LinkedIn</p>
                <a
                  href={displayContact.person_linkedin_url}
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
              <p>{displayContact.times_called ?? 0}</p>
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
                      disabled={isViewingHistory}
                    >
                      <PhoneCall size={12} className="mr-1" /> Browser
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCall(phone, "bridge")}
                      disabled={isViewingHistory}
                    >
                      <Phone size={12} className="mr-1" /> Phone
                    </Button>
                  </div>
                </div>
              ) : null
            )}
            {phones.every(([, p]) => !p) && (
              <p className="text-sm text-muted-foreground">
                {displayContact.enrichment_status === "pending_enrichment" || displayContact.enrichment_status === "enriching"
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
            <DialogTitle>Send SMS to {displayContact?.first_name}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This contact has been called {displayContact?.times_called ?? 0} times.
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

function LocationMultiSelect({
  label,
  options,
  selected,
  setSelected,
}: {
  label: string;
  options: string[];
  selected: string[];
  setSelected: (v: string[]) => void;
}) {
  const allSelected = options.length > 0 && selected.length === options.length;

  const toggle = (value: string) => {
    setSelected(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value]
    );
  };

  const toggleAll = () => {
    setSelected(allSelected ? [] : [...options]);
  };

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="w-full justify-between text-sm font-normal">
            {selected.length === 0
              ? "All"
              : selected.length === 1
                ? selected[0]
                : `${selected.length} selected`}
            <ChevronRight size={14} className="rotate-90 ml-auto opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56 max-h-64 overflow-y-auto">
          <DropdownMenuCheckboxItem checked={allSelected} onCheckedChange={toggleAll}>
            Select all
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          {options.map((opt) => (
            <DropdownMenuCheckboxItem
              key={opt}
              checked={selected.includes(opt)}
              onCheckedChange={() => toggle(opt)}
            >
              {opt}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
