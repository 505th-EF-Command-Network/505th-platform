#!/usr/bin/env node
/**
 * npm run hub:release — build the Hub installer and publish it as a GitHub release.
 *   1. reads the version from apps/hub/package.json
 *   2. builds  apps/hub/release/505th-Command-Network-Setup-<version>.exe  (npm run dist -w @505th/hub)
 *   3. publishes release  hub-v<version>  with that .exe and apps/hub/RELEASE_NOTES.md as the notes
 * Uses the GitHub CLI (gh) signed in on this PC — no token in the repo. Stops if the release already exists.
 * The website shows it on the download card within ~5 minutes; installed Hubs see "UPDATE READY" within 4 hours.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const hub = join(root, "apps", "hub");
const REPO = "505th-EF-Command-Network/505th-platform";
const { version } = JSON.parse(readFileSync(join(hub, "package.json"), "utf8"));
const tag = `hub-v${version}`;
const exe = join(hub, "release", `505th-Command-Network-Setup-${version}.exe`);
const notes = join(hub, "RELEASE_NOTES.md");
// npm needs the Windows shell; gh is a real .exe — run it WITHOUT the shell so paths with spaces stay in one piece.
const run = (cmd, args, opts = {}) => { const r = spawnSync(cmd, args, { stdio: "inherit", shell: cmd === "npm" && process.platform === "win32", cwd: root, ...opts }); if (r.status !== 0) process.exit(r.status ?? 1); };
const say = (m) => console.log(`\n\x1b[36m▶ ${m}\x1b[0m`);

say(`505th Command Network ${tag}`);
try { execFileSync("gh", ["--version"], { stdio: "ignore" }); }
catch { console.error("✕ GitHub CLI (gh) not found. Install it from https://cli.github.com and run: gh auth login"); process.exit(1); }
if (spawnSync("gh", ["release", "view", tag, "--repo", REPO], { stdio: "ignore" }).status === 0) {
  console.error(`✕ Release ${tag} already exists. Raise "version" in apps/hub/package.json first.`); process.exit(1);
}
if (!existsSync(notes)) { console.error("✕ apps/hub/RELEASE_NOTES.md is missing — write what's new (lines starting with \"- \")."); process.exit(1); }

say("Building the installer…");
run("npm", ["run", "dist", "-w", "@505th/hub"]);
if (!existsSync(exe)) { console.error(`✕ Build finished but ${exe} is missing.`); process.exit(1); }

say(`Publishing ${tag} to GitHub…`);
run("gh", ["release", "create", tag, exe, "--repo", REPO, "--title", `505th Command Network v${version}`, "--notes-file", notes]);
say(`Done ✓  ${tag} is live. The download card updates within ~5 minutes; installed Hubs see the update within 4 hours.`);
