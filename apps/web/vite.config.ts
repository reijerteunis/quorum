/**
 * The dev server and bundler configuration for the shell.
 *
 * There is no `build` section and no `base`, because this package declares no `build` script:
 * what the daemon serves is Q-0122's, together with the ruling on whether a served bundle is an
 * emitted artifact at all.
 *
 * `resolve.conditions` adds `quorum-source` to Vite's own client defaults rather than replacing
 * them, so the browser keeps every ordinary condition (`module`, `browser`, `import`, ...) and
 * additionally resolves a workspace package such as `@quorum/shared` through its source
 * condition — the one `tsconfig.base.json`'s `customConditions` and `vitest.shared.js`'s
 * `ssr.resolve.conditions` already select, so every toolchain that touches this workspace agrees
 * on which file a workspace package resolves to.
 *
 * `server.proxy` forwards the daemon's endpoints same-origin (Q-0120 AC-13), so the browser
 * itself never names a daemon host, port or scheme — see `src/daemon-endpoints.ts`. The target
 * is an object (host/port/protocol) rather than a URL string, so this file never spells out a
 * scheme-and-slashes literal, which `test/source.test.ts`'s whole-package scan forbids everywhere
 * the browser could read it. `ws: true` is set on every entry because the run-events route
 * upgrades to a WebSocket and a plain HTTP request through the same entry is unaffected by it.
 *
 * `DAEMON_TARGET`'s port is read from `QUORUM_DAEMON_PORT` with 7717 as its documented default —
 * a dev-server convention, not a contract: the daemon itself has no default port
 * (`packages/server` binds whatever the OS hands back), so `quorum open` is what will later have
 * to agree with this value. No test reads the variable (AC-13(c)), which is why `turbo.json`'s
 * `test` task `env` list stays `["QUORUM_REAL_CLI"]`.
 *
 * Three of the five prefixes this proxy forwards — `/runs`, `/flows`, `/history` — are also rail
 * and router paths (`src/routes.ts`), and `/project` is a prefix of the shell's own `/projects`;
 * Vite's proxy middleware runs ahead of its history-API SPA fallback, so an unqualified match
 * swallows a page load at any of those seven routes before the shell ever sees it (Q-0120 review
 * round 1, B-1). `bypassNavigation` tells the proxy to step aside for exactly that case: a
 * top-level browser navigation requests `text/html`, where a same-origin `fetch` of the daemon's
 * JSON and the run-events WebSocket upgrade do not, so the two are told apart without touching
 * either.
 */
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defaultClientConditions, defineConfig, type ProxyOptions } from 'vite';

import { DAEMON_ENDPOINTS } from './src/daemon-endpoints.js';

const DAEMON_TARGET = {
  host: '127.0.0.1',
  port: Number(process.env.QUORUM_DAEMON_PORT ?? 7717),
  protocol: 'http',
} as const;

const bypassNavigation: NonNullable<ProxyOptions['bypass']> = (req) =>
  req.method === 'GET' && req.headers.accept?.includes('text/html') ? '/index.html' : undefined;

const proxy: Record<string, ProxyOptions> = Object.fromEntries(
  Object.values(DAEMON_ENDPOINTS).map((prefix) => [
    prefix,
    { target: DAEMON_TARGET, ws: true, bypass: bypassNavigation },
  ]),
);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    conditions: [...defaultClientConditions, 'quorum-source'],
  },
  server: {
    proxy,
  },
});
