import test from "node:test";
import assert from "node:assert/strict";
import { buildPostingTimeReport, trackPostingTimes } from "../src/postingTimes.js";

test("records a pick once and reports the first-seen posting average", () => {
  const firstRun = trackPostingTimes({ observations: {} }, {
    sport: "mlb",
    observedAt: "2026-07-29T14:30:00.000Z",
    picks: [{ sourceId: "pickswise", source: "Pickswise", matchup: "DET @ CHW", market: "Moneyline", selection: "DET", expert: "Pickswise" }]
  });
  const secondRun = trackPostingTimes(firstRun, {
    sport: "mlb",
    observedAt: "2026-07-29T18:00:00.000Z",
    picks: [{ sourceId: "pickswise", source: "Pickswise", matchup: "DET @ CHW", market: "Moneyline", selection: "DET", expert: "Pickswise" }]
  });
  const report = buildPostingTimeReport(secondRun, { generatedAt: "2026-07-29T18:00:00.000Z" });

  assert.equal(Object.keys(secondRun.observations).length, 1);
  assert.equal(report.sources[0].sampleCount, 1);
  assert.equal(report.sources[0].timeBasis, "first-observed");
  assert.equal(report.sources[0].averagePostingTimeET, "10:30 AM");
});

test("uses Covers relative publish time when all source samples provide it", () => {
  const history = trackPostingTimes({ observations: {} }, {
    sport: "mlb",
    observedAt: "2026-07-29T14:30:00.000Z",
    picks: [{ sourceId: "covers", source: "Covers", matchup: "DET @ CHW", market: "Moneyline", selection: "DET", expert: "A", made: "an hour ago" }]
  });
  const report = buildPostingTimeReport(history, { generatedAt: "2026-07-29T14:30:00.000Z" });

  assert.equal(report.sources[0].timeBasis, "source-published");
  assert.equal(report.sources[0].averagePostingTimeET, "9:30 AM");
});

test("averages posting times across midnight", () => {
  const history = trackPostingTimes({ observations: {} }, {
    sport: "mlb",
    observedAt: "2026-01-02T04:55:00.000Z",
    picks: [{ sourceId: "x", source: "X", matchup: "A @ B", market: "Moneyline", selection: "A", expert: "One" }]
  });
  const updated = trackPostingTimes(history, {
    sport: "mlb",
    observedAt: "2026-01-03T05:05:00.000Z",
    picks: [{ sourceId: "x", source: "X", matchup: "C @ D", market: "Moneyline", selection: "C", expert: "Two" }]
  });

  const report = buildPostingTimeReport(updated, { generatedAt: "2026-01-03T05:05:00.000Z" });
  assert.equal(report.sources[0].averagePostingTimeET, "12:00 AM");
});
