const REPORT_VERSION = 1;
const DEFAULT_RETENTION_DAYS = 120;

/**
 * Add first-seen observations for the picks returned by a build. Source sites do
 * not consistently expose publish timestamps, so first-seen time is the
 * comparable signal across every source. A Covers relative "made" value is
 * retained separately when it can be converted to an approximate timestamp.
 */
export function trackPostingTimes(history, { sport, picks = [], observedAt = new Date() }) {
  const now = new Date(observedAt).toISOString();
  const existing = history?.observations && typeof history.observations === "object"
    ? history.observations
    : {};
  const observations = { ...existing };

  for (const pick of picks) {
    if (!pick.sourceId) continue;
    const id = observationId(sport, pick.sourceId, pick);
    const previous = observations[id];
    const sourcePublishedAt = relativePublishedAt(pick.made, observedAt);
    observations[id] = previous
      ? { ...previous, lastSeenAt: now, seenCount: (previous.seenCount || 1) + 1, startsAt: pick.startsAt || previous.startsAt || "" }
      : {
          sport,
          sourceId: pick.sourceId,
          source: pick.source,
          matchup: pick.matchup || "",
          selection: pick.selection || "",
          expert: pick.expert || "",
          startsAt: pick.startsAt || "",
          firstSeenAt: now,
          lastSeenAt: now,
          seenCount: 1,
          ...(sourcePublishedAt ? { sourcePublishedAt } : {})
        };
  }

  const cutoff = new Date(observedAt).getTime() - DEFAULT_RETENTION_DAYS * 86_400_000;
  for (const [id, observation] of Object.entries(observations)) {
    if (new Date(observation.lastSeenAt || observation.firstSeenAt).getTime() < cutoff) delete observations[id];
  }

  return { version: REPORT_VERSION, updatedAt: now, observations };
}

export function buildPostingTimeReport(history, { generatedAt = new Date(), timeZone = "America/New_York" } = {}) {
  const observations = Object.values(history?.observations || {});
  const grouped = new Map();

  for (const observation of observations) {
    if (!observation.firstSeenAt || !observation.sourceId) continue;
    const key = `${observation.sport}|${observation.sourceId}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(observation);
  }

  const sources = [...grouped.entries()].map(([key, entries]) => {
    const [sport, sourceId] = key.split("|");
    const published = entries.filter((entry) => entry.sourcePublishedAt);
    const basis = published.length === entries.length ? "source-published" : "first-observed";
    const timestamps = entries.map((entry) => basis === "source-published" ? entry.sourcePublishedAt : entry.firstSeenAt);
    const minutes = timestamps.map((timestamp) => minutesInZone(timestamp, timeZone)).filter(Number.isFinite);
    return {
      sport,
      sourceId,
      source: entries[0].source,
      timeBasis: basis,
      sampleCount: minutes.length,
      averagePostingTimeET: formatMinutes(average(minutes)),
      firstObservedAt: entries.reduce((earliest, entry) => !earliest || entry.firstSeenAt < earliest ? entry.firstSeenAt : earliest, ""),
      lastObservedAt: entries.reduce((latest, entry) => !latest || entry.lastSeenAt > latest ? entry.lastSeenAt : latest, "")
    };
  }).sort((a, b) => a.sport.localeCompare(b.sport) || a.source.localeCompare(b.source));

  return {
    version: REPORT_VERSION,
    generatedAt: new Date(generatedAt).toISOString(),
    timeZone,
    methodology: "Average time is based on each distinct pick's first observation. Covers uses its relative publish time only when every sampled pick supplies one; other sources use first-seen time. Scheduled checks determine the precision of first-seen results.",
    sources
  };
}

function observationId(sport, sourceId, pick) {
  return [sport, sourceId, pick.matchup || "", pick.market || "", pick.selection || "", pick.expert || ""].join("|").toLowerCase();
}

function relativePublishedAt(value, observedAt) {
  const match = `${value || ""}`.trim().match(/^(?:about\s+)?(?:(\d+)|an?)\s+(minute|hour)s?\s+ago$/i);
  if (!match) return "";
  const multiplier = match[2].toLowerCase() === "hour" ? 3_600_000 : 60_000;
  return new Date(new Date(observedAt).getTime() - Number(match[1] || 1) * multiplier).toISOString();
}

function minutesInZone(timestamp, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(timestamp));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return Number(values.hour) * 60 + Number(values.minute);
}

function average(values) {
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : NaN;
}

function formatMinutes(value) {
  if (!Number.isFinite(value)) return null;
  const total = Math.round(value) % 1_440;
  const hour = Math.floor(total / 60);
  const minute = total % 60;
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${suffix}`;
}
