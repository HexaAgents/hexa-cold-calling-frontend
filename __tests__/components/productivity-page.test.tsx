import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import ProductivityPage from "@/app/productivity/page";
import { apiFetch } from "@/lib/api";

const mockApiFetch = vi.mocked(apiFetch);

describe("ProductivityPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders page title", async () => {
    mockApiFetch.mockResolvedValue({ users: [], rows: [] });
    render(<ProductivityPage />);
    await waitFor(() => {
      expect(screen.getByText("Productivity")).toBeInTheDocument();
      expect(screen.getByText("Call outcomes logged per user per day")).toBeInTheDocument();
    });
  });

  it("shows user columns and date rows", async () => {
    mockApiFetch.mockResolvedValue({
      users: [
        { id: "u1", first_name: "Alice" },
        { id: "u2", first_name: "Bob" },
      ],
      rows: [
        { date: "2026-04-21", counts: { u1: 5, u2: 3 } },
        { date: "2026-04-20", counts: { u1: 12 } },
      ],
    });

    render(<ProductivityPage />);
    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByText("Bob")).toBeInTheDocument();
      expect(screen.getByText("12")).toBeInTheDocument();
      expect(screen.getByText("Total")).toBeInTheDocument();
    });
  });

  it("shows totals row", async () => {
    mockApiFetch.mockResolvedValue({
      users: [{ id: "u1", first_name: "Alice" }],
      rows: [
        { date: "2026-04-21", counts: { u1: 15 } },
        { date: "2026-04-20", counts: { u1: 22 } },
      ],
    });

    render(<ProductivityPage />);
    await waitFor(() => {
      expect(screen.getByText("Total")).toBeInTheDocument();
      expect(screen.getByText("37")).toBeInTheDocument();
    });
  });

  it("shows empty state", async () => {
    mockApiFetch.mockResolvedValue({
      users: [{ id: "u1", first_name: "Alice" }],
      rows: [],
    });

    render(<ProductivityPage />);
    await waitFor(() => {
      expect(screen.getByText("No call outcomes logged in this period.")).toBeInTheDocument();
    });
  });

  it("renders date range selector", async () => {
    mockApiFetch.mockResolvedValue({ users: [], rows: [] });
    render(<ProductivityPage />);
    await waitFor(() => {
      expect(screen.getByText("Date")).toBeInTheDocument();
    });
  });
});
