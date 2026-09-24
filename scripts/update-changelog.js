// Appends a new release section to CHANGELOG.md after an automated version
// bump. Runs in CI right after `phips28/gh-action-bump-version` creates the
// version bump commit/tag, and never influences the version number itself —
// it only reads the same push-event commit list the bump action already
// used, to keep the two in sync.
import fs from "fs";
import path from "path";

const NEW_VERSION = process.env.NEW_VERSION;
const PREV_VERSION = process.env.PREV_VERSION;
const REPO = process.env.GITHUB_REPOSITORY;
const SERVER_URL = process.env.GITHUB_SERVER_URL || "https://github.com";
const EVENT_PATH = process.env.GITHUB_EVENT_PATH;

if (!NEW_VERSION) {
  console.error("NEW_VERSION is not set; nothing to do.");
  process.exit(1);
}
if (!REPO) {
  console.error("GITHUB_REPOSITORY is not set.");
  process.exit(1);
}

const CHANGELOG_PATH = path.resolve("CHANGELOG.md");
const changelog = fs.readFileSync(CHANGELOG_PATH, "utf8");

// ---- 1. Gather commit messages from the triggering push event ----
let commits = [];
if (EVENT_PATH && fs.existsSync(EVENT_PATH)) {
  const event = JSON.parse(fs.readFileSync(EVENT_PATH, "utf8"));
  commits = event.commits || [];
}

const CATEGORY_ORDER = [
  "Added",
  "Changed",
  "Deprecated",
  "Removed",
  "Fixed",
  "Security",
];

const categorized = Object.fromEntries(CATEGORY_ORDER.map((c) => [c, []]));

const isNoiseCommit = (subject) =>
  /^Merge (pull request|branch) /i.test(subject) ||
  /^ci: bump version to /i.test(subject) ||
  /^docs: update changelog for /i.test(subject);

const stripConventionalPrefix = (subject) =>
  subject.replace(/^[a-zA-Z]+(\([^)]*\))?!?:\s*/, "").trim();

const capitalize = (text) =>
  text ? text[0].toUpperCase() + text.slice(1) : text;

for (const commit of commits) {
  const fullMessage = commit.message || "";
  const subject = fullMessage.split("\n")[0].trim();

  if (!subject || isNoiseCommit(subject)) continue;

  const isBreaking =
    /BREAKING CHANGE/.test(fullMessage) ||
    /^[a-zA-Z]+(\([^)]*\))?!:/.test(subject);
  const isFeat = /^feat(\([^)]*\))?!?:/i.test(subject);
  const isFix = /^fix(\([^)]*\))?!?:/i.test(subject);

  const bulletText = capitalize(stripConventionalPrefix(subject));
  const bullet = isBreaking ? `**BREAKING:** ${bulletText}` : bulletText;

  if (isBreaking) categorized.Changed.push(bullet);
  else if (isFeat) categorized.Added.push(bullet);
  else if (isFix) categorized.Fixed.push(bullet);
  else categorized.Changed.push(bullet);
}

// ---- 2. Fold in whatever the "Unreleased" section already contains ----
const unreleasedMatch = changelog.match(
  /## \[Unreleased\]\n([\s\S]*?)(?=\n## \[|$)/
);
if (!unreleasedMatch) {
  console.error('Could not find an "## [Unreleased]" section in CHANGELOG.md.');
  process.exit(1);
}
const unreleasedBody = unreleasedMatch[1];

const sectionRegex = /### (\w+)\n([\s\S]*?)(?=\n### |\n*$)/g;
let sectionMatch;
while ((sectionMatch = sectionRegex.exec(unreleasedBody))) {
  const [, category, body] = sectionMatch;
  if (!CATEGORY_ORDER.includes(category)) continue;
  const bullets = body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim());
  // Existing hand-written bullets go first, commit-derived ones after,
  // de-duplicated by exact text match.
  categorized[category] = [...bullets, ...categorized[category]].filter(
    (bullet, index, all) => all.indexOf(bullet) === index
  );
}

// ---- 3. Render the new version section ----
const date = new Date().toISOString().slice(0, 10);
const nonEmptyCategories = CATEGORY_ORDER.filter(
  (c) => categorized[c].length > 0
);

let versionSection = `## [${NEW_VERSION}] - ${date}\n`;
if (nonEmptyCategories.length === 0) {
  versionSection +=
    "\n_No notable changes recorded from commit metadata for this release._\n";
} else {
  for (const category of nonEmptyCategories) {
    versionSection += `\n### ${category}\n\n`;
    versionSection +=
      categorized[category].map((b) => `- ${b}`).join("\n") + "\n";
  }
}

const updatedChangelog = changelog.replace(
  /## \[Unreleased\]\n[\s\S]*?(?=\n## \[|$)/,
  `## [Unreleased]\n\n${versionSection}`
);

// ---- 4. Update the link reference footer ----
const compareBase = `${SERVER_URL}/${REPO}`;
const newUnreleasedLink = `[unreleased]: ${compareBase}/compare/${NEW_VERSION}...HEAD`;
const newVersionLink = PREV_VERSION
  ? `[${NEW_VERSION}]: ${compareBase}/compare/${PREV_VERSION}...${NEW_VERSION}`
  : `[${NEW_VERSION}]: ${compareBase}/releases/tag/${NEW_VERSION}`;

let finalChangelog = updatedChangelog;
if (/^\[unreleased\]: .*/im.test(finalChangelog)) {
  finalChangelog = finalChangelog.replace(
    /^\[unreleased\]: .*/im,
    `${newUnreleasedLink}\n${newVersionLink}`
  );
} else {
  finalChangelog += `\n${newUnreleasedLink}\n${newVersionLink}\n`;
}

fs.writeFileSync(CHANGELOG_PATH, finalChangelog);
console.log(`Updated CHANGELOG.md with entry for ${NEW_VERSION}.`);
