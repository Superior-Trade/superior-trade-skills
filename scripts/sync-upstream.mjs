import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const metadataPath = path.join(root, ".turbo-upstream.json");
const metadata = JSON.parse(await readFile(metadataPath, "utf8"));

const repository =
  process.env.SUPERIOR_SKILLS_REPOSITORY ?? metadata.repository;
const branch = process.env.SUPERIOR_SKILLS_BRANCH ?? metadata.branch;
const tempDir = await mkdtemp(path.join(os.tmpdir(), "superior-skills-"));
const cloneDir = path.join(tempDir, "repo");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? root,
    stdio: "inherit",
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed`);
  }
}

function output(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? root,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || `${command} ${args.join(" ")} failed`);
  }

  return result.stdout.trim();
}

// This script mirrors an upstream skills repo into a consumer. It overwrites
// skills/, SKILL.md, README.md and .claude-plugin wholesale, so pointing it at
// the repo it lives in makes any checked-out branch replaceable by whatever the
// metadata happens to name — a `git checkout` with no diff to review.
const selfRemote = spawnSync("git", ["remote", "get-url", "origin"], {
  cwd: root,
  encoding: "utf8",
});
const normalize = (url) =>
  url.trim().replace(/\.git$/, "").replace(/^git@github\.com:/, "https://github.com/");
if (
  selfRemote.status === 0 &&
  normalize(selfRemote.stdout) === normalize(repository)
) {
  throw new Error(
    `Refusing to sync ${repository} onto itself.\n` +
      `This checkout IS the upstream. Running the sync would overwrite skills/, ` +
      `SKILL.md, README.md and .claude-plugin with branch "${branch}".\n` +
      `Run this script from the consuming repo (superior-turborepo), not from here.`,
  );
}

try {
  run("git", [
    "clone",
    "--depth",
    "1",
    "--branch",
    branch,
    repository,
    cloneDir,
  ]);

  for (const relativePath of [
    ".claude-plugin",
    ".clawhubignore",
    "LICENSE",
    "README.md",
    "SKILL.md",
    "skills",
  ]) {
    await rm(path.join(root, relativePath), {
      recursive: true,
      force: true,
    });
    run("cp", [
      "-R",
      path.join(cloneDir, relativePath),
      path.join(root, relativePath),
    ]);
  }

  const commit = output("git", ["rev-parse", "HEAD"], { cwd: cloneDir });
  await writeFile(
    metadataPath,
    `${JSON.stringify({ repository, branch, commit }, null, 2)}\n`,
  );

  run("pnpm", ["run", "validate"]);
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
