---
"@altalyst/hookify": minor
---

Add `useElementSize`, a `ResizeObserver`-based hook that returns an element's `width` and `height` as state. It exposes a stable callback `ref` that also works with conditionally rendered elements, re-renders only when the size changes, supports `content-box` and `border-box` measurement, an `onResize` callback with the raw `ResizeObserverEntry`, and a `defaultSize` for server rendering.
