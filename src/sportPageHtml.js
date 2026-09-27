/**
 * Patch the root (MLB) index.html into a sport-specific page: swap the
 * title/heading, point relative asset paths up one directory, and point the
 * "Source" link at the sport's own Covers page.
 *
 * This transformation has to run in two places — server.js generates it on
 * the fly for local dev routes like /nfl/, and scripts/generateStaticData.js
 * writes the same output to public/<sport>/index.html for GitHub Pages — so
 * it lives here once rather than being copy-pasted in both.
 */
export function patchSportPageHtml(rootHtml, config, sports) {
  const label = config.label;
  const sourceUrl = config.sources.find((s) => s.id === "covers")?.url || `https://www.covers.com/picks/${config.id}`;

  return rootHtml
    .replace(/<title>Daily Expert MLB Board<\/title>/, `<title>Daily Expert ${label} Board</title>`)
    .replace(/Expert MLB Board/, `Expert ${label} Board`)
    .replace(/href="styles\.css"/, `href="../styles.css"`)
    .replace(/src="app\.js"/, `src="../app.js"`)
    .replace(/href="https:\/\/www\.covers\.com\/picks\/mlb"/, `href="${sourceUrl}"`)
    .replace(/href="\.\/"/, `href="../"`)
    .replace(/href="([a-z0-9-]+)\/"/g, (match, slug) =>
      sports[slug] ? `href="../${slug}/"` : match
    );
}
