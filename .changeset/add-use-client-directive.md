---
"@altalyst/hookify": patch
"@altalyst/hookify-mcp": patch
---

The ES and CommonJS bundles now start with the `"use client"` directive, so React Server Component frameworks such as the Next.js App Router treat `@altalyst/hookify` as client code. Calling a hook from a Server Component now fails with a clear "is on the client" error instead of an obscure `useState is not a function` TypeError. Hooks still only run in Client Components, so put the components that call them in a file marked `"use client"`.
