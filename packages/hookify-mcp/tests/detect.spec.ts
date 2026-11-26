import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { hooksData } from "../src/data.ts";
import { DETECTORS, detectPatterns } from "../src/detect/index.ts";

/** The docs site's demo components, which are real code written with hookify. */
const EXAMPLES_DIR = resolve(
  import.meta.dirname,
  "../../../docs-site/src/hook-examples"
);

/** The pattern, hook and confidence of each finding, which is what most tests check. */
type Summary = [pattern: string, hook: string, confidence: string];

/**
 * Runs the detectors on a TSX file.
 *
 * @param code - The source.
 * @param filename - The file name, which decides how it is parsed.
 * @returns The pattern, hook and confidence of every finding.
 */
const summarize = (code: string, filename = "Fixture.tsx"): Summary[] =>
  detectPatterns(code, { filename }).findings.map(
    ({ pattern, hook, confidence }) => [pattern, hook, confidence]
  );

/** A code sample and what the detectors should make of it. */
interface Sample {
  /** What makes the sample interesting. */
  name: string;
  /** The source. */
  code: string;
}

/** A sample with the findings it should produce. */
interface Positive extends Sample {
  /** The expected pattern, hook and confidence of each finding. */
  expected: Summary[];
}

/** Samples for one detector. */
interface Fixtures {
  /** Code the detector should report, with exactly what it should say. */
  positive: Positive[];
  /** Code that looks similar but must not be reported at all. */
  negative: Sample[];
}

