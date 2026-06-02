import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SettingsPage from "@/app/settings/page";
import { apiFetch } from "@/lib/api";

const mockApiFetch = vi.mocked(apiFetch);

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path === "/settings") {
        return {
          id: "s1",
          sms_call_threshold: 3,
          retry_days: 3,
          sms_template: "Hi <first_name>, this is Hexa.",
          email_subject_didnt_pick_up: "",
          email_template_didnt_pick_up: "",
          email_subject_interested: "",
          email_template_interested: "",
        };
      }
      if (path === "/email/oauth/status") {
        return { connected: false, gmail_address: null };
      }
      return {};
    });
  });

  it("renders threshold and template inputs", async () => {
    render(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getByLabelText("SMS & stop after N call occasions")).toBeInTheDocument();
      expect(screen.getByLabelText("SMS Template")).toBeInTheDocument();
    });
  });

  it("loads settings from API", async () => {
    render(<SettingsPage />);
    await waitFor(() => {
      const thresholdInput = screen.getByLabelText("SMS & stop after N call occasions") as HTMLInputElement;
      expect(thresholdInput.value).toBe("3");
      const retryInput = screen.getByLabelText(/Retry.*after N days/) as HTMLInputElement;
      expect(retryInput.value).toBe("3");
      expect(screen.getByDisplayValue("Hi <first_name>, this is Hexa.")).toBeInTheDocument();
    });
  });

  it("shows variable badges", async () => {
    render(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getAllByText("<first_name>").length).toBeGreaterThan(0);
      expect(screen.getAllByText("<company_name>").length).toBeGreaterThan(0);
    });
    expect(screen.queryAllByText("<title>")).toHaveLength(0);
    expect(screen.queryAllByText("<website>")).toHaveLength(0);

    fireEvent.click(screen.getAllByRole("button", { name: /More/i })[0]);

    expect(screen.getAllByText("<title>").length).toBeGreaterThan(0);
    expect(screen.getAllByText("<website>").length).toBeGreaterThan(0);
  });

  it("renders password change section", async () => {
    render(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getByText("Change Password")).toBeInTheDocument();
      expect(screen.getByLabelText("Current Password")).toBeInTheDocument();
      expect(screen.getByLabelText("New Password")).toBeInTheDocument();
      expect(screen.getByLabelText("Confirm New Password")).toBeInTheDocument();
    });
  });

  it("validates password match", async () => {
    render(<SettingsPage />);

    await waitFor(() => screen.getByLabelText("Current Password"));

    fireEvent.change(screen.getByLabelText("Current Password"), {
      target: { value: "old" },
    });
    fireEvent.change(screen.getByLabelText("New Password"), {
      target: { value: "newpass" },
    });
    fireEvent.change(screen.getByLabelText("Confirm New Password"), {
      target: { value: "different" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update Password" }));

    await waitFor(() => {
      expect(screen.getByText("New passwords do not match.")).toBeInTheDocument();
    });
  });

  it("saves settings on click", async () => {
    mockApiFetch.mockImplementation(async (path: string, options?: RequestInit) => {
      if (path === "/settings" && options?.method === "PUT") {
        return { id: "s1", sms_call_threshold: 5, retry_days: 3, sms_template: "updated" };
      }
      if (path === "/settings") {
        return {
          id: "s1",
          sms_call_threshold: 3,
          retry_days: 3,
          sms_template: "Hi <first_name>, this is Hexa.",
          email_subject_didnt_pick_up: "",
          email_template_didnt_pick_up: "",
          email_subject_interested: "",
          email_template_interested: "",
        };
      }
      if (path === "/email/oauth/status") {
        return { connected: false, gmail_address: null };
      }
      return {};
    });

    render(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getByLabelText("SMS & stop after N call occasions")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Save preferences" }));

    await waitFor(() => {
      expect(screen.getByText("Saved")).toBeInTheDocument();
    });
  });
});
