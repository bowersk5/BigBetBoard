# Daily Expert MLB Board

A zero-dependency Node.js dashboard that aggregates and cross-references daily MLB, NBA, and NHL betting picks from expert sources — **Covers**, **Pickswise**, and **Action Network** — and deploys automatically every morning as a static GitHub Pages site.

---

## How it works

1. A GitHub Actions workflow runs at **2:30 PM UTC** (10:30 AM ET) each day.
2. `scripts/generateStaticData.js` scrapes all configured pick sources, normalises the data, and writes JSON files into `public/data/`.
3. The script also generates sport subdirectory pages (`public/nba/index.html`, `public/nhl/index.html`) from the root `public/index.html` template.
4. The `public/` folder is deployed to GitHub Pages — no server required.
5. A local dev server (`server.js`) is also available for development; it fetches live data on demand and serves the same frontend.

### Sources

| Sport | Covers | Pickswise | Action Network |
|---|---|---|---|
| MLB | ✓ | ✓ | ✓ |
| NBA | ✓ | ✓ | — |
| NHL | ✓ | ✓ | — |

---

## Quick start

**Requirements:** Node.js ≥ 20 (uses the built-in `fetch` API — no `npm install` needed).

```bash
# Clone the repo
git clone https://github.com/bowersk5/DailyExpertMLBBoard.git
cd DailyExpertMLBBoard

# Run tests
npm test

# Generate today's static data files and sport pages
npm run build:pages

# Start the local dev server (live data, auto-restarts on file changes)
npm run dev
# → http://localhost:3000
```

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Port for the local dev server |

No API keys are required. The app scrapes publicly available web pages.

---

## Project structure

```
├── .github/workflows/pages.yml  # CI: test → generate → deploy
├── public/
│   ├── index.html               # Root page (MLB) — also used as template for sport subpages
│   ├── styles.css
│   ├── app.js                   # Frontend logic (vanilla JS)
│   └── data/
│       ├── picks.json           # Generated: MLB expert picks
│       ├── consensus.json       # Generated: MLB cross-source consensus
│       ├── nba/                 # Generated: NBA picks and consensus
│       └── nhl/                 # Generated: NHL picks and consensus
├── scripts/
│   └── generateStaticData.js    # Build script: generates JSON + sport subpages
├── src/
│   ├── coversParser.js          # HTML parser for Covers
│   ├── consensus.js             # Multi-source aggregator with sport-aware normalisation
│   └── utils.js                 # Shared: decodeEntities, fetchHtml
├── test/
│   ├── coversParser.test.js
│   └── consensus.test.js
└── server.js                    # Local dev server (not used in production)
```

---

## Deployment

The GitHub Actions workflow in `.github/workflows/pages.yml` handles everything:

- Triggers on push to `main`/`master`, on a daily schedule, and manually via **Actions → Run workflow**.
- Runs `npm test` before generating data — a test failure aborts the deploy.
- Generates JSON data files and per-sport HTML pages (`nba/`, `nhl/`) from the root index template.
- Uploads only the `public/` folder to GitHub Pages.

To trigger a one-off refresh without pushing a commit, go to **Actions → Deploy GitHub Pages → Run workflow**.

---

## Development notes

- **No npm dependencies.** The project relies exclusively on Node.js built-ins (`node:http`, `node:fs`, `node:path`) and the native `fetch` API (Node ≥ 18). There is no `package-lock.json` because there is nothing to lock.
- **Parsers are fragile by nature.** Scraping HTML is inherently brittle. If a source site redesigns its page, the corresponding parser in `src/` will need updating.
- **Consensus is best-effort.** If Pickswise or Action Network is unreachable during the build, the script writes an empty `consensus.json` and continues so the main picks page still deploys.
- **Sport-aware team normalisation.** `src/consensus.js` maintains a base abbreviation alias table plus per-sport overrides (e.g. `CHI` maps to `CHC` in MLB but stays `CHI` for the Bulls in NBA). Covers uses `VEG` for the Vegas Golden Knights; this is aliased to the canonical `VGK` used by other sources.
- **Generated files are gitignored.** `public/nba/`, `public/nhl/`, and their `data/` subdirectories are rebuilt by CI on every deploy and should not be committed.
