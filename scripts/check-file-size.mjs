import { execFileSync } from "node:child_process";

const extensions = new Set([
  ".ts", ".tsx", ".js", ".mjs", ".cjs", ".php", ".json", ".sql", ".yml", ".yaml",
]);
const ignored = /(?:^|\/)(?:node_modules|dist|coverage)\/|pnpm-lock\.yaml$/;
const files = execFileSync("rg", [
  "--files", "-uu", "-g", "!.git/**", "-g", "!node_modules/**",
  "-g", "!dist/**", "-g", "!coverage/**",
], { encoding: "utf8" }).trim().split("\n").filter(Boolean);
const candidates = files.filter(
  (file) => !ignored.test(file) && extensions.has(file.slice(file.lastIndexOf("."))),
);
const violations = [];

for (const file of candidates) {
  const lines = execFileSync("wc", ["-l", file], { encoding: "utf8" });
  const count = Number.parseInt(lines.trim().split(/\s+/)[0] ?? "0", 10);
  if (count > 200) violations.push(`${file}: ${count} lines`);
}

if (violations.length > 0) {
  console.error("Files exceed the 200-line limit:\n" + violations.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`File-size check passed (${candidates.length} code/config files scanned).`);
}
