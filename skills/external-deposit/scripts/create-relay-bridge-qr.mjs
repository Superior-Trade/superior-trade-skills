#!/usr/bin/env node

const RELAY_API = process.env.RELAY_API ?? "https://api.relay.link";

const CHAINS = {
  ethereum: {
    id: 1,
    relayPath: "ethereum",
    tokens: {
      USDC: {
        address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        decimals: 6,
      },
    },
  },
  arbitrum: {
    id: 42161,
    relayPath: "arbitrum",
    tokens: {
      USDC: {
        address: "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
        decimals: 6,
      },
    },
  },
  base: {
    id: 8453,
    relayPath: "base",
    tokens: {
      USDC: {
        address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
        decimals: 6,
      },
    },
  },
  avalanche: {
    id: 43114,
    relayPath: "avalanche",
    tokens: {
      USDC: {
        address: "0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e",
        decimals: 6,
      },
    },
  },
  polygon: {
    id: 137,
    relayPath: "polygon",
    tokens: {
      USDC: {
        address: "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359",
        decimals: 6,
      },
      "USDC.E": {
        address: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
        decimals: 6,
      },
      PUSD: {
        address: "0xC011a7E12a19f7B1f670d46F03B03f3342E82DFB",
        decimals: 6,
      },
    },
  },
  robinhood: {
    id: 4663,
    relayPath: "robinhood",
    tokens: {
      USDG: {
        address: "0x5fc5360d0400a0fd4f2af552add042d716f1d168",
        decimals: 6,
      },
    },
  },
};

function usage() {
  console.error(`Usage:
  create-relay-bridge-qr.mjs \\
    --from-chain arbitrum \\
    --from-token USDC \\
    --to-chain robinhood \\
    --to-token USDG \\
    --wallet metamask \\
    --wallet trust \\
    --wallet okx \\
    --recipient 0x... \\
    --to-amount 20 \\
    --quote

Notes:
  * The QR opens Relay's UI in MetaMask Mobile; it does not encode transaction calldata.
  * Supported chains include ethereum, arbitrum, base, avalanche, polygon, and robinhood.
  * Polygon tokens include USDC, USDC.e, and pUSD.
  * Supported wallets: metamask, trust, okx, plain. Defaults to metamask and plain.
  * --recipient and --to-amount are included in the Relay URL as toAddress, amount, and tradeType=EXPECTED_OUTPUT.
`);
}

