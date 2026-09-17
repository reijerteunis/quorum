import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DEFAULT_DAEMON_PORT } from '@quorum/shared';
import { describe, expect, test } from 'vitest';

import {
  DAEMON_ENDPOINTS, gateDiffPath, runDetailPath, runEventsPath, runEventsUrl, runGatePath, runStopPath,
} from '../src/daemon-endpoints.js';

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

  test.each(['a/b', 'a?b', 'a#b', 'a b', '../project'])(
    'Q-0016 AC-6 — the two run paths confine hostile handle %s to one segment', (handle) => {
      // A handle is whatever a URL carried, decoded out of one segment by the router and not
      // trusted to be one this daemon minted: a token holding a separator is not one name, and a
      // traversing one must not become a path this app POSTs to. Both are asserted over a real
      // `URL`, so the claim is about what a browser would send rather than about the string.
      for (const [named, built] of [['detail', runDetailPath(handle)], ['gate', runGatePath(handle)]] as const) {
        const url = new URL(built, `https:${'//'}example.test/runs/x/gate`);
        expect(url.pathname, `the ${named} path escaped its own segment`)
          .toBe(`${DAEMON_ENDPOINTS.runs}/${encodeURIComponent(handle)}${named === 'gate' ? '/gate' : ''}`);
        expect(url.search, `the ${named} path carried a query`).toBe('');
        expect(url.hash, `the ${named} path carried a fragment`).toBe('');
        expect(built.startsWith(DAEMON_ENDPOINTS.runs), `the ${named} path is not page-relative`).toBe(true);
      }
      // …and the two are one segment apart rather than the same path, which is the near-homograph
      // worth pinning: a gate answer sent to the detail path is a POST the daemon does not route.
      expect(runGatePath(handle).startsWith(runDetailPath(handle))).toBe(true);
      expect(runGatePath(handle)).not.toBe(runDetailPath(handle));
    });

  test('Q-0016 AC-6 — the gate path is not a proxy prefix, and is built from the one that is', () => {
    // The register is the set of prefixes the dev server forwards, and `/runs` already forwards
    // everything below it — so a sixth entry here would claim a prefix nothing forwards, and
    // `daemon-endpoints.test.ts`'s own identity clause below would have to move to accept it.
    expect(runGatePath('run-3')).toBe(`${DAEMON_ENDPOINTS.runs}/run-3/gate`);
    expect(Object.values(DAEMON_ENDPOINTS), 'the gate segment became a forwarded prefix of its own')
      .not.toContain('/gate');
  });

  test.each(['a/b', 'a?b', 'a#b', 'a b', '../project'])(
    'Q-0130 AC-2 — the stop path confines hostile handle %s to one segment', (handle) => {
      // `runGatePath`'s clause one act later, and for its reasons: a handle is whatever a URL
      // carried, and a traversing one must not become a path this app POSTs to. Asserted over a
      // real `URL`, so the claim is about what a browser would send rather than about the string.
      const built = runStopPath(handle);
      const url = new URL(built, `https:${'//'}example.test/runs/x/gate`);
      expect(url.pathname, 'the stop path escaped its own segment')
        .toBe(`${DAEMON_ENDPOINTS.runs}/${encodeURIComponent(handle)}/stop`);
      expect(url.search, 'the stop path carried a query').toBe('');
      expect(url.hash, 'the stop path carried a fragment').toBe('');
      expect(built.startsWith(DAEMON_ENDPOINTS.runs), 'the stop path is not page-relative').toBe(true);
      // …and the three run paths are three, one segment apart rather than the same path: a stop
      // sent to the detail path is a POST the daemon does not route, and one sent to the gate path
      // is an envelope that route refuses.
      expect(new Set([runDetailPath(handle), runGatePath(handle), runStopPath(handle)]).size,
        'two of the three run paths collapsed into one').toBe(3);
      expect(built.startsWith(runDetailPath(handle))).toBe(true);
    });

  test('Q-0130 AC-2 — the stop segment is written out, and is not a proxy prefix', () => {
    // The literal exists so the write guard's exemption has a string to find: `test/source.test.ts`
    // permits it in `daemon-endpoints.ts` and nowhere else, and an exemption forgiving something
    // nobody wrote would forgive nothing. The register is the set of prefixes the dev server
    // forwards, and `/runs` already forwards everything below it.
    expect(runStopPath('run-3')).toBe(`${DAEMON_ENDPOINTS.runs}/run-3/stop`);
    expect(Object.values(DAEMON_ENDPOINTS), 'the stop segment became a forwarded prefix of its own')
      .not.toContain('/stop');
    const module = fs.readFileSync(path.join(ROOT, 'src', 'daemon-endpoints.ts'), 'utf8');
    expect(module, 'the stop segment is assembled rather than written, so the exemption forgives nothing')
      .toContain(`= '${'/stop'}'`);
  });

  test.each(['a/b', 'a?b', 'a#b', 'a b', '../project'])(
    'Q-0134 AC-5 — the gate-diff path confines hostile handle %s to one segment', (hostile) => {
      // `runStopPath`'s clause for its reasons, with one more of its own: this path has TWO
      // caller-supplied segments rather than one, and the second is a correlation token that carries
      // a separator by construction — `nextGateId` spells `<run number>:<n>`. A builder that encoded
      // the handle and trusted the id would be closed at one end.
      const built = gateDiffPath(hostile, '1:2');
      const url = new URL(built, `https:${'//'}example.test/runs/x/gate`);
      expect(url.pathname, 'the gate-diff path escaped its own segments')
        .toBe(`${DAEMON_ENDPOINTS.runs}/${encodeURIComponent(hostile)}/gates/${encodeURIComponent('1:2')}/diff`);
      expect(url.search, 'the gate-diff path carried a query').toBe('');
      expect(url.hash, 'the gate-diff path carried a fragment').toBe('');
      expect(built.startsWith(runDetailPath(hostile)), 'the gate-diff path is not below the run it is about').toBe(true);
      // …and a hostile GATE ID is confined too, which is the end a one-sided builder would leave open.
      const token = new URL(gateDiffPath('run-3', hostile), `https:${'//'}example.test/`);
      expect(token.pathname).toBe(`${DAEMON_ENDPOINTS.runs}/run-3/gates/${encodeURIComponent(hostile)}/diff`);
    });

  test('Q-0134 AC-5 — the two gate-diff segments are written out, and neither is a proxy prefix', () => {
    // The literals exist so `test/routes.test.ts`'s route-literal scan has strings to find: a
    // segment assembled out of a template is a path no register asks about, and this route is a GET,
    // so the write guard — which is what gives `/gate` and `/stop` their strings — never sees it.
    expect(gateDiffPath('run-3', '1:1')).toBe(`${DAEMON_ENDPOINTS.runs}/run-3/gates/1%3A1/diff`);
    for (const segment of ['/gates', '/diff']) {
      expect(Object.values(DAEMON_ENDPOINTS), `${segment} became a forwarded prefix of its own`)
        .not.toContain(segment);
      const module = fs.readFileSync(path.join(ROOT, 'src', 'daemon-endpoints.ts'), 'utf8');
      expect(module, `${segment} is assembled rather than written, so no register can ask about it`)
        .toContain(`= '${segment}'`);
    }
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
