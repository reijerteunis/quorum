/**
 * The run host: the in-process registry M3's daemon is built on.
 *
 * It starts a run against `core`'s lazy stream, owns that run's identity, consumes the stream
 * exactly once and fans it out to whoever is watching, holds the gate registry and settles an answer
 * that arrived somewhere else, stops one run, and releases every live run on shutdown. It is a
 * library: it opens no socket, installs no process signal handler and never exits the process —
 * the transport that does those things is Q-0118's.
 *
 * **Four landed entries govern what it consumes, and it negotiates with none of them.**
 * *"What a run's event stream carries, and how a gate answer travels back"* (2026-08-28) and its
 * 2026-08-29 erratum make `runFlow` a lazy, single-consumer `AsyncIterable<Event>` whose
 * cancellation belongs to the caller's `AbortSignal`. *"A run holds a lock on its ticket, and a
 * stale one refuses rather than being reclaimed"* (2026-09-09) is why two starts on one ticket need
 * no queue here. *"A `core` error names the condition; the remedy belongs to the surface"*
 * (2026-09-07) was ruled for this package. *"A dry run changes nothing the caller passed it"*
 * (2026-09-11) is what lets this host hold a ticket across runs at all.
 *
 * **A run this host is driving is named by a handle this host minted, and `core`'s run number is
 * correlated onto it rather than being waited for.** Both of the refusals a start can meet happen
 * before any event is emitted, and in both of them `core` has no run number to give: the stage
 * precondition throws above the run-number allocator, and that allocator reserves nothing, so a
 * contender the run lock refuses has read the *holder's* number. A design that waited for `core`'s
 * id could not name either of the two runs a refusal is about. The handle is opaque, unique within
 * this process, and deliberately meaningless across a restart — resumption is Q-0019's, and a handle
 * that looked durable would be a promise this host cannot keep.
 *
 * **A start does not report success until the run is under way.** `runFlow` is lazy: the stage
 * precondition and the run lock are evaluated on the *first pull*, so a host that stored the
 * iterable and answered its caller would report two concurrent starts as two started runs and
 * discover otherwise later — a mistake every test that starts one run would pass. So the first pull
 * is awaited here, and it is what makes the second start meet the lock.
 *
 * **Shutting down closes the host to new starts, and the two facts are one mechanism.** A start is
 * not *running* until its first pull returns, so a snapshot of the live runs taken while one is in
 * flight omits a run that is about to hold a lock, a worktree and a branch — and nothing would ever
 * release it. So {@link RunHost.shutdown} closes the host, waits for the starts already in flight to
 * settle, and only then takes the snapshot: closing is what makes that snapshot final, and waiting
 * is what makes it complete.
 *
 * **What a consumer of this does NOT get on shutdown**, stated rather than left to be found: the
 * abandonment path settles a pull already in flight with `done` *before* finalisation emits, so the
 * interrupted run's terminal event reaches the manifest and not the fan-out. That is `channel.ts`'s
 * documented guarantee rather than a choice made here; what {@link RunHost.shutdown} promises is
 * that the terminal *record* is on disk before it resolves.
 */
import { loadFlowByName, runFlow } from '@quorum/core';
import type { Project, TicketRecord } from '@quorum/core';
import type { DiffEvidence, Event, GateQuestionEvent, RunTerminalEvent } from '@quorum/shared';

import { assertRetention, createBroadcast } from './broadcast.js';
import type { Broadcast, Subscription } from './broadcast.js';
import { refusalFor } from './failures.js';
import { createGateRegistry } from './gates.js';
import type { EvidenceRefusal, EvidenceResult, GateRefusal } from './gates.js';
import { refusalOf } from './refusal.js';
import type { Refusal } from './refusal.js';

/**
 * Handles are minted from one counter for the life of the module, so two hosts in one process
 * cannot answer the same handle. Unique within the process is the whole of the claim: it is not a
 * run id, not a ticket id, and not durable across a restart.
 */
