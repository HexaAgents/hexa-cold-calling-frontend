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
  enrichment_status: null,
  retry_at: null,
  created_at: "2025-01-01T00:00:00",
};

function localDateString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

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
      if (path === "/contacts/location-counts") {
        return {
          total: 42,
          countries: [{ name: "DE", count: 42 }],
          states: [],
          cities: [{ name: "Berlin", count: 12 }],
          no_location: 0,
        };
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
          occasion_count: 1,
          times_called: 1,
          retry_at: body.callback_date ?? null,
        };
      }
      return {};
    });
  }

  it("shows contact counts per location while calling", async () => {
    setupDefaultMocks();
    render(<CallTrackerPage />);

    await waitFor(() => {
      expect(screen.getByText("Start Calling")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Start Calling"));

    await waitFor(() => {
      expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    });

    // Pool total plus the top locations (no filters selected -> countries).
    expect(screen.getByText("42 in pool")).toBeInTheDocument();
    expect(screen.getAllByText("DE").length).toBeGreaterThan(0);
  });

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
      expect(dateInput.value).toBe(localDateString(expected));
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

  it("re-enables outcome buttons when /calls/next returns a contact previously logged in this session", async () => {
    // Regression: this is the bug where a user had stale retry contacts
    // looping through /calls/next. The previous implementation persisted a
    // savedContactIds blacklist in sessionStorage that never expired, so any
    // contact whose ID had ever been logged in this tab stayed locked even
    // after the backend's claim_next_contact RPC cleared its call_outcome.
    let nextCallCount = 0;
    mockApiFetch.mockImplementation(async (path: string, options?: RequestInit) => {
      if (path === "/contacts/locations") return { cities: [], states: [], countries: [] };
      if (path === "/settings") return MOCK_SETTINGS;
      if (path.startsWith("/calls/next")) {
        nextCallCount += 1;
        // Both calls return the SAME contact with call_outcome=null (mimicking
        // the SQL RPC that resets call_outcome on every claim).
        return { ...MOCK_CONTACT, call_outcome: null };
      }
      if (path.match(/\/contacts\/[\w-]+\/notes/)) return [];
      if (path.match(/\/calls\/contact/)) return [];
      if (path === "/calls/log" && options?.method === "POST") {
        const body = JSON.parse(options.body as string);
        return {
          call_log: {
            id: `log-${nextCallCount}`,
            contact_id: body.contact_id,
            user_id: "test-user-id",
            call_date: "2026-04-22",
            call_method: "browser",
            phone_number_called: body.phone_number_called,
            outcome: body.outcome,
            is_new_occasion: true,
            created_at: "2026-04-22T10:00:00",
          },
          occasion_count: 1,
          times_called: 1,
          retry_at: null,
        };
      }
      return {};
    });

    render(<CallTrackerPage />);

    await waitFor(() => expect(screen.getByText("Start Calling")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Start Calling"));
    await waitFor(() => expect(screen.getByText("Jane Doe")).toBeInTheDocument());

    // First save: select Didn't Pick Up, then click again to log it.
    const firstClick = screen.getAllByText("Didn't Pick Up");
    fireEvent.click(firstClick[0]);
    fireEvent.click(firstClick[0]);

    await waitFor(() => {
      const logCalls = mockApiFetch.mock.calls.filter(
        ([path, opts]) => path === "/calls/log" && opts?.method === "POST"
      );
      expect(logCalls.length).toBe(1);
    });

    // Click Next -> /calls/next returns the same contact with call_outcome=null.
    fireEvent.click(screen.getByText("Next"));
    await waitFor(() => expect(nextCallCount).toBeGreaterThanOrEqual(2));
    await waitFor(() => expect(screen.getByText("Jane Doe")).toBeInTheDocument());

    // Buttons must NOT be locked. Click Didn't Pick Up twice again -> a second
    // call_log POST should fire. With the old persisted-blacklist bug the
    // button would be disabled and no second POST would happen.
    const secondClick = screen.getAllByText("Didn't Pick Up");
    fireEvent.click(secondClick[0]);
    fireEvent.click(secondClick[0]);

    await waitFor(() => {
      const logCalls = mockApiFetch.mock.calls.filter(
        ([path, opts]) => path === "/calls/log" && opts?.method === "POST"
      );
      expect(logCalls.length).toBe(2);
    });
  });

  it("re-enables outcome selection after deleting a log when a prior log keeps call_outcome set", async () => {
    // Regression: a contact with an existing log in its history. After logging
    // a new outcome and then deleting that log, the backend reverts the
    // contact's call_outcome to the prior log's outcome. The outcome buttons
    // must unlock so a different outcome can be selected and saved.
    let logCounter = 0;
    mockApiFetch.mockImplementation(async (path: string, options?: RequestInit) => {
      if (path === "/contacts/locations") return { cities: [], states: [], countries: [] };
      if (path === "/settings") return MOCK_SETTINGS;
      if (path.startsWith("/calls/next")) return { ...MOCK_CONTACT, call_outcome: null };
      if (path.match(/\/contacts\/[\w-]+\/notes/)) return [];
      if (path.match(/\/calls\/contact/)) {
        return [
          {
            id: "prior-log",
            contact_id: MOCK_CONTACT.id,
            user_id: "test-user-id",
            call_date: "2026-04-20",
            call_method: "browser",
            phone_number_called: MOCK_CONTACT.mobile_phone,
            outcome: "didnt_pick_up",
            is_new_occasion: true,
            created_at: "2026-04-20T10:00:00",
          },
        ];
      }
      if (path === "/calls/log" && options?.method === "POST") {
        logCounter += 1;
        const body = JSON.parse(options.body as string);
        return {
          call_log: {
            id: `log-${logCounter}`,
            contact_id: body.contact_id,
            user_id: "test-user-id",
            call_date: "2026-04-22",
            call_method: "browser",
            phone_number_called: body.phone_number_called,
            outcome: body.outcome,
            is_new_occasion: true,
            created_at: "2026-04-22T10:00:00",
          },
          occasion_count: 1,
          times_called: 2,
          retry_at: body.callback_date ?? null,
        };
      }
      if (options?.method === "DELETE" && path.startsWith("/calls/")) {
        // A prior log remains, so the contact keeps a (non-null) call_outcome.
        return { contact_id: MOCK_CONTACT.id, times_called: 1, call_outcome: "didnt_pick_up" };
      }
      return {};
    });

    render(<CallTrackerPage />);

    await waitFor(() => expect(screen.getByText("Start Calling")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Start Calling"));
    await waitFor(() => expect(screen.getByText("Jane Doe")).toBeInTheDocument());

    // Log a new "didnt_pick_up" outcome (select, then click again to save).
    const dpu = screen.getAllByText("Didn't Pick Up");
    fireEvent.click(dpu[0]);
    fireEvent.click(dpu[0]);
    await waitFor(() => {
      const posts = mockApiFetch.mock.calls.filter(
        ([p, o]) => p === "/calls/log" && o?.method === "POST"
      );
      expect(posts.length).toBe(1);
    });

    // Delete the just-created log (first delete button, newest log first).
    await waitFor(() => expect(screen.getAllByTitle("Delete call log").length).toBeGreaterThanOrEqual(2));
    fireEvent.click(screen.getAllByTitle("Delete call log")[0]);
    await waitFor(() => {
      expect(
        mockApiFetch.mock.calls.some(([p, o]) => o?.method === "DELETE" && p === "/calls/log-1")
      ).toBe(true);
    });

    // Buttons must now be unlocked: pick a different outcome and save it.
    const interested = screen.getAllByText("Interested");
    fireEvent.click(interested[0]);
    fireEvent.click(interested[0]);

    await waitFor(() => {
      const posts = mockApiFetch.mock.calls.filter(
        ([p, o]) => p === "/calls/log" && o?.method === "POST"
      );
      expect(posts.length).toBe(2);
      expect(JSON.parse(posts[1][1]!.body as string).outcome).toBe("interested");
    });
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
