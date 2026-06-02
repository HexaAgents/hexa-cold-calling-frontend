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

  it("highlights backlogged (overdue, not done) rows", async () => {
    mockData([makeTodo({ id: "t-overdue", due_date: "2020-01-01", is_done: false })]);
    render(<TodoListPage />);
    await waitFor(() => {
      expect(screen.getByText("Backlogged")).toBeInTheDocument();
    });
    const row = screen.getByText("Call back the lead").closest("tr");
    expect(row).toHaveAttribute("data-backlogged", "true");
  });

  it("does not highlight completed overdue tasks", async () => {
    mockData([makeTodo({ due_date: "2020-01-01", is_done: true })]);
    render(<TodoListPage />);
    await waitFor(() => expect(screen.getByText("Call back the lead")).toBeInTheDocument());
    expect(screen.queryByText("Backlogged")).not.toBeInTheDocument();
  });

  it("offers a person filter available to everyone", async () => {
    mockData([makeTodo({})]);
    render(<TodoListPage />);
    await waitFor(() => expect(screen.getByLabelText("Filter by person")).toBeInTheDocument());
    const filter = screen.getByLabelText("Filter by person");
    expect(filter).toBeInTheDocument();
    // Filtering to a person with no tasks empties the table.
    fireEvent.change(filter, { target: { value: "u-srijan" } });
    await waitFor(() => expect(screen.getByText("No tasks")).toBeInTheDocument());
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
});
