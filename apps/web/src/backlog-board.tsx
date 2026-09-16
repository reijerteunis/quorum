/**
 * The backlog board: one column per stage, and where each ticket's code actually is.
 *
 * **It is `quorum board` in a browser, and every rule it renders by is that command's, read from one
 * register.** Which empty columns render, when a branch that does not exist is worth saying, how a
 * containment answer is spelled, what `indeterminate` may not be read as, that push lag may warn and
 * may never reassure, and that a cost figure never travels without the sentence naming what it
 * cannot see — all six are `@quorum/shared`'s since Q-0017, imported by this file and by
 * `packages/cli/src/board.ts`. Re-deriving one here would be a second register free to drift, and
 * two surfaces disagreeing about one repository is the failure a board exists to prevent.
 *
 * **Nothing on this screen writes.** Every request it makes is a GET, it starts no run, answers no
 * gate, moves no stage and takes no run lock. The design brief's *"Run next flow ▸"* button is
 * deliberately absent: two flows consume `requirements` — `chore` and `solutioning` — so a single
 * button would take the most consequential routing choice in this product silently, and starting a
 * run needs somewhere to watch it, which is Q-0015's. What this screen does instead is NAME the
 * flows that consume a stage, which is the true half of what that button was for.
 *
 * **It never polls.** `GET /tickets` walks the backlog and probes git per ticket, so a timer would
 * make the most expensive route on the transport this app's hot path. It loads on mount and when the
 * reader asks again, and it shows when it loaded, because containment and push lag are derived per
 * request and stored nowhere — a board from ten minutes ago is showing an ancestry from ten minutes
 * ago.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import {
  ALWAYS_RENDERED, BRANCH_EXPECTED, containmentToken, indeterminateLegend, pushLagSentence, STAGES,
  type WireFlow, type WireFlowList, type WireTicket, type WireTicketList,
} from '@quorum/shared';

import {
  browserFetch, fetchFlows, fetchTickets, flowsInFlight, isoClock, ticketsInFlight,
  type Clock, type FetchLike,
} from './daemon-client.js';
import { canRetryRequest, requestStateRemedy, requestStateText, type RequestState } from './request-state.js';
import { ticketPath } from './routes.js';

/**
 * What a billed cost figure cannot see, in the sentence that travels with it or it does not render.
 *
 * **The one board rule this file declares rather than imports**, and the reason is a guard already
 * in the tree rather than a lapse: `@quorum/shared` may name no vendor in code (`events.test.ts` AC-9, vendor
 * identity being one neutral, open label there), and this sentence names one by design — disclosing
 * that a token-only vendor contributes nothing to the figure is the whole of what it is for.
 * `packages/cli/src/board.ts` holds the same sentence and `packages/cli/src/board.test.ts` holds the
 * two byte-identical, so the two surfaces share one register through a guard rather than through an
 * import that package may not offer. See *"Codex cost is reported as tokens, never priced locally"*
 * (2026-08-22).
 */
export const COST_LEGEND =
  'billed cost where the vendor reports one; steps on token-only vendors (codex) are not included';

/** What a card shows where the ticket supplies no value. Never a sample and never a guess. */
export const NOT_SET = 'not set';

/** The heading, in one place so a test and the view cannot disagree about what this screen is. */
export const BOARD_HEADING = 'Backlog';

/** The action that loads the board again, which is the only thing that ever reloads it. */
export const REFRESH_LABEL = 'Refresh';

/** The Retry action offered wherever a request failed. */
export const RETRY_LABEL = 'Retry';

/** What a column says where the flow listing itself could not be read. */
export const FLOWS_UNREAD = 'the flow list could not be read, so this column cannot say what consumes it';

/** What a column says where the listing WAS read and no flow consumes the stage. */
export const NO_CONSUMING_FLOW = 'no flow consumes this stage';

/** How the region naming tickets whose stage is not a member of `STAGES` opens. */
export const UNPLACEABLE_HEADING = 'Tickets whose stage this board cannot place';

