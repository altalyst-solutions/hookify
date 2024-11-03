import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Runs a clean after each test case
afterEach(() => {
  cleanup();
});
