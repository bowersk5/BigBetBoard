import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseCoversPicks } from "../src/coversParser.js";
import { fetchConsensus, sports } from "../src/consensus.js";
import { fetchHtml } from "../src/utils.js";

const outputDir = join(process.cwd(), "public", "data");

async function main() {
  await mkdir(outputDir, { recursive: true });

  for (const config of Object.values(sports)) {
    const sportDir = config.id === "mlb" ? outputDir : join(outputDir, config.id);
    await mkdir(sportDir, { recursive: true });
    await writeSportData(config, sportDir);
  }
}

async function writeSportData(config, sportDir) {
  const coversSource = config.sources.find((source) => source.id === "covers");
  const outputFile = join(sportDir, "picks.json");
  const consensusFile = join(sportDir, "consensus.json");

  // Fetch the Covers page once and reuse the HTML for both picks and consensus.
  const html = await fetchHtml(coversSource.url);

  const parsed = parseCoversPicks(html, { sport: config.id, sourceUrl: coversSource.url });
  const payload = {
    ...parsed,
    sport: config.id,
    sportLabel: config.label,
    fetchedAt: new Date().toISOString(),
    sourceUrl: coversSource.url
  };

  await writeFile(outputFile, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`Wrote ${payload.counts.picks} ${config.label} expert picks to ${outputFile}`);

  // Consensus is best-effort: one unavailable source should not block deploys.
  try {
    const consensus = await fetchConsensus({ sport: config.id, coversHtml: html });
    await writeFile(consensusFile, `${JSON.stringify(consensus, null, 2)}\n`);
    console.log(`Wrote ${consensus.counts.consensus} ${config.label} consensus groups to ${consensusFile}`);
  } catch (error) {
    console.error(`${config.label} consensus fetch failed — writing empty placeholder:`, error.message);
    await writeFile(consensusFile, `${JSON.stringify(emptyConsensus(config), null, 2)}\n`);
  }
}

function emptyConsensus(config) {
  return {
    sport: config.id,
    sportLabel: config.label,
    generatedAt: new Date().toISOString(),
    sources: [],
    picks: [],
    consensus: [],
    counts: { sources: 0, activeSources: 0, picks: 0, consensus: 0 }
  };
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
