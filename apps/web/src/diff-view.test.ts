// @vitest-environment jsdom
/**
 * Q-0134 AC-9 and AC-10 — the patch as a patch, and the truncation as the run measured it.
 *
 * THE DOM COMES FROM THE DOCBLOCK ABOVE AND FROM NOWHERE ELSE, and the file is `.test.ts` rather
 * than `.test.tsx`, for `gate-screen.test.ts`'s reasons: `apps/web/vitest.config.js` is pinned byte
 * for byte by the discovery guard and `testFilesIn` matches a `.test.ts` suffix only, so a `.tsx`
 * suite would run while being invisible to that guard and hashed by no turbo input.
 *
 * **The classifier is exercised as a function and the rendering as a document**, because the two
 * claims are different: *every line gets a kind* is arithmetic over strings, and *nothing is lost*
 * is about what a reader can see. A fixture that only asserted the first would pass over a renderer
 * that classified perfectly and drew nothing.
 */
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, test } from 'vitest';

import type { DiffEvidence } from '@quorum/shared';

import {
  classifyDiffLine, DIFF_COMPLETE, DIFF_LINE_KINDS, DIFF_NONE_ABSENT, DIFF_OMITTED_PREFIX,
  DIFF_TRUNCATED, DiffRegion, diffLines, PatchView, TruncationNotice,
  type DiffLineKind,
} from './diff-view.js';

declare global {
  // React refuses to run `act` outside an environment that declares itself one, and says so rather
  // than silently not flushing. `var` is what a global declaration takes.
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mounted: (() => void)[] = [];

afterEach(async () => {
  for (const unmount of mounted.splice(0)) await act(async () => unmount());
  document.body.innerHTML = '';
});

/** Render into a real document and answer the element it was mounted into. */
async function render(element: Parameters<ReturnType<typeof createRoot>['render']>[0]): Promise<HTMLElement> {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(element));
  mounted.push(() => root.unmount());
  return container;
}

/** A line long enough that wrapping it would be visible, and distinctive enough to find. */
const LONG_LINE = `+const wide = '${'w'.repeat(400)}';`;

/** A line of patch text that IS markup, which is where an escape would land. */
const MARKUP_LINE = '+const html = "<img src=x onerror=alert(1)>";';

/**
 * One patch carrying every shape AC-9 names.
 *
 * Written out rather than produced by `git diff`, and deliberately: what this is about is a
 * renderer's reading of the format, so the fixture has to be able to carry the shapes a real
 * repository would take several commits to produce — a rename with no hunks, a binary file, an
 * unrecognised line — beside the ordinary ones.
 */
const PATCH = [
  'diff --git a/src/a.ts b/src/a.ts',
  'index 1111111..2222222 100644',
  '--- a/src/a.ts',
  '+++ b/src/a.ts',
  '@@ -1,4 +1,5 @@',
  ' const kept = 1;',
  '-const gone = 2;',
  '+const added = 2;',
  LONG_LINE,
  MARKUP_LINE,
  '\tconst tabbed = 3;',
  ' \tconst contextTab = 4;',
  '\\ No newline at end of file',
  'diff --git a/old/name.ts b/new/name.ts',
  'similarity index 100%',
  'rename from old/name.ts',
  'rename to new/name.ts',
  'diff --git a/logo.png b/logo.png',
  'Binary files a/logo.png and b/logo.png differ',
  '',
].join('\n');

/** The evidence a fixture hands the region, over {@link PATCH} unless it says otherwise. */
const evidence = (over: Partial<DiffEvidence> = {}): DiffEvidence => ({
  stepId: 'review',
  range: 'harness/Q-0134/integration...harness/Q-0134/implement',
  stat: ' src/a.ts | 4 ++--\n src/z.ts | 2 +-\n 2 files changed',
  patch: PATCH,
  truncated: false,
  limit: 200000,
  kept: PATCH.length,
  total: PATCH.length,
  omitted: [],
  ...over,
});

/** Every rendered patch line, as `[kind, text]`, in the order the document holds them. */
const rendered = (container: HTMLElement): [string, string][] =>
  [...container.querySelectorAll('[data-diff-line]')]
    .map((node) => [node.getAttribute('data-diff-line') ?? '', node.textContent ?? ''] as [string, string]);

