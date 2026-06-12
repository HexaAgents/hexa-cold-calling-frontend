import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor, act } from "@testing-library/react";
import TodoDetailPage from "@/app/todo-list/[id]/page";
import { apiFetch } from "@/lib/api";
import type { Todo } from "@/types";

const mockApiFetch = vi.mocked(apiFetch);

// setup.tsx mocks useParams() -> { id: "test-id" } and the user id -> "test-id".
const CURRENT_USER_ID = "test-id";

function makeTodo(overrides: Partial<Todo>): Todo {
  return {
    id: "test-id",
    title: "Prepare onboarding deck",
    description: "Internal-only detail that lives on the task page",
    assigned_to_id: "u-ishaan",
    assigned_to_name: "Ishaan",
    assigned_by_id: CURRENT_USER_ID,
    assigned_by_name: "Test",
    due_date: "2099-01-01",
    is_done: false,
    estimated_hours_min: null,
    estimated_hours_max: null,
    estimate_status: null,
    actual_hours: null,
    created_at: "2026-01-01T00:00:00",
    updated_at: null,
    ...overrides,
  };
}

function mockTodo(todo: Todo) {
  mockApiFetch.mockImplementation((path: string) => {
    if (path === "/todos/test-id") return Promise.resolve(todo as unknown);
    if (path === "/todos/assignees") return Promise.resolve([] as unknown);
    return Promise.resolve({} as unknown);
  });
}

