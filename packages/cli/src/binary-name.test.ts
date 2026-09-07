/**
 * Q-0100 AC-4 to AC-6 — no sentence the product can print calls the binary a harness.
 *
 * `.claude/rules/product-boundaries.md`: *"'Harness' is the concept and the folder (`harness/`);
 * 'Quorum' is the product. Never call the product a harness, never call the folder quorum."*
 * `commands.test.ts` has enforced that over one constant since Q-0090 — `HELP`, with folder
 * spellings stripped, contains no `harness` — and eight printed sentences disagreed with it anyway,
 * across six modules and six of the nine commands. This generalises that file's discrimination from
 * one constant to every user-facing string the CLI can print. It does not replace it: `HELP` is
 * still asserted there, including the Q-0093 clause proving the pre-widening spelling could not
 * admit `harness/`.
 *
 * **Two scan conditions, both measured rather than chosen.**
 *
 * 1. **String literals, never comments.** 48 lines across 17 production modules of this package
 *    cite `spike/bin/harness.js` as past-tense provenance, and {@link FOLDER} strips none of them —
 *    the slash *precedes* the word there rather than following it. A guard that read comments would
 *    fire 48 times on the intended tree and demand exactly the edits Q-0103 AC-19 forbids, so
 *    reading literals only is what keeps this guard's demands legal. That is why {@link literals}
 *    skips comments with a scanner rather than matching quotes with a regular expression: in JSDoc
 *    a markdown backtick pair is indistinguishable from a template literal, so a regex would read
 *    half this repository's prose as product output.
 * 2. **Literals containing whitespace.** A path segment has none, which admits
 *    `path.join(d, 'harness', 'harness.yaml')` and `new URL('../templates/harness/', …)` with **no
 *    exemption register** — a register being the thing that goes stale (Q-0073) — and excludes the
 *    `harnessDir` identifier, which is not a literal at all.
 *
 * **It fails closed, and that is the property rather than completeness.** The scanner lexes what it
 * claims to lex — comments, the three literal delimiters, template interpolations, escape
 * sequences — and on syntax it cannot classify it {@link refuse}s, naming the file and the offset.
 * It is not a TypeScript parser and does not become one: `requirements/errata.md` E-1 rules that a
 * scanner meeting a construct it cannot read and carrying on **silently skips its subject and
 * reports success**, which is the 2026-08-25 failure arriving inside the guard written to close it.
 * Being able to lex every construct is not the property that matters; making the unexamined case
 * loud is.
 *
 * **Two refusals, and the second is one predicate rather than a list.** {@link readSlash} refuses a
 * `/` it cannot classify, which is the construct the live tree exercises. Everything else is caught
 * at the end of the input by {@link literals}: a scan that ends in any state but the default one
 * ran out of file inside a construct, so whatever follows the point that construct opened was read
 * as its contents and inspected by nobody. E-2 rules that invariant and amends E-1's wording,
 * because enumerating constructs has no last member where {@link Open} has finitely many states —
 * there is no fifth case to find after the fourth. Every function that enters one pushes it and
 * pops it on the way out; what is still on the stack at the end is what was never left.
 *
 * Its subject is this package's production modules **plus one file in `core`**: `project.ts`, whose
 * `ProjectNotFoundError` is the only sentence in `packages/core` that a user reads and that carries
 * the word (Q-0100 OQ-2). Widening to all of `core` would add every engine literal for no measured
 * subject. If a second `core` sentence appears, {@link CORE_SUBJECTS} is where it is added.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

/** This package's `src`, reached package-relatively so this file names no repository root. */
const SRC = fileURLToPath(new URL('.', import.meta.url));

/** The workspace root, as `validate.test.ts` reaches it for the same reason. */
const WORKSPACE = fileURLToPath(new URL('../../..', import.meta.url));

/**
 * This file, excluded because it quotes every string the scan looks for, and **derived** rather than
 * typed so that renaming it cannot leave an exclusion excusing a file that is no longer here.
 *
 * It is the only exclusion, and that is asserted below rather than stated.
 */
const GUARD = path.relative(SRC, fileURLToPath(import.meta.url));

/**
 * The files outside this package whose printed sentences are in scope, repository-relative.
 *
 * One entry, and it is a register rather than a derivation because its membership is a *judgement*
 * — which `core` sentences a user reads — where {@link production}'s is a fact about the tree.
 * Every entry is required to exist below, so a moved file fails here instead of being skipped.
 */
const CORE_SUBJECTS = ['packages/core/src/backlog/project.ts'] as const;

/**
 * The folder `harness`, written as a path — the one spelling of the word a printed string may keep.
 *
 * A slash is what tells the folder from the product. Established and demonstrated in both directions
 * in `commands.test.ts`, whose header records it reading `harness\/\S+` until Q-0093 widened it: one
 * quantifier admits `harness/harness.yaml` and refuses the bare `harness/` that `quorum init` has to
 * print. Restated here rather than imported, because no test file in this workspace imports another,
 * and demonstrated here on its own subjects so the second copy is not taken on trust.
 */
