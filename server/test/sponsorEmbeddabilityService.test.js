import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createSponsorEmbeddabilityService,
  sponsorshipEmbeddableFromHeaders,
} from '../src/services/sponsorEmbeddabilityService.js';

const headers = (values) => new Headers(values);

describe('sponsorship embeddability headers', () => {
  it('blocks DENY and SAMEORIGIN x-frame-options', () => {
    assert.equal(sponsorshipEmbeddableFromHeaders(headers({ 'x-frame-options': 'DENY' })), false);
    assert.equal(sponsorshipEmbeddableFromHeaders(headers({ 'x-frame-options': 'SAMEORIGIN' })), false);
  });

  it('honours frame-ancestors for the configured site origin', () => {
    const siteUrl = 'https://parbon.example';
    assert.equal(
      sponsorshipEmbeddableFromHeaders(headers({ 'content-security-policy': "default-src 'self'; frame-ancestors *" }), { siteUrl }),
      true,
    );
    assert.equal(
      sponsorshipEmbeddableFromHeaders(headers({ 'content-security-policy': 'frame-ancestors https://parbon.example' }), { siteUrl }),
      true,
    );
    assert.equal(
      sponsorshipEmbeddableFromHeaders(headers({ 'content-security-policy': "frame-ancestors 'self'" }), {
        siteUrl,
        targetUrl: 'https://script.google.com/macros/s/example/exec',
      }),
      false,
    );
    assert.equal(
      sponsorshipEmbeddableFromHeaders(headers({ 'content-security-policy': 'frame-ancestors https://other.example' }), { siteUrl }),
      false,
    );
  });
});

describe('sponsorship embeddability cache', () => {
  it('caches successful checks by URL', async () => {
    let calls = 0;
    const service = createSponsorEmbeddabilityService({
      fetchImpl: async (url) => {
        calls += 1;
        return new Response('', { status: 200, headers: { 'content-security-policy': 'frame-ancestors https://parbon.example' } });
      },
      siteUrl: 'https://parbon.example',
    });

    assert.equal(await service.check('https://script.google.com/example'), true);
    assert.equal(await service.check('https://script.google.com/example'), true);
    assert.equal(calls, 1);
  });

  it('caches network failures for a shorter window and reports unknown', async () => {
    let calls = 0;
    let tick = 1000;
    const service = createSponsorEmbeddabilityService({
      fetchImpl: async () => {
        calls += 1;
        throw new Error('network down');
      },
      now: () => tick,
      failureTtlMs: 50,
    });

    assert.equal(await service.check('https://script.google.com/fail'), null);
    assert.equal(await service.check('https://script.google.com/fail'), null);
    assert.equal(calls, 1);
    tick += 51;
    assert.equal(await service.check('https://script.google.com/fail'), null);
    assert.equal(calls, 2);
  });

  it('reports a timed-out or non-OK probe as unknown, not blocked', async () => {
    const slow = createSponsorEmbeddabilityService({
      fetchImpl: (_url, { signal }) =>
        new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')))),
      timeoutMs: 10,
    });
    assert.equal(await slow.check('https://script.google.com/slow'), null);

    const broken = createSponsorEmbeddabilityService({ fetchImpl: async () => new Response('', { status: 500 }) });
    assert.equal(await broken.check('https://script.google.com/broken'), null);
  });
});
