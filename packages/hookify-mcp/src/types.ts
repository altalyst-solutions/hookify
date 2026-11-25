/**
 * The shape of `hooks.json`, the data the server answers from.
 *
 * `scripts/build-data.ts` generates it at build time from the library's
 * bundled type definitions (signatures and TSDoc) and the docs pages (front
 * matter and the "When to use it" section), so it always matches the
 * `@altalyst/hookify` version it was built with.
 */
export interface HooksData {
  /** The `@altalyst/hookify` version the data describes, such as `0.13.0`. */
  hookifyVersion: string;
  /** Every exported hook, sorted by name. */
  hooks: HookEntry[];
}

/** Categories a hook can belong to, from the docs page's `category`. */
export type HookCategory =
  "state" | "timing" | "async" | "dom" | "browser" | "lifecycle" | "refs";

/** Everything the server knows about one hook. */
export interface HookEntry {
  /** The exported name, such as `useDebouncedValue`. */
  name: string;
  /** The docs page slug, such as `use-debounced-value`. */
  slug: string;
  /** One-sentence summary from the docs page's `description`. */
  description: string;
  /** Grouping used by `list_hooks`. */
  category: HookCategory;
  /** Search terms from the docs page's `keywords`. */
  keywords: string[];
  /** Other hooks worth suggesting alongside this one. */
  related: string[];
  /** Web platform features the hook relies on; empty for none. */
  browserApis: string[];
  /**
   * Helpers from `@altalyst/hookify/testing` that fake what the hook needs in
   * a test, from the docs page's `testing`; empty for none.
   */
  testing: string[];
  /** Use cases from the docs page's "When to use it" section, as plain text. */
  useWhen: string[];
  /** Set when the hook is deprecated. */
  deprecated?: {
    /** The hook to use instead. */
    replacedBy: string;
    /** The `@deprecated` text from the hook's TSDoc. */
    note: string;
  };
  /** The call signature, such as `useDebouncedValue<T>(value: T, delay: number): T`. */
  signature: string;
  /** The TSDoc body: what the hook does, guarantees and edge cases. */
  details: string;
  /** `@typeParam` entries. */
  typeParams: DocumentedName[];
  /** `@param` entries, in order. */
  params: DocumentedName[];
  /** The `@returns` text, or an empty string. */
  returns: string;
  /** `@example` code, without the surrounding code fence. */
  examples: string[];
  /** Exported types used in the signature, such as the options and return types. */
  types: TypeEntry[];
  /** The hook's page on the docs site. */
  docsUrl: string;
}

/** A documented parameter or type parameter. */
export interface DocumentedName {
  /** Its name, such as `delay`. */
  name: string;
  /** What it is for. */
  description: string;
}

/** An exported type referenced by a hook's signature. */
export interface TypeEntry {
  /** Its name, such as `UseDebouncedCallbackOptions`. */
  name: string;
  /** Interfaces list their members; type aliases give their definition. */
  kind: "interface" | "type";
  /** The TSDoc summary of the type, or an empty string. */
  description: string;
  /** For type aliases, the definition, such as `"idle" | "pending"`. */
  definition?: string;
  /** For interfaces, every member. */
  members?: TypeMember[];
}

/** One member of an interface. */
export interface TypeMember {
  /** Its name, such as `leading`. */
  name: string;
  /** Its type, such as `boolean`. */
  type: string;
  /** `true` when the member is optional (`leading?:`). */
  optional: boolean;
  /** Its TSDoc, which usually ends with the default value. */
  description: string;
}
