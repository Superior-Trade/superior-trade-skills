#!/usr/bin/env node
// Gate for the Agent Skills spec (agentskills.io) and the context budgets that
// govern how well a skill gets discovered and how much it costs once loaded.
//
//   node scripts/validate-skills.mjs
//
// Exits non-zero on any ERROR. WARN is advisory.

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Outside Claude Code — claude.ai uploads, the Skills API, package_skill.py —
// only these six keys are accepted, and an unknown key is a hard failure rather
// than something the loader ignores.
const SPEC_KEYS = new Set([
  "name",
  "description",
  "license",
  "compatibility",
  "metadata",
  "allowed-tools",
]);

// Per-entry cap on description + when_to_use in the skill listing. Text beyond
// this is cut, so trigger keywords placed late never reach the model.
const DESC_HARD_CAP = 1536;
const DESC_TARGET = 400;

// Spec guidance for the always-loaded body.
const BODY_LINE_LIMIT = 500;
const BODY_TOKEN_LIMIT = 5000;

const errors = [];
const warnings = [];

function parseFrontmatter(raw_, file) {
  // Checked out with CRLF on Windows; JS `.` excludes \r, so line-anchored
  // regexes below silently fail to match unless we normalize first.
  const text = raw_.replace(/\r\n/g, "\n");
  if (!text.startsWith("---")) {
    errors.push(`${file}: no YAML frontmatter`);
    return { keys: [], fields: {}, body: text };
  }
  const end = text.indexOf("\n---", 3);
  if (end === -1) {
    errors.push(`${file}: unterminated frontmatter`);
    return { keys: [], fields: {}, body: text };
  }
  const raw = text.slice(4, end);
  const body = text.slice(end + 4);

  // Top-level keys only: a line starting at column 0 with `key:`.
  const keys = [];
  const fields = {};
  let current = null;
  for (const line of raw.split("\n")) {
    const m = /^([A-Za-z_][\w-]*):(.*)$/.exec(line);
    if (m) {
      current = m[1];
      keys.push(current);
      fields[current] = m[2].trim();
    } else if (current && line.trim()) {
      fields[current] += " " + line.trim();
    }
  }
  return { keys, fields, body };
}

function unquote(s) {
  const t = s.trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    return t.slice(1, -1);
  }
  return t;
}

// Rough but stable: whitespace-delimited words scale to tokens at ~1.35x for
// prose with code blocks. Good enough to catch a 2x overrun.
const estimateTokens = (text) =>
  Math.round(text.split(/\s+/).filter(Boolean).length * 1.35);

function collectSkillFiles() {
  const files = [];
  if (existsSync(join(ROOT, "SKILL.md"))) files.push(join(ROOT, "SKILL.md"));
  const skillsDir = join(ROOT, "skills");
  if (existsSync(skillsDir)) {
    for (const entry of readdirSync(skillsDir)) {
      const p = join(skillsDir, entry, "SKILL.md");
      if (existsSync(p)) files.push(p);
    }
  }
  return files;
}

const files = collectSkillFiles();
if (files.length === 0) {
  console.error("No SKILL.md files found.");
  process.exit(1);
}

let listingChars = 0;
const rows = [];

for (const file of files) {
  const rel = relative(ROOT, file).replace(/\\/g, "/");
  const text = readFileSync(file, "utf8");
  const { keys, fields, body } = parseFrontmatter(text, rel);

  for (const key of keys) {
    if (!SPEC_KEYS.has(key)) {
      errors.push(
        `${rel}: frontmatter key "${key}" is outside the Agent Skills spec — ` +
          `move it under metadata: (packaging and claude.ai upload reject it)`,
      );
    }
  }

  const name = unquote(fields.name ?? "");
  const dir = rel === "SKILL.md" ? null : rel.split("/")[1];
  if (dir && name && name !== dir) {
    errors.push(`${rel}: name "${name}" does not match directory "${dir}"`);
  }

  const description = unquote(fields.description ?? "");
  if (!description) {
    errors.push(`${rel}: missing description — the skill cannot be discovered`);
  } else {
    const len = description.length + unquote(fields.when_to_use ?? "").length;
    listingChars += name.length + len;
    if (len > DESC_HARD_CAP) {
      errors.push(
        `${rel}: description is ${len} chars, past the ${DESC_HARD_CAP}-char listing cap — the tail is dropped`,
      );
    } else if (len > DESC_TARGET) {
      warnings.push(
        `${rel}: description is ${len} chars (target <=${DESC_TARGET}); long entries crowd out other skills in the listing`,
      );
    }
    if (!/\b(use when|use this|when the user|when an agent)\b/i.test(description)) {
      warnings.push(
        `${rel}: description does not say WHEN to use the skill — add a trigger clause`,
      );
    }
  }

  const lines = body.split("\n").length;
  const tokens = estimateTokens(body);
  if (lines > BODY_LINE_LIMIT || tokens > BODY_TOKEN_LIMIT) {
    errors.push(
      `${rel}: body is ${lines} lines / ~${tokens} tokens, past the ${BODY_LINE_LIMIT}-line / ${BODY_TOKEN_LIMIT}-token guidance — ` +
        `move detail into references/ and point at it from the body`,
    );
  }

  // A references/ file nobody is told to read is a file that never loads.
  const skillDir = dirname(file);
  for (const sub of ["references", "assets", "scripts"]) {
    const subdir = join(skillDir, sub);
    if (!existsSync(subdir) || !statSync(subdir).isDirectory()) continue;
    for (const f of readdirSync(subdir)) {
      if (!body.includes(`${sub}/${f}`)) {
        warnings.push(`${rel}: ${sub}/${f} is never referenced from SKILL.md`);
      }
    }
  }

  rows.push({ rel, desc: description.length, lines, tokens });
}

rows.sort((a, b) => b.tokens - a.tokens);
console.log("skill".padEnd(46), "desc".padStart(6), "lines".padStart(7), "~tokens".padStart(9));
for (const r of rows) {
  console.log(
    r.rel.padEnd(46),
    String(r.desc).padStart(6),
    String(r.lines).padStart(7),
    String(r.tokens).padStart(9),
  );
}
console.log(
  `\n${files.length} skills · listing footprint ~${listingChars} chars ` +
    `(~${Math.round(listingChars / 4)} tokens loaded at startup)`,
);

for (const w of warnings) console.log(`WARN  ${w}`);
for (const e of errors) console.log(`ERROR ${e}`);
console.log(`\n${errors.length} error(s), ${warnings.length} warning(s)`);
process.exit(errors.length > 0 ? 1 : 0);
