"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import AuthGuard from "@/components/layout/auth-guard";
import AppSidebar from "@/components/layout/app-sidebar";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { getPersonPillClasses, getPersonDotClasses } from "@/lib/todo-colors";
import { ListTodo, Plus, Trash2, AlertTriangle, X, CalendarDays, Filter } from "lucide-react";
import type { Todo, TodoAssignee, User } from "@/types";

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function isBacklogged(todo: Todo): boolean {
  return !todo.is_done && !!todo.due_date && todo.due_date < todayStr();
}

function sortTodos(todos: Todo[]): Todo[] {
  // Closest due dates first; tasks without a due date sort to the bottom.
  return [...todos].sort((a, b) => {
    if (a.due_date && b.due_date) return a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : 0;
    if (a.due_date) return -1;
    if (b.due_date) return 1;
    return 0;
  });
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  const parsed = new Date(`${d}T00:00:00`);
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function PersonPill({ name }: { name: string | null }) {
  if (!name) {
    return <span className="text-xs text-muted-foreground">Unassigned</span>;
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${getPersonPillClasses(name)}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${getPersonDotClasses(name)}`} />
      {name}
    </span>
  );
}

export default function TodoListPage() {
  return (
    <AuthGuard>
      {(user) => (
        <div className="flex h-screen overflow-hidden">
          <AppSidebar user={user} />
          <main className="relative flex-1 overflow-y-auto bg-background">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-primary/30 via-primary/70 to-primary/30" />
            <TodoListContent user={user} />
          </main>
        </div>
      )}
    </AuthGuard>
  );
}

function TodoListContent({ user }: { user: User }) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [assignees, setAssignees] = useState<TodoAssignee[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);

  const fetchTodos = useCallback(async () => {
    try {
      const data = await apiFetch<Todo[]>("/todos");
      setTodos(sortTodos(data));
    } catch {
      setTodos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      void fetchTodos();
      apiFetch<TodoAssignee[]>("/todos/assignees")
        .then(setAssignees)
        .catch(() => setAssignees([]));
    }, 0);
    return () => clearTimeout(t);
  }, [fetchTodos]);

  const filtered = useMemo(() => {
    if (filter === "all") return todos;
    if (filter === "unassigned") return todos.filter((t) => !t.assigned_to_id);
    return todos.filter((t) => t.assigned_to_id === filter);
  }, [todos, filter]);

  const openCount = useMemo(() => filtered.filter((t) => !t.is_done).length, [filtered]);
  const doneCount = filtered.length - openCount;
  const backlogCount = useMemo(() => filtered.filter(isBacklogged).length, [filtered]);

  const handleToggleDone = async (todo: Todo) => {
    try {
      const updated = await apiFetch<Todo>(`/todos/${todo.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_done: !todo.is_done }),
      });
      setTodos((prev) => sortTodos(prev.map((t) => (t.id === todo.id ? updated : t))));
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (todo: Todo) => {
    try {
      await apiFetch(`/todos/${todo.id}`, { method: "DELETE" });
      setTodos((prev) => prev.filter((t) => t.id !== todo.id));
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        Loading...
      </div>
    );
  }

  return (
    <div className="py-8 px-6 max-w-5xl mx-auto">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/20">
            <ListTodo size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">To-Do List</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <span>{openCount} open</span>
              <span className="text-border">·</span>
              <span>{doneCount} done</span>
              {backlogCount > 0 && (
                <>
                  <span className="text-border">·</span>
                  <span className="font-medium text-red-600 dark:text-red-400">{backlogCount} backlogged</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <label className="sr-only" htmlFor="todo-filter">
            Filter by person
          </label>
          <div className="relative">
            <Filter size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <select
              id="todo-filter"
              aria-label="Filter by person"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="h-9 rounded-lg border border-input bg-card pl-8 pr-3 text-sm shadow-sm outline-none transition-colors hover:bg-accent/40 focus-visible:border-ring"
            >
              <option value="all">All people</option>
              <option value="unassigned">Unassigned</option>
              {assignees.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.first_name}
                </option>
              ))}
            </select>
          </div>
          <Button size="sm" className="gap-1.5 shadow-sm" onClick={() => setShowCreate(true)}>
            <Plus size={15} /> New task
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40 py-20 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-inset ring-primary/20">
            <ListTodo size={24} />
          </div>
          <h3 className="text-sm font-semibold">No tasks</h3>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Create a task and assign it to someone on the team.
          </p>
          <Button size="sm" className="mt-5 gap-1.5" onClick={() => setShowCreate(true)}>
            <Plus size={15} /> New task
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border bg-muted/40 hover:bg-muted/40">
                <TableHead className="w-12" />
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Task</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Assigned to</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Assigned by</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Due date</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((todo) => {
                const backlogged = isBacklogged(todo);
                const canManage = todo.assigned_by_id === user.id;
                const canToggleDone = canManage || todo.assigned_to_id === user.id;
                return (
                  <TableRow
                    key={todo.id}
                    data-backlogged={backlogged ? "true" : undefined}
                    className={`group transition-colors ${
                      backlogged
                        ? "bg-red-50/70 hover:bg-red-100/70 dark:bg-red-950/20 dark:hover:bg-red-950/40"
                        : "hover:bg-muted/40"
                    } ${todo.is_done ? "opacity-65" : ""}`}
                  >
                    <TableCell className="pl-4">
                      <input
                        type="checkbox"
                        aria-label={`Mark "${todo.title}" done`}
                        checked={todo.is_done}
                        disabled={!canToggleDone}
                        onChange={() => handleToggleDone(todo)}
                        className="h-[18px] w-[18px] cursor-pointer rounded-md accent-primary transition disabled:cursor-not-allowed disabled:opacity-40"
                      />
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/todo-list/${todo.id}`}
                          className={`font-medium transition-colors hover:text-primary ${
                            todo.is_done ? "text-muted-foreground line-through" : ""
                          }`}
                        >
                          {todo.title}
                        </Link>
                        {backlogged && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-950/40 dark:text-red-400">
                            <AlertTriangle size={10} /> Backlogged
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <PersonPill name={todo.assigned_to_name} />
                    </TableCell>
                    <TableCell>
                      <PersonPill name={todo.assigned_by_name} />
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center gap-1.5 text-sm ${
                          backlogged ? "font-medium text-red-600 dark:text-red-400" : "text-muted-foreground"
                        }`}
                      >
                        <CalendarDays size={13} className="opacity-70" />
                        {formatDate(todo.due_date)}
                      </span>
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      {canManage && (
                        <button
                          aria-label={`Delete "${todo.title}"`}
                          onClick={() => handleDelete(todo)}
                          className="rounded-md p-1.5 text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {showCreate && (
        <CreateTaskModal
          assignees={assignees}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            void fetchTodos();
          }}
        />
      )}
    </div>
  );
}

function CreateTaskModal({
  assignees,
  onClose,
  onCreated,
}: {
  assignees: TodoAssignee[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedToId, setAssignedToId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Task name is required.");
      return;
    }
    setSaving(true);
    setError("");
    const assignee = assignees.find((a) => a.id === assignedToId);
    try {
      await apiFetch("/todos", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          assigned_to_id: assignee ? assignee.id : null,
          assigned_to_name: assignee ? assignee.first_name : null,
          due_date: dueDate || null,
        }),
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task.");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" role="dialog" aria-label="Create task">
      <div className="w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-inset ring-primary/20">
              <Plus size={16} />
            </div>
            <h2 className="text-lg font-semibold">New task</h2>
          </div>
          <button aria-label="Close" onClick={onClose} className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="task-title" className="text-sm font-medium">
              Task <span className="text-destructive">*</span>
            </label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="task-description" className="text-sm font-medium">
              Description <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <textarea
              id="task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add more detail (shown on the task page only)"
              rows={3}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="task-assignee" className="text-sm font-medium">
                Assign to <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <select
                id="task-assignee"
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
              <label htmlFor="task-due" className="text-sm font-medium">
                Due date <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <Input id="task-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Creating..." : "Create task"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