/** How the region naming flow files the linter refused opens. */
export const UNREADABLE_FLOWS_HEADING = 'Flow files that could not be read';

/** Injectable inputs: the browser supplies none of them, and every test supplies all of them. */
export interface BacklogBoardProps {
  readonly fetcher?: FetchLike;
  readonly now?: Clock;
  readonly onNavigate: (to: string) => void;
}

/** Both requests this screen makes, held together so one Retry re-runs the pair. */
interface BoardData {
  readonly tickets: RequestState<WireTicketList>;
  readonly flows: RequestState<WireFlowList>;
}

/**
 * What names a ticket on this screen: the id its file carries, or the folder that holds it.
 *
 * **The fallback is not cosmetic.** A `ticket.md` `parseFrontmatter` fell open on supplies no id, and
 * the daemon sends `''` rather than inventing one — so without this, two damaged tickets render as
 * one nameless row twice, and a reader cannot tell which folder to open. `folder` comes from the
 * backlog directory rather than from the file that failed to parse, and is unique under one root by
 * construction, which is also why it is this screen's React key everywhere rather than the id.
 * Q-0060 is what makes a damaged ticket possible and is open; this names one rather than fixing it.
 */
function ticketName(ticket: WireTicket): string {
  return ticket.id === '' ? ticket.folder : ticket.id;
}

/**
 * Which containment answer is worth rendering for a ticket, or `null` for none.
 *
 * The suppression rule is `BRANCH_EXPECTED`'s and is applied here rather than copied: every ticket
 * names a branch from creation and only an `integrate` step ever creates one, so a board rendering
 * every `no branch` would drown the column. `null` from the daemon means git was asked nothing,
 * which is already nothing to render.
 */
function shownContainment(ticket: WireTicket): WireTicket['containment'] {
  const found = ticket.containment;
  if (found === null) return null;
  if (found.state === 'indeterminate' && found.reason === 'no branch' && !BRANCH_EXPECTED.has(ticket.stage)) {
    return null;
  }
  return found;
}

/** One ticket's card: the whole of it is one link, with nothing clickable inside it. */
function Card({ ticket, base, onNavigate }: {
  ticket: WireTicket;
  base: string;
  onNavigate: (to: string) => void;
}): ReactNode {
  const spot = shownContainment(ticket);
  const to = ticketPath(ticket.id);
  // The map as the ticket holds it and no denominator: a step's `max_iterations` lives inside a flow
  // file, `GET /flows` carries no steps, and a `1/3` would be a number nobody measured. The design
  // brief asks for one; `docs/04-architecture.md` forbids a fabricated value, and that wins.
  const counters = Object.entries(ticket.iterations);
  return (
    <li>
      <a
        href={to}
        className="block rounded border border-border bg-surface p-3 hover:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        onClick={(event) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
          event.preventDefault();
          onNavigate(to);
        }}
      >
        <span className="block font-mono text-sm text-accent">{ticketName(ticket)}</span>
        <span className="mt-1 block text-text">{ticket.title === '' ? NOT_SET : ticket.title}</span>
        <span className="mt-2 block font-mono text-xs text-muted">
          owner {ticket.owner === '' ? NOT_SET : ticket.owner}
        </span>
        <span className="mt-1 block font-mono text-xs text-muted">
          cost {ticket.billedCostUsd === null ? 'n/a' : `$${ticket.billedCostUsd.toFixed(2)}`}
        </span>
        {counters.length === 0 ? null : (
          <span className="mt-1 block font-mono text-xs text-muted">
            {counters.map(([name, count]) => `${name} ${String(count)}`).join(' · ')}
          </span>
        )}
        {spot === null ? null : (
          <span className="mt-1 block font-mono text-xs text-muted">{containmentToken(spot, base)}</span>
        )}
      </a>
    </li>
  );
}

