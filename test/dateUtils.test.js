import { afterEach, describe, expect, it, vi } from "vitest";
import {
  currentRiyadhMonthKey,
  formatRiyadhDateForInput,
  formatRiyadhDateTimeForInput,
  parseBusinessTimestamp,
  parseUserDate,
  riyadhDateKeyFromMonthOffset,
  riyadhMonthKeyFromOffset,
} from "@/utils/dateUtils";
import { hijriToGregorian } from "@/utils/hijri";

describe("Riyadh business dates", () => {
  afterEach(() => vi.useRealTimers());

  it("rolls the UTC instant into the correct Riyadh day", () => {
    const instant = "2026-06-22T21:30:00.000Z";
    expect(formatRiyadhDateForInput(instant)).toBe("2026-06-23");
    expect(formatRiyadhDateTimeForInput(instant)).toBe("2026-06-23T00:30");
  });

  it("interprets datetime-local values as Riyadh wall-clock", () => {
    expect(parseUserDate("2026-06-23T00:30").toISOString()).toBe(
      "2026-06-22T21:30:00.000Z",
    );
  });

  it("normalizes SQL timestamps without shifting the entered Riyadh time", () => {
    expect(parseBusinessTimestamp("2026-06-23T00:30")).toBe(
      "2026-06-23 00:30:00",
    );
  });

  it("uses Riyadh when UTC is still in the previous month", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-31T21:30:00.000Z"));
    expect(currentRiyadhMonthKey()).toBe("2026-02");
    expect(riyadhMonthKeyFromOffset(-1)).toBe("2026-01");
  });

  it("clamps month offsets to the target month's final day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-31T09:00:00.000Z"));
    expect(riyadhDateKeyFromMonthOffset(-1)).toBe("2026-02-28");
  });

  it("keeps the official historical Hijri conversion used by HR", () => {
    expect(hijriToGregorian(1416, 11, 16)).toBe("1996-04-04");
  });
});
