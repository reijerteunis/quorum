/**
 * The narrowed context `runAgentStep` hands `buildPrompt` carries every field a materialisation
 * needs, and `reportDiff` is the one that was dropped.
 *
 * **Why this file exists, stated rather than implied.** Q-0134 shipped the gate screen's diff and it
 * was blank on every chore run. `steps.ts` builds `promptContext` as an explicit object literal,
 * narrowing the run context field by field; `reportDiff` is **optional** on `DiffContext`, so
 * omitting it typechecks, lints and passes every suite. The run-level preflight path kept working —
 * it uses the run context directly — while the step-time path silently captured nothing. Measured
 * over this repository's own run history that is **186 of 208 materialised patches, 89%**, and every
 * chore run this product performs, which is the exact blindness `diff.ts`'s capture comment
 * describes and Q-0134 AC-1 exists to forbid, reproduced one layer up in a different file.
 *
 * Three cross-vendor review rounds approved it, all three handed a diff truncated on the files where
 * the binding lives. What caught it was running the product at a gate — Q-0134 GO-5 — which is why
 * that obligation is written the way it is.
 *
 * **A type cannot catch this**, which is why the check is a source scan: an absent optional property
 * is a valid value of the type. So the rule is stated about the literal itself.
 */
import { describe, expect, test } from 'vitest';

import { repoFile } from '../../test/corpus.js';

/** The one file this scan reads, named as a literal so `turbo-inputs.test.ts` clause B collects it. */
const STEPS = 'packages/core/src/engine/steps.ts';

const steps = (): string => repoFile(STEPS);

/** The `promptContext` object literal, from its declaration to the closing brace. */
function promptContextLiteral(text: string): string {
  const start = text.indexOf('const promptContext');
  expect(start, 'steps.ts declares no promptContext — this check has lost its subject').toBeGreaterThan(-1);
  const end = text.indexOf('\n  };', start);
  expect(end, 'the promptContext literal is not closed where this scan expects').toBeGreaterThan(start);
  // **Comments are blanked before anything is matched**, and that is not tidiness: the first version
  // of this file matched `reportDiff` anywhere in the literal, and the explanatory comment sitting
  // directly above the forwarded field contains that word — so deleting the field left the check
  // green. A guard satisfied by its own explanation is the defect this whole ticket kept finding,
  // committed inside the guard written to catch it. Caught by mutation rather than by reading.
  return blankComments(text.slice(start, end));
}

/** Replaces comment bodies with spaces, so a scan sees code and never its own justification. */
function blankComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length))
    .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length));
}

describe('Q-0134 — the step-time diff capture survives the narrowed prompt context', () => {
  test('promptContext forwards reportDiff, whose absence made the gate screen blank on every chore run', () => {
    const literal = promptContextLiteral(steps());
    expect(literal, 'promptContext drops `reportDiff`, so a step-time materialisation captures nothing '
      + 'and the gate screen says the deciding step was given no diff about a step that was given one')
      .toMatch(/reportDiff:\s*context\.reportDiff/);
  });

  test('the scan discriminates, so the clause above is an absence rather than a typo', () => {
    // The same predicate over a literal that does NOT forward it must fail, or the assertion is
    // satisfied by any text at all.
    const without = 'const promptContext: PromptContext = {\n    repoDir: context.repoDir, dry: context.dry,';
    expect(/reportDiff:\s*context\.reportDiff/.test(without), 'the needle matches a literal that omits the field').toBe(false);
  });
});
