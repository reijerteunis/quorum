/**
 * Q-0014 AC-4 — the three lint rules this workspace enforces reach `.tsx`.
 *
 * A flat-config `**` + `/*.ts` pattern does NOT match a `.tsx` file, so until this ticket
 * `no-explicit-any`, `ban-ts-comment` and `no-deprecated` reached no line of the app — the largest
 * body of new source in this milestone — while `pnpm lint` reported green over it. `tsc --noEmit`
 * covers `.tsx` once `jsx` is configured, so `typecheck` was never the gap; `lint` silently was.
 * That is Q-0069's finding arriving on a new corpus, and it is why the widening is a criterion
 * rather than a tidy-up.
 *
 * THE DEFECT IS EXHIBITED BEFORE IT IS CLOSED. {@link BEFORE} is the pattern list as it stood, and
 * {@link shippedPatterns} reads the list as it stands out of the file itself — never transcribed,
 * or this would be a check comparing a document with its own paraphrase. The fixture path is
 * asserted matched by nothing under the first and matched under the second, as two assertions over
 * two lists, so the clause cannot be satisfied by a pattern that matches everything.
 *
 * `eslint.config.js` is one of four files root `turbo.json` hashes as a `globalDependency`, for
 * every task in every package — so this read is covered without `apps/web` earning its first
 * `turbo.json`, which is the arrangement Q-0108 landed when `covered` began honouring turbo's own
 * `globalCacheInputs.files`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ESLint } from 'eslint';
import { describe, expect, test } from 'vitest';

/** The repository root: `apps/web/src/` → three levels up. */
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

const CONFIG = 'eslint.config.js';

/** The pattern list as it stood before this ticket — the fixture that makes the widening visible. */
const BEFORE = ['packages/**/*.ts', 'apps/**/*.ts'] as const;

/** The three rules the configuration exists to enforce, and which this widening must carry along. */
const RULES = [
  '@typescript-eslint/no-explicit-any',
  '@typescript-eslint/ban-ts-comment',
  '@typescript-eslint/no-deprecated',
];

/**
 * The `files` list the shipped configuration declares, read out of it rather than written here.
 *
 * @throws {Error} when the configuration declares no such list, which would leave every assertion
 *   below passing over an empty array — a check that had lost its subject.
 */
function shippedPatterns(): string[] {
  const text = fs.readFileSync(path.join(REPO_ROOT, CONFIG), 'utf8');
  const found = /\bfiles:\s*\[([^\]]*)\]/.exec(text);
  if (!found) throw new Error(`${CONFIG} declares no \`files\` list — this check has lost its subject`);
  const patterns = [...found[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);
  if (!patterns.length) throw new Error(`${CONFIG}'s \`files\` list is empty — this check has lost its subject`);
  return patterns;
}

/**
 * Whether `patterns` selects `file`, over the two glob shapes this configuration uses.
 *
 * Deliberately narrow: it understands `<prefix>/**` followed by a `*.<extension>` tail and nothing
 * else, and it is the property AC-4 turns on — that an extension tail of `.ts` does not reach a
 * `.tsx` file. A pattern shape it does not understand is refused rather than answered.
 */
function selects(patterns: readonly string[], file: string): boolean {
  return patterns.some((pattern) => {
    const parsed = /^([\w./-]+)\/\*\*\/\*(\.\w+)$/.exec(pattern);
    if (!parsed) throw new Error(`${pattern} is a glob shape this matcher does not understand`);
    const [, prefix, extension] = parsed;
    return file.startsWith(`${prefix}/`) && file.endsWith(extension);
  });
}

describe('AC-4 — the lint corpus reaches the app\'s .tsx files', () => {
  const FIXTURE = 'apps/web/src/shell.tsx';

  test('the fixture is a real file, so this is the corpus rather than a hypothetical', () => {
    expect(fs.existsSync(path.join(REPO_ROOT, FIXTURE)), `${FIXTURE} is not there`).toBe(true);
    expect(fs.readFileSync(path.join(REPO_ROOT, FIXTURE), 'utf8').length).toBeGreaterThan(0);
  });

  test('under the pattern list as it stood, nothing matched it', () => {
    expect(selects(BEFORE, FIXTURE), 'the pre-change list already covered .tsx — the fixture is wrong')
      .toBe(false);
  });

  test('under the list the configuration now ships, it is matched', () => {
    expect(selects(shippedPatterns(), FIXTURE), 'the widening did not reach .tsx').toBe(true);
  });

  test('and the matcher discriminates — the new list does not simply match everything', () => {
    // The clause that stops the two assertions above being satisfied by a pattern list that selects
    // the whole repository. Both directions: a `.ts` file inside the corpus is still selected, and
    // three files outside it are not.
    const patterns = shippedPatterns();
    expect(selects(patterns, 'apps/web/src/routes.ts')).toBe(true);
    expect(selects(patterns, 'apps/web/src/theme.css')).toBe(false);
    expect(selects(patterns, 'apps/web/index.html')).toBe(false);
    expect(selects(patterns, 'docs/04-architecture.md')).toBe(false);
  });

  test('the widening changed the corpus and no policy', () => {
    // AC-4's other half: no rule added, removed or downgraded, and nothing added to `ignores`. The
    // list is read from the file so a rule silently dropped fails here rather than going quiet.
    const text = fs.readFileSync(path.join(REPO_ROOT, CONFIG), 'utf8');
    for (const rule of RULES) {
      expect(text, `${CONFIG} no longer configures ${rule}`).toContain(rule);
    }
    const ignores = /\bignores:\s*\[([^\]]*)\]/.exec(text);
    expect(ignores, `${CONFIG} declares no ignores list — this check has lost its subject`).not.toBeNull();
    expect([...(ignores?.[1] ?? '').matchAll(/'([^']+)'/g)].map((match) => match[1])).toStrictEqual([
      '**/node_modules/**', '**/dist/**', '**/.turbo/**', '**/coverage/**',
    ]);
  });

  test('and ESLint itself resolves the three rules for a .tsx file, at error severity', async () => {
    // The pattern matcher above is this file's own reading of the configuration; this is the tool's.
    // `calculateConfigForFile` is what ESLint would use to lint that path, so a widening that
    // matched here and not there would be caught.
    const eslint = new ESLint({ cwd: REPO_ROOT });
    const resolved = await eslint.calculateConfigForFile(path.join(REPO_ROOT, FIXTURE));
    for (const rule of RULES) {
      const severity = (resolved.rules ?? {})[rule];
      expect(severity, `${rule} does not reach ${FIXTURE}`).toBeDefined();
      expect(Array.isArray(severity) ? severity[0] : severity, `${rule} is not at error severity`).toBe(2);
    }
  });
});
