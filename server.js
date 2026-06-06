import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCoversPicks } from "./src/coversParser.js";
import { fetchConsensus, sportConfig, sports } from "./src/consensus.js";
import { fetchHtml } from "./src/utils.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const publicDir = join(__dirname, "public");
const port = Number(process.env.PORT || 3000);
const cache = new Map();

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

// All path forms that should serve the SPA shell (with and without trailing slash)
const sportSlugs = new Set(Object.keys(sports));

function isSportPath(pathname) {
  const slug = pathname.replace(/^\/|\/$/g, ""); // strip leading/trailing slashes
  return sportSlugs.has(slug);
}

function todayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function cacheForSport(sport) {
  const config = sportConfig(sport);
  if (!cache.has(config.id)) {
    cache.set(config.id, {
      dateKey: null,
      fetchedAt: null,
      payload: null,
      consensus: null
    });
  }
  return { config, entry: cache.get(config.id) };
}

async function fetchDailyPicks(sport, force = false) {
  const { config, entry } = cacheForSport(sport);
  const key = todayKey();
  const coversSource = config.sources.find((source) => source.id === "covers");

  if (!force && entry.dateKey === key && entry.payload) {
    return entry.payload;
  }

  const html = await fetchHtml(coversSource.url);
  const parsed = parseCoversPicks(html, { sport: config.id, sourceUrl: coversSource.url });
  entry.dateKey = key;
  entry.fetchedAt = new Date().toISOString();
  entry.payload = {
    ...parsed,
    sport: config.id,
    sportLabel: config.label,
    fetchedAt: entry.fetchedAt,
    cachedFor: key,
    sourceUrl: coversSource.url
  };

  return entry.payload;
}

async function fetchDailyConsensus(sport, force = false) {
  const { config, entry } = cacheForSport(sport);
  const key = todayKey();

  if (!force && entry.dateKey === key && entry.consensus) {
    return entry.consensus;
  }

  const payload = await fetchConsensus({ sport: config.id });
  entry.dateKey = key;
  entry.consensus = payload;
  return payload;
}

async function serveStatic(pathname, res) {
  // Sport landing pages (/nba, /nba/, /nhl, /nhl/, /mlb, /mlb/) all serve the
  // root index.html. app.js reads the sport from window.location at runtime so
  // no per-sport HTML file is needed on the local dev server.
  if (pathname === "/" || isSportPath(pathname)) {
    try {
      const body = await readFile(join(publicDir, "index.html"));
      res.writeHead(200, { "content-type": mimeTypes[".html"] });
      res.end(body);
    } catch {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("Not found");
    }
    return;
  }

  // Everything else: CSS, JS, JSON data files, etc.
  const safePath = normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(publicDir, safePath);

  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const body = await readFile(filePath);
    res.writeHead(200, { "content-type": mimeTypes[extname(filePath)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const sport = sportConfig(url.searchParams.get("sport") || url.pathname.replace(/^\/|\/$/g, "")).id;

  if (url.pathname === "/api/picks") {
    try {
      const data = await fetchDailyPicks(sport, url.searchParams.get("refresh") === "1");
      res.writeHead(200, {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
      });
      res.end(JSON.stringify(data));
    } catch (error) {
      res.writeHead(502, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({
        error: `Unable to fetch Covers ${sportConfig(sport).label} picks right now.`,
        detail: error.message,
        sourceUrl: sportConfig(sport).sources.find((source) => source.id === "covers")?.url
      }));
    }
    return;
  }

  if (url.pathname === "/api/consensus") {
    try {
      const data = await fetchDailyConsensus(sport, url.searchParams.get("refresh") === "1");
      res.writeHead(200, {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
      });
      res.end(JSON.stringify(data));
    } catch (error) {
      res.writeHead(502, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({
        error: `Unable to compare ${sportConfig(sport).label} picks right now.`,
        detail: error.message
      }));
    }
    return;
  }

  await serveStatic(url.pathname, res);
});

server.listen(port, () => {
  console.log(`Daily Expert Picks is running at http://localhost:${port}`);
});
