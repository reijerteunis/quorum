/**
 * One ticket's page: its frontmatter, the files in its folder as tabs, and its run log down the side.
 *
 * **Nothing here loads a folder to render a tab.** The daemon names and measures a ticket's files
 * without opening one; this screen fetches the listing, `ticket.md` and `runs.log` on mount and
 * every other file only when a reader asks for it, with its size on the row beforehand. The largest
 * ticket folder in this repository's backlog is 3.1 MB across six files, one of them 1.46 MB, so a
 * page that loaded the folder would hand a browser a megabyte for a tab nobody opened — and a cap
 * would be a limit nobody is told about, which is the failure Q-0128 exists for one layer up. A
 * visible size is what stands in for one.
 *
 * **The tabs are derived and never a list.** `docs/05-design-prompt.md:27` names six artifact
 * folders; this backlog already holds a seventh top-level entry (`adapter-probe.md`) on one ticket,
 * so a written-down set loses a file on the day it is written. Every top-level segment the listing
 * carries is a tab, which is also why an absent one renders nothing at all rather than an empty
 * panel: 5 tickets in 107 have a `solution/` and a tab for the other 102 would be a promise of
 * something that is not there.
 *
 * **It diverges from that brief in one place and the divergence is recorded here.** *"Review —
 * rounds as columns"* was written on 2026-08-22, before Q-0086 to Q-0089 scoped every artifact path
 * by `{run}` and, inside a bounded loop, by `{iter}` — so a real folder holds
 * `review/chore/run-2/chore-iter-2.md`, which is two levels rather than one, and a flow can run more
 * than once on one ticket. Files are grouped by their own directory path to whatever depth they
 * have; inventing columns for a shape the data does not have is the mockup's fake structure in a
 * real app.
 *
 * **Artifact text renders as escaped preformatted text and nothing else.** React escapes a text
 * child, so a file containing a script tag renders those characters and creates no element. A
 * Markdown renderer needs a sanitiser, which needs a dependency and a justification — a separate
 * decision with its own subject, taken deliberately rather than arrived at while building a page.
 *
 * **Since Q-0130 it is also where a run is started, and that is a decision rather than a location.**
 * The design brief puts a *"Run next flow ▸"* button on a board card; the board refused it, because
 * two flows consume `requirements` and one button would take the most consequential routing choice
 * in this product silently. What the board does instead is NAME the flows that consume a stage — and
 * it names them per COLUMN, so that naming is attached to no ticket at all and cannot be made
 * actionable where it is. A card is one anchor besides, deliberately, so a reader can middle-click
 * it, and a control inside it would be interactive content inside a link. This page already carries
 * the stage, is reached in one click from that card, and is where a reader has just read the ticket.
 * So the choice of flow is a reader's, made here, named by `GET /flows` and never guessed.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import type { WireFlow, WireFlowList, WireRun, WireTicketDetail, WireTicketFile, WireTicketFileEntry } from '@quorum/shared';

import { FLOWS_UNREAD, NO_CONSUMING_FLOW } from './backlog-board.js';
import {
  browserFetch, fetchFlows, fetchTicket, fetchTicketFile, flowsInFlight, isoClock, startRun,
  startRunInFlight, ticketFileInFlight, ticketInFlight,
  type Clock, type FetchLike,
} from './daemon-client.js';
import { canRetryRequest, requestStateRemedy, requestStateText, type RequestState } from './request-state.js';
import { runPath } from './routes.js';
import {
  CONFIRM_START_LABEL, DRY_LABEL, LOOK_AGAIN_LABEL, REFUSED_FLOW_NOTE, START_HEADING,
  START_REFUSAL_TEXT, STARTED_PREFIX, STARTED_SUFFIX, WITHDRAW_LABEL, refusalSentence,
  startConfirmation, startLabel, useRunMutation, type RunMutation,
} from './run-lifecycle.js';

/** The ticket file every ticket has, and the one this page opens first. */
export const TICKET_FILE = 'ticket.md';

