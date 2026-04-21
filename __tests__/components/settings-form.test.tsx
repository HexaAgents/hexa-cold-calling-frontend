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
          sms_template: "Hi <first_name>, this is Hexa.",
        };
      }
      return {};
    });
  });

  it("renders threshold and template inputs", async () => {
    render(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getByLabelText("Auto-SMS after N call occasions")).toBeInTheDocument();
      expect(screen.getByLabelText("SMS Template")).toBeInTheDocument();
    });
  });

  it("loads settings from API", async () => {
    render(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getByDisplayValue("3")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Hi <first_name>, this is Hexa.")).toBeInTheDocument();
    });
  });

  it("shows variable badges", async () => {
    render(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getByText("<first_name>")).toBeInTheDocument();
      expect(screen.getByText("<company_name>")).toBeInTheDocument();
      expect(screen.getByText("<title>")).toBeInTheDocument();
      expect(screen.getByText("<website>")).toBeInTheDocument();
    });
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
        return { id: "s1", sms_call_threshold: 5, sms_template: "updated" };
      }
      return { id: "s1", sms_call_threshold: 3, sms_template: "Hi <first_name>, this is Hexa." };
    });

    render(<SettingsPage />);
    await waitFor(() => screen.getByDisplayValue("3"));

    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));

    await waitFor(() => {
      expect(screen.getByText("Saved")).toBeInTheDocument();
    });
  });
});
