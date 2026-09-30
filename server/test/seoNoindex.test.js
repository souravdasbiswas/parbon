import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

Object.assign(process.env, {
  NODE_ENV: 'production',
  PARBON_SITE: 'v2.parbon.in',
  SITE_URL: 'https://v2.parbon.in',
  SMTP_HOST: '',
});
delete process.env.SITE_NOINDEX;

const { createApp } = await import('../src/app.js');

let server;
let base;

before(async () => {
  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

describe('noindex staging behavior', () => {
  it('blocks robots and sends noindex headers on production non-primary hosts', async () => {
    const robots = await fetch(`${base}/robots.txt`);
    assert.equal(robots.headers.get('x-robots-tag'), 'noindex, nofollow');
    assert.equal(await robots.text(), 'User-agent: *\nDisallow: /\n');

    const health = await fetch(`${base}/api/health`);
    assert.equal(health.headers.get('x-robots-tag'), 'noindex, nofollow');
    assert.equal((await health.json()).noindex, true);
  });
});
