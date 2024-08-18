import { useApi } from "@/hooks";
import { expect, test } from "vitest";

test("return default value", () => {
  expect(useApi()).toBe("useApi called");
});