/** Positive and negative samples for every detector, by pattern. */
const FIXTURES: Record<string, Fixtures> = {
  "event-listener-in-effect": {
    positive: [
      {
        name: "a window listener removed in the cleanup",
        code: `
          useEffect(() => {
            const onResize = () => setWidth(window.innerWidth);
            window.addEventListener("resize", onResize);
            return () => window.removeEventListener("resize", onResize);
          }, []);`,
        expected: [["event-listener-in-effect", "useEventListener", "high"]],
      },
      {
        name: "an element read from a ref",
        code: `
          useEffect(() => {
            const node = ref.current;
            if (!node) return;
            node.addEventListener("scroll", onScroll, { passive: true });
            return () => node.removeEventListener("scroll", onScroll);
          }, [onScroll]);`,
        expected: [["event-listener-in-effect", "useEventListener", "high"]],
      },
      {
        name: "a listener that is never removed",
        code: `
          useEffect(() => {
            document.addEventListener("keydown", onKey);
          }, []);`,
        expected: [["event-listener-in-effect", "useEventListener", "medium"]],
      },
      {
        name: "a layout effect through React",
        code: `
          React.useLayoutEffect(() => {
            window.addEventListener("scroll", onScroll);
            return () => window.removeEventListener("scroll", onScroll);
          });`,
        expected: [["event-listener-in-effect", "useEventListener", "high"]],
      },
    ],
    negative: [
      {
        name: "a socket the effect creates itself",
        code: `
          useEffect(() => {
            const socket = new WebSocket(url);
            socket.addEventListener("message", onMessage);
            return () => socket.close();
          }, [url]);`,
      },
      {
        name: "an element the effect creates itself",
        code: `
          useEffect(() => {
            const script = document.createElement("script");
            script.addEventListener("load", onLoad);
            document.body.append(script);
          }, []);`,
      },
      {
        name: "a listener added outside an effect",
        code: `
          const subscribe = () => window.addEventListener("resize", onResize);
          window.addEventListener("online", onOnline);`,
      },
      {
        name: "an effect without listeners",
        code: `
          useEffect(() => {
            document.title = title;
          }, [title]);`,
      },
      {
        name: "a function that only looks like an effect",
        code: `
          const useEffect = (fn) => fn;
          useEffect("not a function");`,
      },
    ],
  },

  "interval-in-effect": {
    positive: [
      {
        name: "an interval cleared in the cleanup",
        code: `
          useEffect(() => {
            const id = setInterval(() => setSeconds((s) => s + 1), 1000);
            return () => clearInterval(id);
          }, []);`,
        expected: [["interval-in-effect", "useInterval", "high"]],
      },
      {
        name: "window.setInterval with a returned named cleanup",
        code: `
          useEffect(() => {
            const id = window.setInterval(poll, 5000);
            function stop() { window.clearInterval(id); }
            return stop;
          }, [poll]);`,
        expected: [["interval-in-effect", "useInterval", "high"]],
      },
      {
        name: "an interval that is never cleared",
        code: `
          useEffect(() => {
            setInterval(tick, 1000);
          }, []);`,
        expected: [["interval-in-effect", "useInterval", "medium"]],
      },
    ],
    negative: [
      {
        name: "an interval started from an event handler",
        code: `
          const start = () => { timer.current = setInterval(tick, 1000); };`,
      },
      {
        name: "a timeout in an effect",
        code: `
          useEffect(() => {
            const id = setTimeout(done, 1000);
            return () => clearTimeout(id);
          }, []);`,
      },
      {
        name: "setInterval on another object",
        code: `
          useEffect(() => {
            const id = timers.setInterval(tick, 1000);
            return () => timers.clearInterval(id);
          }, []);`,
      },
    ],
  },

  "intersection-observer-in-effect": {
    positive: [
      {
        name: "an observer disconnected in the cleanup",
        code: `
          useEffect(() => {
            const observer = new IntersectionObserver(([entry]) => {
              setVisible(entry.isIntersecting);
            }, { threshold: 0.5 });
            observer.observe(ref.current);
            return () => observer.disconnect();
          }, []);`,
        expected: [
          [
            "intersection-observer-in-effect",
            "useIntersectionObserver",
            "high",
          ],
        ],
      },
      {
        name: "an observer that is never disconnected",
        code: `
          useEffect(() => {
            const observer = new window.IntersectionObserver(onChange);
            observer.observe(node);
          }, []);`,
        expected: [
          [
            "intersection-observer-in-effect",
            "useIntersectionObserver",
            "medium",
          ],
        ],
      },
    ],
    negative: [
      {
        name: "an observer that watches every item",
        code: `
          useEffect(() => {
            const observer = new IntersectionObserver(onChange);
            items.forEach((item) => observer.observe(item));
            return () => observer.disconnect();
          }, [items]);`,
      },
      {
        name: "an observer that watches in a loop",
        code: `
          useEffect(() => {
            const observer = new IntersectionObserver(onChange);
            for (const node of nodes) observer.observe(node);
            return () => observer.disconnect();
          }, [nodes]);`,
      },
      {
        name: "an observer that watches nothing",
        code: `
          useEffect(() => {
            const observer = new IntersectionObserver(onChange);
            return () => observer.disconnect();
          }, []);`,
      },
      {
        name: "an observer created outside an effect",
        code: `
          const observer = new IntersectionObserver(onChange);
          observer.observe(node);`,
      },
    ],
  },

  "resize-observer-in-effect": {
    positive: [
      {
        name: "a callback that reads the size",
        code: `
          useEffect(() => {
            const observer = new ResizeObserver(([entry]) => {
              setSize({
                width: entry.contentRect.width,
                height: entry.contentRect.height,
              });
            });
            observer.observe(ref.current);
            return () => observer.disconnect();
          }, []);`,
        expected: [["resize-observer-in-effect", "useElementSize", "high"]],
      },
      {
        name: "a callback that reacts to the resize",
        code: `
          useEffect(() => {
            const observer = new ResizeObserver(() => onResize());
            observer.observe(ref.current);
            return () => observer.unobserve(ref.current);
          }, [onResize]);`,
        expected: [["resize-observer-in-effect", "useResizeObserver", "high"]],
      },
      {
        name: "an observer that is never disconnected",
        code: `
          useEffect(() => {
            const observer = new ResizeObserver(() => onResize());
            observer.observe(ref.current);
          }, []);`,
        expected: [
          ["resize-observer-in-effect", "useResizeObserver", "medium"],
        ],
      },
    ],
    negative: [
      {
        name: "an observer that watches several elements",
        code: `
          useEffect(() => {
            const observer = new ResizeObserver(onResize);
            elements.map((element) => observer.observe(element));
            return () => observer.disconnect();
          }, [elements]);`,
      },
      {
        name: "an observer created outside an effect",
        code: `
          const observer = new ResizeObserver(onResize);
          observer.observe(node);`,
      },
    ],
  },

  "match-media-listener": {
    positive: [
      {
        name: "a query list with a change listener in an effect",
        code: `
          useEffect(() => {
            const query = window.matchMedia("(min-width: 600px)");
            const onChange = () => setWide(query.matches);
            query.addEventListener("change", onChange);
            return () => query.removeEventListener("change", onChange);
          }, []);`,
        expected: [["match-media-listener", "useMediaQuery", "high"]],
      },
      {
        name: "the deprecated addListener, called on the result",
        code: `
          useEffect(() => {
            matchMedia("(prefers-color-scheme: dark)").addListener(onChange);
          }, []);`,
        expected: [["match-media-listener", "useMediaQuery", "high"]],
      },
      {
        name: "onchange",
        code: `
          const query = window.matchMedia("(max-width: 400px)");
          query.onchange = (event) => setNarrow(event.matches);`,
        expected: [["match-media-listener", "useMediaQuery", "high"]],
      },
    ],
    negative: [
      {
        name: "a one-time read",
        code: `
          const [wide] = useState(() => window.matchMedia("(min-width: 600px)").matches);`,
      },
      {
        name: "a query list that is stored but not subscribed to",
        code: `
          const query = window.matchMedia("(min-width: 600px)");
          const wide = query.matches;`,
      },
      {
        name: "a listener on something else",
        code: `
          const query = window.matchMedia("(min-width: 600px)");
          other.addEventListener("change", onChange);`,
      },
    ],
  },

  "storage-mirrored-state": {
    positive: [
      {
        name: "state read from storage and written back in an effect",
        code: `
          const Settings = () => {
            const [theme, setTheme] = useState(() =>
              JSON.parse(localStorage.getItem("theme") ?? '"light"')
            );
            useEffect(() => {
              localStorage.setItem("theme", JSON.stringify(theme));
            }, [theme]);
            return null;
          };`,
        expected: [["storage-mirrored-state", "usePersistedState", "high"]],
      },
      {
        name: "state read in one effect and written in another",
        code: `
          function Draft() {
            const [text, setText] = useState("");
            useEffect(() => {
              setText(window.sessionStorage.getItem("draft") ?? "");
            }, []);
            useEffect(() => {
              window.sessionStorage.setItem("draft", text);
            }, [text]);
            return null;
          }`,
        expected: [["storage-mirrored-state", "usePersistedState", "high"]],
      },
      {
        name: "state written to storage with the read somewhere else",
        code: `
          const Counter = () => {
            const [count, setCount] = useState(readCount());
            useEffect(() => {
              localStorage.setItem("count", String(count));
            }, [count]);
            return null;
          };`,
        expected: [["storage-mirrored-state", "usePersistedState", "medium"]],
      },
    ],
    negative: [
      {
        name: "a read that initializes state and is never written back",
        code: `
          const Banner = () => {
            const [dismissed] = useState(() => localStorage.getItem("banner") === "1");
            return dismissed ? null : "banner";
          };`,
      },
      {
        name: "a write that doesn't depend on state",
        code: `
          const Visit = () => {
            const [count, setCount] = useState(0);
            useEffect(() => {
              localStorage.setItem("visited", "1");
            }, []);
            return null;
          };`,
      },
      {
        name: "a write in a component with no state",
        code: `
          const Visit = ({ value }) => {
            useEffect(() => {
              localStorage.setItem("value", value);
            }, [value]);
            return null;
          };`,
      },
      {
        name: "another object with the same method",
        code: `
          const Cache = () => {
            const [value, setValue] = useState(0);
            useEffect(() => {
              cache.setItem("value", value);
            }, [value]);
            return null;
          };`,
      },
    ],
  },

  "debounced-value-in-effect": {
    positive: [
      {
        name: "a value copied to state after a delay",
        code: `
          useEffect(() => {
            const timer = setTimeout(() => setDebounced(query), 300);
            return () => clearTimeout(timer);
          }, [query]);`,
        expected: [["debounced-value-in-effect", "useDebouncedValue", "high"]],
      },
      {
        name: "a request sent after a delay",
        code: `
          useEffect(() => {
            const timer = setTimeout(() => search(query), 300);
            return () => clearTimeout(timer);
          }, [query]);`,
        expected: [
          ["debounced-value-in-effect", "useDebouncedValue", "medium"],
        ],
      },
    ],
    negative: [
      {
        name: "a message that hides itself",
        code: `
          useEffect(() => {
            const timer = setTimeout(() => setVisible(false), 3000);
            return () => clearTimeout(timer);
          }, [visible]);`,
      },
      {
        name: "a countdown that schedules its own next tick",
        code: `
          useEffect(() => {
            if (remaining <= 0) return;
            const timer = setTimeout(() => setRemaining(remaining - 1), 1000);
            return () => clearTimeout(timer);
          }, [remaining]);`,
      },
      {
        name: "a timer that runs once on mount",
        code: `
          useEffect(() => {
            const timer = setTimeout(() => setReady(initial), 100);
            return () => clearTimeout(timer);
          }, []);`,
      },
      {
        name: "a timer with no cleanup",
        code: `
          useEffect(() => {
            setTimeout(() => setDebounced(query), 300);
          }, [query]);`,
      },
    ],
  },

  "debounced-callback": {
    positive: [
      {
        name: "a timer kept in a ref",
        code: `
          const Search = () => {
            const timer = useRef();
            const onChange = (event) => {
              clearTimeout(timer.current);
              timer.current = setTimeout(() => search(event.target.value), 300);
            };
            return null;
          };`,
        expected: [["debounced-callback", "useDebouncedCallback", "high"]],
      },
      {
        name: "a debounce utility",
        code: `
          export const debounce = (fn, delay) => {
            let timer;
            return (...args) => {
              clearTimeout(timer);
              timer = setTimeout(() => fn(...args), delay);
            };
          };`,
        expected: [["debounced-callback", "useDebouncedCallback", "high"]],
      },
    ],
    negative: [
      {
        name: "a timer cleared in an effect cleanup",
        code: `
          useEffect(() => {
            const timer = setTimeout(done, 1000);
            return () => clearTimeout(timer);
          }, []);`,
      },
      {
        name: "a timer that is never cleared first",
        code: `
          const later = () => {
            timer = setTimeout(done, 1000);
          };`,
      },
      {
        name: "a timer cleared in a different function than the one that starts it",
        code: `
          const start = () => { timer = setTimeout(done, 1000); };
          const stop = () => { clearTimeout(timer); };`,
      },
      {
        name: "a timer cleared after it is started",
        code: `
          const restart = () => {
            timer = setTimeout(done, 1000);
            clearTimeout(timer);
          };`,
      },
    ],
  },

  "throttled-callback": {
    positive: [
      {
        name: "the time of the last call kept in a ref",
        code: `
          const Scroll = () => {
            const last = useRef(0);
            const onScroll = () => {
              const now = Date.now();
              if (now - last.current >= 100) {
                last.current = now;
                update();
              }
            };
            return null;
          };`,
        expected: [["throttled-callback", "useRateLimitedCallback", "medium"]],
      },
      {
        name: "a throttle utility",
        code: `
          export const throttle = (fn, wait) => {
            let lastCall = 0;
            return (...args) => {
              if (Date.now() - lastCall < wait) return;
              lastCall = Date.now();
              fn(...args);
            };
          };`,
        expected: [["throttled-callback", "useRateLimitedCallback", "medium"]],
      },
    ],
    negative: [
      {
        name: "a timeout loop that measures elapsed time",
        code: `
          const waitFor = async (check, timeout) => {
            const start = Date.now();
            while (Date.now() - start < timeout) {
              if (await check()) return true;
            }
            return false;
          };`,
      },
      {
        name: "reading the clock without comparing it",
        code: `
          const stamp = () => {
            last.current = Date.now();
          };`,
      },
      {
        name: "comparing times without recording the last call",
        code: `
          const expired = (start) => Date.now() - start > 1000;`,
      },
    ],
  },

  "previous-value-ref": {
    positive: [
      {
        name: "the classic usePrevious",
        code: `
          const usePrev = (value) => {
            const ref = useRef();
            useEffect(() => {
              ref.current = value;
            });
            return ref.current;
          };`,
        expected: [["previous-value-ref", "usePrevious", "high"]],
      },
      {
        name: "an arrow effect that stores a prop",
        code: `
          const Counter = ({ count }) => {
            const previous = useRef(count);
            useEffect(() => (previous.current = count), [count]);
            return <p>{count > previous.current ? "up" : "down"}</p>;
          };`,
        expected: [["previous-value-ref", "usePrevious", "high"]],
      },
      {
        name: "an effect that does more than store the value",
        code: `
          const Counter = ({ count }) => {
            const previous = useRef(count);
            useEffect(() => {
              track(count);
              previous.current = count;
            }, [count]);
            return <p>{previous.current}</p>;
          };`,
        expected: [["previous-value-ref", "usePrevious", "medium"]],
      },
    ],
    negative: [
      {
        name: "a ref that holds the latest callback for timers",
        code: `
          const Poller = ({ onTick }) => {
            const latest = useRef(onTick);
            useEffect(() => {
              latest.current = onTick;
            });
            const handle = () => latest.current();
            return <button onClick={handle} />;
          };`,
      },
      {
        name: "a ref that is only assigned a constant",
        code: `
          const Flag = () => {
            const seen = useRef(false);
            useEffect(() => {
              seen.current = true;
            });
            return <p>{String(seen.current)}</p>;
          };`,
      },
      {
        name: "a ref that is never read while rendering",
        code: `
          const Log = ({ value }) => {
            const last = useRef(value);
            useEffect(() => {
              last.current = value;
            });
            useEffect(() => () => save(last.current), []);
            return null;
          };`,
      },
    ],
  },

  "mounted-ref": {
    positive: [
      {
        name: "a ref set to true and back to false",
        code: `
          const Widget = () => {
            const mounted = useRef(false);
            useEffect(() => {
              mounted.current = true;
              return () => {
                mounted.current = false;
              };
            }, []);
            return null;
          };`,
        expected: [["mounted-ref", "useMounted", "high"]],
      },
      {
        name: "a ref that starts true and is cleared on unmount",
        code: `
          const Widget = () => {
            const isMounted = useRef(true);
            useEffect(() => () => {
              isMounted.current = false;
            }, []);
            return null;
          };`,
        expected: [["mounted-ref", "useMounted", "medium"]],
      },
    ],
    negative: [
      {
        name: "a ref that skips the first run of an effect",
        code: `
          const Widget = ({ value }) => {
            const first = useRef(true);
            useEffect(() => {
              if (first.current) {
                first.current = false;
                return;
              }
              save(value);
            }, [value]);
            return null;
          };`,
      },
      {
        name: "a ref set to true that is never cleared",
        code: `
          const Widget = () => {
            const ready = useRef(false);
            useEffect(() => {
              ready.current = true;
            }, []);
            return null;
          };`,
      },
      {
        name: "a ref that starts false and is only cleared",
        code: `
          const Widget = () => {
            const flag = useRef(false);
            useEffect(() => () => {
              flag.current = false;
            }, []);
            return null;
          };`,
      },
    ],
  },
};

