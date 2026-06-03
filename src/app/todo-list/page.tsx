"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/layout/auth-guard";
import AppSidebar from "@/components/layout/app-sidebar";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { assigneePayload, getTodoAssignees, isTodoAssignedTo } from "@/lib/todo-assignees";
import { getPersonPillClasses, getPersonDotClasses } from "@/lib/todo-colors";
import { ListTodo, Plus, Trash2, AlertTriangle, X, CalendarDays, Filter, Check } from "lucide-react";
import type { Todo, TodoAssignee, User } from "@/types";

type TodoSection = "all" | "today" | "past";
const TODO_SECTIONS: TodoSection[] = ["all", "today", "past"];

function parseTodoSection(value: string | null): TodoSection {
  return value === "past" || value === "today" ? value : "all";
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function isBacklogged(todo: Todo): boolean {
  return !todo.is_done && !!todo.due_date && todo.due_date < todayStr();
}

function isDueToday(todo: Todo): boolean {
  return !todo.is_done && todo.due_date === todayStr();
}

function sortTodos(todos: Todo[]): Todo[] {
  // Open tasks come first, then completed tasks; each group sorts by due date.
  return [...todos].sort((a, b) => {
    if (a.is_done !== b.is_done) return a.is_done ? 1 : -1;
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

function AssigneePills({ todo }: { todo: Todo }) {
  const assignees = getTodoAssignees(todo);
  if (assignees.length === 0) {
    return <span className="text-xs text-muted-foreground">Unassigned</span>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {assignees.map((assignee) => (
        <PersonPill key={assignee.id} name={assignee.first_name} />
      ))}
    </div>
  );
}

const SECTION_META: Record<TodoSection, { label: string; description: string }> = {
  all: {
    label: "All",
    description: "Upcoming, unscheduled, and completed tasks",
  },
  today: {
    label: "Today",
    description: "Open tasks due today",
  },
  past: {
    label: "Past",
    description: "Open tasks past their due date",
  },
};

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
    <div className="rounded-lg border border-input bg-background/70 p-2">
      <div className="mb-2 flex flex-wrap gap-1.5">
        {selectedIds.length === 0 ? (
          <span className="px-1 text-xs text-muted-foreground">Unassigned</span>
        ) : (
          assignees
            .filter((assignee) => selectedIds.includes(assignee.id))
            .map((assignee) => <PersonPill key={assignee.id} name={assignee.first_name} />)
        )}
      </div>
      <div className="grid max-h-40 gap-1 overflow-y-auto">
        {assignees.map((assignee) => {
          const selected = selectedIds.includes(assignee.id);
          return (
            <button
              key={assignee.id}
              type="button"
              onClick={() => toggle(assignee.id)}
              className={`flex items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                selected ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              }`}
            >
              <span className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${getPersonDotClasses(assignee.first_name)}`} />
                {assignee.first_name}
              </span>
              {selected && <Check size={14} className="text-primary" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function TodoListPage() {
  return (
    <AuthGuard>
      {(user) => (
        <div className="flex h-screen overflow-hidden">
          <AppSidebar user={user} />
          <main className="relative flex-1 overflow-y-auto bg-background [scrollbar-gutter:stable]">
            <div className="absolute top-0 left-0 right-0 h-px bg-linear-to-r from-primary/30 via-primary/70 to-primary/30" />
            <TodoListContent user={user} />
          </main>
        </div>
      )}
    </AuthGuard>
  );
}

function TodoListContent({ user }: { user: User }) {
  const router = useRouter();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [assignees, setAssignees] = useState<TodoAssignee[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [section, setSection] = useState<TodoSection>("all");
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSection(parseTodoSection(new URLSearchParams(window.location.search).get("section")));
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

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

  const personFiltered = useMemo(() => {
    if (filter === "all") return todos;
    if (filter === "unassigned") return todos.filter((t) => getTodoAssignees(t).length === 0);
    return todos.filter((t) => getTodoAssignees(t).some((assignee) => assignee.id === filter));
  }, [todos, filter]);

  const sectionCounts = useMemo(() => {
    const past = personFiltered.filter(isBacklogged).length;
    const today = personFiltered.filter(isDueToday).length;
    return {
      all: personFiltered.length - past - today,
      today,
      past,
    };
  }, [personFiltered]);

  const filtered = useMemo(() => {
    if (section === "past") return personFiltered.filter(isBacklogged);
    if (section === "today") return personFiltered.filter(isDueToday);
    return personFiltered.filter((t) => !isBacklogged(t) && !isDueToday(t));
  }, [personFiltered, section]);

  const openCount = useMemo(() => filtered.filter((t) => !t.is_done).length, [filtered]);
  const doneCount = filtered.length - openCount;
  const backlogCount = useMemo(() => filtered.filter(isBacklogged).length, [filtered]);
  const detailHref = useCallback((todoId: string) => `/todo-list/${todoId}?section=${section}`, [section]);

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
                  <span className="font-medium text-rose-500/85 dark:text-rose-300/85">{backlogCount} overdue</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="h-9 w-42 gap-2 rounded-xl border-border/80 bg-card/80 pl-3 shadow-sm backdrop-blur hover:bg-accent/50">
              <Filter size={14} className="text-muted-foreground" />
              <SelectValue aria-label="Filter by person" />
            </SelectTrigger>
            <SelectContent align="end" className="w-42 rounded-xl">
              <SelectItem value="all">All people</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {assignees.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.first_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" className="gap-1.5 shadow-sm" onClick={() => setShowCreate(true)}>
            <Plus size={15} /> New task
          </Button>
        </div>
      </div>

      <div className="mb-5 grid gap-2 rounded-2xl border border-border bg-card/80 p-1.5 shadow-sm sm:grid-cols-3">
        {TODO_SECTIONS.map((key) => {
          const active = section === key;
          const count = sectionCounts[key];
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              onClick={() => setSection(key)}
              className={`rounded-xl px-4 py-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 ${
                active
                  ? "bg-background text-foreground shadow-sm ring-1 ring-inset ring-border"
                  : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              }`}
            >
              <span className="flex items-center justify-between gap-3">
                <span className="font-semibold">{SECTION_META[key].label}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    key === "past" && count > 0
                      ? "bg-rose-500/10 text-rose-600 dark:text-rose-300"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {count}
                </span>
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                {SECTION_META[key].description}
              </span>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40 py-20 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-inset ring-primary/20">
            <ListTodo size={24} />
          </div>
          <h3 className="text-sm font-semibold">No {SECTION_META[section].label.toLowerCase()} tasks</h3>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            {filter === "all"
              ? "Create a task and assign it to someone on the team."
              : "Try another person filter or switch sections to find more tasks."}
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
                const canToggleDone = canManage || isTodoAssignedTo(todo, user.id);
                return (
                  <TableRow
                    key={todo.id}
                    data-backlogged={backlogged ? "true" : undefined}
                    onClick={() => router.push(detailHref(todo.id))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        router.push(detailHref(todo.id));
                      }
                    }}
                    tabIndex={0}
                    role="link"
                    className={`group cursor-pointer border-l-0 transition-[background-color,box-shadow] focus-visible:bg-accent/60 focus-visible:outline-none ${
                      backlogged
                        ? "bg-rose-500/[0.035] shadow-[inset_3px_0_0_--theme(--color-rose-400/45%)] hover:bg-rose-500/6 dark:bg-rose-500/6 dark:shadow-[inset_3px_0_0_--theme(--color-rose-400/40%)] dark:hover:bg-rose-500/9"
                        : "hover:bg-muted/40"
                    } ${todo.is_done ? "opacity-65" : ""}`}
                  >
                    <TableCell className="pl-4">
                      <input
                        type="checkbox"
                        aria-label={`Mark "${todo.title}" done`}
                        checked={todo.is_done}
                        disabled={!canToggleDone}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => handleToggleDone(todo)}
                        className="h-[18px] w-[18px] cursor-pointer rounded-md accent-primary transition disabled:cursor-not-allowed disabled:opacity-40"
                      />
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-medium transition-colors group-hover:text-primary ${
                            todo.is_done ? "text-muted-foreground line-through" : ""
                          }`}
                        >
                          {todo.title}
                        </span>
                        {backlogged && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-rose-300/30 bg-rose-500/8 px-2 py-0.5 text-[10px] font-medium text-rose-600/90 ring-1 ring-inset ring-rose-400/10 dark:text-rose-300/90">
                            <AlertTriangle size={10} /> Overdue
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <AssigneePills todo={todo} />
                    </TableCell>
                    <TableCell>
                      <PersonPill name={todo.assigned_by_name} />
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center gap-1.5 text-sm ${
                          backlogged
                            ? "rounded-full bg-rose-500/7 px-2.5 py-1 font-medium text-rose-600/90 ring-1 ring-inset ring-rose-400/10 dark:text-rose-300/90"
                            : "text-muted-foreground"
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
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(todo);
                          }}
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
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>([]);
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
    const selectedAssignees = assigneePayload(selectedAssigneeIds, assignees);
    try {
      await apiFetch("/todos", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          assignees: selectedAssignees,
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
              <label className="text-sm font-medium">
                Assign to <span className="text-muted-foreground font-normal">(optional, multiple)</span>
              </label>
              <MultiAssigneePicker
                assignees={assignees}
                selectedIds={selectedAssigneeIds}
                onChange={setSelectedAssigneeIds}
              />
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
