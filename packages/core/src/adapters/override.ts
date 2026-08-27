/**
 * `--adapter <name>`: the whole-flow override, lifted from spike/bin/harness.js:612.
 *
 * It sits in this folder because it is about adapter names, and in a file of its own because
 * `adapters.ts`'s runtime export list is pinned at eight names
 * (adapters.source.test.ts:37-40) — adding a ninth there would turn a landed assertion red for no
 * reason a reader could defend.
 *
 * Why: behaviour preserved, both of its blind spots included — see {@link overrideAdapters}.
 */
import type { Flow, FlowStep } from '@quorum/shared';

/** A step as this function reads it: a bag of properties whose types are whatever the YAML held. */
type Loose = Record<string, unknown>;

/**
 * A cast, never a check: reading a property through it must still throw the same raw `TypeError` the
 * spike throws today, which is why a flow carrying no `steps` is not guarded against here.
 */
const loose = (value: unknown): Loose => value as Loose;

/**
 * Points every step that ALREADY names an adapter at `name`, in place.
 *
 * Two things it does not do, and both are preserved rather than overlooked:
 *
 * - a step with no `adapter` key is left without one, so the engine's
 *   `step.adapter ?? role.meta.adapter ?? 'claude'` chain still decides it;
 * - a `fan_out` step's `step:` template is never visited. The fan-out is reached instead through
 *   `ctx.config.adapterOverride` (spike/src/engine.js:204), which the CLI sets on the same line as
 *   this call and which is Q-0052's to port. That is register row 12's shape — a walk that does not
 *   descend into a step template — seen from the CLI's side rather than the linter's.
 *
 * @param flow the parsed flow, mutated in place.
 * @param name the adapter every declaring step is pointed at.
 */
export function overrideAdapters(flow: Flow, name: string): void {
  for (const step of loose(flow).steps as FlowStep[]) {
    for (const member of (loose(step).parallel as FlowStep[] | undefined) ?? [step]) {
      if (loose(member).adapter) loose(member).adapter = name;
    }
  }
}
