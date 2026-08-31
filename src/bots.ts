import { ageMs, money } from "./format";
import type { BotId, BotLine, BotStatus, Pair } from "./types";

const NAMES: Record<BotId, string> = {
  nyx: "Nyx",
  rook: "Rook",
  vesper: "Vesper",
  mira: "Mira",
};

const ROLES: Record<BotId, string> = {
  nyx: "watcher",
  rook: "risk",
  vesper: "tape",
  mira: "timing",
};

export function botName(id: BotId): string {
  return NAMES[id];
}

export function botRole(id: BotId): string {
  return ROLES[id];
}

function tag(p: Pair): string {
  return p.symbol.toLowerCase();
}

export function speakNyx(p: Pair, now: number): string {
  const age = ageMs(p.createdAt, now);
  const s = tag(p);
  if (p.isNewOnDesk && age != null && age < 15 * 60_000) {
    return `${s} just appeared. ${Math.max(1, Math.round(age / 60_000))}m old. first time on this desk.`;
  }
  if (p.isNewOnDesk && age != null && age < 2 * 60 * 60_000) {
    return `${s} is new to the desk. listed ${Math.round(age / 60_000)}m ago.`;
  }
  if (p.isNewOnDesk) {
    return `${s} just hit the desk. not a fresh listing, but first look here.`;
  }
  if (age != null && age < 20 * 60_000) {
    return `${s} is young. ${Math.max(1, Math.round(age / 60_000))}m on the tape. still forming.`;
  }
  if (age != null && age < 3 * 60 * 60_000) {
    return `${s} has been up ${Math.round(age / 60_000)}m. not a birth, still early hours.`;
  }
  if (age != null && age < 24 * 60 * 60_000) {
    return `${s} is ${Math.round(age / 3_600_000)}h old. watcher marks it as known.`;
  }
  if (age != null) {
    return `${s} is an old pair. ${Math.round(age / 86_400_000)}d on the book. watching prints, not the listing.`;
  }
  return `${s} has no list time. treating it as already on the tape.`;
}

export function speakRook(p: Pair, now: number): string {
  const s = tag(p);
  const liq = p.liqUsd;
  const age = ageMs(p.createdAt, now);
  const swing = Math.max(Math.abs(p.change.m5), Math.abs(p.change.h1));
  if (liq == null) {
    if (swing >= 20) {
      return `${s} has no liq print and a ${swing.toFixed(0)}% swing. thin and loud.`;
    }
    return `${s} has no liq print. treat the book as empty.`;
  }
  if (liq < 4_000) {
    return `liq ${money(liq)} on ${s}. thin book. size will move it.`;
  }
  if (liq < 25_000 && age != null && age < 60 * 60_000) {
    return `liq ${money(liq)}, pair ${Math.max(1, Math.round(age / 60_000))}m old. early risk.`;
  }
  if (swing >= 40 && liq < 150_000) {
    return `liq ${money(liq)} but the hour swung ${swing.toFixed(0)}%. wild for this book.`;
  }
  if (liq > 250_000) {
    return `liq ${money(liq)} on ${s}. deeper book than most of this tape.`;
  }
  if (swing >= 15) {
    return `liq ${money(liq)}. ${swing.toFixed(0)}% hour. ordinary book, jumpy print.`;
  }
  return `liq ${money(liq)} on ${s}. ordinary book. no red flag, no all-clear.`;
}

export function speakVesper(p: Pair): string {
  const s = tag(p);
  const m5 = p.txns.m5;
  const h1 = p.txns.h1;
  const vol5 = p.vol.m5;
  const vol1 = p.vol.h1;
  if (vol5 === 0 && vol1 === 0) {
    return `${s} tape is dead. no volume on the hour.`;
  }
  if (m5.buys + m5.sells > 0) {
    const lead =
      m5.buys === m5.sells ? "even tape" : m5.buys > m5.sells ? "buys lead" : "sells lead";
    return `m5 ${money(vol5)} on ${s}. ${m5.buys} buys / ${m5.sells} sells. ${lead}.`;
  }
  if (h1.buys + h1.sells === 0) {
    return `hour volume ${money(vol1)} on ${s} but no txn split. tape is a lump.`;
  }
  const ratio = h1.buys / Math.max(1, h1.sells);
  if (ratio > 1.35) {
    return `h1 ${money(vol1)}. ${h1.buys} buys / ${h1.sells} sells. bid is working.`;
  }
  if (ratio < 0.74) {
    return `h1 ${money(vol1)}. ${h1.buys} buys / ${h1.sells} sells. offers are winning.`;
  }
  return `h1 ${money(vol1)}. ${h1.buys} buys / ${h1.sells} sells. two-way, mostly even.`;
}

