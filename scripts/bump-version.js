import fs from "fs";
import { execSync } from "child_process";

// Utility function to execute shell commands
const exec = (command) => {
  console.log(`Executing: ${command}`);
  return execSync(command, { stdio: "inherit" });
};

// Function to bump version
const bumpVersion = (type) => {
  const packageJsonPath = "./package.json";
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

  const [major, minor, patch] = packageJson.version.split(".").map(Number);

  if (type === "major") packageJson.version = `${major + 1}.0.0`;
  else if (type === "minor") packageJson.version = `${major}.${minor + 1}.0`;
  else packageJson.version = `${major}.${minor}.${patch + 1}`;

  fs.writeFileSync(
    packageJsonPath,
    JSON.stringify(packageJson, null, 2) + "\n"
  );
  console.log(`Bumped version to ${packageJson.version}`);

  exec(`git add ${packageJsonPath}`);
  exec(`git commit -m "ci: bump version to ${packageJson.version}"`);
  exec(`git tag v${packageJson.version}`);
  exec(`git push origin main --tags`);
};

// Set up Git user and authenticate using GITHUB_TOKEN
const setupGit = () => {
  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) {
    console.error("Error: GITHUB_TOKEN is not set");
    process.exit(1);
  }

  const repo = process.env.GITHUB_REPOSITORY;
  if (!repo) {
    console.error("Error: GITHUB_REPOSITORY is not set");
    process.exit(1);
  }

  exec('git config user.name "github-actions[bot]"');
  exec('git config user.email "github-actions[bot]@users.noreply.github.com"');
  exec(
    `git remote set-url origin https://x-access-token:${githubToken}@github.com/${repo}.git`
  );
};

// Main logic
try {
  setupGit();

  const commitMessages = execSync("git log -1 --pretty=%B").toString().trim();
  if (commitMessages.includes("BREAKING CHANGE")) bumpVersion("major");
  else if (commitMessages.startsWith("feat")) bumpVersion("minor");
  else bumpVersion("patch");
} catch (error) {
  console.error("Error:", error.message);
  process.exit(1);
}
