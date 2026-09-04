/**
 * One `Event` to one line on the terminal, and nothing else.
 *
 * **It replaces an object rather than porting one.** The spike hands the engine a `ui` object
 * (`spike/bin/harness.js:63–127`) whose six methods the engine calls; a run is now a lazy,
 * single-consumer `AsyncIterable<Event>` (Q-0050's one authorised behaviour change), so what was an
 * interface the engine drove is a renderer the caller drives. The bytes are the spike's, method for
 * method, and the mapping is in the ticket's own Appendix B.
 *
 * The engine's own entry point is named in `run.ts` and nowhere here, which is a rule rather than a
 * habit: `frame.source.test.ts`'s AC-10 partition permits a *command* module to name the domain
 * symbols its command needs, and this is a frame module.
 *
 * **The switch is exhaustive over the union**, checked by the `never` binding in its last arm: a
 * tenth member added to `@quorum/shared`'s `eventSchema` fails to compile here rather than being
 * rendered as nothing. That is the property `docs/GLOSSARY.md`'s **Event** entry promises when it
 * says the union is derived from what the product emits.
 *
 * **`terminal` prints nothing, and that is a criterion rather than an omission.** `core` already
 * emits the run's own human line as an `info` immediately before it
 * (`packages/core/src/engine/lifecycle.ts:155`), so a renderer that also formatted the terminal
 * event would print every run's outcome twice. Its readers are the exit-code mapping and the
 * interrupted branch in `run.ts`, both of which want the value and not a line.
 *
 * **No vendor appears.** `spawn` and `retry` carry a `vendor` label and nothing below reads it:
 * nothing above the adapter layer may branch on which vendor produced an event.
 */
import type { Event } from '@quorum/shared';

import { c } from './colour.js';

/**
 * Print one event exactly as `spike/bin/harness.js:63–73` prints it.
 *
 * Every line goes to stdout through `console.log`, `warn` included — the spike writes no event to
 * stderr, and moving one there would change what a caller redirecting output sees. Why: preserved,
 * see `spike/bin/harness.js:65`.
 *
 * @param event one item of the run's trace.
 * @param verbose whether `--verbose` was given. It gates `stdout` and nothing else: `spawn` and
 *   `retry` are always shown, because a run that goes quiet for thirty seconds should say why.
 */
export function renderEvent(event: Event, verbose: boolean): void {
  switch (event.type) {
    case 'info':
      console.log(`${c.dim('·')} ${event.message}`);
      return;
    case 'warn':
      console.log(`${c.amber('!')} ${event.message}`);
      return;
    case 'step':
      console.log(`${c.teal('▸')} ${c.bold(event.stepId)} ${c.dim(event.message)}`);
      return;
    case 'done':
      console.log(`${c.green('✓')} ${c.bold(event.stepId)} ${c.dim(event.message)}`);
      return;
    case 'stdout':
      if (verbose) console.log(c.dim(`  [${event.stepId}] ${event.line.slice(0, 160)}`));
      return;
    case 'spawn':
      console.log(c.dim(`  [${event.stepId}] $ ${event.cmd}`));
      return;
    case 'retry':
      console.log(
        `${c.amber('↻')} ${event.stepId}: ${event.reason} — attempt ${event.attempt}/${event.of}`
        + ` failed, retrying in ${Math.round(event.delayMs / 1000)}s`
        + c.dim(`\n    ${event.message}`),
      );
      return;
    case 'gate':
      // The banner alone. The question is asked by the gate reader, which the run loop calls the
      // moment this has been printed — two moments where the spike had one function, and the split
      // is what keeps the banner from being printed twice or not at all. See Q-0094 AC-4.
      console.log(`\n${c.amber('■ GATE')} (${event.kind}) ${event.reason}`);
      console.log(c.dim(`  inspect: ${event.ticketDir}`));
      return;
    case 'terminal':
      return;
    default: {
      const unhandled: never = event;
      return unhandled;
    }
  }
}