describe("detectors", () => {
  it("has fixtures for every detector and no others", () => {
    expect(Object.keys(FIXTURES).sort()).toEqual(
      DETECTORS.map((detector) => detector.pattern).sort()
    );
  });

  for (const [pattern, { positive, negative }] of Object.entries(FIXTURES)) {
    describe(pattern, () => {
      it("has at least one positive and one negative fixture", () => {
        expect(positive.length).toBeGreaterThan(0);
        expect(negative.length).toBeGreaterThan(0);
      });

      for (const sample of positive) {
        it(`reports ${sample.name}`, () => {
          expect(summarize(sample.code)).toEqual(sample.expected);
        });
      }

      for (const sample of negative) {
        it(`ignores ${sample.name}`, () => {
          expect(summarize(sample.code)).toEqual([]);
        });
      }
    });
  }
});

describe("detector output", () => {
  const hookNames = new Set(hooksData.hooks.map((hook) => hook.name));

  it("only suggests hooks that exist and aren't deprecated", () => {
    for (const detector of DETECTORS) {
      for (const name of detector.hooks) {
        const hook = hooksData.hooks.find((entry) => entry.name === name);
        expect(hookNames.has(name), `${detector.pattern}: ${name}`).toBe(true);
        expect(
          hook?.deprecated,
          `${detector.pattern}: ${name}`
        ).toBeUndefined();
      }
    }
  });

  it("reports only the hooks a detector declares", () => {
    for (const [pattern, { positive }] of Object.entries(FIXTURES)) {
      const detector = DETECTORS.find((entry) => entry.pattern === pattern);
      for (const sample of positive) {
        for (const [, hook] of sample.expected) {
          expect(detector?.hooks, `${pattern}: ${sample.name}`).toContain(hook);
        }
      }
    }
  });

  it("gives every finding a one-sentence reason that names its hook", () => {
    for (const { positive } of Object.values(FIXTURES)) {
      for (const sample of positive) {
        for (const finding of detectPatterns(sample.code, {
          filename: "Fixture.tsx",
        }).findings) {
          expect(finding.reason).not.toContain("\n");
          expect(finding.reason).toContain(finding.hook);
        }
      }
    }
  });

  it("points at the code to replace, counting lines and columns from 1 and ending just after the last character", () => {
    const code = [
      "const A = () => {",
      "  useEffect(() => {",
      "    const id = setInterval(tick, 1000);",
      "    return () => clearInterval(id);",
      "  }, []);",
      "};",
    ].join("\n");

    const [finding] = detectPatterns(code).findings;
    expect(finding.range).toEqual({
      start: { line: 2, column: 3 },
      end: { line: 5, column: 9 },
    });
  });

  it("orders findings by position and keeps several in one file", () => {
    const code = `
      const Panel = ({ query }) => {
        const [debounced, setDebounced] = useState(query);
        const [theme, setTheme] = useState(() => localStorage.getItem("theme"));
        const previous = useRef();
        useEffect(() => {
          previous.current = query;
        });
        useEffect(() => {
          const timer = setTimeout(() => setDebounced(query), 300);
          return () => clearTimeout(timer);
        }, [query]);
        useEffect(() => {
          localStorage.setItem("theme", theme);
        }, [theme]);
        useEffect(() => {
          const id = setInterval(tick, 1000);
          return () => clearInterval(id);
        }, []);
        useEffect(() => {
          window.addEventListener("resize", onResize);
          return () => window.removeEventListener("resize", onResize);
        }, []);
        return <p>{previous.current}</p>;
      };`;

    const { findings } = detectPatterns(code, { filename: "Panel.tsx" });
    expect(findings.map((finding) => finding.pattern)).toEqual([
      "previous-value-ref",
      "debounced-value-in-effect",
      "storage-mirrored-state",
      "interval-in-effect",
      "event-listener-in-effect",
    ]);
    const lines = findings.map((finding) => finding.range.start.line);
    expect(lines).toEqual([...lines].sort((a, b) => a - b));
  });

  it("finds nothing in code that uses the hooks instead", () => {
    const code = `
      import {
        useDebouncedValue,
        useEventListener,
        useInterval,
        useMediaQuery,
        usePersistedState,
        usePrevious,
      } from "@altalyst/hookify";

      export const Panel = ({ query }) => {
        const debounced = useDebouncedValue(query, 300);
        const previous = usePrevious(query);
        const wide = useMediaQuery("(min-width: 600px)");
        const [theme, setTheme] = usePersistedState("theme", "light");
        useEventListener("resize", onResize);
        useInterval(tick, 1000);
        return <p>{debounced}{previous}{String(wide)}{theme}</p>;
      };`;
    expect(summarize(code)).toEqual([]);
  });
});

