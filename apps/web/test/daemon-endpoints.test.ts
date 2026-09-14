import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DEFAULT_DAEMON_PORT } from '@quorum/shared';
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

  test('Q-0126 AC-5 — the dev proxy and `quorum open` resolve one declared port, not two literals', async () => {
    // The sentence this file's own header carried until Q-0126 — *"7717 is a dev-server convention,
    // not a contract … `quorum open` is what will later have to agree with this value"* — as a check
    // rather than a promise. Agreement is structural now: both readers import `DEFAULT_DAEMON_PORT`
    // and neither spells a number, so there is no second literal to drift.
    //
    // **The value is RESOLVED rather than read out of the text.** The config is imported and its
    // proxy target is inspected, so an expression that happened to mention the constant while
    // computing something else would fail here. A text assertion alone could not tell those apart.
    const loaded = (await import('../vite.config.js')).default as {
      server?: { proxy?: Record<string, { target?: { port?: number } }> };
    };
    const targets = Object.values(loaded.server?.proxy ?? {});
    expect(targets.length, 'the dev proxy forwards nothing — this test proves nothing').toBeGreaterThan(4);
    for (const target of targets) {
      expect(target.target?.port, 'a proxy entry no longer resolves the declared default')
        .toBe(DEFAULT_DAEMON_PORT);
    }
    // And the config reaches it by import rather than by copy, which is what makes the equality
    // above a property of one declaration instead of two that currently agree.
    const config = fs.readFileSync(path.join(ROOT, 'vite.config.ts'), 'utf8');
    expect(config, 'the config stopped importing the declared default').toContain('DEFAULT_DAEMON_PORT');
    expect(/\b7717\b/.test(config), 'the config spells a second copy of the default').toBe(false);
    // The needle discriminates, over a literal assembled so this file is not its own subject.
    expect(/\b7717\b/.test(`const p = ${'77'}${'17'};`)).toBe(true);
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
