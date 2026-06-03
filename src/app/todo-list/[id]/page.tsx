"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import AuthGuard from "@/components/layout/auth-guard";
import AppSidebar from "@/components/layout/app-sidebar";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getTodoAssignees, isTodoAssignedTo } from "@/lib/todo-assignees";
import { getPersonPillClasses, getPersonDotClasses } from "@/lib/todo-colors";
import { ArrowLeft, Trash2, CheckCircle2, Circle, AlertTriangle, CalendarDays, Check } from "lucide-react";
import type { Todo, TodoAssignee, User } from "@/types";

const AUTOSAVE_INTERVAL_MS = 30_000;

function todoListBackHref(): string {
  if (typeof window === "undefined") return "/todo-list";
  const section = new URLSearchParams(window.location.search).get("section");
  return section === "past" || section === "today" ? `/todo-list?section=${section}` : "/todo-list";
}

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

function AssigneePills({ todo }: { todo: Todo }) {
  const assignees = getTodoAssignees(todo);
  if (assignees.length === 0) return <span className="text-sm text-muted-foreground">Unassigned</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {assignees.map((assignee) => (
        <PersonPill key={assignee.id} name={assignee.first_name} />
      ))}
    </div>
  );
}

function formSignature(values: {
  title: string;
  description: string;
  selectedAssigneeIds: string[];
  dueDate: string;
}): string {
  return JSON.stringify({
    title: values.title.trim(),
    description: values.description.trim() || null,
    selectedAssigneeIds: values.selectedAssigneeIds,
    due_date: values.dueDate || null,
  });
}