let minted = 0;

/** What a run the host stopped records as its note when the caller named no reason of its own. */
export const DEFAULT_STOP_REASON = 'stopped by the run host';

/**
 * The condition a start meets once {@link RunHost.shutdown} has begun.
 *
 * This surface's own sentence rather than `core`'s, because `core` was never asked: the start is
 * refused here, before a flow is loaded or a ticket is read. True from the moment shutdown begins
 * and true forever after it, which is why one sentence covers both.
 */
export const HOST_CLOSED_CONDITION = 'the run host is closed and starts no further run';

/** How a run the host started stands: it never began, it is under way, or it is over. */
export type RunState = 'refused' | 'running' | 'ended';

/** What a caller asks the host to start. */
export interface StartRequest {
  /** The flow's name, as `harness/flows/<name>.yaml` carries it. */
  readonly flow: string;
  /** The ticket token. Resolved by `core` inside the backlog root, and never re-checked here. */
  readonly ticket: string;
  /** Walk the flow without invoking an adapter or writing anything. */
  readonly dry?: boolean;
  /** Advance author-declared gates without a human. Never set unless the caller asked for it. */
  readonly auto?: boolean;
  /** The diff anchor `{base}` resolves to — the review's comparison point and nothing else. */
  readonly base?: string;
}

/** What the host knows about one run, as a reader sees it. */
export interface RunView {
  /** This host's own name for the run. Opaque, and meaningless across a restart. */
  readonly handle: string;
  /** The flow name the start named, whether or not it resolved. */
  readonly flow: string;
  /**
   * `core`'s run number, correlated at run start and `null` only before the run is under way.
   *
   * **`core` is the sole authority for it and this host derives none.** The number arrives out of
   * band, through the callback `RunFlowOptions.reportRunNumber` declares, at the site the run is
   * started from — and the terminal event later carries the same number, which is a second delivery
   * of one authority's value rather than a second authority. Q-0131 replaced a sentence here that
   * dated the correlation to the terminal event: a live run's number was unreachable by any reader
   * until the run was over, which is what that ticket was opened on.
   *
   * `null` on a refused start is the honest answer rather than a gap: neither refusal reaches a run
   * number, and the one the lock's contender computed belongs to the run that holds the ticket.
   */
  readonly runId: number | null;
  /**
   * Whether the start asked for a walk that invokes no adapter and writes nothing.
   *
   * The request's EFFECTIVE value — `false` where the field was omitted — so this says what the run
   * is doing rather than what its caller mentioned. Retained since Q-0135 because a dry walk writes
   * no run history and is allocated a run number that the next real run of the same ticket receives
   * again, so a reader composing `<ticket>-<number>` without it reads another run's manifest.
   */
  readonly dry: boolean;
  /** The ticket this run was started against, or `null` where the start never resolved one. */
  readonly ticket: TicketRecord | null;
  readonly state: RunState;
  /** The run's terminal event, once it has one. */
  readonly terminal: RunTerminalEvent | null;
  /** Why the stream closed abnormally, in the words it closed with, or `null`. */
  readonly failure: string | null;
  /** Why the start never happened, or `null` where it did. */
  readonly refusal: Refusal | null;
  /** The questions this run is waiting on an answer for, in the order they were asked. */
  readonly gates: readonly GateQuestionEvent[];
  /**
   * How many subscribers this run's fan-out is currently serving.
   *
   * Added by Q-0118 because the transport's claim that a disconnected client releases its
   * subscription was **unobservable**, so the test asserting it could not fail — the review found
   * it asserting only that the run still existed, which is true either way. A count is also what a
   * UI wants, so this is observability rather than a test hook.
   */
  readonly watchers: number;
}

/** What starting a run produced: a run under way, or a refusal naming the condition `core` gave. */
export type StartOutcome =
  | { readonly started: true; readonly run: RunView }
  | { readonly started: false; readonly run: RunView; readonly refusal: Refusal };

