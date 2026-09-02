import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import * as shared from './index.js';
import { codeLines, importSpecifiers, repoRoot, sharedAllFiles, sharedSourceFiles } from '../test/corpus.js';

// The workspace scope, assembled rather than written, so the grep below can cover EVERY file under
// src/ including this one and still come back empty.
const SCOPE = `@${'quorum'}/`;

const readJson = (relative: string): Record<string, unknown> =>
  JSON.parse(fs.readFileSync(path.join(repoRoot, relative), 'utf8')) as Record<string, unknown>;

describe('AC-1 — importable, one runtime dependency, no workspace import', () => {
  test('zod is the only runtime dependency', () => {
    const pkg = readJson('packages/shared/package.json');
    expect(Object.keys(pkg.dependencies as object)).toEqual(['zod']);
    // yaml is a devDependency: the corpus tests use it and nothing that ships does.
    expect(Object.keys(pkg.devDependencies as object)).toEqual(['yaml']);
    expect(importSpecifiers(sharedSourceFiles().map(([, text]) => text).join('\n'))).not.toContain('yaml');
  });

  test('the package declares the conditional map decision 078(b) describes', () => {
    // **Retired by replacement rather than deletion**, on the precedent Q-0096 set for the byte pin
    // it replaced. This pinned the flat map — `types` and `default` both `'./src/index.ts'` — which
    // was the workspace's first exports map and correct while nothing emitted. It is what made
    // `packages/core/dist/index.js` unrunnable: its import of this package by name resolved to
    // `./src/index.ts`, which then died on the `./constants.js` specifier no loader was there to
    // rewrite. An unmet clause of "The emit serves the binary, and no test verdict moves behind it"
    // (2026-09-02), whose (b) asks every consumable package for the same shape (Q-0097 AC-22).
    //
    // The package is named by scope nowhere above: this file is itself under `src/`, so a literal
    // would make the no-workspace-import assertion below its own subject.
    //
    // The workspace condition resolves TypeScript source, so no verdict in this workspace moves
    // behind a build artifact; the default resolves the emit, which is what Node and a packed
    // install get. `packages/core/src/shared-resolution.test.ts` is the other half — a value import
    // of this package proving Vitest still reaches the source branch — and it stays green unchanged.
    const pkg = readJson('packages/shared/package.json');
    expect(pkg.exports).toBeDefined();
    const entry = (pkg.exports as Record<string, Record<string, unknown>>)['.'];
    expect(entry['quorum-source']).toStrictEqual({ types: './src/index.ts', default: './src/index.ts' });
    expect(entry.default, 'the default condition resolves the emit, never the source').toBe('./dist/index.js');
    expect(entry.types).toBe('./dist/index.d.ts');
  });

  test('nothing under src imports a workspace package', () => {
    // The scope never appears anywhere under src/, tests included — which is why the needle above
    // is assembled at run time rather than written out.
    for (const [name, text] of sharedAllFiles()) {
      expect(text, `${name} must not name another workspace package`).not.toContain(SCOPE);
    }
    // And what ships imports zod and its own siblings, nothing else.
    for (const [name, text] of sharedSourceFiles()) {
      for (const specifier of importSpecifiers(text)) {
        expect(specifier.startsWith('./') || specifier === 'zod', `${name} imports ${specifier}`).toBe(true);
      }
    }
  });

  test('shared never imports core', () => {
    // Both needles are assembled, for the reason SCOPE is: this file is itself under src/, so a
    // literal would make the test its own subject. The claim is about what shared IMPORTS, so it is
    // asserted over specifiers rather than over file text — a prose cross-reference naming core is
    // accurate documentation, not a dependency, and containment.ts:3 is one.
    const corePath = `packages/${'core'}`;
    for (const [name, text] of sharedSourceFiles()) {
      for (const specifier of importSpecifiers(text)) {
        expect(
          specifier.includes(`${SCOPE}core`) || specifier.includes(corePath),
          `${name} imports ${specifier}`,
        ).toBe(false);
      }
    }
  });

  test('core declares the dependency', () => {
    const core = readJson('packages/core/package.json');
    expect((core.dependencies as Record<string, string>)[`${SCOPE}shared`]).toBe('workspace:*');
    // The resolution proof itself is a new test file in core, not an edit to a core source file:
    // packages/core/src/shared-resolution.test.ts.
    //
    // **Retired here, deliberately and not by deletion.** This test was called "core declares the
    // dependency, and nothing else in core changed" and its second half pinned
    // `packages/core/src/index.ts` byte for byte. That half's subject was that Q-0041 had not
    // touched `core`, which expired when the port closed on 2026-08-31 and which Q-0096 AC-2
    // falsifies outright by giving the barrel its sixteen-symbol public surface. The first half is
    // the one with a live subject and is what remains; the surface itself is `core`'s to police
    // and is pinned in `packages/cli/src/package.test.ts`, since `shared` may not read `core`.
    // Q-0096 AC-3.
  });
});

describe('AC-2 — declarations only, safe to bundle for a browser', () => {
  const BUILTINS = [
    'assert', 'buffer', 'child_process', 'crypto', 'events', 'fs', 'http', 'https', 'module', 'net',
    'os', 'path', 'process', 'readline', 'stream', 'url', 'util', 'worker_threads', 'zlib',
  ];

  test('no source file imports a runtime capability apps/web cannot have', () => {
    for (const [name, text] of sharedSourceFiles()) {
      for (const specifier of importSpecifiers(text)) {
        expect(specifier.startsWith('node:'), `${name} imports ${specifier}`).toBe(false);
        expect(BUILTINS.includes(specifier), `${name} imports ${specifier}`).toBe(false);
      }
    }
  });

  test('no source file reaches for the filesystem, a process or the environment', () => {
    // Word-boundary anchored so ordinary prose survives — `refs.` is not `fs.`, and a comment may
    // still discuss what the engine does.
    const forbidden: [RegExp, string][] = [
      [/\bnode:/, 'a Node builtin'],
      [/\bfs\./, 'the filesystem'],
      [/\bprocess\./, 'the process'],
      [/\bchild_process\b/, 'a child process'],
      [/\brequire\(/, 'a CommonJS require'],
    ];
    for (const [name, text] of sharedSourceFiles()) {
      for (const [pattern, what] of forbidden) {
        expect(pattern.test(text), `${name} must not reach for ${what}`).toBe(false);
      }
    }
  });

  test('the entry point re-exports and does nothing else', () => {
    const [, text] = sharedSourceFiles().find(([name]) => name === 'index.ts') ?? ['', ''];
    for (const line of codeLines(text)) {
      expect(line.trim(), 'index.ts holds re-exports only').toMatch(/^export \* from '\.\/[a-z-]+\.js';$/);
    }
  });

  test('the entry point exposes every module', () => {
    for (const named of ['flowSchema', 'ticketSchema', 'roleSchema', 'stageSchema', 'STAGES',
      'stepOutputDeclarationSchema', 'agentStepResultSchema', 'eventSchema', 'adapterEventSchema',
      'REPO_WORKTREE_ROOT', 'TICKET_ARTIFACT_DIR', 'RUN_HISTORY_ROOT', 'DEFAULT_BASE_BRANCH',
      'USAGE_MEASURES', 'FINDING_SEVERITIES', 'FINDING_PATTERN', 'integrationBranch']) {
      expect(shared, `index.ts must export ${named}`).toHaveProperty(named);
    }
  });
});