describe('Q-0134 AC-9 — every line is classified, and the classification is by the format\'s own marker', () => {
  test.each([
    ['diff --git a/x b/x', 'meta'],
    ['index 111..222 100644', 'meta'],
    ['--- a/x', 'meta'],
    ['+++ b/x', 'meta'],
    ['--- /dev/null', 'meta'],
    ['new file mode 100644', 'meta'],
    ['deleted file mode 100644', 'meta'],
    ['rename from a', 'meta'],
    ['rename to b', 'meta'],
    ['similarity index 90%', 'meta'],
    ['Binary files a/x and b/x differ', 'meta'],
    ['GIT binary patch', 'meta'],
    ['\\ No newline at end of file', 'meta'],
    ['@@ -1,2 +1,3 @@ fn main()', 'hunk'],
    ['+added', 'added'],
    ['-removed', 'removed'],
    [' context', 'context'],
    ['', 'context'],
    ['literal 1234', 'other'],
    ['\tleading tab', 'other'],
  ] as [string, DiffLineKind][])('%j is %s', (line, kind) => {
    expect(classifyDiffLine(line)).toBe(kind);
  });

  test('the file headers are read before the single character they begin with', () => {
    // **The one ordering that decides whether this works at all.** `--- a/x` and `+++ b/x` open with
    // the same characters a removed and an added line do, so a classifier testing the character
    // first files every file header as content — which is not a cosmetic error: a reader counting
    // what changed would count two of them per file.
    expect(classifyDiffLine('--- a/src/a.ts')).not.toBe('removed');
    expect(classifyDiffLine('+++ b/src/a.ts')).not.toBe('added');
    // …and the single-character rule still applies to everything that is not a header.
    expect(classifyDiffLine('-const gone = 2;')).toBe('removed');
    expect(classifyDiffLine('+const added = 2;')).toBe('added');
  });

  test('every kind in the closed set is reachable, so none is a member nothing produces', () => {
    const produced = new Set(DIFF_LINE_KINDS.map((kind) => kind));
    const seen = new Set(diffLines([
      'diff --git a/x b/x', '@@ -1 +1 @@', '+a', '-b', ' c', 'literal 9',
    ].join('\n')).map((line) => line.kind));
    expect([...seen].sort()).toStrictEqual([...produced].sort());
  });

  test('the one terminating newline is not a line, and every other empty line is kept', () => {
    expect(diffLines('+a\n+b\n').map((line) => line.text)).toStrictEqual(['+a', '+b']);
    expect(diffLines('+a\n\n+b').map((line) => line.text)).toStrictEqual(['+a', '', '+b']);
    expect(diffLines('').map((line) => line.text)).toStrictEqual(['']);
  });
});

describe('Q-0134 AC-9 — the patch renders whole, as text, and without losing whitespace', () => {
  test('every line of the fixture reaches the document, in order and byte for byte', async () => {
    const container = await render(createElement(PatchView, { patch: PATCH }));
    const drawn = rendered(container);
    const lines = diffLines(PATCH);
    expect(drawn.length, 'the renderer dropped or invented a line').toBe(lines.length);
    expect(drawn.map(([, text]) => text), 'a line was trimmed, reordered or rewritten')
      .toStrictEqual(lines.map((line) => line.text));
    expect(drawn.map(([kind]) => kind)).toStrictEqual(lines.map((line) => line.kind));
  });

  test('the five kinds AC-9 names are distinguishable without the palette', async () => {
    // Two independent signals and neither is colour: the line's own leading marker, which is
    // rendered rather than stripped, and the attribute the document carries. A monochrome reader has
    // the first; a test has both.
    const container = await render(createElement(PatchView, { patch: PATCH }));
    const byKind = new Map(rendered(container).map(([kind, text]) => [kind, text]));
    for (const kind of ['meta', 'hunk', 'added', 'removed', 'context']) {
      expect(byKind.has(kind), `no line of the fixture is ${kind} — this check has lost a subject`).toBe(true);
    }
    expect(byKind.get('added')?.startsWith('+'), 'an added line lost its marker').toBe(true);
    expect(byKind.get('removed')?.startsWith('-'), 'a removed line lost its marker').toBe(true);
    expect(byKind.get('hunk')?.startsWith('@@'), 'a hunk header lost its marker').toBe(true);
  });

  test('a tab stays a tab and leading spaces stay spaces', async () => {
    const container = await render(createElement(PatchView, { patch: PATCH }));
    const texts = rendered(container).map(([, text]) => text);
    expect(texts, 'a tab was turned into spaces').toContain('\tconst tabbed = 3;');
    expect(texts, 'a context line\'s leading space was trimmed').toContain(' const kept = 1;');
    expect(texts, 'a mixed space-and-tab indent was normalised').toContain(' \tconst contextTab = 4;');
    // The declaration that keeps it that way, rather than a claim about CSS nobody checks: a
    // renderer that dropped it would collapse every run of whitespace in the document.
    const line = container.querySelector('[data-diff-line]');
    expect(line?.className, 'the patch is not rendered with whitespace preserved').toContain('whitespace-pre');
  });

  test('a long line is scrollable rather than wrapped, and the page does not widen', async () => {
    const container = await render(createElement(PatchView, { patch: PATCH }));
    expect(rendered(container).map(([, text]) => text), 'the long line was cut').toContain(LONG_LINE);
    const block = container.querySelector('[data-diff-patch]');
    expect(block?.className, 'the patch block does not scroll, so a long line widens the page')
      .toContain('overflow-x-auto');
  });

  test('a line of patch text that is markup renders as text', async () => {
    const container = await render(createElement(PatchView, { patch: PATCH }));
    expect(rendered(container).map(([, text]) => text), 'the markup line did not reach the document')
      .toContain(MARKUP_LINE);
    // The half that says it is TEXT: the document holds no element the patch's own bytes created.
    expect(container.querySelector('img'), 'a patch line became an element').toBeNull();
    expect(container.innerHTML, 'the markup was not escaped').toContain('&lt;img');
  });

  test('an unrecognised line is rendered whole rather than dropped', async () => {
    const container = await render(createElement(PatchView, { patch: 'literal 8192\nzcmV-a$0\n' }));
    expect(rendered(container)).toStrictEqual([['other', 'literal 8192'], ['other', 'zcmV-a$0']]);
  });
});

