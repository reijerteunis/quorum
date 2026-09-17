/**
 * Q-0129 AC-2 as a property of the workspace: **there is no second path to a step's decision.**
 *
 * The other half of AC-2 is `engine/gate-reached.test.ts`, which shows the one path works. Neither
 * can make this one's claim: a value travelling correctly says nothing about a second reader that
 * derives the same value another way and disagrees with it — which is what the decision entry
 * refused six of, each on a measurement, and what a later ticket is most likely to reintroduce by
 * writing a regex over a sentence.
 *
 * **Four needles, over `packages/core/src`, `packages/server/src` and `apps/web/src`.** Each is one
 * of the refused routes, keyed on the shape rather than on a ticket's name:
 *
 *   - reading an event's `.message` for a machine value — the prose refusal, whose measurement is
 *     that 4 of this repository's 1,080 findings contain the join separator in their own text;
 *   - taking a `gateId` apart — the correlation token is opaque by frozen contract, and it is where
 *     a run number would be recovered from if anybody tried;
 *   - naming the ticket's own artifact directory outside the one module that writes it — the
 *     `.harness/` route, which would reopen Q-0127 erratum E-1's reader-side exclusion;
 *   - registering a route whose path names a verdict — the same thing from the transport's side.
 *
 * **Every needle is assembled**, on `browser.source.test.ts`'s rule and for its reason: this file is
 * inside the corpus it walks, so a literal here would make the scan report itself and the register
 * would then need an entry excusing the guard — which is the exemption Q-0079's round 2 found being
 * used to excuse a real call. Each needle is shown to discriminate against a fixture that has the
 * thing and one that does not, so an empty result is an absence rather than a typo.
 */
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { repoRoot } from '../test/corpus.js';

/** The three source trees the claim is about — every package this value can travel through. */
const ROOTS = ['packages/core/src', 'packages/server/src', 'apps/web/src'];

/** Every TypeScript file under `dir`, at any depth, keyed by path from the repository root. */
function walk(dir: string): [string, string][] {
  const descend = (here: string, below: string): [string, string][] =>
    fs.readdirSync(here, { withFileTypes: true }).flatMap((entry) => {
      if (['node_modules', 'dist', '.turbo'].includes(entry.name)) return [];
      const key = below === '' ? entry.name : `${below}/${entry.name}`;
      if (entry.isDirectory()) return descend(path.join(here, entry.name), key);
      return /\.tsx?$/.test(entry.name)
        ? [[`${dir}/${key}`, fs.readFileSync(path.join(here, entry.name), 'utf8')] as [string, string]]
        : [];
    });
  return descend(path.join(repoRoot, dir), '');
}

/** Every file the three roots carry, tests included — a test is as able to invent a route as a module. */
const corpus = (): [string, string][] => ROOTS.flatMap(walk);

/**
 * What ships, which is the corpus of the artifact clause alone and the reason is stated rather than
 * left as a narrowing.
 *
 * A test that reads the artifact back off disk is **proving the write**, not opening a second path
 * to the value — `engine/gate-reached.test.ts` does exactly that, and it is how AC-2's two sources
 * are shown to agree rather than one of them being asserted twice. The other three clauses are over
 * everything, because a test can invent a route or a parser as readily as a module can.
 */
const shipped = (): [string, string][] => corpus().filter(([name]) => !/\.test\.tsx?$/.test(name));

/**
 * Reading a `message` for a value rather than rendering it — ANY `message`, with two named holes.
 *
 * **Keyed on the act and not on the receiver, which was measured rather than preferred.** The first
 * draft required the receiver's name to carry `event`, `gate` or `step`, so that an `Error.message`
 * split would not be collected — and a probe reaching the same field through an optional chain off
 * a cast was invisible to it, which is a guard talked out of firing by a spelling (Q-0079 round 2).
 * Over all three trees exactly **two** sites parse a `message` at all and both are an `Error`, so a
 * register of two is cheaper than a heuristic and strictly stronger: it forbids every parse and
 * names the exceptions, and it fires in both directions, so an entry whose file stops parsing one
 * fails too.
 *
 * Two forms, because a parser takes two: a method **on** the string, and the string handed **to** a
 * pattern. The second is bounded to one statement, so a `.test(` many lines above an unrelated
 * `.message` is not collected.
 *
 * **The residual is stated rather than left to be found**: a message copied into a local named
 * something else and parsed there is invisible here, as it is to every literal scan in this
 * repository. `apps/web`'s own Q-0015 AC-6 needles close that from the other side by keying on the
 * TOKENS a parser looks for — `cost=`, `verdict=` — which this cannot do over `packages/core`,
 * where those strings are what the engine legitimately composes.
 */
