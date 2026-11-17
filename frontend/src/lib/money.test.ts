import { describe, expect, it } from "vitest";
import { formatSatang, parseSatang } from "./money";

describe("parseSatang", () => {
  it.each([
    ["1000.00", 100000],
    ["10.5", 1050],
    ["10", 1000],
    ["0", 0],
    ["9999999999.99", 999999999999],
  ])("parses %s exactly", (value, expected) => {
    expect(parseSatang(value)).toBe(expected);
  });

  it.each([
    "10.005",
    "-10.00",
    "10000000000.00",
    "",
    "not money",
    "Infinity",
    "NaN",
  ])("rejects %s", (value) => {
    expect(parseSatang(value)).toBeNull();
  });
});

describe("formatSatang", () => {
  it.each([
    [100000, "1,000.00"],
    [1050, "10.50"],
    [0, "0.00"],
    [-1050, "-10.50"],
    [Number.MAX_SAFE_INTEGER, "90,071,992,547,409.91"],
  ])("formats %i satang as %s", (satang, expected) => {
    expect(formatSatang(satang)).toBe(expected);
  });
  it.each([1.5, Number.MAX_SAFE_INTEGER + 1])("rejects unsafe satang value %s", (satang) => {
    expect(() => formatSatang(satang)).toThrow(RangeError);
  });
});
