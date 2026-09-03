import assert from "node:assert/strict";
import { execFile, execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { promisify } from "node:util";
import test from "node:test";

const script = new URL("./create-relay-bridge-qr.mjs", import.meta.url);
const execFileAsync = promisify(execFile);

function run(args) {
  return JSON.parse(execFileSync("node", [script.pathname, ...args], {
    encoding: "utf8",
  }));
}

async function runAsync(args, env = {}) {
  const { stdout } = await execFileAsync("node", [script.pathname, ...args], {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
  return JSON.parse(stdout);
}

test("emits wallet-specific links and QR URLs for selected wallets", () => {
  const output = run([
    "--from-chain",
    "arbitrum",
    "--from-token",
    "USDC",
    "--to-chain",
    "robinhood",
    "--to-token",
    "USDG",
    "--wallet",
    "metamask",
    "--wallet",
    "trust",
    "--wallet",
    "okx",
    "--wallet",
    "plain",
  ]);

  const walletLinks = Object.fromEntries(
    output.wallet_links.map((link) => [link.wallet, link]),
  );

  assert.equal(walletLinks.metamask.url.startsWith("https://link.metamask.io/dapp/"), true);
  assert.equal(walletLinks.trust.url.startsWith("https://link.trustwallet.com/open_url?"), true);
  assert.equal(walletLinks.okx.url.startsWith("okx://wallet/dapp/url?dappUrl="), true);
  assert.equal(walletLinks.plain.url, output.relay_url);
  assert.match(walletLinks.metamask.qr_url, /^https:\/\/quickchart\.io\/qr\?/);
  assert.equal(output.metamask_mobile_url, walletLinks.metamask.url);
  assert.equal(output.qr_url, walletLinks.metamask.qr_url);
});

test("defaults to metamask and plain wallet links", () => {
  const output = run([
    "--from-chain",
    "arbitrum",
    "--from-token",
    "USDC",
    "--to-chain",
    "robinhood",
    "--to-token",
    "USDG",
  ]);

  assert.deepEqual(
    output.wallet_links.map((link) => link.wallet),
    ["metamask", "plain"],
  );
});

test("prefills Relay output amount and recipient when provided", () => {
  const recipient = "0xF45571f8895A75a3c417a05dF0Eb78eeF68eF2C6";
  const output = run([
    "--from-chain",
    "arbitrum",
    "--from-token",
    "USDC",
    "--to-chain",
    "robinhood",
    "--to-token",
    "USDG",
    "--recipient",
    recipient,
    "--to-amount",
    "20",
    "--wallet",
    "metamask",
    "--wallet",
    "plain",
  ]);

  const relayUrl = new URL(output.relay_url);
  assert.equal(relayUrl.searchParams.get("amount"), "20");
  assert.equal(relayUrl.searchParams.get("tradeType"), "EXPECTED_OUTPUT");
  assert.equal(relayUrl.searchParams.get("toAddress"), recipient);
  assert.equal(output.wallet_links[1].url, output.relay_url);
  assert.equal(
    decodeURIComponent(output.wallet_links[0].url.replace("https://link.metamask.io/dapp/", "")),
    output.relay_url,
  );
});

test("uses direct ERC20 transfer links when source and destination chain match", () => {
  const recipient = "0xF60CA00ef5e510137bC09691b52BA7863F52158F";
  const output = run([
    "--from-chain",
    "arbitrum",
    "--from-token",
    "USDC",
    "--to-chain",
    "arbitrum",
    "--to-token",
    "USDC",
    "--recipient",
    recipient,
    "--to-amount",
    "20",
    "--wallet",
    "metamask",
    "--wallet",
    "plain",
    "--quote",
  ]);

  assert.equal(output.mode, "direct_erc20_transfer");
  assert.equal(output.relay_url, null);
  assert.equal(output.quote, null);
  assert.equal(
    output.payment_uri,
    `ethereum:0xaf88d065e77c8cc2239327c5edb3a432268e5831@42161/transfer?address=${recipient}&uint256=20000000`,
  );
  assert.deepEqual(
    output.wallet_links.map((link) => link.wallet),
    ["metamask", "plain"],
  );
  assert.equal(output.wallet_links[0].url, output.payment_uri);
  assert.equal(output.wallet_links[1].url, output.payment_uri);
});

test("resolves Polygon USDC, USDC.e, and pUSD for direct transfer links", () => {
  const recipient = "0xF60CA00ef5e510137bC09691b52BA7863F52158F";
  const cases = [
    ["USDC", "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359"],
    ["USDC.e", "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"],
    ["pUSD", "0xC011a7E12a19f7B1f670d46F03B03f3342E82DFB"],
  ];

  for (const [symbol, address] of cases) {
    const output = run([
      "--from-chain",
      "polygon",
      "--from-token",
      symbol,
      "--to-chain",
      "137",
      "--to-token",
      symbol,
      "--recipient",
      recipient,
      "--to-amount",
      "5.25",
    ]);

    assert.equal(output.mode, "direct_erc20_transfer");
    assert.equal(output.summary.from_chain_id, 137);
    assert.equal(output.summary.from_currency, address);
    assert.equal(
      output.payment_uri,
      `ethereum:${address}@137/transfer?address=${recipient}&uint256=5250000`,
    );
  }
});

test("sends address strings and resolved token decimals to Relay quotes", async () => {
  let requestBody;
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    requestBody = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({
      steps: [{ requestId: "0xabc" }],
      details: {
        currencyIn: { amountFormatted: "20.1" },
        currencyOut: { amountFormatted: "20" },
      },
      fees: {
        gas: { amountFormatted: "0.000001" },
        relayer: { amountFormatted: "0.06" },
      },
    }));
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    await runAsync([
      "--from-chain",
      "arbitrum",
      "--from-token",
      "USDC",
      "--to-chain",
      "robinhood",
      "--to-token",
      "USDG",
      "--recipient",
      "0xF60CA00ef5e510137bC09691b52BA7863F52158F",
      "--to-amount",
      "20",
      "--quote",
    ], { RELAY_API: `http://127.0.0.1:${port}` });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  assert.equal(requestBody.originCurrency, "0xaf88d065e77c8cc2239327c5edb3a432268e5831");
  assert.equal(requestBody.destinationCurrency, "0x5fc5360d0400a0fd4f2af552add042d716f1d168");
  assert.equal(requestBody.amount, "20000000");
});