/** Why an answer was refused before `core` saw it, or the host had no run to give it to. */
export type AnswerRefusal = 'no-such-run' | GateRefusal;

/** Why a read of one gate's reviewed diff answered nothing, the host's own absence included. */
export type GateDiffRefusal = 'no-such-run' | EvidenceRefusal;

/** What a read of one gate's reviewed diff came to: the bytes that step was given, or why not. */
export type GateDiffResult =
  | { readonly evidence: DiffEvidence }
  | { readonly refusal: GateDiffRefusal };

/** Why a stop did not happen. */
export type StopRefusal =
  /** No run was ever minted under that handle. */
  | 'no-such-run'
  /** The run is refused or already over, so there is nothing to cancel. */
  | 'not-running'
  /** The reason was blank. `interruptionNote` reads a non-empty string or silently substitutes. */
  | 'not-a-reason';

/** How one host is built. */
export interface RunHostOptions {
  /** The project every run this host starts is against, already loaded. */
  readonly project: Project;
  /**
   * How many of a run's events are retained for a subscriber that arrives late; zero is
   * live-tail-only.
   *
   * Required rather than defaulted, and deliberately: a default here would be this package deciding
   * what a late joiner sees, which belongs to the child that creates one (Q-0118).
   */
  readonly retain: number;
}

/** The registry a transport speaks to. */
export interface RunHost {
  /** The project this host runs against. */
  readonly project: Project;
  /**
   * Start one run, answering only once it is under way or refused.
   *
   * Once {@link RunHost.shutdown} has been called this refuses every request with
   * {@link HOST_CLOSED_CONDITION}, because a run started after that is one nothing would release.
   */
  start(request: StartRequest): Promise<StartOutcome>;
  /** What the host knows about one run, or `null` under a handle it never minted. */
  view(handle: string): RunView | null;
  /**
   * Every run this host has minted, in mint order, whatever state each is in.
   *
   * **The set of runs has one authority and it is the host** (Q-0121 AC-1/AC-2). A transport that
   * kept an index of its own would record what it *saw* — the runs that came through its own start
   * route — where this reports what *exists*, which is the difference a run started by calling this
   * object directly makes visible.
   *
   * It adds no state, no lifecycle and no failure mode: it projects the same records through the
   * same `viewOf` that {@link RunHost.view} uses, so an entry here and that handle's view cannot
   * disagree. A refused start is included, because it is a run this host minted and the caller
   * asking *what do you know about this handle?* is owed an answer; deciding which of them a
   * **listing** may carry is the transport's, and is a narrower question.
   *
   * **Nothing is pruned, and a reader should know it**: `records` grows for the life of the process,
   * which this method is the first thing to make visible. Registered rather than fixed — Q-0123.
   */
  runs(): readonly RunView[];
  /**
   * Attach a watcher to one run, or `null` where there is no stream to watch — an unknown handle or
   * a start that was refused.
   */
  subscribe(handle: string): Subscription | null;
  /** Settle one pending gate of one run, or refuse and leave it waiting. */
  answer(handle: string, envelope: unknown): AnswerRefusal | null;
  /**
   * The diff the step whose decision reached one waiting gate was given, or why there is none.
   *
   * **A gate is answered this only where its own `reached` names the step the bytes were
   * materialised for**, which is what stops a run with two `input.diff` sites being shown the one
   * that merely ran most recently. `chore.yaml` is the shape that makes it work — its `review` step
   * both reads the diff and declares the verdict, and the `integrate` between it and the gate
   * materialises none, so the join holds across a step that reads nothing. `review.yaml` is the
   * shape that makes it answer `no-diff`: its panel reads the range and its `verdict` step, whose
   * own instruction is *"Judge the reviews, not the code diff"*, is what reaches the gate. Saying so
   * is the honest answer; attributing the panel's bytes to a step that never saw them would not be.
   */
  gateDiff(handle: string, gateId: string): GateDiffResult;
  /** Cancel one run through the `AbortSignal` it was started with. */
  stop(handle: string, reason?: string): StopRefusal | null;
  /**
   * Close the host to new starts and release every live run through the stream's abandonment path.
   *
   * Resolves only once each of them has finished persisting: iterator `return()` awaits the run's
   * interrupted-run persistence, so counters, occurrences and the terminal record are on disk.
   *
   * **Every live run includes one whose start has not answered yet.** Closing happens first and the
   * starts in flight are waited for before the snapshot, so a run that becomes live during shutdown
   * is released by it rather than surviving it holding a lock. Called twice, the second call joins
   * the first.
   */
  shutdown(): Promise<void>;
}

