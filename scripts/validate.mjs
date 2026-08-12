import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

const requiredFiles = [
  "README.md",
  "SKILL.md",
  "LICENSE",
  ".claude-plugin/plugin.json",
  ".claude-plugin/marketplace.json",
  ".turbo-upstream.json",
];

async function assertFile(relativePath) {
  const fullPath = path.join(root, relativePath);
  const fileStat = await stat(fullPath).catch(() => null);

  if (!fileStat?.isFile()) {
    throw new Error(`Missing required file: ${relativePath}`);
  }

  return fullPath;
}

for (const requiredFile of requiredFiles) {
  await assertFile(requiredFile);
}

for (const jsonFile of [
  ".claude-plugin/plugin.json",
  ".claude-plugin/marketplace.json",
  ".turbo-upstream.json",
]) {
  const fullPath = await assertFile(jsonFile);
  JSON.parse(await readFile(fullPath, "utf8"));
}

const skillsDir = path.join(root, "skills");

async function collectSkillPaths(directory, prefix = "skills") {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = [];

  const hasSkill = entries.some(
    (entry) => entry.isFile() && entry.name === "SKILL.md",
  );
  if (hasSkill) {
    paths.push(prefix);
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    paths.push(
      ...(await collectSkillPaths(
        path.join(directory, entry.name),
        `${prefix}/${entry.name}`,
      )),
    );
  }

  return paths;
}

const skillPaths = (await collectSkillPaths(skillsDir)).sort();

if (skillPaths.length === 0) {
  throw new Error("No skills found under skills/");
}

// Skill loaders resolve exactly one level: `skills/<name>/SKILL.md`. A skill
// nested any deeper is silently invisible — it does not appear in the skill
// listing and cannot be invoked. Verified against a live Claude Code session:
// a skill at skills/v2/exchanges/hyperliquid/ was not discovered, while a
// sibling at skills/flatskill/ was.
const nested = skillPaths.filter(
  (skillPath) => skillPath.split("/").length !== 2,
);
if (nested.length > 0) {
  throw new Error(
    `Skills must live at skills/<name>/SKILL.md. Nested skills are never ` +
      `discovered by the loader:\n  ${nested.join("\n  ")}`,
  );
}

for (const skillDirectory of skillPaths) {
  const skillPath = `${skillDirectory}/SKILL.md`;
  const fullPath = await assertFile(skillPath);
  const contents = await readFile(fullPath, "utf8");

  if (!contents.trim()) {
    throw new Error(`Empty skill file: ${skillPath}`);
  }
}

const requiredSkillPaths = [
  "skills/superior-trade",
  "skills/hyperliquid",
  "skills/aerodrome",
  "skills/polymarket",
  "skills/lighter",
  "skills/deposit-qr",
];

for (const requiredSkillPath of requiredSkillPaths) {
  if (!skillPaths.includes(requiredSkillPath)) {
    throw new Error(`Missing required skill path: ${requiredSkillPath}`);
  }
}

const readme = await readFile(path.join(root, "README.md"), "utf8");
const rootSkill = await readFile(path.join(root, "SKILL.md"), "utf8");

for (const [label, contents] of [
  ["README.md", readme],
  ["SKILL.md", rootSkill],
]) {
  if (!contents.includes("skills/superior-trade")) {
    throw new Error(`${label} must point new users at skills/superior-trade`);
  }
}

// Any skill named in prose must actually exist, so routing can't rot into dead
// ends. The entry skill is the important one here: its whole job is pointing at
// other skills, and it names them bare (`hyperliquid`) rather than by path.
const entrySkill = await readFile(
  path.join(root, "skills/superior-trade/SKILL.md"),
  "utf8",
);
const knownSkills = new Set(skillPaths.map((p) => p.replace("skills/", "")));

for (const [label, contents] of [
  ["README.md", readme],
  ["SKILL.md", rootSkill],
  ["skills/superior-trade/SKILL.md", entrySkill],
]) {
  for (const match of contents.matchAll(/skills\/([a-z0-9-]+)\//g)) {
    if (!knownSkills.has(match[1])) {
      throw new Error(`${label} links skills/${match[1]}, which does not exist`);
    }
  }
}

// The entry skill routes by bare backticked name rather than by path, so a
// renamed or deleted skill would otherwise survive there as a silent dead end.
// Every backticked lowercase token in that file is a skill name except the
// handful of protocol terms below.
const NON_SKILL_TERMS = new Set(["x-api-key"]);
for (const match of entrySkill.matchAll(/`([a-z][a-z0-9-]{3,})`/g)) {
  const routed = match[1];
  if (NON_SKILL_TERMS.has(routed) || knownSkills.has(routed)) continue;
  throw new Error(
    `skills/superior-trade/SKILL.md routes to \`${routed}\`, which is not a skill. ` +
      `Add it to NON_SKILL_TERMS in this script if it is not meant to be one.`,
  );
}

console.log(`Validated ${skillPaths.length} Superior skills.`);
