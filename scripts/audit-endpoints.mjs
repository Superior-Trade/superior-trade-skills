// Diffs every endpoint the skills tell an agent to call against what the API
// actually serves, per its own OpenAPI specs.
//
//   node audit-endpoints.mjs <skills-repo-path>

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.argv[2];

const specs = await Promise.all(
  ["https://api.superior.trade/openapi.json", "https://api.superior.trade/v3/openapi.json"].map(
    (u) => fetch(u).then((r) => r.json()),
  ),
);

// Real routes, normalised: METHOD /path with {param} placeholders unified.
const real = new Set();
for (const spec of specs) {
  for (const [path, ops] of Object.entries(spec.paths ?? {})) {
    for (const method of Object.keys(ops)) {
      if (!["get", "post", "put", "patch", "delete"].includes(method)) continue;
      real.add(`${method.toUpperCase()} ${path.replace(/\{[^}]+\}/g, "{}")}`);
    }
  }
}

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (entry.endsWith(".md")) out.push(p);
  }
  return out;
}

const files = [
  ...(existsSync(join(ROOT, "SKILL.md")) ? [join(ROOT, "SKILL.md")] : []),
  ...walk(join(ROOT, "skills")),
];

// Claims look like: `POST /v2/deployment/{id}/credentials`, GET `/v3/account`,
// or PUT /v2/backtesting/{id}/status inside prose and tables.
const CLAIM = /\b(GET|POST|PUT|PATCH|DELETE)\s+`?((?:https:\/\/api\.superior\.trade)?\/v?[0-9a-zA-Z._\-\/{}$]+)`?/g;

const claims = new Map(); // normalised -> [{file, raw}]
for (const file of files) {
  const text = readFileSync(file, "utf8");
  for (const m of text.matchAll(CLAIM)) {
    const method = m[1];
    let path = m[2].replace("https://api.superior.trade", "");
    if (!path.startsWith("/")) continue;
    // strip query strings, trailing punctuation, and template vars
    path = path.split("?")[0].replace(/[.,)`]+$/, "");
    if (!/^\/(v2|v3|health|auth|docs|openapi|llms)/.test(path)) continue;
    const norm = `${method} ${path.replace(/\{[^}]+\}/g, "{}").replace(/\/\$\{[^}]+\}/g, "/{}")}`;
    if (!claims.has(norm)) claims.set(norm, []);
    claims.get(norm).push(file.replace(ROOT, "").replace(/\\/g, "/"));
  }
}

// Verified live against production with a real key on 2026-08-12. These are
// absent from the OpenAPI specs but genuinely routed — the spec is incomplete,
// not the skills. Re-probe before trusting this list after an API release.
const VERIFIED_LIVE = new Set([
  "GET /docs",
  "GET /openapi.json",
  "GET /llms.txt",
  "GET /v3/docs",
  "GET /v3/openapi.json",
  "GET /v3/account/{}/status/hyperliquid",
  "GET /v3/account/{}/status/polymarket",
  "GET /v3/deployments/{}/logs",
  "POST /v3/deployments",
  "PUT /v3/deployment/{}/status",
  // Named only to tell agents NOT to call it.
  "POST /v3/account/onboard",
  // Documented as REMOVED so an agent that meets it in the wild knows why.
  "GET /v2/account/status",
  "GET /v3/account/{}/deposit-link",
]);

const missing = [];
for (const [claim, where] of [...claims].sort()) {
  if (!real.has(claim) && !VERIFIED_LIVE.has(claim)) missing.push({ claim, where: [...new Set(where)] });
}

console.log(`real routes in specs: ${real.size}`);
console.log(`distinct endpoint claims in skills: ${claims.size}`);
console.log(`\nCLAIMED BUT NOT IN SPEC (${missing.length}):\n`);
for (const { claim, where } of missing) {
  console.log(`  ${claim}`);
  console.log(`      ${where.join(", ")}`);
}
