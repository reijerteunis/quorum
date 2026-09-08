// Q-0047 AC-4 and AC-11: the criteria that are properties of the code and of the document rather
// than of any behaviour.
//
// "A CLI update breaks one file" (docs/04-architecture.md, §Adapters) is not observable at run
// time. It is true only while every vendor token lives in a capabilities module and none has been
// left behind in the adapter that uses it, and that is exactly what a later change loses silently —
// one flag written inline, and the claim quietly stops holding for the file nobody re-reads.
//
// The doc half is the same shape from the other side: `docs/03-adapter-contract.md` records the two
// invocations flag by flag, verified against real CLIs in M0, and nothing has made the code and the
// document disagree loudly since.
import { describe, expect, test } from 'vitest';

import * as claudeCapabilitiesModule from './claude-capabilities.js';
import { CLAUDE_CAPABILITIES } from './claude-capabilities.js';
import * as codexCapabilitiesModule from './codex-capabilities.js';
import { CODEX_CAPABILITIES } from './codex-capabilities.js';
import { coreSourceFiles, repoFile } from '../../test/corpus.js';

const source = (key: string): string => {
  const found = coreSourceFiles().find(([name]) => name === key);
  if (!found) throw new Error(`corpus missing: packages/core/src/${key} does not exist`);
  return found[1];
};

/** Every string in a capabilities object, at any depth. */
const literalsOf = (value: unknown): string[] => {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(literalsOf);
  if (value && typeof value === 'object') return Object.values(value).flatMap(literalsOf);
  throw new Error(`a capabilities module holds ${typeof value}, and it may hold nothing but strings`);
};

/** Every token a RUN invocation passes — what AC-11 checks the document against, per erratum E-2. */
const runTokens = (capabilities: { flags: object; values: object }): string[] =>
  [...literalsOf(capabilities.flags), ...literalsOf(capabilities.values)];

const VENDORS = [
  { name: 'claude', capabilities: CLAUDE_CAPABILITIES, module: claudeCapabilitiesModule, exported: 'CLAUDE_CAPABILITIES', source: 'adapters/claude-capabilities.ts', adapter: 'adapters/claude.ts' },
  { name: 'codex', capabilities: CODEX_CAPABILITIES, module: codexCapabilitiesModule, exported: 'CODEX_CAPABILITIES', source: 'adapters/codex-capabilities.ts', adapter: 'adapters/codex.ts' },
];

describe('AC-4 — a capabilities module is data, and only data', () => {
  test.each(VENDORS)('$name exports exactly one object, holding nothing but strings', ({ module, exported, capabilities }) => {
    expect(Object.keys(module)).toStrictEqual([exported]);
    expect(literalsOf(capabilities).length).toBeGreaterThan(10);
  });

  test.each(VENDORS)('$name has no function, no I/O, no branch and no version selection', ({ source: key }) => {
    const text = source(key);
    for (const forbidden of ['=>', 'function ', 'if (', 'import ', 'require(', 'process.', 'node:']) {
      expect(text.includes(forbidden), `${key} must not contain ${JSON.stringify(forbidden)}`).toBe(false);
    }
    // The version-probe argv is inert data: what `check()` already spawns, written down rather than
    // acted on. A probe is a CLI invocation with a policy attached, which is behaviour and needs its
    // own decision entry first — deferred to Q-0067.
    expect(text).toContain('as const');
  });

  test.each(VENDORS)('$name pins no vendor model alias, as a default, a fallback or a literal', ({ capabilities }) => {
    // Every alias the templates shipped was rejected on a ChatGPT subscription, and the same is
    // true of any name written here: they go stale and a subscription's set is not an API key's
    // ("Flows never pin a vendor model name", docs/DECISIONS.md 2026-08-22).
    for (const literal of literalsOf(capabilities)) {
      expect(/^(gpt-|claude-|opus|sonnet|haiku|o[0-9])/.test(literal), `${literal} looks like a pinned model alias`).toBe(false);
    }
  });

  test('the two modules share no interface, because the two vendors do not', () => {
    // claude returns one JSON envelope and codex streams JSONL, so a common type would describe
    // neither; `gemini` is designed as a copy-and-edit of codex and needs no abstraction.
    // Q-0067 added `verifiedVersion` to both, immediately after `versionArgs`, so the two facts
    // about a version sit together: what `check()` spawns, and what its answer is compared with.
    expect(Object.keys(CLAUDE_CAPABILITIES)).toStrictEqual(['bin', 'versionArgs', 'verifiedVersion', 'flags', 'values', 'envelope', 'usage']);
    expect(Object.keys(CODEX_CAPABILITIES)).toStrictEqual(['bin', 'versionArgs', 'verifiedVersion', 'flags', 'values', 'jsonl', 'usage']);
  });

  test.each(VENDORS)('$name\'s tokens live in the capabilities module and NOWHERE in the adapter', ({ capabilities, adapter, source: key }) => {
    // `bin` is exempt and is the only exemption: it is spelled the same as the vendor label the
    // adapter declares per call, which is a different fact that happens to share a word.
    const text = source(adapter);
    const owned = literalsOf(capabilities).filter((literal) => literal !== capabilities.bin);
    for (const literal of owned) {
      expect(text.includes(`'${literal}'`), `${adapter} spells ${literal} itself; it belongs to ${key}`).toBe(false);
    }
  });

  test.each(VENDORS)('$name\'s adapter holds no argv token literal at all, named or not', ({ adapter }) => {
    // Broader than the check above, and it is the one that catches a flag added later without a
    // capabilities entry: any single-quoted literal beginning with a dash.
    const stray = [...source(adapter).matchAll(/'(-[^']*)'/g)].map((match) => match[1]);
    expect(stray).toStrictEqual([]);
  });
});

