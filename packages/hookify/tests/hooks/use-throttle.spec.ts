import { describe, expect, it } from "vitest";

import { useThrottle, useThrottledValue } from "@/hooks";

describe("useThrottle (deprecated)", () => {
  it("is an alias of useThrottledValue", () => {
    expect(useThrottle).toBe(useThrottledValue);
  });
});
