/**
 * Q-0094 AC-4 to AC-8 and AC-11(5) — the gate reader: the queue, the TTY test, the readline handle,
 * the correlated envelope, and the five ways a gate ends without a decision.
 *
 * **The three sites that need a terminal are written here for the first time.** The spike reaches
 * them only by spawning the binary under a `--import` preload that sets `process.stdin.isTTY`, and
 * `q0033-surface.js` gives up on the third entirely — `skipped('S10.5', 'requires an interactive TTY
 * to prove empty-line rejection')`. The reader takes its input stream, its output stream and its TTY
 * predicate as parameters, so a fixture supplies all three and no test mutates the real
 * `process.stdin` inside a Vitest worker.
 *
 * **Ordering is asserted over one buffer.** At a real terminal the banner and the prompt land on the
 * same file descriptor, so the fixture routes `console.log` and the reader's output stream into one
 * array: the claim is that the reader speaks *after* the banner even though `askGate` calls it
 * before the consumer can render, and two separate sinks could not show it.
 *
 * **What is asserted through `runFlow` rather than through the reader alone** is the classification:
 * the engine decides `undecided` on `instanceof GateUnansweredError` and on nothing else, so a
 * reader declaring its own error of that name — or wrapping the throw — would produce a `failed`
 * run and a rollback while every message assertion still passed (R-4).
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough, Writable } from 'node:stream';

import { FlowError, GateUnansweredError, loadFlowByName, loadProject, overrideAdapters, runFlow } from '@quorum/core';
import { gateAnswerEnvelopeSchema, type GateAnswerEnvelope, type GateQuestionEvent } from '@quorum/shared';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { parseArgv } from './argv.js';
import { ERROR, SIGNAL, SUCCESS, UNDECIDED } from './exit.js';
import { createGateReader, type AnswerGate } from './gate.js';
import { runOn } from './run.js';
import { renderEvent } from './trace.js';
import { capture, invoke, plain } from '../test/invoke.js';

/** The byte a terminal sends for Ctrl-C, which readline turns into its own `SIGINT` event. */
const CTRL_C = String.fromCharCode(3);

let sandbox = '';

beforeEach(() => {
  sandbox = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'quorum-cli-gate-')));
});

afterEach(() => {
  vi.unstubAllEnvs();
  fs.rmSync(sandbox, { recursive: true, force: true });
});

const git = (dir: string, ...args: string[]): string =>
  execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

/** A scaffolded project with one `draft` ticket, built through this package's own two commands. */
async function project(name = 'project'): Promise<string> {
  const dir = path.join(sandbox, name);
  fs.mkdirSync(dir, { recursive: true });
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, '-c', 'user.email=q@a', '-c', 'user.name=qa', 'commit', '-q', '--allow-empty', '-m', 'init');
  expect((await invoke(['init', dir])).exitCode).toBe(SUCCESS);
  expect((await invoke(['ticket', 'new', 'Gate sites', '--project', dir])).exitCode).toBe(SUCCESS);
  return dir;
}

/** One question, as `routing.ts:80–84` builds it. `retry` present means the gate offers one. */
const question = (over: Partial<GateQuestionEvent> = {}): GateQuestionEvent => ({
  type: 'gate', gateId: '1:1', kind: 'human', reason: 'PM owner approves', ticketDir: '/t', ...over,
});

/**
 * A terminal this test owns: one buffer, an input stream, and an output stream.
 *
 * `console.log` is routed into the same array as the output stream, because at a real terminal both
 * are one file descriptor and the ordering between them is what AC-4 claims. `tty` puts readline
 * into its own terminal mode, which is what makes Ctrl-C reach `rl.on('SIGINT')` — the mode is
 * derived from `output.isTTY`, a value this fixture sets rather than reads.
 */