/**
 * The run log, which renders down the side rather than as a tab.
 *
 * It is a top-level file like any other and is deliberately not among the tabs: it has a region of
 * its own, and a reader offered it twice would be reading one file in two places.
 */
export const RUN_LOG = 'runs.log';

/** What a field shows where the ticket supplies no value. Never a sample and never a guess. */
export const NOT_SET = 'not set';

/** How the run-log rail opens. */
export const LOG_HEADING = 'Run log';

/** What the rail says for a ticket that has no run log — 16 of 107 here, which is not an error. */
export const NO_RUN_LOG = 'This ticket has no run log: no run has written one.';

/** The Retry action offered wherever a request failed. */
export const RETRY_LABEL = 'Retry';

/** The action that loads the ticket again. */
export const REFRESH_LABEL = 'Refresh';

/** What the page says where the folder holds nothing this route would name. */
export const NO_FILES = 'This ticket\'s folder holds no file this page can show.';

/** What a reader is told before opening a file, so a size is never the surprise. */
export const CHOOSE_FILE = 'Choose a file to read it.';

/** Injectable inputs: the browser supplies none of them, and every test supplies all of them. */
export interface TicketPageProps {
  /** The id the URL supplied, decoded. Never trusted to be the `<PREFIX>-nnnn` grammar. */
  readonly ticketId: string;
  readonly fetcher?: FetchLike;
  readonly now?: Clock;
  /** Where a run this page started is watched. Required, on the board's own precedent. */
  readonly onNavigate: (to: string) => void;
}

/** One tab: the top-level segment that names it, and the files filed under it. */
interface Tab {
  readonly name: string;
  readonly files: readonly WireTicketFileEntry[];
}

/** The top-level segment of a listed path — a directory name, or the file's own name. */
const topSegment = (rel: string): string => (rel.includes('/') ? rel.slice(0, rel.indexOf('/')) : rel);

/** The directory a file sits in, or `''` for one at the top of the folder. */
const directoryOf = (rel: string): string => (rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '');

/**
 * The tabs a listing implies, in the order a reader meets them.
 *
 * Derived from the listing's own top-level segments, so a folder this product has not thought of
 * yet gets a tab rather than being dropped. {@link TICKET_FILE} leads, because it is the one file
 * present on every ticket and an empty selection would be the blank panel
 * `docs/04-architecture.md` forbids; everything else keeps the listing's order, which is sorted.
 */
export function tabsOf(files: readonly WireTicketFileEntry[]): Tab[] {
  const grouped = new Map<string, WireTicketFileEntry[]>();
  for (const file of files) {
    if (file.rel === RUN_LOG) continue;
    const name = topSegment(file.rel);
    const held = grouped.get(name);
    if (held) held.push(file);
    else grouped.set(name, [file]);
  }
  const names = [...grouped.keys()];
  const first = names.filter((name) => name === TICKET_FILE);
  const rest = names.filter((name) => name !== TICKET_FILE);
  return [...first, ...rest].map((name) => ({ name, files: grouped.get(name) ?? [] }));
}

/** One file's text, or the sentence saying what happened to the request for it. */
function FileRegion({ state, onRetry }: { state: RequestState<WireTicketFile>; onRetry: () => void }): ReactNode {
  if (state.kind !== 'loaded') return <RequestRegion state={state} onRetry={onRetry} />;
  return (
    <div>
      <p className="font-mono text-xs text-muted">{state.value.rel} · {state.value.bytes} bytes</p>
      {/* Escaped preformatted text: React escapes a text child, so a file carrying a script tag
          renders those characters and creates nothing. `break-words` is what keeps a file of long
          unbroken lines from pushing the selector off the page. */}
      <pre className="mt-2 max-h-[60vh] overflow-auto whitespace-pre-wrap break-words rounded border border-border bg-surface p-3 font-mono text-xs text-text">
        {state.value.text}
      </pre>
    </div>
  );
}

