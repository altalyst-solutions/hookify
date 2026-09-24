---
sidebar_position: 1
slug: /getting-started
---

# Getting Started

Hookify is a lightweight collection of framework-agnostic React hooks for
common, everyday problems: debouncing, API calls, toggling state, syncing
state to storage, detecting outside clicks, and more.

## Installation

Hookify has `react` and `react-dom` as peer dependencies (v18+).

```bash npm2yarn
npm install @altalyst/hookify
```

## Quick start

Import any hook directly from the package root:

```tsx
import { useToggleState } from "@altalyst/hookify";

export const Example = () => {
  const [isVisible, toggleVisibility] = useToggleState(false);

  return (
    <div>
      <button onClick={toggleVisibility}>
        {isVisible ? "Hide" : "Show"} content
      </button>
      {isVisible && <p>This is some toggleable content!</p>}
    </div>
  );
};
```

## Requirements

| Requirement            | Version   |
| ---------------------- | --------- |
| React                  | `^18.3.1` |
| React DOM              | `^18.3.1` |
| Node (for development) | `>=24`    |

## What's next?

- Browse the **Hooks** section for a live, editable demo and full API for each
  hook (coming soon).
- Check the **API Reference**, generated straight from the library's
  TypeScript source (coming soon).
