import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import ImportPage from "@/app/import/page";
import { apiFetch, apiDownload } from "@/lib/api";

const mockApiFetch = vi.mocked(apiFetch);
const mockApiDownload = vi.mocked(apiDownload);

const ENRICHMENT_HEALTH = {
  counts_by_status: {
    pending_enrichment: 0,
    enriching: 0,
    enriched: 0,
    enrichment_failed: 0,
    enrichment_no_phone: 0,
  },
  out_of_credits_count: 0,
  exhausted_retries_count: 0,
  stale_enriching_count: 0,
  out_of_credits: false,
};

function mockRecentImports(batches: unknown[]) {
  mockApiFetch.mockImplementation(async (path: string) => {
    if (path === "/imports/recent") return batches;
    if (path === "/apollo/enrich/status") return ENRICHMENT_HEALTH;
    return [];
  });
}

describe("ImportPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRecentImports([]);
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
      // The page title also appears in the mobile app-shell header, so query the heading.
      expect(screen.getByRole("heading", { name: "Import" })).toBeInTheDocument();
      expect(screen.getByText("Upload an Apollo CSV export to score and import contacts.")).toBeInTheDocument();
    });
  });

  it("shows recent imports when batches exist", async () => {
    mockRecentImports([
      {
        id: "b1",
        user_id: "u1",
        filename: "test.csv",
        total_rows: 50,
        processed_rows: 50,
        stored_rows: 30,
        discarded_rows: 20,
        enriched_rows: 0,
        enrichment_error: null,
        status: "completed",
        has_filtered_csv: false,
        created_at: "2026-04-20T00:00:00Z",
      },
    ]);

    render(<ImportPage />);
    await waitFor(() => {
      expect(screen.getByText("test.csv")).toBeInTheDocument();
      expect(screen.getByText("50 / 50")).toBeInTheDocument();
      expect(screen.getByText("Complete")).toBeInTheDocument();
      expect(screen.getByText("30 stored, 20 discarded")).toBeInTheDocument();
    });
  });

  it("shows progress bar for processing batch", async () => {
    mockRecentImports([
      {
        id: "b2",
        user_id: "u1",
        filename: "importing.csv",
        total_rows: 100,
        processed_rows: 40,
        stored_rows: 25,
        discarded_rows: 15,
        enriched_rows: 10,
        enrichment_error: null,
        status: "processing",
        has_filtered_csv: false,
        created_at: "2026-04-20T00:00:00Z",
      },
    ]);

    render(<ImportPage />);
    await waitFor(() => {
      expect(screen.getByText("importing.csv")).toBeInTheDocument();
      expect(screen.getByText("40 / 100")).toBeInTheDocument();
      expect(screen.getByText(/25 stored/)).toBeInTheDocument();
      expect(screen.getByText(/15 discarded/)).toBeInTheDocument();
    });
  });

  it("shows failed state", async () => {
    mockRecentImports([
      {
        id: "b3",
        user_id: "u1",
        filename: "broken.csv",
        total_rows: 100,
        processed_rows: 30,
        stored_rows: 10,
        discarded_rows: 20,
        enriched_rows: 0,
        enrichment_error: null,
        status: "failed",
        has_filtered_csv: false,
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
    mockRecentImports([]);

    render(<ImportPage />);
    await waitFor(() => {
      expect(screen.queryByText("Imports")).not.toBeInTheDocument();
    });
  });

  it("shows a filtered-CSV download button when the backend has one", async () => {
    const batch = {
      id: "b9",
      user_id: "u1",
      filename: "leads.csv",
      total_rows: 50,
      processed_rows: 50,
      stored_rows: 30,
      discarded_rows: 20,
      enriched_rows: 0,
      enrichment_error: null,
      status: "completed",
      has_filtered_csv: true,
      created_at: "2026-04-20T00:00:00Z",
    };
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path === "/imports/recent") return [batch];
      if (path === "/apollo/enrich/status") return ENRICHMENT_HEALTH;
      return [];
    });

    render(<ImportPage />);
    const downloadBtn = await screen.findByRole("button", { name: /Filtered CSV/i });
    fireEvent.click(downloadBtn);

    await waitFor(() => {
      expect(mockApiDownload).toHaveBeenCalledWith(
        "/imports/b9/filtered-csv",
        "leads.filtered.csv",
      );
    });
  });

  it("hides the download button when no filtered CSV is stored yet", async () => {
    const batch = {
      id: "b10",
      user_id: "u1",
      filename: "leads.csv",
      total_rows: 50,
      processed_rows: 50,
      stored_rows: 30,
      discarded_rows: 20,
      enriched_rows: 0,
      enrichment_error: null,
      status: "completed",
      has_filtered_csv: false,
      created_at: "2026-04-20T00:00:00Z",
    };
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path === "/imports/recent") return [batch];
      if (path === "/apollo/enrich/status") return ENRICHMENT_HEALTH;
      return [];
    });

    render(<ImportPage />);
    await screen.findByText("leads.csv");
    expect(screen.queryByRole("button", { name: /Filtered CSV/i })).not.toBeInTheDocument();
  });
});