/**
 * The state of one request, as a sentence, its remedy, and the action that follows it.
 *
 * The label is a parameter since Q-0130 and defaults to {@link RETRY_LABEL}, because the action
 * beside a failed READ repeats that read while the one beside a failed WRITE must not: a start that
 * was refused offers *look again*, which issues a GET, since `canRetryRequest` answers `true` for a
 * refusal and a bare Retry there would send a second start.
 */
function RequestRegion({ state, onRetry, label = RETRY_LABEL }: {
  state: RequestState<unknown>;
  onRetry: () => void;
  label?: string;
}): ReactNode {
  const remedy = requestStateRemedy(state);
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <span className="text-muted" data-request-state={state.kind}>{requestStateText(state)}</span>
      {remedy === null ? null : <span className="text-muted">{remedy}</span>}
      {canRetryRequest(state) ? (
        <button type="button" onClick={onRetry} className="rounded border border-border px-2 py-1 text-text hover:text-accent">
          {label}
        </button>
      ) : null}
    </div>
  );
}

/** What became of a start this page sent, in a sentence that claims only what was observed. */
function StartOutcome({ state, onLookAgain }: {
  state: RequestState<WireRun>;
  onLookAgain: () => void;
}): ReactNode {
  if (state.kind === 'loaded') {
    return (
      <p className="text-sm text-muted" data-start-outcome="loaded">
        {STARTED_PREFIX} <span className="font-mono text-text">{state.value.handle}</span>. {STARTED_SUFFIX}
      </p>
    );
  }
  // This surface's sentence where it has one for the code, and the daemon's own condition either
  // way — the second through `requestStateText`, unaltered. A code this page does not model loses
  // the first and keeps the second, which is the honest answer rather than a composed guess.
  const said = state.kind === 'refused' ? refusalSentence(START_REFUSAL_TEXT, state.refusal.code) : null;
  return (
    <div className="flex flex-col gap-1" data-start-outcome={state.kind}>
      {said === null ? null : <p className="text-sm text-text">{said}</p>}
      <RequestRegion state={state} onRetry={onLookAgain} label={LOOK_AGAIN_LABEL} />
    </div>
  );
}

/**
 * Where a reader starts the next flow on this ticket: every flow that consumes its stage, and one
 * confirmation between choosing one and anything being sent.
 *
 * **Every flow, never one.** `chore` and `solutioning` both consume `requirements`, and a screen
 * offering one of them would take that routing choice on a reader's behalf without saying it had.
 * A flow the linter refused is NAMED and not offered, which is the board's own rule: a flow that
 * vanished from a list is indistinguishable from one that was never there.
 *
 * **Its two unavailable answers are the board's sentences, imported rather than re-worded**, so the
 * two screens cannot come to disagree about one stage. There are THREE unavailable states rather
 * than two: a listing still out is neither *no flow consumes this stage* nor *the flow list could
 * not be read*, and reporting it as either would be an unanswered question rendered as an answer —
 * so it renders the request's own in-flight sentence, which names what is being waited for.
 */