/** One run's mutable bookkeeping — {@link RunView} is the readable projection of it. */
interface RunRecord {
  readonly handle: string;
  readonly flow: string;
  /** The start request's effective `dry`, settled when the handle is minted and never revised. */
  readonly dry: boolean;
  ticket: TicketRecord | null;
  runId: number | null;
  state: RunState;
  terminal: RunTerminalEvent | null;
  failure: string | null;
  refusal: Refusal | null;
  broadcast: Broadcast | null;
  /**
   * The diff each step of this run was given, by the id of the step that was given it, until the
   * gate whose decision names that step takes it.
   *
   * **Keyed by producing step and not one slot, because the producer runs before the consumer can
   * and there is more than one producer.** `preflightDiffs` materialises every range whose endpoints
   * all already exist *before any step executes* — one loop over every diff site in flow order — so
   * a run with two such sites reports twice at run start, and a single slot would hold the second
   * site's bytes by the time the first site's step reached its gate. The identity test in `observe`
   * would then miss, and the gate would be answered `no-diff`: a claim that the deciding step read
   * no diff, about a step that read one. A patch this host is holding, reported as an absence —
   * *"A probe that could not answer is not a negative"* (2026-09-10) at the one site this ticket
   * adds. Found by review rather than by a test, because both shipped multi-site shapes are
   * one-snapshot shapes and no fixture reached it.
   *
   * **The key is the step id because the consumer's key is `reached.stepId`**, so the join is an
   * identity on both sides rather than a lookup one end infers. A second materialisation under one
   * step id replaces the first, which is exact for that join: `input.diff` is one field of one step,
   * so two bytes under one id can only be one site read twice.
   *
   * **Transferred rather than copied**: `observe` deletes the entry as it binds, so a patch is held
   * by exactly one of this map and the gate registry and never by both (R-3). What bounds it is the
   * flow: measured over the six shipped flows, `chore` declares one diff site, `review` declares two
   * over one range — which the preflight cache makes one snapshot, Q-0038 AC-10 — and four declare
   * none, so every flow this product ships holds **at most one** snapshot here. It is cleared when
   * the run ends whether or not any gate wanted it, and on the refusal exit beside it, which is what
   * keeps a record's own footprint where Q-0123 measured it, `records` never being pruned.
   */
  readonly evidence: Map<string, DiffEvidence>;
  controller: AbortController | null;
  iterator: AsyncIterator<Event> | null;
  /** The consumption loop, so shutdown can wait for it to have cleaned up. */
  drained: Promise<void> | null;
}

/**
 * Build one run host over an already-loaded project.
 *
 * @throws {RangeError} when `retain` is not a non-negative integer. Refused here, where the bound is
 *   chosen, rather than at the first start: a host nobody can honour must not look healthy until
 *   somebody runs something.
 */