export function speakMira(p: Pair, now: number): string {
  const s = tag(p);
  const age = ageMs(p.createdAt, now);
  const chg5 = p.change.m5;
  const chg1 = p.change.h1;
  const vol5 = p.vol.m5;
  const vol24 = p.vol.h24;
  const young = age != null && age < 45 * 60_000;
  const waking = vol24 > 0 && vol5 / vol24 > 0.12;
  const faded = Math.abs(chg5) < 2 && Math.abs(chg1) >= 20;
  const lateDay = vol24 > 0 && vol5 / vol24 < 0.02 && age != null && age > 6 * 3_600_000;

  if (young && (waking || vol5 > 0 || p.vol.h1 > 0)) {
    return `${s} looks early. young pair and the tape just woke.`;
  }
  if (young) {
    return `early clock, quiet tape. ${s} is listed but not running yet.`;
  }
  if (faded) {
    const dir = chg1 >= 0 ? "up" : "down";
    return `late. hour already ran ${dir} ${Math.abs(chg1).toFixed(0)}% and the last five are flat.`;
  }
  if (lateDay) {
    return `late in the move. 24h volume is spent and m5 is quiet.`;
  }
  if (Math.abs(chg1) >= 15 && vol5 > 0) {
    const dir = chg1 >= 0 ? "up" : "down";
    return `mid. ${dir} ${Math.abs(chg1).toFixed(0)}% on the hour and still printing.`;
  }
  if (Math.abs(chg1) >= 8) {
    return `mid-ish. ${s} already moved ${chg1 >= 0 ? "+" : ""}${chg1.toFixed(0)}% this hour.`;
  }
  return `no clean stage. ${s} is grinding, not a marked move.`;
}

export function linesFor(p: Pair, now: number): BotLine[] {
  return [
    { bot: "nyx", symbol: p.symbol, pairId: p.id, text: speakNyx(p, now), at: now },
    { bot: "rook", symbol: p.symbol, pairId: p.id, text: speakRook(p, now), at: now },
    { bot: "vesper", symbol: p.symbol, pairId: p.id, text: speakVesper(p), at: now },
    { bot: "mira", symbol: p.symbol, pairId: p.id, text: speakMira(p, now), at: now },
  ];
}

function scoreNyx(p: Pair, now: number): number {
  const age = ageMs(p.createdAt, now) ?? 9e15;
  return (p.isNewOnDesk ? 50 : 0) + Math.max(0, 40 - age / 60_000);
}

function scoreRook(p: Pair, now: number): number {
  const liq = p.liqUsd;
  const swing = Math.max(Math.abs(p.change.m5), Math.abs(p.change.h1));
  const thin = liq == null ? 40 : liq < 25_000 ? 30 : 0;
  const young = (ageMs(p.createdAt, now) ?? 9e15) < 60 * 60_000 ? 10 : 0;
  return thin + swing + young;
}

function scoreVesper(p: Pair): number {
  return p.vol.m5 * 4 + p.vol.h1 + (p.txns.m5.buys + p.txns.m5.sells) * 20;
}

function scoreMira(p: Pair, now: number): number {
  const age = ageMs(p.createdAt, now);
  const young = age != null && age < 45 * 60_000 ? 25 : 0;
  return young + Math.abs(p.change.h1) + (p.vol.m5 > 0 ? 10 : 0);
}

function pick(pairs: Pair[], score: (p: Pair) => number): Pair | null {
  if (!pairs.length) return null;
  return [...pairs].sort((a, b) => score(b) - score(a))[0] ?? null;
}

export function tickLines(pairs: Pair[], now: number): BotLine[] {
  const out: BotLine[] = [];
  const n = pick(pairs, (p) => scoreNyx(p, now));
  const r = pick(pairs, (p) => scoreRook(p, now));
  const v = pick(pairs, (p) => scoreVesper(p));
  const m = pick(pairs, (p) => scoreMira(p, now));
  if (n) out.push({ bot: "nyx", symbol: n.symbol, pairId: n.id, text: speakNyx(n, now), at: now });
  if (r) out.push({ bot: "rook", symbol: r.symbol, pairId: r.id, text: speakRook(r, now), at: now });
  if (v) out.push({ bot: "vesper", symbol: v.symbol, pairId: v.id, text: speakVesper(v), at: now });
  if (m) out.push({ bot: "mira", symbol: m.symbol, pairId: m.id, text: speakMira(m, now), at: now });
  return out;
}

export function statusFor(id: BotId, pairs: Pair[], now: number): BotStatus {
  if (!pairs.length) return "quiet";
  if (id === "nyx") {
    return pairs.some((p) => p.isNewOnDesk || (ageMs(p.createdAt, now) ?? 9e15) < 30 * 60_000)
      ? "scanning"
      : "quiet";
  }
  if (id === "rook") {
    const hot = pairs.some((p) => {
      const swing = Math.max(Math.abs(p.change.m5), Math.abs(p.change.h1));
      return p.liqUsd == null || p.liqUsd < 8_000 || swing >= 35;
    });
    return hot ? "alert" : "watching";
  }
  if (id === "vesper") {
    return pairs.some((p) => p.vol.m5 > 0) ? "hot" : "quiet";
  }
  return pairs.some((p) => Math.abs(p.change.h1) >= 12) ? "marking" : "watching";
}

const BOT_IDS: BotId[] = ["nyx", "rook", "vesper", "mira"];
const LOUD: ReadonlySet<BotStatus> = new Set(["alert", "hot", "marking", "scanning"]);

export function botsOnPrint(p: Pair, now: number): number {
  return BOT_IDS.filter((id) => LOUD.has(statusFor(id, [p], now))).length;
}

function nyxSaysYoungOrNew(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes("young") ||
    t.includes("new to the desk") ||
    t.includes("just appeared") ||
    t.includes("just hit the desk") ||
    t.includes("first time")
  );
}

export function rowHasHeat(p: Pair, now: number): boolean {
  if (statusFor("rook", [p], now) === "alert") return true;
  const lines = linesFor(p, now);
  const nyx = lines.find((l) => l.bot === "nyx")?.text ?? "";
  const mira = lines.find((l) => l.bot === "mira")?.text ?? "";
  return mira.toLowerCase().includes("early") && nyxSaysYoungOrNew(nyx);
}