describe('Q-0134 AC-10 — the truncation rendered is the one the run measured', () => {
  test('an untruncated patch says so, and is never labelled cut', async () => {
    const container = await render(createElement(TruncationNotice, { evidence: evidence() }));
    expect(container.textContent).toContain(DIFF_COMPLETE);
    expect(container.textContent, 'a whole patch was reported as cut').not.toContain(DIFF_TRUNCATED);
    expect(container.querySelector('[data-diff-truncation]')?.getAttribute('data-diff-truncation')).toBe('complete');
  });

  test('a cut with no wholly absent file says THAT, rather than printing an empty list', async () => {
    const container = await render(createElement(TruncationNotice, {
      evidence: evidence({ truncated: true, limit: 400, kept: 398, total: 4321, omitted: [] }),
    }));
    const text = container.textContent ?? '';
    expect(text).toContain(DIFF_TRUNCATED);
    expect(text).toContain(DIFF_NONE_ABSENT);
    expect(text, 'a list nobody has was introduced').not.toContain(DIFF_OMITTED_PREFIX);
    expect(container.querySelector('[data-diff-omitted]')?.getAttribute('data-diff-omitted')).toBe('none');
  });

  test('a cut that lost whole files names every one of them', async () => {
    const omitted = ['packages/shared/src/wire.ts', 'packages/shared/src/events.ts', 'zz/last.ts'];
    const container = await render(createElement(TruncationNotice, {
      evidence: evidence({ truncated: true, limit: 200000, kept: 199987, total: 267881, omitted }),
    }));
    const text = container.textContent ?? '';
    expect(text).toContain(DIFF_OMITTED_PREFIX);
    for (const file of omitted) expect(text, `${file} was not named`).toContain(file);
    expect([...container.querySelectorAll('[data-diff-omitted-file]')].map((node) => node.textContent))
      .toStrictEqual(omitted);
    expect(text, 'the cut was reported as leaving every file some patch').not.toContain(DIFF_NONE_ABSENT);
  });

  test('the three figures are the evidence\'s own, rendered rather than recomputed', async () => {
    // **The browser half of *the two consumers agree***. `packages/core`'s
    // `engine/diff-evidence.test.ts` shows that the notice the STEP is given is composed from these
    // same fields of one materialisation; this shows the browser renders those fields and derives
    // none. A single test cannot span the two: `apps/web/src` may import no `@quorum/core`, which is
    // `docs/04-architecture.md`'s boundary 4 and not something to work around for a test.
    const given = evidence({ truncated: true, limit: 200000, kept: 199987, total: 267881, omitted: ['z.ts'] });
    const container = await render(createElement(TruncationNotice, { evidence: given }));
    expect(container.querySelector('[data-diff-kept]')?.textContent).toBe(String(given.kept));
    expect(container.querySelector('[data-diff-total]')?.textContent).toBe(String(given.total));
    expect(container.querySelector('[data-diff-limit]')?.textContent).toBe(String(given.limit));
    // No second cap: what is drawn is every line of the patch it was handed, whatever the figures
    // above say about what git produced.
    const region = await render(createElement(DiffRegion, { evidence: given }));
    expect(rendered(region).length).toBe(diffLines(given.patch).length);
  });
});

describe('Q-0134 AC-8 — the region names what was compared and where it came from', () => {
  test('it carries the deciding step, the interpolated range and the per-file summary', async () => {
    const given = evidence();
    const container = await render(createElement(DiffRegion, { evidence: given }));
    const text = container.textContent ?? '';
    expect(container.querySelector('[data-diff-range]')?.textContent).toBe(given.range);
    expect(text, 'the region does not name the step the bytes were given to').toContain(given.stepId);
    expect(container.querySelector('[data-diff-stat]')?.textContent, 'the summary is not git\'s own')
      .toBe(given.stat);
    // The summary names files the patch may not carry, which is what makes it worth rendering
    // beside a cut one rather than being derivable from the patch.
    expect(given.stat).toContain('src/z.ts');
    expect(given.patch, 'the fixture\'s summary names no file the patch lacks').not.toContain('src/z.ts');
  });
});