function RunStart({ stage, flows, dry, onDry, mutation, onAsk, onLookAgain }: {
  stage: string;
  flows: RequestState<WireFlowList>;
  dry: boolean;
  onDry: (next: boolean) => void;
  mutation: RunMutation<WireRun>;
  onAsk: (flow: WireFlow) => void;
  onLookAgain: () => void;
}): ReactNode {
  const consuming = flows.kind === 'loaded'
    ? flows.value.flows.filter((flow) => flow.consumes === stage)
    : null;
  return (
    <section className="flex flex-col gap-2 rounded border border-border bg-surface p-3" aria-label={START_HEADING}>
      <h2 className="text-sm text-text">{START_HEADING}</h2>
      {flows.kind === 'in-flight' ? (
        <p className="text-xs text-muted" data-start-unavailable="in-flight">{requestStateText(flows)}</p>
      ) : consuming === null ? (
        <p className="text-xs text-muted" data-start-unavailable="flows-unread">{FLOWS_UNREAD}</p>
      ) : consuming.length === 0 ? (
        <p className="text-xs text-muted" data-start-unavailable="no-consuming-flow">{NO_CONSUMING_FLOW}</p>
      ) : (
        <>
          {/* Inert while an act is outstanding, like the controls below it: what it chooses is part
              of what a start IS, so a reader flipping it mid-flight would be changing the sentence
              they already confirmed. */}
          <label className="flex items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={dry}
              disabled={mutation.busy}
              data-dry
              onChange={(event) => onDry(event.target.checked)}
            />
            {DRY_LABEL}
          </label>
          <div className="flex flex-wrap items-center gap-2">
            {consuming.map((flow) => (flow.runnable ? (
              <button
                key={flow.name}
                type="button"
                data-start-flow={flow.name}
                disabled={mutation.busy}
                onClick={() => onAsk(flow)}
                className="rounded border border-border px-3 py-1 text-sm text-text hover:border-accent hover:text-accent disabled:opacity-50"
              >
                {startLabel(flow.name)}
              </button>
            ) : (
              <span key={flow.name} className="font-mono text-xs text-muted" data-refused-flow={flow.name}>
                {flow.name} — {REFUSED_FLOW_NOTE}
              </span>
            )))}
          </div>
        </>
      )}
      {mutation.confirming === null ? null : (
        <div className="flex flex-col gap-2 rounded border border-accent p-2" data-confirm="start">
          <p className="text-sm text-text">{mutation.confirming}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              data-confirm-start
              onClick={mutation.confirm}
              className="rounded border border-accent px-3 py-1 text-sm text-accent hover:underline"
            >
              {CONFIRM_START_LABEL}
            </button>
            <button
              type="button"
              data-withdraw
              onClick={mutation.cancel}
              className="rounded border border-border px-3 py-1 text-sm text-muted hover:text-text"
            >
              {WITHDRAW_LABEL}
            </button>
          </div>
        </div>
      )}
      {mutation.outcome === null ? null : <StartOutcome state={mutation.outcome} onLookAgain={onLookAgain} />}
    </section>
  );
}

