import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import ImportPage from "@/app/import/page";
import { apiFetch } from "@/lib/api";

const mockApiFetch = vi.mocked(apiFetch);

describe("ImportPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiFetch.mockResolvedValue([]);
  });

  it("renders drop zone", async () => {
    render(<ImportPage />);
    await waitFor(() => {
      expect(screen.getByText("Drag & drop a CSV file here, or click to browse")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Choose file" })).toBeInTheDocument();
    });
  });

  it("renders page title", async () => {
    render(<ImportPage />);
    await waitFor(() => {
      expect(screen.getByText("Import")).toBeInTheDocument();
      expect(screen.getByText("Upload an Apollo CSV export to score and import contacts.")).toBeInTheDocument();
    });
  });

  it("shows recent imports when batches exist", async () => {
    mockApiFetch.mockResolvedValueOnce([
      {
        id: "b1",
        user_id: "u1",
        filename: "test.csv",
        total_rows: 50,
        processed_rows: 50,
        stored_rows: 30,
        discarded_rows: 20,
        status: "completed",
        created_at: "2026-04-20T00:00:00Z",
      },
    ]);

    render(<ImportPage />);
    await waitFor(() => {
      expect(screen.getByText("test.csv")).toBeInTheDocument();
      expect(screen.getByText("50 / 50")).toBeInTheDocument();
      expect(screen.getByText(/Complete — 30 stored, 20 discarded/)).toBeInTheDocument();
    });
  });

  it("shows progress bar for processing batch", async () => {
    mockApiFetch.mockResolvedValueOnce([
      {
        id: "b2",
        user_id: "u1",
        filename: "importing.csv",
        total_rows: 100,
        processed_rows: 40,
        stored_rows: 25,
        discarded_rows: 15,
        status: "processing",
        created_at: "2026-04-20T00:00:00Z",
      },
    ]);

    render(<ImportPage />);
    await waitFor(() => {
      expect(screen.getByText("importing.csv")).toBeInTheDocument();
      expect(screen.getByText("40 / 100")).toBeInTheDocument();
      expect(screen.getByText(/25 stored, 15 discarded so far/)).toBeInTheDocument();
    });
  });

  it("shows failed state", async () => {
    mockApiFetch.mockResolvedValueOnce([
      {
        id: "b3",
        user_id: "u1",
        filename: "broken.csv",
        total_rows: 100,
        processed_rows: 30,
        stored_rows: 10,
        discarded_rows: 20,
        status: "failed",
        created_at: "2026-04-20T00:00:00Z",
      },
    ]);

    render(<ImportPage />);
    await waitFor(() => {
      expect(screen.getByText("broken.csv")).toBeInTheDocument();
      expect(screen.getByText(/Failed/)).toBeInTheDocument();
    });
  });

  it("shows empty state with no batches", async () => {
    mockApiFetch.mockResolvedValueOnce([]);

    render(<ImportPage />);
    await waitFor(() => {
      expect(screen.queryByText("Imports")).not.toBeInTheDocument();
    });
  });
});
