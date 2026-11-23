import type DescriptionType from "@theme/DocCard/Description";
import Description from "@theme-original/DocCard/Description";
import type { ComponentProps, ReactNode } from "react";

import { HookSize } from "@site/src/components/HookSize";

/**
 * Wraps the description of a card on a generated index page to add a hook's
 * gzipped size below it. Cards for pages outside `/hooks` are unchanged.
 *
 * @param props - The props of the original component.
 * @returns The original description, followed by the size for hook cards.
 */
export default function DescriptionWrapper(
  props: ComponentProps<typeof DescriptionType>
): ReactNode {
  const { item } = props;
  const docId = item.type === "link" ? item.docId : undefined;

  return (
    <>
      <Description {...props} />
      {docId?.startsWith("hooks/") && (
        <p>
          <HookSize docId={docId} variant="text" />
        </p>
      )}
    </>
  );
}