function terminal(options: { tty?: boolean } = {}): {
  lines: string[];
  input: PassThrough;
  output: Writable;
  text: () => string;
  restore: () => void;
} {
  const lines: string[] = [];
  const input = new PassThrough();
  const output = new Writable({
    write(chunk: unknown, _encoding: unknown, done: () => void) {
      lines.push(String(chunk));
      done();
    },
  }) as Writable & { isTTY?: boolean; columns?: number };
  if (options.tty) {
    output.isTTY = true;
    output.columns = 80;
  }
  const saved = console.log;
  console.log = (line: unknown): void => { lines.push(`${String(line)}\n`); };
  return { lines, input, output, text: () => plain(lines.join('')), restore: () => { console.log = saved; } };
}

/** How many listeners readline has on an input stream, so a leaked handle is visible. */
const attached = (input: PassThrough): number =>
  input.listenerCount('data') + input.listenerCount('keypress') + input.listenerCount('end');

describe('AC-4 — the banner is the renderer\'s and the reader speaks only after it', () => {
  test('the echo follows the banner even though answerGate is called before it', async () => {
    // The ordering `askGate` makes non-obvious: it emits the question and calls `answerGate`
    // synchronously, so without the rendezvous the prompt reaches the terminal first and the banner
    // lands underneath the answer to it.
    const io = terminal();
    try {
      const reader = createGateReader({ answers: ['advance'], input: io.input, output: io.output, isTTY: () => false });
      const asked = question();
      const pending = reader.answerGate(asked);
      renderEvent(asked, false);
      reader.announce(asked.gateId);
      expect(await pending).toStrictEqual({ gateId: '1:1', answer: 'advance' });
    } finally {
      io.restore();
    }
    expect(io.text()).toBe([
      '', '■ GATE (human) PM owner approves', '  inspect: /t',
      '  advance / abort > advance  (from --gate-answer)', '',
    ].join('\n'));
  });

  test('and the reader prints no banner of its own, whichever order the two arrive in', async () => {
    // Order-independent on purpose: today `askGate` always calls `answerGate` first, and pinning the
    // reader to that would make a correct engine change look like a hang. Announced first here, and
    // the reader still contributes exactly one line.
    const io = terminal();
    try {
      const reader = createGateReader({ answers: ['abort'], input: io.input, output: io.output, isTTY: () => false });
      reader.announce('1:1');
      expect(await reader.answerGate(question())).toStrictEqual({ gateId: '1:1', answer: 'abort' });
    } finally {
      io.restore();
    }
    expect(io.text()).toBe('  advance / abort > abort  (from --gate-answer)\n');
    expect(io.text(), 'the reader printed the banner too').not.toContain('GATE');
  });
});

describe('AC-5 — the scripted queue is exact, ordered and consumed once', () => {
  const reader = (answers: readonly (string | true)[], io: ReturnType<typeof terminal>): ReturnType<typeof createGateReader> => {
    const built = createGateReader({ answers, input: io.input, output: io.output, isTTY: () => false });
    for (const id of ['1:1', '1:2', '1:3']) built.announce(id);
    return built;
  };

  test('a gate offering retry accepts all three words and one that does not accepts two', async () => {
    const io = terminal();
    try {
      const built = reader(['retry', 'advance'], io);
      expect(await built.answerGate(question({ gateId: '1:1', retry: 'head-of-product' })))
        .toStrictEqual({ gateId: '1:1', answer: 'retry' });
      expect(await built.answerGate(question({ gateId: '1:2' })))
        .toStrictEqual({ gateId: '1:2', answer: 'advance' });
    } finally {
      io.restore();
    }
    expect(io.text()).toContain('advance / retry / abort > retry');
    expect(io.text()).toContain('advance / abort > advance');
  });

  test('`retry` is refused at a gate that does not offer one, and the message names the two it does', async () => {
    const io = terminal();
    try {
      await expect(reader(['retry'], io).answerGate(question()))
        .rejects.toThrow('received --gate-answer "retry" — expected exactly one of: advance / abort (no abbreviations)');
    } finally {
      io.restore();
    }
  });

  test('the comparison is exact after trim and lower-case, and nothing else', async () => {
    const io = terminal();
    try {
      const built = reader(['  ADVANCE  '], io);
      expect(await built.answerGate(question())).toStrictEqual({ gateId: '1:1', answer: 'advance' });
    } finally {
      io.restore();
    }
    expect(io.text(), 'the echo prints the normalised word, not what was typed')
      .toContain('advance / abort > advance  (from --gate-answer)');
  });

  test('AC-5(4) — a word wrong for this gate is an error and the next queued answer is untouched', async () => {
    // The queue does not advance past it. Asserted by asking the SAME reader again afterwards: if
    // the invalid word had fallen through, `abort` would already have been spent on the first gate.
    const io = terminal();
    try {
      const built = reader(['ad', 'abort'], io);
      await expect(built.answerGate(question({ gateId: '1:1' }))).rejects.toThrow('expected exactly one of');
      expect(await built.answerGate(question({ gateId: '1:2' })))
        .toStrictEqual({ gateId: '1:2', answer: 'abort' });
    } finally {
      io.restore();
    }
  });

  test('the refusal is a FlowError and never the type that would make the run undecided', async () => {
    const io = terminal();
    try {
      const error = await reader(['nope'], io).answerGate(question()).catch((thrown: unknown) => thrown);
      expect(error).toBeInstanceOf(FlowError);
      expect(error, 'an operator error was classified as nobody being there')
        .not.toBeInstanceOf(GateUnansweredError);
    } finally {
      io.restore();
    }
  });
});

