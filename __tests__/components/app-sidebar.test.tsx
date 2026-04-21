import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.unmock("@/components/layout/app-sidebar");

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/contacts",
}));

import AppSidebar from "@/components/layout/app-sidebar";

const testUser = { id: "u1", email: "test@hexaagents.com", full_name: "Test User" };

describe("AppSidebar", () => {
  it("renders all nav items", () => {
    render(<AppSidebar user={testUser} />);
    expect(screen.getByText("Contacts")).toBeInTheDocument();
    expect(screen.getByText("Call Tracker")).toBeInTheDocument();
    expect(screen.getByText("Import")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("renders Hexa logo", () => {
    render(<AppSidebar user={testUser} />);
    expect(screen.getByText("Hexa")).toBeInTheDocument();
  });

  it("shows user name and email", () => {
    render(<AppSidebar user={testUser} />);
    expect(screen.getByText("Test User")).toBeInTheDocument();
    expect(screen.getByText("test@hexaagents.com")).toBeInTheDocument();
  });

  it("shows user initials in avatar", () => {
    render(<AppSidebar user={testUser} />);
    expect(screen.getByText("TU")).toBeInTheDocument();
  });

  it("renders sign out button", () => {
    render(<AppSidebar user={testUser} />);
    expect(screen.getByText("Sign out")).toBeInTheDocument();
  });

  it("handles sign out click", () => {
    render(<AppSidebar user={testUser} />);
    fireEvent.click(screen.getByText("Sign out"));
    expect(mockPush).toHaveBeenCalledWith("/login");
  });

  it("handles null user gracefully", () => {
    render(<AppSidebar user={null} />);
    expect(screen.getByText("User")).toBeInTheDocument();
    expect(screen.getByText("?")).toBeInTheDocument();
  });
});
