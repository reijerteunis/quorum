// Q-0047 AC-10: `--adapter <name>`, lifted from the CLI with both of its blind spots intact.
//
// The blind spots are the criterion, not an aside. A step that names no adapter is left naming
// none, so the engine's own fallback chain still decides it; and a fan-out's `step:` template is
// never visited, because the fan-out is reached through `ctx.config.adapterOverride` instead — the
// other half, which Q-0052 ports. A test that only checked "everything now says mock" would pass
// over both.
import type { Flow } from '@quorum/shared';
import { describe, expect, test } from 'vitest';

import { overrideAdapters } from './override.js';
import { coreSourceFiles } from '../../test/corpus.js';

/** One of each kind the walk can meet, and one of each it must leave alone. */
const flow = (): Flow => ({
  name: 'review',
  consumes: 'green',
  produces: 'reviewed',
  steps: [
    { id: 'declares', role: 'code-reviewer', adapter: 'claude' },
    { parallel: [
      { id: 'panel-claude', adapter: 'claude' },
      { id: 'panel-codex', adapter: 'codex' },
      { id: 'panel-silent', role: 'code-reviewer' },
    ] },
    { id: 'silent', role: 'developer-generalist' },
    { gate: 'human', reason: 'accept the review' },
    { id: 'fanned', fan_out: { respect: 'depends_on' }, step: { id: '{task.id}', adapter: 'codex' } },
  ],
});

/** Every step's `adapter`, in walk order, with the fan-out template's appended. */
const adapters = (parsed: Flow): (string | undefined)[] => {
  const steps = (parsed.steps ?? []) as Record<string, unknown>[];
  const members = steps.flatMap((step) => ((step.parallel as Record<string, unknown>[] | undefined) ?? [step]));
  const templates = steps.map((step) => step.step as Record<string, unknown> | undefined).filter(Boolean);
  return [...members, ...templates].map((step) => (step as Record<string, unknown>).adapter as string | undefined);
};

describe('AC-10 — it points every step that already names an adapter, and only those', () => {
  test('a plain step, a parallel group and a fan-out template, each treated as the spike treats it', () => {
    const parsed = flow();
    overrideAdapters(parsed, 'mock');

    expect(adapters(parsed)).toStrictEqual([
      'mock',         // the plain step that declared one
      'mock', 'mock', // the two parallel members that declared one
      undefined,      // the parallel member that did not — the engine's fallback chain still decides
      undefined,      // the step that did not
      undefined,      // the gate, which never had one
      undefined,      // the fan-out step itself, which declares none
      'codex',        // the fan-out's step: template, which this walk does not visit
    ]);
  });

  test('the fan-out template is the blind spot Q-0052 covers from the other side', () => {
    // `ctx.config.adapterOverride` (spike/src/engine.js:204) is what reaches a fan-out, and the CLI
    // sets it on the same line as this call. Preserved rather than closed here: closing it would be
    // a behaviour change, and it would then be closed twice.
    const parsed = flow();
    overrideAdapters(parsed, 'mock');
    const fanned = (parsed.steps ?? [])[4] as { step: { adapter: string } };
    expect(fanned.step.adapter).toBe('codex');
  });

  test('it mutates in place and answers nothing', () => {
    const parsed = flow();
    const before = parsed.steps;
    expect(overrideAdapters(parsed, 'mock')).toBeUndefined();
    expect(parsed.steps, 'the flow object is the same one the caller holds').toBe(before);
  });

  test('every other key of every step is left exactly as it was', () => {
    const parsed = flow();
    overrideAdapters(parsed, 'mock');
    expect(parsed.name).toBe('review');
    expect((parsed.steps ?? [])[0]).toStrictEqual({ id: 'declares', role: 'code-reviewer', adapter: 'mock' });
    expect((parsed.steps ?? [])[3]).toStrictEqual({ gate: 'human', reason: 'accept the review' });
  });

  test('a flow with no steps throws the same raw TypeError the spike throws', () => {
    // Preserved, not guarded: `flow.steps` is read with a plain `.` at spike/bin/harness.js:612, and
    // the engine reads it the same way three lines later. Q-0041 reported the underlying gap and
    // left it; closing it here would close it in one of the two places.
    const stepless = { consumes: 'green', produces: 'reviewed' } as Flow;
    expect(() => overrideAdapters(stepless, 'mock')).toThrow(TypeError);
  });

  test('the module touches no file and spawns nothing — it is a walk over an object', () => {
    const found = coreSourceFiles().find(([name]) => name === 'adapters/override.ts');
    expect(found, 'corpus missing: packages/core/src/adapters/override.ts').toBeDefined();
    const text = found?.[1] ?? '';
    for (const forbidden of ['node:fs', 'node:child_process', 'readFileSync', 'writeFileSync']) {
      expect(text.includes(forbidden), `override.ts must not contain ${forbidden}`).toBe(false);
    }
  });
});