describe('AC-6 — answers exhausted with no terminal is undecided, and the class is the engine\'s', () => {
  test('the throw is `@quorum/core`\'s own class, carrying the condition and the spike\'s sentence', async () => {
    const io = terminal();
    try {
      const built = createGateReader({ answers: [], input: io.input, output: io.output, isTTY: () => false });
      built.announce('1:1');
      const error = await built.answerGate(question({ retry: 'head-of-product' }))
        .catch((thrown: unknown) => thrown);
      expect(error).toBeInstanceOf(GateUnansweredError);
      expect((error as GateUnansweredError).gate)
        .toStrictEqual({ kind: 'human', reason: 'PM owner approves', condition: 'answers-exhausted' });
      expect((error as Error).message).toBe(
        'gate (human) "PM owner approves" needs an answer and stdin closed without one'
        + ' — pass --gate-answer advance|retry|abort (repeatable, consumed in order), or run interactively',
      );
    } finally {
      io.restore();
    }
  });

  test('and a gate offering no retry names the two words it does accept', async () => {
    const io = terminal();
    try {
      const built = createGateReader({ answers: [], input: io.input, output: io.output, isTTY: () => false });
      built.announce('1:1');
      await expect(built.answerGate(question())).rejects.toThrow('pass --gate-answer advance|abort');
    } finally {
      io.restore();
    }
  });

  test('AC-6(3) — stdin is not read on that path, even with an answer sitting on it', async () => {
    // S10.4 at the reader: the input stream carries `advance\n` and the TTY predicate says nobody is
    // there, so the reader must refuse rather than fall back to whatever happens to be piped.
    const io = terminal();
    io.input.write('advance\n');
    try {
      const built = createGateReader({ answers: [], input: io.input, output: io.output, isTTY: () => false });
      built.announce('1:1');
      await expect(built.answerGate(question())).rejects.toBeInstanceOf(GateUnansweredError);
    } finally {
      io.restore();
    }
    expect(io.text(), 'the reader prompted a stream nobody was reading').toBe('');
    expect(attached(io.input), 'a readline handle was opened on a non-terminal').toBe(0);
  });

  test('AC-6(2) — the classification is by type, not by the words', async () => {
    // The discriminating pair, run through `runFlow` because the classification is the engine's: an
    // empty message of the right TYPE is `undecided`, and AC-6's verbatim sentence thrown as a plain
    // `FlowError` is `failed`. A reader that wrapped its throw, or declared its own class of the
    // same name, would pass every message assertion above and fail here.
    vi.stubEnv('MOCK_ALWAYS_PASS', '1');
    const dir = await project();
    const empty = await runProbe(dir, (asked) => Promise.reject(new GateUnansweredError('', {
      kind: asked.kind, reason: asked.reason, condition: 'stdin-closed',
    })));
    expect(empty.status).toBe('undecided');
    expect(empty.error, 'an undecided run propagated its failure').toBeNull();

    const verbatim = await runProbe(dir, (asked) => Promise.reject(new FlowError(
      `gate (${asked.kind}) "${asked.reason}" needs an answer and stdin closed without one`
      + ' — pass --gate-answer advance|abort (repeatable, consumed in order), or run interactively',
    )));
    expect(verbatim.status, 'the same words classified by their text').toBe('failed');
  });
});

