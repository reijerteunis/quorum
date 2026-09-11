import { describe, expect, test } from 'vitest';

import { coreSourceFiles, repoFile } from '../../test/corpus.js';

// The corpus already carries every file's text, so the sources are taken from it rather than
// re-read through a templated path. That is not tidiness: a template handed to a read API is an
// indirect route under turbo-inputs.test.ts clause C1, and a route whose paths are computed has to
// be registered before the guard will accept it. Reading what the corpus already collected leaves
// no literal to register and no second way for this file to name a path.
const engine = new Map(
  coreSourceFiles()
    .filter(([name]) => name.startsWith('engine/'))
    .map(([name, text]) => [name.slice('engine/'.length), text] as const),
);
const production = [...engine.keys()];
const source = (name: string): string => {
  const text = engine.get(name);
  if (text === undefined) throw new Error(`corpus missing: packages/core/src/engine/${name}`);
  return text;
};

/**
 * Every `export` whose preceding non-blank line does not close a JSDoc block, as `file:export …`.
 *
 * `export {` and `export type {` re-export a symbol documented where it is declared, and are the
 * one form excluded; everything else — function, const, class, interface, type alias — is a
 * declaration this folder owns and must document.
 */
function undocumentedExports(files: ReadonlyArray<readonly [string, string]>): string[] {
  const undocumented: string[] = [];
  for (const [name, text] of files) {
    const lines = text.split('\n');
    lines.forEach((line, index) => {
      if (!/^export (?:declare )?(?:async )?(?:function|const|class|interface|type|enum) /.test(line)) return;
      const previous = lines.slice(0, index).reverse().find((candidate) => candidate.trim() !== '');
      if (previous?.trim().endsWith('*/') !== true) undocumented.push(`${name}:${line.split('(')[0]!.trim()}`);
    });
  }
  return undocumented;
}

/**
 * Every sentence of forty characters or more in `text`, with soft wrapping undone first.
 *
 * Paragraphs are unwrapped before sentences are split, because the corpus is markdown wrapped at
 * about a hundred columns and splitting on `\n` shreds a sentence into fragments that then fall
 * under the floor. Line fragments are kept alongside the sentences so a single copied line is
 * caught as well as a copied sentence.
 */
function corpusOf(text: string): string[] {
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, ' ').trim());
  const sentences = paragraphs.flatMap((p) => p.split(/(?<=[.!?])\s+/));
  const lines = text.split('\n');
  return [...new Set([...sentences, ...lines].map((t) => t.trim().replace(/\s+/g, ' ')).filter((t) => t.length >= 40))];
}

/**
 * The authority a `Why:` clause names, as a stable label — and the check that it names one at all.
 *
 * This is AC-13's *"one line naming the authority"* half with teeth: the clause must be
 * classifiable from the `Why:` line alone, so an authority that only becomes legible on the next
 * line throws here rather than passing as prose. The deleted 120-character proxy was the only
 * pressure on that half and it measured length, which is not the same property.
 */
