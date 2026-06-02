import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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
  });

  it("shows the task title and description", async () => {
    mockTodo(makeTodo({}));
    render(<TodoDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("Prepare onboarding deck")).toBeInTheDocument();
      expect(screen.getByText("Internal-only detail that lives on the task page")).toBeInTheDocument();
    });
  });

  it("shows edit/delete controls for the assigner", async () => {
    mockTodo(makeTodo({ assigned_by_id: CURRENT_USER_ID }));
    render(<TodoDetailPage />);
    await waitFor(() => expect(screen.getByText("Edit")).toBeInTheDocument());
    expect(screen.getByText("Delete")).toBeInTheDocument();
    expect(screen.getByText("Mark done")).toBeInTheDocument();
  });

  it("is read-only for non-assigners", async () => {
    mockTodo(makeTodo({ assigned_by_id: "someone-else", assigned_by_name: "Srijan" }));
    render(<TodoDetailPage />);
    await waitFor(() => expect(screen.getByText("Prepare onboarding deck")).toBeInTheDocument());
    expect(screen.queryByText("Edit")).not.toBeInTheDocument();
    expect(screen.queryByText("Delete")).not.toBeInTheDocument();
    expect(screen.getByText(/Only Srijan can make changes/)).toBeInTheDocument();
  });

  it("lets the assignee mark done but not edit or delete", async () => {
    mockTodo(makeTodo({ assigned_by_id: "someone-else", assigned_by_name: "Srijan", assigned_to_id: CURRENT_USER_ID }));
    render(<TodoDetailPage />);
    await waitFor(() => expect(screen.getByText("Prepare onboarding deck")).toBeInTheDocument());
    expect(screen.getByText("Mark done")).toBeInTheDocument();
    expect(screen.queryByText("Edit")).not.toBeInTheDocument();
    expect(screen.queryByText("Delete")).not.toBeInTheDocument();
    expect(screen.getByText(/assigned to you/i)).toBeInTheDocument();
  });

  it("shows an overdue warning for past-due tasks", async () => {
    mockTodo(makeTodo({ due_date: "2020-01-01", is_done: false }));
    render(<TodoDetailPage />);
    await waitFor(() => {
      expect(screen.getByText(/this task is overdue/i)).toBeInTheDocument();
    });
  });
});
