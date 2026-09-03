#!/usr/bin/env node
// Checks every endpoint the skills tell an agent to call against the API's own
// published contracts.
//
//   node scripts/audit-endpoints.mjs             # audit against the snapshots
//   node scripts/audit-endpoints.mjs --refresh   # re-download every snapshot
//   node scripts/audit-endpoints.mjs --refresh-unified # refresh only Unified
//
// Four contracts, in descending authority:
//
//   agent-skill.json  GET /v3/agent-skill/openapi.json — a curated surface the
//                     API team publishes FOR this library. If an endpoint is in
//                     here, it is sanctioned for agents.
//   unified.json     Unified API surface. This is the primary contract for
//                    account, wallet, context, runtime, and MCP operations.
//   v3.json / v2.json the legacy general specs. Broader, and both are incomplete
//                     relative to the route source, so absence here is a weak
//                     signal on its own.
//
// A claim in none of them is an ERROR — the skill is sending agents at
// something that does not exist. A claim that resolves only outside the curated
// surface is a WARN: it may work today, but nobody has promised agents it will.
//
// The snapshots are committed so the gate is deterministic offline and so a
// contract change lands as a reviewable diff rather than a silent pass/fail
// flip. Refresh them deliberately.

import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { extractEndpointClaims } from "./endpoint-claims.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONTRACT_DIR = join(ROOT, "scripts", "api-contract");

const SOURCES = {
  unified: process.env.SUPERIOR_UNIFIED_API_OPENAPI_URL ?? "https://unified-api-zag4gzx6gq-an.a.run.app/openapi.json",
  "agent-skill": "https://api.superior.trade/v3/agent-skill/openapi.json",
  v2: "https://api.superior.trade/openapi.json",
  v3: "https://api.superior.trade/v3/openapi.json",
};

const refreshAll = process.argv.includes("--refresh");
const refreshUnified = process.argv.includes("--refresh-unified");

if (refreshAll || refreshUnified) {
  const key = process.env.SUPERIOR_TRADE_API_KEY;
  const sources = refreshAll ? SOURCES : { unified: SOURCES.unified };
  for (const [name, url] of Object.entries(sources)) {
    const res = await fetch(url, { headers: key ? { "x-api-key": key } : {} });
    if (!res.ok) {
      console.error(`refresh failed for ${name}: HTTP ${res.status}`);
      process.exit(1);
    }
    writeFileSync(join(CONTRACT_DIR, `${name}.json`), JSON.stringify(await res.json(), null, 1));
    console.log(`refreshed ${name}.json`);
  }
}

const normalise = (path) => path.replace(/\{[^}]*\}/g, "{}");

function load(name) {
  const file = join(CONTRACT_DIR, `${name}.json`);
  if (!existsSync(file)) {
    console.error(`Missing contract snapshot ${name}.json. Run with --refresh.`);
    process.exit(1);
  }
  const spec = JSON.parse(readFileSync(file, "utf8"));
  const routes = new Set();
  for (const [path, ops] of Object.entries(spec.paths ?? {})) {
    for (const method of Object.keys(ops)) {
      if (!["get", "post", "put", "patch", "delete"].includes(method)) continue;
      routes.add(`${method.toUpperCase()} ${normalise(path)}`);
    }
  }
  return routes;
}

const curated = load("agent-skill");
const unified = load("unified");
const general = new Set([...load("v2"), ...load("v3")]);

// Verified live on 2026-08-12 with a real key: routed and working, but absent
// from every published spec. Re-probe before trusting after an API release.
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
  "POST /auth/sign-in/magic-link",
]);

// Named in the skills only to tell agents NOT to call them, or documented as
// removed so an agent meeting one in the wild knows why.
const DOCUMENTED_ABSENT = new Set([
  "POST /v3/account/onboard",
  "GET /v2/account/status",
  "GET /v3/account/{}/deposit-link",
]);

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
  ...(existsSync(join(ROOT, "references")) ? walk(join(ROOT, "references")) : []),
  ...walk(join(ROOT, "skills")),
];

const claims = new Map();
for (const file of files) {
  const text = readFileSync(file, "utf8");
  for (const claim of extractEndpointClaims(text).keys()) {
    if (!claims.has(claim)) claims.set(claim, new Set());
    claims.get(claim).add(relative(ROOT, file).replace(/\\/g, "/"));
  }
}

const dead = [];
const unsanctioned = [];

for (const [claim, where] of [...claims].sort()) {
  if (DOCUMENTED_ABSENT.has(claim)) continue;
  const known = unified.has(claim) || curated.has(claim) || general.has(claim) || VERIFIED_LIVE.has(claim);
  if (!known) dead.push({ claim, where: [...where] });
  else if (!curated.has(claim) && /^\w+ \/v3\//.test(claim) && !VERIFIED_LIVE.has(claim)) {
    unsanctioned.push({ claim, where: [...where] });
  }
}

// The curated contract is the API team's statement of intent. Where it and a
// skill disagree on the method for the same path, the contract wins.
const methodConflicts = [];
for (const claim of claims.keys()) {
  const [method, path] = claim.split(" ");
  if (curated.has(claim)) continue;
  const alt = [...curated].find((c) => c.endsWith(` ${path}`) && !c.startsWith(`${method} `));
  if (alt) methodConflicts.push({ claim, sanctioned: alt, where: [...claims.get(claim)] });
}

console.log(
  `contracts: unified ${unified.size} routes · agent-skill ${curated.size} routes · legacy ${general.size} · skill claims ${claims.size}`,
);

for (const { claim, sanctioned, where } of methodConflicts) {
  console.log(`\nWARN  ${claim} — the agent-skill contract publishes ${sanctioned}`);
  console.log(`        ${where.join(", ")}`);
}
for (const { claim, where } of unsanctioned) {
  console.log(`\nWARN  ${claim} — resolves, but is not in the agent-skill contract`);
  console.log(`        ${where.join(", ")}`);
}
for (const { claim, where } of dead) {
  console.log(`\nERROR ${claim} — in no published contract`);
  console.log(`        ${where.join(", ")}`);
}

const warnings = methodConflicts.length + unsanctioned.length;
console.log(`\n${dead.length} error(s), ${warnings} warning(s)`);
process.exit(dead.length > 0 ? 1 : 0);
