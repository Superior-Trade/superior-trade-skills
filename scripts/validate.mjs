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

for (const skillDirectory of skillPaths) {
  const skillPath = `${skillDirectory}/SKILL.md`;
  const fullPath = await assertFile(skillPath);
  const contents = await readFile(fullPath, "utf8");

  if (!contents.trim()) {
    throw new Error(`Empty skill file: ${skillPath}`);
  }
}

const requiredSkillPaths = [
  "skills/v2/exchanges/hyperliquid",
  "skills/v2/exchanges/aerodrome",
  "skills/v3/exchanges/polymarket",
  "skills/v3/exchanges/lighter",
  "skills/v3/primitives/deposit-qr",
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
  if (!contents.includes("skills/v2/") || !contents.includes("skills/v3/")) {
    throw new Error(`${label} must reference both skills/v2 and skills/v3`);
  }
  if (!contents.includes("skills/v3/primitives/deposit-qr")) {
    throw new Error(`${label} must reference skills/v3/primitives/deposit-qr`);
  }
}

console.log(`Validated ${skillPaths.length} Superior skills.`);
