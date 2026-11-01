---
"@altalyst/hookify": minor
---

Add `useResizeObserver`, a low-level `ResizeObserver` hook that runs a callback with the raw `ResizeObserverEntry` whenever an element is resized. It exposes a stable callback `ref` that also works with conditionally rendered elements, never re-renders on its own, always calls the latest callback without re-observing, supports any observed `box` (including `device-pixel-content-box`), can be paused with `enabled: false`, and is safe to use during server rendering.
