/**
 * What a test suite's output means, as two pure functions of a string: the report a reviewer is
 * given, and whether the suite it came from ever started at all.
 *
 * **This module imports nothing** — no `node:` builtin, no sibling module, not `@quorum/shared`.
 * That is the property rather than an accident of its size. Both functions decide whether a red
 * phase can be believed, and the one time the detector below was beaten it was beaten by *output*,
 * so nothing here may reach for a file, a command or a repository to make up its mind. It is also
 * what lets every case be exercised without a repository, a worktree or an adapter.
 *
 * Why: behaviour preserved from spike/src/engine.js — harness/port-charter.md §2, Q-0053.
 */

/**
 * A line that reports a test result, in the vocabularies the suites this orchestrates produce: a
 * tick or a cross, TAP's `ok`/`not ok`/`#`, a numbered failure, and a vitest or jest file header.
 *
 * Leading colour is matched inline rather than stripped, because {@link testReport} keeps each
 * matched line verbatim — a roster is only useful if it reproduces what the suite printed.
 */
const RESULT_LINE = /^\s*(?:\x1b\[[0-9;]*m)*\s*(?:[✓✗×√]|(?:not )?ok\s|#\s|\d+\)\s|(?:PASS|FAIL|SKIP)\b)/;

/**
 * Signatures of a suite that could not start, as opposed to one that ran and failed, each with the
 * sentence it is described by.
 *
 * Deliberately narrow. `npm ERR!` is not here and must not be added: npm prints it for every
 * ordinary test failure, and a false positive rejects a legitimate red phase.
 */
const ENV_FAILURES: ReadonlyArray<readonly [RegExp, (match: RegExpExecArray) => string]> = [
  [/Cannot find package '([^']+)'/, (m) => `missing dependency "${m[1]}"`],
  [/Cannot find module '([^']+)'/, (m) => `missing module "${m[1]}"`],
  [/ERR_MODULE_NOT_FOUND/, () => 'a module could not be resolved'],
  [/\bSyntaxError:\s*(.+)/, (m) => `the test file does not parse (${m[1].trim().slice(0, 80)})`],
  [/: command not found/, () => 'the test command is not installed'],
  [/ERR_REQUIRE_ESM/, () => 'a module was loaded with the wrong module system'],
];

/** What {@link testReport} accepts beyond the command and its output. */
export interface TestReportOptions {
  /** How much of the output survives whole. Beyond it, the middle is cut and the cut is named. */
  maxBytes?: number;
}

/**
 * The report a reviewer judges a red or green phase from: the command, every result line, and the
 * output itself with only its middle truncated.
 *
 * The roster is the point and the byte count is not. The report used to be the last 8,000
 * characters, which cuts off the head — on Q-0033 seven of nineteen failing groups had no line in
 * it at all, so the reviewer never saw them. Every line matching {@link RESULT_LINE} is therefore
 * collected from the **full** output, whole and in source order, whatever the body loses.
 *
 * @param cmd the command that produced `out`, or `null` where no command was resolved.
 * @param out everything the command wrote, both streams, exactly as it wrote it.
 * @returns a markdown document; it is what the next agent's prompt carries.
 */
export function testReport(cmd: string | null, out: string, { maxBytes = 24000 }: TestReportOptions = {}): string {
  const body = out;
  const results = body.split('\n').filter((line) => RESULT_LINE.test(line));
  const kept = body.length <= maxBytes
    ? body
    : `${body.slice(0, maxBytes / 2)}\n\n… ${body.length - maxBytes} characters of output omitted from the middle …\n\n${body.slice(-maxBytes / 2)}`;
  const roster = results.length
    ? `\n## Every result line\n\n\`\`\`\n${results.join('\n')}\n\`\`\`\n`
    : '\n_No lines in the output looked like test results._\n';
  return `# Test output\n\n\`${cmd}\`\n${roster}\n## Output\n\n\`\`\`\n${kept}\n\`\`\`\n`;
}

/**
 * Why the suite never started, or `null` when nothing says it did not.
 *
 * Only unhandled output counts. A suite is entitled to *print* these signatures — a test asserting
 * that a broken environment is not a red phase names one in its own pass message, and matching that
 * threw away a genuine red phase (Q-0004, run 6). A line reporting a test result is proof the suite
 * ran, so it cannot also be proof it never started, and every such line is dropped before the
 * signatures are looked for.
 *
 * @param out everything the command wrote.
 * @returns the first matching signature's description, or `null`.
 */
export function environmentFailure(out = ''): string | null {
  const text = out
    .split('\n')
    // Colour codes hide the leading marker, so they go first and everywhere, not only at the start.
    .map((line) => line.replace(/\x1b\[[0-9;]*m/g, ''))
    // Why: preserved behaviour, see Q-0053 AC-10 — this is NOT RESULT_LINE and must not be replaced
    // by it. It carries no PASS/FAIL/SKIP, its `#` needs no following space, and it runs over text
    // ANSI has already been stripped from. All three differences change what counts as a red phase.
    .filter((line) => !/^\s*(?:[✓✗×√]|(?:not )?ok\s|#|\d+\)\s)/.test(line))
    .join('\n');
  for (const [pattern, describe] of ENV_FAILURES) {
    const match = pattern.exec(text);
    if (match) return describe(match);
  }
  return null;
}