export function createRunHost({ project, retain }: RunHostOptions): RunHost {
  assertRetention(retain);
  const records = new Map<string, RunRecord>();
  const gates = createGateRegistry();
  /**
   * The starts this host has begun and not yet finished, so shutdown can wait for them.
   *
   * A start is `refused` until its first pull returns, so this — and not the record's state — is
   * what says a run may still be about to exist.
   */
  const beginning = new Set<Promise<StartOutcome>>();
  /** Closed to new starts from the moment shutdown begins, which is what makes its snapshot final. */
  let closed = false;
  /** The one shutdown, so a second call joins the first rather than releasing a run twice. */
  let released: Promise<void> | null = null;

  const viewOf = (record: RunRecord): RunView => ({
    handle: record.handle,
    flow: record.flow,
    runId: record.runId,
    dry: record.dry,
    ticket: record.ticket,
    state: record.state,
    terminal: record.terminal,
    failure: record.failure,
    refusal: record.refusal,
    gates: gates.pending(record.handle),
    watchers: record.broadcast?.size ?? 0,
  });

  /**
   * One run's bookkeeping under a fresh handle, registered before anything can fail.
   *
   * It takes the whole request rather than the flow name alone since Q-0135, so that `dry` is
   * settled on the record at the moment the handle exists: a refused start is minted here too, and a
   * caller asking what this host knows about that handle is owed the same answer about it.
   */
  const mint = (request: StartRequest): RunRecord => {
    minted += 1;
    const record: RunRecord = {
      handle: `run-${minted}`,
      flow: request.flow,
      dry: request.dry ?? false,
      ticket: null, runId: null, state: 'refused',
      terminal: null, failure: null, refusal: null, evidence: new Map(),
      broadcast: null, controller: null, iterator: null, drained: null,
    };
    records.set(record.handle, record);
    return record;
  };

  /** A start that did not happen, recorded on its own record and answered to its caller. */
  const refused = (record: RunRecord, refusal: Refusal): StartOutcome => {
    record.state = 'refused';
    record.refusal = refusal;
    gates.release(record.handle);
    // The clean-up `consume` performs when a run ends, on the run's other exit. **Empty on every
    // refusal this host can meet today, and unconditional anyway.** Measured rather than assumed: a
    // preflight that fails after materialising an earlier site does not refuse the start, because
    // the run has emitted its `info` line above the preflight and emits its terminal event before
    // the error closes the channel, and a first pull settled by either is a run that is `running`.
    // Both facts are `core`'s, a record is never pruned (Q-0123), and a refusal that did arrive
    // after a materialisation would hold a capped patch for the life of the process — so the map is
    // emptied on the exit that owns it rather than on the strength of another package's ordering.
    record.evidence.clear();
    return { started: false, run: viewOf(record), refusal };
  };

  const refuse = (record: RunRecord, error: unknown): StartOutcome =>
    refused(record, refusalFor(error));

  /**
   * One consumed event, published and — where it is the terminal one — correlated.
   *
   * The terminal event is the only event carrying run identity, and its `runId` is a typed field.
   * Nothing here reads an event's `message` text or takes a run number out of a `gateId`: two
   * authorities for one run's identity is what {@link minted} exists to prevent.
   *
   * **That rule is why the number this assigns is not the first one the record holds.** Since
   * Q-0131 the run reports its number out of band at run start, so by the time a terminal event
   * arrives `record.runId` is already set — to the same value, from the same authority, `core`
   * having allocated it once. The assignment stays rather than being made conditional: the field
   * is typed, it is what a run that reported nothing still supplies, and a host that trusted one
   * delivery over the other would be choosing between two readings of one fact.
   */
  const observe = (record: RunRecord, event: Event): void => {
    record.broadcast?.publish(event);
    if (event.type === 'terminal') {
      record.terminal = event;
      record.runId = event.runId;
    }
    // **A gate takes the diff its own deciding step was given, and takes it away from the run.**
    // The identity test is the whole of the rule (Q-0134 AC-2): a question carries `reached` only
    // where a verdict-declaring step reached it, and the bytes are that gate's evidence only where
    // the two name one step. It is a LOOKUP on that id rather than a comparison against whatever
    // was reported most recently, because the producers all run before the first gate can be
    // reached and the most recent one is not the deciding one — see {@link RunRecord.evidence}. A
    // question carrying no decision, or one naming a step that read no diff, binds nothing and is
    // answered `no-diff` — which is a sentence rather than an empty patch. Nothing is published, so
    // no patch byte enters the retained buffer.
    if (event.type === 'gate') {
      const reached = event.reached?.stepId;
      const given = reached === undefined ? undefined : record.evidence.get(reached);
      if (reached !== undefined && given !== undefined) {
        gates.bindEvidence(record.handle, event.gateId, given);
        record.evidence.delete(reached);
      }
    }
  };

  /**
   * The one consumption loop per run.
   *
   * The first pull is already done — {@link RunHost.start} made it, which is what proves the run is
   * under way — so it is handed in rather than repeated. A rejection *after* the terminal event is
   * recorded and never published: the channel drains before it settles, so the terminal event has
   * already reached every subscriber and a second terminal event, or an error joined onto that one,
   * would be this host inventing an outcome. Subscribers are released normally either way.
   */
  const consume = async (record: RunRecord, iterator: AsyncIterator<Event>, first: IteratorResult<Event>): Promise<void> => {
    try {
      let result = first;
      while (result.done !== true) {
        observe(record, result.value);
        result = await iterator.next();
      }
    } catch (error) {
      record.failure = error instanceof Error ? error.message : String(error);
    } finally {
      record.state = 'ended';
      gates.release(record.handle);
      // Every snapshot no gate took with it, so a run that ended without reaching a gate that wanted
      // one — or that reported a site whose step never decided anything — holds no patch afterwards.
      // `records` is never pruned (Q-0123), which is exactly why the bytes may not be left on one:
      // what that ticket measured and ruled acceptable is ~0.1 MB of events per ended run, and a
      // retained patch would be twice that again on its own. This is the clean-up an unconsumed
      // snapshot has, and it is unconditional rather than keyed on anything, so a site the flow
      // declares and no gate ever claims cannot outlive the run that read it.
      record.evidence.clear();
      record.broadcast?.close();
    }
  };

  /**
   * One start, from minting its handle to the pull that proves the run is under way.
   *
   * Separate from {@link RunHost.start} so that the promise it returns is the thing
   * {@link beginning} holds: a start is registered as in flight by the method, and this is what the
   * method is waiting on while it is.
   */
  const begin = async (request: StartRequest): Promise<StartOutcome> => {
    const record = mint(request);

    let stream: AsyncIterable<Event>;
    try {
      const flow = loadFlowByName(request.flow, project.harnessDir);
      // `Backlog.read` resolves the token inside the backlog root and refuses one that escapes it
      // (Q-0059). No second check is made here: confinement is `core`'s, and a weaker copy at a
      // second surface is exactly what enforcing it in `core` exists to prevent.
      record.ticket = project.backlog.read(request.ticket);
      const controller = new AbortController();
      record.controller = controller;
      stream = runFlow({
        flow,
        ticket: record.ticket,
        project,
        backlog: project.backlog,
        dry: request.dry ?? false,
        // Never widened by this host: a `human-locked` gate and an engine-presented exhaustion
        // gate stay unbypassable exactly as they are for the CLI.
        auto: request.auto ?? false,
        answerGate: gates.channelFor(record.handle),
        // The run's own number, as soon as it has one, rather than when it ends. `core` allocates it
        // and this closure records it: nothing here computes, parses or infers a number, which is
        // the rule `observe` below states and the reason the value is taken from the engine at all.
        // Q-0131 AC-2.
        reportRunNumber: (runId) => { record.runId = runId; },
        // The diff each step is given, as it is produced. Out of band for the reason the run number
        // is — a callback carries a value no event gains — and for one of its own: a patch is
        // capped at 200,000 bytes against a 214 B mean event, and an event is retained and replayed
        // to every late subscriber. Nothing here reads it, measures it or publishes it; `observe`
        // hands it to the gate whose decision names the step it belongs to. Filed under the step
        // that was given it rather than into one slot, because the preflight reports every
        // pre-existing site before any step runs — see {@link RunRecord.evidence}. Q-0134 AC-3.
        reportDiff: (evidence) => { record.evidence.set(evidence.stepId, evidence); },
        signal: controller.signal,
        ...(request.base === undefined ? {} : { base: request.base }),
      });
    } catch (error) {
      return refuse(record, error);
    }

    const iterator = stream[Symbol.asyncIterator]();
    record.iterator = iterator;
    let first: IteratorResult<Event>;
    try {
      first = await iterator.next();
    } catch (error) {
      return refuse(record, error);
    }

    record.state = 'running';
    record.broadcast = createBroadcast(retain);
    // Started synchronously, so the event that proved the run was under way is published — and
    // retained — before this method answers its caller.
    record.drained = consume(record, iterator, first);
    return { started: true, run: viewOf(record) };
  };

  return {
    project,

    async start(request) {
      // Refused before a flow is loaded or a ticket is read, because a run started now is one
      // nothing would release: the snapshot shutdown takes has already been taken, or is about to
      // be taken over a set this run would not have joined.
      if (closed) return refused(mint(request), refusalOf(HOST_CLOSED_CONDITION));
      const outcome = begin(request);
      beginning.add(outcome);
      try {
        return await outcome;
      } finally {
        beginning.delete(outcome);
      }
    },

    view(handle) {
      const record = records.get(handle);
      return record ? viewOf(record) : null;
    },

    // Mint order, because that is `Map` insertion order and `mint` is the only thing that inserts.
    // A reader wanting recency reverses it; reversing here would make the method's own name a lie
    // about what it enumerates.
    runs() {
      return [...records.values()].map(viewOf);
    },

    subscribe(handle) {
      return records.get(handle)?.broadcast?.subscribe() ?? null;
    },

    answer(handle, envelope) {
      if (!records.has(handle)) return 'no-such-run';
      return gates.answer(handle, envelope);
    },

    gateDiff(handle, gateId) {
      // A handle this host never minted is its own answer, as it is for `answer` and for `view`:
      // the gate registry can only speak about runs, and a refusal composed from its vocabulary
      // would say *that run has no gate waiting under that id* about a run that does not exist.
      if (!records.has(handle)) return { refusal: 'no-such-run' };
      const found: EvidenceResult = gates.evidenceFor(handle, gateId);
      return found;
    },

    stop(handle, reason) {
      const record = records.get(handle);
      if (!record) return 'no-such-run';
      if (record.state !== 'running' || !record.controller) return 'not-running';
      // A STRING, and load-bearing: `interruptionNote` reads `signal.reason` only when it is a
      // non-empty string, and aborting with anything else silently substitutes the thrown message
      // for the reason the caller gave.
      const note = (reason ?? DEFAULT_STOP_REASON).trim();
      if (note === '') return 'not-a-reason';
      record.controller.abort(note);
      return null;
    },

    shutdown() {
      // Set before anything awaits, so a start issued after this call is refused whether or not the
      // release below has begun. The memo is what makes a second call join the first rather than
      // take a second snapshot and release a run twice.
      closed = true;
      released ??= (async () => {
        // The starts already in flight, first. A start is `refused` until its first pull returns —
        // which is where the lock is taken, the branch head read and the first event emitted — so a
        // snapshot taken now would omit a run that is about to hold all three, and nothing else
        // would ever release it. `allSettled` because a start that threw has nothing to release and
        // must not stop the runs that do.
        await Promise.allSettled([...beginning]);
        const live = [...records.values()].filter((record) => record.state === 'running');
        await Promise.all(live.map(async (record) => {
          // `return()` awaits the run's interrupted-run persistence; `drained` is this host's own
          // loop having closed the fan-out and released the gates. Both, because they finish
          // independently: the loop is released by the detached pull before finalisation begins.
          await record.iterator?.return?.();
          await record.drained;
        }));
      })();
      return released;
    },
  };
}