const FOLDER = /harness\/\S*/g;

/**
 * The escapes whose printed value is not the character behind the backslash.
 *
 * Five of the seven print as whitespace — `\s` matches `\n`, `\t`, `\r`, `\v` and `\f` alike — which
 * is the one question {@link printable} asks. `\b` and `\0` are here because a table carrying five
 * of the seven single-character forms JavaScript defines would be this file's own defect two
 * characters narrower.
 */
const CONTROL_ESCAPES: Record<string, string | undefined> = {
  b: '\b',
  f: '\f',
  n: '\n',
  r: '\r',
  t: '\t',
  v: '\v',
  0: '\0',
};

/**
 * What an escape decodes to when its digits are not digits: a space, deliberately.
 *
 * Unreachable over the subject, because a file this workspace compiles cannot hold one — `'\xZZ'` is
 * a syntax error and `typecheck` reads every file this scan does. It exists so that the one
 * direction that can go wrong goes wrong safely: whitespace is what makes a literal a subject, so an
 * escape this scanner cannot read makes the guard look harder rather than stop looking.
 */
const UNREADABLE_ESCAPE = ' ';

/** Hexadecimal and nothing else — the digits of an `\xHH`, four-digit `\u` or `\u{…}` escape. */
const HEX = /^[0-9a-fA-F]+$/;

