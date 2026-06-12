import { describe, it, expect, vi, afterEach } from "vitest";
import { upcomingSundayLocalISO, todayLocalISO } from "@/lib/utils";

describe("upcomingSundayLocalISO", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function setNow(isoLocal: string) {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(isoLocal));
  }

  it("returns the following Sunday from a mid-week day", () => {
    setNow("2026-06-10T09:00:00"); // Wednesday
    expect(upcomingSundayLocalISO()).toBe("2026-06-14");
  });

  it("returns the next day when today is Saturday", () => {
    setNow("2026-06-13T09:00:00"); // Saturday
    expect(upcomingSundayLocalISO()).toBe("2026-06-14");
  });

  it("returns today when today is Sunday (end of this week)", () => {
    setNow("2026-06-14T09:00:00"); // Sunday
    expect(upcomingSundayLocalISO()).toBe("2026-06-14");
    expect(upcomingSundayLocalISO()).toBe(todayLocalISO());
  });

  it("rolls over a month boundary", () => {
    setNow("2026-06-29T09:00:00"); // Monday
    expect(upcomingSundayLocalISO()).toBe("2026-07-05");
  });

  it("rolls over a year boundary", () => {
    setNow("2026-12-28T09:00:00"); // Monday
    expect(upcomingSundayLocalISO()).toBe("2027-01-03");
  });

  it("always lands on a Sunday", () => {
    setNow("2026-06-08T09:00:00"); // Monday
    for (let i = 0; i < 7; i++) {
      vi.setSystemTime(new Date(2026, 5, 8 + i, 9));
      const result = upcomingSundayLocalISO();
      expect(new Date(`${result}T12:00:00`).getDay()).toBe(0);
      expect(result >= todayLocalISO()).toBe(true);
    }
  });
});
