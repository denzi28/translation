/**
 * The site's copy uses no em dashes or en dashes. This scans the source rather
 * than the rendered page, because a student's own entry may legitimately
 * contain one and that is their writing, not ours.
 *
 *   node tests/no-long-dashes.mjs
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const EXTENSIONS = new Set([".ts", ".tsx", ".css"]);
const BANNED = [
  ["—", "em dash"],
  ["–", "en dash"],
  ["‒", "figure dash"],
  ["―", "horizontal bar"],
];

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const findings = [];
for (const file of walk(ROOT)) {
  if (!EXTENSIONS.has(extname(file))) continue;
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, index) => {
      for (const [char, name] of BANNED) {
        if (line.includes(char)) {
          findings.push(
            `${file.slice(file.indexOf("src"))}:${index + 1} (${name}) ${line.trim().slice(0, 80)}`,
          );
        }
      }
    });
}

if (findings.length) {
  console.log(`FAIL ${findings.length} long dash(es) found:`);
  for (const f of findings) console.log(`  ${f}`);
  process.exit(1);
}
console.log("PASS no em or en dashes in the source");