describe('AC-8 — the answer travels back as a correlated envelope', () => {
  test('the reader returns the question\'s own id beside the word, and the envelope validates', async () => {
    const io = terminal();
    let envelope: GateAnswerEnvelope;
    try {
      const built = createGateReader({ answers: ['advance'], input: io.input, output: io.output, isTTY: () => false });
      built.announce('7:3');
      envelope = await built.answerGate(question({ gateId: '7:3' }));
    } finally {
      io.restore();
    }
    expect(envelope).toStrictEqual({ gateId: '7:3', answer: 'advance' });
    expect(gateAnswerEnvelopeSchema.safeParse(envelope).success).toBe(true);
    // The two failures one line apart in `routing.ts:41–47`, shown not to happen: a bare word fails
    // the schema, and a synthesised id fails the correlation check. Both are `FlowError`s, so both
    // would present as an operator error the operator did not make.
    expect(gateAnswerEnvelopeSchema.safeParse('advance').success, 'a bare word is a valid envelope')
      .toBe(false);
  });

  test('and each of the two failures is what a run gets when the envelope is wrong', async () => {
    vi.stubEnv('MOCK_ALWAYS_PASS', '1');
    const dir = await project();
    const bare = await runProbe(dir, () => Promise.resolve('advance' as unknown as GateAnswerEnvelope));
    expect((bare.error as Error).message).toMatch(/received an invalid answer/);
    const stale = await runProbe(dir, () => Promise.resolve({ gateId: '9:9', answer: 'advance' as const }));
    expect((stale.error as Error).message).toMatch(/received stale answer for 9:9/);
  });
});

