"use client";

import { useEffect, useState, useCallback, useRef, type Dispatch, type SetStateAction } from "react";
import AuthGuard from "@/components/layout/auth-guard";
import AppSidebar from "@/components/layout/app-sidebar";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  Filter,
  ArrowLeft,
  Copy,
  Check,
  AlertTriangle,
  PhoneMissed,
  ThumbsDown,
  ThumbsUp,
  PhoneOff,
  CalendarDays,
} from "lucide-react";
import type { Contact, Note, CallLog, CallLogResponse, Settings } from "@/types";
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
  // Persisted across navigation so the user returns to where they left off.
  const [contact, setContact] = usePersistedState<Contact | null>("callTracker:contact", null);
  const [notes, setNotes] = usePersistedState<Note[]>("callTracker:notes", []);
  const [calls, setCalls] = usePersistedState<CallLog[]>("callTracker:calls", []);
  const [outcome, setOutcome] = usePersistedState<string>("callTracker:outcome", "");
  const [outcomeRequired, setOutcomeRequired] = usePersistedState<boolean>("callTracker:outcomeRequired", false);
  const [outcomeSaved, setOutcomeSaved] = usePersistedState<boolean>("callTracker:outcomeSaved", false);
  const [callLoggedThisSession, setCallLoggedThisSession] = usePersistedState<boolean>("callTracker:callLoggedThisSession", false);
  const [started, setStarted] = usePersistedState<boolean>("callTracker:started", false);
  const [filterCities, setFilterCities] = usePersistedState<string[]>("callTracker:filterCities", []);
  const [filterStates, setFilterStates] = usePersistedState<string[]>("callTracker:filterStates", []);
  const [filterCountries, setFilterCountries] = usePersistedState<string[]>("callTracker:filterCountries", []);
  const [filterBusinessHours, setFilterBusinessHours] = usePersistedState<boolean>("callTracker:filterBusinessHours", false);
  const [sessionHistory, setSessionHistory] = usePersistedState<Contact[]>("callTracker:sessionHistory", []);
  // null = viewing the current (just-claimed) contact.
  // 0..n  = viewing an older contact. 0 is the most recently visited previous contact.
  const [historyIndex, setHistoryIndex] = usePersistedState<number | null>("callTracker:historyIndex", null);

  // Transient UI/session state — intentionally not persisted.
  const [newNote, setNewNote] = useState("");
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [smsDialogOpen, setSmsDialogOpen] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [twilioDevice, setTwilioDevice] = useState<Device | null>(null);
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [callStatus, setCallStatus] = useState<string>("");
  const [outcomeDialogOpen, setOutcomeDialogOpen] = useState(false);
  const [queueEmpty, setQueueEmpty] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);
  const [badNumberDialogOpen, setBadNumberDialogOpen] = useState(false);
  const [lastDialedPhone, setLastDialedPhone] = useState<{ number: string; type: string } | null>(null);

  const [callbackDate, setCallbackDate] = useState("");

  const [locations, setLocations] = useState<LocationOptions>({ cities: [], states: [], countries: [] });
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [retryDays, setRetryDays] = useState(3);

  const viewingHistoryContact =
    historyIndex !== null ? sessionHistory[sessionHistory.length - 1 - historyIndex] ?? null : null;
  const displayContact = viewingHistoryContact ?? contact;
  const isViewingHistory = viewingHistoryContact !== null;
  const canGoBack =
    historyIndex === null ? sessionHistory.length > 0 : historyIndex < sessionHistory.length - 1;

  useEffect(() => {
    apiFetch<LocationOptions>("/contacts/locations")
      .then(setLocations)
      .catch(() => {})
      .finally(() => setLoadingLocations(false));
    apiFetch<Settings>("/settings")
      .then((s) => setRetryDays(s.retry_days))
      .catch(() => {});
  }, []);

  const buildFilterQuery = useCallback(() => {
    const params = new URLSearchParams();
    filterCities.forEach((v) => params.append("cities", v));
    filterStates.forEach((v) => params.append("states", v));
    filterCountries.forEach((v) => params.append("countries", v));
    if (filterBusinessHours) params.append("business_hours_only", "true");
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }, [filterCities, filterStates, filterCountries, filterBusinessHours]);

  const computeDefaultCallbackDate = useCallback((days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }, []);

  const claimNext = useCallback(async () => {
    setHistoryIndex(null);
    setLoading(true);
    setOutcome("");
    setOutcomeSaved(false);
    setCallLoggedThisSession(false);
    setOutcomeRequired(false);
    setCalls([]);
    setNotes([]);
    setLastDialedPhone(null);
    setCallbackDate("");
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

  // Keeps notes/calls/outcome in sync with whichever contact is currently on screen
  // (claimed or a history contact). Resets per-contact UI state only when the
  // displayed contact actually changes — not on mount — so restored state survives.
  const displayContactId = displayContact?.id ?? null;
  const prevDisplayIdRef = useRef<string | null>(displayContactId);
  useEffect(() => {
    if (!displayContactId || !displayContact) return;

    const idChanged = prevDisplayIdRef.current !== displayContactId;
    prevDisplayIdRef.current = displayContactId;

    if (idChanged) {
      setOutcome(displayContact.call_outcome || "");
      setOutcomeSaved(false);
      setCallLoggedThisSession(false);
      setOutcomeRequired(false);
      setNewNote("");
      setEditingNote(null);
    }

    let cancelled = false;
    (async () => {
      const [n, c] = await Promise.all([
        apiFetch<Note[]>(`/contacts/${displayContactId}/notes`).catch(() => []),
        apiFetch<CallLog[]>(`/calls/contact/${displayContactId}`).catch(() => []),
      ]);
      if (cancelled) return;
      setNotes(n);
      setCalls(c);
    })();
    return () => {
      cancelled = true;
    };
    // Only re-run when the displayed contact id changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayContactId]);

  const handleBack = () => {
    if (!canGoBack) return;
    setOutcomeDialogOpen(false);
    const nextIndex = historyIndex === null ? 0 : historyIndex + 1;
    const target = sessionHistory[sessionHistory.length - 1 - nextIndex];
    if (!target) return;
    setHistoryIndex(nextIndex);
  };

  const handleForward = () => {
    if (historyIndex === null) return;
    if (historyIndex === 0) {
      setHistoryIndex(null);
      return;
    }
    setHistoryIndex(historyIndex - 1);
  };

  const initTwilioDevice = async (): Promise<Device> => {
    if (twilioDevice) return twilioDevice;
    const { token } = await apiFetch<{ token: string }>("/calls/token", { method: "POST" });
    const device = new Device(token, { edge: "ashburn", closeProtection: true });
    await device.register();
    setTwilioDevice(device);
    return device;
  };

  const handleCall = async (phone: string, method: "browser" | "bridge", phoneType?: string) => {
    if (!contact || isViewingHistory) return;
    setOutcomeRequired(true);
    if (phoneType) setLastDialedPhone({ number: phone, type: phoneType });

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

  const handleCopyPhone = async (phone: string) => {
    try {
      await navigator.clipboard.writeText(phone);
      setCopiedPhone(phone);
      setTimeout(() => setCopiedPhone((current) => (current === phone ? null : current)), 2000);
    } catch (err) {
      console.error("Failed to copy phone number", err);
    }
  };

  const badNumberPhoneType: string | null = (() => {
    if (lastDialedPhone) return lastDialedPhone.type;
    if (!displayContact) return null;
    const available = (
      [["mobile_phone", displayContact.mobile_phone], ["work_direct_phone", displayContact.work_direct_phone], ["corporate_phone", displayContact.corporate_phone]] as [string, string | null][]
    ).filter((entry): entry is [string, string] => !!entry[1]);
    if (available.length === 1) return available[0][0];
    return null;
  })();

  const handleLogCall = async () => {
    if (!displayContact || !outcome) return;

    if (outcome === "bad_number") {
      setBadNumberDialogOpen(true);
      return;
    }

    await saveOutcome();
  };

  const saveOutcome = async () => {
    if (!displayContact || !outcome) return;
    try {
      const payload: Record<string, string | null> = {
        contact_id: displayContact.id,
        call_method: "browser",
        phone_number_called: lastDialedPhone?.number ?? displayContact.mobile_phone,
        outcome,
      };
      if (outcome === "didnt_pick_up" && callbackDate) {
        payload.callback_date = callbackDate;
      }
      const result = await apiFetch<CallLogResponse>("/calls/log", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setCalls((prev) => [result.call_log, ...prev]);
      setOutcomeRequired(false);
      setOutcomeDialogOpen(false);
      setOutcomeSaved(true);
      setCallLoggedThisSession(true);
      setTimeout(() => setOutcomeSaved(false), 3000);

      const retryAt = result.retry_at ?? null;
      if (isViewingHistory) {
        setSessionHistory((prev) =>
          prev.map((c) =>
            c.id === displayContact.id
              ? { ...c, call_outcome: outcome, call_occasion_count: result.occasion_count, times_called: result.times_called, retry_at: retryAt }
              : c
          )
        );
      } else {
        setContact((prev) =>
          prev ? { ...prev, call_outcome: outcome, call_occasion_count: result.occasion_count, times_called: result.times_called, retry_at: retryAt } : prev
        );
      }

      if (result.sms_prompt_needed) {
        setSmsDialogOpen(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleBadNumberConfirm = async () => {
    if (!displayContact || !badNumberPhoneType) return;
    try {
      await apiFetch(`/contacts/${displayContact.id}/phone-number`, {
        method: "DELETE",
        body: JSON.stringify({ phone_type: badNumberPhoneType }),
      });
      await saveOutcome();
      setBadNumberDialogOpen(false);
      setLastDialedPhone(null);
      await claimNext();
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

  const hasLoggedThisCall = isViewingHistory
    ? outcomeSaved
    : outcomeSaved || callLoggedThisSession;

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
      bad_number: "Bad Number",
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

          <label className="flex items-start gap-2 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filterBusinessHours}
              onChange={(e) => setFilterBusinessHours(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-primary cursor-pointer"
            />
            <span className="flex items-center gap-1.5">
              <Clock size={14} className="text-muted-foreground" />
              <span>
                Only contacts in business hours now
                <span className="text-muted-foreground"> (8am&ndash;12pm, 2pm&ndash;6pm local)</span>
              </span>
            </span>
          </label>

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
          <Button variant="outline" onClick={handleBack}>
            <ArrowLeft size={14} className="mr-1" /> Back to previous contact
          </Button>
        )}
      </div>
    );
  }

  if (!displayContact) return null;

  const phones: [string, string | null, string][] = [
    ["Mobile", displayContact.mobile_phone ?? null, "mobile_phone"],
    ["Work", displayContact.work_direct_phone ?? null, "work_direct_phone"],
    ["Corporate", displayContact.corporate_phone ?? null, "corporate_phone"],
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Active filters indicator */}
      <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground flex-wrap">
        <button onClick={() => setStarted(false)} className="flex items-center gap-1 text-primary hover:underline">
          <Filter size={12} /> Filters
        </button>
        {(filterCities.length > 0 || filterStates.length > 0 || filterCountries.length > 0 || filterBusinessHours) && (
          <>
            <span>·</span>
            {[...filterCountries, ...filterStates, ...filterCities].map((v) => (
              <Badge key={v} variant="secondary" className="text-xs">{v}</Badge>
            ))}
            {filterBusinessHours && (
              <Badge variant="secondary" className="text-xs gap-1">
                <Clock size={10} /> Business hours
              </Badge>
            )}
          </>
        )}
      </div>

      {/* Session history tags */}
      {(sessionHistory.length > 0 || contact) && (
        <div className="flex items-center gap-1.5 mb-3 overflow-x-auto flex-nowrap pb-1">
          {sessionHistory.map((c, i) => {
            const idxForThis = sessionHistory.length - 1 - i;
            const isActive = historyIndex === idxForThis;
            return (
              <Badge
                key={c.id}
                variant={isActive ? "default" : "secondary"}
                className={`shrink-0 text-xs cursor-pointer transition-colors ${
                  !isActive ? "hover:bg-muted-foreground/20" : ""
                }`}
                onClick={() => setHistoryIndex(idxForThis)}
              >
                {c.first_name} {c.last_name?.[0] ? `${c.last_name[0]}.` : ""}
              </Badge>
            );
          })}
          {contact && (
            <Badge
              variant={historyIndex === null ? "default" : "secondary"}
              className={`shrink-0 text-xs cursor-pointer transition-colors ${
                historyIndex !== null ? "hover:bg-muted-foreground/20" : ""
              }`}
              onClick={() => setHistoryIndex(null)}
            >
              {contact.first_name} {contact.last_name?.[0] ? `${contact.last_name[0]}.` : ""}
              {historyIndex === null && " ●"}
            </Badge>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBack}
          disabled={!canGoBack || !!activeCall}
        >
          <ArrowLeft size={14} className="mr-1" /> Back
        </Button>
        <span className="text-sm text-muted-foreground">
          {isViewingHistory ? "Viewing previous contact — calling disabled" : "Assigned to you"}
        </span>
        {isViewingHistory ? (
          <Button variant="outline" size="sm" onClick={handleForward}>
            {historyIndex === 0 ? "Current" : "Forward"} <ChevronRight size={14} className="ml-1" />
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={handleNext}>
            Next <ChevronRight size={14} className="ml-1" />
          </Button>
        )}
      </div>

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
              {displayContact.retry_at && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <CalendarDays size={10} />
                  Scheduled: {new Date(displayContact.retry_at).toLocaleDateString()}
                </span>
              )}
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
                {displayContact.timezone && (
                  <p className="mt-0.5 text-xs text-muted-foreground flex items-center gap-1">
                    <Clock size={10} />
                    <LocalTime timezone={displayContact.timezone} />
                  </p>
                )}
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
            {phones.map(([label, phone, phoneType]) => {
              if (!phone) return null;
              const extMatch = phone.match(/^(.+?)(?:ext|x)(\d+)$/i);
              const baseNumber = extMatch ? extMatch[1] : phone;
              const ext = extMatch ? extMatch[2] : null;
              return (
                <div key={label} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-mono">{baseNumber}</p>
                      {ext && (
                        <span className="text-xs font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          EXT {ext}
                        </span>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => handleCopyPhone(baseNumber)}
                        aria-label={`Copy ${label} phone number`}
                        title={copiedPhone === baseNumber ? "Copied!" : "Copy phone number"}
                      >
                        {copiedPhone === baseNumber ? (
                          <Check size={12} className="text-green-600" />
                        ) : (
                          <Copy size={12} />
                        )}
                      </Button>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCall(phone, "browser", phoneType)}
                      disabled={isViewingHistory}
                    >
                      <PhoneCall size={12} className="mr-1" /> Browser
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCall(phone, "bridge", phoneType)}
                      disabled={isViewingHistory}
                    >
                      <Phone size={12} className="mr-1" /> Phone
                    </Button>
                  </div>
                </div>
              );
            })}
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
          <div className="relative min-h-[4rem]">
            {outcome && !outcomeSaved && !hasLoggedThisCall && (
              <p className="absolute -top-1 left-0 right-0 text-center text-xs text-green-600 dark:text-green-400 animate-in fade-in duration-200">
                Click again to save
              </p>
            )}
            {outcomeSaved && (
              <p className="absolute -top-1 left-0 right-0 text-center text-xs text-green-600 dark:text-green-400 flex items-center justify-center gap-1 animate-in fade-in duration-200">
                <CheckCircle size={12} /> Saved
              </p>
            )}
            <div className="grid grid-cols-4 gap-2 pt-3">
              {([
                { value: "didnt_pick_up", label: "Didn't Pick Up", icon: PhoneMissed },
                { value: "not_interested", label: "Not Interested", icon: ThumbsDown },
                { value: "interested", label: "Interested", icon: ThumbsUp },
                { value: "bad_number", label: "Bad Number", icon: PhoneOff },
              ] as const).map(({ value, label, icon: Icon }) => {
                const isSelected = outcome === value;
                const isSaved = hasLoggedThisCall || outcomeSaved;
                return (
                  <Button
                    key={value}
                    variant="outline"
                    className={`h-auto flex-col gap-1.5 py-3 text-xs font-medium transition-all ${
                      isSelected && !isSaved
                        ? "border-green-500 bg-green-500/10 text-green-700 dark:text-green-400 ring-1 ring-green-500/50"
                        : isSelected && isSaved
                        ? "border-green-600 bg-green-500/20 text-green-700 dark:text-green-400"
                        : ""
                    }`}
                    disabled={isSaved && !isSelected}
                    onClick={() => {
                      if (isSaved) return;
                      if (isSelected) {
                        handleLogCall();
                      } else {
                        setOutcome(value);
                        if (value === "didnt_pick_up" && !callbackDate) {
                          setCallbackDate(computeDefaultCallbackDate(retryDays));
                        }
                      }
                    }}
                  >
                    <Icon size={16} />
                    {label}
                  </Button>
                );
              })}
            </div>
          </div>
          {outcome === "didnt_pick_up" && !hasLoggedThisCall && (
            <div className="mt-4 flex items-center gap-3 border-t border-border pt-4">
              <CalendarDays size={14} className="text-muted-foreground shrink-0" />
              <Label htmlFor="callbackDate" className="text-sm whitespace-nowrap">Callback date</Label>
              <Input
                id="callbackDate"
                type="date"
                value={callbackDate}
                onChange={(e) => setCallbackDate(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
                className="w-44"
              />
              <span className="text-xs text-muted-foreground">
                {callbackDate
                  ? `Will re-enter your queue on ${new Date(callbackDate + "T00:00:00").toLocaleDateString()}`
                  : `Default: ${retryDays} day${retryDays !== 1 ? "s" : ""} from today`}
              </span>
            </div>
          )}
          {outcome === "didnt_pick_up" && hasLoggedThisCall && displayContact.retry_at && (
            <div className="mt-4 flex items-center gap-2 border-t border-border pt-4 text-sm text-muted-foreground">
              <CalendarDays size={14} />
              Callback scheduled for {new Date(displayContact.retry_at).toLocaleDateString()}
            </div>
          )}
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
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        call.outcome === "interested"
                          ? "default"
                          : call.outcome === "not_interested" || call.outcome === "bad_number"
                          ? "destructive"
                          : "outline"
                      }
                    >
                      {formatOutcome(call.outcome)}
                    </Badge>
                    <button
                      onClick={async () => {
                        try {
                          await apiFetch(`/calls/${call.id}`, { method: "DELETE" });
                          setCalls((prev) => prev.filter((c) => c.id !== call.id));
                        } catch (err) {
                          console.error("Failed to delete call log", err);
                        }
                      }}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                      title="Delete call log"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
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
          <div className="relative mt-3 min-h-[4.5rem]">
            {outcome && !outcomeSaved && !hasLoggedThisCall && (
              <p className="absolute -top-1 left-0 right-0 text-center text-xs text-green-600 dark:text-green-400 animate-in fade-in duration-200">
                Click again to save
              </p>
            )}
            {outcomeSaved && (
              <p className="absolute -top-1 left-0 right-0 text-center text-xs text-green-600 dark:text-green-400 flex items-center justify-center gap-1 animate-in fade-in duration-200">
                <CheckCircle size={12} /> Saved
              </p>
            )}
            <div className="grid grid-cols-4 gap-2 pt-3">
              {([
                { value: "didnt_pick_up", label: "Didn't Pick Up", icon: PhoneMissed },
                { value: "not_interested", label: "Not Interested", icon: ThumbsDown },
                { value: "interested", label: "Interested", icon: ThumbsUp },
                { value: "bad_number", label: "Bad Number", icon: PhoneOff },
              ] as const).map(({ value, label, icon: Icon }) => {
                const isSelected = outcome === value;
                const isSaved = hasLoggedThisCall || outcomeSaved;
                return (
                  <Button
                    key={value}
                    variant="outline"
                    className={`h-auto flex-col gap-1.5 py-3 text-xs font-medium transition-all ${
                      isSelected && !isSaved
                        ? "border-green-500 bg-green-500/10 text-green-700 dark:text-green-400 ring-1 ring-green-500/50"
                        : isSelected && isSaved
                        ? "border-green-600 bg-green-500/20 text-green-700 dark:text-green-400"
                        : ""
                    }`}
                    disabled={isSaved && !isSelected}
                    onClick={() => {
                      if (isSaved) return;
                      if (isSelected) {
                        handleLogCall();
                      } else {
                        setOutcome(value);
                        if (value === "didnt_pick_up" && !callbackDate) {
                          setCallbackDate(computeDefaultCallbackDate(retryDays));
                        }
                      }
                    }}
                  >
                    <Icon size={16} />
                    {label}
                  </Button>
                );
              })}
            </div>
          </div>
          {outcome === "didnt_pick_up" && !hasLoggedThisCall && (
            <div className="flex items-center gap-3 mt-2">
              <CalendarDays size={14} className="text-muted-foreground shrink-0" />
              <Label htmlFor="dialogCallbackDate" className="text-sm whitespace-nowrap">Callback date</Label>
              <Input
                id="dialogCallbackDate"
                type="date"
                value={callbackDate}
                onChange={(e) => setCallbackDate(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
                className="w-44"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* Bad Number Confirmation */}
      <AlertDialog open={badNumberDialogOpen} onOpenChange={setBadNumberDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-destructive" />
              Delete phone number?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {badNumberPhoneType
                ? `This will permanently delete ${lastDialedPhone?.number ?? "this number"} from this contact. Are you sure?`
                : "Select which phone number to remove:"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {!badNumberPhoneType && (
            <div className="space-y-2">
              {phones.filter(([, p]) => p).map(([label, phone, phoneType]) => (
                <Button
                  key={phoneType}
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => setLastDialedPhone({ number: phone!, type: phoneType })}
                >
                  {label}: {phone}
                </Button>
              ))}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setBadNumberDialogOpen(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleBadNumberConfirm}
              disabled={!badNumberPhoneType}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function LocalTime({ timezone }: { timezone: string }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(interval);
  }, []);

  let formatted: string;
  try {
    formatted = now.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: timezone,
      timeZoneName: "short",
    });
  } catch {
    return null;
  }

  const hour = Number(
    new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: timezone }).format(now)
  );
  const inBusinessHours = (hour >= 8 && hour < 12) || (hour >= 14 && hour < 18);

  return (
    <span className={inBusinessHours ? "text-green-600 dark:text-green-400" : undefined}>
      {formatted} local
    </span>
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
  const [search, setSearch] = useState("");
  const filtered = search
    ? options.filter((o) => o.toLowerCase().includes(search.toLowerCase()))
    : options;
  const allFilteredSelected = filtered.length > 0 && filtered.every((o) => selected.includes(o));

  const toggle = (value: string) => {
    setSelected(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value]
    );
  };

  const toggleAllFiltered = () => {
    if (allFilteredSelected) {
      setSelected(selected.filter((v) => !filtered.includes(v)));
    } else {
      const merged = new Set([...selected, ...filtered]);
      setSelected([...merged]);
    }
  };

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <DropdownMenu onOpenChange={(open) => { if (!open) setSearch(""); }}>
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
        <DropdownMenuContent align="start" className="w-56">
          <div className="px-2 py-1.5">
            <Input
              placeholder={`Search ${label.toLowerCase()}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 text-sm"
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>
          <DropdownMenuSeparator />
          <div className="max-h-52 overflow-y-auto">
            <DropdownMenuCheckboxItem checked={allFilteredSelected} onCheckedChange={toggleAllFiltered}>
              Select all{search ? " matching" : ""}
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            {filtered.length === 0 ? (
              <p className="px-2 py-1.5 text-sm text-muted-foreground">No matches</p>
            ) : (
              filtered.map((opt) => (
                <DropdownMenuCheckboxItem
                  key={opt}
                  checked={selected.includes(opt)}
                  onCheckedChange={() => toggle(opt)}
                >
                  {opt}
                </DropdownMenuCheckboxItem>
              ))
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// Session-scoped persisted state. Values survive in-tab navigation (route changes,
// back/forward) but reset when the tab/window closes. Safe here because the
// CallTracker tree is gated behind AuthGuard and never renders during SSR.
function usePersistedState<T>(
  key: string,
  initialValue: T,
): readonly [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return initialValue;
    try {
      const stored = window.sessionStorage.getItem(key);
      return stored !== null ? (JSON.parse(stored) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage quota exceeded or disabled — silently ignore.
    }
  }, [key, value]);
  return [value, setValue] as const;
}
