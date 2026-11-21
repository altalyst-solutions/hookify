---
"@altalyst/hookify": patch
"@altalyst/hookify-mcp": patch
---

The ES and CommonJS bundles now start with the `"use client"` directive, so you can import hooks from `@altalyst/hookify` in React Server Component frameworks such as the Next.js App Router without writing your own wrapper files. Hooks still only run in Client Components.
