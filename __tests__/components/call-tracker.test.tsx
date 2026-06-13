import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
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
          call_counts: { never: 30, once: 7, twice: 4, three_plus: 1 },
        };
      }
      if (path === "/settings") {
        return MOCK_SETTINGS;
      }
      if (path.startsWith("/calls/next")) {
        return MOCK_CONTACT;
      }
      if (path.startsWith("/calls/contact-bundle/")) {
        return { notes: [], calls: [], email_logs: [], company_flag: null };
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

    // Times-called buckets next to the pool total.
    expect(screen.getByText("Called 1×")).toBeInTheDocument();
    expect(screen.getByText("2×")).toBeInTheDocument();
    expect(screen.getByText("3×+")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
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
      if (path.startsWith("/calls/contact-bundle/")) {
        return { notes: [], calls: [], email_logs: [], company_flag: null };
      }
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
      if (path.startsWith("/calls/contact-bundle/")) {
        return {
          notes: [],
          calls: [
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
          ],
          email_logs: [],
          company_flag: null,
        };
      }
      if (path.match(/\/calls\/contact/)) return [];
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

  const MOCK_FLAG = {
    id: "f-1",
    company_name: "ACME Corp",
    reason: "Already has an AI provider",
    details: "Mentioned on a call in June",
    flagged_by: "u-1",
    flagged_by_name: "Sam Caller",
    created_at: "2026-06-12T00:00:00+00:00",
    updated_at: "2026-06-12T00:00:00+00:00",
  };

  async function startCalling() {
    render(<CallTrackerPage />);
    await waitFor(() => expect(screen.getByText("Start Calling")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Start Calling"));
    await waitFor(() => expect(screen.getByText("Jane Doe")).toBeInTheDocument());
  }

  it("shows a prominent warning banner when the contact's company is flagged", async () => {
    setupDefaultMocks();
    const baseImpl = mockApiFetch.getMockImplementation()!;
    mockApiFetch.mockImplementation(async (path: string, options?: RequestInit) => {
      // The flag arrives with the rest of the per-contact bundle.
      if (path.startsWith("/calls/contact-bundle/")) {
        return { notes: [], calls: [], email_logs: [], company_flag: MOCK_FLAG };
      }
      return baseImpl(path, options);
    });

    await startCalling();

    await waitFor(() => {
      expect(screen.getByText(/Company flagged: Already has an AI provider/)).toBeInTheDocument();
    });
    expect(screen.getByText("Mentioned on a call in June")).toBeInTheDocument();
    expect(screen.getByText(/Flagged by Sam Caller/)).toBeInTheDocument();

    // The flag arrives with the displayed contact's bundle.
    expect(
      mockApiFetch.mock.calls.some(
        ([p]) => typeof p === "string" && p === `/calls/contact-bundle/${MOCK_CONTACT.id}`
      )
    ).toBe(true);

    // Flagged companies show Edit/Remove instead of the flag button.
    expect(screen.getByText("Edit")).toBeInTheDocument();
    expect(screen.getByText("Remove")).toBeInTheDocument();
    expect(screen.queryByText("Flag company")).not.toBeInTheDocument();
  });

  it("flags a company with a suggested reason via the dialog", async () => {
    setupDefaultMocks();
    const baseImpl = mockApiFetch.getMockImplementation()!;
    mockApiFetch.mockImplementation(async (path: string, options?: RequestInit) => {
      if (path === "/companies/flag" && options?.method === "PUT") {
        const body = JSON.parse(options.body as string);
        return { ...MOCK_FLAG, reason: body.reason, details: body.details };
      }
      if (path.startsWith("/companies/flag")) return null;
      return baseImpl(path, options);
    });

    await startCalling();

    // No banner yet; open the flag dialog.
    expect(screen.queryByText(/Company flagged:/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Flag company"));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Flag ACME Corp")).toBeInTheDocument();
    // Flagging must be explicitly described as not affecting the pool.
    expect(within(dialog).getByText(/doesn't remove contacts from the calling pool/)).toBeInTheDocument();

    // All suggested reasons are offered.
    for (const reason of [
      "Already has an AI provider",
      "Too large for us to service",
      "Existing customer or partner",
      "Asked not to be contacted",
    ]) {
      expect(within(dialog).getByText(reason)).toBeInTheDocument();
    }

    fireEvent.click(within(dialog).getByText("Too large for us to service"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Flag company" }));

    await waitFor(() => {
      const puts = mockApiFetch.mock.calls.filter(
        ([p, o]) => p === "/companies/flag" && o?.method === "PUT"
      );
      expect(puts.length).toBe(1);
      const body = JSON.parse(puts[0][1]!.body as string);
      expect(body.company_name).toBe("ACME Corp");
      expect(body.reason).toBe("Too large for us to service");
      expect(body.details).toBeNull();
    });

    // Banner appears immediately after saving.
    await waitFor(() => {
      expect(screen.getByText(/Company flagged: Too large for us to service/)).toBeInTheDocument();
    });
  });

  it("flags a company with a custom reason and details", async () => {
    setupDefaultMocks();
    const baseImpl = mockApiFetch.getMockImplementation()!;
    mockApiFetch.mockImplementation(async (path: string, options?: RequestInit) => {
      if (path === "/companies/flag" && options?.method === "PUT") {
        const body = JSON.parse(options.body as string);
        return { ...MOCK_FLAG, reason: body.reason, details: body.details };
      }
      if (path.startsWith("/companies/flag")) return null;
      return baseImpl(path, options);
    });

    await startCalling();
    fireEvent.click(screen.getByText("Flag company"));
    const dialog = await screen.findByRole("dialog");

    fireEvent.change(within(dialog).getByLabelText("Or a custom reason"), {
      target: { value: "Under contract with a competitor" },
    });
    fireEvent.change(within(dialog).getByLabelText("Details (optional)"), {
      target: { value: "Locked in until 2027" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Flag company" }));

    await waitFor(() => {
      const puts = mockApiFetch.mock.calls.filter(
        ([p, o]) => p === "/companies/flag" && o?.method === "PUT"
      );
      expect(puts.length).toBe(1);
      const body = JSON.parse(puts[0][1]!.body as string);
      expect(body.reason).toBe("Under contract with a competitor");
      expect(body.details).toBe("Locked in until 2027");
    });
  });

  it("disables saving a flag until a reason is chosen", async () => {
    setupDefaultMocks();
    await startCalling();

    fireEvent.click(screen.getByText("Flag company"));
    const dialog = await screen.findByRole("dialog");

    const save = within(dialog).getByRole("button", { name: "Flag company" });
    expect(save).toBeDisabled();

    fireEvent.click(within(dialog).getByText("Already has an AI provider"));
    expect(save).not.toBeDisabled();
  });

  it("removes a flag from the banner", async () => {
    setupDefaultMocks();
    const baseImpl = mockApiFetch.getMockImplementation()!;
    mockApiFetch.mockImplementation(async (path: string, options?: RequestInit) => {
      if (path.startsWith("/companies/flag") && options?.method === "DELETE") {
        return { detail: "Flag removed" };
      }
      if (path.startsWith("/calls/contact-bundle/")) {
        return { notes: [], calls: [], email_logs: [], company_flag: MOCK_FLAG };
      }
      return baseImpl(path, options);
    });

    await startCalling();
    await waitFor(() => {
      expect(screen.getByText(/Company flagged:/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Remove"));

    await waitFor(() => {
      expect(
        mockApiFetch.mock.calls.some(
          ([p, o]) =>
            p === "/companies/flag?company_name=ACME%20Corp" && o?.method === "DELETE"
        )
      ).toBe(true);
    });
    await waitFor(() => {
      expect(screen.queryByText(/Company flagged:/)).not.toBeInTheDocument();
    });
    // The flag affordance returns once the flag is gone.
    expect(screen.getByText("Flag company")).toBeInTheDocument();
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
