"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/layout/auth-guard";
import AppShell from "@/components/layout/app-shell";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { assigneePayload, canCompleteTodo, getTodoAssignees, isTodoAssignedTo } from "@/lib/todo-assignees";
import { RecurrencePicker, RecurrenceBadge, type RecurrenceValue } from "@/components/todo/todo-recurrence";
import { upcomingSundayLocalISO } from "@/lib/utils";
import { PersonAvatar, PersonChip, AssigneeStack } from "@/components/todo/person-chip";
import { ListTodo, Plus, Trash2, X, CalendarDays, Filter, Check, Pencil, ChevronDown, Search, Sparkles } from "lucide-react";
import type { Todo, TodoAssignee, User } from "@/types";

type TodoSection = "upcoming" | "overdue" | "complete";
const TODO_SECTIONS: TodoSection[] = ["upcoming", "overdue", "complete"];

function parseTodoSection(value: string | null): TodoSection {
  return value === "overdue" || value === "complete" ? value : "upcoming";
}

function todayStr(): string {
  // Local calendar date (YYYY-MM-DD). Avoid toISOString(), which is UTC and
  // rolls to the next day in the evening for negative offsets — that would
  // mis-classify tasks due "today" as overdue/past.
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isBacklogged(todo: Todo): boolean {
  return !todo.is_done && !!todo.due_date && todo.due_date < todayStr();
}

// Section predicates.
// Overdue: open tasks whose due date is in the past.
// Complete: tasks that have been marked done.
// Upcoming: everything else (open tasks that are not overdue).
function isComplete(todo: Todo): boolean {
  return todo.is_done;
}

function isUpcoming(todo: Todo): boolean {
  return !todo.is_done && !isBacklogged(todo);
}

function sortTodos(todos: Todo[], userId: string): Todo[] {
  // Open tasks come first, then completed tasks. Within each group the
  // logged-in user's tasks come first; each subgroup sorts by due date.
  return [...todos].sort((a, b) => {
    if (a.is_done !== b.is_done) return a.is_done ? 1 : -1;
    const aMine = isTodoAssignedTo(a, userId);
    const bMine = isTodoAssignedTo(b, userId);
    if (aMine !== bMine) return aMine ? -1 : 1;
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

function InlineTitleEditor({
  todo,
  canManage,
  onSave,
}: {
  todo: Todo;
  canManage: boolean;
  onSave: (todoId: string, title: string) => Promise<void> | void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(todo.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const next = draft.trim();
    if (next && next !== todo.title) {
      void onSave(todo.id, next);
    } else {
      setDraft(todo.title);
    }
  };

  if (editing) {
    return (
      <Input
        ref={inputRef}
        value={draft}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            setDraft(todo.title);
            setEditing(false);
          }
        }}
        className="h-8 py-1 text-sm font-medium"
      />
    );
  }

  return (
    <div className="flex items-start gap-2">
      <span
        className={`font-medium transition-colors group-hover:text-primary ${
          todo.is_done ? "text-muted-foreground line-through" : ""
        }`}
      >
        {todo.title}
      </span>
      <RecurrenceBadge todo={todo} />
      {canManage && (
        <button
          type="button"
          aria-label={`Edit "${todo.title}"`}
          title="Edit task"
          onClick={(e) => {
            e.stopPropagation();
            setDraft(todo.title);
            setEditing(true);
          }}
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-border/70 bg-background/60 text-muted-foreground opacity-100 transition-all hover:border-primary/40 hover:bg-accent hover:text-foreground focus-visible:opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
        >
          <Pencil size={12} />
        </button>
      )}
    </div>
  );
}

function InlineAssigneeEditor({
  todo,
  assignees,
  canManage,
  onSave,
}: {
  todo: Todo;
  assignees: TodoAssignee[];
  canManage: boolean;
  onSave: (todoId: string, ids: string[]) => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const currentIds = useMemo(() => getTodoAssignees(todo).map((a) => a.id), [todo]);
  const [draftIds, setDraftIds] = useState<string[]>(currentIds);

  if (!canManage) {
    return <AssigneeStack todo={todo} />;
  }

  const toggle = (id: string) => {
    setDraftIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const sameSelection = (a: string[], b: string[]) =>
    a.length === b.length && a.every((id) => b.includes(id));

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          // Sync the draft to the latest assignees each time the menu opens.
          setDraftIds(currentIds);
        } else if (!sameSelection(draftIds, currentIds)) {
          void onSave(todo.id, draftIds);
        }
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Edit assignees"
          onClick={(e) => e.stopPropagation()}
          className="-mx-1.5 -my-1 flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:outline-none"
        >
          <span className="min-w-0 flex-1">
            <AssigneeStack todo={todo} />
          </span>
          <ChevronDown size={13} className="shrink-0 text-muted-foreground opacity-100 transition-opacity lg:opacity-0 lg:group-hover:opacity-100" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-52"
        onClick={(e) => e.stopPropagation()}
      >
        {assignees.length === 0 ? (
          <p className="px-2 py-1.5 text-sm text-muted-foreground">No assignable users.</p>
        ) : (
          assignees.map((assignee) => (
            <DropdownMenuCheckboxItem
              key={assignee.id}
              checked={draftIds.includes(assignee.id)}
              onSelect={(e) => e.preventDefault()}
              onCheckedChange={() => toggle(assignee.id)}
            >
              <span className="flex items-center gap-2">
                <PersonAvatar name={assignee.first_name} />
                {assignee.first_name}
              </span>
            </DropdownMenuCheckboxItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function QuickAddRow({
  user,
  assignees,
  onCreated,
  onMoreOptions,
}: {
  user: User;
  assignees: TodoAssignee[];
  onCreated: () => void;
  onMoreOptions: (title: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Quick-add captures your own work, so the task is assigned to the current
  // user. The assignees list from the API has the canonical first name; fall
  // back to deriving one from the profile if the user isn't in it yet.
  const selfAssignee = (): TodoAssignee => {
    const match = assignees.find((a) => a.id === user.id);
    if (match) return match;
    const firstName = (user.full_name || user.email).trim().split(/\s+/)[0];
    return { id: user.id, first_name: firstName };
  };

  const submit = async () => {
    const trimmed = title.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    setError("");
    try {
      await apiFetch("/todos", {
        method: "POST",
        body: JSON.stringify({
          title: trimmed,
          due_date: upcomingSundayLocalISO(),
          assignees: [selfAssignee()],
        }),
      });
      setTitle("");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add task.");
    } finally {
      setSaving(false);
      // Keep focus so several tasks can be added back-to-back.
      inputRef.current?.focus();
    }
  };

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2.5 rounded-xl border border-border bg-card/80 px-3.5 py-2 shadow-sm backdrop-blur transition-colors focus-within:border-primary/40">
        <Plus size={15} className="shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={title}
          disabled={saving}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void submit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              setTitle("");
            }
          }}
          placeholder="Add a task and press Enter — assigned to you, due Sunday"
          aria-label="Quick add task"
          className="h-7 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:opacity-60"
        />
        <button
          type="button"
          onClick={() => {
            onMoreOptions(title.trim());
            setTitle("");
            setError("");
          }}
          disabled={saving}
          title="Open the full form to add a description, assignees, or recurrence"
          className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          More options
        </button>
      </div>
      {error && <p className="mt-1.5 px-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

const SECTION_META: Record<TodoSection, { label: string; description: string; emptyText: string }> = {
  upcoming: {
    label: "Upcoming",
    description: "Open tasks that aren't overdue or completed",
    emptyText: "Create a task and assign it to someone on the team.",
  },
  overdue: {
    label: "Overdue",
    description: "Open tasks past their due date",
    emptyText: "Nothing is overdue.",
  },
  complete: {
    label: "Complete",
    description: "Tasks that have been marked done",
    emptyText: "No completed tasks yet.",
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
            .map((assignee) => <PersonChip key={assignee.id} name={assignee.first_name} />)
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
                <PersonAvatar name={assignee.first_name} />
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
        <AppShell user={user} title="To-Do" mainClassName="[scrollbar-gutter:stable]">
          <TodoListContent user={user} />
        </AppShell>
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
  const [search, setSearch] = useState("");
  const [section, setSection] = useState<TodoSection>("upcoming");
  const [showCreate, setShowCreate] = useState(false);
  const [createInitialTitle, setCreateInitialTitle] = useState("");

  const openCreateModal = useCallback((initialTitle = "") => {
    setCreateInitialTitle(initialTitle);
    setShowCreate(true);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSection(parseTodoSection(new URLSearchParams(window.location.search).get("section")));
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  const fetchTodos = useCallback(async () => {
    try {
      const data = await apiFetch<Todo[]>("/todos");
      setTodos(sortTodos(data, user.id));
    } catch {
      setTodos([]);
    } finally {
      setLoading(false);
    }
  }, [user.id]);

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
    let result = todos;
    if (filter === "unassigned") {
      result = result.filter((t) => getTodoAssignees(t).length === 0);
    } else if (filter !== "all") {
      result = result.filter((t) => getTodoAssignees(t).some((assignee) => assignee.id === filter));
    }
    const query = search.trim().toLowerCase();
    if (query) {
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(query) ||
          (t.description ?? "").toLowerCase().includes(query),
      );
    }
    return result;
  }, [todos, filter, search]);

  const sectionCounts = useMemo(
    () => ({
      upcoming: personFiltered.filter(isUpcoming).length,
      overdue: personFiltered.filter(isBacklogged).length,
      complete: personFiltered.filter(isComplete).length,
    }),
    [personFiltered],
  );

  // The Overdue tab shows a red accent only when it actually contains work.
  const overdueCount = useMemo(() => personFiltered.filter(isBacklogged).length, [personFiltered]);

  const filtered = useMemo(() => {
    if (section === "overdue") return personFiltered.filter(isBacklogged);
    if (section === "complete") return personFiltered.filter(isComplete);
    return personFiltered.filter(isUpcoming);
  }, [personFiltered, section]);

  const openCount = useMemo(() => filtered.filter((t) => !t.is_done).length, [filtered]);
  const doneCount = filtered.length - openCount;
  const backlogCount = useMemo(() => filtered.filter(isBacklogged).length, [filtered]);
  const detailHref = useCallback((todoId: string) => `/todo-list/${todoId}?section=${section}`, [section]);

  const handleToggleDone = async (todo: Todo) => {
    try {
      const markingDone = !todo.is_done;
      const updated = await apiFetch<Todo>(`/todos/${todo.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_done: markingDone }),
      });
      setTodos((prev) => sortTodos(prev.map((t) => (t.id === todo.id ? updated : t)), user.id));
      // Completing a recurring task creates its next occurrence server-side;
      // refetch so it shows up right away.
      if (markingDone && todo.recurrence_interval) {
        void fetchTodos();
      }
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

  const handleSaveTitle = async (todoId: string, title: string) => {
    try {
      const updated = await apiFetch<Todo>(`/todos/${todoId}`, {
        method: "PATCH",
        body: JSON.stringify({ title }),
      });
      setTodos((prev) => sortTodos(prev.map((t) => (t.id === todoId ? updated : t)), user.id));
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveAssignees = async (todoId: string, ids: string[]) => {
    try {
      const updated = await apiFetch<Todo>(`/todos/${todoId}`, {
        method: "PATCH",
        body: JSON.stringify({ assignees: assigneePayload(ids, assignees) }),
      });
      setTodos((prev) => sortTodos(prev.map((t) => (t.id === todoId ? updated : t)), user.id));
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
    <div className="py-6 sm:py-8 px-4 sm:px-6 max-w-5xl mx-auto">
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
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative w-full sm:w-56">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks..."
              aria-label="Search tasks by name or description"
              className="h-9 rounded-xl border-border/80 bg-card/80 pl-9 pr-8 shadow-sm backdrop-blur [&::-webkit-search-cancel-button]:hidden"
            />
            {search && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-muted-foreground transition-colors hover:text-foreground"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="h-9 w-42 gap-2 rounded-xl border-border/80 bg-card/80 pl-3 shadow-sm backdrop-blur hover:bg-accent/50">
              <Filter size={14} className="text-muted-foreground" />
              <SelectValue aria-label="Filter by person" />
            </SelectTrigger>
            <SelectContent
              position="popper"
              align="end"
              sideOffset={6}
              className="max-h-none w-42 rounded-xl"
            >
              <SelectItem value="all">All people</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {assignees.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.first_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" className="gap-1.5 shadow-sm" onClick={() => openCreateModal()}>
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
                    key === "overdue" && overdueCount > 0
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

      {section === "upcoming" && (
        <QuickAddRow
          user={user}
          assignees={assignees}
          onCreated={() => void fetchTodos()}
          onMoreOptions={openCreateModal}
        />
      )}

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40 py-20 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-inset ring-primary/20">
            <ListTodo size={24} />
          </div>
          <h3 className="text-sm font-semibold">
            {search.trim()
              ? "No matching tasks"
              : section === "upcoming"
                ? "No tasks yet"
                : `No ${SECTION_META[section].label.toLowerCase()} tasks`}
          </h3>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            {search.trim()
              ? `No tasks match "${search.trim()}". Try a different search or clear it.`
              : filter === "all"
                ? SECTION_META[section].emptyText
                : "Try another person filter or switch sections to find more tasks."}
          </p>
          <Button size="sm" className="mt-5 gap-1.5" onClick={() => openCreateModal()}>
            <Plus size={15} /> New task
          </Button>
        </div>
      ) : (
        <>
        {/* Mobile card list */}
        <div className="space-y-2 lg:hidden">
          {filtered.map((todo) => {
            const backlogged = isBacklogged(todo);
            const canManage = todo.assigned_by_id === user.id;
            const canToggleDone = canCompleteTodo(todo, user);
            return (
              <div
                key={todo.id}
                onClick={() => router.push(detailHref(todo.id))}
                role="link"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    router.push(detailHref(todo.id));
                  }
                }}
                className={`cursor-pointer rounded-xl border border-border bg-card p-4 shadow-sm transition-colors active:bg-muted/40 ${
                  backlogged ? "border-l-2 border-l-rose-400/60" : ""
                } ${todo.is_done ? "opacity-65" : ""}`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    aria-label={`Mark "${todo.title}" done`}
                    checked={todo.is_done}
                    disabled={!canToggleDone}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => handleToggleDone(todo)}
                    className="mt-0.5 h-[20px] w-[20px] shrink-0 cursor-pointer rounded-md accent-primary transition disabled:cursor-not-allowed disabled:opacity-40"
                  />
                  <p className={`min-w-0 flex-1 wrap-break-word text-sm font-medium ${todo.is_done ? "line-through" : ""}`}>
                    {todo.title}
                  </p>
                  {canManage && (
                    <button
                      aria-label={`Delete "${todo.title}"`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(todo);
                      }}
                      className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 pl-[32px]">
                  <RecurrenceBadge todo={todo} />
                  <AssigneeStack todo={todo} />
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs ${
                      backlogged
                        ? "font-medium text-rose-600/90 dark:text-rose-300/90"
                        : "text-muted-foreground"
                    }`}
                  >
                    <CalendarDays size={12} className="opacity-70" />
                    {formatDate(todo.due_date)}
                  </span>
                  {todo.assigned_by_name && (
                    <span className="text-xs text-muted-foreground">
                      by {todo.assigned_by_name}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="hidden overflow-hidden rounded-xl border border-border bg-card shadow-sm lg:block">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border bg-muted/40 hover:bg-muted/40">
                <TableHead className="w-12" />
                <TableHead className="w-[42%] text-xs font-semibold uppercase tracking-wide text-muted-foreground">Task</TableHead>
                <TableHead className="w-[21%] text-xs font-semibold uppercase tracking-wide text-muted-foreground">Assigned to</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Assigned by</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Due date</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((todo) => {
                const backlogged = isBacklogged(todo);
                const canManage = todo.assigned_by_id === user.id;
                const canToggleDone = canCompleteTodo(todo, user);
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
                    <TableCell className="w-[42%] whitespace-normal break-words align-top">
                      <InlineTitleEditor
                        todo={todo}
                        canManage={canManage}
                        onSave={handleSaveTitle}
                      />
                    </TableCell>
                    <TableCell className="w-[21%]">
                      <InlineAssigneeEditor
                        todo={todo}
                        assignees={assignees}
                        canManage={canManage}
                        onSave={handleSaveAssignees}
                      />
                    </TableCell>
                    <TableCell>
                      <PersonChip name={todo.assigned_by_name} />
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center gap-1.5 text-sm ${
                          backlogged
                            ? "font-medium text-rose-600/90 dark:text-rose-300/90"
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
                          className="rounded-md p-1.5 text-muted-foreground opacity-100 transition-all hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
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
        </>
      )}

      {showCreate && (
        <CreateTaskModal
          assignees={assignees}
          initialTitle={createInitialTitle}
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
  initialTitle = "",
  onClose,
  onCreated,
}: {
  assignees: TodoAssignee[];
  initialTitle?: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState("");
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>([]);
  // Default the due date to the end of the week (upcoming Sunday).
  const [dueDate, setDueDate] = useState(upcomingSundayLocalISO);
  const [recurrence, setRecurrence] = useState<RecurrenceValue>({ interval: null, unit: null });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [estimating, setEstimating] = useState(false);
  const [estimateError, setEstimateError] = useState("");

  const handleEstimateDueDate = async () => {
    setEstimating(true);
    setEstimateError("");
    try {
      const result = await apiFetch<{ due_date: string }>("/todos/estimate-due-date", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
        }),
      });
      setDueDate(result.due_date);
    } catch {
      setEstimateError("Couldn't estimate a due date — pick one manually.");
    } finally {
      setEstimating(false);
    }
  };

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
          recurrence_interval: recurrence.interval,
          recurrence_unit: recurrence.unit,
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
      <div className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-xl border border-border bg-background p-5 sm:p-6 shadow-xl">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              <button
                type="button"
                onClick={() => void handleEstimateDueDate()}
                disabled={saving || estimating || !title.trim()}
                title={title.trim() ? "Let AI suggest a due date from the task name and description" : "Type a task name first"}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Sparkles size={12} />
                {estimating ? "Estimating…" : "Estimate the due date"}
              </button>
              {estimateError && <p className="text-xs text-destructive">{estimateError}</p>}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Repeat <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <RecurrencePicker value={recurrence} onChange={setRecurrence} />
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
