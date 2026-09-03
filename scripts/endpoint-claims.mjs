const CLAIM =
  /\b(GET|POST|PUT|PATCH|DELETE)\s+`?((?:https:\/\/(?:api\.superior\.trade|unified-api-zag4gzx6gq-an\.a\.run\.app))?\/[0-9a-zA-Z._\-\/{}:$]+)`?/g;
const LEGACY_ENDPOINT = /\/v(?:1|2|3)(?:\/|\b)[0-9a-zA-Z._\-\/{}:$?=&]*/g;
const LEGACY_API_BASE =
  /https:\/\/api\.superior\.trade(?:\/[0-9a-zA-Z._\-\/{}:$?=&]*)?/g;
const LEGACY_COMPARISON_BLOCK =
  /<!--\s*legacy-api-comparison:start\s*-->[\s\S]*?<!--\s*legacy-api-comparison:end\s*-->/g;
const LEGACY_CLAIM_PATH = /^\/(?:v(?:1|2|3)(?:\/|$)|auth(?:\/|$))/;

const normalise = (path) =>
  path.replace(/\{[^}]*\}|:[a-zA-Z_][a-zA-Z0-9_]*/g, "{}");

export function extractEndpointClaims(
  text,
  { ignoreLegacyComparisonClaims = false } = {},
) {
  const claims = new Map();
  const comparisonRanges = ignoreLegacyComparisonClaims
    ? [...text.matchAll(LEGACY_COMPARISON_BLOCK)].map((match) => ({
        start: match.index,
        end: match.index + match[0].length,
      }))
    : [];
  for (const match of text.matchAll(CLAIM)) {
    const path = match[2]
      .replace("https://api.superior.trade", "")
      .replace("https://unified-api-zag4gzx6gq-an.a.run.app", "")
      .split("?")[0]
      .replace(/[.:,)`]+$/, "");
    if (
      LEGACY_CLAIM_PATH.test(path) &&
      comparisonRanges.some(
        ({ start, end }) => match.index >= start && match.index < end,
      )
    ) {
      continue;
    }
    claims.set(`${match[1]} ${normalise(path)}`, true);
  }
  return claims;
}

export function findLegacyEndpointReferences(text) {
  return [...new Set(text.match(LEGACY_ENDPOINT) ?? [])];
}

export function findLegacyApiBaseReferences(text) {
  return [...new Set(text.match(LEGACY_API_BASE) ?? [])];
}

export function stripLegacyComparisonBlocks(text) {
  return text.replace(LEGACY_COMPARISON_BLOCK, "");
}
