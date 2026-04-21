import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import HexaLogo from "@/components/layout/hexa-logo";

describe("HexaLogo", () => {
  it("renders the H letter", () => {
    render(<HexaLogo />);
    expect(screen.getByText("H")).toBeInTheDocument();
  });

  it("shows text when showText is true", () => {
    render(<HexaLogo showText />);
    expect(screen.getByText("Hexa")).toBeInTheDocument();
  });

  it("hides text when showText is false", () => {
    render(<HexaLogo />);
    expect(screen.queryByText("Hexa")).not.toBeInTheDocument();
  });

  it("applies custom text class", () => {
    render(<HexaLogo showText textClassName="text-white" />);
    const text = screen.getByText("Hexa");
    expect(text.className).toContain("text-white");
  });
});
