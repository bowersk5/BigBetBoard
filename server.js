import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCoversMlbPicks } from "./src/coversParser.js";
import { fetchMlbConsensus } from "./src/consensus.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const publicDir = join(__dirname, "public");
const sourceUrl = "https://www.covers.com/picks/mlb";
const port = Number(process.env.PORT || 3000);
const cache = {
  dateKey: null,
  fetchedAt: null,
  payload: null,
  consensus: null
};

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function todayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

async function fetchDailyPicks(force = false) {
  const key = todayKey();

  if (!force && cache.dateKey === key && cache.payload) {
    return cache.payload;
  }

  const response = await fetch(sourceUrl, {
    headers: {
      "accept": "text/html,application/xhtml+xml",
      "accept-language": "en-US,en;q=0.9",
      "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36"
    }
  });

  if (!response.ok) {
    throw new Error(`Covers returned ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const parsed = parseCoversMlbPicks(html, sourceUrl);
  cache.dateKey = key;
  cache.fetchedAt = new Date().toISOString();
  cache.payload = {
    ...parsed,
    fetchedAt: cache.fetchedAt,
    cachedFor: key,
    sourceUrl
  };

  return cache.payload;
}

async function fetchDailyConsensus(force = false) {
  const key = todayKey();

  if (!force && cache.dateKey === key && cache.consensus) {
    return cache.consensus;
  }

  const payload = await fetchMlbConsensus();
  cache.dateKey = key;
  cache.consensus = payload;
  return payload;
}

async function serveStatic(pathname, res) {
  const safePath = normalize(pathname === "/" ? "/index.html" : pathname).replace(/^(\.\.[/\\])+/, "");
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

  if (url.pathname === "/api/picks") {
    try {
      const data = await fetchDailyPicks(url.searchParams.get("refresh") === "1");
      res.writeHead(200, {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
      });
      res.end(JSON.stringify(data));
    } catch (error) {
      res.writeHead(502, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({
        error: "Unable to fetch Covers MLB picks right now.",
        detail: error.message,
        sourceUrl
      }));
    }
    return;
  }

  if (url.pathname === "/api/consensus") {
    try {
      const data = await fetchDailyConsensus(url.searchParams.get("refresh") === "1");
      res.writeHead(200, {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
      });
      res.end(JSON.stringify(data));
    } catch (error) {
      res.writeHead(502, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({
        error: "Unable to compare MLB picks right now.",
        detail: error.message
      }));
    }
    return;
  }

  await serveStatic(url.pathname, res);
});

server.listen(port, () => {
  console.log(`Covers Daily MLB Picks is running at http://localhost:${port}`);
});
