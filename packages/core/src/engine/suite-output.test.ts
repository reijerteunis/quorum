// Q-0053 AC-10/AC-11 — register row 7's last two clauses, which are pure functions of a string and
// are therefore tested without a repository, a worktree or an adapter. That is the whole reason
// `suite-output.ts` is a module of its own.
//
// The thirteen environment vectors are spike/test/smoke.js:504-544 ported verbatim, and the four
// report assertions are :291-302. What is NEW here is the R-6 discriminator at the bottom: nothing
// in either suite could tell the roster's regex from the detector's exclusion filter, and with both
// now in one file, unifying them is the obvious tidy-up and is a behaviour change.
import { describe, expect, test } from 'vitest';

import { environmentFailure, testReport } from './suite-output.js';

/** Everything the report says before its `## Output` section — the roster and the command. */
const rosterOf = (report: string): string => report.split('## Output')[0];

describe('Q-0053 AC-10 — a suite that could not start is not a red phase', () => {
  test('the five signatures are detected, each with its own description', () => {
    const notRed: [string, RegExp][] = [
      ["node:internal/modules/esm/resolve:264\nError: Cannot find package 'yaml' imported from /x/bin.js", /missing dependency "yaml"/],
      ["Error: Cannot find module './nope.js'", /missing module "\.\/nope\.js"/],
      ["code: 'ERR_MODULE_NOT_FOUND'", /could not be resolved/],
      ["/x/test.js:12\nSyntaxError: Unexpected token '||'", /does not parse/],
      ['sh: vitest: command not found', /not installed/],
    ];
    for (const [out, expected] of notRed) {
      const described = environmentFailure(out);
      expect(described, out.split('\n').at(-1)).not.toBeNull();
      expect(described, out.split('\n').at(-1)).toMatch(expected);
    }
  });

  test('a genuine failing suite is still red, npm\'s own noise included', () => {
    // The half that matters more: a detector that is too eager throws away real red phases, which is
    // why `npm ERR!` is not a signature — npm prints it for every ordinary test failure.
    const realRed = [
      'AssertionError [ERR_ASSERTION]: expected stage to be red\n  at Object.<anonymous>\n✗ 3 of 71 checks failed',
      '✗ init\nnpm ERR! Test failed.  See above for more details.',
      'FAIL test/review.test.js\n  ● review flow › regresses the stage\n    expect(received).toBe(expected)',
    ];
    for (const out of realRed) expect(environmentFailure(out), out.split('\n')[0]).toBeNull();
  });

  test('a signature quoted inside a line that reports a result is ignored', () => {
    // Q-0004 run 6: a suite asserting "a broken environment is not a red phase" prints that
    // signature in its own PASS message, the detector matched it, and a genuine red phase was
    // thrown away. A line reporting a result is proof the suite ran, so it cannot also be proof it
    // never started.
    const inResultLines = [
      "✓ a broken environment is not a red phase: Error: Cannot find package 'yaml' imported from /x/bin.js",
      "\x1b[32m✓\x1b[0m handled: Cannot find module './nope.js'",
      'ok 4 - reports ERR_MODULE_NOT_FOUND',
      "1) rejects SyntaxError: Unexpected token '||'",
    ];
    for (const line of inResultLines) {
      expect(environmentFailure(`✓ setup\n${line}\n✓ done`), line.replace(/\x1b\[[0-9;]*m/g, '')).toBeNull();
    }
  });

  test('the same signature on a line of its own is still caught, after checks have passed', () => {
    expect(environmentFailure("✓ setup\nnode:internal/modules/esm/resolve\nError: Cannot find package 'yaml' imported from /x/bin.js"))
      .not.toBeNull();
  });

  test('nothing at all, and an empty string, are not environment failures', () => {
    expect(environmentFailure()).toBeNull();
    expect(environmentFailure('')).toBeNull();
  });
});

describe('Q-0053 AC-10 / R-6 — the roster\'s regex and the detector\'s filter are three ways different', () => {
  // Neither candidate named this and none of the thirteen vectors above tells the two apart: the one
  // `FAIL` vector carries no signature, so it answers `null` under either regex. Each row below
  // asserts BOTH sides — what the detector answers and what the roster keeps — so unifying the two
  // constants in either direction turns one of them red. Without these, sharing one regex is green
  // over the whole suite and quietly changes what counts as a red phase.

  test('PASS/FAIL/SKIP is in the roster and NOT in the detector\'s filter', () => {
    // The consequence R-6 names: a vitest file header that also carries a crash is an environment
    // failure. It stops being one the moment the detector borrows RESULT_LINE.
    const line = "FAIL test/x.test.js — Cannot find module 'y'";
    expect(environmentFailure(line)).toBe('missing module "y"');
    expect(rosterOf(testReport('npm test', line))).toContain(line);
  });

  test('the detector\'s `#` needs no following space and the roster\'s does', () => {
    // `#42 …` is excluded by the detector (its `#` is bare) and is not a result line to the roster
    // (which requires `#` then whitespace). Under one shared regex the detector would keep the line
    // and report a crash that a TAP comment merely mentioned.
    const line = "#42 Cannot find package 'z'";
    expect(environmentFailure(line)).toBeNull();
    expect(rosterOf(testReport('npm test', line))).not.toContain(line);
  });

  test('the detector strips ANSI before filtering and the roster matches it inline', () => {
    // `ok\x1b[0m 1 - …`: the escape sits BETWEEN the marker and the space, so the roster's inline
    // form — which only tolerates colour before the marker — does not match, while the detector,
    // which strips colour everywhere first, excludes the line. Both answers flip under unification.
    const line = "ok\x1b[0m 1 - reports Cannot find module 'y'";
    expect(environmentFailure(line)).toBeNull();
    expect(rosterOf(testReport('npm test', line))).not.toContain(line);
  });
});

describe('Q-0053 AC-11 — the report keeps every result line whole, whatever it truncates', () => {
  test('a result line at either end survives a body far past the cut', () => {
    // spike/test/smoke.js:291-302. The previous shape kept the last 8,000 characters, so on Q-0033
    // seven of nineteen failing groups had no line in the report at all.
    const big = ['✓ first check', ...Array.from({ length: 900 }, (_, i) => `  noise line ${i} ${'x'.repeat(60)}`), '✗ last check'].join('\n');
    const report = testReport('npm test', big);

    expect(report).toContain('✓ first check');
    expect(report).toContain('✗ last check');
    expect(report).toMatch(/characters of output omitted from the middle/);
    expect(report).toContain('`npm test`');
  });

  test('output with no result lines says so rather than looking empty', () => {
    expect(testReport('sh -c true', 'no results here\njust prose\n'))
      .toMatch(/No lines in the output looked like test results/);
  });

  test('a result line in the OMITTED middle is still in the roster', () => {
    // The cell that discriminates a roster built from the full output from one built from the
    // retained body. Every assertion above is satisfied by the second, because the head and the tail
    // are both retained; this one is not.
    const filler = Array.from({ length: 300 }, (_, i) => `noise ${i} ${'x'.repeat(200)}`);
    const body = ['✓ first', ...filler.slice(0, 150), '✓ the middle check', ...filler.slice(150), '✗ last'].join('\n');
    expect(body.length).toBeGreaterThan(24000);

    const report = testReport('npm test', body);
    const [roster, output] = [rosterOf(report), report.split('## Output')[1]];

    expect(output, 'the fixture must actually put the middle check inside the cut').not.toContain('✓ the middle check');
    expect(roster).toContain('✓ the middle check');
    expect(roster).toContain('✓ first');
    expect(roster).toContain('✗ last');
  });

  test('the omission marker names how many characters went, and the cut is in the middle', () => {
    const body = 'a'.repeat(30000);
    const report = testReport('npm test', body, { maxBytes: 24000 });
    expect(report).toContain('… 6000 characters of output omitted from the middle …');
  });

  test('a body at the cap is kept whole', () => {
    const body = 'b'.repeat(100);
    expect(testReport('npm test', body, { maxBytes: 100 })).toContain(body);
    expect(testReport('npm test', body, { maxBytes: 100 })).not.toContain('omitted from the middle');
  });

  test('no command resolved still produces a report rather than a crash', () => {
    // `runIntegrate` passes `cmd` through unguarded, and it is `null` whenever `run_tests` is falsy.
    expect(testReport(null, '✓ one')).toContain('`null`');
  });
});
