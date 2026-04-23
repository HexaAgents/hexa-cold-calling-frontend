import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CallTrackerPage from "@/app/call-tracker/page";
import { apiFetch } from "@/lib/api";

vi.mock("@twilio/voice-sdk", () => ({
  Device: vi.fn(),
  Call: vi.fn(),
}));

const mockApiFetch = vi.mocked(apiFetch);

const MOCK_SETTINGS = {
  id: "s1",
  sms_call_threshold: 3,
  retry_days: 5,
  sms_template: "Hi <first_name>",
};

const MOCK_CONTACT = {
  id: "c-1",
  first_name: "Jane",
  last_name: "Doe",
  title: "CEO",
  company_name: "ACME Corp",
  person_linkedin_url: null,
  website: "https://acme.com",
  company_linkedin_url: null,
  employees: "50",
  city: "Berlin",
  state: null,
  country: "DE",
  timezone: null,
  email: "jane@acme.com",
  mobile_phone: "+491234567890",
  work_direct_phone: null,
  corporate_phone: null,
  score: 85,
  company_type: "manufacturer",
  rationale: "Good fit",
  rejection_reason: null,
  company_description: null,
  exa_scrape_success: true,
  scoring_failed: false,
  call_occasion_count: 0,
  times_called: 0,
  call_outcome: null,
  messaging_status: null,
  sms_sent: false,
  sms_sent_after_calls: null,
  sms_scheduled_at: null,
  enrichment_status: null,
  retry_at: null,
  created_at: "2025-01-01T00:00:00",
};

Object.defineProperty(window, "sessionStorage", {
  value: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
  writable: true,
});

describe("CallTrackerPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (window.sessionStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);
  });

  function setupDefaultMocks() {
    mockApiFetch.mockImplementation(async (path: string, options?: RequestInit) => {
      if (path === "/contacts/locations") {
        return { cities: ["Berlin"], states: [], countries: ["DE"] };
      }
      if (path === "/settings") {
        return MOCK_SETTINGS;
      }
      if (path.startsWith("/calls/next")) {
        return MOCK_CONTACT;
      }
      if (path.match(/\/contacts\/[\w-]+\/notes/)) {
        return [];
      }
      if (path.match(/\/calls\/contact/)) {
        return [];
      }
      if (path === "/calls/log" && options?.method === "POST") {
        const body = JSON.parse(options.body as string);
        return {
          call_log: {
            id: "log-1",
            contact_id: body.contact_id,
            user_id: "test-user-id",
            call_date: "2026-04-22",
            call_method: "browser",
            phone_number_called: body.phone_number_called,
            outcome: body.outcome,
            is_new_occasion: true,
            created_at: "2026-04-22T10:00:00",
          },
          sms_prompt_needed: false,
          occasion_count: 1,
          times_called: 1,
          retry_at: body.callback_date ?? null,
        };
      }
      return {};
    });
  }

  it("shows callback date input when Didn't Pick Up is selected", async () => {
    setupDefaultMocks();
    render(<CallTrackerPage />);

    await waitFor(() => {
      expect(screen.getByText("Start Calling")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Start Calling"));

    await waitFor(() => {
      expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    });

    const outcomeButtons = screen.getAllByText("Didn't Pick Up");
    fireEvent.click(outcomeButtons[0]);

    await waitFor(() => {
      expect(screen.getByLabelText("Callback date")).toBeInTheDocument();
    });
  });

  it("hides callback date input for other outcomes", async () => {
    setupDefaultMocks();
    render(<CallTrackerPage />);

    await waitFor(() => {
      expect(screen.getByText("Start Calling")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Start Calling"));

    await waitFor(() => {
      expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    });

    const interestedButtons = screen.getAllByText("Interested");
    fireEvent.click(interestedButtons[0]);

    expect(screen.queryByLabelText("Callback date")).not.toBeInTheDocument();
  });

  it("pre-fills callback date based on retry_days setting", async () => {
    setupDefaultMocks();
    render(<CallTrackerPage />);

    await waitFor(() => {
      expect(screen.getByText("Start Calling")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Start Calling"));

    await waitFor(() => {
      expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    });

    const outcomeButtons = screen.getAllByText("Didn't Pick Up");
    fireEvent.click(outcomeButtons[0]);

    await waitFor(() => {
      const dateInput = screen.getByLabelText("Callback date") as HTMLInputElement;
      expect(dateInput.value).toBeTruthy();
      const expected = new Date();
      expected.setDate(expected.getDate() + 5);
      expect(dateInput.value).toBe(expected.toISOString().slice(0, 10));
    });
  });

  it("allows editing the callback date", async () => {
    setupDefaultMocks();
    render(<CallTrackerPage />);

    await waitFor(() => {
      expect(screen.getByText("Start Calling")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Start Calling"));

    await waitFor(() => {
      expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    });

    const outcomeButtons = screen.getAllByText("Didn't Pick Up");
    fireEvent.click(outcomeButtons[0]);

    await waitFor(() => {
      expect(screen.getByLabelText("Callback date")).toBeInTheDocument();
    });

    const dateInput = screen.getByLabelText("Callback date") as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: "2026-06-15" } });
    expect(dateInput.value).toBe("2026-06-15");
  });

  it("includes callback_date in the API call body", async () => {
    setupDefaultMocks();
    render(<CallTrackerPage />);

    await waitFor(() => {
      expect(screen.getByText("Start Calling")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Start Calling"));

    await waitFor(() => {
      expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    });

    const outcomeButtons = screen.getAllByText("Didn't Pick Up");
    fireEvent.click(outcomeButtons[0]);

    await waitFor(() => {
      expect(screen.getByLabelText("Callback date")).toBeInTheDocument();
    });

    const dateInput = screen.getByLabelText("Callback date") as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: "2026-07-01" } });

    fireEvent.click(outcomeButtons[0]);

    await waitFor(() => {
      const logCalls = mockApiFetch.mock.calls.filter(
        ([path, opts]) => path === "/calls/log" && opts?.method === "POST"
      );
      expect(logCalls.length).toBeGreaterThan(0);
      const body = JSON.parse(logCalls[0][1]!.body as string);
      expect(body.callback_date).toBe("2026-07-01");
      expect(body.outcome).toBe("didnt_pick_up");
    });
  });
});
