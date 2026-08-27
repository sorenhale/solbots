import type { Pair, TapeState, TxnSplit } from "./types";

const TAPE = "https://api.dexscreener.com";
const seen = new Map<string, number>();

type RawToken = {
  chainId?: string;
  tokenAddress?: string;
};

type RawPair = {
  chainId?: string;
  dexId?: string;
  pairAddress?: string;
  baseToken?: { name?: string; symbol?: string; address?: string };
  quoteToken?: { symbol?: string };
  priceUsd?: string | number;
  liquidity?: { usd?: number } | null;
  volume?: { m5?: number; h1?: number; h6?: number; h24?: number };
  txns?: {
    m5?: TxnSplit;
    h1?: TxnSplit;
    h6?: TxnSplit;
    h24?: TxnSplit;
  };
  priceChange?: { m5?: number; h1?: number; h6?: number; h24?: number };
  pairCreatedAt?: number;
};

export class TapeError extends Error {
  state: TapeState;
  constructor(state: TapeState, message: string) {
    super(message);
    this.state = state;
  }
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (res.status === 429) {
    throw new TapeError("limited", "public tape asked us to slow down. waiting.");
  }
  if (!res.ok) {
    throw new TapeError("error", `could not read the public tape (${res.status}). will retry.`);
  }
  return res.json();
}

function zeroSplit(): TxnSplit {
  return { buys: 0, sells: 0 };
}

function num(v: unknown): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : 0;
}

function normalize(raw: RawPair, now: number): Pair | null {
  if (!raw || raw.chainId !== "solana" || !raw.pairAddress) return null;
  const symbol = (raw.baseToken?.symbol || "").trim() || "???";
  const name = (raw.baseToken?.name || symbol).trim();
  const first = seen.get(raw.pairAddress);
  const isNewOnDesk = first == null;
  if (isNewOnDesk) seen.set(raw.pairAddress, now);
  return {
    id: raw.pairAddress,
    pairAddress: raw.pairAddress,
    name,
    symbol,
    quoteSymbol: (raw.quoteToken?.symbol || "SOL").trim(),
    priceUsd: raw.priceUsd == null || raw.priceUsd === "" ? null : num(raw.priceUsd) || null,
    liqUsd: raw.liquidity?.usd == null ? null : num(raw.liquidity.usd),
    vol: {
      m5: num(raw.volume?.m5),
      h1: num(raw.volume?.h1),
      h6: num(raw.volume?.h6),
      h24: num(raw.volume?.h24),
    },
    txns: {
      m5: raw.txns?.m5 ?? zeroSplit(),
      h1: raw.txns?.h1 ?? zeroSplit(),
      h6: raw.txns?.h6 ?? zeroSplit(),
      h24: raw.txns?.h24 ?? zeroSplit(),
    },
    change: {
      m5: num(raw.priceChange?.m5),
      h1: num(raw.priceChange?.h1),
      h6: num(raw.priceChange?.h6),
      h24: num(raw.priceChange?.h24),
    },
    createdAt: raw.pairCreatedAt && raw.pairCreatedAt > 0 ? raw.pairCreatedAt : null,
    firstSeenAt: seen.get(raw.pairAddress) ?? now,
    isNewOnDesk,
  };
}

function asList(data: unknown): RawToken[] {
  return Array.isArray(data) ? (data as RawToken[]) : [];
}

function asPairs(data: unknown): RawPair[] {
  if (Array.isArray(data)) return data as RawPair[];
  if (data && typeof data === "object" && Array.isArray((data as { pairs?: unknown }).pairs)) {
    return (data as { pairs: RawPair[] }).pairs;
  }
  return [];
}

function merge(into: Map<string, RawPair>, list: RawPair[]) {
  for (const p of list) {
    if (!p?.pairAddress || p.chainId !== "solana") continue;
    const prev = into.get(p.pairAddress);
    if (!prev) {
      into.set(p.pairAddress, p);
      continue;
    }
    const prevLiq = prev.liquidity?.usd ?? -1;
    const nextLiq = p.liquidity?.usd ?? -1;
    if (nextLiq > prevLiq) into.set(p.pairAddress, p);
  }
}

export async function loadTape(): Promise<Pair[]> {
  const now = Date.now();
  const [profiles, boosts] = await Promise.all([
    getJson(`${TAPE}/token-profiles/latest/v1`),
    getJson(`${TAPE}/token-boosts/latest/v1`),
  ]);

  const addrs = [
    ...new Set(
      [...asList(profiles), ...asList(boosts)]
        .filter((t) => t.chainId === "solana" && t.tokenAddress)
        .map((t) => t.tokenAddress as string),
    ),
  ].slice(0, 30);

  const bag = new Map<string, RawPair>();

  if (addrs.length) {
    const tokenPairs = await getJson(`${TAPE}/tokens/v1/solana/${addrs.join(",")}`);
    merge(bag, asPairs(tokenPairs));
  }

  // Search fills in older / deeper books the profile lists miss.
  const search = await getJson(`${TAPE}/latest/dex/search?q=SOL`);
  merge(bag, asPairs(search));

  const pairs = [...bag.values()]
    .map((p) => normalize(p, now))
    .filter((p): p is Pair => p != null);

  pairs.sort((a, b) => {
    const aNew = a.isNewOnDesk ? 1 : 0;
    const bNew = b.isNewOnDesk ? 1 : 0;
    if (aNew !== bNew) return bNew - aNew;
    const aAge = a.createdAt ?? 0;
    const bAge = b.createdAt ?? 0;
    if (aAge !== bAge) return bAge - aAge;
    return (b.vol.h1 || b.vol.h24) - (a.vol.h1 || a.vol.h24);
  });

  return pairs;
}

