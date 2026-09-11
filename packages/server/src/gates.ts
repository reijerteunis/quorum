/**
 * The pending-gate registry: how an answer that arrives on one connection reaches the promise a run
 * on another is parked on.
 *
 * `askGate` emits the correlated question, then awaits the `answerGate` callback the run was started
 * with — so the question is already on the stream by the time anybody can answer it, and the answer
 * travels back through a promise this module holds rather than through the stream. The mechanism is
 * *"What a run's event stream carries, and how a gate answer travels back"* (2026-08-28); nothing
 * here negotiates with it.
 *
 * **The answer set is the closed three**, validated here through `@quorum/shared`'s own envelope
 * schema before `core` ever sees it. A mismatched or malformed answer that reached `askGate` would
 * be rendered as *"received stale answer for …"* or *"received an invalid answer"*, which presents
 * as an operator error the operator did not make — so every one of them is refused by this surface
 * and the waiting gate is left exactly as it was.
 *
 * **Keyed by run and then by gate id, because a gate id is unique within a run and not across
 * runs.** `nextGateId` spells `<run number>:<n>`, so two tickets each on their first run both ask
 * `1:1`. That id is also opaque: nothing here parses it, and the run a gate belongs to is the run
 * whose answer channel was invoked, never a substring of the correlation id.
 *
 * **No default answer and no timeout.** `askGate` has neither by design — a human answers in a
 * browser, minutes after the question was emitted — and inventing one here would either advance a
 * decision nobody took or throw away work that was proved green. The only honest lever is stopping
 * the run, which is the host's.
 */
import { gateAnswerEnvelopeSchema } from '@quorum/shared';
import type { GateAnswerEnvelope, GateQuestionEvent } from '@quorum/shared';

import type { AnswerGate } from '@quorum/core';

/**
 * Why the registry refused an answer, as a closed set rather than a sentence.
 *
 * A closed set because the surface above renders it — a status code, a message, or both — and a
 * string composed here would put this package's wording inside somebody else's response body.
 */
export type GateRefusal =
  /** This run has no gate waiting under that id: it never asked one, or it has already been answered. */
  | 'no-such-gate'
  /** That gate is waiting — on a different run. Refused rather than settled across runs. */
  | 'not-this-run'
  /** The envelope is not `{ gateId, answer }` over exactly `advance`, `retry` or `abort`. */
  | 'not-an-answer';

/** The gates of one host, across every run it is driving. */
export interface GateRegistry {
  /**
   * The answer channel for one run — what the host hands `runFlow` as its `answerGate`.
   *
   * A run the host started therefore always has one, so `GateUnansweredCondition`'s
   * `no-answer-channel` is unreachable through this host: a run with nobody watching is not a run
   * that was started with no way to ask.
   */
  channelFor(handle: string): AnswerGate;
  /** The questions of one run that are still waiting, in the order they were asked. */
  pending(handle: string): readonly GateQuestionEvent[];
  /** Settles exactly one pending gate of `handle`, or refuses and leaves every gate untouched. */
  answer(handle: string, envelope: unknown): GateRefusal | null;
  /** Forgets one run's gates, for a run that has ended and can no longer be answered. */
  release(handle: string): void;
}

/** One gate that has been asked and not yet answered. */
interface PendingGate {
  question: GateQuestionEvent;
  settle(envelope: GateAnswerEnvelope): void;
}

/** Build the gate registry one host owns. */
export function createGateRegistry(): GateRegistry {
  const runs = new Map<string, Map<string, PendingGate>>();

  const gatesOf = (handle: string): Map<string, PendingGate> => {
    const existing = runs.get(handle);
    if (existing) return existing;
    const fresh = new Map<string, PendingGate>();
    runs.set(handle, fresh);
    return fresh;
  };

  return {
    channelFor(handle) {
      return (question) => new Promise<GateAnswerEnvelope>((resolve) => {
        gatesOf(handle).set(question.gateId, { question, settle: resolve });
      });
    },

    pending(handle) {
      return [...(runs.get(handle)?.values() ?? [])].map((gate) => gate.question);
    },

    answer(handle, envelope) {
      const parsed = gateAnswerEnvelopeSchema.safeParse(envelope);
      if (!parsed.success) return 'not-an-answer';
      const { gateId } = parsed.data;
      const gates = runs.get(handle);
      const gate = gates?.get(gateId);
      if (!gates || !gate) {
        // Reported as the foreign gate it is rather than as one that does not exist, which is the
        // more useful of the two true statements and the one a caller can act on.
        for (const [other, theirs] of runs) {
          if (other !== handle && theirs.has(gateId)) return 'not-this-run';
        }
        return 'no-such-gate';
      }
      // Deleted before it is settled, so a second answer arriving in the same turn finds nothing
      // waiting: the delete and the settle are one step with no await between them, which is what
      // makes "exactly one wins" a property rather than a hope.
      gates.delete(gateId);
      gate.settle(parsed.data);
      return null;
    },

    release(handle) {
      // The pending promises are not settled: `askGate` raced each of them against the run's own
      // cancellation, and a run only reaches here once that race is over. Settling one now would
      // resolve a promise nobody is awaiting and record an answer nobody gave.
      runs.delete(handle);
    },
  };
}
