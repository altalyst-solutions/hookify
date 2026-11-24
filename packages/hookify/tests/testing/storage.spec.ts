import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createMemoryStorage,
  dispatchStorageEvent,
  installLocalStorage,
  installSessionStorage,
} from "@/testing";

describe("createMemoryStorage", () => {
  it("starts empty, or with the items it is given", () => {
    expect(createMemoryStorage().length).toBe(0);

    const storage = createMemoryStorage({ items: { a: "1", b: "2" } });
    expect(storage.length).toBe(2);
    expect(storage.getItem("a")).toBe("1");
  });

  it("reads a missing key as null, and stores values as strings", () => {
    const storage = createMemoryStorage();

    expect(storage.getItem("missing")).toBeNull();

    storage.setItem("n", 5 as unknown as string);
    expect(storage.getItem("n")).toBe("5");
  });

  it("replaces, removes and clears items", () => {
    const storage = createMemoryStorage({ items: { a: "1", b: "2" } });

    storage.setItem("a", "3");
    expect(storage.getItem("a")).toBe("3");
    expect(storage.length).toBe(2);

    storage.removeItem("a");
    storage.removeItem("never-there");
    expect(storage.getItem("a")).toBeNull();
    expect(storage.length).toBe(1);

    storage.clear();
    expect(storage.length).toBe(0);
  });

  it("lists keys in insertion order with key(index)", () => {
    const storage = createMemoryStorage({ items: { a: "1", b: "2" } });

    expect(storage.key(0)).toBe("a");
    expect(storage.key(1)).toBe("b");
    expect(storage.key(2)).toBeNull();
  });

  it("returns a copy of its items from snapshot", () => {
    const storage = createMemoryStorage({ items: { a: "1" } });

    const copy = storage.snapshot();
    storage.setItem("b", "2");

    expect(copy).toEqual({ a: "1" });
    expect(storage.snapshot()).toEqual({ a: "1", b: "2" });
  });

  it("keeps separate storages independent", () => {
    const first = createMemoryStorage();
    const second = createMemoryStorage();

    first.setItem("a", "1");

    expect(second.getItem("a")).toBeNull();
  });

  describe("quota", () => {
    it("throws a QuotaExceededError when a write goes past it", () => {
      const storage = createMemoryStorage({ quota: 5 });

      storage.setItem("a", "1234");
      expect(storage.getItem("a")).toBe("1234");

      expect(() => storage.setItem("b", "1")).toThrow(
        expect.objectContaining({ name: "QuotaExceededError" })
      );
      expect(storage.getItem("b")).toBeNull();
    });

    it("counts a replaced value once, so a smaller value always fits", () => {
      const storage = createMemoryStorage({ quota: 5 });
      storage.setItem("a", "1234");

      expect(() => storage.setItem("a", "5678")).not.toThrow();
      expect(() => storage.setItem("a", "12345")).toThrow();
      expect(storage.getItem("a")).toBe("5678");
    });

    it("makes every write fail with a quota of 0", () => {
      const storage = createMemoryStorage({ quota: 0 });

      expect(() => storage.setItem("a", "b")).toThrow(
        expect.objectContaining({ name: "QuotaExceededError" })
      );
    });
  });
});

describe("installLocalStorage and installSessionStorage", () => {
  const controllers: { restore: () => void }[] = [];

  afterEach(() => {
    controllers
      .splice(0)
      .reverse()
      .forEach((controller) => controller.restore());
  });

  it("puts an in-memory storage on the window, and restores the original", () => {
    const original = window.localStorage;

    const local = installLocalStorage();
    controllers.push(local);
    expect(window.localStorage).toBe(local.storage);
    expect(window.localStorage).not.toBe(original);

    local.restore();
    expect(window.localStorage).toBe(original);
  });

  it("does nothing when restore is called twice", () => {
    const first = installLocalStorage();
    first.restore();
    const second = installLocalStorage();
    controllers.push(second);

    first.restore();

    expect(window.localStorage).toBe(second.storage);
  });

  it("uses the storage it is given", () => {
    const storage = createMemoryStorage({ items: { a: "1" } });
    controllers.push(installLocalStorage({ storage }));

    expect(window.localStorage).toBe(storage);
    expect(localStorage.getItem("a")).toBe("1");
  });

  it("installs sessionStorage separately from localStorage", () => {
    const original = window.localStorage;
    const session = installSessionStorage();
    controllers.push(session);

    expect(window.sessionStorage).toBe(session.storage);
    expect(window.localStorage).toBe(original);

    session.restore();
    expect(window.sessionStorage).not.toBe(session.storage);
  });

  it("throws a SecurityError when it is blocked", () => {
    controllers.push(installLocalStorage({ blocked: true }));

    expect(() => window.localStorage).toThrow(
      expect.objectContaining({ name: "SecurityError" })
    );
  });
});

describe("dispatchStorageEvent", () => {
  /** Collects the storage events fired on the window. */
  const listen = () => {
    const events: StorageEvent[] = [];
    const listener = (event: Event) => events.push(event as StorageEvent);
    window.addEventListener("storage", listener);
    controllers.push({
      restore: () => window.removeEventListener("storage", listener),
    });
    return events;
  };
  const controllers: { restore: () => void }[] = [];

  afterEach(() => {
    controllers.splice(0).forEach((controller) => controller.restore());
  });

  it("sets the key, then fires an event with the old and new value", () => {
    const events = listen();
    const storage = createMemoryStorage({ items: { theme: "light" } });

    dispatchStorageEvent("theme", "dark", storage);

    expect(storage.getItem("theme")).toBe("dark");
    expect(events).toHaveLength(1);
    expect(events[0].key).toBe("theme");
    expect(events[0].oldValue).toBe("light");
    expect(events[0].newValue).toBe("dark");
    expect(events[0].storageArea).toBe(storage);
    expect(events[0].url).toBe(window.location.href);
  });

  it("removes the key when the new value is null", () => {
    const events = listen();
    const storage = createMemoryStorage({ items: { theme: "light" } });

    dispatchStorageEvent("theme", null, storage);

    expect(storage.getItem("theme")).toBeNull();
    expect(events[0].oldValue).toBe("light");
    expect(events[0].newValue).toBeNull();
  });

  it("clears the storage when the key is null", () => {
    const events = listen();
    const storage = createMemoryStorage({ items: { a: "1", b: "2" } });

    dispatchStorageEvent(null, null, storage);

    expect(storage.length).toBe(0);
    expect(events[0].key).toBeNull();
    expect(events[0].oldValue).toBeNull();
  });

  it("only fires the event when no storage is given", () => {
    const events = listen();

    dispatchStorageEvent("theme", "dark");

    expect(events[0].key).toBe("theme");
    expect(events[0].newValue).toBe("dark");
    expect(events[0].storageArea).toBeNull();
    expect(events[0].oldValue).toBeNull();
  });

  it("reaches listeners that were added to the window", () => {
    const listener = vi.fn();
    window.addEventListener("storage", listener);
    controllers.push({
      restore: () => window.removeEventListener("storage", listener),
    });

    dispatchStorageEvent("a", "1", createMemoryStorage());

    expect(listener).toHaveBeenCalledTimes(1);
  });
});
