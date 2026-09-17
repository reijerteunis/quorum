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
 * **Since Q-0134 it also holds what each waiting gate is being decided ON**, which is the reviewed
 * diff and is the largest thing this package ever keeps in memory. It lives here rather than beside
 * the run because its lifetime is the gate's rather than the run's: every path that forgets a
 * pending gate — an answer settling one, a run releasing all of them — forgets the bytes in the
 * same step, so nothing outlives the question it was evidence for. The patch is never published,
 * never retained as an event and never replayed; a reader fetches it while the gate waits.
 *
 * **No default answer and no timeout.** `askGate` has neither by design — a human answers in a
 * browser, minutes after the question was emitted — and inventing one here would either advance a
 * decision nobody took or throw away work that was proved green. The only honest lever is stopping
 * the run, which is the host's.
 */
import { gateAnswerEnvelopeSchema } from '@quorum/shared';
import type { DiffEvidence, GateAnswerEnvelope, GateQuestionEvent } from '@quorum/shared';

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

/**
 * Why a read of one gate's reviewed diff answered nothing, as a closed set.
 *
 * {@link GateRefusal}'s first two members and one of its own, rather than a widening of that union:
 * `not-an-answer` is about an envelope nobody sends to a GET, and `no-diff` is about a gate that is
 * genuinely waiting. **`no-diff` is an ANSWER and not a failure** — four flows of the six shipped
 * here declare no `input.diff` at all, so a gate whose deciding step read one is the minority case
 * — and it is a separate member rather than an empty success precisely so a surface can say which
 * of the two it met. Reporting it as an empty patch would be an unanswerable question rendered as
 * an answerable one, which *"A probe that could not answer is not a negative"* (2026-09-10) forbids.
 */
export type EvidenceRefusal =
  /** This run has no gate waiting under that id: it never asked one, or it has been answered. */
  | 'no-such-gate'
  /** That gate is waiting — on a different run. Refused rather than answered across runs. */
  | 'not-this-run'
  /** That gate is waiting, and the step whose decision reached it was given no diff. */
  | 'no-diff';

/** What a read of one gate's diff evidence came to: the bytes that step was given, or why not. */
export type EvidenceResult =
  | { readonly evidence: DiffEvidence }
  | { readonly refusal: EvidenceRefusal };

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
  /**
   * Records the diff one gate's deciding step was given, so it can be read while that gate waits.
   *
   * **Order-free by design.** A question is emitted before `askGate` awaits the answer channel, so
   * the two arrive at this registry from two different directions and a binding that required the
   * pending entry to exist first would be a race nobody could see. This writes its own map instead,
   * and {@link GateRegistry.evidenceFor} is what joins the two.
   */
  bindEvidence(handle: string, gateId: string, evidence: DiffEvidence): void;
  /** The diff one waiting gate's deciding step was given, or why there is none to give. */
  evidenceFor(handle: string, gateId: string): EvidenceResult;
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
  /**
   * The reviewed diff per waiting gate, keyed as {@link runs} is and released alongside it.
   *
   * A second map rather than a field on {@link PendingGate}, because a `PendingGate` exists only
   * once `askGate` has reached the answer channel and the evidence may arrive either side of that.
   * Its lifetime is the gate's all the same: every place that forgets a pending entry forgets this
   * one, which is what makes *"released when that gate leaves the pending registry"* a property of
   * the two writes below rather than of somebody remembering. Q-0134 AC-6.
   */
  const evidence = new Map<string, Map<string, DiffEvidence>>();

  const mapOf = <T>(store: Map<string, Map<string, T>>, handle: string): Map<string, T> => {
    const existing = store.get(handle);
    if (existing) return existing;
    const fresh = new Map<string, T>();
    store.set(handle, fresh);
    return fresh;
  };

  const gatesOf = (handle: string): Map<string, PendingGate> => mapOf(runs, handle);

  /** Whether some OTHER run is waiting on a gate under this id — `answer`'s own question. */
  const waitingElsewhere = (handle: string, gateId: string): boolean => {
    for (const [other, theirs] of runs) {
      if (other !== handle && theirs.has(gateId)) return true;
    }
    return false;
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
        if (waitingElsewhere(handle, gateId)) return 'not-this-run';
        return 'no-such-gate';
      }
      // Deleted before it is settled, so a second answer arriving in the same turn finds nothing
      // waiting: the delete and the settle are one step with no await between them, which is what
      // makes "exactly one wins" a property rather than a hope.
      gates.delete(gateId);
      // The gate is gone, so what it was being decided on goes with it — in the same step, for the
      // same reason. An answered gate that still served a patch would be one this registry says is
      // not waiting and still holds up to `repo.max_diff_bytes` for.
      evidence.get(handle)?.delete(gateId);
      gate.settle(parsed.data);
      return null;
    },

    bindEvidence(handle, gateId, given) {
      mapOf(evidence, handle).set(gateId, given);
    },

    evidenceFor(handle, gateId) {
      // **Pending first, and the order is the answer.** A gate that is not waiting on this run is
      // reported as the foreign gate or the absent one exactly as `answer` reports it, so the two
      // reads of one registry cannot describe one gate two ways — and only a gate that IS waiting
      // here can be told *waiting, and nothing was reviewed for it*, which is the third answer this
      // read has and that one does not.
      if (runs.get(handle)?.has(gateId) !== true) {
        return { refusal: waitingElsewhere(handle, gateId) ? 'not-this-run' : 'no-such-gate' };
      }
      const given = evidence.get(handle)?.get(gateId);
      return given === undefined ? { refusal: 'no-diff' } : { evidence: given };
    },

    release(handle) {
      // The pending promises are not settled: `askGate` raced each of them against the run's own
      // cancellation, and a run only reaches here once that race is over. Settling one now would
      // resolve a promise nobody is awaiting and record an answer nobody gave.
      runs.delete(handle);
      // Both maps, because a run with no gates left has no gate to hold a patch for. This is the
      // path a run that ended, was refused or was released on shutdown takes, so it is what bounds
      // the bytes to the life of the run rather than to the life of the process.
      evidence.delete(handle);
    },
  };
}