const readsMessage = (text: string): boolean =>
  new RegExp(`\\.${'message'}\\s*\\??\\.\\s*(?:split|match|slice|substring|substr|indexOf|replace|startsWith|endsWith)`).test(text)
  || new RegExp(`\\.(?:test|exec)\\([^;\\n]{0,200}?\\.${'message'}\\b`).test(text);

/** The two sites that parse a `message`, with why each is not an event's. */
const PARSES_A_MESSAGE: Record<string, string> = {
  'packages/core/src/lint/lint.test.ts':
    'an `Error`\'s message, split into lines to assert what the linter reported — a stack-carrying exception rather than a sentence the engine composed for a reader',
  'packages/core/src/engine/diff.test.ts':
    'the same: a `FlowError`\'s own message, asked whether it opens with the step that produced it',
};

/** Taking the correlation token apart, which the frozen contract forbids in as many words. */
const splitsGateId = (text: string): boolean =>
  new RegExp(`\\b${'gateId'}\\s*(?:\\.(?:split|slice|substring|substr|match|replace|indexOf|charAt)|\\[)`).test(text);

/**
 * Reaching the verdict artifact's own namespace — by the constant, or by a literal path into it.
 *
 * **Keyed on the artifact's namespace and not on the directory**, which is measured rather than
 * fastidious: `.harness/worktrees` is the same directory holding an unrelated thing, named across
 * `git/` and half this package's fixtures, so a needle on the bare directory name would collect
 * seventeen files that have nothing to do with a verdict. `git.ts`'s own comment says so in as many
 * words. What discriminates is the CONSTANT, which is the only way to reach the namespace the
 * verdict artifact lives in, and a literal path into `run-`, which is the namespace itself.
 */
const ARTIFACT_DIR = `.${'harness'}`;
const ARTIFACT_CONST = ['TICKET', 'ARTIFACT', 'DIR'].join('_');
const reachesTheArtifact = (text: string): boolean =>
  new RegExp(`import[^;]*\\b${ARTIFACT_CONST}\\b`).test(text)
  || text.includes(`'${ARTIFACT_DIR}/${'run'}-`) || text.includes(`"${ARTIFACT_DIR}/${'run'}-`);

/** A route whose registered path names a verdict — the `.harness/` route from the transport's side. */
const routesAVerdict = (text: string): boolean =>
  new RegExp(`\\bapp\\.(?:get|post|put|patch|delete)\\(\\s*['"\`][^'"\`]*${'verdict'}`, 'i').test(text);

/** The one shipped module permitted to reach that namespace, with why. */
const WRITES_THE_ARTIFACT: Record<string, string> = {
  'packages/core/src/engine/steps.ts':
    'the site that writes the verdict artifact, and since Q-0129 the site that puts the same three values into the run-scoped slot a gate question carries — one place, reading `output` once',
};

/** Everything wrong with `files` as a description of `allowed`, one sentence each. */
function offenders(
  files: readonly [string, string][],
  allowed: Record<string, string>,
  does: (text: string) => boolean,
  what: string,
): string[] {
  const problems: string[] = [];
  for (const [name, text] of files) {
    if (does(text) && allowed[name] === undefined) problems.push(`${name}: it ${what} and no entry says why it may`);
    if (!does(text) && allowed[name] !== undefined) problems.push(`${name}: its entry permits what the file does not do`);
  }
  return problems;
}

