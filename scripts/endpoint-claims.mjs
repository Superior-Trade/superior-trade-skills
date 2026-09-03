const CLAIM =
  /\b(GET|POST|PUT|PATCH|DELETE)\s+`?((?:https:\/\/(?:api\.superior\.trade|unified-api-zag4gzx6gq-an\.a\.run\.app))?\/[0-9a-zA-Z._\-\/{}$]+)`?/g;

const normalise = (path) => path.replace(/\{[^}]*\}/g, "{}");

export function extractEndpointClaims(text) {
  const claims = new Map();
  for (const m of text.matchAll(CLAIM)) {
    const path = m[2]
      .replace("https://api.superior.trade", "")
      .replace("https://unified-api-zag4gzx6gq-an.a.run.app", "")
      .split("?")[0]
      .replace(/[.,)`]+$/, "");
    if (!/^\/(v1|v2|v3|health|auth|docs|openapi|llms|account|wallet|context|runtime|mcp|\.well-known)/.test(path)) continue;
    const claim = `${m[1]} ${normalise(path.replace(/\/\$\{[^}]+\}/g, "/{}"))}`;
    if (!claims.has(claim)) claims.set(claim, new Set());
  }
  return claims;
}
