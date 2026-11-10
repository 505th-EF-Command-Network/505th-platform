/**
 * Run the website AND Cortana v2 together (one window, coloured labels).
 *   npm run dev:all
 * Ctrl+C stops both. No extra packages needed.
 */
import { spawn } from "node:child_process";

const apps = [
  { name: "WEBSITE", color: "\x1b[36m", args: ["run", "dev", "-w", "@505th/website"] },
  { name: "CORTANA", color: "\x1b[35m", args: ["run", "dev", "-w", "@505th/cortana"] },
];
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const kids = apps.map(({ name, color, args }) => {
  const p = spawn(npm, args, { shell: process.platform === "win32", env: { ...process.env, FORCE_COLOR: "1" } });
  const tag = `${color}[${name}]\x1b[0m `;
  const out = (s) => (d) => String(d).split(/\r?\n/).filter(Boolean).forEach((l) => s.write(tag + l + "\n"));
  p.stdout.on("data", out(process.stdout));
  p.stderr.on("data", out(process.stderr));
  p.on("exit", (code) => console.log(`${tag}stopped (code ${code})`));
  return p;
});
const stop = () => {
  for (const k of kids) k.kill("SIGINT");
  setTimeout(() => process.exit(0), 1500);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
