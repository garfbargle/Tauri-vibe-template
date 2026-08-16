import { describe, expect, it } from "vitest";
import { parseInsets } from "./platformGeometry";

describe("parseInsets", () => {
  it("accepts finite non-negative edge values", () => {
    expect(parseInsets({ top: 30.25, right: 0, bottom: 14.5, left: 0 })).toEqual({
      top: 30.25,
      right: 0,
      bottom: 14.5,
      left: 0,
    });
  });

  it("rejects incomplete, negative, and non-numeric values", () => {
    expect(parseInsets({ top: 1, right: 2, bottom: 3 })).toBeNull();
    expect(parseInsets({ top: -1, right: 0, bottom: 0, left: 0 })).toBeNull();
    expect(parseInsets({ top: "1", right: 0, bottom: 0, left: 0 })).toBeNull();
  });
});
