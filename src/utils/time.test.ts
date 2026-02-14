import { describe, expect, it } from "vitest";
import { parseTimeToServiceDayMinutes, toServiceDayMinutes } from "./time";

describe("time utils", () => {
  it("treats 04:00 as service-day zero", () => {
    expect(toServiceDayMinutes(4, 0)).toBe(0);
  });

  it("maps early morning (e.g. 03:59) to end of previous service day", () => {
    expect(toServiceDayMinutes(3, 59)).toBe(1439);
  });

  it("maps daytime consistently", () => {
    expect(toServiceDayMinutes(16, 0)).toBe(720);
  });

  it("parses HH:mm string", () => {
    expect(parseTimeToServiceDayMinutes("16:00")).toBe(720);
  });

  it("returns null for invalid time", () => {
    expect(parseTimeToServiceDayMinutes("xx:yy")).toBeNull();
  });
});