describe("parsing", () => {
  it("accepts a fragment without a file name, with or without JSX", () => {
    const effect = `
      useEffect(() => {
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
      }, []);`;

    expect(detectPatterns(effect).findings).toHaveLength(1);
    expect(
      detectPatterns(`const x = <T,>(value: T) => value; ${effect}`).findings
    ).toHaveLength(1);
    expect(
      detectPatterns(`const x = <string>value; ${effect}`).findings
    ).toHaveLength(1);
  });

  it("treats .ts files as TypeScript without JSX", () => {
    const code = `
      export const useTick = (tick: () => void) => {
        useEffect(() => {
          const id = setInterval(tick, 1000);
          return () => clearInterval(id);
        }, [tick]);
        return <number>count;
      };`;
    expect(summarize(code, "use-tick.ts")).toEqual([
      ["interval-in-effect", "useInterval", "high"],
    ]);
  });

  it("parses JSX in .jsx and .js files", () => {
    const code = `
      export const Tick = () => {
        useEffect(() => {
          const id = setInterval(tick, 1000);
          return () => clearInterval(id);
        }, []);
        return <p>tick</p>;
      };`;
    expect(summarize(code, "Tick.jsx")).toHaveLength(1);
    expect(summarize(code, "Tick.js")).toHaveLength(1);
  });

  it("reports code that can't be parsed instead of throwing", () => {
    const result = detectPatterns("const = ;;; {{{", {
      filename: "Broken.tsx",
    });
    expect(result.findings).toEqual([]);
    expect(result.parseError).toEqual(expect.any(String));
    expect(result.parseError).not.toBe("");
  });

  it("returns no findings and no error for empty code", () => {
    expect(detectPatterns("")).toEqual({ findings: [] });
  });

  it("still analyzes code with a recoverable syntax error", () => {
    const code = `
      let x = 1;
      let x = 2;
      useEffect(() => {
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
      }, []);`;
    expect(detectPatterns(code).findings).toHaveLength(1);
  });

  it("reports code nested too deeply to analyze", () => {
    const depth = 20_000;
    const code = `const x = ${"[".repeat(depth)}${"]".repeat(depth)};`;
    const result = detectPatterns(code);
    expect(result.findings).toEqual([]);
    expect(result.parseError).toEqual(expect.any(String));
  });
});

