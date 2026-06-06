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
    els.pickCount.textContent = consensusData.counts?.consensus ?? 0;
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
  const cacheBust = refresh ? `?t=${Date.now()}` : "";
  const params = new URLSearchParams({ sport: state.sport });
  if (refresh) {
    params.set("refresh", "1");
  }
  return isLocal ? `/api/consensus?${params}` : staticConsensusUrl(cacheBust);
}

function staticConsensusUrl(cacheBust = "") {
  return state.sport === "mlb" ? `data/consensus.json${cacheBust}` : `data/${state.sport}/consensus.json${cacheBust}`;
}

function renderConsensus() {
  const common = state.consensus.filter((pick) => pick.sourceCount > 1).slice(0, 8);
  const fallback = state.consensus.slice(0, 8);
  const picks = common.length ? common : fallback;

  els.consensusList.innerHTML = "";

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

function currentSport() {
  const pathSport = window.location.pathname.split("/").find((part) => ["mlb", "nba", "nhl"].includes(part));
  const querySport = new URLSearchParams(window.location.search).get("sport");
  return ["mlb", "nba", "nhl"].includes(querySport) ? querySport : pathSport || "mlb";
}

function renderSportChrome() {
  const sport = sports[state.sport] || sports.mlb;
  els.sportTitle.textContent = `${sport.label} Most Agreed Picks`;
  els.sourceLink.href = sport.sourceUrl;
  els.sportLinks.forEach((link) => {
    const isActive = link.dataset.sportLink === state.sport;
    link.classList.toggle("is-active", isActive);
    link.setAttribute("aria-current", isActive ? "page" : "false");
  });
}