function parseArgs(argv) {
  const args = { wallet: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith("--")) throw new Error(`Unexpected argument: ${key}`);
    if (key === "--quote") {
      args.quote = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${key}`);
    }
    const name = key.slice(2);
    if (name === "wallet") {
      args.wallet.push(value);
    } else {
      args[name] = value;
    }
    index += 1;
  }
  return args;
}

function assertAddress(value, label) {
  if (!/^0x[a-fA-F0-9]{40}$/.test(value ?? "")) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
}

function resolveChain(value, label) {
  const key = String(value ?? "").trim().toLowerCase();
  const chain = CHAINS[key];
  if (chain) return { key, ...chain };
  const byId = Object.entries(CHAINS).find(([, candidate]) => String(candidate.id) === key);
  if (byId) return { key: byId[0], ...byId[1] };
  throw new Error(`Unsupported ${label}: ${value}`);
}

function resolveToken(chain, value, label) {
  const raw = String(value ?? "").trim();
  if (!raw) throw new Error(`${label} is required`);
  const token = chain.tokens[raw.toUpperCase()];
  if (token) return { symbol: raw.toUpperCase(), ...token };
  assertAddress(raw, label);
  return {
    symbol: "TOKEN",
    address: raw,
    decimals: 18,
  };
}

function decimalUnits(amount, decimals) {
  if (!/^\d+(?:\.\d+)?$/.test(amount)) {
    throw new Error(`Invalid amount: ${amount}`);
  }
  const [whole, fraction = ""] = amount.split(".");
  if (fraction.length > decimals) {
    throw new Error(`Amount has more than ${decimals} decimals`);
  }
  return (
    BigInt(whole) * 10n ** BigInt(decimals) +
    BigInt(fraction.padEnd(decimals, "0") || "0")
  ).toString();
}

function qrUrl(text) {
  return `https://quickchart.io/qr?size=360&text=${encodeURIComponent(text)}`;
}

function uniqueWallets(wallets) {
  const requested = wallets.length > 0 ? wallets : ["metamask", "plain"];
  const seen = new Set();
  return requested
    .map((wallet) => wallet.trim().toLowerCase())
    .filter((wallet) => {
      if (!wallet) return false;
      if (seen.has(wallet)) return false;
      seen.add(wallet);
      return true;
    });
}

function walletUrl(wallet, relayUrl) {
  const encoded = encodeURIComponent(relayUrl);
  switch (wallet) {
    case "metamask":
      return `https://link.metamask.io/dapp/${encoded}`;
    case "trust":
      return `https://link.trustwallet.com/open_url?coin_id=60&url=${encoded}`;
    case "okx":
      return `okx://wallet/dapp/url?dappUrl=${encoded}`;
    case "plain":
      return relayUrl;
    default:
      throw new Error(`Unsupported wallet: ${wallet}`);
  }
}

function relayBridgeUrl(args, fromChain, toChain, fromToken, toToken) {
  const url = new URL(`https://relay.link/bridge/${toChain.relayPath}`);
  url.searchParams.set("toCurrency", toToken.address);
  url.searchParams.set("fromChainId", String(fromChain.id));
  url.searchParams.set("fromCurrency", fromToken.address);
  if (args.recipient) {
    assertAddress(args.recipient, "recipient");
    url.searchParams.set("toAddress", args.recipient);
  }
  if (args["to-amount"]) {
    url.searchParams.set("amount", args["to-amount"]);
    url.searchParams.set("tradeType", "EXPECTED_OUTPUT");
  }
  return url.toString();
}

function paymentUri(chain, token, recipient, amount) {
  assertAddress(recipient, "recipient");
  return (
    `ethereum:${token.address}@${chain.id}/transfer` +
    `?address=${recipient}` +
    `&uint256=${decimalUnits(amount, token.decimals)}`
  );
}

function directWalletUrl(wallet, paymentUriValue) {
  switch (wallet) {
    case "metamask":
    case "trust":
    case "okx":
    case "plain":
      return paymentUriValue;
    default:
      throw new Error(`Unsupported wallet: ${wallet}`);
  }
}

async function relayQuote(args, fromChain, toChain, fromToken, toToken) {
  if (!args.recipient || !args["to-amount"]) return null;
  assertAddress(args.recipient, "recipient");

  const response = await fetch(`${RELAY_API}/quote`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      user: args.user ?? args.recipient,
      recipient: args.recipient,
      originChainId: fromChain.id,
      destinationChainId: toChain.id,
      originCurrency: fromToken.address,
      destinationCurrency: toToken.address,
      amount: decimalUnits(args["to-amount"], Number(args["to-decimals"] ?? toToken.decimals)),
      tradeType: "EXACT_OUTPUT",
    }),
  });
  const quote = await response.json();
  if (!response.ok || quote.error) {
    throw new Error(`Relay quote failed: ${JSON.stringify(quote, null, 2)}`);
  }

  return {
    request_id: quote.steps?.[0]?.requestId,
    spend: quote.details?.currencyIn,
    receive: quote.details?.currencyOut,
    gas: quote.fees?.gas,
    relayer: quote.fees?.relayer,
    status_url: `${RELAY_API}/intents/status?requestId=${quote.steps?.[0]?.requestId}`,
  };
}

try {
  const args = parseArgs(process.argv.slice(2));
  const fromChain = resolveChain(args["from-chain"], "from-chain");
  const toChain = resolveChain(args["to-chain"], "to-chain");
  const fromToken = resolveToken(fromChain, args["from-token"], "from-token");
  const toToken = resolveToken(toChain, args["to-token"], "to-token");
  const sameChain = fromChain.id === toChain.id;
  const sameToken = fromToken.address.toLowerCase() === toToken.address.toLowerCase();

  const relayUrl = relayBridgeUrl(args, fromChain, toChain, fromToken, toToken);
  const paymentUriValue =
    sameChain && sameToken && args.recipient && args["to-amount"]
      ? paymentUri(fromChain, fromToken, args.recipient, args["to-amount"])
      : null;
  const walletLinks = uniqueWallets(args.wallet).map((wallet) => {
    const url = paymentUriValue
      ? directWalletUrl(wallet, paymentUriValue)
      : walletUrl(wallet, relayUrl);
    return {
      wallet,
      url,
      qr_url: qrUrl(url),
      markdown: `![${wallet} Relay Deposit QR](${qrUrl(url)})`,
    };
  });
  const defaultLink =
    walletLinks.find((link) => link.wallet === "metamask") ?? walletLinks[0];
  const quote = args.quote && !paymentUriValue
    ? await relayQuote(args, fromChain, toChain, fromToken, toToken)
    : null;

  console.log(
    JSON.stringify(
      {
        summary: {
          from_chain: fromChain.key,
          from_chain_id: fromChain.id,
          from_currency: fromToken.address,
          to_chain: toChain.key,
          to_chain_id: toChain.id,
          to_currency: toToken.address,
          recipient: args.recipient ?? null,
          to_amount: args["to-amount"] ?? null,
        },
        mode: paymentUriValue ? "direct_erc20_transfer" : "relay_bridge",
        relay_url: paymentUriValue ? null : relayUrl,
        payment_uri: paymentUriValue,
        wallet_links: walletLinks,
        metamask_mobile_url:
          walletLinks.find((link) => link.wallet === "metamask")?.url ?? null,
        qr_url: defaultLink.qr_url,
        markdown: defaultLink.markdown,
        quote,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(error.message);
  usage();
  process.exit(1);
}
