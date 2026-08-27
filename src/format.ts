export function money(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n < 0 ? "-" : "";
  const v = Math.abs(n);
  if (v >= 1_000_000) return `${sign}${(v / 1_000_000).toFixed(v >= 10_000_000 ? 1 : 2)}m`;
  if (v >= 1_000) return `${sign}${(v / 1_000).toFixed(v >= 10_000 ? 0 : 1)}k`;
  if (v >= 100) return `${sign}${v.toFixed(0)}`;
  if (v >= 1) return `${sign}${v.toFixed(2)}`;
  return `${sign}${v.toFixed(4)}`;
}

export function usdPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n >= 1) return n.toFixed(2);
  if (n >= 0.01) return n.toFixed(4);
  return n.toPrecision(3);
}

export function ageLabel(createdAt: number | null, now: number): string {
  if (createdAt == null || createdAt <= 0) return "—";
  const ms = Math.max(0, now - createdAt);
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

export function ageMs(createdAt: number | null, now: number): number | null {
  if (createdAt == null || createdAt <= 0) return null;
  return Math.max(0, now - createdAt);
}

export function clock(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export function pct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

export function sym(s: string): string {
  return (s || "?").toUpperCase();
}
