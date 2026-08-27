import { useEffect, useMemo, useRef, useState } from "react";
import { loadTape, TapeError } from "./api";
import { botName, botRole, linesFor, statusFor, tickLines } from "./bots";
import { ageLabel, clock, money, pct, usdPrice } from "./format";
import type { BotId, BotLine, Pair, TapeState } from "./types";

const POLL_MS = 30_000;
const BOTS: BotId[] = ["nyx", "rook", "vesper", "mira"];

const MESSAGES: Record<TapeState, string> = {
  live: "",
  empty: "tape is empty. public feed sent nothing. waiting on the next poll.",
  limited: "public tape asked us to slow down. waiting.",
  error: "could not read the public tape. will retry.",
};

export function App() {
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [state, setState] = useState<TapeState>("live");
  const [note, setNote] = useState("");
  const [focusId, setFocusId] = useState<string | null>(null);
  const [feed, setFeed] = useState<BotLine[]>([]);
  const [latest, setLatest] = useState<Partial<Record<BotId, BotLine>>>({});
  const [now, setNow] = useState(() => Date.now());
  const [lastPoll, setLastPoll] = useState<number | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const seenPoll = useRef(false);
  const focusRef = useRef<string | null>(null);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    let gone = false;
    const run = async () => {
      try {
        const next = await loadTape();
        if (gone) return;
        if (!next.length) {
          setState("empty");
          setNote(MESSAGES.empty);
          setPairs([]);
          setLastPoll(Date.now());
          return;
        }
        setPairs(next);
        setState("live");
        setNote("");
        setLastPoll(Date.now());
        const t = Date.now();
        const spoken = tickLines(next, t);
        setLatest((prev) => {
          const copy = { ...prev };
          for (const line of spoken) copy[line.bot] = line;
          return copy;
        });
        setFeed((prev) => [...spoken, ...prev].slice(0, 80));
        const newborns = next.filter((p) => p.isNewOnDesk).map((p) => p.id);
        if (seenPoll.current && newborns.length) {
          setFresh(new Set(newborns));
          window.setTimeout(() => setFresh(new Set()), 1600);
        }
        seenPoll.current = true;
        if (!focusRef.current) {
          focusRef.current = next[0].id;
          setFocusId(next[0].id);
        }
      } catch (err) {
        if (gone) return;
        if (err instanceof TapeError) {
          setState(err.state);
          setNote(err.message);
        } else {
          setState("error");
          setNote(MESSAGES.error);
        }
      }
    };
    void run();
    const t = window.setInterval(() => void run(), POLL_MS);
    return () => {
      gone = true;
      window.clearInterval(t);
    };
  }, []);

  const focused = useMemo(
    () => pairs.find((p) => p.id === focusId) ?? pairs[0] ?? null,
    [pairs, focusId],
  );

  const focusLines = useMemo(
    () => (focused ? linesFor(focused, now) : []),
    [focused, now],
  );

  const ticker = pairs.slice(0, 18);

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <div className="wordmark">SOLBOTS</div>
          <div className={`live${state === "live" ? "" : " dim"}`}>
            <span className="dot" />
            {state === "live" ? "LIVE" : state === "limited" ? "WAIT" : "IDLE"}
          </div>
        </div>
        <div className="ticker" aria-hidden="true">
          <div className="ticker-track">
            {[0, 1].map((copy) => (
              <span key={copy} style={{ display: "flex", gap: 28 }}>
                {ticker.length === 0 ? (
                  <span>waiting on the public tape</span>
                ) : (
                  ticker.map((p) => (
                    <span key={`${copy}-${p.id}`}>
                      <b>{p.symbol}</b>{" "}
                      <span className={p.change.h1 >= 0 ? "up" : "dn"}>{pct(p.change.h1)}</span>
                    </span>
                  ))
                )}
              </span>
            ))}
          </div>
        </div>
        <div className="meta">
          <span>{lastPoll ? `poll ${clock(lastPoll)}` : "polling"}</span>
          <span className="paper">PAPER</span>
        </div>
      </header>

      <section className="tape">
        <div className="focus">
          {focused ? (
            <>
              <div className="focus-head">
                <div className="focus-title">
                  <h2>{focused.symbol}</h2>
                  <span className="pair">
                    {focused.name} · {focused.symbol}/{focused.quoteSymbol}
                  </span>
                </div>
                <div className="focus-stats">
                  <span>
                    age<strong>{ageLabel(focused.createdAt, now)}</strong>
                  </span>
                  <span>
                    liq<strong>{money(focused.liqUsd)}</strong>
                  </span>
                  <span>
                    vol 1h<strong>{money(focused.vol.h1)}</strong>
                  </span>
                  <span>
                    px<strong>{usdPrice(focused.priceUsd)}</strong>
                  </span>
                  <span>
                    1h
                    <strong className={focused.change.h1 >= 0 ? "up" : "dn"}>
                      {pct(focused.change.h1)}
                    </strong>
                  </span>
                </div>
              </div>
              <div className="bot-grid">
                {focusLines.map((line) => (
                  <div key={line.bot} className={`bot-line ${line.bot}`}>
                    <div className="who">{botName(line.bot)}</div>
                    <p>{line.text}</p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="empty-focus">{note || MESSAGES.empty}</p>
          )}
        </div>

        <div className="rows">
          <div className="cols">
            <span>pair</span>
            <span>age</span>
            <span>liq</span>
            <span>vol 1h</span>
            <span>px</span>
            <span>1h</span>
          </div>
          {pairs.length === 0 ? (
            <div className="banner">
              <strong>{state === "live" ? "loading tape" : state}</strong>
              <div>{note || "reading the public solana tape…"}</div>
            </div>
          ) : (
            pairs.map((p) => {
              const on = focused?.id === p.id;
              return (
                <button
                  key={p.id}
                  className={`row${on ? " on" : ""}${fresh.has(p.id) ? " fresh" : ""}`}
                  onClick={() => {
                    focusRef.current = p.id;
                    setFocusId(p.id);
                  }}
                >
                  <span className="sym">
                    <b>
                      {p.symbol}
                      <span className="muted"> / {p.quoteSymbol}</span>
                    </b>
                    <span>{p.name}</span>
                  </span>
                  <span className="num muted">{ageLabel(p.createdAt, now)}</span>
                  <span className="num">{money(p.liqUsd)}</span>
                  <span className="num">{money(p.vol.h1 || p.vol.h24)}</span>
                  <span className="num">{usdPrice(p.priceUsd)}</span>
                  <span className={`num ${p.change.h1 >= 0 ? "up" : "dn"}`}>{pct(p.change.h1)}</span>
                </button>
              );
            })
          )}
        </div>
      </section>

      <aside className="rail">
        <h3>bots</h3>
        {BOTS.map((id) => {
          const line = focused
            ? focusLines.find((l) => l.bot === id) ?? latest[id]
            : latest[id];
          const status = statusFor(id, pairs, now);
          return (
            <article key={id} className="bot-card">
              <header>
                <div>
                  <span className="nm">{botName(id)}</span>
                  <span className="role">{botRole(id)}</span>
                </div>
                <span className={`status ${status}`}>{status}</span>
              </header>
              <p className={line ? "" : "idle"}>{line?.text ?? "waiting for a print."}</p>
            </article>
          );
        })}
      </aside>

      <footer className="feed">
        <header>
          <span>activity</span>
          <span>four bots · one tape · paper only</span>
        </header>
        <div className="feed-list">
          {feed.length === 0 ? (
            <div className="feed-item">
              <time>—</time>
              <span className="who">desk</span>
              <span className="sym">—</span>
              <p>no lines yet. first poll is in flight.</p>
            </div>
          ) : (
            feed.map((line, i) => (
              <div key={`${line.at}-${line.bot}-${i}`} className={`feed-item ${line.bot}`}>
                <time>{clock(line.at)}</time>
                <span className="who">{botName(line.bot)}</span>
                <span className="sym">{line.symbol}</span>
                <p>{line.text}</p>
              </div>
            ))
          )}
        </div>
      </footer>
    </div>
  );
}
