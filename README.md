# Daily Expert Picks Board

A zero-dependency Node.js dashboard that gathers public betting picks, normalizes them into a shared format, and highlights agreement between sources for MLB and the 2026 World Cup.

The production site is generated into `public/` and deployed through GitHub Pages. The local server uses the same frontend while providing live API endpoints for refreshing source data.

## Features

- Separate MLB and 2026 World Cup pages.
- Consensus cards grouped by matchup, market, and selection.
- Market views for Moneyline, Total, Spread, Prop, and Parlay when those markets are available. Baseball run lines are normalized into Spread.
- Game start times when supplied by a source.
- Source agreement, expert counts, odds samples, and expandable analysis.
- A collapsible parlay slip with combined American odds and estimated payout.
- Light and dark themes saved in local storage.
- A stale-data warning after generated data is more than 10 hours old.

There is no combined **All** market view. The first available market opens automatically, and each market displays every available card for that market. Source-pick totals in `consensus.json` describe the ingestion pool, not the number of cards displayed at once.

## Sports and Sources

Source configuration and parsers live in `src/consensus.js`.

### MLB

- [Covers](https://www.covers.com/picks/mlb)
- [Pickswise](https://www.pickswise.com/mlb/picks/)
- [Action Network](https://www.actionnetwork.com/mlb/picks/)
- [The Lines](https://www.thelines.com/picks/mlb/)

### 2026 World Cup

- [Covers](https://www.covers.com/picks/world-cup)
- [Pickswise](https://www.pickswise.com/world-cup/picks/)
- [Polymarket](https://polymarket.com/sports/world-cup/games)
- [SportsLine](https://www.sportsline.com/fifa-wc/picks/experts/)

Covers also supplies each sport's standalone `picks.json` payload. When a Covers page links to expanded matchup picks, the build follows those pages and merges their cards into the league-page results.

Polymarket contributes the highest current match-result probability for each World Cup game. SportsLine contributes only selections revealed in its public payload; subscriber-locked picks are never inferred or reproduced.

## Requirements

- Node.js 20 or newer.
- No dependency installation is required; the project uses Node built-ins and native `fetch`.

## Local Development

Run the tests, generate static data, and start the watch server:

```bash
npm test
npm run build:pages
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The server uses port `3000` by default. Set `PORT` to use a different port.

```bash
PORT=4000 npm start
```

## Routes

| Route | Description |
| --- | --- |
| `/` | MLB dashboard |
| `/world-cup/` | 2026 World Cup dashboard |
| `/api/picks?sport=mlb` | Live Covers MLB payload |
| `/api/picks?sport=world-cup` | Live Covers World Cup payload |
| `/api/consensus?sport=mlb` | Live multi-source MLB consensus |
| `/api/consensus?sport=world-cup` | Live multi-source World Cup consensus |

Add `refresh=1` to an API URL to bypass the local server's daily in-memory cache.

```text
/api/consensus?sport=world-cup&refresh=1
```

## npm Scripts

| Command | Purpose |
| --- | --- |
| `npm test` | Run the Node test suite |
| `npm run build:pages` | Fetch sources and generate the static GitHub Pages output |
| `npm start` | Start the local server |
| `npm run dev` | Start the local server with Node watch mode |

## How Consensus Works

Every source pick is normalized to a shared shape containing:

- matchup
- start time
- market
- selection
- odds
- expert
- analysis
- source

Normalized picks sharing the same matchup, market, and selection become one consensus entry. Confidence ranking favors:

1. Agreement across unique sources.
2. Agreement across unique experts.
3. A small recency bonus for picks published within four hours.

When a market contains cross-source agreement, the UI prioritizes those entries. If none agree, it falls back to the highest-ranked single-source entries. Visible cards are listed by game start time.

## Generated Data

`npm run build:pages` writes:

```text
public/data/picks.json
public/data/consensus.json
public/data/world-cup/picks.json
public/data/world-cup/consensus.json
public/world-cup/index.html
```

The root data files belong to MLB. World Cup output lives under `public/data/world-cup/`.

### `picks.json`

The Covers-only payload contains:

- `sport` and `sportLabel`
- `fetchedAt` and `sourceUrl`
- `games`
- `picks`
- `bestPicks`
- `counts`

Count fields have distinct meanings:

- `expertPicks` and `picks`: expert picks listed by Covers.
- `parsedPicks`: current expert cards successfully parsed.
- `computerPicks`: computer picks listed by Covers, when present.

The listed and parsed totals can differ when Covers exposes only teaser cards or changes its markup.

### `consensus.json`

The multi-source payload contains:

- `sport` and `sportLabel`
- `generatedAt`
- source status, errors, warnings, and parsed counts
- all normalized source `picks`
- grouped and ranked `consensus` entries
- aggregate `counts`

These aggregate counts describe processed data. They are not intended to equal the number of visible cards in one selected market.

Generated data and the World Cup subpage are ignored by Git because CI rebuilds them for deployment. The retired `history/` snapshot workflow must not be reintroduced unless archival output becomes an explicit requirement.

## Project Layout

```text
.
├── .github/workflows/pages.yml
├── public/
│   ├── app.js
│   ├── index.html
│   └── styles.css
├── scripts/
│   └── generateStaticData.js
├── src/
│   ├── consensus.js
│   ├── coversParser.js
│   └── utils.js
├── test/
│   ├── consensus.test.js
│   └── coversParser.test.js
├── package.json
└── server.js
```

- `public/index.html` is the MLB page and template for generated sport subpages.
- `public/app.js` selects the current sport, loads data, renders market filters, and manages the parlay and theme controls.
- `scripts/generateStaticData.js` fetches sources and produces deployable static files.
- `src/consensus.js` defines sports, source parsers, normalization, and consensus ranking.
- `src/coversParser.js` handles Covers league and expanded matchup markup.
- `src/utils.js` provides shared HTML and network helpers.
- `server.js` serves static assets and the local live-data APIs.

## Deployment

`.github/workflows/pages.yml` deploys the site:

- On pushes to `main` or `master`.
- On manual `workflow_dispatch` runs.
- Daily at `2:30 PM UTC` / `10:30 AM ET`.
- Daily at `10:00 PM UTC` / `6:00 PM ET`.

The workflow uses Node 22, runs the test suite, generates fresh static data, uploads `public/`, and deploys it to GitHub Pages.

## Parser Maintenance

These sources publish HTML for human-facing sites rather than stable public APIs, so parser maintenance is expected.

When a source count looks wrong:

1. Compare the live source page with its parser output.
2. Check both `picks.json` and `consensus.json`.
3. Review source `error` and `warning` fields.
4. Run `npm test`.
5. Run `npm run build:pages` and verify the generated sport page.

The build isolates source failures where possible. A failed consensus source should not prevent Covers-only `picks.json` from being written, and a sport-level consensus failure produces an empty placeholder rather than aborting every output file.
