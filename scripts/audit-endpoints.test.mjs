import test from "node:test";
import assert from "node:assert/strict";

import { extractEndpointClaims } from "./endpoint-claims.mjs";

test("extractEndpointClaims recognizes unified runtime endpoints", () => {
  const claims = extractEndpointClaims(
    "Use POST /runtime/backtests, GET /runtime/backtests/{id}, and GET /runtime/frameworks.",
  );

  assert.deepEqual([...claims.keys()], [
    "POST /runtime/backtests",
    "GET /runtime/backtests/{}",
    "GET /runtime/frameworks",
  ]);
});
