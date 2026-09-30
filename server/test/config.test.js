import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, it } from 'node:test';

process.env.PARBON_SITE = 'v2.parbon.in';
const { chooseHomeEnvFile, resolveSiteNoindex } = await import('../src/config.js');

const home = path.join('C:', 'Users', 'parbon');
const hostingerPath = (site) => `/home/u1/domains/${site}/hbuilds/versions/123/nodejs`;
const existsFor = (...files) => {
  const present = new Set(files);
  return (file) => present.has(file);
};

describe('chooseHomeEnvFile', () => {
  it('uses the per-site home file when it exists', () => {
    const file = path.join(home, 'parbon.v2.parbon.in.env');
    const choice = chooseHomeEnvFile({
      home,
      paths: [hostingerPath('v2.parbon.in')],
      env: {},
      exists: existsFor(file),
    });
    assert.equal(choice.site, 'v2.parbon.in');
    assert.equal(choice.status, 'selected');
    assert.equal(choice.file, file);
  });

  it('skips the home file for staging when its per-site file is missing', () => {
    const choice = chooseHomeEnvFile({
      home,
      paths: [hostingerPath('v2.parbon.in')],
      env: {},
      exists: existsFor(),
    });
    assert.equal(choice.site, 'v2.parbon.in');
    assert.equal(choice.status, 'skipped');
    assert.equal(choice.file, path.join(home, 'parbon.v2.parbon.in.env'));
    assert.match(choice.reason, /create ~\/parbon\.v2\.parbon\.in\.env/);
  });

  it('falls back to ~/parbon.env for a primary production site', () => {
    const choice = chooseHomeEnvFile({
      home,
      paths: [hostingerPath('parbon.in')],
      env: {},
      exists: existsFor(),
    });
    assert.equal(choice.site, 'parbon.in');
    assert.equal(choice.status, 'selected');
    assert.equal(choice.file, path.join(home, 'parbon.env'));
  });

  it('keeps the legacy ~/parbon.env behavior when no site is detected', () => {
    const choice = chooseHomeEnvFile({
      home,
      paths: ['C:\\sites\\parbon'],
      env: {},
      exists: existsFor(),
    });
    assert.equal(choice.site, '');
    assert.equal(choice.status, 'selected');
    assert.equal(choice.file, path.join(home, 'parbon.env'));
  });

  it('honors PARBON_SITE before looking at deploy paths', () => {
    const file = path.join(home, 'parbon.v2.parbon.in.env');
    const choice = chooseHomeEnvFile({
      home,
      paths: [hostingerPath('parbon.in')],
      env: { PARBON_SITE: 'v2.parbon.in' },
      exists: existsFor(file),
    });
    assert.equal(choice.site, 'v2.parbon.in');
    assert.equal(choice.status, 'selected');
    assert.equal(choice.file, file);
  });

  it('lets PARBON_PRIMARY_SITES define the primary-site fallback list', () => {
    const choice = chooseHomeEnvFile({
      home,
      paths: [hostingerPath('preview.parbon.in')],
      env: { PARBON_PRIMARY_SITES: 'parbon.in,preview.parbon.in' },
      exists: existsFor(),
    });
    assert.equal(choice.site, 'preview.parbon.in');
    assert.equal(choice.status, 'selected');
    assert.equal(choice.file, path.join(home, 'parbon.env'));
  });
});

describe('resolveSiteNoindex', () => {
  it('automatically noindexes production non-primary hosts', () => {
    assert.equal(resolveSiteNoindex({ env: {}, isProduction: true, siteUrl: 'https://v2.parbon.in' }), true);
  });

  it('does not automatically noindex production primary hosts', () => {
    assert.equal(resolveSiteNoindex({ env: {}, isProduction: true, siteUrl: 'https://parbon.in' }), false);
  });

  it('uses explicit SITE_NOINDEX when set', () => {
    assert.equal(resolveSiteNoindex({ env: { SITE_NOINDEX: 'false' }, isProduction: true, siteUrl: 'https://v2.parbon.in' }), false);
    assert.equal(resolveSiteNoindex({ env: { SITE_NOINDEX: 'true' }, isProduction: false, siteUrl: 'https://parbon.in' }), true);
  });
});
