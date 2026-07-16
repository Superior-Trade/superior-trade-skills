#!/usr/bin/env node

const CHAINS = {
  arbitrum: {
    displayName: "Arbitrum One",
    chainId: 42161,
    nativeAsset: "ETH",
    tokens: {
      USDC: {
        symbol: "USDC",
        label: "native USDC",
        address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
        decimals: 6,
      },
    },
  },
  base: {
    displayName: "Base",
    chainId: 8453,
    nativeAsset: "ETH",
    tokens: {
      USDC: {
        symbol: "USDC",
        label: "native USDC",
        address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        decimals: 6,
      },
    },
  },
  avalanche: {
    displayName: "Avalanche C-Chain",
    chainId: 43114,
    nativeAsset: "AVAX",
    tokens: {
      USDC: {
        symbol: "USDC",
        label: "native USDC",
        address: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
        decimals: 6,
      },
    },
  },
  polygon: {
    displayName: "Polygon",
    chainId: 137,
    nativeAsset: "MATIC",
    tokens: {
      USDC: {
        symbol: "USDC",
        label: "native USDC",
        address: "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359",
        decimals: 6,
      },
      "USDC.E": {
        symbol: "USDC.e",
        label: "bridged USDC.e",
        address: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
        decimals: 6,
      },
    },
  },
  ethereum: {
    displayName: "Ethereum",
    chainId: 1,
    nativeAsset: "ETH",
    tokens: {
      USDC: {
        symbol: "USDC",
        label: "USDC",
        address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        decimals: 6,
      },
    },
  },
};

function usage() {
  console.error(`Usage:
  create-deposit-qr.mjs --address 0x... --chain arbitrum --asset USDC --amount 5
  create-deposit-qr.mjs --address 0x... --chain base --asset ETH --amount 0.01
  create-deposit-qr.mjs --address 0x... --chain 8453 --asset 0xToken --decimals 6 --amount 5`);
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith("--")) throw new Error(`Unexpected argument: ${key}`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${key}`);
    }
    args[key.slice(2)] = value;
    index += 1;
  }
  return args;
}

function normalizeChain(value) {
  const key = String(value ?? "").trim().toLowerCase();
  if (CHAINS[key]) return { key, ...CHAINS[key] };
  const byId = Object.entries(CHAINS).find(
    ([, chain]) => String(chain.chainId) === key,
  );
  if (byId) return { key: byId[0], ...byId[1] };
  throw new Error(`Unsupported chain: ${value}`);
}

function assertAddress(value, label) {
  if (!/^0x[a-fA-F0-9]{40}$/.test(value ?? "")) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
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

function resolveAsset(chain, asset, decimalsOverride) {
  const rawAsset = String(asset ?? "").trim();
  const upper = rawAsset.toUpperCase();
  if (!rawAsset) throw new Error("--asset is required");
  if (upper === chain.nativeAsset.toUpperCase()) {
    return {
      type: "native",
      symbol: chain.nativeAsset,
      label: chain.nativeAsset,
      decimals: 18,
      address: null,
    };
  }
  const token = chain.tokens[upper];
  if (token) return { type: "erc20", ...token };
  if (/^0x[a-fA-F0-9]{40}$/.test(rawAsset)) {
    return {
      type: "erc20",
      symbol: "TOKEN",
      label: "custom ERC-20 token",
      address: rawAsset,
      decimals: Number(decimalsOverride ?? 18),
    };
  }
  throw new Error(`Unsupported asset for ${chain.displayName}: ${asset}`);
}

function qrUrl(text) {
  return `https://quickchart.io/qr?size=360&text=${encodeURIComponent(text)}`;
}

try {
  const args = parseArgs(process.argv.slice(2));
  const address = args.address;
  assertAddress(address, "destination address");
  const chain = normalizeChain(args.chain);
  const asset = resolveAsset(chain, args.asset, args.decimals);
  const units = decimalUnits(args.amount, asset.decimals);
  const paymentUri =
    asset.type === "native"
      ? `ethereum:${address}@${chain.chainId}?value=${units}`
      : `ethereum:${asset.address}@${chain.chainId}/transfer?address=${address}&uint256=${units}`;
  const output = {
    summary: {
      destination: address,
      chain: chain.displayName,
      chain_id: chain.chainId,
      asset: asset.label,
      symbol: asset.symbol,
      token_address: asset.address,
      amount: args.amount,
      amount_units: units,
    },
    payment_uri: paymentUri,
    qr_url: qrUrl(paymentUri),
    plain_address_qr_url: qrUrl(address),
    markdown: `![Deposit QR](${qrUrl(paymentUri)})`,
  };
  console.log(JSON.stringify(output, null, 2));
} catch (error) {
  console.error(error.message);
  usage();
  process.exit(1);
}
