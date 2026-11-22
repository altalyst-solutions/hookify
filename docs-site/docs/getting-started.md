---
sidebar_position: 1
slug: /getting-started
---

# Getting Started

Hookify is a lightweight collection of framework-agnostic React hooks for
common, everyday problems: debouncing, API calls, toggling state, syncing
state to storage, detecting outside clicks, and more.

:::tip[Docs versions]

These docs come in two versions: the **latest release**, which matches what
`npm install` gives you, and **next**, which shows unreleased changes from
`main`. Use the version menu in the top right to switch between them.

:::

## Installation

Hookify has `react` and `react-dom` as peer dependencies (v18+).

```bash npm2yarn
npm install @altalyst/hookify
```

Hookify ships ESM and CommonJS builds with bundled TypeScript types, and is
tree-shakeable, so only the hooks you import end up in your bundle.

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

## Using Hookify with Next.js and React Server Components

Hookify's bundles start with the `"use client"` directive, so
`@altalyst/hookify` is a client boundary in the Next.js App Router and other
React Server Component frameworks. You can import it from any module, such as a
shared file or a barrel that a Server Component also imports, without writing
your own wrapper that re-exports it behind `"use client"`.

Hooks still only run in Client Components, because they use state, effects and
browser APIs. Calling a hook while a Server Component renders fails with an
error from React, as it does for any hook. Put the components that call hooks
in a file that starts with `"use client"`, and render them from your Server
Components:

```tsx title="app/disclosure.tsx"
"use client";

import { useToggleState } from "@altalyst/hookify";

export const Disclosure = () => {
  const [isOpen, toggle] = useToggleState(false);

  return (
    <div>
      <button onClick={toggle}>{isOpen ? "Hide" : "Show"} details</button>
      {isOpen && <p>Details that only render after a click.</p>}
    </div>
  );
};
```

```tsx title="app/page.tsx"
import { Disclosure } from "./disclosure";

// A Server Component: it renders the Client Component but calls no hooks.
export default function Page() {
  return <Disclosure />;
}
```

Client Components are still rendered on the server for the first HTML, and
hooks never touch `window`, `document` or `navigator` during render, so there
are no hydration warnings. Hooks that read browser state, such as
[`useMediaQuery`](/hooks/use-media-query), render a default value on the server
and update after hydration. Each hook's page describes its server behavior.

## Requirements

| Requirement            | Version                |
| ---------------------- | ---------------------- |
| React                  | `^18.0.0 \|\| ^19.0.0` |
| React DOM              | `^18.0.0 \|\| ^19.0.0` |
| Node (for development) | `>=24`                 |

## What's next?

- Browse the **[Hooks](/hooks)** section for a live, editable demo and usage
  guide for each hook.
- Check the **API Reference**, generated straight from the library's
  TypeScript source.
