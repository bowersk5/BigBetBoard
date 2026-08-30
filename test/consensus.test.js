import test from "node:test";
import assert from "node:assert/strict";
import { buildConsensus, normalizePick, sports } from "../src/consensus.js";

test("groups normalized picks by matchup, market, and selection", () => {
  const consensus = buildConsensus([
    {
      key: "DET @ CHW|Moneyline|CHW",
      matchup: "DET @ CHW",
      market: "Moneyline",
      selection: "CHW Moneyline",
      sourceId: "covers",
      source: "Covers",
      expert: "Analyst One"
    },
    {
      key: "DET @ CHW|Moneyline|CHW",
      matchup: "DET @ CHW",
      market: "Moneyline",
      selection: "CHW Moneyline",
      sourceId: "pickswise",
      source: "Pickswise",
      expert: "Pickswise"
    },
    {
      key: "DET @ CHW|Total|Under 8",
      matchup: "DET @ CHW",
      market: "Total",
      selection: "Under 8",
      sourceId: "action",
      source: "Action Network",
      expert: "Analyst Two"
    }
  ]);

  assert.equal(consensus[0].selection, "CHW Moneyline");
  assert.equal(consensus[0].sourceCount, 2);
  assert.equal(consensus[0].pickCount, 2);
  assert.equal(consensus[1].sourceCount, 1);
});

test("keeps doubleheader games separate while grouping equivalent start times", () => {
  const earlyCovers = normalizePick({
    matchup: "BOS @ NYY",
    startsAt: "Sat, Aug 29 • 1:05 PM ET",
    market: "Moneyline",
    selection: "New York Yankees",
    sport: "mlb"
  });
  const earlyPickswise = normalizePick({
    matchup: "BOS @ NYY",
    startsAt: "2026-08-29T17:05:00Z",
    market: "Moneyline",
    selection: "NYY",
    sport: "mlb"
  });
  const lateCovers = normalizePick({
    matchup: "BOS @ NYY",
    startsAt: "Sat, Aug 29 • 7:15 PM ET",
    market: "Moneyline",
    selection: "New York Yankees",
    sport: "mlb"
  });

  const consensus = buildConsensus([
    { ...earlyCovers, sourceId: "covers", source: "Covers", expert: "A" },
    { ...earlyPickswise, sourceId: "pickswise", source: "Pickswise", expert: "Pickswise" },
    { ...lateCovers, sourceId: "covers", source: "Covers", expert: "B" }
  ], { totalSources: 2 });

  assert.equal(consensus.length, 2);
  assert.equal(consensus[0].sourceCount, 2);
  assert.equal(consensus[0].agreement, "2/2");
  assert.equal(consensus[1].sourceCount, 1);
});

test("uses active-source count for the agreement denominator", () => {
  const consensus = buildConsensus([{
    key: "DET @ CHW|2026-08-30T18:10|Moneyline|CHW",
    matchup: "DET @ CHW",
    market: "Moneyline",
    selection: "CHW Moneyline",
    sourceId: "covers",
    source: "Covers",
    expert: "Analyst"
  }], { totalSources: 3 });

  assert.equal(consensus[0].agreement, "1/3");
});

test("keeps Covers parlay cards as consensus picks", () => {
  const pick = normalizePick({
    matchup: "NY @ SA",
    market: "Moneyline",
    selection: "3 LEG PARLAY SA Moneyline Victor Wembanyama o28.5 Points Scored Points Scored Victor Wembanyama o11.5 Total Rebounds Total Rebounds +400",
    expert: "Jason Logan",
    made: "19 hours ago",
    sport: "mlb"
  });

  assert.ok(pick);
  assert.equal(pick.market, "Parlay");
  assert.equal(
    pick.selection,
    "3 LEG PARLAY SA Moneyline Victor Wembanyama o28.5 Points Scored Victor Wembanyama o11.5 Total Rebounds"
  );
});

test("uses NFL-specific team names when normalizing football picks", () => {
  const pick = normalizePick({
    matchup: "NYJ @ BUF",
    market: "Point Spread",
    selection: "New York Jets +2.5",
    sport: "nfl"
  });

  assert.equal(pick?.matchup, "NYJ @ BUF");
  assert.equal(pick?.market, "Spread");
  assert.equal(pick?.selection, "NYJ +2.5");
  assert.equal(pick?.key, "NYJ @ BUF|Spread|NYJ +2.5");
});

