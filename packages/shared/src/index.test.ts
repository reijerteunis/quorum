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

  test('the package declares an exports map — the workspace\'s first', () => {
    const pkg = readJson('packages/shared/package.json');
    expect(pkg.exports).toBeDefined();
    const entry = (pkg.exports as Record<string, Record<string, string>>)['.'];
    expect(entry.types).toBe('./src/index.ts');
    expect(entry.default).toBe('./src/index.ts');
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

  test('core declares the dependency, and nothing else in core changed', () => {
    const core = readJson('packages/core/package.json');
    expect((core.dependencies as Record<string, string>)[`${SCOPE}shared`]).toBe('workspace:*');
    // The resolution proof itself is a new test file in core, not an edit to a core source file:
    // packages/core/src/shared-resolution.test.ts.
    expect(fs.readFileSync(path.join(repoRoot, 'packages/core/src/index.ts'), 'utf8'))
      .toBe(`export const name = '${SCOPE}core';\n`);
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
