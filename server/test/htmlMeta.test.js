import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { renderWithMeta } from '../src/services/htmlMeta.js';

const tmp = await mkdtemp(path.join(os.tmpdir(), 'parbon-meta-'));
const index = path.join(tmp, 'index.html');
await writeFile(
  index,
  '<!doctype html><html><head><title>Parbon</title><meta name="description" content="x" /></head><body><div id="root"></div></body></html>',
);

after(() => rm(tmp, { recursive: true, force: true }));

describe('link-preview meta tags', () => {
  it('inserts titles containing $ patterns literally, keeping the page intact', async () => {
    const html = await renderWithMeta(index, { title: "Bhog ₹100 $$ $& $' <b>", description: 'Pay $` at the gate', url: '/announcements/bhog' });
    assert.match(html, /<title>Bhog ₹100 \$\$ \$&amp; \$&#39; &lt;b&gt; · Parbon Sanskritik Samity<\/title>/);
    assert.match(html, /<meta name="description" content="Pay \$` at the gate" \/>/);
    assert.equal(html.match(/<body>/g).length, 1, 'the rest of the page is not copied into the head');
    assert.ok(html.indexOf('og:title') < html.indexOf('</head>'));
  });
});
