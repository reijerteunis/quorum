/**
 * The interactive gate reader: the scripted queue, the TTY test, the readline handle, and the five
 * places a gate can end without a decision.
 *
 * **It is the last piece of the spike's CLI with behaviour rather than formatting in it**
 * (`spike/bin/harness.js:74–121`), and the one place in this package that imports `node:readline` —
 * `frame.source.test.ts` names this module by identity for exactly that.
 *
 * **Two of the five sites mean nobody was there and three mean somebody answered wrongly.** The
 * first two throw {@link GateUnansweredError} — imported from `@quorum/core`, because the engine
 * classifies the run on `instanceof` and a locally declared class of the same name would be
 * classified `failed`, rolled back and all — and the other three throw a plain `FlowError`. The
 * distinction is by TYPE and never by message text: the two wordings share their first eight words.
 * See Q-0040, and *"A run nobody answered is undecided, and keeps the branch it proved"*
 * (2026-09-01).
 *
 * **The streams and the TTY predicate are parameters**, defaulting to the process's own. That is a
 * shape change and not a behaviour change: the spike reaches three of these sites only by spawning
 * the binary under a `--import` preload that sets `process.stdin.isTTY`
 * (`spike/test/q0040-undecided.js:8–13`), and this package may not take that route — `build.test.ts`
 * is the one file Q-0098 AC-15(c) rules may spawn the emit, so requiring a build to test a gate
 * would make this suite's verdict a property of whether `dist/` exists. `test/invoke.ts` already
 * made the same move for `console`, for the same reason.
 *
 * **The reader waits for the banner before it speaks.** `askGate` emits the question and calls
 * `answerGate` synchronously, so without {@link GateReader.announce} the prompt would reach the
 * terminal before the `■ GATE` line the run loop is about to print for it. The rendezvous is
 * order-independent rather than relying on that ordering — see {@link createGateReader}.
 */
import readline from 'node:readline';

import { FlowError, GateUnansweredError } from '@quorum/core';
import type { GateAnswer, GateAnswerEnvelope, GateQuestionEvent } from '@quorum/shared';

import type { FlagValue } from './argv.js';
import { c } from './colour.js';

/**
 * What `RunFlowOptions.answerGate` is, spelled here because `@quorum/core`'s barrel publishes no
 * type for it and needs none: the options object `run.ts` builds is checked structurally against
 * `RunFlowOptions`'s own field type, so a mismatch is a compile error either way (Q-0094 §3).
 *
 * The engine's entry point is named in `run.ts` and nowhere here: `frame.source.test.ts`'s AC-10
 * partition permits a *command* module to name the domain symbols its command needs, and this is a
 * frame module.
 */
export type AnswerGate = (question: GateQuestionEvent) => Promise<GateAnswerEnvelope>;

/** Where the reader reads from, where it prompts, and how it decides a human is there. */
export interface GateReaderOptions {
  /** Every `--gate-answer`, in command-line order. Copied, never consumed in place. */
  readonly answers: readonly FlagValue[];
  /** The stream a typed answer arrives on. Defaults to this process's stdin. */
  readonly input?: NodeJS.ReadableStream;
  /**
   * The stream `readline` writes its prompt and its echo to. Defaults to this process's stdout.
   *
   * It is readline's output and not this module's: the one line the reader prints for itself — a
   * scripted answer's echo — goes through `console.log`, like every other line this package writes,
   * because at a terminal both are the same file descriptor and only the readline handle needs the
   * stream as an object. A reader that wrote its own output here instead would be invisible to
   * `test/invoke.ts`'s console capture, which is what every other assertion about this CLI reads.
   */
  readonly output?: NodeJS.WritableStream;
  /** Whether somebody is at a terminal. Defaults to this process's own stdin. */
  readonly isTTY?: () => boolean;
}

/** The two halves of answering a gate: the callback the engine holds, and the loop's cue to it. */
export interface GateReader {
  /**
   * Handed to the engine as `RunFlowOptions.answerGate`. Parks until the banner for its own question
   * has been printed, then reads an answer and returns it in the correlated envelope
   * `routing.ts:41–47` validates.
   */
  readonly answerGate: AnswerGate;
  /** Called by the run loop the moment it has printed one gate's banner. */
  announce(gateId: string): void;
}

/** What the gate offers, as the prompt spells it and as an exact scripted answer is matched against. */
const allowedFor = (question: GateQuestionEvent): GateAnswer[] =>
  question.retry === undefined ? ['advance', 'abort'] : ['advance', 'retry', 'abort'];

/** `advance / retry / abort` or `advance / abort` — the spike's own spelling of the same list. */
const optionsOf = (allowed: readonly GateAnswer[]): string => allowed.join(' / ');

/** Whether `word` is one of the answers this gate accepts, so the cast below is a narrowing. */
const accepts = (allowed: readonly GateAnswer[], word: string): word is GateAnswer =>
  (allowed as readonly string[]).includes(word);

/**
 * Build one run's gate reader.
 *
 * The scripted answers are copied into a mutable queue owned by this call, so consuming them cannot
 * leak between two invocations in one process — which the in-process fixture makes reachable and
 * the spike's spawned binary never could (Q-0094 AC-5(1)).
 *
 * The banner rendezvous keeps a resolver per gate id and a set of ids already announced, so it is
 * correct whichever of the two arrives first. Today `askGate` always calls `answerGate` before the
 * consumer can render, and pinning the reader to that ordering would make a correct engine change
 * look like a hang.
 */