test("normalizes first-five run lines into the Spread market", () => {
  const pick = normalizePick({
    matchup: "KC @ MIN",
    market: "Minnesota Twins F5 -0.5",
    selection: "Minnesota Twins F5 -0.5",
    sport: "mlb"
  });

  assert.equal(pick?.market, "Spread");
  assert.equal(pick?.selection, "MIN -0.5");
  assert.equal(pick?.key, "KC @ MIN|Spread|MIN -0.5");
});

test("puts MLB and NFL player markets in the Player Props view", () => {
  const mlb = normalizePick({
    matchup: "BOS @ NYY",
    market: "Pitcher Strikeouts",
    selection: "Garrett Crochet Over 6.5",
    sport: "mlb"
  });
  const nfl = normalizePick({
    matchup: "BUF @ KC",
    market: "Passing Yards",
    selection: "Josh Allen Over 249.5",
    sport: "nfl"
  });

  assert.equal(mlb?.market, "Player Props");
  assert.equal(mlb?.key, "BOS @ NYY|Player Props|garrett crochet over 6.5");
  assert.equal(nfl?.market, "Player Props");
  assert.equal(nfl?.key, "BUF @ KC|Player Props|josh allen over 249.5");
});

test("keeps game props out of the Player Props view", () => {
  const pick = normalizePick({
    matchup: "BUF @ KC",
    market: "Game Prop",
    selection: "First score will be a touchdown",
    sport: "nfl"
  });

  assert.equal(pick?.market, "Prop");
});

test("configures college football with the active source routes", () => {
  const ncaaf = sports.ncaaf;

  assert.equal(ncaaf.label, "College Football");
  assert.equal(ncaaf.sources.length, 3);
  assert.equal(ncaaf.sources.find((source) => source.id === "covers")?.url, "https://www.covers.com/picks/ncaaf");
  assert.equal(ncaaf.sources.find((source) => source.id === "pickswise")?.url, "https://www.pickswise.com/college-football/picks/");
});

test("parses Pickswise streamed pick rows when __NEXT_DATA__ is absent", () => {
  const flight = `42:["$","tbody",null,{"children":[${[
    pickswiseFlightRow("418", "LAD vs CWS", "Run Line - Los Angeles Dodgers -1.5", "-125"),
    pickswiseFlightRow("424", "ARI vs CIN", "Moneyline - Arizona Diamondbacks", "-147")
  ].join(",")}]}]`;
  const html = `<script>self.__next_f.push([1,${JSON.stringify(flight)}])</script>`;
  const pickswise = sports.mlb.sources.find((source) => source.id === "pickswise");
  const picks = pickswise.parser(html, sports.mlb);

  assert.equal(picks.length, 2);
  assert.equal(picks[0].matchup, "LAD @ CHW");
  assert.equal(picks[0].market, "Spread");
  assert.equal(picks[0].selection, "LAD -1.5");
  assert.equal(picks[0].odds, "-125");
  assert.equal(picks[1].selection, "ARI Moneyline");
});

function pickswiseFlightRow(id, matchup, selection, odds) {
  return [
    `["$","tr","${id}",{"className":"border-t border-border odd:bg-white even:bg-gray-light-bg","children":[`,
    `["$","td",null,{"className":"px-4 py-3","children":[["$","p",null,{"className":"text-body-bold text-primary-blue-dark","children":"${matchup}"}],["$","p",null,{"className":"text-caption text-primary-gray mt-0.5","children":""}]]}],`,
    `["$","td",null,{"className":"px-4 py-3","children":["$","p",null,{"className":"text-body-bold text-primary-blue-dark","children":"${selection}"}]}],`,
    `["$","td",null,{"className":"px-4 py-3 whitespace-nowrap","children":["$","span",null,{"className":"text-body text-yellow-danger","children":"3⭐"}]}],`,
    `["$","td",null,{"className":"px-4 py-3","children":["$","span",null,{"className":"text-body-bold text-primary-green","children":"${odds}"}]}]`,
    "]}]"
  ].join("");
}
