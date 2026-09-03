#!/usr/bin/env node
// Validates every endpoint the skills teach against the Unified API contract.
//
//   node scripts/audit-endpoints.mjs             # audit the committed snapshot
//   node scripts/audit-endpoints.mjs --refresh   # refresh the snapshot first

import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import {
  extractEndpointClaims,
  findLegacyApiBaseReferences,
  findLegacyEndpointReferences,
  stripLegacyComparisonBlocks,
} from "./endpoint-claims.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONTRACT_FILE = join(ROOT, "scripts", "api-contract", "unified.json");
const OPENAPI_URL =
  process.env.SUPERIOR_UNIFIED_API_OPENAPI_URL ??
  "https://unified-api-zag4gzx6gq-an.a.run.app/openapi.json";

if (process.argv.includes("--refresh")) {
  const key = process.env.SUPERIOR_TRADE_API_KEY;
  const response = await fetch(OPENAPI_URL, {
    headers: key ? { "x-api-key": key } : {},
  });
  if (!response.ok) {
    console.error(`refresh failed for Unified API: HTTP ${response.status}`);
    process.exit(1);
  }
  writeFileSync(CONTRACT_FILE, JSON.stringify(await response.json(), null, 1));
  console.log("refreshed unified.json");
}

if (!existsSync(CONTRACT_FILE)) {
  console.error("Missing Unified API contract snapshot. Run with --refresh.");
  process.exit(1);
}

const normalise = (path) => path.replace(/\{[^}]*\}/g, "{}");
const spec = JSON.parse(readFileSync(CONTRACT_FILE, "utf8"));
const routes = new Set();
for (const [path, operations] of Object.entries(spec.paths ?? {})) {
  for (const method of Object.keys(operations)) {
    if (["get", "post", "put", "patch", "delete"].includes(method)) {
      routes.add(`${method.toUpperCase()} ${normalise(path)}`);
    }
  }
}

// The OpenAPI document is the contract bootstrap endpoint and need not list
// itself as an operation in the document it returns.
routes.add("GET /openapi.json");

function walk(directory) {
  const files = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) files.push(...walk(path));
    else if (entry.endsWith(".md") || entry.endsWith(".json")) files.push(path);
  }
  return files;
}

const files = [
  join(ROOT, "AUTHORING.md"),
  join(ROOT, "README.md"),
  join(ROOT, "SKILL.md"),
  ...walk(join(ROOT, "references")),
  ...walk(join(ROOT, "skills")),
];
const claims = new Map();
const legacy = [];
const legacyBases = [];

for (const file of files) {
  const contents = readFileSync(file, "utf8");
  const location = relative(ROOT, file).replace(/\\/g, "/");
  const legacyAuditContents =
    location === "README.md" ? stripLegacyComparisonBlocks(contents) : contents;
  const endpointClaims = extractEndpointClaims(contents, {
    ignoreLegacyComparisonClaims: location === "README.md",
  });
  for (const claim of endpointClaims.keys()) {
    if (!claims.has(claim)) claims.set(claim, new Set());
    claims.get(claim).add(location);
  }
  for (const reference of findLegacyEndpointReferences(legacyAuditContents)) {
    legacy.push({ reference, location });
  }
  for (const reference of findLegacyApiBaseReferences(legacyAuditContents)) {
    legacyBases.push({ reference, location });
  }
}

const errors = [];
for (const { reference, location } of legacy) {
  errors.push(
    `${reference} — legacy API endpoint is not allowed (${location})`,
  );
}
for (const { reference, location } of legacyBases) {
  errors.push(`${reference} — legacy API base is not allowed (${location})`);
}
for (const [claim, locations] of [...claims].sort()) {
  if (!routes.has(claim)) {
    errors.push(
      `${claim} — absent from the Unified API contract (${[...locations].join(", ")})`,
    );
  }
}

console.log(
  `contract: Unified API ${routes.size} routes · skill claims ${claims.size}`,
);
for (const error of errors) console.log(`\nERROR ${error}`);
console.log(`\n${errors.length} error(s)`);
process.exit(errors.length > 0 ? 1 : 0);
