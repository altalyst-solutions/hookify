import { usePluginData } from "@docusaurus/useGlobalData";
import type { ReactNode } from "react";

import styles from "./styles.module.css";

/** The data written by `.github/scripts/generate-hook-sizes.mjs`. */
interface HookSizeData {
  /** Gzipped size of the whole package, in bytes. */
  bundle?: number;
  /** Gzipped size of each hook imported on its own, in bytes, by hook name. */
  hooks: Record<string, number>;
}

/**
 * Formats a size in bytes.
 *
 * @param size - The size in bytes.
 * @returns The size such as `126 B` or `1.04 kB`.
 */
export const formatSize = (size: number): string =>
  size < 1000 ? `${size} B` : `${parseFloat((size / 1000).toFixed(2))} kB`;

/**
 * Converts a hook name to the id of its docs page.
 *
 * @param name - The hook name, such as `useDebouncedValue`.
 * @returns The doc id, such as `hooks/use-debounced-value`.
 */
const toDocId = (name: string): string =>
  `hooks/${name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase()}`;

/**
 * Reads the generated hook sizes.
 *
 * @returns A map from doc id, such as `hooks/use-toggle-state`, to the hook's
 *   gzipped size in bytes. It is empty when the sizes weren't generated.
 */
export const useHookSizes = (): Record<string, number> => {
  const data = usePluginData("hookify-hook-sizes") as HookSizeData | undefined;
  return Object.fromEntries(
    Object.entries(data?.hooks ?? {}).map(([name, size]) => [
      toDocId(name),
      size,
    ])
  );
};

/** Props for {@link HookSize}. */
interface HookSizeProps {
  /** The id of the hook's docs page, such as `hooks/use-toggle-state`. */
  docId: string | undefined;
  /**
   * How to show it: a bordered `chip` above a page title, or plain `text`
   * inside a card. Default is `chip`.
   */
  variant?: "chip" | "text";
}

/**
 * The gzipped size of a hook, such as "≈ 126 B gzipped".
 *
 * @param props - See {@link HookSizeProps}.
 * @returns The size, or nothing when it isn't known for this hook.
 */
export const HookSize = ({
  docId,
  variant = "chip",
}: HookSizeProps): ReactNode => {
  const sizes = useHookSizes();
  const size = docId ? sizes[docId] : undefined;

  if (size === undefined) {
    return null;
  }

  return (
    <span
      className={variant === "chip" ? styles.size : styles.text}
      title="Gzipped size of what your bundle includes when you import only this hook, without React."
    >
      ≈ {formatSize(size)} gzipped
    </span>
  );
};
