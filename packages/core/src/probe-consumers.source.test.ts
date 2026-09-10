// Q-0074 AC-5 — every consumer of a three-answer branch probe, and what it does with the answer
// none of them used to be told.
//
// **The register beside this one classifies where a git failure is CAUGHT; this one classifies
// where the result of that catch is READ.** They are different populations and neither implies the
// other: `caught-failures.source.test.ts` would go on passing over a `branchProbe` that
// discriminates perfectly and a caller that immediately collapses the three answers back into two,
// which is the whole of what this ticket is about one layer up. Decision 088 says so in as many
// words — which of the three responses applies is a property of the caller, not of the probe.
//
// See *"A probe that could not answer is not a negative"* (2026-09-10).
import { describe, expect, test } from 'vitest';

import { coreSourceFiles } from '../test/corpus.js';

// ---------------------------------------------------------------------------------------------
// The scanner
// ---------------------------------------------------------------------------------------------

/** The two functions whose answers this file is about, as `fanout/fanout.ts` exports them. */
const PROBES = ['branchProbe', 'branchHead'] as const;

/** What a consumer does with the answer that the probe could not tell. */
const RESPONSES = [
  /** It stops, and names the work a human has to do. Decision 088's response 1. */
  'stop',
  /** It carries on and says so — the uncertainty reaches an event, a note or a durable record. */
  'carry',
  /** It hands the answer on unchanged, and the next reader decides. */
  'forward',
] as const;

type Response = (typeof RESPONSES)[number];

/** One place a probe's answer is read, identified by what the tree says rather than by a line. */
interface Site {
  /** The corpus key — `engine/composite.ts`, never a bare filename. */
  readonly file: string;
  /** Which probe was called. */
  readonly probe: string;
  /** The call's own line, whitespace-normalised. Edit the line and the identity changes. */
  readonly text: string;
}

const identify = (site: Site): string => `${site.file}: ${site.text}`;

/** `text` with every block comment blanked to spaces, so prose is not scanned as code. */
const withoutBlockComments = (text: string): string =>
  text.replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '));

/**
 * Every line of one file that calls a probe, or reaches one through the injected reader.
 *
 * `readBranchHead` is included by name because `lifecycle.ts` never spells `branchHead`: the reader
 * is a capability on the context, wired in `engine.ts`, and a scan for the export alone would find
 * eight consumers and report nine — the rollback being the one site whose collapse cost the most.
 * Whole-line `//` comments are dropped so a remark naming a probe is not collected as a call.
 */
function sitesIn(file: string, source: string): Site[] {
  return withoutBlockComments(source).split('\n').flatMap((line): Site[] => {
    if (line.trim().startsWith('//')) return [];
    const probe = [...PROBES, 'readBranchHead'].find((name) => new RegExp(`\\b${name}\\(`).test(line));
    if (probe === undefined) return [];
    return [{ file, probe: probe === 'readBranchHead' ? 'branchHead' : probe, text: line.trim().replace(/\s+/g, ' ') }];
  });
}

/** Every consumer across `packages/core/src`, excluding the module that declares the two probes. */
const consumers = (corpus: readonly (readonly [string, string])[] = coreSourceFiles()): Site[] =>
  corpus.filter(([name]) => name !== 'fanout/fanout.ts').flatMap(([name, text]) => sitesIn(name, text));

// ---------------------------------------------------------------------------------------------
// The register
// ---------------------------------------------------------------------------------------------

/** One classified consumer: what it does with `failed`, quoted from the tree, and why. */
interface Classified {
  readonly response: Response;
  /**
   * A verbatim fragment of the file that DOES what `response` claims.
   *
   * Required to appear in that file's own text, which is what stops the classification drifting
   * from the code — the same rule the caught-failure register runs on, at a coarser grain because a
   * consumer's answer is often several lines below the call that produced it.
   */
  readonly becomes: string;
  /** One sentence: what the unanswerable case does here, and why that is the right response. */
  readonly reason: string;
}

/**
 * Every place in `packages/core/src` that reads one of the two probes.
 *
 * **No assertion below reads a total.** A tenth consumer fails until it is classified, and a
 * consumer that goes away fails too; the arithmetic is nobody's, which is Q-0073's rule and the one
 * the census next door rotted twice for want of.
 *
 * **The bound, stated rather than left to be found:** `engine.ts`'s `readBranchHead: branchHead,` is
 * a *wiring* and not a read — it names no call — so it is outside this register, and swapping the
 * reader for something else would be invisible here. That seam is asserted as source text by
 * `q0050.source.test.ts`, which is where this package pins its delegations; widening the scanner to
 * collect an assignment would put a wiring and a read in one population and make the `response`
 * column mean two things.
 */
