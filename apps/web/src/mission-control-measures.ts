/**
 * The two measured values mission control's header shows: how long a run has been going, and what
 * it has cost on each vendor.
 *
 * A pure module with no DOM and no `fetch`, which is `mission-control-model.ts`'s arrangement for
 * its reason: every rule below is asserted by value against a supplied clock rather than by
 * rendering, so a verdict here is a property of the commit and not of the machine the suite runs on
 * (*"A test's verdict is a property of the commit, not of the checkout or the account"*, 2026-08-30).
 *
 * **The two values behave differently, and the difference is the design.** Elapsed ADVANCES, from
 * `manifest.started_at` — a value the browser is already holding — so it performs no read and
 * engages `contracts/Q-0015/mission-control.contract.md`'s *"Refresh is the only repeat read; no
 * timer performs one"* not at all. Cost does NOT advance: it is a read, it ships as of the last one,
 * and the only thing that repeats it is a reader asking. Getting either backwards produces a screen
 * that freezes a number false the moment it renders, or polls the most expensive route on this
 * transport.
 *
 * **Cost is read and never accumulated from the event stream.** The browser keeps a bounded,
 * head-evicting tail of a run's events, so a total assembled from them under-reports silently —
 * exactly when the screen is disclosing a discard — and the daemon replays its retained buffer to
 * every new subscription with no sequence number to deduplicate on. `writer.ts` recomputes
 * `manifest.rollup` in full on every occurrence that terminates and replaces the manifest
 * atomically, so the roll-up this reads is live and correct while the run runs.
 *
 * **Nothing here branches on a vendor's name.** The grouping key is the exact `usage.vendor` string
 * the roll-up carries, rendered verbatim, so a third adapter's rows appear because they are in the
 * roll-up rather than because a list here was extended. This repository's own history would validate
 * the other design — every `claude` row in it is priced and every `codex` row unpriced, with no
 * exception in either direction — which is why the rule is stated rather than left to a fixture.
 *
 * **And nothing here sums across vendors.** *"Codex cost is reported as tokens, never priced
 * locally"* (2026-08-22): a priced vendor and a token-only one in one number is exactly the figure
 * that entry refuses, and this is the one surface where `terminal.cost` — a typed number already in
 * the browser's hands — makes the wrong answer tempting.
 */
import { historyDetailPath } from './daemon-endpoints.js';
import { vendorOf } from './mission-control-model.js';
import type { RequestState } from './request-state.js';
import type { RunConnectionSnapshot } from './run-connection.js';
import type { Event, WireRun, WireRunHistory } from '@quorum/shared';

/**
 * How often a live elapsed figure is recomputed.
 *
 * One second, because that is the smallest unit the figure renders: a faster tick would repaint a
 * value that had not changed, and a slower one would show a reader a duration that is behind the
 * one on their own clock.
 */
export const ELAPSED_TICK_MS = 1000;

/**
 * How many decimals a vendor's billed cost renders to.
 *
 * **Three, matching `packages/cli/src/runs.ts`, which renders this identical field.** That site
 * carries the reason in its own authority line — at two decimals a real `$0.004` step renders
 * `$0.00` and becomes indistinguishable from a vendor that reported zero (Q-0034) — and a second
 * convention here for one kind of value would be drift. `billedCostUsd` on a board card keeps its
 * own two, being a different field: a ticket-level sum rather than one run's vendor row.
 */
export const COST_DECIMALS = 3;

/** One vendor's billed cost, rounded rather than truncated — a sum of floats has a long tail. */
export const formatCost = (usd: number): string => `$${usd.toFixed(COST_DECIMALS)}`;

/**
 * `<ticket id>-<run number>`, which is the run directory's own name and the token
 * `GET /history/:id` takes.
 *
 * Composed from two typed fields of one answer rather than parsed out of anything: neither half is
 * read from an event's prose, and the handle — which is this daemon's in-memory name for a run and
 * is meaningless across a restart — is never a component of it.
 */
export const historyIdOf = (ticketId: string, runId: number): string => `${ticketId}-${String(runId)}`;

/**
 * The history id for one run, or `null` where this run has none to compose.
 *
 * **A dry walk has none, and that is the load-bearing clause rather than a tidy-up.** Such a walk is
 * allocated a run number like any other run and writes no run history; `nextRunId` reserves nothing,
 * so the next real run of that ticket is allocated the identical number. An id composed here would
 * therefore name a directory belonging to a DIFFERENT run as soon as one existed — a wrong answer
 * rather than a missing one, which is why `dry` was carried onto the wire instead of being inferred
 * from a 404.
 */
export function runHistoryId(run: WireRun): string | null {
  if (run.dry || run.ticketId === null || run.runId === null) return null;
  return historyIdOf(run.ticketId, run.runId);
}

/**
 * Why this screen has no measured values, where it has none.
 *
 * Four members rather than one, because they are four different things to tell a reader and only one
 * of them is repairable by asking again. Collapsing them is what `04-architecture.md`'s placeholder
 * rule forbids: none of them may render as `0`, a dash, a spinner or an empty region.
 */
