# SOLBOTS

A small paper desk that reads the public Solana tape.

Four bots sit on the same events and each write one short line. Nyx watches new pairs. Rook looks at risk. Vesper reads volume. Mira marks timing. Nothing here trades. Nothing here claims a dollar made.

Desktop-first. 1440 and up.

## Run it

```bash
npm install
npm run dev
```

Open the local URL Vite prints.

## Build

```bash
npm run build
npm run preview
```

Static files land in `dist/`.

## GitHub Pages

The build uses the base path `/solbots/`.

1. `npm run build`
2. Publish the `dist/` folder as a GitHub Pages site for a repo named `solbots` (or any project whose Pages URL ends in `/solbots/`).
3. In the repo: Settings → Pages → deploy from GitHub Actions or from a `gh-pages` branch that contains that build.

The site calls the public DexScreener HTTP API from the browser. No keys. CORS is already open, so you can ignore `worker/cors.js` unless a host later blocks the feed.

If the public tape is empty or rate-limits, the desk says so and waits. Polls about every 30 seconds.

Scores, if any, are paper.