/** What a column says about the flows that consume its stage. */
function ConsumedBy({ stage, flows }: { stage: string; flows: readonly WireFlow[] | null }): ReactNode {
  if (flows === null) return <span className="block text-xs text-muted">{FLOWS_UNREAD}</span>;
  // ALL of them, never the first: `chore` and `solutioning` both consume `requirements`, and
  // `quorum board` picks one deterministically because a hint may. A screen naming one would take
  // the chore-versus-full-pipeline choice on a reader's behalf without saying it had.
  const consuming = flows.filter((flow) => flow.consumes === stage);
  if (consuming.length === 0) return <span className="block text-xs text-muted">{NO_CONSUMING_FLOW}</span>;
  return (
    <span className="block text-xs text-muted">
      consumed by {consuming.map((flow) => (flow.runnable ? flow.name : `${flow.name} (could not be read)`)).join(', ')}
    </span>
  );
}

/** One stage's column, with its tickets. */
function Column({ stage, tickets, flows, base, onNavigate }: {
  stage: string;
  tickets: readonly WireTicket[];
  flows: readonly WireFlow[] | null;
  base: string;
  onNavigate: (to: string) => void;
}): ReactNode {
  return (
    <section className="flex w-64 shrink-0 flex-col gap-2" aria-label={stage}>
      <h2 className="font-mono text-sm text-text">{stage}</h2>
      <ConsumedBy stage={stage} flows={flows} />
      <ul className="flex flex-col gap-2">
        {/* Keyed by the folder, never by the id: an id is what a damaged file failed to supply, and
            two such tickets in one column would then share a key. A folder basename is unique under
            one backlog root by construction. */}
        {tickets.map((ticket) => <Card key={ticket.folder} ticket={ticket} base={base} onNavigate={onNavigate} />)}
      </ul>
    </section>
  );
}

