import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * `isDevelopment` is computed once, when the module is first imported, from
 * `process.env.NODE_ENV`. Each test sets the environment and then imports a
 * fresh copy of the module, so both modes can be tested in one file.
 */
const importDevWarnings = async (nodeEnv: string) => {
  vi.stubEnv("NODE_ENV", nodeEnv);
  vi.resetModules();
  return import("@/utils/dev-warnings");
};

describe("dev-warnings", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe("in development", () => {
    it("reports development mode", async () => {
      const { isDevelopment } = await importDevWarnings("development");

      expect(isDevelopment).toBe(true);
    });

    it("treats an unset NODE_ENV as development", async () => {
      vi.stubEnv("NODE_ENV", undefined);
      vi.resetModules();
      const { isDevelopment } = await import("@/utils/dev-warnings");

      expect(isDevelopment).toBe(true);
    });

    it("warnInDevelopment logs the message with console.warn", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const { warnInDevelopment } = await importDevWarnings("development");

      warnInDevelopment("Careful");

      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith("Careful");
    });

    it("errorInDevelopment logs the message with console.error", async () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      const { errorInDevelopment } = await importDevWarnings("development");

      errorInDevelopment("Broken");

      expect(error).toHaveBeenCalledTimes(1);
      expect(error).toHaveBeenCalledWith("Broken");
    });
  });

  describe("in production", () => {
    it("reports production mode", async () => {
      const { isDevelopment } = await importDevWarnings("production");

      expect(isDevelopment).toBe(false);
    });

    it("warnInDevelopment does not log", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const { warnInDevelopment } = await importDevWarnings("production");

      warnInDevelopment("Careful");

      expect(warn).not.toHaveBeenCalled();
    });

    it("errorInDevelopment does not log", async () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      const { errorInDevelopment } = await importDevWarnings("production");

      errorInDevelopment("Broken");

      expect(error).not.toHaveBeenCalled();
    });
  });
});
