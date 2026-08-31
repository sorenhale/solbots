import { useEffect, useMemo, useRef, useState } from "react";
import { loadTape, TapeError } from "./api";
import { botName, botRole, botsOnPrint, linesFor, rowHasHeat, statusFor, tickLines } from "./bots";
import { ageLabel, clock, isMover, isYoung, money, pct, usdPrice } from "./format";
import type { BotId, BotLine, Pair, TapeState } from "./types";

const POLL_MS = 30_000;
const BOTS: BotId[] = ["nyx", "rook", "vesper", "mira"];

type Filter = "all" | "young" | "movers";
type Sort = "age" | "vol";

const MESSAGES: Record<TapeState, string> = {
  live: "",
  empty: "tape is empty. public feed sent nothing. waiting on the next poll.",
  limited: "public tape asked us to slow down. waiting.",
  error: "could not read the public tape. will retry.",
};

function copySymbol(symbol: string): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
    return Promise.reject();
  }
  return navigator.clipboard.writeText(symbol);
}

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
  const [filter, setFilter] = useState<Filter>("young");
  const [sort, setSort] = useState<Sort>("age");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const seenPoll = useRef(false);
  const focusRef = useRef<string | null>(null);
  const copyTimer = useRef(0);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    return () => window.clearTimeout(copyTimer.current);
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

  const counts = useMemo(() => {
    let young = 0;
    let movers = 0;
    for (const p of pairs) {
      if (isYoung(p.createdAt, now)) young += 1;
      if (isMover(p.change.h1)) movers += 1;
    }
    return { all: pairs.length, young, movers };
  }, [pairs, now]);

  const visible = useMemo(() => {
    let list = pairs;
    if (filter === "young") list = list.filter((p) => isYoung(p.createdAt, now));
    else if (filter === "movers") list = list.filter((p) => isMover(p.change.h1));
    const sorted = [...list];
    if (sort === "age") {
      sorted.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    } else {
      sorted.sort((a, b) => (b.vol.h1 || b.vol.h24) - (a.vol.h1 || a.vol.h24));
    }
    return sorted;
  }, [pairs, filter, sort, now]);

  useEffect(() => {
    if (!visible.length) return;
    if (!visible.some((p) => p.id === focusRef.current)) {
      focusRef.current = visible[0].id;
      setFocusId(visible[0].id);
    }
  }, [visible]);

  const focused = useMemo(
    () => (visible.length ? (visible.find((p) => p.id === focusId) ?? visible[0]) : null),
    [visible, focusId],
  );

  const focusLines = useMemo(
    () => (focused ? linesFor(focused, now) : []),
    [focused, now],
  );

  const consensus = focused ? botsOnPrint(focused, now) : 0;

  const ticker = pairs.slice(0, 18);

  function pickPair(p: Pair) {
    focusRef.current = p.id;
    setFocusId(p.id);
    void copySymbol(p.symbol).then(
      () => {
        setCopiedId(p.id);
        window.clearTimeout(copyTimer.current);
        copyTimer.current = window.setTimeout(() => {
          setCopiedId((cur) => (cur === p.id ? null : cur));
        }, 1100);
      },
      () => {
        /* clipboard blocked — still focused */
      },
    );
  }

  const emptyFilter =
    filter === "young"
      ? "no pair younger than an hour."
      : filter === "movers"
        ? "no pair moved 20% this hour."
        : "nothing on this filter.";

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <div className="brand-text">
            <div className="wordmark">SOLBOTS</div>
            <div className="sub">paper desk</div>
          </div>
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
          <span>
            {pairs.length} {pairs.length === 1 ? "pair" : "pairs"}
          </span>
          <span>{lastPoll ? `poll ${clock(lastPoll)}` : "polling"}</span>
          <span className="paper">PAPER</span>
        </div>
      </header>

      <section className="tape">
        <div className="desk-bar">
          <div className="chips" role="tablist" aria-label="filter">
            <button
              className={`chip${filter === "all" ? " on" : ""}`}
              onClick={() => setFilter("all")}
            >
              ALL<span className="n">{counts.all}</span>
            </button>
            <button
              className={`chip${filter === "young" ? " on" : ""}`}
              onClick={() => setFilter("young")}
            >
              YOUNG (&lt;1h)<span className="n">{counts.young}</span>
            </button>
            <button
              className={`chip${filter === "movers" ? " on" : ""}`}
              onClick={() => setFilter("movers")}
            >
              MOVERS (|1h| &gt;= 20%)<span className="n">{counts.movers}</span>
            </button>
          </div>
          <span className="match">{visible.length} match</span>
          <div className="sort" aria-label="sort">
            <button className={sort === "age" ? "on" : ""} onClick={() => setSort("age")}>
              AGE
            </button>
            <button className={sort === "vol" ? "on" : ""} onClick={() => setSort("vol")}>
              VOL
            </button>
          </div>
        </div>

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
              {consensus >= 3 ? (
                <div className="consensus">{consensus} bots on this print</div>
              ) : null}
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
            <p className="empty-focus">{note || (pairs.length ? emptyFilter : MESSAGES.empty)}</p>
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
          ) : visible.length === 0 ? (
            <div className="banner">
              <strong>no match</strong>
              <div>{emptyFilter}</div>
            </div>
          ) : (
            visible.map((p) => {
              const on = focused?.id === p.id;
              const heat = rowHasHeat(p, now);
              return (
                <button
                  key={p.id}
                  className={`row${on ? " on" : ""}${fresh.has(p.id) ? " fresh" : ""}${heat ? " heat" : ""}`}
                  onClick={() => pickPair(p)}
                >
                  <span className="sym">
                    <b>
                      {p.symbol}
                      <span className="muted"> / {p.quoteSymbol}</span>
                      {copiedId === p.id ? <span className="copied">copied</span> : null}
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
