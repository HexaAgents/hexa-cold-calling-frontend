import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import TodoListPage from "@/app/todo-list/page";
import { apiFetch } from "@/lib/api";
import type { Todo, TodoAssignee } from "@/types";

const mockApiFetch = vi.mocked(apiFetch);

// AuthGuard mock (setup.tsx) provides current user id "test-id".
const CURRENT_USER_ID = "test-id";

const ASSIGNEES: TodoAssignee[] = [
  { id: "u-ishaan", first_name: "Ishaan" },
  { id: "u-srijan", first_name: "Srijan" },
];

function makeTodo(overrides: Partial<Todo>): Todo {
  return {
    id: "t-1",
    title: "Call back the lead",
    description: null,
    assigned_to_id: "u-ishaan",
    assigned_to_name: "Ishaan",
    assigned_by_id: CURRENT_USER_ID,
    assigned_by_name: "Test",
    due_date: "2099-01-01",
    is_done: false,
    created_at: "2026-01-01T00:00:00",
    updated_at: null,
    ...overrides,
  };
}

function mockData(todos: Todo[], assignees: TodoAssignee[] = ASSIGNEES) {
  mockApiFetch.mockImplementation((path: string, options?: RequestInit) => {
    if (path === "/todos" && options?.method === "POST") return Promise.resolve({} as unknown);
    if (path === "/todos" && options?.method === "PATCH") return Promise.resolve(todos[0]);
    if (path === "/todos") return Promise.resolve(todos as unknown);
    if (path.startsWith("/todos/") && path.endsWith("/")) return Promise.resolve({} as unknown);
    if (path === "/todos/assignees") return Promise.resolve(assignees as unknown);
    return Promise.resolve({} as unknown);
  });
}

