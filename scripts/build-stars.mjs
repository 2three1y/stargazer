// Rebuilds data/stars.json from the public GitHub API with star dates.
// Runs in the "Refresh stars" GitHub Action so the page never calls the API itself.
// Usage: GITHUB_TOKEN=... node scripts/build-stars.mjs [user]
import { readFile, writeFile } from 'node:fs/promises';

const user = process.argv[2] || process.env.STARS_USER || '2three1y';
const token = process.env.GITHUB_TOKEN || '';
const out = new URL('../data/stars.json', import.meta.url);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const trim = (s, n = 160) => {
  s = String(s || '').replace(/\s+/g, ' ').trim();
  return s.length <= n ? s : s.slice(0, n - 1).trimEnd() + '…';
};

async function page(n) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    const res = await fetch(`https://api.github.com/users/${user}/starred?per_page=100&page=${n}`, {
      headers: {
        Accept: 'application/vnd.github.star+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'stargazer-refresh',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (res.ok) return res.json();
    const remaining = res.headers.get('x-ratelimit-remaining');
    const reset = Number(res.headers.get('x-ratelimit-reset') || 0) * 1000;
    const retryAfter = Number(res.headers.get('retry-after') || 0) * 1000;
    if (res.status === 403 || res.status === 429 || res.status >= 500) {
      const wait = retryAfter || (remaining === '0' && reset ? Math.min(reset - Date.now() + 1000, 15 * 60 * 1000) : 5000 * attempt);
      console.warn(`page ${n}: ${res.status}, waiting ${Math.round(wait / 1000)} s (attempt ${attempt})`);
      await sleep(Math.max(1000, wait));
      continue;
    }
    throw new Error(`page ${n}: ${res.status} ${await res.text()}`);
  }
  throw new Error(`page ${n}: gave up after 5 attempts`);
}

const repos = [];
for (let n = 1; n < 500; n++) {
  const items = await page(n);
  if (!Array.isArray(items) || items.length === 0) break;
  for (const it of items) {
    const r = it.repo || it;
    const spdx = r.license && r.license.spdx_id ? r.license.spdx_id : 'none';
    repos.push([r.full_name, r.language || '', spdx, r.stargazers_count || 0, trim(r.description), it.starred_at || null]);
  }
  if (items.length < 100) break;
}
if (repos.length === 0) {
  console.error('No stars came back; keeping the old file.');
  process.exit(1);
}
// Keep the old file if the new list is suspiciously small (a partial API answer).
try {
  const old = JSON.parse(await readFile(out, 'utf8'));
  if (old.repos && repos.length < old.repos.length * 0.8) {
    console.error(`Only ${repos.length} stars came back (was ${old.repos.length}); keeping the old file.`);
    process.exit(1);
  }
} catch { /* no old file */ }
const data = {
  generated: new Date().toISOString().slice(0, 10),
  source: `GitHub API, stars of ${user}, newest first, with star dates`,
  user,
  fields: ['name', 'language', 'license', 'stars', 'description', 'starred_at'],
  repos,
};
await writeFile(out, JSON.stringify(data));
console.log(`Wrote ${repos.length} stars.`);
