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
    const forbidden = [/['"`]wss?:/, /127\.0\.0\.1/, /7717/];
    const walk = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory() ? walk(path.join(dir, entry.name)) : [fs.readFileSync(path.join(dir, entry.name), 'utf8')]);
    for (const source of walk(path.join(ROOT, 'src'))) {
      for (const needle of forbidden) expect(needle.test(source)).toBe(false);
    }
  });
});