/** One tab's files, grouped by the directory each sits in, to whatever depth the paths have. */
function FileList({ tab, selected, onOpen }: {
  tab: Tab;
  selected: string | null;
  onOpen: (rel: string) => void;
}): ReactNode {
  const directories = new Map<string, WireTicketFileEntry[]>();
  for (const file of tab.files) {
    const directory = directoryOf(file.rel);
    const held = directories.get(directory);
    if (held) held.push(file);
    else directories.set(directory, [file]);
  }
  return (
    <div className="flex flex-col gap-3">
      {[...directories].map(([directory, files]) => (
        <div key={directory}>
          {directory === '' ? null : <p className="font-mono text-xs text-muted">{directory}</p>}
          <ul className="mt-1 flex flex-col gap-1">
            {files.map((file) => (
              <li key={file.rel}>
                <button
                  type="button"
                  onClick={() => onOpen(file.rel)}
                  aria-current={file.rel === selected ? 'true' : undefined}
                  className={`w-full rounded border px-2 py-1 text-left font-mono text-xs hover:border-accent ${
                    file.rel === selected ? 'border-accent text-accent' : 'border-border text-text'
                  }`}
                >
                  {file.rel} · {file.bytes} bytes
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/**
 * The ticket page, at whatever the daemon last answered.
 *
 * Three requests on mount and no more: the listing, then `ticket.md` and `runs.log`, which are the
 * two files this page renders without being asked. Every other file costs one request, when a reader
 * asks for it. Nothing here polls, and nothing keeps a copy — a ticket folder is written by runs
 * while a browser is open, so a cached file would be text that was true earlier.
 */
export function TicketPage({ ticketId, fetcher, now, onNavigate }: TicketPageProps): ReactNode {
  const request = fetcher ?? browserFetch;
  const clock = now ?? isoClock;
  const [detail, setDetail] = useState<RequestState<WireTicketDetail>>(ticketInFlight<WireTicketDetail>(ticketId));
  // The flow directory, read with the detail rather than after it: which flows consume this
  // ticket's stage is what the start region is built from, and two requests answered in one commit
  // are what stop that region rendering *the flow list could not be read* while one is merely out.
  const [flows, setFlows] = useState<RequestState<WireFlowList>>(flowsInFlight<WireFlowList>());
  const [dry, setDry] = useState(false);
  const [tab, setTab] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [file, setFile] = useState<RequestState<WireTicketFile> | null>(null);
  const [log, setLog] = useState<RequestState<WireTicketFile> | null>(null);

  // Which ticket everything above is an answer about, stamped by `load` and compared in the render
  // body. A prop is committed BEFORE the effect that reacts to it runs, so state cleared in an
  // effect is cleared one commit too late: navigating from one ticket to another painted the
  // previous ticket's whole page — header, listing, open file and run log — under the new id, for as
  // long as it takes React to flush a passive effect. Nothing here clears that state, which a render
  // may not do; it stops rendering it, which is the same guarantee one commit earlier and is a
  // property of this component rather than of whoever mounts it.
  const [loadedFor, setLoadedFor] = useState(ticketId);

  // One counter for every load this screen starts, the board's own mechanism and for its reason: a
  // superseded request's answer is dropped rather than landing on top of a newer one, and an
  // unmount bumps the same counter so a late answer never reaches a screen that is gone. It also
  // covers the case only this screen has — navigating from one ticket to another, where a stale
  // answer would render one ticket's file under another ticket's name.
  const generation = useRef(0);

  // And a second counter for every FILE request, because the page counter cannot tell one from the
  // next: two files opened within one load both match it, so whichever answers last is what the
  // region shows — which is the older one whenever a big file is opened before a small one, under a
  // heading naming the newer. The mount's own `ticket.md` request races a file chosen immediately
  // after it the same way. `load` and the unmount bump this one as well, so every act that
  // invalidates the page invalidates a file request with it and the one comparison below is the
  // whole test rather than half of one.
  const fileRequest = useRef(0);

  const open = useCallback((rel: string) => {
    const mine = (fileRequest.current += 1);
    setSelected(rel);
    setFile(ticketFileInFlight<WireTicketFile>(ticketId, rel));
    void (async () => {
      const answered = await fetchTicketFile(request, ticketId, rel, clock);
      if (fileRequest.current === mine) setFile(answered);
    })();
  }, [request, clock, ticketId]);

  // The run log is settled against the page counter and needs none of its own, because it cannot
  // race itself: `openLog` is reached from `load`, which supersedes what came before it, and from a
  // Retry the rail offers only once the request it repeats has settled. Two log requests are never
  // in flight together, so a counter here would be a guard nothing could turn red.
  const openLog = useCallback(() => {
    const mine = generation.current;
    setLog(ticketFileInFlight<WireTicketFile>(ticketId, RUN_LOG));
    void (async () => {
      const answered = await fetchTicketFile(request, ticketId, RUN_LOG, clock);
      if (generation.current === mine) setLog(answered);
    })();
  }, [request, clock, ticketId]);

  const load = useCallback(() => {
    const mine = (generation.current += 1);
    // Both counters, because this clears the file region: a request the load before it started
    // would otherwise answer into the region this one has just emptied.
    fileRequest.current += 1;
    setLoadedFor(ticketId);
    setDetail(ticketInFlight<WireTicketDetail>(ticketId));
    setFlows(flowsInFlight<WireFlowList>());
    setTab(null);
    setSelected(null);
    setFile(null);
    setLog(null);
    // Issued with the detail and settled on its own, which is deliberately NOT the board's
    // `Promise.all`: there the two listings are one screen, and here the flow directory decides one
    // region while the ticket decides the page. Awaited together, a flow listing that never answered
    // would leave a reader looking at nothing at all rather than at the ticket they asked for — so
    // the start region carries a third state for a listing that is merely still out, which is also
    // what stops it reporting one as *could not be read*.
    void (async () => {
      const listed = await fetchFlows(request, clock);
      if (generation.current === mine) setFlows(listed);
    })();
    void (async () => {
      const answered = await fetchTicket(request, ticketId, clock);
      // `mine` is compared rather than read from the ref directly, so a load superseded while this
      // request was out lands nowhere — and `open` and `openLog` below read the ref at the moment
      // they are called, which is this same generation.
      if (generation.current !== mine) return;
      setDetail(answered);
      if (answered.kind !== 'loaded') return;
      const tabs = tabsOf(answered.value.files);
      const opening = tabs.find((each) => each.name === TICKET_FILE) ?? tabs[0];
      setTab(opening?.name ?? null);
      if (answered.value.files.some((each) => each.rel === TICKET_FILE)) open(TICKET_FILE);
      if (answered.value.files.some((each) => each.rel === RUN_LOG)) openLog();
    })();
  }, [request, clock, ticketId, open, openLog]);

  useEffect(() => {
    load();
    return () => { generation.current += 1; fileRequest.current += 1; };
  }, [load]);

  // The one act this page performs on a run, under the guard `run-lifecycle.ts` owns. Its subject is
  // the ticket the URL names, so a start that resolves after a reader has moved to another ticket
  // settles nothing here and is never reported under the new one's name.
  const start = useRunMutation<WireRun>(ticketId);
  const { ask: askStart } = start;

  const onAskStart = useCallback((flow: WireFlow) => {
    askStart({
      sentence: startConfirmation(ticketId, flow.name, dry),
      inFlight: startRunInFlight<WireRun>(),
      // The three fields this app is willing to send, written here and nowhere else. `auto` is
      // absent because *"Human-gated by default"* is a quality pillar and a browser control that
      // flips it is a decision rather than a checkbox; `base` is absent because it moves a review's
      // diff anchor and needs a revision no route on this transport can enumerate.
      send: () => startRun(request, { flow: flow.name, ticket: ticketId, dry }, clock),
      // Only where the daemon accepted it, and only with the handle it answered with: a handle is
      // minted inside the daemon, so composing one here or looking it up afterwards in the listing
      // would be inference rather than identity.
      onAccepted: (run) => onNavigate(runPath(run.handle)),
    });
  }, [askStart, ticketId, dry, request, clock, onNavigate]);

  // The gate, and it is one comparison because everything else this page draws is drawn inside the
  // branch below it: a state that did not come from this ticket never reaches a tab, a file or the
  // rail, because they are only rendered where the detail loaded. What a reader sees in the gap is
  // what a mount shows — the request being waited for, naming the id the URL now carries.
  const shownDetail = loadedFor === ticketId ? detail : ticketInFlight<WireTicketDetail>(ticketId);

  if (shownDetail.kind !== 'loaded') {
    return (
      <section className="max-w-3xl">
        <h1 className="font-mono text-lg text-text">{ticketId}</h1>
        <div className="mt-4">
          <RequestRegion state={shownDetail} onRetry={load} />
        </div>
      </section>
    );
  }

  const { ticket, files, excluded } = shownDetail.value;
  const tabs = tabsOf(files);
  const shown = tabs.find((each) => each.name === tab) ?? tabs[0] ?? null;

  /**
   * Show another tab, discarding what was open under the one being left.
   *
   * The file region sits below the list, so a selection kept across a change would render one tab's
   * file beneath another tab's files, named by a path the list no longer holds — and the counter is
   * bumped with it, so a request the leaving tab started answers nowhere rather than filling the
   * region a moment after it was cleared. The tab already shown is left alone: clicking it is not a
   * way to close the file being read.
   */
  const showTab = (name: string): void => {
    if (shown !== null && name === shown.name) return;
    fileRequest.current += 1;
    setTab(name);
    setSelected(null);
    setFile(null);
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-4">
        <h1 className="font-mono text-lg text-accent">{ticket.id}</h1>
        <p className="text-text">{ticket.title === '' ? NOT_SET : ticket.title}</p>
        <button type="button" onClick={load} className="rounded border border-border px-2 py-1 text-sm text-text hover:text-accent">
          {REFRESH_LABEL}
        </button>
      </div>
      <p className="font-mono text-xs text-muted">
        stage {ticket.stage} · owner {ticket.owner === '' ? NOT_SET : ticket.owner}
        {' · '}cost {ticket.billedCostUsd === null ? 'n/a' : `$${ticket.billedCostUsd.toFixed(2)}`}
      </p>
      <RequestRegion state={shownDetail} onRetry={load} />
      <RunStart
        stage={ticket.stage}
        flows={flows}
        dry={dry}
        onDry={setDry}
        mutation={start}
        onAsk={onAskStart}
        onLookAgain={load}
      />

      <div className="flex gap-6">
        <div className="min-w-0 flex-1">
          {tabs.length === 0 ? (
            <p className="text-muted">{NO_FILES}</p>
          ) : (
            <>
              <nav className="flex flex-wrap gap-2" aria-label="Artifacts">
                {tabs.map((each) => (
                  <button
                    key={each.name}
                    type="button"
                    onClick={() => showTab(each.name)}
                    aria-current={shown !== null && each.name === shown.name ? 'page' : undefined}
                    className={`rounded border px-2 py-1 font-mono text-xs hover:border-accent ${
                      shown !== null && each.name === shown.name ? 'border-accent text-accent' : 'border-border text-muted'
                    }`}
                  >
                    {each.name}
                  </button>
                ))}
              </nav>
              {shown === null ? null : (
                <div className="mt-3 flex flex-col gap-3">
                  <FileList tab={shown} selected={selected} onOpen={open} />
                  {file === null
                    ? <p className="text-muted">{CHOOSE_FILE}</p>
                    : <FileRegion state={file} onRetry={() => { if (selected !== null) open(selected); }} />}
                </div>
              )}
            </>
          )}
          {/* The engine's own run state is inside this folder and is not part of the ticket's
              record, so it is counted and never named. Saying nothing would make a listing read as
              the whole folder; naming the paths would make a backlog page a second run-history
              surface, which is Q-0018's. */}
          {excluded.count === 0 ? null : (
            <p className="mt-4 text-xs text-muted">
              {excluded.count} file{excluded.count === 1 ? '' : 's'} in this folder
              {' '}({excluded.bytes} bytes) are the engine&apos;s own run state and are not shown.
            </p>
          )}
        </div>

        <aside className="w-80 shrink-0" aria-label={LOG_HEADING}>
          <h2 className="text-sm text-text">{LOG_HEADING}</h2>
          {log === null ? (
            <p className="mt-1 text-xs text-muted">{NO_RUN_LOG}</p>
          ) : log.kind === 'loaded' ? (
            // Text, never parsed: what a run id in a line links to is a decision about a screen
            // that does not exist, which is Q-0018's.
            <pre className="mt-1 max-h-[60vh] overflow-auto whitespace-pre-wrap break-words rounded border border-border bg-surface p-2 font-mono text-xs text-muted">
              {log.value.text}
            </pre>
          ) : (
            <div className="mt-1">
              <RequestRegion state={log} onRetry={openLog} />
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