describe('AC-7 — the interactive reader: readline, abbreviations, and a handle that always closes', () => {
  /** Write `keys` at the prompt, once the reader has actually asked for them. */
  const answerWhenPrompted = (io: ReturnType<typeof terminal>, keys: string | null): void => {
    const wait = (): void => {
      if (io.text().includes('> ')) {
        if (keys === null) io.input.end();
        else io.input.write(keys);
        return;
      }
      setTimeout(wait, 5);
    };
    setTimeout(wait, 5);
  };

  const ask = async (
    keys: string | null,
    over: Partial<GateQuestionEvent> = {},
    options: { tty?: boolean } = {},
  ): Promise<{ result: unknown; io: ReturnType<typeof terminal> }> => {
    const io = terminal(options);
    try {
      const built = createGateReader({ answers: [], input: io.input, output: io.output, isTTY: () => true });
      built.announce(over.gateId ?? '1:1');
      answerWhenPrompted(io, keys);
      const result = await built.answerGate(question(over)).catch((thrown: unknown) => thrown);
      return { result, io };
    } finally {
      io.restore();
    }
  };

  test('AC-7(1)/(3) — the prompt is the spike\'s and an abbreviation is matched by prefix', async () => {
    const { result, io } = await ask('ad\n');
    expect(result).toStrictEqual({ gateId: '1:1', answer: 'advance' });
    expect(io.text()).toContain('  advance / abort > ');
    expect(attached(io.input), 'the handle outlived the answer').toBe(0);
  });

  test('`r` is `retry` only where the question offers one, and `ab` is always abort', async () => {
    expect((await ask('r\n', { retry: 'head-of-product' })).result)
      .toStrictEqual({ gateId: '1:1', answer: 'retry' });
    // At a gate offering no retry, `r` matches none of the three prefixes and is not understood —
    // rather than silently becoming one of the two words the gate does accept.
    expect((await ask('r\n')).result).toBeInstanceOf(FlowError);
    expect(((await ask('r\n')).result as Error).message).toContain('did not understand "r"');
    expect((await ask('AB\n')).result).toStrictEqual({ gateId: '1:1', answer: 'abort' });
  });

  test('S10.5 — an empty line is refused rather than assumed, and the handle is closed', async () => {
    // Written here for the first time: the spike marks this `skipped('S10.5')` for want of a TTY.
    const { result, io } = await ask('\n');
    expect(result).toBeInstanceOf(FlowError);
    expect(result).not.toBeInstanceOf(GateUnansweredError);
    expect((result as Error).message).toBe(
      'gate (human) "PM owner approves" was given an empty answer'
      + ' — say advance, retry or abort; a gate is never assumed',
    );
    expect(attached(io.input), 'the handle outlived the refusal').toBe(0);
  });

  test('AC-7(5) — an answer the reader does not understand names it as it was typed', async () => {
    const { result, io } = await ask('  ZzZ  \n');
    expect((result as Error).message).toBe(
      'gate (human) "PM owner approves" did not understand "ZzZ" — expected advance / abort',
    );
    expect(result, 'an operator error was classified as nobody being there')
      .not.toBeInstanceOf(GateUnansweredError);
    expect(attached(io.input), 'the handle outlived the refusal').toBe(0);
  });

  test('AC-7(6) — stdin closing while the question is open is undecided, with its own sentence', async () => {
    const { result } = await ask(null);
    expect(result).toBeInstanceOf(GateUnansweredError);
    expect((result as GateUnansweredError).gate.condition).toBe('stdin-closed');
    expect((result as Error).message).toBe(
      'gate (human) "PM owner approves" needs an answer and stdin closed without one'
      + ' — run it interactively, or answer it on stdin',
    );
    // A different sentence from AC-6's, and the two must stay different: which one a maintainer
    // reads is what tells them whether to pass a flag or open a terminal.
    expect((result as Error).message).not.toContain('pass --gate-answer');
  });

  test('AC-7(7) — a signal already aborted keeps no handle, and settles nothing either way', async () => {
    // An `AbortSignal` fires no event for a listener added after the fact, so the already-aborted
    // case needs its own branch — and a branch with no subject is the defect this repository
    // records most. Settling is what it must not do: the run is about to be classified by the
    // abort, so an answer here would race it and a `stdin-closed` rejection would call a
    // deliberate interrupt *nobody was there*.
    const io = terminal();
    try {
      const cancelled = new AbortController();
      cancelled.abort('received SIGTERM');
      const built = createGateReader({
        answers: [], input: io.input, output: io.output, isTTY: () => true, signal: cancelled.signal,
      });
      built.announce('1:1');
      const settled = built.answerGate(question()).then(() => 'settled', () => 'settled');
      const outcome = await Promise.race([
        settled,
        new Promise((resolve) => setTimeout(() => resolve('pending'), 50)),
      ]);
      expect(outcome, 'the reader answered a gate the run had already been cancelled at').toBe('pending');
      expect(attached(io.input), 'the handle outlived a reader that never asked').toBe(0);
    } finally {
      io.restore();
    }
  });

  test('AC-7(7) — two gates in one reader leave no handle behind', async () => {
    const io = terminal();
    try {
      const built = createGateReader({ answers: [], input: io.input, output: io.output, isTTY: () => true });
      built.announce('1:1');
      built.announce('1:2');
      answerWhenPrompted(io, 'advance\n');
      expect(await built.answerGate(question({ gateId: '1:1' }))).toStrictEqual({ gateId: '1:1', answer: 'advance' });
      expect(attached(io.input)).toBe(0);
      answerWhenPrompted(io, 'abort\n');
      expect(await built.answerGate(question({ gateId: '1:2' }))).toStrictEqual({ gateId: '1:2', answer: 'abort' });
      expect(attached(io.input)).toBe(0);
    } finally {
      io.restore();
    }
  });
});

