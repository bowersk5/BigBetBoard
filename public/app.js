const state = {
  sport: currentSport(),
  consensus: []
};

const sports = {
  mlb: { label: "MLB", sourceUrl: "https://www.covers.com/picks/mlb" },
  nba: { label: "NBA", sourceUrl: "https://www.covers.com/picks/nba" },
  nhl: { label: "NHL", sourceUrl: "https://www.covers.com/picks/nhl" }
};

const els = {
  refreshButton: document.querySelector("#refreshButton"),
  sourceLink: document.querySelector("#sourceLink"),
  fetchedAt: document.querySelector("#fetchedAt"),
  gameCount: document.querySelector("#gameCount"),
  pickCount: document.querySelector("#pickCount"),
  sportTitle: document.querySelector("#sportTitle"),
  consensusIntro: document.querySelector("#consensusIntro"),
  consensusList: document.querySelector("#consensusList"),
  consensusTemplate: document.querySelector("#consensusTemplate"),
  sportLinks: document.querySelectorAll("[data-sport-link]")
};

async function loadConsensus(refresh = false) {
  setLoading(true);
  try {
    const consensusResponse = await fetch(consensusUrl(refresh));
    const consensusData = await consensusResponse.json();

    if (!consensusResponse.ok) {
      throw new Error(consensusData.detail || consensusData.error || "Unable to compare picks.");
    }

    state.consensus = consensusData.consensus || [];
    state.sport = consensusData.sport || state.sport;

    renderSportChrome();
    els.fetchedAt.textContent = formatDate(consensusData.generatedAt);
    els.gameCount.textContent = consensusData.counts?.activeSources ?? 0;
    els.consensusIntro.textContent = consensusSummary(consensusData);

    renderConsensus();
  } catch (error) {
    els.consensusList.innerHTML = `<div class="empty">Could not compare picks — ${escapeHtml(error.message)}</div>`;
  } finally {
    setLoading(false);
  }
}

function consensusUrl(refresh = false) {
  const isLocal = ["localhost", "127.0.0.1", ""].includes(window.location.hostname);
  const params = new URLSearchParams({ sport: state.sport });
  if (refresh) {
    params.set("refresh", "1");
  }
  if (isLocal) {
    return `/api/consensus?${params}`;
  }
  const cacheBust = refresh ? `?t=${Date.now()}` : "";
  return staticConsensusUrl(cacheBust);
}

function staticConsensusUrl(cacheBust = "") {
  // Resolve relative to the root of the site regardless of which subdirectory
  // this script is loaded from. The data files are always at:
  //   data/consensus.json          (MLB)
  //   data/nba/consensus.json      (NBA)
  //   data/nhl/consensus.json      (NHL)
  const base = siteRoot();
  return state.sport === "mlb"
    ? `${base}data/consensus.json${cacheBust}`
    : `${base}data/${state.sport}/consensus.json${cacheBust}`;
}

/**
 * Returns an absolute URL prefix pointing at the site root, so data fetches
 * work identically whether the page is at / or /nba/ or /nhl/.
 */
function siteRoot() {
  const { protocol, host, pathname } = window.location;
  // pathname is e.g. "/" or "/nba/" or "/DailyExpertMLBBoard/nba/"
  const parts = pathname.split("/").filter(Boolean);
  // Drop any trailing sport segment so we get back to the repo root
  const sportSegments = new Set(["mlb", "nba", "nhl"]);
  const rootParts = parts.filter((p) => !sportSegments.has(p));
  const rootPath = rootParts.length ? `/${rootParts.join("/")}/` : "/";
  return `${protocol}//${host}${rootPath}`;
}

function renderConsensus() {
  const common = state.consensus.filter((pick) => pick.sourceCount > 1).slice(0, 8);
  const fallback = state.consensus.slice(0, 8);
  const picks = common.length ? common : fallback;

  els.consensusList.innerHTML = "";
  // Update the badge to reflect what's actually rendered, not the raw JSON count
  els.pickCount.textContent = picks.length;

  if (!picks.length) {
    els.consensusList.innerHTML = '<div class="empty">No consensus picks available right now.</div>';
    return;
  }

  picks.forEach((pick, i) => {
    const node = els.consensusTemplate.content.cloneNode(true);
    const card = node.querySelector(".consensus-card");
    const market = pick.market || "Other";
    card.style.animationDelay = `${i * 50}ms`;
    card.setAttribute("data-market", market);

    node.querySelector(".market").textContent = market;
    node.querySelector(".agreement").textContent = pick.agreement;
    node.querySelector(".selection").textContent = pick.selection;
    node.querySelector(".matchup").textContent = pick.matchup;
    node.querySelector(".source-count") && (node.querySelector(".source-count").textContent = pick.sourceCount);
    node.querySelector(".pick-count").textContent = pick.pickCount;
    node.querySelector(".source-list").textContent = pick.sources.map((s) => s.name).join(" · ");
    node.querySelector(".example-list").textContent = sampleExamples(pick.examples);

    els.consensusList.append(node);
  });
}

function setLoading(isLoading) {
  els.refreshButton.disabled = isLoading;
  els.refreshButton.innerHTML = isLoading
    ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 1s linear infinite"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg> Loading`
    : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg> Refresh`;
}

function consensusSummary(data) {
  const sources = (data.sources || []).filter((s) => !s.error && s.picks > 0);
  const names = sources.map((s) => s.name).join(", ");
  return `${data.counts?.picks || 0} ${data.sportLabel || sports[state.sport].label} expert picks across ${names || "available sources"}.`;
}

function sampleExamples(examples = []) {
  return examples
    .slice(0, 3)
    .map((e) => `${e.source}${e.expert ? ` (${e.expert})` : ""}${e.odds ? ` ${e.odds}` : ""}`)
    .join(" · ");
}

function formatDate(value) {
  if (!value) return "Unknown";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function escapeHtml(value) {
  return `${value}`.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
}

const style = document.createElement("style");
style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
document.head.append(style);

renderSportChrome();
els.refreshButton.addEventListener("click", () => loadConsensus(true));

loadConsensus();

/**
 * Detect sport from the URL path. Works for both:
 *   /                     → mlb  (root index.html)
 *   /nba/                 → nba  (subdirectory page)
 *   /DailyExpertMLBBoard/nba/  → nba  (GitHub Pages with repo prefix)
 * Falls back to the ?sport= query param for local dev server.
 */
function currentSport() {
  const pathParts = window.location.pathname.split("/").filter(Boolean);
  const sportFromPath = pathParts.find((part) => ["mlb", "nba", "nhl"].includes(part));
  if (sportFromPath) return sportFromPath;

  const querySport = new URLSearchParams(window.location.search).get("sport");
  if (["mlb", "nba", "nhl"].includes(querySport)) return querySport;

  return "mlb";
}

function renderSportChrome() {
  const sport = sports[state.sport] || sports.mlb;
  els.sportTitle.textContent = `${sport.label} Most Agreed Picks`;
  els.sourceLink.href = sport.sourceUrl;

  // Mark the active tab by matching data-sport-link to the current sport
  els.sportLinks.forEach((link) => {
    const isActive = link.dataset.sportLink === state.sport;
    link.classList.toggle("is-active", isActive);
    link.setAttribute("aria-current", isActive ? "page" : "false");
  });
}