describe("TodoDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.pushState({}, "", "/todo-list/test-id");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the task title and description", async () => {
    mockTodo(makeTodo({}));
    render(<TodoDetailPage />);
    await waitFor(() => {
      expect(screen.getByDisplayValue("Prepare onboarding deck")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Internal-only detail that lives on the task page")).toBeInTheDocument();
    });
  });

  it("links back to the originating to-do section when provided", async () => {
    window.history.pushState({}, "", "/todo-list/test-id?section=overdue");
    mockTodo(makeTodo({}));
    render(<TodoDetailPage />);

    const backLink = await screen.findByRole("link", { name: /Back to To-Do List/ });
    expect(backLink).toHaveAttribute("href", "/todo-list?section=overdue");
  });

  it("shows editable fields and delete controls for the assigner", async () => {
    mockTodo(makeTodo({ assigned_by_id: CURRENT_USER_ID }));
    render(<TodoDetailPage />);
    await waitFor(() => expect(screen.getByDisplayValue("Prepare onboarding deck")).toBeInTheDocument());
    expect(screen.queryByText("Edit")).not.toBeInTheDocument();
    expect(screen.getByText("Delete")).toBeInTheDocument();
    expect(screen.getByText("Mark done")).toBeInTheDocument();
    expect(screen.getByText("Saved automatically.")).toBeInTheDocument();
  });

  it("shows the AI estimate in the editable sidebar", async () => {
    mockTodo(
      makeTodo({
        assigned_by_id: CURRENT_USER_ID,
        estimate_status: "done",
        estimated_hours_min: 2,
        estimated_hours_max: 4,
      })
    );
    render(<TodoDetailPage />);
    await waitFor(() => expect(screen.getByText("Estimate")).toBeInTheDocument());
    expect(screen.getByText("2–4h")).toBeInTheDocument();
  });

  it("asks for actual hours after marking the task done", async () => {
    const todo = makeTodo({ assigned_by_id: CURRENT_USER_ID });
    mockApiFetch.mockImplementation((path: string, options?: RequestInit) => {
      if (path === "/todos/test-id" && options?.method === "PATCH") {
        const body = JSON.parse(options.body as string);
        return Promise.resolve({ ...todo, ...body } as unknown);
      }
      if (path === "/todos/test-id") return Promise.resolve(todo as unknown);
      if (path === "/todos/assignees") return Promise.resolve([] as unknown);
      return Promise.resolve({} as unknown);
    });
    render(<TodoDetailPage />);
    await waitFor(() => expect(screen.getByText("Mark done")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Mark done"));

    await waitFor(() => {
      expect(screen.getByText("How long did this take?")).toBeInTheDocument();
    });

    // Saving a quick-pick reports the hours via a second PATCH.
    fireEvent.click(screen.getByRole("button", { name: "1h" }));
    await waitFor(() => {
      const patches = mockApiFetch.mock.calls.filter(
        ([p, o]) => p === "/todos/test-id" && (o as RequestInit)?.method === "PATCH"
      );
      expect(patches.length).toBe(2);
      expect(JSON.parse((patches[1][1] as RequestInit).body as string)).toEqual({ actual_hours: 1 });
    });
  });

  it("is read-only for non-assigners", async () => {
    mockTodo(makeTodo({ assigned_by_id: "someone-else", assigned_by_name: "Srijan" }));
    render(<TodoDetailPage />);
    await waitFor(() => expect(screen.getByText("Prepare onboarding deck")).toBeInTheDocument());
    expect(screen.queryByText("Edit")).not.toBeInTheDocument();
    expect(screen.queryByText("Delete")).not.toBeInTheDocument();
    expect(screen.getByText(/Only Srijan can make changes/)).toBeInTheDocument();
  });

  it("lets the assignee edit and mark done but not delete", async () => {
    mockTodo(makeTodo({ assigned_by_id: "someone-else", assigned_by_name: "Srijan", assigned_to_id: CURRENT_USER_ID }));
    render(<TodoDetailPage />);
    await waitFor(() => expect(screen.getByDisplayValue("Prepare onboarding deck")).toBeInTheDocument());
    expect(screen.queryByText("Edit")).not.toBeInTheDocument();
    expect(screen.getByText("Mark done")).toBeInTheDocument();
    expect(screen.getByText("Saved automatically.")).toBeInTheDocument();
    expect(screen.queryByText("Delete")).not.toBeInTheDocument();
  });

  it("lets any multi-assignee edit even when they are not the legacy first assignee", async () => {
    mockTodo(makeTodo({
      assigned_by_id: "someone-else",
      assigned_by_name: "Srijan",
      assigned_to_id: "u-first",
      assigned_to_name: "Ishaan",
      assignees: [
        { id: "u-first", first_name: "Ishaan" },
        { id: CURRENT_USER_ID, first_name: "Test" },
      ],
    }));
    render(<TodoDetailPage />);
    await waitFor(() => expect(screen.getByDisplayValue("Prepare onboarding deck")).toBeInTheDocument());
    expect(screen.getByText("Mark done")).toBeInTheDocument();
    expect(screen.getByText("Saved automatically.")).toBeInTheDocument();
    expect(screen.queryByText("Delete")).not.toBeInTheDocument();
  });

  it("autosaves edited task details every 30 seconds", async () => {
    vi.useFakeTimers();
    mockTodo(makeTodo({}));
    render(<TodoDetailPage />);

    await act(async () => {
      vi.advanceTimersByTime(0);
      await Promise.resolve();
    });
    const titleInput = screen.getByDisplayValue("Prepare onboarding deck");
    fireEvent.change(titleInput, { target: { value: "Updated onboarding deck" } });

    await act(async () => {
      vi.advanceTimersByTime(30_000);
      await Promise.resolve();
    });

    expect(mockApiFetch).toHaveBeenCalledWith(
      "/todos/test-id",
      expect.objectContaining({ method: "PATCH" }),
    );
    const patchCall = mockApiFetch.mock.calls.find(
      ([path, options]) => path === "/todos/test-id" && (options as RequestInit | undefined)?.method === "PATCH",
    );
    const body = JSON.parse((patchCall![1] as RequestInit).body as string);
    expect(body.title).toBe("Updated onboarding deck");
  });

  it("autosaves unsaved changes when leaving the task page", async () => {
    mockTodo(makeTodo({}));
    const { unmount } = render(<TodoDetailPage />);

    const titleInput = await screen.findByDisplayValue("Prepare onboarding deck");
    fireEvent.change(titleInput, { target: { value: "Leave-page autosave" } });
    unmount();

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        "/todos/test-id",
        expect.objectContaining({ method: "PATCH" }),
      );
    });
    const patchCall = mockApiFetch.mock.calls.find(
      ([path, options]) => path === "/todos/test-id" && (options as RequestInit | undefined)?.method === "PATCH",
    );
    const body = JSON.parse((patchCall![1] as RequestInit).body as string);
    expect(body.title).toBe("Leave-page autosave");
  });

  it("shows an overdue warning for past-due tasks", async () => {
    mockTodo(makeTodo({ due_date: "2020-01-01", is_done: false }));
    render(<TodoDetailPage />);
    await waitFor(() => {
      expect(screen.getByText(/this task is overdue/i)).toBeInTheDocument();
    });
  });
});
