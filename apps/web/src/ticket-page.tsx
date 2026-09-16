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
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import type { WireTicketDetail, WireTicketFile, WireTicketFileEntry } from '@quorum/shared';

import {
  browserFetch, fetchTicket, fetchTicketFile, isoClock, ticketFileInFlight, ticketInFlight,
  type Clock, type FetchLike,
} from './daemon-client.js';
import { canRetryRequest, requestStateRemedy, requestStateText, type RequestState } from './request-state.js';

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

/** The state of one request, as a sentence, its remedy, and the action that re-runs it. */
function RequestRegion({ state, onRetry }: { state: RequestState<unknown>; onRetry: () => void }): ReactNode {
  const remedy = requestStateRemedy(state);
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <span className="text-muted" data-request-state={state.kind}>{requestStateText(state)}</span>
      {remedy === null ? null : <span className="text-muted">{remedy}</span>}
      {canRetryRequest(state) ? (
        <button type="button" onClick={onRetry} className="rounded border border-border px-2 py-1 text-text hover:text-accent">
          {RETRY_LABEL}
        </button>
      ) : null}
    </div>
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
export function TicketPage({ ticketId, fetcher, now }: TicketPageProps): ReactNode {
  const request = fetcher ?? browserFetch;
  const clock = now ?? isoClock;
  const [detail, setDetail] = useState<RequestState<WireTicketDetail>>(ticketInFlight<WireTicketDetail>(ticketId));
  const [tab, setTab] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [file, setFile] = useState<RequestState<WireTicketFile> | null>(null);
  const [log, setLog] = useState<RequestState<WireTicketFile> | null>(null);

  // One counter for every load this screen starts, the board's own mechanism and for its reason: a
  // superseded request's answer is dropped rather than landing on top of a newer one, and an
  // unmount bumps the same counter so a late answer never reaches a screen that is gone. It also
  // covers the case only this screen has — navigating from one ticket to another, where a stale
  // answer would render one ticket's file under another ticket's name.
  const generation = useRef(0);

  const open = useCallback((rel: string) => {
    const mine = generation.current;
    setSelected(rel);
    setFile(ticketFileInFlight<WireTicketFile>(ticketId, rel));
    void (async () => {
      const answered = await fetchTicketFile(request, ticketId, rel, clock);
      if (generation.current === mine) setFile(answered);
    })();
  }, [request, clock, ticketId]);

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
    setDetail(ticketInFlight<WireTicketDetail>(ticketId));
    setTab(null);
    setSelected(null);
    setFile(null);
    setLog(null);
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
    return () => { generation.current += 1; };
  }, [load]);

  if (detail.kind !== 'loaded') {
    return (
      <section className="max-w-3xl">
        <h1 className="font-mono text-lg text-text">{ticketId}</h1>
        <div className="mt-4">
          <RequestRegion state={detail} onRetry={load} />
        </div>
      </section>
    );
  }

  const { ticket, files, excluded } = detail.value;
  const tabs = tabsOf(files);
  const shown = tabs.find((each) => each.name === tab) ?? tabs[0] ?? null;

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
      <RequestRegion state={detail} onRetry={load} />

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
                    onClick={() => setTab(each.name)}
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