describe("TodoListPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.pushState({}, "", "/todo-list");
  });

  it("renders the four column headers", async () => {
    mockData([makeTodo({})]);
    render(<TodoListPage />);
    await waitFor(() => {
      expect(screen.getByText("Task")).toBeInTheDocument();
      expect(screen.getByText("Assigned to")).toBeInTheDocument();
      expect(screen.getByText("Assigned by")).toBeInTheDocument();
      expect(screen.getByText("Due date")).toBeInTheDocument();
    });
  });

  it("renders assignee name pills", async () => {
    mockData([makeTodo({ assigned_to_name: "Ishaan" })]);
    render(<TodoListPage />);
    await waitFor(() => {
      // Name appears in the table row and in the filter dropdown options.
      expect(screen.getAllByText("Ishaan").length).toBeGreaterThan(0);
    });
  });

  it("defaults to the Upcoming section and filters Overdue and Complete", async () => {
    mockData([
      makeTodo({ id: "overdue", title: "Overdue task", due_date: "2020-01-01", is_done: false }),
      makeTodo({ id: "future", title: "Future task", due_date: "2099-01-01", is_done: false }),
      makeTodo({ id: "done", title: "Done task", due_date: "2099-01-01", is_done: true }),
    ]);
    render(<TodoListPage />);

    await waitFor(() => expect(screen.getByText("Future task")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /^Upcoming/ })).toHaveAttribute("aria-pressed", "true");
    // Upcoming: only open tasks that are not overdue.
    expect(screen.queryByText("Overdue task")).not.toBeInTheDocument();
    expect(screen.queryByText("Done task")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Overdue/ }));
    expect(screen.getByText("Overdue task")).toBeInTheDocument();
    expect(screen.queryByText("Future task")).not.toBeInTheDocument();
    expect(screen.queryByText("Done task")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Complete/ }));
    expect(screen.getByText("Done task")).toBeInTheDocument();
    expect(screen.queryByText("Future task")).not.toBeInTheDocument();
    expect(screen.queryByText("Overdue task")).not.toBeInTheDocument();
  });

  it("treats tasks with no due date as Upcoming and keeps completed tasks out of Overdue", async () => {
    mockData([
      makeTodo({ id: "nodue", title: "No due date", due_date: null, is_done: false }),
      makeTodo({ id: "done-overdue", title: "Done overdue", due_date: "2020-01-01", is_done: true }),
    ]);
    render(<TodoListPage />);
    await waitFor(() => expect(screen.getByText("No due date")).toBeInTheDocument());

    // A task with no due date stays in Upcoming.
    expect(screen.getByRole("button", { name: /^Upcoming/ })).toHaveAttribute("aria-pressed", "true");

    // Overdue excludes completed tasks even with a past due date.
    fireEvent.click(screen.getByRole("button", { name: /^Overdue/ }));
    expect(screen.queryByText("Done overdue")).not.toBeInTheDocument();

    // Complete contains the completed task.
    fireEvent.click(screen.getByRole("button", { name: /^Complete/ }));
    expect(screen.getByText("Done overdue")).toBeInTheDocument();
  });

  it("opens on the section from the URL when returning from a task detail", async () => {
    window.history.pushState({}, "", "/todo-list?section=overdue");
    mockData([
      makeTodo({ id: "overdue", title: "Overdue task", due_date: "2020-01-01", is_done: false }),
      makeTodo({ id: "future", title: "Future task", due_date: "2099-01-01", is_done: false }),
    ]);
    render(<TodoListPage />);

    await waitFor(() => expect(screen.getByText("Overdue task")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /Open tasks past their due date/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText("Future task")).not.toBeInTheDocument();
  });

  it("highlights overdue (not done) rows", async () => {
    mockData([makeTodo({ id: "t-overdue", due_date: "2020-01-01", is_done: false })]);
    render(<TodoListPage />);
    await waitFor(() => expect(screen.getByRole("button", { name: /^Overdue/ })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /^Overdue/ }));
    const row = await waitFor(() => {
      const r = screen.getByText("Call back the lead").closest("tr");
      expect(r).not.toBeNull();
      return r;
    });
    expect(row).toHaveAttribute("data-backlogged", "true");
  });

  it("uses a muted red treatment for overdue rows and header count", async () => {
    mockData([makeTodo({ id: "t-overdue", due_date: "2020-01-01", is_done: false })]);
    render(<TodoListPage />);
    await waitFor(() => expect(screen.getByRole("button", { name: /^Overdue/ })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /^Overdue/ }));
    const row = await waitFor(() => {
      const r = screen.getByText("Call back the lead").closest("tr");
      expect(r).not.toBeNull();
      return r;
    });
    expect(row?.className).toContain("bg-rose");
    expect(row?.className).not.toContain("bg-destructive");

    const headerCount = screen.getByText("1 overdue");
    expect(headerCount.className).toContain("text-rose");

    const dueDate = screen.getByText("Jan 1, 2020");
    expect(dueDate.className).toContain("text-rose");
  });

  it("does not highlight completed overdue tasks", async () => {
    mockData([makeTodo({ due_date: "2020-01-01", is_done: true })]);
    render(<TodoListPage />);
    fireEvent.click(await waitFor(() => screen.getByRole("button", { name: /^Complete/ })));
    const row = await waitFor(() => {
      const r = screen.getByText("Call back the lead").closest("tr");
      expect(r).not.toBeNull();
      return r;
    });
    expect(row).not.toHaveAttribute("data-backlogged", "true");
  });

  it("sorts tasks by earliest due date first within each section", async () => {
    mockData([
      makeTodo({ id: "done-early", title: "Done early", due_date: "2099-01-01", is_done: true }),
      makeTodo({ id: "open-late", title: "Open late", due_date: "2099-03-01", is_done: false }),
      makeTodo({ id: "open-early", title: "Open early", due_date: "2099-02-01", is_done: false }),
      makeTodo({ id: "done-late", title: "Done late", due_date: "2099-04-01", is_done: true }),
    ]);

    render(<TodoListPage />);

    // Upcoming (default): open tasks ordered by earliest due date.
    await waitFor(() => expect(screen.getByText("Open early")).toBeInTheDocument());
    const upcoming = screen
      .getAllByRole("link")
      .map((row) => row.textContent || "")
      .filter((text) => text.includes("Open"));
    expect(upcoming[0]).toContain("Open early");
    expect(upcoming[1]).toContain("Open late");

    // Complete: done tasks ordered by earliest due date.
    fireEvent.click(screen.getByRole("button", { name: /^Complete/ }));
    await waitFor(() => expect(screen.getByText("Done early")).toBeInTheDocument());
    const complete = screen
      .getAllByRole("link")
      .map((row) => row.textContent || "")
      .filter((text) => text.includes("Done"));
    expect(complete[0]).toContain("Done early");
    expect(complete[1]).toContain("Done late");
  });

  it("offers a person filter available to everyone", async () => {
    mockData([makeTodo({})]);
    render(<TodoListPage />);
    await waitFor(() => expect(screen.getByRole("combobox")).toBeInTheDocument());
    const filter = screen.getByRole("combobox");
    expect(filter).toBeInTheDocument();
    expect(filter).toHaveTextContent("All people");
  });

  it("shows manage controls only for the assigner", async () => {
    mockData([
      makeTodo({ id: "mine", title: "Mine", assigned_by_id: CURRENT_USER_ID }),
      makeTodo({ id: "theirs", title: "Theirs", assigned_by_id: "someone-else" }),
    ]);
    render(<TodoListPage />);
    await waitFor(() => expect(screen.getByText("Mine")).toBeInTheDocument());
    expect(screen.getByLabelText('Delete "Mine"')).toBeInTheDocument();
    expect(screen.queryByLabelText('Delete "Theirs"')).not.toBeInTheDocument();
    // The done checkbox is disabled for tasks the user did not assign.
    expect(screen.getByLabelText('Mark "Theirs" done')).toBeDisabled();
    expect(screen.getByLabelText('Mark "Mine" done')).not.toBeDisabled();
  });

  it("lets the assignee toggle their own task even if they did not create it", async () => {
    mockData([
      makeTodo({ id: "assigned", title: "Assigned to me", assigned_by_id: "someone-else", assigned_to_id: CURRENT_USER_ID }),
    ]);
    render(<TodoListPage />);
    await waitFor(() => expect(screen.getByText("Assigned to me")).toBeInTheDocument());
    // Can mark done (they are the assignee) but cannot delete (not the assigner).
    expect(screen.getByLabelText('Mark "Assigned to me" done')).not.toBeDisabled();
    expect(screen.queryByLabelText('Delete "Assigned to me"')).not.toBeInTheDocument();
  });

  it("creates a task with only a title", async () => {
    mockData([makeTodo({})]);
    render(<TodoListPage />);
    await waitFor(() => expect(screen.getByText("New task")).toBeInTheDocument());

    fireEvent.click(screen.getByText("New task"));
    fireEvent.change(screen.getByLabelText(/^Task/), { target: { value: "Brand new task" } });
    fireEvent.click(screen.getByText("Create task"));

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        "/todos",
        expect.objectContaining({ method: "POST" }),
      );
    });
    const postCall = mockApiFetch.mock.calls.find(
      ([p, o]) => p === "/todos" && (o as RequestInit)?.method === "POST",
    );
    const body = JSON.parse((postCall![1] as RequestInit).body as string);
    expect(body.title).toBe("Brand new task");
    expect(body.description).toBeNull();
    expect(body.due_date).toBeNull();
  });

  it("creates a task with multiple assignees", async () => {
    mockData([makeTodo({})]);
    render(<TodoListPage />);
    await waitFor(() => expect(screen.getByText("New task")).toBeInTheDocument());

    fireEvent.click(screen.getByText("New task"));
    fireEvent.change(screen.getByLabelText(/^Task/), { target: { value: "Shared task" } });
    fireEvent.click(screen.getByRole("button", { name: /Srijan/ }));
    fireEvent.click(screen.getByRole("button", { name: /Ishaan/ }));
    fireEvent.click(screen.getByText("Create task"));

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        "/todos",
        expect.objectContaining({ method: "POST" }),
      );
    });
    const postCall = mockApiFetch.mock.calls.find(
      ([p, o]) => p === "/todos" && (o as RequestInit)?.method === "POST",
    );
    const body = JSON.parse((postCall![1] as RequestInit).body as string);
    expect(body.assignees).toEqual([
      { id: "u-srijan", first_name: "Srijan" },
      { id: "u-ishaan", first_name: "Ishaan" },
    ]);
  });
});
