import assert from "node:assert/strict";
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { extractEndpointClaims } from "./endpoint-claims.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function runFixtureAudit({ entrySkillAppend = "", readmeAppend = "" }) {
  const tempRoot = mkdtempSync(join(tmpdir(), "superior-skills-audit-"));
  const fixtureRoot = join(tempRoot, "superior-skills");

  try {
    cpSync(join(ROOT, "scripts"), join(fixtureRoot, "scripts"), {
      recursive: true,
    });
    cpSync(join(ROOT, "skills"), join(fixtureRoot, "skills"), {
      recursive: true,
    });
    cpSync(join(ROOT, "references"), join(fixtureRoot, "references"), {
      recursive: true,
    });
    cpSync(join(ROOT, "AUTHORING.md"), join(fixtureRoot, "AUTHORING.md"));
    cpSync(join(ROOT, "SKILL.md"), join(fixtureRoot, "SKILL.md"));
    cpSync(join(ROOT, "README.md"), join(fixtureRoot, "README.md"));

    if (entrySkillAppend) {
      const entrySkill = join(fixtureRoot, "SKILL.md");
      writeFileSync(
        entrySkill,
        `${readFileSync(entrySkill, "utf8")}${entrySkillAppend}`,
      );
    }
    if (readmeAppend) {
      const readme = join(fixtureRoot, "README.md");
      writeFileSync(readme, `${readFileSync(readme, "utf8")}${readmeAppend}`);
    }

    return spawnSync(
      process.execPath,
      [join(fixtureRoot, "scripts", "audit-endpoints.mjs")],
      {
        cwd: fixtureRoot,
        encoding: "utf8",
      },
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

test("extractEndpointClaims recognizes Unified runtime endpoints", () => {
  const claims = extractEndpointClaims(
    "Use POST /runtime/backtests, GET /runtime/backtests/{id}, and GET /runtime/frameworks.",
  );

  assert.deepEqual(
    [...claims.keys()],
    [
      "POST /runtime/backtests",
      "GET /runtime/backtests/{}",
      "GET /runtime/frameworks",
    ],
  );
});

test("the endpoint audit rejects mistyped route namespaces", () => {
  const result = runFixtureAudit({
    entrySkillAppend: "\nCall GET /runtim/backtests before deployment.\n",
  });

  assert.notEqual(result.status, 0, result.stdout + result.stderr);
  assert.match(
    result.stdout + result.stderr,
    /absent from the Unified API contract/,
  );
});

test("the endpoint audit rejects legacy API guidance", () => {
  const result = runFixtureAudit({
    entrySkillAppend:
      "\nCall GET /v2/backtesting at https://api.superior.trade during migration.\n",
  });

  assert.notEqual(result.status, 0, result.stdout + result.stderr);
  assert.match(
    result.stdout + result.stderr,
    /legacy API endpoint is not allowed/,
  );
  assert.match(result.stdout + result.stderr, /legacy API base is not allowed/);
});

test("the endpoint audit allows legacy routes inside a marked comparison block", () => {
  const result = runFixtureAudit({
    readmeAppend:
      "\n<!-- legacy-api-comparison:start -->\n| GET /v2/backtesting | GET /runtime/backtests |\n<!-- legacy-api-comparison:end -->\n",
  });

  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test("the endpoint audit validates Unified routes inside the README comparison", () => {
  const result = runFixtureAudit({
    readmeAppend:
      "\n<!-- legacy-api-comparison:start -->\n| GET /v2/backtesting | GET /runtime/not-a-real-route |\n<!-- legacy-api-comparison:end -->\n",
  });

  assert.notEqual(result.status, 0, result.stdout + result.stderr);
  assert.match(
    result.stdout + result.stderr,
    /absent from the Unified API contract/,
  );
});

test("the endpoint audit rejects marked legacy comparisons outside the README", () => {
  const result = runFixtureAudit({
    entrySkillAppend:
      "\n<!-- legacy-api-comparison:start -->\nCall GET /v2/backtesting.\n<!-- legacy-api-comparison:end -->\n",
  });

  assert.notEqual(result.status, 0, result.stdout + result.stderr);
  assert.match(
    result.stdout + result.stderr,
    /legacy API endpoint is not allowed/,
  );
});
