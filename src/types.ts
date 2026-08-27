export type TxnSplit = {
  buys: number;
  sells: number;
};

export type Pair = {
  id: string;
  pairAddress: string;
  name: string;
  symbol: string;
  quoteSymbol: string;
  priceUsd: number | null;
  liqUsd: number | null;
  vol: { m5: number; h1: number; h6: number; h24: number };
  txns: { m5: TxnSplit; h1: TxnSplit; h6: TxnSplit; h24: TxnSplit };
  change: { m5: number; h1: number; h6: number; h24: number };
  createdAt: number | null;
  firstSeenAt: number;
  isNewOnDesk: boolean;
};

export type BotId = "nyx" | "rook" | "vesper" | "mira";

export type BotLine = {
  bot: BotId;
  symbol: string;
  pairId: string;
  text: string;
  at: number;
};

export type TapeState = "live" | "empty" | "limited" | "error";

export type BotStatus = "scanning" | "watching" | "alert" | "hot" | "quiet" | "marking";
