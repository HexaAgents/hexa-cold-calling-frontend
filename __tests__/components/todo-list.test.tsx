import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import TodoListPage from "@/app/todo-list/page";
import { apiFetch } from "@/lib/api";

const mockPush = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    back: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/todo-list",
  useParams: () => ({ id: "task-1" }),
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn(),
}));

const mockApiFetch = vi.mocked(apiFetch);

describe("TodoListPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.pushState({}, "", "/todo-list");
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path === "/todos/assignees") {
        return [
          { id: "u-1", first_name: "Srijan" },
          { id: "u-2", first_name: "Ishaan" },
        ];
      }
      if (path === "/todos") {
        return [
          {
            id: "task-1",
            title: "Shared task",
            description: "Two owners",
            assigned_to_id: "u-1",
            assigned_to_name: "Srijan",
            assignees: [
              { id: "u-1", first_name: "Srijan" },
              { id: "u-2", first_name: "Ishaan" },
            ],
            assigned_by_id: "test-id",
            assigned_by_name: "Ishaan",
            due_date: "2099-06-03",
            is_done: false,
            created_at: "2026-06-01T00:00:00",
            updated_at: null,
          },
        ];
      }
      return [];
    });
  });

  it("renders every assignee on a shared task", async () => {
    render(<TodoListPage />);

    await waitFor(() => {
      expect(screen.getByText("Shared task")).toBeInTheDocument();
      expect(screen.getByText("Srijan")).toBeInTheDocument();
      expect(screen.getAllByText("Ishaan").length).toBeGreaterThan(0);
    });
  });

  it("navigates when the task row is clicked", async () => {
    render(<TodoListPage />);

    const title = await screen.findByText("Shared task");
    const row = title.closest("tr");
    expect(row).toHaveAttribute("role", "link");

    fireEvent.click(row!);
    expect(mockPush).toHaveBeenCalledWith("/todo-list/task-1?section=upcoming");
  });
});