describe('Q-0129 AC-2 — no second path to what a step decided', () => {
  test('the corpus has a subject, and it is all three trees rather than one', () => {
    // Every failure mode of a walk hides files rather than inventing them, so a corpus that had
    // lost part of its subject would report success on all four clauses below.
    const names = corpus().map(([name]) => name);
    expect(names.length, 'the walk found almost nothing — these scans prove nothing').toBeGreaterThan(40);
    for (const root of ROOTS) {
      expect(names.some((name) => name.startsWith(`${root}/`)), `${root} is outside the corpus`).toBe(true);
    }
    // The three files the four clauses are actually about, so a rename cannot empty this silently.
    expect(names).toContain('packages/core/src/engine/routing.ts');
    expect(names).toContain('packages/server/src/wire.ts');
    expect(names).toContain('apps/web/src/gate-screen.tsx');
  });

  test('nothing takes a machine value out of an event message', () => {
    expect(offenders(corpus(), PARSES_A_MESSAGE, readsMessage, 'parses a message for a value')).toStrictEqual([]);
    // Four directions, so the emptiness above is an absence rather than a needle that matches
    // nothing: a method on the string, the string handed to a pattern, the same reached through an
    // optional chain off a cast — the spelling the receiver-name draft was blind to — and the form
    // a renderer writes, which is what the screen actually does.
    expect(readsMessage(`const verdict = event.${'message'}.split(': ')[1];`)).toBe(true);
    expect(readsMessage(`if (/verdict=/.test(gateEvent.${'message'})) return;`)).toBe(true);
    expect(readsMessage(`const found = /x/.exec(String((row as Cast).event?.${'message'} ?? ''));`)).toBe(true);
    expect(readsMessage(`<p>{event.${'message'}}</p>`)).toBe(false);
  });

  test('nothing takes the correlation token apart', () => {
    expect(offenders(corpus(), {}, splitsGateId, 'takes the correlation token apart')).toStrictEqual([]);
    expect(splitsGateId(`const run = ${'gateId'}.split(':')[0];`)).toBe(true);
    expect(splitsGateId(`answer(handle, { ${'gateId'}, answer })`)).toBe(false);
  });

  test('only the module that writes the verdict artifact reaches its namespace', () => {
    expect(offenders(shipped(), WRITES_THE_ARTIFACT, reachesTheArtifact, 'reaches the verdict artifact')).toStrictEqual([]);
    // Three fixtures, because the needle has to hold two forms and refuse the neighbour that shares
    // the directory — which is the whole of why it is keyed on the namespace rather than on `.harness`.
    expect(reachesTheArtifact(`import { OUTPUT_FILE, ${ARTIFACT_CONST} } from '@quorum/shared';`)).toBe(true);
    expect(reachesTheArtifact(`readFileSync(join(dir, '${ARTIFACT_DIR}/${'run'}-1/review-verdict-iter-1.json'))`)).toBe(true);
    expect(reachesTheArtifact(`const root = join(repoDir, '${ARTIFACT_DIR}/${'worktrees'}');`)).toBe(false);
  });

  test('no route is registered under a path that names a verdict', () => {
    expect(offenders(corpus(), {}, routesAVerdict, 'registers a route naming a verdict')).toStrictEqual([]);
    expect(routesAVerdict(`app.get('/runs/:id/${'verdict'}', (c) => c.json(read(c)));`)).toBe(true);
    expect(routesAVerdict(`app.get('/runs/:id', (c) => c.json(read(c)));`)).toBe(false);
  });

  test('Q-0129 AC-12 — nothing in the two surfaces still routes the decision to this ticket', () => {
    // **Keyed on ROUTING and not on naming, which is the distinction the architecture document's
    // own convention rests on**: provenance survives an edit — *"completed by Q-0129"* is a true
    // sentence about where a screen came from — while a promise that a ticket WILL add something it
    // has added sends a reader looking for a rendering that is now there. So the needle is the
    // possessive and the future-tense forms, over the two trees AC-12 names.
    const ROUTED = /Q-0129(?:'s\b|’s\b| adds\b| will\b| owns\b)/;
    const routing = corpus()
      .filter(([name]) => name.startsWith('packages/server/src/') || name.startsWith('apps/web/src/'))
      .filter(([, text]) => ROUTED.test(text))
      .map(([name]) => name);
    expect(routing, 'a surface still promises what this ticket has landed').toStrictEqual([]);
    // Both directions over the retired sentence and the one that replaced it, so the emptiness
    // above is an absence rather than a needle that matches nothing.
    expect(ROUTED.test('what the step before it decided is what Q-0129 adds.')).toBe(true);
    expect(ROUTED.test("which is Q-0129's, needing a payload no route on this transport carries")).toBe(true);
    expect(ROUTED.test('Built by Q-0016 and completed by Q-0129, which added the decision')).toBe(false);
    // …and the successor is still routed by name, which is what an over-broad needle would have
    // stopped: a register that names no owed half is one nothing notices is owed.
    const successor = corpus()
      .filter(([name]) => name.startsWith('apps/web/src/'))
      .filter(([, text]) => /Q-0134/.test(text));
    expect(successor.map(([name]) => name), 'no surface names the ticket that owes the rest')
      .toContain('apps/web/src/routes.ts');
  });
});
