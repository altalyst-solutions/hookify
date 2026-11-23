import type DocCardListType from "@theme/DocCardList";
import DocCardList from "@theme-original/DocCardList";
import { type ComponentProps, type ReactNode, useState } from "react";

import { useHookSizes } from "@site/src/components/HookSize";

import styles from "./styles.module.css";

/** How the hooks on the index can be ordered. */
type SortOrder = "default" | "name" | "size";

/** The sort buttons, in order. */
const ORDERS: { order: SortOrder; label: string }[] = [
  { order: "default", label: "Default" },
  { order: "name", label: "Name" },
  { order: "size", label: "Size" },
];

/**
 * Wraps the card list to let people sort the hooks index by name or by
 * gzipped size. Lists of anything other than hooks are unchanged.
 *
 * @param props - The props of the original component.
 * @returns The original list, with sort buttons above it on the hooks index.
 */
export default function DocCardListWrapper(
  props: ComponentProps<typeof DocCardListType>
): ReactNode {
  const sizes = useHookSizes();
  const [order, setOrder] = useState<SortOrder>("default");
  const { items } = props;

  const isHookIndex =
    items !== undefined &&
    items.length > 0 &&
    items.every(
      (item) => item.type === "link" && item.docId && item.docId in sizes
    );

  if (!isHookIndex) {
    return <DocCardList {...props} />;
  }

  const sizeOf = (item: (typeof items)[number]): number =>
    item.type === "link" && item.docId ? sizes[item.docId] : 0;
  const labelOf = (item: (typeof items)[number]): string =>
    "label" in item ? item.label : "";
  const sorted =
    order === "default"
      ? items
      : [...items].sort((a, b) =>
          order === "size"
            ? sizeOf(a) - sizeOf(b) || labelOf(a).localeCompare(labelOf(b))
            : labelOf(a).localeCompare(labelOf(b))
        );

  return (
    <>
      <div className={styles.sort} role="group" aria-label="Sort hooks by">
        <span>Sort by</span>
        {ORDERS.map(({ order: value, label }) => (
          <button
            key={value}
            type="button"
            aria-pressed={order === value}
            className={`button button--sm ${
              order === value ? "button--primary" : "button--secondary"
            }`}
            onClick={() => setOrder(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <DocCardList {...props} items={sorted} />
    </>
  );
}
