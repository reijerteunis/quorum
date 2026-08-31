// Which files this workspace's Vitest configuration collects, as a question a test can ask.
//
// Two guards ask it and neither may answer it for itself: `src/test-discovery.test.ts` asks it of
// every `*.test.ts` in every workspace package, and `src/spike-parity.test.ts` asks it of every
// counterpart the parity register names. Two copies would let one go on passing while the
// configuration moved under the other, which is the shape this repository keeps recording.
//
// **The answer is read out of `vitest.shared.js` rather than assumed**, and that is load-bearing
// rather than tidy. Taking Vitest's defaults directly would leave every behavioural clause green
// over a configuration that had been narrowed back — a check blind to its own subject, which is
// the defect the guards above exist to close, one level in. Demonstrated: restoring the pre-Q-0054
// include turns three assertions red rather than none.
//
// It is READ rather than imported because `vitest.shared.js` is JavaScript and `allowJs` is off in
// `tsconfig.base.json`; turning it on to import one file would change how every package compiles.
// The reader understands the two forms this configuration may take and throws on any third, so a
// shape it cannot resolve stops the suite instead of resolving to a default nobody wrote.
import path from 'node:path';

import { configDefaults } from 'vitest/config';

import { repoFile } from './corpus.js';

/**
 * The include declared by `text`, which is `vitest.shared.js`'s own source.
 *
 * Two forms, because two are meaningful here: the deliberate default this workspace takes, and a
 * literal list — which is what a narrowing looks like, and which the guards must be able to see in
 * order to refuse it.
 *
 * @throws {Error} when no include is declared, when the spread form does not import
 *   `configDefaults` from the module this file takes it from, or when the declaration is a shape
 *   this reader cannot resolve. Each would otherwise put a value nobody wrote behind every clause.
 */
function declaredInclude(text: string): readonly string[] {
  if (/include:\s*\[\s*\.\.\.configDefaults\.include\s*,?\s*\]/.test(text)) {
    if (!/import\s*\{[^}]*\bconfigDefaults\b[^}]*\}\s*from\s*'vitest\/config'/.test(text)) {
      throw new Error("vitest.shared.js spreads configDefaults.include without importing it from 'vitest/config'");
    }
    const defaults = configDefaults.include ?? [];
    if (defaults.length === 0) throw new Error("vitest's configDefaults declares no include — the discovery guards have no subject");
    return defaults;
  }
  const literal = /include:\s*\[([^\]]*)\]/.exec(text);
  if (literal === null) throw new Error('vitest.shared.js declares no test.include — the discovery guards have no subject');
  const patterns = [...literal[1].matchAll(/'([^'\n]+)'|"([^"\n]+)"/g)].map((match) => match[1] ?? match[2]);
  if (patterns.length === 0) throw new Error('vitest.shared.js declares an include this reader cannot resolve');
  return patterns;
}

/** The include patterns every package resolves to, taken from the one shared configuration. */
export const includePatterns: readonly string[] = declaredInclude(repoFile('vitest.shared.js'));

/**
 * Whether `relative` is collected by `patterns`.
 *
 * @param relative a path below a **package** root with `/` separators — `src/engine/diff.test.ts`,
 *   never a repository-relative path, because each package's Vitest run is rooted at its own
 *   directory.
 * @param patterns the include to test against. A parameter so a fixture can ask the same question
 *   of the configuration as it stood before Q-0054, which is what makes the widening demonstrable
 *   rather than asserted.
 */
export const collects = (relative: string, patterns: readonly string[] = includePatterns): boolean =>
  patterns.some((pattern) => path.matchesGlob(relative, pattern));
