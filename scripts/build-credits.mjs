// Generates CREDITS.md and credits.html from credits.json, and fails if a
// credited repo is not in data/stars.json ("not in your stars").
// Usage: node scripts/build-credits.mjs
import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const credits = JSON.parse(await readFile(new URL('credits.json', root), 'utf8'));
const stars = JSON.parse(await readFile(new URL('data/stars.json', root), 'utf8'));
const starred = new Set(stars.repos.map((r) => String(r[0]).toLowerCase()));
const slug = (url) => url.replace(/^https:\/\/github\.com\//, '').toLowerCase();
const missing = credits.credits.filter((c) => !starred.has(slug(c.repo)));
if (missing.length) {
  console.error(`not in your stars: ${missing.map((c) => slug(c.repo)).join(', ')}`);
  process.exit(1);
}
const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

let md = `## Credits\n\n${credits.note}\n\n`;
for (const c of credits.credits) {
  md += `### ${c.name}\n- Repo: ${c.repo}\n- Author: ${c.author}\n- License: ${c.license}\n- Used for: ${c.used_for}\n- Notice: ${c.notice}\n${c.starred ? `- Starred: ${c.starred}\n` : ''}\n`;
}
await writeFile(new URL('CREDITS.md', root), md);

let items = '';
for (const c of credits.credits) {
  let text = '';
  try { text = await readFile(new URL(c.license_file, root), 'utf8'); } catch { text = 'See the repo for the license text.'; }
  items += `
    <section aria-labelledby="c-${esc(c.name.replace(/\W+/g, '-'))}">
      <h3 id="c-${esc(c.name.replace(/\W+/g, '-'))}">${esc(c.name)}</h3>
      <ul>
        <li>Repo: <a href="${esc(c.repo)}">${esc(slug(c.repo))}</a></li>
        <li>Author: ${esc(c.author)}</li>
        <li>License: ${esc(c.license)}</li>
        <li>Used for: ${esc(c.used_for)}</li>
        <li>Notice: ${esc(c.notice)}</li>${c.starred ? `
        <li>Starred: ${esc(c.starred)}</li>` : ''}
      </ul>
      <details>
        <summary>Full license text for ${esc(c.name)}</summary>
        <pre>${esc(text)}</pre>
      </details>
    </section>`;
}
const html = `<!doctype html>
<html lang="en-US">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Starred credits: Stargazer</title>
<link rel="stylesheet" href="styles.css">
<style>pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:.85rem}details{margin:.5rem 0 1rem}summary{cursor:pointer;font-weight:600;padding:.4rem 0}</style>
</head>
<body>
<header class="site-header">
  <h1>Starred credits</h1>
  <p class="tagline">${esc(credits.project)} by ${esc(credits.author)}. ${esc(credits.note)}</p>
</header>
<main id="main">
  <section class="card" aria-labelledby="used-title">
    <h2 id="used-title">Repos used (${credits.credits.length})</h2>${items}
  </section>
  <section class="card" aria-labelledby="this-title">
    <h2 id="this-title">This project</h2>
    <p>Stargazer is MIT licensed. The BSD 3-Clause notice for sonifier is kept in NOTICE and licenses/sonifier.txt. Sound effects are CC0 by Kenney.</p>
    <p><a href="index.html">Back to Stargazer</a></p>
  </section>
</main>
</body>
</html>
`;
await writeFile(new URL('credits.html', root), html);
console.log(`Credits OK: ${credits.credits.length} repos, all starred.`);
