"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import AuthGuard from "@/components/layout/auth-guard";
import AppSidebar from "@/components/layout/app-sidebar";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getPersonPillClasses, getPersonDotClasses } from "@/lib/todo-colors";
import { ArrowLeft, Trash2, CheckCircle2, Circle, AlertTriangle, CalendarDays } from "lucide-react";
import type { Todo, TodoAssignee, User } from "@/types";

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(d: string | null): string {
  if (!d) return "No due date";
  return new Date(`${d}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function PersonPill({ name }: { name: string | null }) {
  if (!name) return <span className="text-sm text-muted-foreground">Unassigned</span>;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${getPersonPillClasses(name)}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${getPersonDotClasses(name)}`} />
      {name}
    </span>
  );
}

export default function TodoDetailPage() {
  return (
    <AuthGuard>
      {(user) => (
        <div className="flex h-screen overflow-hidden">
          <AppSidebar user={user} />
          <main className="relative flex-1 overflow-y-auto bg-background">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-primary/30 via-primary/70 to-primary/30" />
            <TodoDetailContent user={user} />
          </main>
        </div>
      )}
    </AuthGuard>
  );
}

function TodoDetailContent({ user }: { user: User }) {
  const params = useParams();
  const router = useRouter();
  const todoId = params.id as string;

  const [todo, setTodo] = useState<Todo | null>(null);
  const [assignees, setAssignees] = useState<TodoAssignee[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedToId, setAssignedToId] = useState("");
  const [dueDate, setDueDate] = useState("");

  const syncForm = useCallback((t: Todo) => {
    setTitle(t.title);
    setDescription(t.description ?? "");
    setAssignedToId(t.assigned_to_id ?? "");
    setDueDate(t.due_date ?? "");
  }, []);

  const fetchTodo = useCallback(async () => {
    try {
      const data = await apiFetch<Todo>(`/todos/${todoId}`);
      setTodo(data);
      syncForm(data);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [todoId, syncForm]);

  useEffect(() => {
    const t = setTimeout(() => {
      void fetchTodo();
      apiFetch<TodoAssignee[]>("/todos/assignees")
        .then(setAssignees)
        .catch(() => setAssignees([]));
    }, 0);
    return () => clearTimeout(t);
  }, [fetchTodo]);

  const canManage = !!todo && todo.assigned_by_id === user.id;
  const canToggleDone = !!todo && (canManage || todo.assigned_to_id === user.id);
  const backlogged = !!todo && !todo.is_done && !!todo.due_date && todo.due_date < todayStr();

  const patch = async (body: Record<string, unknown>) => {
    if (!todo) return;
    setSaving(true);
    setError("");
    try {
      const updated = await apiFetch<Todo>(`/todos/${todo.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setTodo(updated);
      syncForm(updated);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update task.");
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Task name is required.");
      return;
    }
    const assignee = assignees.find((a) => a.id === assignedToId);
    await patch({
      title: title.trim(),
      description: description.trim() || null,
      assigned_to_id: assignee ? assignee.id : null,
      assigned_to_name: assignee ? assignee.first_name : null,
      due_date: dueDate || null,
    });
  };

  const handleUnassign = () => patch({ unassign: true });
  const handleToggleDone = () => todo && patch({ is_done: !todo.is_done });

  const handleDelete = async () => {
    if (!todo) return;
    try {
      await apiFetch(`/todos/${todo.id}`, { method: "DELETE" });
      router.push("/todo-list");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete task.");
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full text-sm text-muted-foreground">Loading...</div>;
  }

  if (notFound || !todo) {
    return (
      <div className="py-8 px-6 max-w-2xl mx-auto">
        <Link href="/todo-list" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft size={15} /> Back to To-Do List
        </Link>
        <p className="text-sm text-muted-foreground">Task not found.</p>
      </div>
    );
  }

  return (
    <div className="py-8 px-6 max-w-2xl mx-auto">
      <Link href="/todo-list" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft size={15} /> Back to To-Do List
      </Link>

      {backlogged && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-400">
          <AlertTriangle size={15} /> This task is backlogged (past its due date).
        </div>
      )}

      {!editing ? (
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <h1 className={`text-2xl font-semibold tracking-tight ${todo.is_done ? "line-through text-muted-foreground" : ""}`}>
              {todo.title}
            </h1>
            {todo.is_done ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                <CheckCircle2 size={12} /> Done
              </span>
            ) : backlogged ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700 dark:bg-red-950/40 dark:text-red-400">
                <AlertTriangle size={12} /> Overdue
              </span>
            ) : (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                <Circle size={12} /> Open
              </span>
            )}
          </div>

          <div className="mt-6 space-y-5 text-sm">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1.5">Description</p>
              {todo.description ? (
                <p className="whitespace-pre-wrap leading-relaxed text-foreground">{todo.description}</p>
              ) : (
                <p className="text-muted-foreground italic">No description.</p>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">Assigned to</p>
                <PersonPill name={todo.assigned_to_name} />
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">Assigned by</p>
                <PersonPill name={todo.assigned_by_name} />
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">Due date</p>
                <p className={`inline-flex items-center gap-1.5 ${backlogged ? "text-red-600 dark:text-red-400 font-medium" : "text-foreground"}`}>
                  <CalendarDays size={14} className="opacity-70" />
                  {formatDate(todo.due_date)}
                </p>
              </div>
            </div>
          </div>

          {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

          {canManage ? (
            <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-border pt-4">
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                Edit
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={handleToggleDone} disabled={saving}>
                {todo.is_done ? <Circle size={14} /> : <CheckCircle2 size={14} />}
                {todo.is_done ? "Mark not done" : "Mark done"}
              </Button>
              {todo.assigned_to_id && (
                <Button size="sm" variant="ghost" onClick={handleUnassign} disabled={saving}>
                  Unassign
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5 text-muted-foreground hover:text-destructive ml-auto"
                onClick={handleDelete}
              >
                <Trash2 size={14} /> Delete
              </Button>
            </div>
          ) : canToggleDone ? (
            <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border pt-4">
              <Button size="sm" variant="outline" className="gap-1.5" onClick={handleToggleDone} disabled={saving}>
                {todo.is_done ? <Circle size={14} /> : <CheckCircle2 size={14} />}
                {todo.is_done ? "Mark not done" : "Mark done"}
              </Button>
              <p className="text-xs text-muted-foreground">
                This task is assigned to you. Only {todo.assigned_by_name || "the person who assigned it"} can edit the details.
              </p>
            </div>
          ) : (
            <p className="mt-6 border-t border-border pt-4 text-xs text-muted-foreground">
              Only {todo.assigned_by_name || "the person who assigned this task"} can make changes.
            </p>
          )}
        </div>
      ) : (
        <form onSubmit={handleSave} className="rounded-lg border border-border bg-card p-6 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="edit-title" className="text-sm font-medium">
              Task <span className="text-destructive">*</span>
            </label>
            <Input id="edit-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="edit-description" className="text-sm font-medium">
              Description
            </label>
            <textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="edit-assignee" className="text-sm font-medium">
                Assign to
              </label>
              <select
                id="edit-assignee"
                value={assignedToId}
                onChange={(e) => setAssignedToId(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring"
              >
                <option value="">Unassigned</option>
                {assignees.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.first_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="edit-due" className="text-sm font-medium">
                Due date
              </label>
              <Input id="edit-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                syncForm(todo);
                setError("");
                setEditing(false);
              }}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