/** The state of one request, as a sentence, its remedy, and the action that re-runs it. */
function RequestRegion({ state, onRetry }: { state: RequestState<unknown>; onRetry: () => void }): ReactNode {
  const remedy = requestStateRemedy(state);
  return (
    <div className="flex items-center gap-3 text-sm">
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

/**
 * The board, at whatever the daemon last answered.
 *
 * Both requests are issued together and re-issued together, because the columns are the ticket
 * listing and what consumes each stage is the flow listing: a Retry that reloaded one would leave a
 * reader looking at two answers from two moments.
 */
export function BacklogBoard({ fetcher, now, onNavigate }: BacklogBoardProps): ReactNode {
  const request = fetcher ?? browserFetch;
  const clock = now ?? isoClock;
  const [data, setData] = useState<BoardData>({
    tickets: ticketsInFlight<WireTicketList>(),
    flows: flowsInFlight<WireFlowList>(),
  });

  // One counter for every load this screen starts, whoever starts it — the mount, Refresh, or a
  // Retry. It is a ref rather than a flag inside `load` because a flag is private to the invocation
  // that made it, and only the mount's cleanup is ever retained: a Refresh's was discarded by the
  // click handler, so a slow earlier request could land on top of a newer answer and put a stale
  // containment, push lag and fetched-at instant in front of a reader who had just asked for fresh
  // ones. Starting a load invalidates the one before it; whatever a superseded request answers is
  // dropped, in flight and unread, because there is no cancelling a promise that is already out.
  const generation = useRef(0);

  const load = useCallback(() => {
    const mine = (generation.current += 1);
    setData({ tickets: ticketsInFlight<WireTicketList>(), flows: flowsInFlight<WireFlowList>() });
    void (async () => {
      const [tickets, flows] = await Promise.all([fetchTickets(request, clock), fetchFlows(request, clock)]);
      if (generation.current === mine) setData({ tickets, flows });
    })();
  }, [request, clock]);

  // On mount and on an explicit Refresh, and on nothing else: no interval, no focus listener, no
  // revalidation. Unmounting bumps the same counter, which is what stops a late answer landing on a
  // screen that is gone — the same act as a newer load superseding an older one, through one
  // mechanism rather than two.
  useEffect(() => {
    load();
    return () => { generation.current += 1; };
  }, [load]);

  const { tickets, flows } = data;
  if (tickets.kind !== 'loaded') {
    return (
      <section className="max-w-3xl">
        <h1 className="text-lg text-text">{BOARD_HEADING}</h1>
        <div className="mt-4">
          <RequestRegion state={tickets} onRetry={load} />
        </div>
      </section>
    );
  }

  const { tickets: rows, pushLag, baseBranch } = tickets.value;
  const flowRows = flows.kind === 'loaded' ? flows.value.flows : null;
  const placeable = new Set<string>(STAGES);
  const unplaceable = rows.filter((ticket) => !placeable.has(ticket.stage));
  const anyIndeterminate = rows.some((ticket) => shownContainment(ticket)?.state === 'indeterminate');
  // The legend travels with the figure or neither renders. `n/a` is not a figure — a board on which
  // nothing has run says `n/a` on every card and carries no legend, because there is no total there
  // for a reader to mistake for the cost of the work.
  const anyCost = rows.some((ticket) => ticket.billedCostUsd !== null);
  const lagSentence = pushLag === null ? null : pushLagSentence(pushLag, baseBranch);
  const unreadableFlows = (flowRows ?? []).filter((flow) => !flow.runnable);

  return (
    <section>
      <div className="flex items-baseline gap-4">
        <h1 className="text-lg text-text">{BOARD_HEADING}</h1>
        <RequestRegion state={tickets} onRetry={load} />
        <button type="button" onClick={load} className="rounded border border-border px-2 py-1 text-sm text-text hover:text-accent">
          {REFRESH_LABEL}
        </button>
      </div>

      {flows.kind === 'loaded' ? null : (
        <div className="mt-2">
          <RequestRegion state={flows} onRetry={load} />
        </div>
      )}

      <div className="mt-4 flex gap-4 overflow-x-auto">
        {STAGES.map((stage) => {
          const column = rows.filter((ticket) => ticket.stage === stage);
          if (column.length === 0 && !ALWAYS_RENDERED.includes(stage)) return null;
          return (
            <Column
              key={stage}
              stage={stage}
              tickets={column}
              flows={flowRows}
              base={baseBranch}
              onNavigate={onNavigate}
            />
          );
        })}
      </div>

      {unplaceable.length === 0 ? null : (
        <section className="mt-6 max-w-3xl">
          {/* Named, never dropped, defaulted or filed under a stage nobody claimed. `quorum board`
              filters a ticket whose stage is not a member out of every column, so a damaged
              `ticket.md` is rendered NOWHERE on the one surface whose job is to answer what is
              open. This repairs nothing — no frontmatter is parsed, validated or rewritten here,
              and Q-0060 stays open — it only stops this becoming the second surface that hides it. */}
          <h2 className="text-sm text-text">{UNPLACEABLE_HEADING}</h2>
          <ul className="mt-1">
            {unplaceable.map((ticket) => (
              <li key={ticket.folder} className="font-mono text-xs text-muted">
                {ticketName(ticket)} — its stage reads {JSON.stringify(ticket.stage)}, which is not one this board knows
              </li>
            ))}
          </ul>
        </section>
      )}

      {unreadableFlows.length === 0 ? null : (
        <section className="mt-6 max-w-3xl">
          <h2 className="text-sm text-text">{UNREADABLE_FLOWS_HEADING}</h2>
          <ul className="mt-1">
            {unreadableFlows.map((flow) => (
              <li key={flow.name} className="font-mono text-xs text-muted">
                {flow.name} — {flow.problems.join('; ')}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-6 flex flex-col gap-1 text-xs text-muted">
        {anyCost ? <p>cost = {COST_LEGEND}</p> : null}
        {anyIndeterminate ? <p>indeterminate = {indeterminateLegend(baseBranch)}</p> : null}
        {lagSentence === null ? null : <p>push lag = {lagSentence}</p>}
      </div>
    </section>
  );
}