describe("hookify's own demos", () => {
  /**
   * Lists the source files under a directory.
   *
   * @param directory - Where to look.
   * @returns The paths of the `.ts` and `.tsx` files.
   */
  const sourceFiles = (directory: string): string[] =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory()
        ? sourceFiles(join(directory, entry.name))
        : /\.tsx?$/.test(entry.name)
          ? [join(directory, entry.name)]
          : []
    );

  /**
   * Demos that hand-write a `setInterval` on purpose: they show how another
   * hook (`useLatest`, `useStableCallback`, `useDocVisible`, `useFrecency`)
   * behaves inside a timer. The suggestion to use `useInterval` is correct for
   * them, so they are listed here rather than treated as noise. Any other
   * finding in a demo needs a look.
   */
  const KNOWN_INTERVALS = [
    "use-doc-visible/ApiPoller.tsx",
    "use-doc-visible/CountdownTimer.tsx",
    "use-doc-visible/EngagementTracker.tsx",
    "use-frecency/LiveDecay.tsx",
    "use-latest/IntervalLogger.tsx",
    "use-stable-callback/SubscribeOnce.tsx",
  ];

  it("only finds the demos that hand-write an interval on purpose", () => {
    const files = sourceFiles(EXAMPLES_DIR);
    expect(files.length).toBeGreaterThan(50);

    const found: [file: string, pattern: string][] = [];
    for (const file of files) {
      const result = detectPatterns(readFileSync(file, "utf8"), {
        filename: file,
      });
      expect(result.parseError, file).toBeUndefined();
      for (const finding of result.findings) {
        found.push([relative(EXAMPLES_DIR, file), finding.pattern]);
      }
    }

    expect(found).toEqual(
      KNOWN_INTERVALS.map((file) => [file, "interval-in-effect"])
    );
  });
});
