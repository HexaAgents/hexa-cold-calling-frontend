"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AuthGuard from "@/components/layout/auth-guard";
import AppSidebar from "@/components/layout/app-sidebar";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Trash2, ExternalLink, Plus, Pencil, CheckCircle } from "lucide-react";
import type { Contact, Note, CallLog, CallLogResponse } from "@/types";

export default function ContactDetailPage() {
  return (
    <AuthGuard>
      {(user) => (
        <div className="flex h-screen overflow-hidden">
          <AppSidebar user={user} />
          <main className="relative flex-1 overflow-y-auto bg-background">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-primary/30 via-primary/70 to-primary/30" />
            <ContactDetail />
          </main>
        </div>
      )}
    </AuthGuard>
  );
}

function ContactDetail() {
  const params = useParams();
  const router = useRouter();
  const [contact, setContact] = useState<Contact | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [outcome, setOutcome] = useState<string>("");
  const [outcomeSaved, setOutcomeSaved] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  useEffect(() => {
    const id = params.id as string;
    apiFetch<Contact>(`/contacts/${id}`).then((c) => {
      setContact(c);
      setOutcome(c.call_outcome || "");
    }).catch(console.error);
    apiFetch<Note[]>(`/contacts/${id}/notes`).then(setNotes).catch(console.error);
    apiFetch<CallLog[]>(`/calls/contact/${id}`).then(setCalls).catch(console.error);
  }, [params.id]);

  const handleDelete = async () => {
    if (!confirm("Delete this contact permanently?")) return;
    try {
      await apiFetch(`/contacts/${params.id}`, { method: "DELETE" });
      router.push("/contacts");
    } catch (err) {
      console.error("Delete failed:", err);
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
      setContact((prev) =>
        prev ? { ...prev, call_outcome: outcome, call_occasion_count: result.occasion_count, times_called: result.times_called } : prev
      );
      setOutcomeSaved(true);
      setTimeout(() => setOutcomeSaved(false), 3000);
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
      bad_number: "Bad Number",
    };
    return val ? labels[val] || val : "—";
  };

  if (!contact) {
    return <div className="p-6 text-muted-foreground">Loading...</div>;
  }

  const fields: [string, string | null][] = [
    ["Title", contact.title],
    ["Company", contact.company_name],
    ["Score", contact.score?.toString() ?? null],
    ["Company Type", contact.company_type],
    ["Employees", contact.employees],
    ["Location", [contact.city, contact.state, contact.country].filter(Boolean).join(", ") || null],
    ["Email", contact.email],
    ["Mobile Phone", contact.mobile_phone],
    ["Work Phone", contact.work_direct_phone],
    ["Corporate Phone", contact.corporate_phone],
    ["Website", contact.website],
    ["LinkedIn", contact.person_linkedin_url],
    ["Company LinkedIn", contact.company_linkedin_url],
  ];

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={() => router.push("/contacts")}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={14} /> Back to contacts
        </button>
        <Button variant="destructive" size="sm" onClick={handleDelete}>
          <Trash2 size={14} className="mr-1" /> Delete
        </Button>
      </div>

      <h1 className="text-2xl font-semibold tracking-tight">
        {contact.first_name} {contact.last_name}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {contact.title} at {contact.company_name}
      </p>

      {contact.company_description && (
        <div className="mt-4 border border-border bg-muted/40 p-4">
          <p className="text-xs font-medium text-muted-foreground mb-1">About {contact.company_name}</p>
          <p className="text-sm leading-relaxed">{contact.company_description}</p>
        </div>
      )}

      <Separator className="my-6" />

      <div className="grid grid-cols-2 gap-x-8 gap-y-3">
        {fields.map(([label, value]) =>
          value ? (
            <div key={label}>
              <p className="text-xs text-muted-foreground">{label}</p>
              {(label === "Website" || label === "LinkedIn" || label === "Company LinkedIn") ? (
                <a
                  href={value}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  {value.replace(/^https?:\/\/(www\.)?/, "").slice(0, 40)}
                  <ExternalLink size={10} />
                </a>
              ) : (
                <p className="text-sm">{value}</p>
              )}
            </div>
          ) : null
        )}
      </div>

      {contact.scoring_failed && (
        <Badge variant="destructive" className="mt-4">
          Scoring failed — manual review needed
        </Badge>
      )}

      <Separator className="my-6" />

      <h2 className="text-lg font-semibold mb-3">Update Call Status</h2>
      <div className="border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <Select value={outcome} onValueChange={(v) => { setOutcome(v); setOutcomeSaved(false); }}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Select outcome..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="didnt_pick_up">Didn&apos;t Pick Up</SelectItem>
              <SelectItem value="not_interested">Not Interested</SelectItem>
              <SelectItem value="interested">Interested</SelectItem>
              <SelectItem value="bad_number">Bad Number</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleLogCall} disabled={!outcome || outcomeSaved}>
            {outcomeSaved ? "Saved" : "Save & Log Call"}
          </Button>
          {outcomeSaved && (
            <span className="flex items-center gap-1 text-sm text-green-600">
              <CheckCircle size={14} /> Saved
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          This updates the contact status and creates a call log entry.
        </p>
      </div>

      <Separator className="my-6" />

      <h2 className="text-lg font-semibold mb-3">Call History</h2>
      {calls.length === 0 ? (
        <p className="text-sm text-muted-foreground">No calls recorded.</p>
      ) : (
        <div className="space-y-2">
          {calls.map((call) => (
            <div
              key={call.id}
              className="flex items-center justify-between border border-border p-3 text-sm"
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
                    : call.outcome === "not_interested" || call.outcome === "bad_number"
                    ? "destructive"
                    : "outline"
                }
              >
                {formatOutcome(call.outcome)}
              </Badge>
            </div>
          ))}
        </div>
      )}

      <Separator className="my-6" />

      <h2 className="text-lg font-semibold mb-3">Notes</h2>
      <div className="border border-border bg-card p-4 mb-4">
        <div className="flex gap-2">
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
      </div>
      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No notes yet.</p>
      ) : (
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
      )}
    </div>
  );
}