export function createGateReader(options: GateReaderOptions): GateReader {
  const queue: FlagValue[] = [...options.answers];
  const input = options.input ?? process.stdin;
  const output = options.output ?? process.stdout;
  const isTTY = options.isTTY ?? ((): boolean => Boolean(process.stdin.isTTY));

  const waiting = new Map<string, () => void>();
  const announced = new Set<string>();

  const announce = (gateId: string): void => {
    const resolve = waiting.get(gateId);
    if (resolve === undefined) {
      announced.add(gateId);
      return;
    }
    waiting.delete(gateId);
    resolve();
  };

  const bannerFor = (gateId: string): Promise<void> => {
    if (announced.delete(gateId)) return Promise.resolve();
    return new Promise<void>((resolve) => waiting.set(gateId, resolve));
  };

  /**
   * The next scripted answer, or `null` where the queue is empty.
   *
   * An answer that is not valid for THIS gate is an error and not a skip: the queue does not advance
   * past it, and the answer queued behind it is not consumed in its place — a reader that fell
   * through would answer a gate with a word meant for the next one while satisfying every message
   * assertion. Why: preserved, see `spike/bin/harness.js:82–90` and Q-0094 AC-5(4).
   */
  function scripted(question: GateQuestionEvent, allowed: readonly GateAnswer[]): GateAnswer | null {
    if (queue.length === 0) return null;
    const raw = queue.shift();
    // A valueless `--gate-answer` is the boolean `true`, which normalises to '' and is refused
    // below; the message reports it through `String(raw)`, so it reads `true`. Preserved.
    const answer = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
    if (!accepts(allowed, answer)) {
      const shown = typeof raw === 'string' ? raw.trim() : String(raw);
      throw new FlowError(
        `gate (${question.kind}) "${question.reason}" received --gate-answer "${shown}"`
        + ` — expected exactly one of: ${optionsOf(allowed)} (no abbreviations)`,
      );
    }
    console.log(c.dim(`  ${optionsOf(allowed)} > ${answer}  (from --gate-answer)`));
    return answer;
  }

  /**
   * One typed answer from a terminal, matched by PREFIX — the asymmetry with a scripted answer, and
   * a deliberate one: a human at a prompt may type `ad`, a script may not.
   *
   * Ctrl-C is re-raised at this process because readline swallows it on a TTY, and the run's own
   * handler would otherwise never see it. The rejection the resulting `close` would produce is
   * suppressed: an interrupt is a decision somebody took, so the run must end `interrupted` and
   * never `undecided`, and `core` prefers the abort only when `signal.aborted` is already true when
   * its catch runs. Leaving this promise pending is what lets the abort win that race. Q-0094
   * AC-11(5).
   */
  async function typed(question: GateQuestionEvent, allowed: readonly GateAnswer[]): Promise<GateAnswer> {
    const opts = optionsOf(allowed);
    const rl = readline.createInterface({ input, output });
    let interruptedBySignal = false;
    rl.on('SIGINT', () => {
      interruptedBySignal = true;
      rl.close();
      process.kill(process.pid, 'SIGINT');
    });
    const raw = await new Promise<string>((resolve, reject) => {
      let answered = false;
      rl.question(`  ${opts} > `, (line) => {
        answered = true;
        resolve(line);
      });
      rl.on('close', () => {
        if (answered || interruptedBySignal) return;
        reject(new GateUnansweredError(
          `gate (${question.kind}) "${question.reason}" needs an answer and stdin closed without one`
          + ' — run it interactively, or answer it on stdin',
          { kind: question.kind, reason: question.reason, condition: 'stdin-closed' },
        ));
      });
    });
    rl.close();
    const typedAnswer = raw.trim();
    const word = typedAnswer.toLowerCase();
    if (!word) {
      throw new FlowError(
        `gate (${question.kind}) "${question.reason}" was given an empty answer`
        + ' — say advance, retry or abort; a gate is never assumed',
      );
    }
    if (word.startsWith('ad')) return 'advance';
    if (word.startsWith('r') && allowed.includes('retry')) return 'retry';
    if (word.startsWith('ab')) return 'abort';
    throw new FlowError(
      `gate (${question.kind}) "${question.reason}" did not understand "${typedAnswer}" — expected ${opts}`,
    );
  }

  async function read(question: GateQuestionEvent): Promise<GateAnswer> {
    const allowed = allowedFor(question);
    const answer = scripted(question, allowed);
    if (answer !== null) return answer;
    // Explicit answers are exhausted. A non-interactive run has nowhere left to get a decision from,
    // so it stops here rather than reading whatever happens to be sitting on stdin — which used to
    // resolve as an accidental answer, or as '' → advance. Nobody was there, which the engine
    // classifies `undecided`. Why: preserved, see `spike/bin/harness.js:96–98`, Q-0011 / Q-0033.
    if (!isTTY()) {
      throw new GateUnansweredError(
        `gate (${question.kind}) "${question.reason}" needs an answer and stdin closed without one`
        + ` — pass --gate-answer ${question.retry === undefined ? 'advance|abort' : 'advance|retry|abort'}`
        + ' (repeatable, consumed in order), or run interactively',
        { kind: question.kind, reason: question.reason, condition: 'answers-exhausted' },
      );
    }
    return typed(question, allowed);
  }

  return {
    answerGate: async (question) => {
      await bannerFor(question.gateId);
      // The question's OWN id, never one this reader kept: an envelope carrying any other fails
      // `routing.ts:45`'s correlation check and every gate reads `received stale answer for …`,
      // which presents as an operator error the operator did not make. Q-0094 AC-8.
      return { gateId: question.gateId, answer: await read(question) };
    },
    announce,
  };
}
