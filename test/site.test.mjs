import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (p) => readFile(new URL(p, root), 'utf8');

test('index.html has title, viewport, one h1, landmarks and one live region', async () => {
  const html = await read('index.html');
  assert.match(html, /<title>Stargazer[^<]+<\/title>/);
  assert.match(html, /name="viewport" content="width=device-width, initial-scale=1"/);
  assert.equal((html.match(/<h1[\s>]/g) || []).length, 1);
  assert.match(html, /<main /);
  assert.match(html, /<header /);
  assert.match(html, /<footer /);
  assert.equal((html.match(/aria-live=/g) || []).length, 1);
  assert.doesNotMatch(html, /<dl|<table|aria-describedby|aria-actions|autoplay/i);
});

test('every local asset referenced exists', async () => {
  const html = await read('index.html');
  const refs = [...html.matchAll(/(?:src|href)="([^"#:]+)"/g)].map((m) => m[1]);
  assert.ok(refs.length >= 5);
  for (const r of refs) await access(new URL(r, root));
  const app = await read('app.js');
  for (const m of app.matchAll(/from '\.\/([^']+)'/g)) await access(new URL(m[1], root));
  for (const s of ['permissive', 'publicdomain', 'copyleft', 'weak', 'other', 'none', 'tick', 'group', 'open', 'close', 'found', 'miss', 'sweep']) {
    await access(new URL(`sounds/${s}.mp3`, root));
  }
});

test('star data is complete and well formed', async () => {
  const data = JSON.parse(await read('data/stars.json'));
  assert.deepEqual(data.fields, ['name', 'language', 'license', 'stars', 'description', 'starred_at']);
  assert.ok(data.repos.length >= 7900, `only ${data.repos.length} repos`);
  for (const r of data.repos) {
    assert.match(r[0], /^[^/\s]+\/[^/\s]+$/);
    assert.equal(typeof r[3], 'number');
  }
  const lic = JSON.parse(await read('data/licenses.json'));
  assert.ok(lic.licenses.MIT && lic.licenses['GPL-3.0'] && lic.licenses['Apache-2.0']);
});

test('credits cover every vendored library and say Carter (2three1y)', async () => {
  const credits = JSON.parse(await read('credits.json'));
  const names = credits.credits.map((c) => c.name);
  for (const n of ['sonifier', 'soundcn', 'choosealicense.com', 'speakable', 'a11y-dialog', 'tabbable', 'web-haptics']) assert.ok(names.includes(n), n);
  assert.equal(credits.author, 'Carter (2three1y)');
  const notice = await read('NOTICE');
  assert.match(notice, /BSD 3-Clause/);
  assert.match(notice, /Ather Sharif/);
});

test('no placeholders or private names in public files', async () => {
  for (const f of ['index.html', 'app.js', 'README.md', 'credits.html', 'credits.json', 'NOTICE', 'LICENSE']) {
    const t = await read(f);
    assert.doesNotMatch(t, /lorem ipsum|TODO|FIXME|Hasan|Altameemi|Looscid/i, f);
  }
});