function MultiAssigneePicker({
  assignees,
  selectedIds,
  onChange,
}: {
  assignees: TodoAssignee[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const toggle = (id: string) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id]);
  };

  return (
    <div className="flex flex-wrap gap-2">
      {assignees.length === 0 ? (
        <div className="rounded-full border border-dashed border-border bg-muted/20 px-3 py-1.5 text-sm text-muted-foreground">
          No assignable users found.
        </div>
      ) : (
        assignees.map((assignee) => {
          const selected = selectedIds.includes(assignee.id);
          return (
            <button
              key={assignee.id}
              type="button"
              onClick={() => toggle(assignee.id)}
              aria-pressed={selected}
              className={`inline-flex min-w-30 items-center justify-between gap-2 rounded-full border px-3 py-1.5 text-left text-sm font-medium transition-all ${
                selected
                  ? `${getPersonPillClasses(assignee.first_name)} shadow-sm ring-1 ring-current/10`
                  : "border-border bg-background/60 text-muted-foreground hover:border-primary/30 hover:bg-accent/60 hover:text-foreground"
              }`}
            >
              <span className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${getPersonDotClasses(assignee.first_name)}`} />
                {assignee.first_name}
              </span>
              {selected && <Check size={13} />}
            </button>
          );
        })
      )}
    </div>
  );
}

export default function TodoDetailPage() {
  return (
    <AuthGuard>
      {(user) => (
        <div className="flex h-screen overflow-hidden">
          <AppSidebar user={user} />
          <main className="relative flex-1 overflow-y-auto bg-background">
            <div className="absolute top-0 left-0 right-0 h-px bg-linear-to-r from-primary/30 via-primary/70 to-primary/30" />
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
  const [backHref, setBackHref] = useState("/todo-list");

  const [todo, setTodo] = useState<Todo | null>(null);
  const [assignees, setAssignees] = useState<TodoAssignee[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [error, setError] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState("");
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const todoRef = useRef<Todo | null>(null);
  const assigneesRef = useRef<TodoAssignee[]>([]);
  const formRef = useRef({ title: "", description: "", selectedAssigneeIds: [] as string[], dueDate: "" });
  const lastSavedSignatureRef = useRef("");
  const canEditRef = useRef(false);

  const resizeDescription = useCallback(() => {
    const textarea = descriptionRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, []);

  const syncForm = useCallback((t: Todo) => {
    const nextForm = {
      title: t.title,
      description: t.description ?? "",
      selectedAssigneeIds: getTodoAssignees(t).map((assignee) => assignee.id),
      dueDate: t.due_date ?? "",
    };
    formRef.current = nextForm;
    lastSavedSignatureRef.current = formSignature(nextForm);
    setHasUnsavedChanges(false);
    setTitle(nextForm.title);
    setDescription(nextForm.description);
    setSelectedAssigneeIds(nextForm.selectedAssigneeIds);
    setDueDate(nextForm.dueDate);
  }, []);

  const fetchTodo = useCallback(async () => {
    try {
      const data = await apiFetch<Todo>(`/todos/${todoId}`);
      todoRef.current = data;
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

  useEffect(() => {
    const t = window.setTimeout(() => {
      setBackHref(todoListBackHref());
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    resizeDescription();
  }, [description, resizeDescription]);

  useEffect(() => {
    todoRef.current = todo;
  }, [todo]);

  useEffect(() => {
    assigneesRef.current = assignees;
  }, [assignees]);

  useEffect(() => {
    const nextForm = { title, description, selectedAssigneeIds, dueDate };
    formRef.current = nextForm;
    setHasUnsavedChanges(todoRef.current ? formSignature(nextForm) !== lastSavedSignatureRef.current : false);
  }, [title, description, selectedAssigneeIds, dueDate]);

  const canManage = !!todo && todo.assigned_by_id === user.id;
  const canEdit = !!todo && (canManage || isTodoAssignedTo(todo, user.id));
  const canToggleDone = !!todo && (canManage || isTodoAssignedTo(todo, user.id));
  const backlogged = !!todo && !todo.is_done && !!todo.due_date && todo.due_date < todayStr();

  useEffect(() => {
    canEditRef.current = canEdit;
  }, [canEdit]);

  const buildSaveBody = useCallback((currentTodo: Todo) => {
    const form = formRef.current;
    const knownAssignees = new Map<string, TodoAssignee>();
    for (const assignee of [...assigneesRef.current, ...getTodoAssignees(currentTodo)]) {
      knownAssignees.set(assignee.id, assignee);
    }
    return {
      title: form.title.trim(),
      description: form.description.trim() || null,
      assignees: form.selectedAssigneeIds.flatMap((id) => {
        const assignee = knownAssignees.get(id);
        return assignee ? [assignee] : [];
      }),
      due_date: form.dueDate || null,
    };
  }, []);

  const saveDraft = useCallback(async () => {
    const currentTodo = todoRef.current;
    if (!currentTodo || !canEditRef.current) return;

    const form = formRef.current;
    const signature = formSignature(form);
    if (signature === lastSavedSignatureRef.current) return;
    if (!form.title.trim()) {
      setError("Task name is required before it can autosave.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const updated = await apiFetch<Todo>(`/todos/${currentTodo.id}`, {
        method: "PATCH",
        body: JSON.stringify(buildSaveBody(currentTodo)),
      });
      todoRef.current = updated;
      setTodo(updated);
      lastSavedSignatureRef.current = signature;
      setHasUnsavedChanges(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to autosave task.");
    } finally {
      setSaving(false);
    }
  }, [buildSaveBody]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void saveDraft();
    }, AUTOSAVE_INTERVAL_MS);
    return () => {
      window.clearInterval(interval);
      void saveDraft();
    };
  }, [saveDraft]);

  useEffect(() => {
    const handlePageHide = () => {
      void saveDraft();
    };
    window.addEventListener("pagehide", handlePageHide);
    return () => window.removeEventListener("pagehide", handlePageHide);
  }, [saveDraft]);

  const patch = async (body: Record<string, unknown>, options: { syncFormAfter?: boolean } = {}) => {
    if (!todo) return;
    setSaving(true);
    setError("");
    try {
      const updated = await apiFetch<Todo>(`/todos/${todo.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      todoRef.current = updated;
      setTodo(updated);
      if (options.syncFormAfter) {
        syncForm(updated);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update task.");
    } finally {
      setSaving(false);
    }
  };

  const handleUnassign = async () => {
    await saveDraft();
    await patch({ unassign: true }, { syncFormAfter: true });
  };
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
        <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft size={15} /> Back to To-Do List
        </Link>
        <p className="text-sm text-muted-foreground">Task not found.</p>
      </div>
    );
  }

  return (
    <div className="px-6 py-4 max-w-5xl mx-auto">
      <Link href={backHref} className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={15} /> Back to To-Do List
      </Link>

      {backlogged && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 shadow-sm dark:border-red-900/70 dark:bg-red-950/20 dark:text-red-300">
          <AlertTriangle size={15} /> This task is overdue (past its due date).
        </div>
      )}

      {!canEdit ? (
        <div className={`overflow-hidden rounded-2xl border bg-card shadow-lg shadow-black/5 ${backlogged ? "border-red-200 dark:border-red-950" : "border-border"}`}>
          <div className={`h-1 ${backlogged ? "bg-red-500/80" : todo.is_done ? "bg-emerald-500/80" : "bg-primary/70"}`} />
          <div className="p-7">
          <div className="flex items-start justify-between gap-4">
            <h1 className={`text-2xl font-semibold tracking-tight ${todo.is_done ? "line-through text-muted-foreground" : ""}`}>
              {todo.title}
            </h1>
            {todo.is_done ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-200 bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300">
                <CheckCircle2 size={12} /> Done
              </span>
            ) : backlogged ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-red-200 bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300">
                <AlertTriangle size={12} /> Overdue
              </span>
            ) : (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-200 bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-300">
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
              <div className="rounded-xl border border-border bg-muted/20 p-3.5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">Assigned to</p>
                <AssigneePills todo={todo} />
              </div>
              <div className="rounded-xl border border-border bg-muted/20 p-3.5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">Assigned by</p>
                <PersonPill name={todo.assigned_by_name} />
              </div>
              <div className="rounded-xl border border-border bg-muted/20 p-3.5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">Due date</p>
                <p className={`inline-flex items-center gap-1.5 ${backlogged ? "font-medium text-red-600 dark:text-red-300" : "text-foreground"}`}>
                  <CalendarDays size={14} className="opacity-70" />
                  {formatDate(todo.due_date)}
                </p>
              </div>
            </div>
          </div>

          {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

          {canToggleDone ? (
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
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-lg shadow-black/5">
          <div className={`h-1 ${backlogged ? "bg-red-500/80" : todo.is_done ? "bg-emerald-500/80" : "bg-primary/70"}`} />
          <div className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <section className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="edit-title" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Task <span className="text-destructive">*</span>
                </label>
                <Input
                  id="edit-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="h-11 border-0 bg-muted/30 px-0 text-2xl font-semibold tracking-tight shadow-none focus-visible:ring-0"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="edit-description" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Description
                </label>
                <textarea
                  ref={descriptionRef}
                  id="edit-description"
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    requestAnimationFrame(resizeDescription);
                  }}
                  rows={1}
                  placeholder="Add details so the assignees know exactly what to do."
                  className="block min-h-28 w-full resize-none overflow-hidden rounded-xl border border-input bg-background/70 px-3 py-2.5 text-sm leading-relaxed outline-none transition-colors placeholder:text-muted-foreground/70 focus-visible:border-ring"
                />
              </div>
            </section>

            <aside className="space-y-4 rounded-2xl border border-border bg-muted/10 p-4">
              <div className="flex items-center justify-between gap-3 border-b border-border/70 pb-3">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Assigned by
                </span>
                <PersonPill name={todo.assigned_by_name} />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Assign to
                </label>
                <MultiAssigneePicker
                  assignees={assignees}
                  selectedIds={selectedAssigneeIds}
                  onChange={setSelectedAssigneeIds}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="edit-due" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Due date
                </label>
                <Input id="edit-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            </aside>

            {error && <p className="text-sm text-destructive lg:col-span-2">{error}</p>}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 lg:col-span-2">
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={handleToggleDone} disabled={saving}>
                  {todo.is_done ? <Circle size={14} /> : <CheckCircle2 size={14} />}
                  {todo.is_done ? "Mark not done" : "Mark done"}
                </Button>
                {getTodoAssignees(todo).length > 0 && (
                  <Button type="button" size="sm" variant="ghost" onClick={handleUnassign} disabled={saving}>
                    Unassign
                  </Button>
                )}
                {canManage && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="gap-1.5 text-muted-foreground hover:text-destructive"
                    onClick={handleDelete}
                    disabled={saving}
                  >
                    <Trash2 size={14} /> Delete
                  </Button>
                )}
              </div>
              <div className="flex items-center justify-end gap-3">
                <p className="text-xs text-muted-foreground">
                  {saving ? "Autosaving..." : hasUnsavedChanges ? "Unsaved changes autosave every 30 seconds." : "Saved automatically."}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    syncForm(todo);
                    setError("");
                    requestAnimationFrame(resizeDescription);
                  }}
                  disabled={saving}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
