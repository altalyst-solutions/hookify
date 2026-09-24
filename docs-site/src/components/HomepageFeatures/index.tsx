import Heading from "@theme/Heading";
import clsx from "clsx";
import type { ReactNode } from "react";
import styles from "./styles.module.css";

type FeatureItem = {
  title: string;
  emoji: string;
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
  {
    title: "Type-safe & tree-shakeable",
    emoji: "🧩",
    description: (
      <>
        Every hook is written in TypeScript with full type inference. Import
        only what you use — no runtime dependencies beyond React.
      </>
    ),
  },
  {
    title: "Live, editable examples",
    emoji: "⚡",
    description: (
      <>
        Every hook page ships with a runnable, editable demo so you can see
        exactly how it behaves before adding it to your app.
      </>
    ),
  },
  {
    title: "Documented from source",
    emoji: "📖",
    description: (
      <>
        The API reference is generated straight from the library&apos;s
        TypeScript source, so the docs never drift from the code.
      </>
    ),
  },
];

function Feature({ title, emoji, description }: FeatureItem) {
  return (
    <div className={clsx("col col--4")}>
      <div className="text--center">
        <span className={styles.featureEmoji} role="img" aria-hidden="true">
          {emoji}
        </span>
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