const REGISTER: Record<string, Classified> = {
  "engine/composite.ts: const endpoint = branchProbe(context.repoDir, branch);": {
    response: 'carry',
    becomes: 'was not synced to ${base} before the fan-out',
    reason: 'The pre-fan-out base sync still skips, and no longer in silence: merging anyway would put `obtainTicketWorktree` next, which cuts a worktree from HEAD for a branch nobody established was missing — response 1\'s "otherwise unverifiable" rather than response 2\'s.',
  },
  "engine/composite.ts: const probe = branchProbe(context.repoDir, branch);": {
    response: 'carry',
    becomes: 'it is merged anyway rather than dropped',
    reason: 'Integrate\'s merge list, and the most severe of the ten: a failed probe removed a task branch as though absent, so nothing reached `conflicts`, no line reached the notes, and the suite ran green against a tree missing that task\'s work. An unanswerable probe never shortens the list; the merge is then the authority.',
  },
  "engine/composite.ts: const baseProbe = base && base !== into ? branchProbe(context.repoDir, base) : 'absent';": {
    response: 'carry',
    becomes: 'synced anyway rather than skipped',
    reason: 'Integrate\'s base sync. Skipping on a failed probe is the Q-0004 defect — a ticket integrating against the base it was cut from — reached by a route that leaves no trace, so the sync is attempted and its own result is what the notes and the event carry.',
  },
  "engine/composite.ts: const head = branchHead(context.repoDir, into);": {
    response: 'carry',
    becomes: "'(unknown — git failed)'",
    reason: 'The integration notes are a durable artifact read after the run, and `(new)` is a claim — that this branch had no head — which was written for a probe that failed as readily as for one that answered.',
  },
  "engine/engine.ts: const head = branchHead(context.repoDir, ticket.meta.branch);": {
    response: 'carry',
    becomes: 'could not be read${head.detail === null',
    reason: 'An undecided run is by definition one nobody was watching, so `runs.log` is what is read afterwards — and `does not exist` written of a branch git was asked about and could not answer is a claim this line has no evidence for. `kept-at` gains a third value with it.',
  },
  "engine/engine.ts: const branchHeadAtStart = branchHead(repoDir, ticket.meta.branch);": {
    response: 'forward',
    becomes: 'branchHeadAtStart,',
    reason: 'Read at run start and acted on at the end, so it carries all three answers onto the context rather than deciding here: `lifecycle.ts` is the caller whose action differs, and this one takes none.',
  },
  "engine/lifecycle.ts: const current = context.readBranchHead(context.repoDir, branch);": {
    response: 'carry',
    becomes: 'rollback-unverified',
    reason: 'Decision 088 ruled it: a rollback that cannot read a head does not reset, warns, and records. The skip stays — there is no way to tell a moved branch from an unmoved one — and it stops being silent, which is what let a failed run keep integrate\'s merge with nothing said.',
  },
  "engine/steps.ts: const existedProbe = branchProbe(context.repoDir, branch);": {
    response: 'carry',
    becomes: 'could not tell whether ${branch} already existed',
    reason: 'Reading a failed probe as "the branch is new" skips the base sync, which is the Q-0004 defect again, so it counts as existing and the sync\'s own result is reported.',
  },
  "engine/steps.ts: const baseProbe = branchProbe(context.repoDir, stepBase);": {
    response: 'carry',
    becomes: 'syncing anyway rather than skipping',
    reason: 'Never the `does not exist yet` sentence beside it, which states an absence git did not report — that one is normal on a ticket\'s first pass and stays an `info`, while this is a `warn` and the merge is attempted.',
  },
};