function classifyAuthority(clause: string, file: string): string {
  const text = clause.trim();
  if (/^behaviour preserved from spike\//.test(text)) return 'behaviour-from-spike';
  if (/^deliberate addition, not preservation/.test(text)) return 'deliberate addition';
  const preserved = /^preserved (\w+)(?:, see (?:Q-0050 )?(AC-\d+[a-z]?|Q-\d+))?/.exec(text);
  if (preserved) return preserved[2] ? `preserved ${preserved[1]!}/${preserved[2]}` : `preserved ${preserved[1]!}`;
  throw new Error(`${file}: "Why: ${text.slice(0, 60)}" names no authority this check recognises`);
}

/** The first corpus sentence a comment line reproduces verbatim, or `undefined`. */
function transcribedIn(line: string, sentences: readonly string[]): string | undefined {
  const text = line.replace(/^\s*(?:\/\/|\*|\/\*\*)\s*/, '').trim().replace(/\s+/g, ' ');
  return sentences.find((sentence) => text.includes(sentence));
}

describe('Q-0050 AC-1/AC-5e/AC-13c — module boundary', () => {
  test('the owned folder is exactly eleven documented modules with the contracted exports', () => {
    expect(production).toStrictEqual(['channel.ts', 'composite.ts', 'diff.ts', 'engine.ts', 'lifecycle.ts', 'loaders.ts', 'prompt.ts', 'routing.ts', 'steps.ts', 'suite-output.ts', 'types.ts']);
    expect(source('engine.ts')).toMatch(/export function runFlow/);
  });

  test('AC-1d — every export carries its own JSDoc, anchored on the export and not on the file', () => {
    // Anchored per export. The check used to be one `/\/\*\*[\s\S]*?export /` per FILE, which a
    // module header plus any one export satisfies whatever the other exports look like — it was
    // green over `createEventChannel`, which had none, and would have stayed green for every file
    // Q-0051 to Q-0053 add to this folder.
    expect(undocumentedExports(production.map((name) => [name, source(name)] as const))).toStrictEqual([]);
  });

  test('AC-1d — the anchored check fails over an export whose JSDoc is missing', () => {
    // Demonstrated failing before it is trusted, over the real violation it was green on:
    // `channel.ts`'s one export, rebuilt here by removing the block above it.
    const stripped = source('channel.ts').replace(/\/\*\*(?:(?!\*\/)[\s\S])*?\*\/\n(?=export function createEventChannel)/, '');
    expect(stripped).not.toBe(source('channel.ts'));
    expect(undocumentedExports([['channel.ts', stripped]])).toStrictEqual(['channel.ts:export function createEventChannel']);
  });

  test('engine code prints nothing, exits nowhere and installs no signals', () => {
    const all = production.map(source).join('\n');
    // Every way to subscribe, not the two names AC-5 happened to spell: `addListener`,
    // `prependListener` and `prependOnceListener` are the same subscription and passed the
    // narrower alternation. The rule — a library that exits the process cannot host M3's daemon —
    // governs every file Q-0051 to Q-0053 will add here, so it is widened while the folder is six.
    expect(all).not.toMatch(/console\.|process\.(stdout|stderr|exit|on|once|addListener|prependListener|prependOnceListener)\b|\u001b\[/);
    // Q-0107 AC-12 — `retired`, the second clause: `not.toMatch(/from ['"][^'"]*spike\//)`. After
    // the cutover such an import fails `tsc --noEmit` before it reaches any assertion, so the
    // clause could only report something the compiler had already refused. Its sibling is
    // `packages/cli/src/spike-dependencies.test.ts`, which covers this folder as part of
    // `packages/**` and covers two shapes this regex never saw — a bare quoted segment handed to a
    // path join, and a path literal that is not an import specifier at all.
  });

  test('engine.ts reaches the occurrence-event mutation through lifecycle.ts, never beside it', () => {
    // What makes lifecycle.test.ts's composed-path test a statement about the shipped wiring: the
    // capability delegates, so exactly one layer appends the history entry and the log line.
    const engineSource = source('engine.ts');
    expect(engineSource).toMatch(/recordOccurrenceEvent: \([^)]*\) => recordEvent\(context, stage, event, cost\)/);
    expect(engineSource).not.toMatch(/recordOccurrenceEvent: \([^)]*\) => \{/);
  });

  test('core consumes the shared event contract', () => {
    expect(source('types.ts')).toContain("from '@quorum/shared'");
  });
});

describe('Q-0050 AC-4h/AC-9d/AC-12 — authorised source-shape checks', () => {
  const routing = (): string => source('routing.ts');

  test('Q-0037 AC-4: routing.ts holds no timer, and nothing stands in for the one it held', () => {
    // The inverse of the AC-4h pin that stood here, which asserted the `signalWindow` marker and
    // the literal `1000` were preserved together. It is replaced rather than weakened: an assertion
    // that merely stopped requiring the marker would have been satisfied by a timer carrying no
    // authority line at all, which is the worse of the two states.
    //
    // In this package the timer's stated purpose never existed. Its comment said it held libuv open
    // so a signal could reach the finaliser, and AC-5 removed signal handling from `core` entirely —
    // cancellation is the caller's `AbortSignal`. The spike's copy is gone in the same change, where
    // it did have a purpose: holding a test fixture's process alive. That fixture owns its own
    // bounded handle now (Q-0037 AC-2).
    //
    // The second clause is AC-5's no-lifecycle-masking half: no interval, no keep-alive and no
    // second timer may replace what was removed. The fixture is the only thing that gains a handle.
    expect(routing()).not.toMatch(/signalWindow/);
    expect(routing()).not.toMatch(/setTimeout|setInterval|setImmediate/);
  });

  // The ported twin of the spike assertion in `packages/shared/src/constants.test.ts`. It lives on
  // this side because `packages/shared` must not read `packages/core`, even in a test — the
  // dependency direction 04-architecture.md fixes, and the thing Q-0072's input guard refused when
  // the assertion was first written on the wrong side. See Q-0089.
  test('Q-0089: the default verdict path is scoped by run and by iteration', () => {
    const template = /verdict_file \?\? `([^`]+)`/.exec(source('steps.ts'))?.[1];
    expect(template, 'core must still have a default verdict path').toBeDefined();
    expect(template, 'scoped to one run').toContain('run-{run}');
    expect(template, 'scoped to one traversal').toContain('{iter}');
    expect(template, 'still names the step').toMatch(/\$\{stepId\}/);
  });

  // Q-0107 AC-9/AC-10 — `re-aimed`. `packages/shared/src/constants.test.ts` counted the spike's
  // `base_branch ?? 'main'` sites (five in `engine.js`, one in the CLI) beside
  // `DEFAULT_BASE_BRANCH`; that count is evidence about a tree Q-0103 deletes. The property worth
  // keeping is not how many literals the spike had but that this folder has none — so it is
  // asserted here, over the tree that survives, where `lint.source.test.ts` already asserts the
  // same thing for its own folder.
  // It is a register rather than a prohibition because the port did NOT convert every site, and
  // that is reported rather than repaired here: `composite.ts:94` and `:248` still write
  // `context.config.repo?.base_branch ?? 'main'`, exactly as `spike/src/engine.js` did, while
  // `diff.ts` and `engine.ts` reach `DEFAULT_BASE_BRANCH`. Q-0107 AC-19 admits three production
  // files and this is not one of them, and R-5 says a production change beyond those is a finding
  // to bring to the gate. So the divergence is pinned in both directions: a THIRD bare literal
  // fails, and closing the two that exist fails too, which is how a repair becomes a deliberate
  // act rather than a silence.
  test('Q-0107: the base-branch default is reached through shared, except where the port left it', () => {
    const bare = production.flatMap((name) => {
      const hits = source(name).match(/base_branch \?\? 'main'/g) ?? [];
      return hits.map(() => name);
    });
    expect(bare, 'the two sites the port left spelled out, and no third').toStrictEqual(['composite.ts', 'composite.ts']);
    // The other half: a folder that named neither the constant nor a literal would satisfy a
    // prohibition by having no default at all, which is the vacuous reading of the same claim.
    const readers = production.filter((name) => source(name).includes('DEFAULT_BASE_BRANCH'));
    expect(readers, 'the sites that do reach it through shared').toStrictEqual(['diff.ts', 'engine.ts']);
  });

  test('AC-9d: no engine helper resets or deletes task branches', () => {
    // Derived from `production`, as every other check in this file is. The hard-coded six-name array
    // that stood here failed OPEN: it stayed green while the seventh file went unscanned, which is a
    // check blind to its own subject in a guard written to catch exactly that. Q-0051's own suite
    // demonstrates the difference rather than asserting it.
    const all = production.map(source).join('\n');
    expect(all).not.toMatch(/(?:reset|delete|remove)TaskBranch/i);
  });

  test('AC-12a/b: both owned branch-head conflations are CLOSED, and neither pin survives', () => {
    // This asserted the two authority lines were present until Q-0074, which is the ticket they
    // routed to — so the check that outlives the defect is the one that fails if either comes back.
    // Both reads are three-answer now: `engine.ts`'s at run start and `lifecycle.ts`'s at rollback,
    // separately, because widening one and leaving the other is exactly the shape this pair had.
    const needle = /Why: preserved defect, see Q-0050 AC-12\./;
    // Shown to have a subject before it is believed (Q-0111): the pattern is exercised against the
    // line as it stood, so a needle that could never fire fails HERE rather than reporting absence.
    expect(needle.test('    // Why: preserved defect, see Q-0050 AC-12.'),
      'the needle no longer matches the line it was written against').toBe(true);
    for (const name of ['engine.ts', 'lifecycle.ts']) {
      expect(source(name), `${name} still pins a branch-head conflation`).not.toMatch(needle);
    }
    // And the other direction, which a prohibition alone cannot give: the behaviour that replaced
    // them is there, and it is the one decision 088 ruled — not reset, warn, and record.
    expect(source('lifecycle.ts'), 'the rollback does not say what it did instead').toContain('rollback-unverified');
  });

  test('AC-13d: every preserved defect is a registered site, and none transcribes a document', () => {
    // A register of identities, not a count. Q-0073's lesson — a floor passes while a site is
    // swapped out, so the register names WHICH file carries WHICH authority and pins the
    // arithmetic. A new preserved defect fails here until it is entered, and a deleted one fails
    // here too, which a `toBeGreaterThanOrEqual` cannot do in either direction.
    // EVERY `Why:` line, classified — not "every line saying `preserved`". Round 4 widened a
    // defect-only scan to a `preserved <word>` scan and left the WORD-ORDER gap: `Why: behaviour
    // preserved from spike/...` (engine.ts, loaders.ts) and `Why: deliberate addition, not
    // preservation` (lifecycle.ts) all escaped it, and `loaders.ts` was absent from the register
    // entirely. That is E-20's own failure mode surviving the fix written to close it, one round
    // later — which is why the anchor is now `Why:` itself, the one token every authority line must
    // carry, and an unclassifiable line FAILS rather than being skipped.
    const REGISTERED: Record<string, readonly string[]> = {
      // Q-0074 removes four, and each of the four was a citation of THIS ticket's own defect class.
      // `composite.ts` loses the two module-header lines — the branch-existence filters that could
      // not tell an absent branch from a failed probe, and the merge-failure fallback that reported
      // `git reported no reason` while git had said it on stdout. `engine.ts` and `lifecycle.ts`
      // lose one each: the two ends of the rollback's branch-head read.
      'composite.ts': [
        'behaviour-from-spike',
        'preserved behaviour/Q-0053', 'preserved defect/Q-0053', 'preserved defect/Q-0053',
        'preserved defect/Q-0053', 'preserved defect/Q-0053', 'preserved defect/Q-0053',
        'preserved defect/Q-0053',
      ],
      'diff.ts': ['behaviour-from-spike', 'deliberate addition', 'behaviour-from-spike', 'preserved behaviour/Q-0038', 'preserved defect/Q-0078'],
      'engine.ts': ['behaviour-from-spike', 'preserved design/Q-0034', 'deliberate addition', 'preserved defect/AC-10', 'preserved behaviour', 'preserved defect/AC-12d'],
      // Q-0116 retired `preserved defect, see Q-0050 AC-10` here: a dry walk no longer mutates the
      // caller's ticket, so the site it registered is not a preserved defect any more. The addition
      // that replaced it is in `engine.ts`, which is where the clone is taken.
      'lifecycle.ts': ['deliberate addition'],
      'loaders.ts': ['behaviour-from-spike'],
      'prompt.ts': ['behaviour-from-spike', 'preserved defect/Q-0038'],
      'routing.ts': ['preserved defect/AC-12', 'preserved behavior'],
      'steps.ts': ['behaviour-from-spike', 'preserved defect/Q-0052', 'preserved defect/Q-0052'],
      'suite-output.ts': ['behaviour-from-spike', 'preserved behaviour/Q-0053'],
    };
    const found: Record<string, string[]> = {};
    for (const name of production) {
      const hits = [...source(name).matchAll(/Why: ([^\n]*)/g)].map(([, clause]) => classifyAuthority(clause!, name));
      if (hits.length > 0) found[name] = hits;
    }
    expect(found).toStrictEqual(REGISTERED);
    // Eighteen authority lines, of which SIX are Q-0050's own preserved defects: AC-10c, AC-10f
    // and AC-12a/b/c/d. Re-derived from the register above rather than decremented from the
    // nineteen-and-SEVEN that stood here, because this narration is cumulative and already trailed
    // the map — subtracting one from a sentence that was itself a sum produces a differently stale
    // number, and a true record made false is what nothing here catches. Q-0037 removed AC-4h:
    // `routing.ts`'s one-second `signalWindow`, whose comment said it held libuv open for a signal
    // path that AC-5 had already removed from this package. It went from the spike in the same
    // change, where it did have a purpose — holding a test fixture's process alive — and that
    // fixture now owns its own bounded handle. E-20's enumeration is therefore one shorter than
    // the sentence it ruled on; the ruling stands, its subject list does not. Q-0051 added one:
    // `diff.ts`'s Q-0078 cache keying, which it registers rather than disguises as newly correct.
    // Q-0052 adds three: `prompt.ts`'s read of that same cache, which is where the keying is
    // actually consumed, and two in `steps.ts` — `resolveModel`'s adapter guard, and the unguarded
    // `usage` in the step's runs.log line. The guard's marker was registered in run 2, withdrawn in
    // run 3 when the loop shipped AC-4(a)'s strict form, and restored by hand after the gate:
    // errata E-1 rules the criterion's prose the thing that moves, not the ported code.
    // Q-0053 adds eight, all in `composite.ts`. Five are AC-14's: the branch-existence filters and
    // the merge-failure fallback, both file-wide and both in the module header; the inter-wave
    // merge's re-derived branch name; that merge only warning when it fails; and the evidence loop
    // reading the unfiltered branch list. THREE were found by porting rather than inherited from
    // the criterion — the `tests=ok` a conflicted integrate logs for a command it never ran, the
    // task branch the fan-out records without ever writing it onto the child template, and the
    // base-conflict throw leaving its occurrence at `running` with no `output.txt`, which review
    // round 1 asked to be repaired and charter §2 refuses. Its other two authority lines are not
    // defects: the module header's provenance, and the JSON round trip AC-6 requires.
    // `suite-output.ts` adds two, neither a defect — its provenance, and the two deliberately
    // distinct result-line regexes AC-10 forbids unifying.
    // The one marker this ticket wrote that this count CANNOT see is `git/git.ts`'s errata E-1
    // divergence, because this register is scoped to `engine/`; `q0053.source.test.ts` pins it.
    // Q-0074 removes FOUR and adds none, so fourteen, of which FOUR are Q-0050's own: AC-10c,
    // AC-10f, AC-12c and AC-12d. AC-12a and AC-12b are gone with the conflation they pinned — the
    // rollback's two branch-head reads, one at each end — and `composite.ts`'s two module-header
    // lines with the branch filter and the merge-failure fallback they described. Re-derived from
    // the register above rather than subtracted from eighteen, for the reason the paragraph opens
    // with: a sentence that is itself a sum goes differently stale when it is decremented.
    // Not implied by the map above: this counts across files and is the number E-20 ruled on, so it
    // fails if a defect marker is moved between files rather than added or removed.
    // 14 until Q-0116, which RETIRED one rather than moving it: `lifecycle.ts`'s
    // `preserved defect, see Q-0050 AC-10` registered a dry walk mutating the caller's ticket, and a
    // dry walk no longer does. A decrement here is the one edit this clause is designed to make
    // expensive, so it is stated with what was removed and why rather than quietly adjusted.
    expect(Object.values(found).flat().filter((m) => m.startsWith('preserved defect/'))).toHaveLength(13)
  });

  test('AC-13d: no authority line reproduces a sentence from the decisions index or the ticket body', () => {
    // Round 5, codex: the first version of this scan split on every newline as well as on terminal
    // punctuation. The corpus files are soft-wrapped markdown, so a sentence spanning two lines was
    // shredded into fragments and the fragments under the 40-character floor were then dropped
    // entirely — measured at the time: 195 corpus entries, of which only 7 were whole sentences,
    // and 65 of 72 real sentences invisible. The scan written to close a fake-coverage finding was
    // itself ~90% blind. Paragraphs are now unwrapped before sentences are split, and the line
    // fragments are kept alongside them so a single copied line is caught too.
    const documents = [
      repoFile('docs/DECISIONS.md'),
      repoFile('backlog/Q-0050-core-engine-run-loop/ticket.md'),
    ].join('\n');
    const sentences = corpusOf(documents);
    expect(sentences.length, 'the scan needs a non-empty corpus, or it reports success over nothing').toBeGreaterThan(60);

    // EVERY line, not only the one carrying the marker. Four authority comments run to two or three
    // lines, so six continuation lines sat outside the scan — one of them already citing a decision
    // by title. `harness/rules.md`'s "never transcribe DECISIONS.md or a ticket body" governs the
    // whole file, so the scan does too.
    for (const name of production) {
      for (const line of source(name).split('\n')) {
        const transcribed = transcribedIn(line, sentences);
        expect(transcribed, `${name}: comment transcribes "${String(transcribed).slice(0, 60)}…"`).toBeUndefined();
      }
    }
  });

  test('AC-13d: the scan catches a sentence that was soft-wrapped in its source', () => {
    // The fixture codex asked for, and the case the first version could not see. The sentence is
    // taken from the real corpus AS IT IS WRAPPED THERE — across two lines — and pasted onto an
    // authority line as one line, which is exactly what transcribing looks like.
    const documents = repoFile('docs/DECISIONS.md');
    const sentences = corpusOf(documents);
    // The discriminating property: a sentence that does NOT appear verbatim in the raw file. It
    // exists only because the paragraph was unwrapped — in the source its words are separated by a
    // newline and indentation, in the corpus by a single space. The first version of this fixture
    // looked for "a sentence followed by a newline", which every whole LINE also satisfies, so it
    // passed against the very builder it was written to rule out. Checked below.
    const multiLine = sentences.find((sentence) => sentence.length >= 60 && !documents.includes(sentence));
    expect(multiLine, 'the corpus must contain a sentence that is soft-wrapped in the source').toBeDefined();
    expect(documents.includes(multiLine!), 'the fixture sentence must be absent from the raw text').toBe(false);

    expect(transcribedIn(`  // Why: preserved defect, see Q-0050 AC-1. ${multiLine!}`, sentences)).toBe(multiLine);
    expect(transcribedIn('  // Why: preserved defect, see Q-0050 AC-1.', sentences)).toBeUndefined();
  });
});
