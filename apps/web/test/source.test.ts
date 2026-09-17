/**
 * Q-0014 AC-5, AC-9, AC-10 — what this app's source may reach for, may name, and may colour.
 *
 * Three scans over one corpus, each in the shape `packages/shared/src/index.test.ts` already uses
 * for the same question one package down.
 *
 * THIS FILE LIVES OUTSIDE `src/`, AND THAT IS THE POINT OF IT. AC-5's subject is *every file under
 * `apps/web/src`*, and a scan that reads the filesystem cannot be one of them. The first draft
 * squared that circle by narrowing its own corpus to "shipping files" so it could sit beside its
 * subject — which is weaker than the criterion, and left four Node-importing files inside the tree
 * that becomes a browser bundle. `packages/shared/test/corpus.ts` had already settled the shape for
 * the same question: *"it lives OUTSIDE `src/` deliberately … the one module here that touches the
 * filesystem sits beside it rather than in it"*. This is that arrangement in the package whose
 * `src/` is literally what a browser gets.
 *
 * WHICH SCANS COVER THIS FILE, now that it is not under `src`: the network scan at the bottom walks
 * the whole package and does, so its needles MUST stay assembled. The three `src` scans do not.
 * Every needle here is assembled anyway — one rule rather than four judgements, and so that moving
 * a corpus can never quietly turn a needle into its own subject again.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

/** This file's own directory: `apps/web/test/`. */
const HERE = path.dirname(fileURLToPath(import.meta.url));

/** The package root, and below it the browser source tree these scans are about. */
const PACKAGE = path.resolve(HERE, '..');
const SOURCE = path.join(PACKAGE, 'src');

/** Directories that are not this package's source, whatever they contain. */
const NOT_OURS = new Set(['node_modules', 'dist', '.turbo', '.vite']);

/** Every file below `absolute`, as `[relative path, text]`. */
function filesBelow(absolute: string): [string, string][] {
  const walk = (at: string, below: string): [string, string][] =>
    fs.readdirSync(at, { withFileTypes: true }).flatMap((entry) => {
      if (NOT_OURS.has(entry.name)) return [];
      const next = below === '' ? entry.name : `${below}/${entry.name}`;
      if (entry.isDirectory()) return walk(path.join(at, entry.name), next);
      return [[next, fs.readFileSync(path.join(at, entry.name), 'utf8')] as [string, string]];
    });
  return walk(absolute, '').sort(([a], [b]) => a.localeCompare(b));
}

/**
 * Every file under `src` — every one, which is the corpus all three criteria name.
 *
 * Not "every file that ships", and not "every TypeScript file": AC-5 says *no file under
 * `apps/web/src`*, and a filtered corpus is a scan answering a narrower question than the one it
 * reports on.
 */
const sourceFiles = (): [string, string][] => filesBelow(SOURCE);

const forbiddenPersistence = ['localStorage', 'sessionStorage', 'indexedDB', `document.${'cookie'}`, 'caches'];

// **`role=` is the only field that needed narrowing, so it is the only one narrowed.** The measured
// collision is `backlog-board.test.ts`'s `[role="progressbar"]`, an accessibility selector that must
// stay; `cost=` and `verdict=` occur nowhere in this corpus in any form, so requiring a delimiter
// before them bought nothing and stopped forbidding the bare literal a concatenating parser writes.
// Six needles rather than twelve. Review round 2, major 4 — which corrects `solution/errata.md` SE-1,
// where this operator applied the architect's delimiter form to all three without asking which of
// them the measurement covered.
const MESSAGE_PARSE_NEEDLES = [
  ...['cost', 'verdict'].map((field) => `${field}${'='}`),
  ...["'", '"', '`', '/'].map((prefix) => `${prefix}role${'='}`),
];

