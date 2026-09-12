import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

import { DAEMON_ENDPOINTS, runEventsPath, runEventsUrl } from '../src/daemon-endpoints.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('AC-13 — same-origin daemon endpoints', () => {
  test.each([
    [`http:${'//'}localhost:5173`, 'ws:'],
    [`https:${'//'}quorum.example`, 'wss:'],
  ])('derives the WebSocket scheme from %s', (page, protocol) => {
    const url = runEventsUrl(new URL(page), 'Q-0120-3');
    expect(url.protocol).toBe(protocol);
    expect(url.host).toBe(new URL(page).host);
    expect(url.pathname).toBe(`${DAEMON_ENDPOINTS.runs}/Q-0120-3/events`);
  });

  test.each(['a/b', 'a?b', 'a#b', 'a b'])('confines hostile handle %s to one path segment', (handle) => {
    const pathName = runEventsPath(handle);
    const url = runEventsUrl(new URL(`https:${'//'}example.test/base`), handle);
    expect(pathName).toBe(`${DAEMON_ENDPOINTS.runs}/${encodeURIComponent(handle)}/events`);
    expect(url.pathname).toBe(pathName);
    expect(url.search).toBe('');
    expect(url.hash).toBe('');
  });

  test('the proxy and path builder consume the complete endpoint register', () => {
    const config = fs.readFileSync(path.join(ROOT, 'vite.config.ts'), 'utf8');
    expect(config).toContain("from './src/daemon-endpoints.js'");
    expect(config).toContain('DAEMON_ENDPOINTS');
    expect(Object.values(DAEMON_ENDPOINTS).sort()).toStrictEqual(['/flows', '/history', '/project', '/runs', '/tickets']);
  });

  test('browser source contains no socket scheme, daemon hostname, or chosen daemon port', () => {
    // Named needles, a positive control, and a fixture each. It was three bare regexes over a walk
    // with no assertion that the walk found anything: an empty walk — a filter added, a directory
    // renamed, a flatMap that stopped descending — skipped every assertion and reported success, and
    // a mistyped pattern was indistinguishable from a clean tree. Every sibling scan in this package
    // already carried both halves; this file was the exception, and it is the file this ticket
    // added. AC-13's Test clause names the missing half in as many words. Q-0120 round 2, M-4.
    const forbidden: [string, RegExp, string][] = [
      ['a socket scheme literal', /['"`]wss?:/, `const url = ${'`'}ws${':'}//host/x${'`'};`],
      ['the daemon hostname', /127\.0\.0\.1/, `const host = '127.0.${'0.1'}';`],
      ['the chosen daemon port', /7717/, `const port = ${'77'}${'17'};`],
    ];
    const walk = (dir: string): [string, string][] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory() ? walk(path.join(dir, entry.name)) : [[entry.name, fs.readFileSync(path.join(dir, entry.name), 'utf8')] as [string, string]]);
    const sources = walk(path.join(ROOT, 'src'));
    expect(sources.length, 'the walk found no source — this scan proves nothing').toBeGreaterThan(5);
    for (const [name, source] of sources) {
      for (const [what, needle] of forbidden) expect(needle.test(source), `${name} carries ${what}`).toBe(false);
    }
    // Each needle discriminates, over a fixture whose own literals are assembled so this test does
    // not become its own subject.
    for (const [what, needle, fixture] of forbidden) {
      expect(needle.test(fixture), `the needle for ${what} matches nothing`).toBe(true);
      expect(needle.test('const nothing = 1;'), `the needle for ${what} matches anything`).toBe(false);
    }
  });
});