/** The three delimiters whose parity {@link readSlash} exists to protect. */
const QUOTE = /['"`]/;

/**
 * The interpreter line, which only ever opens a file and which Node and TypeScript both read as a
 * comment. `quorum.ts` is the one module in this package that carries one.
 *
 * Lexed rather than walked because it is the fifth construct that can hold a quote without that
 * quote being a delimiter, and the other four are already lexed — leaving it to be read as code
 * would be a gap kept open on the grounds that today's shebang happens not to contain one.
 */
const SHEBANG = /^#![^\n]*/;

/** The code unit `digits` names, or {@link UNREADABLE_ESCAPE} unless it is exactly `width` of them. */
const codeUnit = (digits: string, width: number): string => (
  digits.length === width && HEX.test(digits)
    ? String.fromCharCode(parseInt(digits, 16))
    : UNREADABLE_ESCAPE
);

/** The code point `digits` names, for the `\u{…}` form, or {@link UNREADABLE_ESCAPE}. */
const codePoint = (digits: string): string => {
  if (!HEX.test(digits)) return UNREADABLE_ESCAPE;
  const value = parseInt(digits, 16);
  return value <= 0x10ffff ? String.fromCodePoint(value) : UNREADABLE_ESCAPE;
};

/**
 * The printed value of the escape sequence whose backslash is `text[i]`, and how many characters of
 * `text` it spans, the backslash included.
 *
 * **Every form that can print whitespace**, because the three-entry table this replaced decoded
 * `\n`, `\t` and `\r` and reduced everything else to the character behind the backslash — so
 * `'harness\x20init'`, which prints `harness init`, was read as `harnessx20init`, refused by
 * {@link printable} for carrying no whitespace, and never reached the filters at all. A space has
 * four spellings here: itself, `\x20`, the four-digit `\u` form and `\u{20}`. `\v` and `\f` are two
 * more the old table missed.
 *
 * **Under-reading whitespace is the only direction that can hide a sentence.** Over-reading it can
 * only put a literal in front of the filters, which then refuse it or do not. Two consequences,
 * both deliberate: a malformed escape decodes to {@link UNREADABLE_ESCAPE} rather than to its own
 * characters, and the two exotic line terminators a continuation may cross fall through to the
 * identity branch below, where they decode to themselves — which `\s` matches, so they read as a
 * sentence rather than as nothing.
 */
const escapeAt = (text: string, i: number): [value: string, span: number] => {
  const ch = text[i + 1];
  if (ch === undefined) return ['', 1];
  // A line continuation prints nothing: `'a\<newline>b'` is `ab`, not `a`, a newline and `b`.
  if (ch === '\r') return ['', text[i + 2] === '\n' ? 3 : 2];
  if (ch === '\n') return ['', 2];
  const control = CONTROL_ESCAPES[ch];
  if (control !== undefined) return [control, 2];
  if (ch === 'x') return [codeUnit(text.slice(i + 2, i + 4), 2), 4];
  if (ch === 'u' && text[i + 2] === '{') {
    const close = text.indexOf('}', i + 3);
    return close < 0 ? [UNREADABLE_ESCAPE, 3] : [codePoint(text.slice(i + 3, close)), close - i + 1];
  }
  if (ch === 'u') return [codeUnit(text.slice(i + 2, i + 6), 4), 6];
  return [ch, 2];
};

/** A string literal, and the state a `'` or a `"` enters. */
const STRING = 'a string literal';
/** A template literal, and the state a backtick enters. */
const TEMPLATE = 'a template literal';
/** A `/*` comment, and the state it enters — round 4's finding, silently swallowed until E-2. */
const BLOCK_COMMENT = 'a block comment';
/**
 * The state a `/` in code position enters. *Possible*, because telling a regular-expression literal
 * from division needs the token before it and {@link readSlash} has no grammar; what it can decide
 * is whether reading it either way could change the quote parity below, which is the only question
 * this guard can be hurt by.
 */
const REGEX = 'a possible regular-expression literal';

/**
 * A construct the scan entered and has not left yet, and the offset of the character that opened it.
 *
 * **The set is finite, and that is why E-2's invariant terminates where E-1's did not.**
 * *"Unterminated X"* is not a list of constructs to be extended a round at a time; it is one
 * predicate over the state at end of input, and a lexer has as many states as it has.
 */
interface Open {
  readonly state: typeof STRING | typeof TEMPLATE | typeof BLOCK_COMMENT | typeof REGEX;
  readonly at: number;
}

/**
 * One scan of one file: the text, the name a refusal reports it by, the literals collected so far,
 * and the stack of constructs currently open.
 *
 * Threaded as one value rather than as four parameters because the stack has to reach every
 * function that can enter a state, and {@link scan} and {@link readLiteral} already call each other.
 */
interface Scan {
  readonly text: string;
  readonly where: string;
  readonly found: string[];
  readonly open: Open[];
}

/**
 * Stops the scan where the source holds syntax this scanner cannot classify, or where the input
 * ended inside a construct — the two refusals `requirements/errata.md` E-1 and E-2 rule, naming the
 * file and the offset the reader has to go to.
 *
 * A line number goes with the offset because an offset alone sends a reader counting characters.
 */
const refuse = (s: Scan, at: number, why: string): never => {
  const line = s.text.slice(0, at).split('\n').length;
  throw new Error(`${s.where}:${line} (offset ${at}): ${why} — see requirements/errata.md E-1, E-2`);
};

/**
 * Classifies the `/` at `text[at]` — which is neither `//` nor an opening `/*` — or refuses it.
 *
 * It is division, or it opens a regular-expression literal, and telling those apart needs the
 * token before it: grammar this scanner does not have and does not acquire. What it can decide is
 * the only question that matters here — **whether reading it the wrong way could change the quote
 * parity of everything below it.** A regex literal closes on its own line, so its whole body is
 * between this `/` and the next one before the newline:
 *
 * - **no `/` before the end of the line** — it cannot be a regex literal, so it is division, and
 *   there is nothing to misread. This is the whole of the live tree: `runs.ts:136` and
 *   `trace.ts:66`, both `… / 1000` inside a template interpolation, are the only two `/` characters
 *   in code position anywhere in the subject once {@link SHEBANG} has taken `quorum.ts:1`'s three.
 * - **a closing `/` whose body carries no quote** — read as a regex or as code, the same literals
 *   are collected either way, so the ambiguity is not one this guard can be hurt by.
 * - **a closing `/` whose body carries a quote** — **refused.** Read as code, that quote becomes a
 *   delimiter, every delimiter after it means its opposite, and a sentence below is collected by
 *   nobody while this file reports a clean tree. Review round 3's finding, and the third shape of
 *   the parity defect that clauses (4) and (6) close in the two other delimiters.
 *
 * The middle case is deliberately permissive and the last deliberately conservative: `a / b + 'x/y'`
 * is division and is refused, because this scanner cannot prove that it is. Refusing a legible line
 * costs a message naming it; admitting an illegible one costs a false green.
 *
 * There is a fourth case and it is not decided here: **the line has no ending**, the input running
 * out before either a terminator or a newline. The {@link REGEX} state is then never left, and
 * {@link literals} reports it with the other three at end of input rather than this function
 * refusing twice for one reason.
 */
const readSlash = (s: Scan, at: number): void => {
  s.open.push({ state: REGEX, at });
  for (let i = at + 1; i < s.text.length; i += 1) {
    const ch = s.text[i];
    if (ch === '\n') { s.open.pop(); return; }
    if (ch === '\\') { i += 1; continue; }
    if (ch !== '/') continue;
    if (!QUOTE.test(s.text.slice(at + 1, i))) { s.open.pop(); return; }
    refuse(s, at, 'this `/` opens a regular-expression literal whose body carries a quote,'
      + ' or divides an expression that does; either reading changes the quote parity below it and'
      + ' this scanner cannot tell them apart');
  }
};

/**
 * Reads the literal whose delimiter is `text[at]`, pushes its printed value onto `found`, and
 * returns the index of the closing delimiter.
 *
 * **A backslash consumes the whole sequence after it, and that is a correctness property rather
 * than a nicety.** Skipping the backslash alone leaves the character behind it to be read as code,
 * so an escaped quote closes the literal it was written inside — and the cost is not the split
 * value but the **parity**: every delimiter after an odd number of them means its opposite, so the
 * scan is outside a string exactly where the file is inside one, and a sentence below is collected
 * by nobody while this file reports a clean tree. AC-5(4) pins it with the measured naive output.
 *
 * **An interpolation is kept as source and read as code at the same time.** Its text stays in the
 * value, because `board.ts:117` is a sentence with a flow name in the middle of it and half of one
 * is not what the user reads; and {@link scan} walks it as well, because a delimiter inside it is
 * not this literal's. `adapters.ts:108` is why that is a measurement rather than a precaution — a
 * template inside a `c.dim(…)` inside a template, seven lines above one of the eight sentences this
 * ticket moves, whose inner text a scanner that stopped at the first backtick collects nowhere.
 *
 * **A literal that never closes leaves its state open rather than being swallowed.** Reaching the
 * end of the file means the delimiter this started from was not one, so the scanner had already
 * misread something and the rest of the module has become the value of a single string nobody
 * inspects. Nothing is collected from it and {@link literals} refuses at end of input, which is
 * where the same failure in a comment and in a `/` is reported too.
 */
const readLiteral = (s: Scan, at: number): number => {
  const quote = s.text[at];
  s.open.push({ state: quote === '`' ? TEMPLATE : STRING, at });
  let value = '';
  let i = at + 1;
  for (; i < s.text.length && s.text[i] !== quote; i += 1) {
    if (s.text[i] === '\\') {
      const [decoded, span] = escapeAt(s.text, i);
      value += decoded;
      i += span - 1;
      continue;
    }
    if (quote === '`' && s.text[i] === '$' && s.text[i + 1] === '{') {
      const close = scan(s, i + 2, true);
      value += s.text.slice(i, close + 1);
      i = close;
      continue;
    }
    value += s.text[i];
  }
  if (i >= s.text.length) return i;
  s.open.pop();
  s.found.push(value);
  return i;
};

/**
 * Reads `text` from `from`, pushing every string literal onto `found`, and returns where it stopped
 * — the end of the text, or the `}` closing the interpolation `inside` says it is in.
 *
 * A character scanner and not a regular expression, for the reason the header gives: the two are
 * distinguishable only by knowing whether you are inside a comment, and getting that wrong turns
 * every backticked word in a JSDoc block into product output. It is not a TypeScript parser and
 * does not claim to be — what it must get right is that a comment is not a literal (AC-5(3)), that
 * a literal decodes to what the user reads ({@link escapeAt}), and that no literal is skipped.
 *
 * **The last of those is what the refusals enforce, and it is why this is a finish line rather than
 * one more entry on a list.** A quote read the wrong way is the whole of how a sentence goes
 * uncollected, and five constructs can hold one without it being a delimiter: a comment, a string
 * literal, a template interpolation, a {@link SHEBANG}, and a regular-expression literal. Four are
 * lexed. The fifth is the one this scanner cannot lex, so {@link readSlash} either proves it
 * harmless or refuses the file. Everything else an identifier, a number or an operator can be is
 * skipped because it cannot hold a quote, not because it looks safe.
 *
 * A brace inside an interpolation is followed rather than counted, so the `}` of an object literal
 * closes what it opened and not the interpolation around it.
 */
const scan = (s: Scan, from: number, inside: boolean): number => {
  for (let i = from; i < s.text.length; i += 1) {
    const ch = s.text[i];
    if (ch === '/' && s.text[i + 1] === '/') {
      while (i < s.text.length && s.text[i] !== '\n') i += 1;
      continue;
    }
    if (ch === '/' && s.text[i + 1] === '*') {
      const close = s.text.indexOf('*/', i + 2);
      // No `*/` anywhere below: the comment state is entered and never left, and the rest of the
      // file is its contents. Left on the stack rather than returned quietly — round 4's finding.
      if (close < 0) {
        s.open.push({ state: BLOCK_COMMENT, at: i });
        return s.text.length;
      }
      i = close + 1;
      continue;
    }
    if (ch === '/') {
      readSlash(s, i);
      continue;
    }
    if (inside && ch === '}') return i;
    if (inside && ch === '{') {
      i = scan(s, i + 1, true);
      continue;
    }
    if (ch !== '\'' && ch !== '"' && ch !== '`') continue;
    i = readLiteral(s, i);
  }
  return s.text.length;
};

/**
 * Every string literal in `text`, with comments skipped and escape sequences decoded.
 *
 * **The end-of-input invariant lives here, checked once**, which is what E-2 rules and what makes
 * this a property rather than a growing list of constructs: a scan that ends in any state but the
 * default one never left that state, so everything after the character that opened it went unread.
 * The **outermost** open state is what the refusal names — the first construct that never closed is
 * the cause, and the states nested under it are consequences of it having been misread.
 *
 * @param where names the file in a refusal, and is the only reason this parameter exists.
 * @throws where `text` holds syntax the scanner cannot classify, or ends inside a construct.
 */
const literals = (text: string, where: string): string[] => {
  const s: Scan = { text, where, found: [], open: [] };
  scan(s, SHEBANG.exec(text)?.[0].length ?? 0, false);
  const unterminated = s.open[0];
  if (unterminated) {
    refuse(s, unterminated.at, `the file ended inside ${unterminated.state}, which opened here and`
      + ' was never left, so everything after this point was read as its contents and inspected by'
      + ' nobody');
  }
  return s.found;
};

/** Whether a literal is one a user could read: a sentence has whitespace, a path segment has not. */
const printable = (literal: string): boolean => /\s/.test(literal);

/** What is left of a literal once every folder spelling is removed. */
const outsideAPath = (literal: string): string => literal.replace(FOLDER, '').toLowerCase();

/**
 * Every `.ts` file below this package's `src` that is not a test, as `[relative path, text]`.
 *
 * **Derived from the tree, never written down** (AC-6). `frame.source.test.ts` computes its subject
 * the same way and its header records why: `q0050.source.test.ts` mapped over six hand-written
 * names while a seventh engine file went unscanned and the suite reported green (Q-0051). A command
 * module M3 adds is covered here without anyone remembering.
 */
const production = (): [string, string][] => fs
  .readdirSync(SRC, { withFileTypes: true, recursive: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
  .map((entry): [string, string] => {
    const full = path.join(entry.parentPath, entry.name);
    return [path.relative(SRC, full), fs.readFileSync(full, 'utf8')];
  })
  .filter(([name]) => !name.endsWith('.test.ts') && name !== GUARD);

/** The whole subject: this package's production modules, and the `core` files that print. */
const subjects = (): [string, string][] => [
  ...production(),
  ...CORE_SUBJECTS.map((relative): [string, string] =>
    [relative, fs.readFileSync(path.join(WORKSPACE, relative), 'utf8')]),
];

/** Every literal of `source` the guard would refuse: printable, and still naming the word. */
const offending = (source: string, where: string): string[] => literals(source, where)
  .filter(printable)
  .filter((literal) => outsideAPath(literal).includes('harness'));

describe('AC-4 — no printed string calls the product or the binary a harness', () => {
  test('every printable literal in the subject survives the folder filter with the word gone', () => {
    const found = subjects().flatMap(([name, text]) => offending(text, name)
      .map((literal) => `${name}: ${literal}`));
    expect(found, 'a printed sentence names a binary this package does not install')
      .toStrictEqual([]);
  });

  test('and the scan reaches its subject rather than collecting nothing', () => {
    // The clause that stops this being vacuous: a scanner that returned `[]` for every file would
    // satisfy the assertion above over any tree at all — *"a check that skips its subject must not
    // report success"* (2026-08-25), which is the failure this whole file exists to close and which
    // would be at its most embarrassing here. Anchored on the sentence the ticket is named for.
    const found = new Map(subjects());
    expect(literals(found.get('init.ts') ?? '', 'init.ts'))
      .toContain('  next: quorum adapters · quorum ticket new "…" · quorum run requirements T-0001');
    // Q-0111 split that sentence across two files, so the anchor is both halves — which makes this
    // a stronger subject check than the one it replaces: the scan is now shown to reach `core`'s
    // condition AND this package's remedy, and losing either would leave the clause above vacuous
    // over the half that went missing.
    expect(literals(found.get(CORE_SUBJECTS[0]) ?? '', CORE_SUBJECTS[0]))
      .toContain('no harness/harness.yaml found');
    expect(found.get('fail.ts') ?? '', 'the surface no longer composes the remedy this scan must see')
      .toContain('run \\`quorum init\\` in your repo');
  });

  test('the subject is every production module and the named core files, and one exclusion', () => {
    const names = production().map(([name]) => name);
    expect(names, 'the walk found no production module, so the scan above is vacuous').not.toStrictEqual([]);
    expect(names, 'a test file is being scanned as if it were product output')
      .toStrictEqual(names.filter((name) => !name.endsWith('.test.ts')));
    expect(names, 'this file excludes itself and it is the only exclusion').not.toContain(GUARD);
    const scanned = new Set(fs.readdirSync(SRC, { recursive: true }) as string[]);
    const missing = [...scanned]
      .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts') && name !== GUARD)
      .filter((name) => !names.includes(name));
    expect(missing, 'a production module went unscanned').toStrictEqual([]);
    for (const relative of CORE_SUBJECTS) {
      expect(fs.existsSync(path.join(WORKSPACE, relative)), `${relative} has moved`).toBe(true);
    }
  });
});

/**
 * The name a refusal reports for a fixture, chosen to look like a module so that the assertions
 * below read the message a real subject would produce.
 */
const FIXTURE = 'a-module.ts';

describe('AC-5 — the filter discriminates in the three directions it has to, and the scanner in the six beside them', () => {
  test('(1) it removes a folder spelling and leaves a bare mention', () => {
    // `commands.test.ts` proves this over `HELP`; proved again here because this is a second copy of
    // the regex and a copy taken on trust is how two guards drift into disagreeing.
    expect(outsideAPath('see harness/harness.yaml')).not.toContain('harness');
    expect(outsideAPath('created harness/ and backlog/')).not.toContain('harness');
    expect(outsideAPath('runs the harness')).toContain('harness');
    // And the pre-Q-0093 spelling, which could not admit the bare folder — the widening restated as
    // a measurement rather than inherited as a preference.
    expect('created harness/ and backlog/'.replace(/harness\/\S+/g, '')).toContain('harness');
  });

  test('(2) a whitespace-free literal is not a subject and a sentence is', () => {
    // Why the condition is whitespace rather than a list of module names: a path segment carries
    // none, so `path.join(d, 'harness', 'harness.yaml')` needs no exemption and no register.
    expect(printable('harness')).toBe(false);
    expect(printable('harness.yaml')).toBe(false);
    expect(printable('../templates/harness/')).toBe(false);
    expect(printable('run `harness init` in your repo')).toBe(true);
    expect(outsideAPath('run `harness init` in your repo')).toContain('harness');
  });

  test('(3) a comment carrying the sentence is not a subject, and a literal carrying it is', () => {
    // The clause that keeps this guard legal. Q-0103 AC-19 forbids rewriting past-tense provenance,
    // and 48 lines across 17 modules of this package carry `spike/bin/harness.js` — which FOLDER
    // does not strip, the slash preceding the word rather than following it. A comment-reading guard
    // would fire on every one of them and demand precisely the forbidden edit.
    expect(outsideAPath('see spike/bin/harness.js:124'), 'FOLDER strips a citation it must not')
      .toContain('harness');
    const provenance = '/** Why: preserved from `spike/bin/harness.js:342`, run `harness init`. */\nconst a = 1;\n';
    expect(literals(provenance, FIXTURE), 'a comment was read as product output').toStrictEqual([]);
    const printed = 'const a = \'run `harness init` in your repo\';\n';
    expect(literals(printed, FIXTURE)).toStrictEqual(['run `harness init` in your repo']);
    // Both halves over one file, which is the shape a production module actually has.
    expect(literals(provenance + printed, FIXTURE)).toStrictEqual(['run `harness init` in your repo']);
  });

  test('and a line comment does not hide the literal after it', () => {
    // The other comment form, and the one whose scan must stop at the newline rather than at the
    // next quote — a scanner that ran to end-of-file would swallow every literal below the first
    // `//` in a module and report a clean tree.
    expect(literals('// run `harness init`\nconst a = \'run `harness init` here\';\n', FIXTURE))
      .toStrictEqual(['run `harness init` here']);
  });

  test('(4) an escaped quote does not end the literal, and does not hide the one after it', () => {
    // A quote escaped inside its own delimiter, which is the evasion this clause closes. Consuming
    // the backslash alone leaves the quote behind it to be read as the terminator, and the damage
    // is not the split literal — it is the **parity**: every quote after an odd number of them
    // swaps its meaning, so the scan is outside a string where the file is inside one. An offending
    // sentence below is then read as code and collected by nobody, and the guard reports a clean
    // tree over a module that prints `harness`. The escape is consumed with the character it
    // escapes, so the parity never inverts.
    const escaped = 'const a = \'it\\\'s fine\';\nconst b = \'usage: harness run <flow>\';\n';
    expect(literals(escaped, FIXTURE)).toStrictEqual(['it\'s fine', 'usage: harness run <flow>']);
    // The half that makes it load-bearing rather than cosmetic. Against a scan that consumed only
    // the backslash this file yields `['it', ';\nconst b = ', ';\n']` — measured, and the failure
    // this test showed before the scanner was fixed — in which the usage line appears in no entry
    // at all and the filters below have nothing to refuse.
    expect(offending(escaped, FIXTURE)).toStrictEqual(['usage: harness run <flow>']);
  });

  test('(5) a template literal is collected whole, interpolations and escapes included', () => {
    // The interpolating shapes the subject actually has: `board.ts:117` is the hint with the flow
    // name in it, and `init.ts:63` wraps the next-steps constant in a template of its own. A scan
    // stopping at an interpolation reads half of each. The expression source is kept rather than
    // evaluated — over-reading can only make the guard fire, where under-reading is what lets a
    // sentence through.
    expect(literals('const a = `→ quorum run ${next.name} <id>`;\n', FIXTURE))
      .toStrictEqual(['→ quorum run ${next.name} <id>']);
    // `init.ts:63`'s shape: the interpolation is kept in the outer value *and* walked, so the
    // literal inside it is collected too. Both, in that order — a nested literal is finished before
    // the one containing it.
    expect(literals('const a = `${c.green(\'✓\')} harness/ created`;\n', FIXTURE))
      .toStrictEqual(['✓', '${c.green(\'✓\')} harness/ created']);
    // And an escaped backtick does not close the template, which is clause (4) in a third delimiter.
    expect(literals('const a = `run \\`harness init\\` in your repo`;\n', FIXTURE))
      .toStrictEqual(['run `harness init` in your repo']);
  });

  test('(6) a template inside an interpolation is read, not stepped over', () => {
    // `adapters.ts:108` is this shape on the live tree — `c.dim(`…`)` inside a template — seven
    // lines above one of the eight sentences this ticket moves. A scanner that let the inner
    // backtick close the outer literal collects the outer's first half, then reads the inner
    // sentence as **code**, then reopens at the inner closing backtick: the sentence is in no
    // entry, the filters never see it, and the guard is green over a module that prints it. Third
    // shape of the same defect as clauses (4) and (7), and the only one measured in the subject.
    const nested = 'log(`  ${c.dim(`usage: harness run <flow>`)}`);\n';
    expect(literals(nested, FIXTURE)).toContain('usage: harness run <flow>');
    expect(offending(nested, FIXTURE)).toContain('usage: harness run <flow>');
    // A brace inside the interpolation closes what it opened, so the interpolation ends where it
    // ends and the literal after it is still this literal's.
    expect(literals('const a = `${f({ x: 1 })} harness init`;\n', FIXTURE))
      .toStrictEqual(['${f({ x: 1 })} harness init']);
  });

  test('(7) an escape decodes to what the user reads, in every form that can print whitespace', () => {
    // The hole this clause closes, stated as the measurement that found it rather than as a rule.
    // The scanner decoded `\n`, `\t` and `\r` and reduced every other escape to the character behind
    // the backslash, so a sentence spelled `harness\x20init` — which the process prints as
    // `harness init` — decoded to `harnessx20init`. That carries no whitespace, so `printable`
    // refused it, so it reached none of the filters and the guard stayed green over a module naming
    // a binary this package does not install.
    expect(printable('harnessx20init'), 'the naive decode is what made the evasion invisible')
      .toBe(false);

    // The four spellings of one space, each shown through the whole pipeline rather than at the
    // decoder — the claim is not that `\x20` decodes correctly but that a sentence spelled with it
    // is refused. `\u{20}` is in a template because that is the shape it occurs in.
    expect(offending('const a = \'usage: harness run\';\n', FIXTURE)).toHaveLength(1);
    expect(offending('const a = \'usage: harness\\x20run\';\n', FIXTURE)).toHaveLength(1);
    expect(offending('const a = \'usage: harness\\u0020run\';\n', FIXTURE)).toHaveLength(1);
    expect(offending('const a = `usage: harness\\u{20}run`;\n', FIXTURE)).toHaveLength(1);
    // And the two control escapes the old table missed, which `\s` matches like the three it had.
    expect(offending('const a = \'usage: harness\\vrun\';\n', FIXTURE)).toHaveLength(1);
    expect(offending('const a = \'usage: harness\\frun\';\n', FIXTURE)).toHaveLength(1);
    expect(offending('const a = \'usage: harness\\nrun\';\n', FIXTURE)).toHaveLength(1);

    // The other direction, which is what keeps the guard from firing on the tree it has to pass:
    // an escape that prints no whitespace leaves a path-like fragment, not a sentence. `colour.ts`
    // is the live subject — `\x1b[…m` around an interpolation, and no space in any of it.
    expect(literals('const a = \'\\x1b[0m\';\n', FIXTURE)).toStrictEqual(['\x1b[0m']);
    expect(printable('\x1b[0m')).toBe(false);
    expect(offending('const a = \'harness\\x1binit\';\n', FIXTURE)).toStrictEqual([]);
    // A line continuation prints nothing at all, so it joins the two halves rather than spacing
    // them: what the user reads is `harnessinit`, which is not a sentence and is not claimed to be.
    expect(literals('const a = \'harness\\\ninit\';\n', FIXTURE)).toStrictEqual(['harnessinit']);
    // And a malformed escape decodes to a space, so the one direction that can go wrong makes the
    // guard look harder. Unreachable over the subject — `typecheck` reads every file this scan
    // does, and this is a syntax error — so it is pinned here or nowhere.
    expect(offending('const a = \'harness\\xZZinit\';\n', FIXTURE)).toStrictEqual(['harness init']);
  });

  test('(8) syntax the scanner cannot classify is refused, naming the file and the offset', () => {
    // The clause `requirements/errata.md` E-1 rules, and the reason it is a clause rather than a
    // fourth lexing rule: three rounds each closed one construct — an escaped quote, an escape that
    // decodes to whitespace, a regex literal — and the list under them has no end. What ends it is
    // that an unclassifiable construct is loud. Demonstrated, per *"A check is not established by
    // reading it"* (2026-08-29), against the construct this scanner does **not** claim to handle.

    // Review round 3's fixture: a regex whose body carries a quote, above a sentence naming the old
    // binary. Read as code, the `'` opens a literal that swallows to the next quote, so the usage
    // line lands in no entry at all — measured, the naive scan yields `['"]/g;\nconst usage = ',
    // ';\n']` — and the guard reports a clean tree over a module that prints it. Refused instead.
    const hidden = 'const RE = /[\'"]/g;\nconst usage = \'usage: harness run <flow>\';\n';
    expect(() => literals(hidden, FIXTURE), 'a regex the scanner cannot lex was stepped over')
      .toThrow(/a-module\.ts:1 \(offset 11\)/);
    expect(() => literals(hidden, FIXTURE)).toThrow(/regular-expression literal/);
    expect(() => offending(hidden, FIXTURE), 'the refusal does not reach the guard\'s own path')
      .toThrow();

    // And the same shape one character apart, to show the refusal has a subject rather than a
    // signature: with a quote-free body the `/` is classified, the scan continues, and the sentence
    // below it is collected. So what is refused above is a sentence this guard would otherwise see.
    const lexable = 'const RE = /[a-z]/g;\nconst usage = \'usage: harness run <flow>\';\n';
    expect(offending(lexable, FIXTURE)).toStrictEqual(['usage: harness run <flow>']);

    // Division is not refused, which is what keeps the guard runnable rather than merely safe.
    // Measured over the whole subject, exactly two `/` characters reach code position —
    // `runs.ts:136` and `trace.ts:66`, both dividing inside a template interpolation — and neither
    // has a closing `/` before its newline, so neither can be a regex literal and there is nothing
    // to misread. A guard that refused these would be unrunnable rather than strict.
    expect(literals('const a = `d=${(m.duration_ms / 1000).toFixed(1)}s`;\n', FIXTURE))
      .toStrictEqual(['d=${(m.duration_ms / 1000).toFixed(1)}s']);

    // And `quorum.ts:1`'s three are not classified at all, because the interpreter line is lexed:
    // it is the fifth construct that can hold a quote which is not a delimiter, and a shebang read
    // as code would open a literal on one. Node and TypeScript both treat it as a comment.
    expect(literals('#!/usr/bin/env node\nconst a = \'harness init here\';\n', FIXTURE))
      .toStrictEqual(['harness init here']);
    expect(literals('#!/bin/sh -c \'x\'\nconst a = \'usage: harness run\';\n', FIXTURE))
      .toStrictEqual(['usage: harness run']);
  });

  test('(9) the input ending in any lexer state is refused, and the state is named', () => {
    // `requirements/errata.md` E-2, which amends E-1 rather than adding to it. E-1 said the scanner
    // refuses *"syntax it cannot lex"*, and round 4 read that as constructs — reasonably, since the
    // three rounds before it had each been one — closed the constructs, and left the *unterminated*
    // case ending the scan quietly. That is the same silent skip one level up: nothing is
    // unclassifiable about a `/*`, the file merely stops before its `*/`.
    //
    // The reformulation is what ends the list. `Open` has four states and "unterminated" is one
    // predicate over the state at end of input, not a construct to be enumerated: whatever state
    // the scan ends in, if it is not the default one the input was not lexable and the scan is
    // refused. There is no fifth case to find after the fourth. One check, four fixtures.

    expect(() => literals('const a = \'harness init;\n', FIXTURE), 'a string ran to the end')
      .toThrow(/a-module\.ts:1 \(offset 10\): the file ended inside a string literal.*never left/s);
    expect(() => literals('const a = `harness init;\n', FIXTURE), 'a template ran to the end')
      .toThrow(/a-module\.ts:1 \(offset 10\): the file ended inside a template literal.*never left/s);
    expect(() => literals('/*\nconst usage = \'usage: harness run\';\n', FIXTURE), 'round 4\'s finding')
      .toThrow(/a-module\.ts:1 \(offset 0\): the file ended inside a block comment.*never left/s);
    expect(() => literals('const RE = /[\'"]', FIXTURE), 'a line with no ending after a `/`')
      .toThrow(/a-module\.ts:1 \(offset 11\): the file ended inside a possible regular-expression/);

    // Where states are nested, the **outermost** one is named: a template whose interpolation holds
    // an unterminated string leaves both open, and the template at offset 10 is the construct that
    // never closed — the string at 14 is a consequence of the file already having been misread.
    // Reporting the innermost instead names offset 14 here and, in the regex fixture above, names
    // the string the misread `/` let open at offset 13 rather than the `/` itself.
    expect(() => literals('const a = `x${\'y`;\n', FIXTURE), 'the outermost state, not the innermost')
      .toThrow(/a-module\.ts:1 \(offset 10\): the file ended inside a template literal/);

    // What each refusal replaces, shown rather than described: the block-comment fixture above
    // carries a sentence this guard refuses, so the quiet version of it reported a clean tree over
    // a module printing the old binary name. Its twin closes the comment one line up.
    expect(offending('/* a comment */\nconst usage = \'usage: harness run\';\n', FIXTURE))
      .toStrictEqual(['usage: harness run']);
    // And the `/` one newline apart: with the line ended the state is left, nothing is open at the
    // end of the input, and the sentence beside it is collected. So the refusal has a subject
    // rather than a signature, and division on a line that ends is not refused.
    expect(offending('const usage = \'usage: harness run\';\nconst x = a / b;\n', FIXTURE))
      .toStrictEqual(['usage: harness run']);

    // The refusal reaches the guard's own path and is not swallowed on the way.
    expect(() => offending('/*\nconst usage = \'usage: harness run\';\n', FIXTURE)).toThrow();
  });
});