export type MeasuredAbsence =
  /** A walk that invoked no adapter and wrote no run history, so nothing was recorded to measure. */
  | { readonly kind: 'dry' }
  /** The run's number has not been read from the daemon, and history is addressed by it. */
  | { readonly kind: 'no-run-number' }
  /** The daemon resolved no ticket for this run, and history is addressed by ticket and number together. */
  | { readonly kind: 'no-ticket-id' }
  /** The read was made and did not come back with a history — its own state says which way. */
  | { readonly kind: 'not-read'; readonly state: Exclude<RequestState<WireRunHistory>, { readonly kind: 'loaded' }> };

/** Either the history this screen is measuring from, or the reason it is measuring from none. */
export type MeasuredView =
  | { readonly kind: 'absent'; readonly absence: MeasuredAbsence }
  | { readonly kind: 'measured'; readonly history: WireRunHistory };

/**
 * Which of the two the screen is in, from the run the daemon last reported and the read made for it.
 *
 * **The order of the gates is the order a reader needs them in**, and the three that answer before
 * the read matter most: each names a reason NO read was made, and a screen that made one anyway
 * would be asking the daemon a question whose answer it must not use.
 */
export function measuredView(
  run: WireRun | null,
  history: RequestState<WireRunHistory> | null,
): MeasuredView {
  const absent = (absence: MeasuredAbsence): MeasuredView => ({ kind: 'absent', absence });
  if (run === null) return absent({ kind: 'no-run-number' });
  if (run.dry) return absent({ kind: 'dry' });
  if (run.ticketId === null) return absent({ kind: 'no-ticket-id' });
  if (run.runId === null) return absent({ kind: 'no-run-number' });
  // A composable id with no read state yet is the one commit between the metadata landing and the
  // read starting. It renders the in-flight sentence naming the path being asked for, whose text
  // comes from the module that owns every daemon path rather than from a literal here.
  if (history === null) {
    return absent({ kind: 'not-read', state: { kind: 'in-flight', path: historyDetailPath(historyIdOf(run.ticketId, run.runId)) } });
  }
  if (history.kind !== 'loaded') return absent({ kind: 'not-read', state: history });
  return { kind: 'measured', history: history.value };
}

/**
 * Whether the CONNECTION has reported this run over.
 *
 * **The manifest read cannot answer this, which is why it is asked of the stream.** That read is a
 * snapshot: a run that ends after it leaves the browser holding `status: 'running'` and
 * `ended_at: null`, and an elapsed figure gated on the manifest alone would advance indefinitely
 * past an end that has already happened — on the screen whose whole discipline is saying only what
 * it has.
 *
 * Two signals rather than one, and it is the earlier of them that decides: a terminal event is the
 * run reporting its own end, and the `ended` connection state is the socket closing after one. The
 * terminal event arrives first, so gating on the close alone would keep advancing across the gap.
 */
export const connectionReportsEnded = (snapshot: RunConnectionSnapshot): boolean =>
  snapshot.state.kind === 'ended' || snapshot.events.some((event) => event.type === 'terminal');

/**
 * Milliseconds between two ISO instants, clamped at zero, or `null` where either cannot be read.
 *
 * The clamp is for a clock adjustment: a browser whose clock moves backwards over a run would
 * otherwise render a negative duration, and `00:00` is the honest floor. `null` is for a
 * `started_at` that is not an instant — the schema requires a non-empty string and `readRun` casts
 * rather than checks, so a hand-edited manifest can carry one — which the screen names rather than
 * rendering `NaN`.
 */
export function elapsedMs(from: string, to: string): number | null {
  const start = new Date(from).getTime();
  const end = new Date(to).getTime();
  // A predicate over two numbers, not a coercion of a string: `new Date(iso)` is given an argument,
  // so neither this nor the two readings above is the ambient clock `isoClock` owns.
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.max(0, end - start);
}

/**
 * A duration as `MM:SS`, or `H:MM:SS` from one hour.
 *
 * **Hours are unbounded and there is no day rollover.** A run in this repository's own history has
 * exceeded an hour and a half, and a figure that wrapped at 24 hours would be wrong in the one
 * direction a reader cannot detect. Minutes and seconds are zero-padded; the hour is not, because it
 * is the leading field.
 */
