"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AuthGuard from "@/components/layout/auth-guard";
import AppSidebar from "@/components/layout/app-sidebar";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Trash2, ExternalLink } from "lucide-react";
import type { Contact, Note, CallLog } from "@/types";

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

  useEffect(() => {
    const id = params.id as string;
    apiFetch<Contact>(`/contacts/${id}`).then(setContact).catch(console.error);
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

  if (!contact) {
    return <div className="p-6 text-muted-foreground">Loading...</div>;
  }

  const fields: [string, string | null][] = [
    ["Title", contact.title],
    ["Company", contact.company_name],
    ["Score", contact.score?.toString() ?? null],
    ["Company Type", contact.company_type],
    ["Employees", contact.employees],
    ["City", contact.city],
    ["Country", contact.country],
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
              <span>{call.call_date} — {call.call_method}</span>
              <Badge variant="outline">{call.outcome || "—"}</Badge>
            </div>
          ))}
        </div>
      )}

      <Separator className="my-6" />

      <h2 className="text-lg font-semibold mb-3">Notes</h2>
      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No notes yet.</p>
      ) : (
        <div className="space-y-2">
          {notes.map((note) => (
            <div key={note.id} className="border border-border p-3">
              <p className="text-xs text-muted-foreground mb-1">{note.note_date}</p>
              <p className="text-sm">{note.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
