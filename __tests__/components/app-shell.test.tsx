import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AppShell from "@/components/layout/app-shell";
import type { User } from "@/types";

// AppSidebar is mocked in setup.tsx as <div data-testid="sidebar">, so these
// tests focus on the shell chrome itself: desktop sidebar slot, mobile header,
// and the slide-over drawer behavior.

const user: User = {
  id: "test-id",
  email: "test@hexaagents.com",
  full_name: "Test User",
};

describe("AppShell", () => {
  it("renders children inside the main area", () => {
    render(
      <AppShell user={user} title="Contacts">
        <p>Page content</p>
      </AppShell>
    );
    expect(screen.getByText("Page content")).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("shows the page title in the mobile header", () => {
    render(
      <AppShell user={user} title="Call Tracker">
        <div />
      </AppShell>
    );
    expect(screen.getByText("Call Tracker")).toBeInTheDocument();
  });

  it("renders the sidebar once until the drawer is opened", () => {
    render(
      <AppShell user={user}>
        <div />
      </AppShell>
    );
    // Desktop sidebar only (drawer closed).
    expect(screen.getAllByTestId("sidebar")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    // Desktop sidebar + drawer copy.
    expect(screen.getAllByTestId("sidebar")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Close menu" }));
    expect(screen.getAllByTestId("sidebar")).toHaveLength(1);
  });

  it("closes the drawer when the overlay is clicked", () => {
    const { container } = render(
      <AppShell user={user}>
        <div />
      </AppShell>
    );
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    expect(screen.getAllByTestId("sidebar")).toHaveLength(2);

    const overlay = container.querySelector(".bg-black\\/55");
    expect(overlay).not.toBeNull();
    fireEvent.click(overlay!);
    expect(screen.getAllByTestId("sidebar")).toHaveLength(1);
  });
});