describe('Q-0074 AC-5 — every consumer of a three-answer probe answers for itself', () => {
  test('the register names exactly the consumers the tree holds', () => {
    const found = consumers().map(identify).sort();
    // A duplicate identity would let one entry answer for two sites, which is the failure a
    // `toStrictEqual` cannot show. It stops rather than disambiguating by position: an ordinal
    // within a file rots exactly as a line number does — and it fired on its first run, over the
    // two `composite.ts` sites that were spelled identically and do opposite things.
    expect(found, 'two consumers share an identity, so one register entry answers for both')
      .toStrictEqual([...new Set(found)]);
    expect(found).toStrictEqual(Object.keys(REGISTER).sort());
  });

  test('the vocabulary is decision 088\'s three, and `stop` is unused here on purpose', () => {
    // Stated rather than left as dead vocabulary. Response 1 is real and lands in this change — it
    // is `fanout/fanout.ts`'s `commitAll`, which refuses rather than committing over a `backlog/` it
    // could not read — but `commitAll` reads no branch probe, so it is not this register's. A
    // consumer here that ever needs to stop has a name for it; none does today, and if that changes
    // the row says `stop` instead of this comment going stale.
    expect([...RESPONSES]).toStrictEqual(['stop', 'carry', 'forward']);
    expect(Object.values(REGISTER).map((entry) => entry.response)).not.toContain('stop');
    expect(coreSourceFiles().find(([name]) => name === 'fanout/fanout.ts')![1],
      'response 1 is claimed for `commitAll` and is not there').toContain('nothing was committed');
  });

  test('and each classification still describes the code, because it quotes it', () => {
    for (const site of consumers()) {
      const entry = REGISTER[identify(site)]!;
      expect(RESPONSES as readonly string[], `${identify(site)}: unknown response`).toContain(entry.response);
      expect(entry.reason.length, `${identify(site)}: a classification with no reason`).toBeGreaterThan(40);
      const file = coreSourceFiles().find(([name]) => name === site.file)![1];
      expect(file, `${identify(site)}: \`becomes\` no longer appears in ${site.file}`).toContain(entry.becomes);
    }
  });

  test('no consumer tests a probe\'s answer for truthiness alone', () => {
    // The shape the rename exists to make impossible, asserted rather than trusted to it: a
    // three-answer union read as a boolean is a type error under NO shape this could have returned,
    // so the compiler cannot be the guard here and this is what stands in for it.
    for (const site of consumers()) {
      expect(site.text, `${identify(site)}: a probe's answer read for truthiness`)
        .not.toMatch(/(?:if|while)\s*\(\s*!?\s*(?:branchProbe|branchHead|context\.readBranchHead)\(/);
      expect(site.text, `${identify(site)}: a probe's answer used as a filter predicate`)
        .not.toMatch(/=>\s*(?:branchProbe|branchHead)\([^)]*\)\s*[),]/);
    }
    // Shown to have a subject, on the two shapes the consumers actually had before this ticket.
    for (const shape of [
      'if (!branchExists(context.repoDir, into)) return { skipped: `${into} does not exist yet` };',
      'branches = branches.filter((branch) => branchExists(context.repoDir, branch));',
    ]) {
      const asProbe = shape.replace(/branchExists/g, 'branchProbe');
      expect(/(?:if|while)\s*\(\s*!?\s*(?:branchProbe|branchHead|context\.readBranchHead)\(/.test(asProbe)
        || /=>\s*(?:branchProbe|branchHead)\([^)]*\)\s*[),]/.test(asProbe),
      `neither pattern fires on ${shape}`).toBe(true);
    }
  });

  test('every consumer that decides something names all three answers, not two', () => {
    // A consumer classified `carry` or `stop` acts on the failure, so its file has to spell the
    // third answer somewhere. `forward` is exempt by definition: it takes no decision, which is
    // what makes it the one response a file can hold without naming `failed` at all.
    const deciding = consumers().filter((site) => REGISTER[identify(site)]!.response !== 'forward');
    expect(deciding.length, 'every consumer forwards, so this clause has no subject').toBeGreaterThan(0);
    for (const site of deciding) {
      const file = coreSourceFiles().find(([name]) => name === site.file)![1];
      expect(file, `${identify(site)}: decides on a probe without naming its third answer`)
        .toMatch(/'failed'/);
    }
  });
});

describe('Q-0074 AC-5 — and the register is shown to fail, on each way a consumer can go missing', () => {
  // The scanner takes its corpus as an argument for the reason `test/corpus.ts` grew the same seam:
  // a guard that cannot fire is the defect this ticket exists to prevent.

  const unregistered = (corpus: readonly (readonly [string, string])[]): string[] =>
    consumers(corpus).map(identify).filter((key) => !(key in REGISTER));

  test('an eleventh consumer is reported, by name', () => {
    expect(unregistered([['engine/new-step.ts', [
      'export function step(repoDir: string, branch: string): boolean {',
      "  return branchProbe(repoDir, branch) === 'present';",
      '}',
    ].join('\n')]])).toStrictEqual(["engine/new-step.ts: return branchProbe(repoDir, branch) === 'present';"]);
  });

  test('one reached through the injected reader is reported too, which no import scan sees', () => {
    // `lifecycle.ts`'s own shape, and the site whose collapse cost the most. A scan keyed on the
    // export would find nothing here and report full coverage.
    expect(unregistered([['engine/other.ts', [
      'export function roll(context: LifecycleContext, branch: string): void {',
      '  const head = context.readBranchHead(context.repoDir, branch);',
      '}',
    ].join('\n')]])).toStrictEqual(['engine/other.ts: const head = context.readBranchHead(context.repoDir, branch);']);
  });

  test('a probe named in PROSE is not a consumer, so the scan is not satisfied by a comment', () => {
    expect(unregistered([['engine/prose.ts', [
      '/**',
      ' * Reads branchHead(repoDir, branch) at run start, which Q-0074 made three-answer.',
      ' */',
      '// and branchProbe(repoDir, branch) below it, on a line comment',
      'export const nothing = 1;',
    ].join('\n')]])).toStrictEqual([]);
  });

  test('the module that DECLARES the probes is not its own consumer', () => {
    // Otherwise every internal call arrives here — `mergeInto`'s own `branchHead(dir, 'MERGE_HEAD')`
    // among them — and a register that asks for more than it is about is one nobody keeps accurate.
    expect(consumers().some((site) => site.file === 'fanout/fanout.ts')).toBe(false);
    expect(unregistered([['fanout/fanout.ts', "  const merging = branchHead(dir, 'MERGE_HEAD');"]])).toStrictEqual([]);
  });
});