describe('AC-7 and AC-11(5) — the terminal sites reached through a whole run', () => {
  /** Run `quorum run` against a terminal this test owns, and report what a shell would have seen. */
  const runAtTerminal = async (
    dir: string,
    io: ReturnType<typeof terminal>,
    ...extra: string[]
  ): Promise<{ exitCode: number; stdout: string; stderr: string }> => capture(() => runOn({
    input: io.input, output: io.output, isTTY: () => true,
  })(parseArgv(['run', 'requirements', 'T-0001', '--project', dir, '--adapter', 'mock', ...extra])));

  /** Write `keys` once the prompt has appeared on the terminal's own stream. */
  const atPrompt = (io: ReturnType<typeof terminal>, act: () => void): void => {
    const wait = (): void => {
      if (io.text().includes('> ')) {
        act();
        return;
      }
      setTimeout(wait, 5);
    };
    setTimeout(wait, 5);
  };

  test('a typed answer advances the run, and the banner is on the terminal above the prompt', async () => {
    vi.stubEnv('MOCK_ALWAYS_PASS', '1');
    const dir = await project();
    const io = terminal();
    let result;
    try {
      atPrompt(io, () => io.input.write('advance\n'));
      result = await runAtTerminal(dir, io);
    } finally {
      io.restore();
    }
    expect(result.exitCode, io.text()).toBe(SUCCESS);
    expect(io.text()).toContain('  advance / abort > ');
  });

  test('AC-11(2) — while a run is parked at its gate, one SIGINT and one SIGTERM listener are installed', async () => {
    // The positive half of AC-11(1), which counting before and after cannot make: a run that
    // installed neither would leave the counts unchanged too. Sampled at the prompt, which is the
    // one moment a test can observe the handlers of a run that has not finished.
    vi.stubEnv('MOCK_ALWAYS_PASS', '1');
    const dir = await project();
    const io = terminal();
    const count = (): Record<string, number> =>
      ({ SIGINT: process.listenerCount('SIGINT'), SIGTERM: process.listenerCount('SIGTERM') });
    const before = count();
    let during: Record<string, number> | undefined;
    try {
      atPrompt(io, () => {
        during = count();
        io.input.write('advance\n');
      });
      expect((await runAtTerminal(dir, io)).exitCode, io.text()).toBe(SUCCESS);
    } finally {
      io.restore();
    }
    expect(during, 'the run never reached its gate').toBeDefined();
    expect(during).toStrictEqual({ SIGINT: before.SIGINT + 1, SIGTERM: before.SIGTERM + 1 });
    expect(count(), 'the run kept its handlers after it ended').toStrictEqual(before);
  });

  test(':115 — an empty answer at a terminal is an operator error: exit 1, and no rollback claim', async () => {
    vi.stubEnv('MOCK_ALWAYS_PASS', '1');
    const dir = await project();
    const io = terminal();
    let result;
    try {
      atPrompt(io, () => io.input.write('\n'));
      result = await runAtTerminal(dir, io);
    } finally {
      io.restore();
    }
    expect(result.exitCode, io.text()).toBe(ERROR);
    expect(plain(result.stderr)).toContain('was given an empty answer');
  });

  test(':119 — an answer the reader does not understand is exit 1 and names what was typed', async () => {
    vi.stubEnv('MOCK_ALWAYS_PASS', '1');
    const dir = await project();
    const io = terminal();
    let result;
    try {
      atPrompt(io, () => io.input.write('zzz\n'));
      result = await runAtTerminal(dir, io);
    } finally {
      io.restore();
    }
    expect(result.exitCode, io.text()).toBe(ERROR);
    expect(plain(result.stderr)).toContain('did not understand "zzz"');
  });

  test(':110 — stdin closing mid-question ends the run undecided and exits 3', async () => {
    vi.stubEnv('MOCK_ALWAYS_PASS', '1');
    const dir = await project();
    const io = terminal();
    let result;
    try {
      atPrompt(io, () => io.input.end());
      result = await runAtTerminal(dir, io);
    } finally {
      io.restore();
    }
    expect(result.exitCode, io.text()).toBe(UNDECIDED);
    expect(plain(result.stdout)).toContain('run it interactively, or answer it on stdin');
    expect(plain(result.stdout)).toContain('nothing was rolled back');
  });

  test('AC-7(7) — an interrupt readline never sees still closes the handle, and is not undecided', async () => {
    // SIGTERM is the path readline has no event for: `rl.on('SIGINT')` never fires, so the only
    // thing that reaches the reader is the abort. Without a cue from it the handle stays open on a
    // question nobody will ever answer — leaked past the end of the run, which AC-7(7) forbids and
    // which an in-process invocation makes visible, `process.exit` being a throw here.
    vi.stubEnv('MOCK_ALWAYS_PASS', '1');
    const dir = await project();
    const io = terminal();
    let result;
    try {
      atPrompt(io, () => process.kill(process.pid, 'SIGTERM'));
      result = await runAtTerminal(dir, io);
    } finally {
      io.restore();
    }
    expect(result.exitCode, io.text()).toBe(SIGNAL);
    expect(result.exitCode, 'a deliberate interrupt was recorded as nobody being there').not.toBe(UNDECIDED);
    expect(attached(io.input), 'the readline handle outlived the run it was opened for').toBe(0);
  });

  test('AC-11(5) — Ctrl-C at an interactive gate ends the run interrupted and exits 130', async () => {
    // R-1, and the one defect this ticket can introduce that the spike could not: `rl.close()` and
    // the re-raised signal are two asynchronous paths to one outcome, and if the readline `close`
    // rejection wins, a maintainer's deliberate interrupt is recorded as *nobody was there* —
    // inverting the distinction Q-0040 exists to draw. Asserted by outcome, because it is invisible
    // to reading.
    vi.stubEnv('MOCK_ALWAYS_PASS', '1');
    const dir = await project();
    const io = terminal({ tty: true });
    let result;
    try {
      atPrompt(io, () => io.input.write(CTRL_C));
      result = await runAtTerminal(dir, io);
    } finally {
      io.restore();
    }
    expect(result.exitCode, io.text()).toBe(SIGNAL);
    expect(result.exitCode, 'a deliberate interrupt was recorded as nobody being there').not.toBe(UNDECIDED);
    const log = fs.readFileSync(
      path.join(dir, 'backlog',
        fs.readdirSync(path.join(dir, 'backlog')).find((entry) => entry.startsWith('T-0001')) ?? '',
        'runs.log'),
      'utf8',
    );
    expect(log, 'the run recorded something other than the interrupt').toMatch(/interrupted .*error="received SIGINT"/);
  });
});

/**
 * One run of the shipped requirements flow with an `answerGate` this test supplies.
 *
 * The engine's own classification is what several claims above are about, and it is reachable only
 * by driving `runFlow` — `runOn` takes streams and not a reader, correctly: a command that let its
 * caller replace the gate reader would be a command with a hole in it.
 */
async function runProbe(dir: string, answerGate: AnswerGate): Promise<{ status?: string; error: unknown }> {
  const opened = loadProject(dir);
  const flow = loadFlowByName('requirements', opened.harnessDir);
  overrideAdapters(flow, 'mock');
  opened.config.adapterOverride = 'mock';
  const ticket = opened.backlog.read('T-0001');
  ticket.meta.stage = 'draft';
  opened.backlog.write(ticket);
  let status: string | undefined;
  let error: unknown = null;
  try {
    for await (const event of runFlow({ flow, ticket, project: opened, backlog: opened.backlog, answerGate })) {
      if (event.type === 'terminal') status = event.status;
    }
  } catch (thrown) {
    error = thrown;
  }
  return { status, error };
}