export function formatElapsed(ms: number): string {
  const whole = Math.max(0, Math.floor(ms / 1000));
  const pad = (value: number): string => String(value).padStart(2, '0');
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor(whole / 60) % 60;
  const seconds = whole % 60;
  return hours === 0 ? `${pad(minutes)}:${pad(seconds)}` : `${String(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/** What the elapsed figure is, once a history has been read. */
export type ElapsedView =
  /** The run is still going, as far as anything here knows: the browser's own clock against its start. */
  | { readonly kind: 'running'; readonly text: string }
  /** It is over, and this is the engine's own measurement of how long it took. */
  | { readonly kind: 'ended'; readonly text: string }
  /** It is over and the last read recorded no duration, so there is no figure to show yet. */
  | { readonly kind: 'ended-unmeasured' }
  /** Its recorded start could not be read as an instant, so no difference can be taken from it. */
  | { readonly kind: 'unreadable-start' };

/**
 * The elapsed figure for one read history, at one moment.
 *
 * **The frozen figure is `manifest.duration_ms` and never a subtraction performed here.** `finalise`
 * computes that field from the same `Date` reading that produced `ended_at`, so it is one
 * measurement; recomputing it in a browser would be a second computation of an engine-computed
 * value, which is the third-site objection this ticket makes about cost, at the other value.
 *
 * **Advancement stops on whichever authority speaks first.** `endedOnStream` is the connection's,
 * `ended_at` is the read's, and a run that has ended with no duration recorded yet says so instead
 * of freezing a figure naming an instant nobody measured.
 */
export function elapsedView(history: WireRunHistory, endedOnStream: boolean, now: string): ElapsedView {
  const { started_at: startedAt, ended_at: endedAt, duration_ms: durationMs } = history.manifest;
  if (durationMs !== null) return { kind: 'ended', text: formatElapsed(durationMs) };
  if (endedOnStream || endedAt !== null) return { kind: 'ended-unmeasured' };
  const ms = elapsedMs(startedAt, now);
  return ms === null ? { kind: 'unreadable-start' } : { kind: 'running', text: formatElapsed(ms) };
}

/** One vendor's entry, rendered from its own roll-up row and from nothing else. */
export interface VendorCostRow {
  /** The exact `usage.vendor` string, rendered verbatim and never mapped to a known name. */
  readonly vendor: string;
  /** What it billed, formatted, or `null` where it reported no price — which is not zero. */
  readonly cost: string | null;
  /** Its token total where it reported no price, or `null` where it reported no measure either. */
  readonly tokens: number | null;
  /** How many of its counted occurrences reported no price. Rendered only where it is non-zero. */
  readonly unpricedSteps: number;
}

/**
 * One entry per roll-up row, in the response's own order.
 *
 * **The order is preserved and never sorted**: `rollup()` emits rows in first-appearance order, and
 * an order composed here would be one this screen invented. **Nothing is filtered either** — a
 * failed occurrence that was billed is in the roll-up by design, failure being when the number
 * matters most — so a status is never a reason to drop a row.
 *
 * A token total is carried only where the price is absent, because that is the only case where it
 * stands in for one. Where the vendor reported neither, both are `null` and the screen says so.
 */
export function vendorCostRows(history: WireRunHistory): readonly VendorCostRow[] {
  return history.manifest.rollup.map((row) => ({
    vendor: row.vendor,
    cost: row.cost_usd === null ? null : formatCost(row.cost_usd),
    tokens: row.cost_usd === null ? history.tokensByVendor[row.vendor] ?? null : null,
    unpricedSteps: row.unpriced_steps,
  }));
}

/**
 * Every vendor this browser has SEEN take a step on the run, in first-appearance order.
 *
 * `spawn` and `retry` are the two events that carry a vendor label, and {@link vendorOf} is the one
 * place that is written down — so a third label-carrying event is a change there rather than a
 * second register here that could go on naming two.
 *
 * **It is a lower bound and never a roster**, which is what bounds what may be said from it. The
 * browser keeps a bounded, head-evicting tail of a run's events, and a late joiner is replayed only
 * what the daemon retained, so a vendor whose `spawn` has been discarded is invisible here. What is
 * rendered from this is therefore a positive claim about a vendor that WAS observed, and never a
 * claim about the ones it does not name.
 */
export function observedVendors(events: readonly Event[]): readonly string[] {
  const seen = new Set<string>();
  for (const event of events) {
    const vendor = vendorOf(event);
    if (vendor !== null) seen.add(vendor);
  }
  return [...seen];
}

/**
 * Every observed vendor the roll-up has no row for, in the order it was first observed.
 *
 * **A roll-up row exists only for a vendor that has FINISHED a billed occurrence** —
 * `VendorRollup.step_count` is documented *"Never zero — a row without one is absent"* — so a vendor
 * that has been seen running and finished none is ABSENT from the roll-up rather than present at
 * zero, and that is a third claim beside *priced* and *unpriced*.
 *
 * **Naming them one at a time is what an emptiness check cannot do.** A two-vendor run whose first
 * vendor has finished a billed step and whose second has not has a non-empty roll-up, so a region
 * that spoke only when the whole roll-up was empty rendered one row and nothing whatever about the
 * other — a reader seeing a vendor in the trace columns beside it and no account of it here.
 */
export function absentVendors(history: WireRunHistory, events: readonly Event[]): readonly string[] {
  const billed = new Set(history.manifest.rollup.map((row) => row.vendor));
  return observedVendors(events).filter((vendor) => !billed.has(vendor));
}
