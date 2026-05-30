import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseCoversMlbPicks } from "../src/coversParser.js";
import { fetchMlbConsensus } from "../src/consensus.js";

const sourceUrl = "https://www.covers.com/picks/mlb";
const outputDir = join(process.cwd(), "public", "data");
const outputFile = join(outputDir, "picks.json");
const consensusFile = join(outputDir, "consensus.json");

async function main() {
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
  const payload = {
    ...parsed,
    fetchedAt: new Date().toISOString(),
    sourceUrl
  };

  await mkdir(outputDir, { recursive: true });
  await writeFile(outputFile, `${JSON.stringify(payload, null, 2)}\n`);
  const consensus = await fetchMlbConsensus();
  await writeFile(consensusFile, `${JSON.stringify(consensus, null, 2)}\n`);
  console.log(`Wrote ${payload.counts.picks} expert picks to ${outputFile}`);
  console.log(`Wrote ${consensus.counts.consensus} consensus groups to ${consensusFile}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
