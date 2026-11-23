import { useDoc } from "@docusaurus/plugin-content-docs/client";
import type ContentType from "@theme/DocItem/Content";
import Content from "@theme-original/DocItem/Content";
import type { ComponentProps, ReactNode } from "react";

import { HookSize } from "@site/src/components/HookSize";

/**
 * Wraps the docs page content to show a hook's gzipped size above its title.
 * Pages outside `/hooks` are unchanged.
 *
 * @param props - The props of the original component.
 * @returns The original content, preceded by the size on hook pages.
 */
export default function ContentWrapper(
  props: ComponentProps<typeof ContentType>
): ReactNode {
  const { metadata } = useDoc();
  const isHookPage = metadata.id.startsWith("hooks/");

  return (
    <>
      {isHookPage && <HookSize docId={metadata.id} />}
      <Content {...props} />
    </>
  );
}