describe('AC-11 — the port is checked against docs/03-adapter-contract.md', () => {
  const contract = (): string => repoFile('docs/03-adapter-contract.md');

  test.each(VENDORS)('every token $name passes on a run is written down in the contract document', ({ capabilities }) => {
    // requirements/errata.md E-2 scopes this to the RUN argv: `--version` appears nowhere in that
    // document, and the version probe is Q-0067's subject rather than this ticket's.
    for (const token of runTokens(capabilities)) {
      expect(contract().includes(token), `docs/03-adapter-contract.md does not mention ${token}`).toBe(true);
    }
  });

  /** The fenced block holding one vendor's invocation, found by its content rather than by index. */
  const invocationBlock = (opening: string): string => {
    const block = contract().split('```').find((part) => part.includes(opening));
    if (!block) throw new Error(`docs/03-adapter-contract.md has no invocation block containing ${opening}`);
    return block;
  };

  test('the codex invocation block gained --add-dir, which the adapter has always passed', () => {
    // Divergence 1: the block omitted it while the verification table below it called it verified
    // present. The document was wrong, so the document is what changed.
    expect(invocationBlock('codex exec')).toContain('--add-dir');
  });

  test('and the claude block says its model flag is conditional, as codex\'s line already did', () => {
    // Divergence 2: `--model <alias>` was drawn unqualified while the flag is passed only when the
    // flow names a model — which is the same rule, and the reason no alias is pinned anywhere.
    expect(invocationBlock('claude -p')).toMatch(/--model <alias> only if the flow names one/);
  });

  /**
   * §Adapters alone, sliced out rather than searched for across the whole document.
   *
   * The status line names every ticket that ever edited this file, so a whole-document `toContain`
   * of a ticket id would be satisfied by the history rather than by the section — which is how a
   * check comes to report success over a subject it never read.
   */
  const adaptersSection = (): string => {
    const flowed = repoFile('docs/04-architecture.md').replace(/\s+/g, ' ');
    const start = flowed.indexOf('## Adapters');
    if (start < 0) throw new Error('docs/04-architecture.md has no §Adapters — this check has lost its subject');
    const end = flowed.indexOf('## ', start + '## Adapters'.length);
    return flowed.slice(start, end < 0 ? undefined : end);
  };

  test('Q-0067 AC-13 — the architecture doc describes the report that shipped, not a deferral', () => {
    // **Re-aimed rather than deleted.** Until Q-0067 this asserted that the document called the
    // version probe deferred and named the ticket, so a reader would not take `capabilities.ts`
    // "with a version probe" for shipped. The probe shipped, so the same guard now holds the
    // document to what exists — the alternative, deleting it, would let §Adapters quietly stop
    // describing the code at all.
    const section = adaptersSection();
    expect(section).toContain('capabilities.ts');
    expect(section, 'the claim the modules exist for is gone').toContain('a CLI update breaks one file');
    expect(section, 'the section still calls the version probe deferred')
      .not.toMatch(/version probe[^.]*deferred|deferred[^.]*version probe/);
    expect(section, 'it does not name what each module records').toContain('verifiedVersion');
    expect(section, 'it does not say the report refuses nothing').toMatch(/never refuses|refuses nothing/);
    expect(section, 'it does not say the comparison belongs to --probe').toContain('--probe');
    expect(section).toContain('Q-0067');
  });
});

describe('Q-0067 AC-3 — the recorded version and the document say the same thing', () => {
  /**
   * The two versions `docs/03-adapter-contract.md`'s verification-status line names.
   *
   * Read out of the document rather than retyped, and read as an IDENTITY rather than as two
   * `toContain` probes: a line naming a second claude version would satisfy a substring check and
   * is exactly the drift this exists to catch. The number is a second copy of a documented fact,
   * which is the one real cost of recording it in source, and this equality is the whole mitigation
   * — a re-verification that bumps one side and not the other is red.
   */
  const documented = (): { claude: string; codex: string } => {
    const line = repoFile('docs/03-adapter-contract.md').split('\n').find((text) => text.startsWith('Verification status'));
    if (line === undefined) throw new Error('docs/03-adapter-contract.md has no verification-status line — this check has lost its subject');
    const match = /Claude Code (\d+\.\d+\.\d+) and codex-cli (\d+\.\d+\.\d+)/.exec(line);
    if (!match) throw new Error(`docs/03-adapter-contract.md names no version per vendor: ${line}`);
    return { claude: match[1], codex: match[2] };
  };

  test('each module records the version that line names, and this ticket bumped neither', () => {
    expect(documented()).toStrictEqual({
      claude: CLAUDE_CAPABILITIES.verifiedVersion,
      codex: CODEX_CAPABILITIES.verifiedVersion,
    });
    // The values M0 measured, pinned as literals as well as compared, because the equality above
    // holds just as well over two numbers that moved together. Bumping either is a claim that
    // somebody re-ran the flag-by-flag verification, which this ticket deliberately did not do.
    expect(CLAUDE_CAPABILITIES.verifiedVersion).toBe('2.1.220');
    expect(CODEX_CAPABILITIES.verifiedVersion).toBe('0.149.0');
  });

  test('and the document says the line is a record rather than a supported range', () => {
    // The sentence a contributor meets before they are tempted to bump the numbers to whatever
    // their own machine runs, which is how a measurement becomes a guess.
    const contract = repoFile('docs/03-adapter-contract.md').replace(/\s+/g, ' ');
    expect(contract, 'the document does not cite the decision by title')
      .toContain('An adapter records the version it was verified against, and never a version it supports');
    expect(contract, 'it does not cite the decision\'s date').toContain('2026-09-08');
    expect(contract, 'it does not refuse being read as a supported range')
      .toMatch(/not a supported range|never a supported range/);
  });
});