describe('Q-0015 AC-6 — browser source never parses values out of human event prose', () => {
  const offenders = (files: [string, string][]): string[] => files.flatMap(([name, text]) =>
    MESSAGE_PARSE_NEEDLES.filter((needle) => text.includes(needle)).map((needle) => `${name}:${needle}`));

  test('the complete source corpus contains none of the six parsing forms', () => {
    expect(MESSAGE_PARSE_NEEDLES).toHaveLength(6);
    expect(offenders(sourceFiles())).toStrictEqual([]);
  });

  test('the scan rejects a template parse but accepts the shipped accessibility selector', () => {
    const parsing = ['`', 'cost', '=', '$0.123', '`'].join('');
    expect(offenders([['bad.ts', parsing]])).toHaveLength(1);
    // …and the bare form a concatenating parser writes, which the twelve-needle set had stopped
    // rejecting for two of its three fields.
    expect(offenders([['bare.ts', ['cost', '='].join('')]])).toHaveLength(1);
    expect(offenders([['bare2.ts', ['verdict', '='].join('')]])).toHaveLength(1);
    const selector = ['[', 'role', '=', '"progressbar"]'].join('');
    expect(offenders([['ok.ts', selector]])).toStrictEqual([]);
  });

  /**
   * The run number's own parsing form, which Q-0131 added and which the six above cannot see.
   *
   * **`run #` is the fourth refusal of one shape, and it is the sharpest because the value really
   * is there.** Every run's first event is an `info` whose message reads
   * `run #<n>  flow=…  ticket=…`, so a browser that wanted a live run's number before Q-0131 had a
   * regex away from getting one — and the number is now on `WireRun.runId` precisely so nobody
   * writes that regex. It is refused by Q-0015's ground rule 2, by decision 097's measurement that
   * 4 of this repository's 1,080 findings contain the join separator in their own text, and by the
   * daemon's own host, whose `observe` names taking a run number out of a `gateId` as the second
   * authority `minted` exists to prevent.
   *
   * **The literal is banned outright, over the complete corpus, and there is no register of
   * exceptions.** The first draft exempted the two files that carried it — three sites, each a
   * fixture of the daemon's own `lock-held` REFUSAL CONDITION, which is a different field from an
   * event message and is prose this app renders verbatim — and that was weaker than AC-6, which
   * names *anywhere under `apps/web/src`*. An exemption forgives a FILE rather than a USE, so a
   * parse written inside one of those two would have been left to {@link extractsFromMessage}
   * alone, which is one incomplete pattern standing in for a prohibition. The three fixture sites
   * are assembled instead — `` `held by run${' '}#7` `` — which is this file's own rule applied one
   * directory over: a needle is assembled so it is not its own subject, and a corpus under a
   * prohibition is written so it is not one either. Review round 1, major 1.
   */
  const RUN_NUMBER_LITERAL = ['run', ' ', '#'].join('');

  /** The two files whose fixtures were assembled, so the emptiness below is about files really scanned. */
  const ASSEMBLED_FIXTURES = ['daemon-client.test.ts', 'ticket-page.test.ts'];

  /**
   * Any expression taking a value out of an event's `message`, which no file may do.
   *
   * **Every gap is `[ \t]` and never `\s`, and that is a correction rather than a style.** `\s`
   * matches a newline, so the first draft's third needle read a comment ending in a full stop,
   * crossed the blank line after it, and matched vitest's own `test('… a non-string message never
   * reaches JSON', …)` — reporting `frame-parser.test.ts`, which parses no message and never did.
   * A guard that reports a file doing nothing of the kind is one a reader learns to override.
   */
  const extractsFromMessage = (text: string): boolean =>
    /\bmessage[ \t]*\.[ \t]*(?:match|split|slice|substring|substr|replace|replaceAll|indexOf|lastIndexOf|search|charAt|exec)[ \t]*\(/.test(text)
    || /\b(?:Number|parseInt|parseFloat)[ \t]*\([^)\n]*\bmessage\b/.test(text)
    || /\.[ \t]*(?:exec|test)[ \t]*\([^)\n]*\bmessage\b/.test(text);

  test('Q-0131 AC-6 — no file under src names or parses the run number the narration carries', () => {
    const carriers = (files: [string, string][]): string[] =>
      files.filter(([, text]) => text.includes(RUN_NUMBER_LITERAL)).map(([name]) => name);
    expect(carriers(sourceFiles()), 'a file under src names the run-number literal').toStrictEqual([]);
    // …and the half the literal cannot carry, which is why both clauses are here: a parse written
    // without the literal in front of it — out of a `gateId`, or off an assembled needle of its own
    // — fails here rather than passing the clause above.
    expect(sourceFiles().filter(([, text]) => extractsFromMessage(text)).map(([name]) => name),
      'a file under src takes a value out of an event message').toStrictEqual([]);

    // **The emptiness above is an absence and not a corpus that was not looked at.** The two files
    // whose fixtures the first draft exempted are still scanned, and each still carries the refusal
    // condition as prose — so the remedy was assembling those three sites and not deleting them,
    // which a prohibition over a corpus can otherwise be satisfied by.
    const scanned = sourceFiles();
    for (const name of ASSEMBLED_FIXTURES) {
      const found = scanned.find(([each]) => each === name);
      expect(found, `${name} is not in the corpus — this clause has lost a site it was written for`).toBeDefined();
      expect(found?.[1], `${name} no longer carries the refusal condition its fixture was about`)
        .toContain(['held', 'by', 'run'].join(' '));
    }

    // Every needle discriminates, over fixtures assembled so this file is not its own subject.
    expect(carriers([['bad.ts', `const at = text${'.'}indexOf('${RUN_NUMBER_LITERAL}');`]]),
      'the literal needle matches nothing at all').toStrictEqual(['bad.ts']);
    expect(carriers([['ok.ts', `const label = 'run-9'; // see issue${' '}#7`]]),
      'a file naming the word and the hash apart was reported as naming the literal').toStrictEqual([]);
    const parse = `const n = Number(event${'.'}message${'.'}split('${RUN_NUMBER_LITERAL}')[1]);`;
    expect(extractsFromMessage(parse), 'the extraction needle misses the parse it is written against').toBe(true);
    expect(extractsFromMessage(`const at = /${RUN_NUMBER_LITERAL}(\\d+)/${'.'}exec(event${'.'}message);`),
      'a regex executed against a message is not reported').toBe(true);
    // …and the benign forms this app really does write are not reported: the trace renders a
    // message verbatim, and a refusal condition is a string it displays.
    expect(extractsFromMessage(`case 'info': return event${'.'}message;`), 'rendering a message was reported as parsing one').toBe(false);
    expect(extractsFromMessage(`expect(said.refusal.condition).toBe('held by ${RUN_NUMBER_LITERAL}7');`),
      'a refusal-condition fixture was reported as parsing a message').toBe(false);
  });
});

// Every top-level object body of a declaration, union members INCLUDED.
  //
  // The first version of this matched a head ending in `{` and stopped at the first balanced body,
  // which could not see the one shape AC-12 exists to forbid. A union alias written over several
  // lines has `|` between `=` and `{`, so the head never matched at all and the scan returned
  // nothing; written on one line the head matched and the walk stopped after the FIRST member, so a
  // `missed` member two positions along was never read. A copied `WireMessage` union passed
  // silently either way — the guard blind to its own subject, inside the guard drafted to close
  // exactly that class. Q-0120 review round 1, M-4.
  //
  // So the unit is the STATEMENT: from the head to the `;` that closes it at depth zero, collecting
  // each `{ … }` encountered at depth zero along the way. An `interface` has exactly one such body;
  // a union alias has one per member.
function declarationBodies(text: string): string[] {
  const bodies: string[] = [];
  const heads = /\b(?:interface|type)\s+[A-Za-z_$][\w$]*(?:\s*<[^>{}]*>)?\s*(?:=|\{)/g;
  for (const head of text.matchAll(heads)) {
    // An `interface` ends at its own closing brace; a `type` alias ends at the `;`. The first
    // version stopped only at a `;`, so after collecting an interface's body it kept scanning and
    // swallowed the next `{ … }` it met — over-reporting only, so no re-declaration escaped, but it
    // made the acceptance fixture narrower than it reads: the clause proving a VALUE literal is not
    // a declaration held only because the fixture used a `type` alias, and `interface` is the
    // likelier spelling here, where AppProps, ShellProps, SocketTransport and RunConnection all are.
    // Q-0120 review round 2, N-4.
    const isInterface = head[0].startsWith('interface');
    let at = (head.index ?? 0) + head[0].length - 1;
    if (text[at] === '{') at -= 1;
    for (; at < text.length; at += 1) {
      if (text[at] === ';') break;
      if (text[at] !== '{') continue;
      let depth = 0;
      const open = at;
      for (; at < text.length; at += 1) {
        if (text[at] === '{') depth += 1;
        if (text[at] === '}') depth -= 1;
        if (depth === 0) break;
      }
      bodies.push(text.slice(open + 1, at));
      if (isInterface) break;
    }
  }
return bodies;
}

function duplicateMissedDeclarations(files: [string, string][]): string[] {
  return files.filter(([, text]) => declarationBodies(text).some((body) =>
    /\btype\s*:\s*['"]missed['"]/.test(body) && /\bcount\s*[?:]/.test(body)
  )).map(([name]) => name);
}

describe('Q-0120 AC-12/19/20 — live connection source guards', () => {
  test('the web imports shared but never redeclares the missed envelope', () => {
    expect(sourceFiles().some(([, text]) => importSpecifiers(text).includes(`@${'quorum'}/shared`))).toBe(true);
    expect(duplicateMissedDeclarations(sourceFiles())).toStrictEqual([]);
    expect(duplicateMissedDeclarations([['fixture.ts', "interface Bogus { type: 'missed'; count: number }"]])).toStrictEqual(['fixture.ts']);
    expect(duplicateMissedDeclarations([['fixture.ts', "type Bogus = { type: 'missed'; nested: { value: string }; count?: number }"]])).toStrictEqual(['fixture.ts']);
    expect(duplicateMissedDeclarations([['separate.ts', "type Reference = { value: string };\nconst frame = { type: 'missed', count: 7 };"]])).toStrictEqual([]);
    // The same clause in the likelier spelling: an interface has no terminating `;`, so a walk that
    // stopped only at one swallowed the value literal below it and reported the file. N-4.
    expect(duplicateMissedDeclarations([['iface.ts', "interface Reference { value: string }\nconst frame = { type: 'missed', count: 7 };"]])).toStrictEqual([]);
    // THE fixture the frozen contract names: the complete union, re-declared. Both spellings,
    // because the walk this replaced failed them for two different reasons — the multi-line form
    // never matched a head, and the single-line form matched and then stopped at the first member.
    const unionMultiline = [
      'type Copied =',
      "  | { readonly type: 'event'; readonly event: unknown }",
      "  | { readonly type: 'missed'; readonly count: number };",
    ].join('\n');
    expect(duplicateMissedDeclarations([['copied.ts', unionMultiline]])).toStrictEqual(['copied.ts']);
    expect(duplicateMissedDeclarations([['oneline.ts', "type Copied = { type: 'event'; event: unknown } | { type: 'missed'; count: number };"]])).toStrictEqual(['oneline.ts']);
    // And the accepting half is not vacuous: the three legitimate unions are unions too, so under
    // the old walk they were never scanned at all and "accepted" meant "not looked at". Each is
    // asserted to be SEEN — its own members are collected — and then to be accepted.
    const parsedFrame = "type ParsedFrame =\n  | { readonly type: 'event'; readonly event: Event }\n  | Extract<WireMessage, { type: 'missed' }>;";
    expect(declarationBodies(parsedFrame).length, 'the reference union was not scanned at all').toBeGreaterThanOrEqual(2);
    expect(duplicateMissedDeclarations([['parsed.ts', parsedFrame]])).toStrictEqual([]);
  });

  test('no test renders a run route without supplying a socket factory', () => {
    // The one place the un-injected `defaultSocketFactory` could run, and it did: a run route
    // rendered without a factory constructs a real WebSocket against jsdom's default origin, so the
    // suite made an outbound connection and its verdict depended on whether anything was listening
    // on that port. Fixed by passing the fake; pinned here so the next edit cannot undo it quietly.
    // Q-0120 review round 1, M-5.
    const renders = (text: string): string[] => {
      const found: string[] = [];
      for (const at of [...text.matchAll(/createElement\(App,\s*\{/g)]) {
        let depth = 0;
        const open = (at.index ?? 0) + at[0].length - 1;
        let end = open;
        for (; end < text.length; end += 1) {
          if (text[end] === '{') depth += 1;
          if (text[end] === '}') depth -= 1;
          if (depth === 0) break;
        }
        found.push(text.slice(open, end + 1));
      }
      return found;
    };
    // **Fails closed on a path it cannot read.** The filter used to require a literal
    // `initialPath: '/runs/…'`, so a render whose path arrives through a helper variable was not
    // examined at all — which is what this package's newest run-route renders do. A render the scan
    // cannot prove is NOT a run route must supply a factory, because the cost of being wrong is the
    // outbound socket this guard exists to prevent. Review round 1, N5.
    //
    // **Named, so the demonstration below runs THE predicate rather than a copy.** It inlined the
    // pre-fix expression, which left the fails-closed branch covered by nothing: replacing it with
    // `return false` restored the hole and this file stayed green. Review round 2, major 1.
    const literalPath = /initialPath:\s*(['"`][^'"`]*['"`])/;
    const unfactoried = (props: string, text: string): boolean => {
      if (props.includes('socketFactory')) return false;
      const literal = literalPath.exec(props)?.[1];
      // A readable path is judged on its own render. An UNREADABLE one — a variable, which is how
      // this package's newest run-route renders arrive — falls back to the file: it must supply a
      // factory somewhere, because the helper that passes one is in the file and not in the props.
      // Weaker than the per-render rule and stated as such.
      return literal === undefined ? !text.includes('socketFactory') : literal.includes('/runs/');
    };
    const offenders = sourceFiles().flatMap(([name, text]) => renders(text)
      .filter((props) => unfactoried(props, text))
      .map((props) => `${name}: ${literalPath.exec(props)?.[1] ?? 'path not a literal'}`));
    expect(offenders, 'a run route is rendered with no socket factory').toStrictEqual([]);
    // It examined something, and it discriminates: a run route without a factory is reported, a
    // non-run route without one is not.
    expect(renders(`createElement(App, { initialPath: '/runs/x' })`).length, 'the scan found no render at all').toBe(1);
    const report = (text: string): string[] => renders(text).filter((props) => unfactoried(props, text));
    // Three fixtures through the SAME predicate, one per branch it has, so replacing any of them
    // with a constant turns this red rather than leaving it green. Review round 2, major 1.
    expect(report(`createElement(App, { initialPath: '/runs/x' });`), 'a literal run route with no factory is not reported').toHaveLength(1);
    expect(report(`createElement(App, { initialPath: '/projects' });`), 'a literal non-run route was reported').toHaveLength(0);
    expect(report(`createElement(App, { initialPath: at });`), 'an unreadable path in a file with no factory is not reported').toHaveLength(1);
    expect(report(`const f = socketFactory;\ncreateElement(App, { initialPath: at });`), 'an unreadable path was reported although the file supplies a factory').toHaveLength(0);
  });

  test('no browser persistence API occurs and the guard detects a fixture', () => {
    for (const [name, text] of sourceFiles()) for (const needle of forbiddenPersistence) expect(text.includes(needle), name).toBe(false);
    expect(forbiddenPersistence.filter((needle) => `localStorage.setItem('run', handle)`.includes(needle))).toStrictEqual(['localStorage']);
    expect(forbiddenPersistence).not.toContain('pushState');
  });

  test('the retired pending sentence is absent', () => {
    const retired = ['no live connection yet', 'Q-0120 opens one'].join(' — ');
    expect(sourceFiles().filter(([, text]) => text.includes(retired)).map(([name]) => name)).toStrictEqual([]);
  });
});

describe('Q-0017 AC-5/AC-10/AC-11/AC-13 — what the board may not reach for, name or issue', () => {
  /**
   * What this app may not write, and the one module each survivor is permitted in.
   *
   * **Re-aimed at Q-0016 rather than deleted, and the exemptions are per NEEDLE.** Until that
   * ticket this app made no request that was not a GET, so the guard forbade four methods and two
   * route literals everywhere and needed no exceptions. A gate screen has to answer a gate, which
   * is one `POST` to one route — so the boundary narrows by exactly two names rather than being
   * dropped, which is what would happen if the whole clause went: the board and the ticket page
   * would silently stop being read-only with it.
   *
   * **Q-0130 moved it by exactly ONE ROW**, and the arithmetic is worth writing down because it is
   * what the second clause below exists for. A start needs no new path literal at all — it POSTs to
   * `DAEMON_ENDPOINTS.runs`, which `daemon-endpoints.ts` already declares and `fetchRuns` already
   * READS — and the method was already permitted in the same module, so `'/stop'`'s `permitted` is
   * the whole of the change and the permitted MODULE set is unmoved at two. What that costs is
   * stated rather than smoothed over: after this ticket these six needles can no longer tell *this
   * app starts runs* from *this app lists runs*, so on their own they read as a boundary and are
   * not one — Q-0073's *a count is not an identity* arriving on an exemption register. The identity
   * clause below is the subject they lost.
   *
   * `PUT`, `PATCH` and `DELETE` stay permitted nowhere, the daemon routing none of them.
   * `daemon-client.ts` is where every request is made and `daemon-endpoints.ts` is where every path
   * is built, which is why those two and not the screen: a component that assembled either would be
   * the second place a request is composed.
   */
  const WRITE_RULES: { readonly needle: string; readonly what: string; readonly permitted: string | null }[] = [
    { needle: `method:${' '}'POST'`, what: 'issues a POST', permitted: 'daemon-client.ts' },
    { needle: `method:${' '}'PUT'`, what: 'issues a PUT', permitted: null },
    { needle: `method:${' '}'PATCH'`, what: 'issues a PATCH', permitted: null },
    { needle: `method:${' '}'DELETE'`, what: 'issues a DELETE', permitted: null },
    { needle: `'${'/gate'}'`, what: "names the daemon's gate route", permitted: 'daemon-endpoints.ts' },
    { needle: `'${'/stop'}'`, what: 'names the stop route', permitted: 'daemon-endpoints.ts' },
  ];

  /** The one method this app can send, spelled so this file is not its own subject. */
  const WRITE_METHOD = `method:${' '}'POST'`;

  /** A module's top-level declarations, each carrying the text that belongs to it. */
  interface Declaration {
    /** The declared name, or what stands in for one where there is no head to read. */
    readonly name: string;
    /** Whether the head introduces a VALUE — a `const`, `let`, `var`, `function` or `class`. */
    readonly binds: boolean;
    /** Everything from this head to the next one, so no byte of the module belongs to nothing. */
    readonly text: string;
  }

  /** The heads that open a top-level declaration, and the four of them that bind a value. */
  const DECLARATION_HEAD =
    /^(?:export\s+)?(?:default\s+)?(?:declare\s+)?(?:abstract\s+)?(?:async\s+)?(function|const|let|var|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/gm;
  const BINDS_A_VALUE = new Set(['function', 'const', 'let', 'var', 'class']);

  /**
   * Split a module into its top-level declarations.
   *
   * **The extent runs from one head to the NEXT head rather than to a matching brace**, and that is
   * what makes this blind to no declaration form rather than to one form fewer than before. The walk
   * this replaced matched `function name(` alone and then brace-matched from the body's `{`, which
   * finds neither shape a value binding takes: an arrow with a block body opens its brace after a
   * `=>` the pattern never reaches, and a concise-bodied one has no body block at all, so the first
   * `{` after its head belongs to some later declaration. That mattered here more than it reads —
   * **the arrow is the house style in `daemon-client.ts`, eighteen bindings against five
   * declarations, and every READER in it is an arrow** — so the one shape the register could not see
   * was the shape the next writer would most likely be written in.
   *
   * Every byte after the first head belongs to exactly one declaration, and the text before it
   * belongs to a pseudo-declaration rather than to nothing, so a write cannot fall outside this
   * register at all. It can only be attributed to the wrong name, which fails the register rather
   * than passing it.
   *
   * **A residual, stated rather than left to be found:** an anonymous `export default function` has
   * no name to collect, so its body would be attributed to the declaration above it. Nothing in this
   * app default-exports anything — the day something does, this is where it has to be taught.
   */
  const declarations = (text: string): Declaration[] => {
    const heads = [...text.matchAll(DECLARATION_HEAD)];
    const first = heads[0]?.index ?? text.length;
    return [
      { name: '(before the first declaration)', binds: false, text: text.slice(0, first) },
      ...heads.map((head, i) => ({
        name: head[2],
        binds: BINDS_A_VALUE.has(head[1]),
        text: text.slice(head.index ?? 0, heads[i + 1]?.index ?? text.length),
      })),
    ];
  };

  /**
   * Every act in `daemon-client.ts` that issues a request which is not a GET.
   *
   * **The subject the needles above lost**, and it is a different one rather than a stronger
   * version of theirs: they ask *which files may carry a write*, and this asks *which acts there
   * are*. A fourth act added inside the one permitted module trips none of them, because the method
   * and both segments are already forgiven there — it fails here, by name.
   *
   * The unit is the top-level DECLARATION rather than the file, because that is what an act is, and
   * it is the declaration rather than the function so that no way of spelling a function can hide
   * one. A binding whose text never names the method — {@link declarations} collects every top-level
   * one, not only the callable ones — is simply not collected.
   */
  const writingFunctions = (text: string): string[] =>
    declarations(text).filter((one) => one.binds && one.text.includes(WRITE_METHOD))
      .map((one) => one.name).sort();

  /**
   * Every top-level declaration that names the method and yet binds no value.
   *
   * The other half of {@link writingFunctions}, and the half that makes it exhaustive rather than
   * merely wider: a method named outside every act is either the type that closes the set or a
   * writer this walk failed to read, and the two are told apart by registering the first by name.
   */
  const typesNamingWrite = (text: string): string[] =>
    declarations(text).filter((one) => !one.binds && one.text.includes(WRITE_METHOD))
      .map((one) => one.name).sort();

  /** Every `<file>: <what>` the rules report, with the exemptions honoured or ignored. */
  const writeOffenders = (exempt: boolean): string[] =>
    sourceFiles().flatMap(([name, text]) => WRITE_RULES
      .filter((rule) => !(exempt && rule.permitted === name) && text.includes(rule.needle))
      .map((rule) => `${name}: ${rule.what}`));

  test('nothing under src issues a request that is not a GET, or names a route that takes one', () => {
    // The boundary as a property of the source rather than only of the screen. Nothing outside the
    // two modules named above writes: no stage is moved by this app and no file under a ticket
    // folder is written by it — and `read.ts`'s own header says the same thing one package over,
    // where it is the boundary that ticket exists to hold.
    expect(writeOffenders(true), 'a module outside the two named may write').toStrictEqual([]);
    // Each needle discriminates, over fixtures assembled so this file is not its own subject.
    expect(WRITE_RULES.filter((rule) => `await fetch(p, { method:${' '}'POST' })`.includes(rule.needle)).map((rule) => rule.what))
      .toStrictEqual(['issues a POST']);
    expect(WRITE_RULES.filter((rule) => `const at = '${'/gate'}';`.includes(rule.needle)).map((rule) => rule.what))
      .toStrictEqual(["names the daemon's gate route"]);
  });

  test('Q-0016 AC-5 — and each exemption is doing work: dropping it reports the module by name', () => {
    // **The half that makes an exemption a narrowing rather than a hole.** A permitted file that no
    // longer carries its needle is an exemption forgiving nothing, which reads as coverage and is
    // not — so the same rules are run over the same corpus with the exemptions ignored, and what
    // comes back is asserted to be exactly the two modules this ticket named. A guard whose
    // exemption could be deleted with nothing failing has not been established.
    expect(writeOffenders(false).sort(), 'the exemptions forgive something other than the modules named')
      .toStrictEqual([
        'daemon-client.ts: issues a POST',
        "daemon-endpoints.ts: names the daemon's gate route",
        'daemon-endpoints.ts: names the stop route',
      ]);
    // …and the permitted MODULE set is exactly those two, which is the half Q-0130 did not move: it
    // widened the boundary by one permission inside modules that already held one, and a third
    // module could still not be added silently.
    expect([...new Set(WRITE_RULES.map((rule) => rule.permitted).filter((name) => name !== null))].sort())
      .toStrictEqual(['daemon-client.ts', 'daemon-endpoints.ts']);
    // **The clause this replaced asserted `'/stop'`'s `permitted` was `toBeNull()`** under the
    // message *"stopping a run became permitted"* — which is exactly what Q-0130 makes true, so a
    // tidy implementation would have deleted it. It is replaced by one naming the module rather
    // than removed, so the permission stays an identity: a stop permitted somewhere ELSE fails here
    // rather than passing.
    expect(WRITE_RULES.find((rule) => rule.needle.includes('stop'))?.permitted,
      'the stop route is permitted somewhere other than the endpoint module').toBe('daemon-endpoints.ts');
  });

  test('Q-0130 AC-11 — and the acts that write are three, named, because the needles can no longer tell', () => {
    // **A clause with a different subject**, and the register above is why it is owed: a start needs
    // no new path literal and the method was already permitted in the same module, so a fourth
    // writer added to `daemon-client.ts` trips not one of those six needles. They report which files
    // may write; this reports what the writes ARE.
    const client = sourceFiles().find(([name]) => name === 'daemon-client.ts')?.[1];
    expect(client, 'there is no daemon client — this clause has lost its subject').toBeDefined();
    expect(writingFunctions(client ?? ''), 'the set of acts this app performs on a run moved')
      .toStrictEqual(['answerGate', 'startRun', 'stopRun']);
    // **The half that makes the three exhaustive rather than merely correct.** The method is named a
    // fourth time in that module, in `DaemonRequest`, which is the type that closes the set by the
    // compiler rather than an act — so it is registered by name instead of filtered out by a
    // predicate nobody re-reads. Any OTHER declaration naming the method is a write this walk failed
    // to read as one, and it fails here rather than being silently absent from the three above.
    expect(typesNamingWrite(client ?? ''), 'the method is named outside every act and outside the type that closes it')
      .toStrictEqual(['DaemonRequest']);
    // An IDENTITY and not a count, shown both ways: a fourth writer is reported, and one name
    // swapped for another is reported — which a length assertion would pass over.
    const post = `{ method:${' '}'POST', headers: {}, body: '' }`;
    const fixture = [
      `export async function answerGate(f: F) { await f(p, ${post}); }`,
      `export async function startRun(f: F) { await f(p, ${post}); }`,
      `export async function stopRun(f: F) { await f(p, ${post}); }`,
    ].join('\n');
    expect(writingFunctions(fixture), 'the walk does not find the three it is written against')
      .toStrictEqual(['answerGate', 'startRun', 'stopRun']);
    expect(writingFunctions(`${fixture}\nexport async function deleteRun(f: F) { await f(p, ${post}); }`),
      'a fourth writer is not reported').toStrictEqual(['answerGate', 'deleteRun', 'startRun', 'stopRun']);
    expect(writingFunctions(fixture.replace('stopRun', 'purgeRun')),
      'one name swapped for another is not reported').toStrictEqual(['answerGate', 'purgeRun', 'startRun']);
    // **And the same three, spelled the way this module actually spells things.** The walk this
    // replaced saw the declaration above and none of the three below, while `daemon-client.ts` is
    // eighteen value bindings against five declarations and every READER in it is an arrow — so the
    // form it was blind to is the form the next writer is likeliest to be written in. All three are
    // here because they defeat a brace walk for three different reasons: a block body opens its
    // brace past a `=>` the pattern never reaches, a concise body has no body block at all, and a
    // function expression carries no name where a declaration carries one.
    const bound = [
      `export const answerGate = async (f: F) => { await f(p, ${post}); };`,
      `export const startRun = (f: F) => f(p, ${post});`,
      `const stopRun = async function (f: F) { await f(p, ${post}); };`,
    ].join('\n');
    expect(writingFunctions(bound), 'a writer that is a value binding rather than a declaration is not found')
      .toStrictEqual(['answerGate', 'startRun', 'stopRun']);
    expect(writingFunctions(`${bound}\nexport const deleteRun = (f: F) => f(p, ${post});`),
      'a fourth writer in the form this module favours is not reported')
      .toStrictEqual(['answerGate', 'deleteRun', 'startRun', 'stopRun']);
    expect(writingFunctions(bound.replace('stopRun', 'purgeRun')),
      'one bound name swapped for another is not reported').toStrictEqual(['answerGate', 'purgeRun', 'startRun']);
    // …and a reader is not a writer, in either form: a binding that makes a GET is not collected, so
    // the three above are the acts rather than the exported functions.
    expect(writingFunctions(`export async function fetchRuns(f: F) { await f(p); }`),
      'a plain read was collected as a write').toStrictEqual([]);
    expect(writingFunctions(`export const fetchRuns = (f: F) => f(p);`),
      'a plain read in the arrow form was collected as a write').toStrictEqual([]);
    // …and a write that is not inside any declaration is attributed to something rather than lost,
    // which is what makes the walk exhaustive rather than a wider enumeration of forms.
    expect(typesNamingWrite(`await f(p, ${post});\n${fixture}`),
      'a write before the first declaration was attributed to nothing')
      .toStrictEqual(['(before the first declaration)']);
  });

  /** The hook a screen offers a confirmable act on a run through, and the only way one is offered. */
  const OFFERS_AN_ACT = 'useRunMutation';

  /** A call of it: the name, optional type arguments, then the argument list. */
  const CALLS_THE_HOOK = /useRunMutation\s*(?:<[^()]*>)?\s*\(/g;

  /**
   * How many top-level arguments the call whose `(` is at `open` supplies, or `-1` for a call whose
   * brackets never close — which fails the register rather than being read as *none*.
   */
  const argumentCount = (text: string, open: number): number => {
    let depth = 0;
    let commas = 0;
    for (let at = open; at < text.length; at += 1) {
      const char = text[at];
      if (char === '(' || char === '[' || char === '{') depth += 1;
      else if (char === ')' || char === ']' || char === '}') {
        depth -= 1;
        if (depth === 0) return text.slice(open + 1, at).trim() === '' ? 0 : commas + 1;
      } else if (char === ',' && depth === 1) commas += 1;
    }
    return -1;
  };

  /**
   * Every screen in one module that can offer an act on a run, as `<declaration> supplies <n>`.
   *
   * **The register the errata asked for, and its subject is the SECOND argument.** A premise is a
   * parameter of the hook rather than something a screen remembers to check, so a call site that
   * supplies one is visible here and one that does not is visible as `supplies 1`. The declaration
   * the call sits in is what names it, over {@link declarations}, so no way of spelling a component
   * can hide one — the correction round 3 made to the writing register, reused rather than
   * re-derived.
   *
   * The hook's OWN declaration is excluded by name: its head reads `useRunMutation<T, P>(`, which is
   * a definition and not a call, and excluding it by name is what keeps the exclusion visible rather
   * than a predicate that could quietly widen. A call written in prose inside a comment is collected
   * and fails, which is the safe direction.
   *
   * **What it does NOT cover, stated rather than left to be read into it.** Its subject is a
   * CONFIRMATION, so a screen that sends without asking first is invisible here — `gate-screen.tsx`
   * is one, sending a gate answer straight from the control that names it, and it has no pending
   * offer for a premise to be attached to. The clause that sees all three acts whatever screen
   * issues them is the writing register above; this one says that every act a reader is ASKED about
   * carries what it was asked under.
   */
  const actSites = (text: string): string[] =>
    declarations(text)
      .filter((one) => one.name !== OFFERS_AN_ACT)
      .flatMap((one) => [...one.text.matchAll(CALLS_THE_HOOK)]
        .map((call) => `${one.name} supplies ${argumentCount(one.text, (call.index ?? 0) + call[0].length - 1)}`));

  /** The same over the whole corpus, so a fourth screen is a fourth row wherever it is written. */
  const offerSites = (): string[] => sourceFiles()
    .flatMap(([name, text]) => actSites(text).map((site) => `${name}: ${site}`)).sort();

  test('Q-0130 AC-9 — a screen cannot offer an act on a run without supplying the premise it is under', () => {
    // **The evidence the fourth review round asked for, and it is deliberately not one test per
    // screen.** Four findings in one review loop were one class — a confirmation outliving the
    // premise that made it offerable: a change of subject, then the run's state, then the chosen
    // flow's eligibility — and each round closed the instance it was handed while the next found the
    // same defect on a sibling surface. A clause per surface is that failure written down. What
    // makes a fifth surface safe is that a premise is a parameter of the hook: a screen states what
    // its offer rests on and `run-lifecycle.ts` withdraws it, so a call site cannot forget to.
    expect(offerSites(), 'a screen offers an act on a run without supplying the premise it is under')
      .toStrictEqual([
        'mission-control-screen.tsx: MissionControlScreen supplies 2',
        'ticket-page.tsx: TicketPage supplies 2',
      ]);
    // The same property stated over the set rather than through the identity above, because a
    // register a later reader updates by hand can be updated to the wrong number: every site, named
    // or not, supplies two.
    expect(offerSites().filter((site) => !site.endsWith(' supplies 2')),
      'a call site supplies something other than a subject and a premise').toStrictEqual([]);
    // The exclusion has a subject and is exactly one file: the hook is declared once, in the module
    // that owns the discipline.
    expect(sourceFiles().filter(([, text]) => text.includes(`function ${OFFERS_AN_ACT}<`)).map(([name]) => name),
      'the hook is declared somewhere other than the module that owns the discipline')
      .toStrictEqual(['run-lifecycle.ts']);
    // **And the act's own half, which is what the compiler holds rather than this file**: the
    // premise a pending confirmation is judged by is a REQUIRED member of an act, so a fourth screen
    // that supplies the argument and composes an act without a predicate does not typecheck. An
    // optional one would make the whole mechanism something a call site can decline.
    const lifecycle = sourceFiles().find(([name]) => name === 'run-lifecycle.ts')?.[1] ?? '';
    expect(lifecycle, 'there is no lifecycle module — this clause has lost its subject').not.toBe('');
    expect(lifecycle.includes('holds('), 'an act declares no premise at all').toBe(true);
    expect(lifecycle.includes('holds?'), 'the premise became optional, so an act can be offered without one').toBe(false);
    // An IDENTITY and not a count, shown three ways over fixtures assembled so this file is not its
    // own subject: a call supplying no premise is reported as such, a fourth screen is reported by
    // name, and the arrow form — the one round 2 found the writing register blind to — is seen.
    const site = (name: string, args: string): string =>
      `export function ${name}() { const act = ${OFFERS_AN_ACT}<string, P>(${args}); return act; }`;
    expect(actSites(site('Screen', 'handle, reported')), 'the walk does not find the call it is written against')
      .toStrictEqual(['Screen supplies 2']);
    expect(actSites(site('Screen', 'handle')), 'a call site supplying no premise was not reported as one')
      .toStrictEqual(['Screen supplies 1']);
    expect(actSites(`${site('Screen', 'handle, reported')}\nexport const Fourth = () => ${OFFERS_AN_ACT}(id);`),
      'a fourth screen in the arrow form was not reported')
      .toStrictEqual(['Screen supplies 2', 'Fourth supplies 1']);
    // …and a module that offers nothing is not a site, so the two above are the screens rather than
    // the components.
    expect(actSites('export function Board() { return null; }'), 'a screen that offers no act was collected')
      .toStrictEqual([]);
  });

  test('Q-0130 AC-12 — no file under src names a start field this app will not send', () => {
    // **Pillar 3 as a checked property of the source rather than as an intention.** `auto` advances
    // every author-declared gate without a human, and *"Human-gated by default, auto opt-in per
    // gate"* (2026-08-06) puts that choice in the FLOW FILE — so a browser control for it is a
    // second mechanism for one rule and would owe a decision entry this ticket did not take. `base`
    // moves a review's diff anchor and needs a revision no route on this transport can enumerate.
    //
    // The needles are the two names as an object KEY, in the three forms a key is written, because
    // that is the shape a start body has. One exemption, measured rather than assumed.
    const FORBIDDEN = ['auto', 'base'];
    const forms = (field: string): string[] => [`${field}:`, `'${field}'`, `"${field}"`];
    /**
     * `base` on a board card, which is the CONFIGURED BASE BRANCH a containment token is spelled
     * against — a different `base` entirely, and the one the wire already carries as `baseBranch`.
     *
     * A file-level exemption would forgive a genuine start body written there, so it is paired with
     * the clause below: the exempted file names `startRun` nowhere, and the board starts no run.
     */
    const PERMITTED: Record<string, string> = { 'backlog-board.tsx:base:': "a card's containment base branch, which is `WireTicketList.baseBranch` and not a run's diff anchor" };
    const named = (exempt: boolean): string[] => sourceFiles().flatMap(([name, text]) => FORBIDDEN
      .flatMap((field) => forms(field).map((needle) => ({ needle, found: text.includes(needle) })))
      .filter(({ needle, found }) => found && !(exempt && `${name}:${needle}` in PERMITTED))
      .map(({ needle }) => `${name}:${needle}`));

    expect(named(true), 'a file under src names a start field this app will not send').toStrictEqual([]);
    // The exemption is doing work and is exactly the one measured: ignoring it reports that site and
    // no other, so it forgives something rather than reading as coverage.
    expect(named(false).sort(), 'the exemption forgives something other than the site it names')
      .toStrictEqual(Object.keys(PERMITTED));
    // …and the file it forgives starts no run, which is what keeps a file-level exemption from
    // forgiving a start body written there.
    const board = sourceFiles().find(([name]) => name === 'backlog-board.tsx')?.[1] ?? '';
    expect(board, 'the board is not in the corpus — this exemption has lost its subject').not.toBe('');
    expect(board.includes('startRun'), 'the exempted file starts a run').toBe(false);
    // The needles discriminate, over fixtures assembled so this file is not its own subject.
    const body = `{ flow: f, ticket: t, ${'auto'}: true }`;
    expect(FORBIDDEN.flatMap(forms).filter((needle) => body.includes(needle))).toStrictEqual(['auto:']);
    expect(FORBIDDEN.flatMap(forms).filter((needle) => `{ ${'base'}: ref }`.includes(needle))).toStrictEqual(['base:']);
    expect(FORBIDDEN.flatMap(forms).filter((needle) => '{ flow: f, ticket: t, dry: true }'.includes(needle)))
      .toStrictEqual([]);
  });

  test('Q-0130 AC-13 — every sentence saying this app cannot start or stop a run is gone', () => {
    // **The negatives are what a document of this kind gets wrong**: not the new sentence but the
    // old one nobody re-read. Five sites under `src` carried one, and each is asserted absent AND
    // shown findable, so an emptiness here is an absence rather than five needles that match
    // nothing. The sixth site is this file's own `WRITE_RULES` docblock, which no scan over `src`
    // reaches and which moved with them.
    const RETIRED: [string, string][] = [
      ['the empty-runs sentence', ['This app cannot ', 'start one'].join('')],
      ['the client header', ['Since Q-0016 exactly one request here ', 'is not a GET'].join('')],
      ['the boundary clause both headers carried', ['no run is started, ', 'no run is stopped'].join('')],
      ['the gate screen\'s claim to be the whole of it', ['It is the whole of ', 'what this app writes'].join('')],
      ['the shell\'s wait', ['enabled by whichever ticket ', 'can start a run'].join('')],
    ];
    for (const [what, retired] of RETIRED) {
      expect(sourceFiles().filter(([, text]) => text.includes(retired)).map(([name]) => name), `${what} survives`)
        .toStrictEqual([]);
      // The needle has a subject: the same one finds the wording where it is written.
      expect([['fixture.ts', `/** ${retired} */`]].filter(([, text]) => text.includes(retired)).length,
        `the needle for ${what} matches nothing`).toBe(1);
    }
    // And the half a set of negatives cannot carry: the clause that is STILL TRUE survived. A
    // `quorum run` invocation imports `runFlow` and runs in its own process, so a run started at a
    // command line is one this daemon's registry has never heard of, and deleting that with the
    // clause beside it would have been the correction losing what it was not about.
    const text = sourceFiles().find(([name]) => name === 'mission-control-text.ts')?.[1] ?? '';
    expect(text, 'the empty-runs sentence is not in the corpus — this clause has lost its subject').not.toBe('');
    expect(text, 'the clause that is still true was deleted with the one that went false')
      .toContain('a different process that this daemon cannot see');
  });

  test('nothing refetches on a timer, and nothing persists a board in the browser', () => {
    // `GET /tickets` walks the backlog and probes git per ticket, so an interval would make the
    // most expensive route on the transport this app's hot path — and a stored copy would be the UI
    // holding a git fact it cannot keep current. The persistence half is the block at the top of
    // this file; this is the timer half, which nothing covered.
    const timers = ['setInterval', 'setTimeout', 'requestIdleCallback'];
    for (const [name, text] of sourceFiles()) {
      for (const timer of timers) expect(text.includes(`${timer}(`), `${name} schedules work with ${timer}`).toBe(false);
    }
    expect(timers.filter((timer) => `${'setInterval'}(reload, 5000)`.includes(`${timer}(`)))
      .toStrictEqual(['setInterval']);
  });

  test('no file under src calls a containment answer merged, landed or shipped', () => {
    // `docs/GLOSSARY.md`: containment is an ancestry fact about two refs at the moment of reading,
    // and the board says **contained** and never one of these three — an ancestry fact is not a
    // claim about how the code arrived.
    const SYNONYMS = ['merged', 'landed', 'shipped'];
    for (const [name, text] of sourceFiles()) {
      for (const word of SYNONYMS) {
        expect(new RegExp(`\\b${word}\\b`, 'i').test(text), `${name} says ${word}`).toBe(false);
      }
    }
    expect(SYNONYMS.filter((word) => new RegExp(`\\b${word}\\b`, 'i').test('the branch was merged into main')))
      .toStrictEqual(['merged']);
  });

  test('no cost figure is labelled "cost to date", and no token count is reached for at all', () => {
    // *"Codex cost is reported as tokens, never priced locally"* (2026-08-22) and the measurement
    // this ticket's gate produced: the figure a ticket file holds is neither per vendor nor cost to
    // date, and labelling it as either would be a claim the number cannot support.
    //
    // **The needles are the FIELD names a token count could only come from, not the word "token".**
    // A word scan collides with containment's own vocabulary — the board renders three *tokens*,
    // and `docs/GLOSSARY.md` uses that word for them — so it would have been a guard keyed on a name
    // rather than on the behaviour, which is the family this repository records most. These five are
    // every shape a count reaches this app in: `GET /history/:id`'s roll-up field, the `core`
    // function behind it, and the three measures a manifest occurrence carries.
    const COUNT_FIELDS = ['tokensByVendor', 'vendorTokenTotal', 'input_tokens', 'output_tokens', 'cached_input_tokens'];
    const PHRASE = `cost to ${'date'}`;
    for (const [name, text] of sourceFiles()) {
      expect(text.toLowerCase().includes(PHRASE), `${name} labels a figure "${PHRASE}"`).toBe(false);
      for (const field of COUNT_FIELDS) {
        expect(text.includes(field), `${name} reaches for ${field}, which is a count and not a price`).toBe(false);
      }
    }
    // Both halves discriminate, over fixtures rather than over an empty corpus.
    expect(`${PHRASE} per vendor`.includes(PHRASE)).toBe(true);
    expect(COUNT_FIELDS.filter((field) => 'const total = row.input_tokens + row.output_tokens;'.includes(field)))
      .toStrictEqual(['input_tokens', 'output_tokens']);
  });
});

describe('Q-0127 AC-7/AC-10/AC-11/AC-12 — what the ticket page may not declare, name or render', () => {
  test('this package declares neither new wire shape of its own', () => {
    // A browser needs an executable parser, and a second declaration beside an import is free to
    // drift from the one `@quorum/shared` owns — the half-measure Q-0120 had to repair. The other
    // direction, that the shapes really are declared there, is asserted in that package.
    // `WireStartRequest` joined them at Q-0130 under the same rule and in the other direction: it
    // is the first shape here this app BUILDS rather than reads, and the field set had lived only
    // inside `packages/server` — so a browser composing a start body without it would have written
    // the five names a third time, which is verbatim the drift Q-0120 was opened on.
    for (const shape of ['WireTicketDetail', 'WireTicketFile', 'WireTicketFileEntry', 'WireExcludedFiles', 'WireStartRequest']) {
      const offenders = filesBelow(PACKAGE)
        .filter(([, text]) => new RegExp(`\\b(?:interface|type)\\s+${shape}\\s*[={]`).test(text))
        .map(([name]) => name);
      expect(offenders, `${shape} is declared in this package`).toStrictEqual([]);
    }
    // It imports two of them, so the absence above is a delegation rather than four names this app
    // never heard of — and the needle finds a declaration when there is one. The fixture's own name
    // is assembled, under this file's one rule: the scan above walks the whole package, so a
    // written-out declaration here would make this file its own subject.
    const client = filesBelow(PACKAGE).find(([name]) => name === 'src/daemon-client.ts')?.[1] ?? '';
    expect(client, 'the client does not import the detail shape').toContain('WireTicketDetail');
    // The start shape likewise, and with its SCHEMA: a type alone would be the half-measure Q-0120
    // had to repair, a browser needing an executable builder rather than a declaration.
    expect(client, 'the client does not import the start shape').toContain('WireStartRequest');
    expect(client, 'the client builds a start body without the shared schema').toContain('wireStartRequestSchema');
    const fixture = `export interface ${'Wire'}${'TicketFile'} { rel: string }`;
    expect(/\b(?:interface|type)\s+WireTicketFile\s*[={]/.test(fixture)).toBe(true);
  });

  test('the ticket page holds no list of artifact folder names', () => {
    // AC-10's structural half. `docs/05-design-prompt.md:27` names six artifact folders and this
    // backlog already holds a seventh top-level entry on one ticket, so a set written down in the
    // component loses a file on the day it is written. The tabs are derived from the listing, and
    // this is the other side of that claim: the component names no artifact folder at all.
    //
    // **Scoped to the component rather than to every file under `src`**, and the reason is that
    // four of these six are also STAGE names — `@quorum/shared`'s `STAGES`, which the board renders
    // a column per and whose fixtures name them legitimately. A scan over the whole tree would be
    // keyed on a string rather than on the behaviour it is about, which is the family this
    // repository records most.
    const FOLDERS = ['requirements', 'solution', 'qa', 'dev', 'review', 'deploy'];
    const component = sourceFiles().find(([name]) => name === 'ticket-page.tsx')?.[1] ?? '';
    expect(component, 'the ticket page is not in the corpus — this clause has lost its subject').not.toBe('');
    for (const folder of FOLDERS) {
      expect(component.includes(`'${folder}'`), `the ticket page names the artifact folder ${folder}`).toBe(false);
    }
    // The needle discriminates, over a fixture assembled so this file is not its own subject.
    const fixture = `const TABS = ['${FOLDERS[0]}', '${FOLDERS[3]}'];`;
    expect(FOLDERS.filter((folder) => fixture.includes(`'${folder}'`))).toStrictEqual(['requirements', 'dev']);
  });

  test('nothing turns a run-log line into a link, and no renderer or sanitiser is imported', () => {
    // What a run id in a run-log line links to is a decision about a screen that does not exist,
    // which is Q-0018's; and a Markdown renderer needs a sanitiser, which needs a dependency and a
    // justification — a separate decision with its own subject rather than one arrived at while
    // building a page. `test/package.test.ts` pins the declared dependency set in both directions;
    // this is the import side of the same claim.
    const RENDERERS = ['marked', 'markdown-it', 'react-markdown', 'dompurify', 'sanitize-html', 'remark'];
    for (const [name, text] of sourceFiles()) {
      for (const specifier of importSpecifiers(text)) {
        expect(RENDERERS.includes(specifier), `${name} imports ${specifier}`).toBe(false);
      }
      expect(/dangerouslySetInnerHTML/.test(text), `${name} sets markup from a value`).toBe(false);
    }
    // The run log is rendered as text: the module that renders it builds no anchor from a line.
    const rail = sourceFiles().find(([name]) => name === 'ticket-page.tsx')?.[1] ?? '';
    expect(rail, 'the ticket page is not in the corpus — this clause has lost its subject').not.toBe('');
    expect(/runs\.log[\s\S]{0,400}<a\b/.test(rail), 'a run-log line was turned into a link').toBe(false);
    // Both needles discriminate.
    expect(RENDERERS.filter((each) => importSpecifiers(`import DOMPurify from '${'dompurify'}';`).includes(each)))
      .toStrictEqual(['dompurify']);
    expect(/dangerouslySetInnerHTML/.test('<pre dangerouslySetInnerHTML={{ __html: text }} />')).toBe(true);
  });
});

describe('Q-0016 AC-7/AC-8/AC-9 and Q-0129 AC-10 — what the gate screen may not parse, coin or claim', () => {
  /** The screen itself, which every clause here is about. Absent, each one has lost its subject. */
  const screen = (): string => {
    const found = sourceFiles().find(([name]) => name === 'gate-screen.tsx')?.[1];
    if (found === undefined) throw new Error('there is no gate screen — this check has lost its subject');
    return found;
  };

  test('AC-7 — the correlation token is echoed and never taken apart', () => {
    // `nextGateId` spells `<run number>:<n>`, so a `gateId` really does carry a run number and
    // parsing one is tempting. The daemon's own host refuses to: its comment names taking a run
    // number out of a `gateId` as the second authority `minted` exists to prevent, and a browser is
    // under the same rule. The needle is any of the five ways a string is taken apart, applied to
    // that field.
    const takesApart = /\bgateId\s*(?:\.(?:split|slice|substring|substr|match|replace|indexOf|charAt)|\[)/;
    expect(takesApart.test(screen()), 'the screen takes the correlation token apart').toBe(false);
    // Both directions over fixtures, so the absence above is not a needle that matches nothing.
    expect(takesApart.test('const run = gateId.split(\':\')[0];')).toBe(true);
    expect(takesApart.test('answerGate(fetcher, handle, question.gateId, chosen, clock)')).toBe(false);
    // And it really does echo one, so the clause is about a field the screen uses.
    expect(screen(), 'the screen never names the correlation token at all').toContain('gateId');
  });

  test('AC-8 — the answer vocabulary is imported and not written here', () => {
    // A second copy of `advance|retry|abort` in this app is the drift `@quorum/shared` exists to
    // stop, and it is what would let a screen offer a fourth control the engine refuses. The
    // property is that the OFFERED SET is derived from the schema's own options; the one literal
    // that survives is the discriminator picking the answer a gate may not offer, and `GateAnswer`
    // is what makes a typo there fail to compile.
    expect(screen(), 'the offered set is not derived from the shared schema').toContain('gateAnswerSchema.options');
    const ownVocabulary = /\[\s*'advance'\s*,\s*'retry'\s*,\s*'abort'\s*\]|z\.enum\(/;
    expect(ownVocabulary.test(screen()), 'the screen declares an answer vocabulary of its own').toBe(false);
    expect(ownVocabulary.test(`const answers = ['advance', 'retry', 'abort'];`),
      'the needle matches no written-out vocabulary').toBe(true);
  });

  test('AC-9 — no gate is given a name of its own', () => {
    // `handleFail` composes `kind: 'human-locked'` for every gate the engine presents itself, and an
    // author-declared deploy gate will carry the same word — the field is an open string, so `kind`
    // discriminates nothing. A screen that coined a noun from it would be labelling a gate by a
    // field that cannot support the label.
    const COINED = ['exhaustion gate', 'deploy gate', 'review gate', 'judge gate'];
    for (const coined of COINED) {
      expect(screen().toLowerCase().includes(coined), `the screen calls a gate a ${coined}`).toBe(false);
    }
    expect(COINED.filter((coined) => 'this is the exhaustion gate'.includes(coined))).toStrictEqual(['exhaustion gate']);
    // …and it does render the word the engine sent, which is what it renders instead.
    expect(screen(), 'the screen does not render the kind the engine sent').toContain('question.kind');
  });

  test('AC-14 — the retired placeholder sentence is absent', () => {
    // The sentence the register carried for this route until the screen existed. It promised the
    // half this ticket does not build, so a reader meeting it now would go looking for a rendering
    // of something that is not there. Assembled, in this file's one rule, so the scan is not its own
    // subject — and the register's own clause in `test/routes.test.ts` asserts what replaced it.
    const retired = ["The gate screen shows a step's ", 'verdict and ', 'diffs, and takes the answer.'].join('');
    expect(sourceFiles().filter(([, text]) => text.includes(retired)).map(([name]) => name)).toStrictEqual([]);
    // The needle discriminates, so the emptiness above is an absence rather than a typo.
    expect([['fixture.ts', `waitingFor: '${retired}'`]].filter(([, text]) => text.includes(retired)).map(([name]) => name))
      .toStrictEqual(['fixture.ts']);
  });

  test('Q-0129 AC-10/AC-12 — three of the six needles retire, and three are the successor\'s', () => {
    // **Narrowed rather than deleted, and it is narrowed by exactly half.** Q-0016's AC-13 forbade
    // six words because the screen rendered nothing about what the step before the gate decided.
    // Three of those — the decision itself — are what Q-0129 builds, so they retire; the other
    // three are **Q-0134**'s, which adds the change the step was about and has not landed. A guard
    // that had simply been deleted with the criterion would have stopped forbidding those too.
    const RETIRED = ['verd' + 'ict', 'find' + 'ings', 'summ' + 'ary'];
    const SUCCESSOR = ['dif' + 'f', 'block' + 'er', 'hun' + 'k'];
    for (const word of SUCCESSOR) {
      expect(new RegExp(`\\b${word}`, 'i').test(screen()), `the screen names ${word}, which is Q-0134's`).toBe(false);
    }
    // The needles still discriminate, so the three absences above are absences rather than typos.
    expect(SUCCESSOR.filter((word) => new RegExp(`\\b${word}`, 'i').test('the unified diff lists two blockers per hunk')))
      .toStrictEqual(SUCCESSOR);
    // …and the three that retired are named here rather than dropped silently, with the clause that
    // says WHY they may now appear: the screen renders the decision, so it names it.
    expect(RETIRED.every((word) => new RegExp(`\\b${word}`, 'i').test(screen())),
      'a retired needle names something the screen does not render after all').toBe(true);
    // **The severity vocabulary is imported and never spelled here**, which is what the surviving
    // `blocker` needle enforces now that it is no longer about an absent region: a screen taking its
    // group labels from `@quorum/shared` cannot write the word, and one that re-spelled the register
    // would fail above.
    expect(screen(), 'the screen does not take the reported-entry register from the shared package')
      .toContain('FINDING_SEVERITIES');
    expect(screen(), 'the screen does not take the observation tag from the shared package')
      .toContain('OBSERVATION_TAG');
    // An event's `message` is free text the engine composed — `${'step'}: ${'revise'} — …`, whose
    // separator is absent exactly when the list it separates is — so reading one for a machine value
    // is reading a sentence as a contract. The screen reads no event field at all.
    expect(/\.message\b/.test(screen()), 'the screen reads an event message').toBe(false);
    expect(/\.message\b/.test('const first = event.message;')).toBe(true);
  });

  test('Q-0129 AC-8 — an agent\'s words are rendered as text and never as markup', () => {
    // A summary and a reported entry are the one thing on this screen written by an agent, so they
    // are where a markup escape would land. React escapes what it interpolates; the needle is the
    // one property that undoes that.
    expect(/dangerouslySetInnerHTML/.test(screen()), 'the screen renders agent text as markup').toBe(false);
    expect(/dangerouslySetInnerHTML/.test('<p dangerouslySetInnerHTML={{ __html: summary }} />')).toBe(true);
  });
});

/**
 * Every module specifier `text` imports or re-exports.
 *
 * Byte-identical in shape to `packages/shared/test/corpus.ts`'s, including the required whitespace
 * between the keyword and the quote — without it a prose string ending in the word "import" and its
 * own closing quote reads as an import statement.
 */
const importSpecifiers = (text: string): string[] =>
  [...text.matchAll(/\b(?:from|import)\s+['"]([^'"\n]+)['"]/g)].map((match) => match[1]);

describe('AC-5 — no file under src reaches for something a browser does not have', () => {
  /** The same list `packages/shared/src/index.test.ts` uses, for the same question. */
  const BUILTINS = [
    'assert', 'buffer', 'child_process', 'crypto', 'events', 'fs', 'http', 'https', 'module', 'net',
    'os', 'path', 'process', 'readline', 'stream', 'url', 'util', 'worker_threads', 'zlib',
  ];

  /**
   * Assembled, under this file's one rule — see the header.
   *
   * This scan's corpus no longer reaches this file, so nothing forces it here today. It is what the
   * network scan below needs, that one walking the whole package; keeping every needle assembled is
   * cheaper than deciding per scan, and it is what stops a corpus that moves again from quietly
   * turning a needle into its own subject.
   */
  const NODE_PREFIX = `${'node'}:`;
  const CORE_PACKAGE = `@${'quorum'}/core`;

  test('the corpus is every file under src, and not a filtered subset of it', () => {
    // The positive control, and the clause that discriminates against the narrowing this scan
    // carried until run-2 iteration 2's review. Every failure mode of a walk hides files rather
    // than inventing them, so a corpus that had lost part of its subject would report success.
    const names = sourceFiles().map(([name]) => name);
    expect(names.length, 'the walk finds no source — this scan proves nothing').toBeGreaterThan(5);
    // The two that discriminate: a corpus filtered to "what ships" drops the first, and one
    // filtered to TypeScript drops the second. Both are files AC-5's wording reaches.
    expect(names, 'a test file under src is outside the corpus').toContain('shell.test.ts');
    expect(names, 'a non-TypeScript file under src is outside the corpus').toContain('theme.css');
    expect(names).toContain('app.tsx');
  });

  test('no Node builtin, under either spelling', () => {
    for (const [name, text] of sourceFiles()) {
      for (const specifier of importSpecifiers(text)) {
        expect(specifier.startsWith(NODE_PREFIX), `${name} imports ${specifier}`).toBe(false);
        expect(BUILTINS.includes(specifier), `${name} imports ${specifier}`).toBe(false);
      }
    }
  });

  test('and no import of the engine, which is a server-side package all the way down', () => {
    // `@quorum/core` opens files, spawns processes and runs git. A browser bundle that reached it
    // would not merely be large; it would be a second implementation of the boundary
    // `04-architecture.md` draws, on the wrong side of a network.
    for (const [name, text] of sourceFiles()) {
      for (const specifier of importSpecifiers(text)) {
        expect(specifier === CORE_PACKAGE || specifier.startsWith(`${CORE_PACKAGE}/`), `${name} imports ${specifier}`)
          .toBe(false);
      }
    }
  });

  test('the clause has a subject — the same scan reports both when they are there', () => {
    const fixture = `import fs from '${NODE_PREFIX}fs';\nimport { runFlow } from '${CORE_PACKAGE}';\n`;
    expect(importSpecifiers(fixture)).toStrictEqual([`${NODE_PREFIX}fs`, CORE_PACKAGE]);
  });
});

describe('AC-9 — the app names no project it has not been given', () => {
  /**
   * The design brief's own fake data, assembled so this scan covers its own file.
   *
   * `docs/05-design-prompt.md` populates a mockup with three project names, and a mockup's data
   * inside a real app is a claim the product cannot back. The SaaS names are
   * `.claude/rules/product-boundaries.md`'s rule rather than a style preference: nothing in this
   * repository references a specific product except as an example name in demo data, and this app
   * has no demo data.
   */
  const FORBIDDEN_NAMES = [
    `acme${'-billing'}`,
    `heyruud${'.com'}`,
    `northwind${'-crm'}`,
    `feed${'mind'}`,
    `flex${'tann'}`,
  ];

  test('no mockup project name and no product name appears under src', () => {
    const files = sourceFiles();
    expect(files.length, 'the walk found nothing').toBeGreaterThan(1);
    for (const [name, text] of files) {
      for (const forbidden of FORBIDDEN_NAMES) {
        expect(text.includes(forbidden), `${name} names ${forbidden}`).toBe(false);
      }
    }
  });

  test('and the scan discriminates — the same needles find one when it is there', () => {
    const fixture = `const project = '${FORBIDDEN_NAMES[0]}';`;
    expect(FORBIDDEN_NAMES.filter((forbidden) => fixture.includes(forbidden))).toStrictEqual([FORBIDDEN_NAMES[0]]);
  });
});

describe('AC-10 — the palette is defined once, and no component names a colour', () => {
  /** The one file a colour may be written in. Named here, and asserted to exist and to be real. */
  const PALETTE = 'theme.css';

  /** The eleven semantic tokens: six this requirement extends the brief with, five it names. */
  const TOKENS = [
    '--color-bg', '--color-surface', '--color-border', '--color-text', '--color-muted', '--color-accent',
    '--color-running', '--color-waiting-on-human', '--color-passed', '--color-failed', '--color-idle',
  ];

  /** Assembled: this file would otherwise be the one place a colour function is written down. */
  const COLOUR_FUNCTIONS = ['rgb', 'rgba', 'hsl'].map((name) => `${name}${'('}`);

  /** A hex colour. The pattern is not itself one — `[` is in no hexadecimal digit class. */
  const HEX = /#[0-9a-f]{3,8}\b/i;

  const palette = (): string => fs.readFileSync(path.join(SOURCE, PALETTE), 'utf8');

  /** One token's declared value, read out of the palette rather than transcribed beside it. */
  const valueOf = (token: string): string => {
    const found = new RegExp(`${token}:\\s*([^;]+);`).exec(palette());
    if (!found) throw new Error(`${PALETTE} declares no ${token} — this check has lost its subject`);
    return found[1].trim();
  };

  test('the palette file exists, is not empty, and declares all eleven tokens', () => {
    expect(sourceFiles().map(([name]) => name), 'the one exempt file is not there').toContain(PALETTE);
    expect(palette().trim().length, 'the palette is empty').toBeGreaterThan(100);
    expect(TOKENS.length).toBe(11);
    for (const token of TOKENS) {
      expect(palette(), `the palette declares no ${token}`).toContain(`${token}:`);
    }
  });

  test('no other file under src names a colour', () => {
    const named = sourceFiles()
      .filter(([name]) => name !== PALETTE)
      .flatMap(([name, text]) => {
        const found = [...COLOUR_FUNCTIONS.filter((fn) => text.includes(fn))];
        if (HEX.test(text)) found.push('a hex literal');
        return found.map((what) => `${name}: ${what}`);
      });
    expect(named, 'a colour is written outside the palette').toStrictEqual([]);
  });

  test('and the clause has a subject — the same needles find each shape when it is there', () => {
    // Isolated over a fixture, so the emptiness above is an absence rather than four needles that
    // match nothing. The palette itself is the second witness: it holds hex values by design.
    const fixture = `a { color: ${COLOUR_FUNCTIONS[0]}1 2 3); border-color: ${'#'}0b0d10; }`;
    expect(COLOUR_FUNCTIONS.filter((fn) => fixture.includes(fn))).toStrictEqual([COLOUR_FUNCTIONS[0]]);
    expect(HEX.test(fixture)).toBe(true);
    expect(HEX.test(palette()), 'the palette holds no hex value, so the scan above excuses nothing').toBe(true);
  });

  test('the accent is teal and not amber, which the brief\'s own status table forces', () => {
    // `docs/05-design-prompt.md:17` offers "electric teal or amber — pick one" and then, in the same
    // paragraph, assigns waiting-on-human = amber and running = accent pulse. An amber accent puts
    // "a human must act" and "the machine is working" one animation apart. So the two tokens must
    // differ, and that is the property rather than the particular hex.
    expect(valueOf('--color-accent')).not.toBe(valueOf('--color-waiting-on-human'));
    expect(valueOf('--color-running'), 'running is not the accent, which the brief makes it')
      .toBe(valueOf('--color-accent'));
  });

  test('the background is near-black and desaturated rather than pure black', () => {
    // Assembled like every other needle here: written out, these two would be hex literals in a
    // file the scan above covers.
    const pureBlack = ['000', '000000'].map((digits) => `${'#'}${digits}`);
    const background = valueOf('--color-bg').toLowerCase();
    expect(pureBlack, 'the background is pure black').not.toContain(background);
    expect(background).toMatch(HEX);
  });

  test('and nothing decorative: no gradient, no glassmorphism', () => {
    for (const [name, text] of sourceFiles().filter(([file]) => file !== PALETTE)) {
      expect(text.includes(`gradient${'-to-'}`) || text.includes(`linear-${'gradient'}`),
        `${name} paints a decorative gradient`).toBe(false);
      expect(text.includes(`backdrop-${'blur'}`) || text.includes(`backdrop-${'filter'}`),
        `${name} reaches for glassmorphism`).toBe(false);
    }
  });
});

describe('AC-10 — every request this app makes is same-origin: no absolute URL, no third-party host, no font host', () => {
  /**
   * Assembled, for the reason every needle in this file is: the scan covers this file too.
   *
   * `docs/05-design-prompt.md:7` permits "no external assets except Google Fonts" and `:17` names
   * three third-party faces. This app diverges deliberately and says so in `theme.css`: that
   * document describes a single-file clickable mockup for visual validation, and Quorum is
   * local-first — a shell that fetches a font on every page load makes the product require the
   * internet and leaks a request off the machine.
   *
   * **This block was called *"loading the shell fetches nothing from a network"* until Q-0017, and
   * the title moved because the app started fetching.** `daemon-client.ts` asks the daemon for the
   * backlog on every board load, and a same-origin path trips none of these three needles — so
   * every assertion below would have gone on passing under a title that had become false, which is
   * a check outliving its subject at the level of the claim rather than of the assertion. What was
   * always enforced, and still is, is the property now in the title. Nothing was weakened: the
   * three needles, the licence subtraction and its both-directions test are unchanged, and
   * `docs/04-architecture.md`'s sentence moved with this one — `packages/shared/src/docs.test.ts`
   * holds the two against each other so they cannot drift apart again.
   */
  const NETWORK_LITERALS = [`http:${'//'}`, `https:${'//'}`, `${'//'}fonts.`];

  /**
   * The licence text, whose two URLs are a citation rather than a fetch.
   *
   * **Arrived at Q-0124, when this package became one a tarball carries** — `pnpm pack` copies the
   * workspace root's licence into a package that has none and `npm pack` does not, so the two packers
   * disagreed on the file list until this package carried its own, which is the arrangement the three
   * packages distributed before it already had.
   *
   * **Not an exclusion, and the distinction is the whole of why this is admissible.** The file stays
   * in the corpus and every needle is still counted over it; what is subtracted is the number of
   * occurrences that sit inside {@link APACHE_LICENCE_URL}, so a URL this file gained that was *not*
   * that one fails exactly as it would in any other file. A scan narrowed by excluding a path is how
   * a defect ends up outside the thing that forbids it, which this repository has recorded more than
   * once; this one cannot hide anything, because the only thing it forgives is a byte sequence
   * spelled out here.
   */
  const LICENCE_FILE = 'LICENSE';
  const APACHE_LICENCE_URL = `http:${'//'}www.apache.org/licenses/`;

  /** How many times `literal` appears in `text` that is not part of the permitted citation. */
  const fetchesIn = (name: string, text: string, literal: string): number => {
    const all = text.split(literal).length - 1;
    if (name !== LICENCE_FILE) return all;
    const cited = text.split(APACHE_LICENCE_URL).length - 1;
    return all - (APACHE_LICENCE_URL.includes(literal) ? cited : 0);
  };

  test('no file in this package carries a URL or a font host', () => {
    const files = filesBelow(PACKAGE);
    expect(files.length, 'the walk found nothing').toBeGreaterThan(1);
    for (const [name, text] of files) {
      for (const literal of NETWORK_LITERALS) {
        expect(fetchesIn(name, text, literal), `${name} names ${literal}`).toBe(0);
      }
    }
  });

  test('and the licence subtraction forgives that citation and nothing else', () => {
    // Both directions over the real file, so the clause above is a subtraction rather than a hole.
    const licence = filesBelow(PACKAGE).find(([name]) => name === LICENCE_FILE);
    expect(licence, 'the package carries no licence, so a packer will disagree about its tarball').toBeDefined();
    const text = licence?.[1] ?? '';
    expect(text, 'the licence is not the Apache one this subtraction is written for').toContain('Apache License');
    // It really does carry the needle, so the subtraction has something to subtract.
    expect(text.includes(NETWORK_LITERALS[0]), 'the licence names no URL — this subtraction has no subject').toBe(true);
    // And a URL that is not the citation is still reported, from the same file.
    const tampered = `${text}\nSee ${NETWORK_LITERALS[1]}fonts.googleapis.com/css2 for faces.\n`;
    expect(fetchesIn(LICENCE_FILE, tampered, NETWORK_LITERALS[1]), 'a second URL in the licence is forgiven').toBe(1);
    expect(fetchesIn(LICENCE_FILE, tampered, NETWORK_LITERALS[2]), 'a font host in the licence is forgiven').toBe(1);
    // The subtraction is keyed on the file name, so the same text anywhere else is reported in full.
    expect(fetchesIn('index.html', text, NETWORK_LITERALS[0]), 'the citation is forgiven outside the licence')
      .toBeGreaterThan(0);
  });

  test('the walk really covers the package rather than only its source', () => {
    // A font link belongs in `index.html` more naturally than anywhere else, so a scan that stopped
    // at `src/` would miss the likeliest place for the thing it forbids.
    expect(filesBelow(PACKAGE).map(([name]) => name)).toContain('index.html');
    expect(filesBelow(PACKAGE).map(([name]) => name)).toContain('package.json');
  });

  test('and the clause has a subject — the same needles find each shape when it is there', () => {
    // The exact thing the brief invites and this app refuses — a font link. It trips two of the
    // three needles at once, which is why both are named: a fixture asserted to trip one while
    // tripping two would be describing the scan wrongly.
    const fixture = `<link href="${NETWORK_LITERALS[1]}fonts.googleapis.com/css2" />`;
    expect(NETWORK_LITERALS.filter((literal) => fixture.includes(literal)))
      .toStrictEqual([NETWORK_LITERALS[1], NETWORK_LITERALS[2]]);
    expect(NETWORK_LITERALS.filter((literal) => `<a href="/backlog">`.includes(literal)),
      'a same-origin path trips the network scan').toStrictEqual([]);
  });

  test('Q-0017 AC-4 — the scan still has a subject now that the app fetches, and it discriminates', () => {
    // The half the title move has to be shown against: a scan whose claim narrows must be proven
    // still able to fail, or the narrowing is how the thing it forbids gets through. Both
    // directions over the module that made the old title false.
    const absolute = `const at = ${'`'}${NETWORK_LITERALS[1]}daemon.example/tickets${'`'};`;
    expect(NETWORK_LITERALS.filter((literal) => fetchesIn('src/daemon-client.ts', absolute, literal)> 0),
      'an absolute URL in the client is no longer reported').toStrictEqual([NETWORK_LITERALS[1]]);
    // …and the request this app actually makes trips nothing, which is why the property in the
    // title is the one that was always enforced.
    const sameOrigin = "const answer = await fetch('/tickets');";
    for (const literal of NETWORK_LITERALS) {
      expect(fetchesIn('src/daemon-client.ts', sameOrigin, literal), `a same-origin request trips ${literal}`).toBe(0);
    }
    // And the real module is clean under the same predicate, so the fixtures above are not standing
    // in for a file nobody looked at.
    const client = filesBelow(PACKAGE).find(([name]) => name === 'src/daemon-client.ts');
    expect(client, 'the client is not in the corpus — this clause has lost its subject').toBeDefined();
    for (const literal of NETWORK_LITERALS) {
      expect(fetchesIn('src/daemon-client.ts', client?.[1] ?? '', literal), `the client names ${literal}`).toBe(0);
    }
  });

  test('the type stack is local system faces, named in the palette', () => {
    expect(palette(), 'no sans stack is declared').toContain('--font-sans:');
    expect(palette(), 'no mono stack is declared').toContain('--font-mono:');
    expect(palette(), 'the sans stack is not the system one').toContain('system-ui');
  });

  const palette = (): string => fs.readFileSync(path.join(SOURCE, 'theme.css'), 'utf8');
});

describe('Q-0131 AC-7 — the browser\'s retention bound, and what would license moving it', () => {
  /** The module the bound lives in. Absent, this clause has lost its subject. */
  const connection = (): string => {
    const found = sourceFiles().find(([name]) => name === 'run-connection.ts')?.[1];
    if (found === undefined) throw new Error('there is no run connection — this check has lost its subject');
    return found;
  };

  /**
   * The module's text with JSDoc gutters and line breaks collapsed to single spaces.
   *
   * So that a needle is about what the comment SAYS rather than about where it happens to wrap: a
   * reflow is a legitimate edit and a guard that goes red on one is a guard a reader learns to
   * ignore, which is how a check stops being a check.
   */
  const flowed = (): string => connection().replace(/\n\s*\*\s?/g, ' ').replace(/\s+/g, ' ');

  test('the bound is 500, and its own comment says what the evidence for it is and is not', () => {
    // **Revisited and left alone, which is the criterion rather than an omission.** The ticket
    // body's instruction was to move this figure only on the datum Q-0015's verification produced
    // — and that datum, `backlog/Q-0015-*/runs.log`, records a `--dry` walk: ten events, zero
    // missed, three concurrent columns, from a run that invoked no adapter and therefore emitted no
    // `stdout`, which is where a real run's volume is. So the evidence exists, does not reach, and
    // says so itself. A later change that moves the number without a real-traffic measurement
    // fails here BY NAME rather than passing quietly, which is what a bare value pin cannot do.
    expect(connection(), 'the bound moved').toContain('RUN_EVENT_RETENTION = 500');
    const REQUIRED: [string, string][] = [
      ['the dry-walk datum', ['events 10', ' · missed 0'].join('')],
      ['that the walk was dry', ['`--dry` ', 'walk'].join('')],
      ['why a dry walk cannot answer the question', ['emits no ', '`stdout`'].join('')],
      ['that the real-traffic figure does not exist', ['cannot be recovered from run ', 'history'].join('')],
    ];
    for (const [what, needle] of REQUIRED) {
      expect(flowed().includes(needle), `the bound's comment no longer records ${what}`).toBe(true);
      // Each needle has a subject, so an assertion above is a reading rather than a predicate that
      // matches anything.
      expect(`/** ${needle} */`.includes(needle), `the needle for ${what} matches nothing`).toBe(true);
      expect('a comment that records none of this'.includes(needle),
        `the needle for ${what} matches text that does not contain it`).toBe(false);
    }
    // …and the value pin discriminates: the same reading over a moved bound reports it.
    expect('export const RUN_EVENT_RETENTION = 1000;'.includes('RUN_EVENT_RETENTION = 500'),
      'the value needle is satisfied by a bound that moved').toBe(false);
  });
});
