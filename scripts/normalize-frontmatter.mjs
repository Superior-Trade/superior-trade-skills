#!/usr/bin/env node
// One-shot migration: move every non-spec frontmatter key under `metadata`.
//
// The Agent Skills spec allows six top-level keys. claude.ai upload, the Skills
// API, and package_skill.py reject an unknown key with a hard error instead of
// ignoring it, so keys like `version` and `auth` at the top level make a skill
// unpublishable through those paths. `metadata` is the spec's own escape hatch
// for arbitrary publisher data.
//
//   node scripts/normalize-frontmatter.mjs

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SPEC_KEYS = new Set([
  "name",
  "description",
  "license",
  "compatibility",
  "metadata",
  "allowed-tools",
]);
// Order the spec keys deterministically so diffs stay readable.
const SPEC_ORDER = ["name", "description", "license", "compatibility", "allowed-tools"];

const files = [];
if (existsSync(join(ROOT, "SKILL.md"))) files.push(join(ROOT, "SKILL.md"));
for (const entry of readdirSync(join(ROOT, "skills"))) {
  const p = join(ROOT, "skills", entry, "SKILL.md");
  if (existsSync(p)) files.push(p);
}

// Split frontmatter into top-level blocks, keeping each block's raw lines so
// nested YAML (auth:, env:, externalEndpoints:) survives untouched.
function splitBlocks(raw) {
  const blocks = [];
  let current = null;
  for (const line of raw.split("\n")) {
    const m = /^([A-Za-z_][\w-]*):(.*)$/.exec(line);
    if (m) {
      current = { key: m[1], lines: [line] };
      blocks.push(current);
    } else if (current) {
      current.lines.push(line);
    }
  }
  return blocks;
}

const indent = (lines) => lines.map((l) => (l.trim() ? `  ${l}` : l));

let changed = 0;
for (const file of files) {
  const original = readFileSync(file, "utf8");
  // These files are checked out with CRLF on Windows. JS `.` excludes \r, so
  // every line-anchored regex below fails silently against raw CRLF input.
  const crlf = original.includes("\r\n");
  const text = crlf ? original.replace(/\r\n/g, "\n") : original;
  if (!text.startsWith("---")) continue;
  const end = text.indexOf("\n---", 3);
  if (end === -1) continue;

  const raw = text.slice(4, end);
  const body = text.slice(end + 4);
  const blocks = splitBlocks(raw);

  const nonSpec = blocks.filter((b) => !SPEC_KEYS.has(b.key));
  if (nonSpec.length === 0) continue;

  const out = [];
  for (const key of SPEC_ORDER) {
    const block = blocks.find((b) => b.key === key);
    if (block) out.push(...block.lines);
  }

  out.push("metadata:");
  const existingMetadata = blocks.find((b) => b.key === "metadata");
  if (existingMetadata) {
    out.push(...existingMetadata.lines.slice(1));
  }
  for (const block of nonSpec) {
    // Trailing blank lines inside a block would break the nesting.
    while (block.lines.length && !block.lines[block.lines.length - 1].trim()) {
      block.lines.pop();
    }
    out.push(...indent(block.lines));
  }

  const next = `---\n${out.join("\n")}\n---${body}`;
  writeFileSync(file, crlf ? next.replace(/\n/g, "\r\n") : next);
  changed++;
  console.log(
    `${file.replace(ROOT, "").replace(/\\/g, "/")}: nested ${nonSpec.map((b) => b.key).join(", ")}`,
  );
}

console.log(`\n${changed} file(s) normalized.`);
