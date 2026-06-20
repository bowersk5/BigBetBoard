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

test("normalizes World Cup goals markets as props", () => {
  const pick = normalizePick({
    matchup: "SWE @ NED",
    startsAt: "Sat, Jun 20 • 1:00 PM ET",
    market: "Goals",
    selection: "Tijjani Reijnders o0.5 Goals (+398)",
    odds: "o0.5 +398",
    expert: "Sam Farley",
    made: "yesterday",
    sport: "world-cup"
  });

  assert.ok(pick);
  assert.equal(pick.matchup, "SWE @ NED");
  assert.equal(pick.market, "Prop");
  assert.equal(pick.selection, "Tijjani Reijnders o0.5 Goals");
  assert.equal(pick.key, "SWE @ NED|Prop|tijjani reijnders o0.5 goals");
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

test("normalizes World Cup three-way winners and compact totals", () => {
  const winner = normalizePick({
    matchup: "SWE @ NED",
    market: "3-Way",
    selection: "NED (-137)",
    sport: "world-cup"
  });
  const total = normalizePick({
    matchup: "SWE @ NED",
    market: "Best Bets,Total",
    selection: "Total o2.5 (-120)",
    sport: "world-cup"
  });

  assert.equal(winner?.key, "SWE @ NED|Moneyline|NED");
  assert.equal(total?.key, "SWE @ NED|Total|Over 2.5");
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
  assert.equal(picks[0].market, "Run Line");
  assert.equal(picks[0].selection, "LAD -1.5");
  assert.equal(picks[0].odds, "-125");
  assert.equal(picks[1].selection, "ARI Moneyline");
});

test("reverses Pickswise World Cup home-vs-away rows", () => {
  const flight = `42:["$","tbody",null,{"children":[${pickswiseFlightRow(
    "526",
    "NED vs SWE",
    "Over 2.5",
    "+100"
  )}]}]`;
  const html = `<script type="application/ld+json">${JSON.stringify({
    "@type": "SportsEvent",
    awayTeam: { name: "SWE" },
    homeTeam: { name: "NED" },
    startDate: "2026-06-20T17:00:00Z"
  })}</script><script>self.__next_f.push([1,${JSON.stringify(flight)}])</script>`;
  const config = sports["world-cup"];
  const source = config.sources.find((item) => item.id === "pickswise");
  const [pick] = source.parser(html, config);

  assert.equal(pick.matchup, "SWE @ NED");
  assert.equal(pick.startsAt, "2026-06-20T17:00:00Z");
  assert.equal(pick.key, "SWE @ NED|Total|Over 2.5");
});

test("parses Polymarket's highest World Cup match-result probability", () => {
  const event = {
    "@type": "Event",
    name: "Netherlands vs. Sweden",
    startDate: "2026-06-20T17:00:00.000Z"
  };
  const outcome = (label, cents) =>
    `<span class="opacity-70 whitespace-nowrap">${label}</span><span class="ml-1 text-sm">${cents}¢</span>`;
  const html = [
    `<script type="application/ld+json">${JSON.stringify({
      "@type": "CollectionPage",
      mainEntity: { itemListElement: [{ item: event }] }
    })}</script>`,
    '<a href="/sports/world-cup/fifwc-nld-swe-2026-06-20"><span class="sr-only">Netherlands vs. Sweden</span></a>',
    outcome("NLD", 57), outcome("Draw", 24), outcome("SWE", 21)
  ].join("");
  const config = sports["world-cup"];
  const source = config.sources.find((item) => item.id === "polymarket");
  const [pick] = source.parser(html, config);

  assert.equal(pick.matchup, "SWE @ NED");
  assert.equal(pick.selection, "NED Moneyline");
  assert.equal(pick.odds, "-133");
  assert.equal(pick.startsAt, event.startDate);
});

test("parses public SportsLine picks and skips subscriber-locked cards", () => {
  const game = {
    awayTeam: { abbrev: "SWE" },
    homeTeam: { abbrev: "NED" },
    scheduledTime: "2026-06-20T17:00:00.000Z"
  };
  const publicPick = {
    locked: false,
    createdAt: "2026-06-20T01:42:38.165Z",
    writeup: "Both teams can contribute to a high-scoring match.",
    expert: { firstName: "Brad", lastName: "Thomas" },
    game,
    selection: {
      label: "Over 2.5 -110",
      marketType: "OVER_UNDER",
      odds: -110,
      side: null,
      value: 2.5
    }
  };
  const lockedPick = {
    ...publicPick,
    locked: true,
    selection: { ...publicPick.selection, label: "Subscribers Only", odds: null, value: null }
  };
  const data = {
    props: {
      pageProps: {
        expertPicksContainerProps: {
          data: { expertPicks: { edges: [{ node: publicPick }, { node: lockedPick }] } }
        }
      }
    }
  };
  const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(data)}</script>`;
  const config = sports["world-cup"];
  const source = config.sources.find((item) => item.id === "sportsline");
  const picks = source.parser(html, config);

  assert.equal(picks.length, 1);
  assert.equal(picks[0].matchup, "SWE @ NED");
  assert.equal(picks[0].selection, "Over 2.5");
  assert.equal(picks[0].expert, "Brad Thomas");
  assert.equal(picks[0].odds, "-110");
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
