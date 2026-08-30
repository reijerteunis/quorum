import fs from 'node:fs';
import path from 'node:path';

import { afterAll, afterEach, describe, expect, test, vi } from 'vitest';

import { OUTPUT_FILE, PROMPT_FILE } from '@quorum/shared';

import { removeTempDirs, write } from '../../test/repo.js';
import {
  manifestOf, occurrenceFile, recordHistory, runFixture, stubAdapter,
} from '../../test/run-fixture.js';
import type { AdapterError } from '../adapters/adapters.js';

afterAll(removeTempDirs);
afterEach(() => { vi.restoreAllMocks(); });

/** Usage a vendor genuinely reported, so an assertion on it is distinguishable from an absent one. */
const BILLED = {
  vendor: 'stub', input_tokens: 1200, output_tokens: 34, cost_usd: 0.25,
  cached_input_tokens: null, cache_write_input_tokens: null,
};

/** A `harness.yaml` that names no adapter at all, which is what AC-4c turns on. */
const NO_OVERRIDE = 'repo:\n  base_branch: main\n';

describe('Q-0052 AC-4b/AC-4c — which adapter a step resolves to', () => {
  const ROLE = '---\nadapter: codex\nmodel: gpt-5\n---\nA role.\n';

  async function resolved(config: string, step: Record<string, unknown>): Promise<string[]> {
    const fixture = runFixture({ config });
    fixture.role('reviewer', ROLE);
    fixture.steps([step]);
    const stub = stubAdapter(() => ({ output: { summary: 's' }, raw: '{}', usage: BILLED }));
    await fixture.settle();
    return stub.names;
  }

  test('AC-4b — the run\'s override, then the step\'s, then the role\'s, then claude', async () => {
    // All four levels populated, then each removed in turn: a precedence table asserted at one
    // level only is satisfied by three of the four possible implementations.
    expect(await resolved('adapterOverride: mock\n', { id: 'r', role: 'reviewer', adapter: 'claude' })).toStrictEqual(['mock']);
    expect(await resolved(NO_OVERRIDE, { id: 'r', role: 'reviewer', adapter: 'claude' })).toStrictEqual(['claude']);
    expect(await resolved(NO_OVERRIDE, { id: 'r', role: 'reviewer' })).toStrictEqual(['codex']);
    expect(await resolved(NO_OVERRIDE, { id: 'r' })).toStrictEqual(['claude']);
  });

  test('AC-4c — a harness.yaml with no adapterOverride resolves the role\'s adapter, not "undefined"', async () => {
    // `projectConfigSchema` is a looseObject declaring no `adapterOverride`, so the value arrives
    // typed `unknown` — and `String(undefined)` is the string "undefined". Red against a coercion:
    // the name below would be "undefined" and, with the real registry, the run would fail with
    // `unknown adapter "undefined"` on every project that omits the key.
    expect(await resolved(NO_OVERRIDE, { id: 'r', role: 'reviewer' })).toStrictEqual(['codex']);
  });

  test('AC-4c — and the same run reaches a real adapter rather than an unknown one', async () => {
    // The registry left in place, so the failure a coercion causes is the failure this observes:
    // `getAdapter` refuses an unknown name, and a run resolving `undefined` cannot complete.
    const fixture = runFixture({ config: NO_OVERRIDE });
    fixture.role('reviewer', '---\nadapter: mock\n---\nA role.\n');
    fixture.steps([{ id: 'r', role: 'reviewer' }]);

    const { events, error } = await fixture.settle();

    expect(error).toBeUndefined();
    expect(events.at(-1)).toMatchObject({ type: 'terminal', status: 'completed' });
    expect(manifestOf(fixture.repoDir).steps[0]?.adapter).toBe('mock');
  });

  test('AC-4d — no model is defaulted, and the role\'s does not cross to another vendor', async () => {
    const fixture = runFixture({ config: 'adapterOverride: mock\n' });
    fixture.role('reviewer', ROLE);
    fixture.steps([{ id: 'r', role: 'reviewer' }]);
    const stub = stubAdapter(() => ({ output: { summary: 's' }, raw: '{}', usage: BILLED }));

    await fixture.settle();

    // The role's adapter is `codex` and the run resolved `mock`, so the role's `gpt-5` must not
    // travel — the CLI picks a model its own login supports.
    expect(stub.calls[0]?.model).toBeUndefined();
    expect(manifestOf(fixture.repoDir).steps[0]?.model).toBeNull();
  });
});

describe('Q-0052 AC-5 — the agent step\'s order of operations', () => {
  test('AC-5a — prompt.txt is on disk before the vendor is invoked', async () => {
    // Asserted from INSIDE the adapter call, which is what makes the ordering the subject: a test
    // reading the file afterwards passes whether it was written before the call or after it.
    const fixture = runFixture();
    fixture.steps([{ id: 'implement' }]);
    let promptWhenInvoked: string | null = null;
    stubAdapter(() => {
      const file = occurrenceFile(fixture.repoDir, 1, 'implement', PROMPT_FILE);
      promptWhenInvoked = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
      const failure = new Error('vendor died') as AdapterError;
      failure.usage = BILLED;
      throw failure;
    });

    const { error } = await fixture.settle();

    expect(error).toBeInstanceOf(Error);
    expect(promptWhenInvoked).toContain('# Ticket Q-0052: agent, gate and script steps');
  });

  test('AC-5b — a failure with nothing to show still writes output.txt, empty, from the step itself', async () => {
    // The file exists either way, because `RunHistory.terminal` guarantees one — which is Q-0034's
    // other half and would make a disk assertion here unable to fail. What discriminates is WHICH
    // call wrote it, so the persist calls are recorded: behind `if (e.raw != null)` the step makes
    // none and only the terminal guarantee fires.
    const history = recordHistory();
    const fixture = runFixture();
    fixture.steps([{ id: 'implement' }]);
    stubAdapter(() => {
      const failure = new Error('vendor died with no answer') as AdapterError;
      failure.usage = BILLED;
      throw failure;
    });

    await fixture.settle();

    expect(history.persisted.map(([, name]) => name)).toStrictEqual([PROMPT_FILE, OUTPUT_FILE]);
    expect(history.persisted[1]?.[2]).toBe('');
    expect(fs.readFileSync(occurrenceFile(fixture.repoDir, 1, 'implement', OUTPUT_FILE), 'utf8')).toBe('');
  });

  test('AC-5b — a failed call is billed, closed failed, and its FAILED line names the cost', async () => {
    const fixture = runFixture();
    fixture.steps([{ id: 'implement' }]);
    stubAdapter(() => {
      const failure = new Error('vendor died\nsecond line nobody logs') as AdapterError;
      failure.usage = BILLED;
      failure.attempts = 3;
      throw failure;
    });

    const { error } = await fixture.settle();

    expect((error as Error).message).toBe('vendor died\nsecond line nobody logs');
    const occurrence = manifestOf(fixture.repoDir).steps[0];
    expect(occurrence).toMatchObject({ status: 'failed', attempts: 3, usage: BILLED });
    expect(occurrence?.error?.category).toBe('adapter');
    const log = fs.readFileSync(path.join(fixture.ticketDir, 'runs.log'), 'utf8');
    expect(log).toContain('step=implement vendor=mock model=- FAILED cost=0.25 error="vendor died"');
  });

  test('AC-5c — billed usage is stamped the moment the vendor returns, above everything that can throw', async () => {
    // The requirement's own sketch — valid usage with an output the schema refuses — CANNOT
    // discriminate here, and it was measured rather than assumed: the schema-failure branch passes
    // `usage` to `terminalOccurrence` itself, so the manifest carries it whether or not the stamp
    // above ever ran. Moving the stamp below the check leaves that test green.
    //
    // What only the stamp can supply is the usage of a call that dies BELOW the check, where the
    // run's own catch closes the occurrence with an error and no usage of its own. A ticket write
    // that throws is that window. Red against a stamp moved under the check: `usage: null` for a
    // call the vendor already charged, dropped from the roll-up — Q-0034's defect exactly.
    const fixture = runFixture();
    fixture.steps([{ id: 'implement', output: { write: 'dev/report.md' } }]);
    stubAdapter(() => ({ output: { summary: 's', document: '# d\n' }, raw: '{}', usage: BILLED, attempts: 2 }));
    vi.spyOn(fixture.opts.backlog, 'writeFile').mockImplementation(() => { throw new Error('no space left on device'); });

    const { error } = await fixture.settle();

    expect(error).toBeInstanceOf(Error);
    const manifest = manifestOf(fixture.repoDir);
    expect(manifest.steps[0]).toMatchObject({ status: 'failed', attempts: 2, usage: BILLED });
    // …and the roll-up sees it, which is what the stamp is for.
    expect(manifest.rollup).toStrictEqual([expect.objectContaining({ vendor: 'stub', cost_usd: 0.25 })]);
  });

  test('AC-5c — and a call the schema rejects is billed too, through its own terminal write', async () => {
    // The row the sketch describes, kept for what it does prove: a step that fails validation is
    // still a step the vendor charged for.
    const fixture = runFixture();
    fixture.steps([{ id: 'implement' }]);
    stubAdapter(() => ({ output: { nothing: 'the schema asked for' }, raw: 'raw text', usage: BILLED }));

    const { error } = await fixture.settle();

    expect(error).toBeInstanceOf(Error);
    const occurrence = manifestOf(fixture.repoDir).steps[0];
    expect(occurrence?.usage).toStrictEqual(BILLED);
    expect(occurrence?.status).toBe('failed');
    expect(occurrence?.error?.category).toBe('structured_output');
  });

  test('AC-5d — invalid structured output stops the run and says where the raw answer is', async () => {
    const fixture = runFixture();
    fixture.steps([{ id: 'implement' }]);
    stubAdapter(() => ({ output: { summary: 5 }, raw: 'the vendor\'s unusable answer', usage: BILLED }));

    const { error } = await fixture.settle();

    const message = (error as Error).message;
    expect(message).toContain('implement: structured output invalid');
    expect(message).toContain('"summary" must be a non-empty string');
    // The dump path is IN the message, and the file at that path holds the raw text — a message
    // naming a path that is not there is what "errors are explicit" exists to prevent.
    const dump = /Raw saved to (\S+)$/.exec(message)?.[1];
    expect(dump).toBeDefined();
    expect(dump!.startsWith(path.join(fixture.ticketDir, '.harness'))).toBe(true);
    expect(fs.readFileSync(dump!, 'utf8')).toBe('the vendor\'s unusable answer\n');
    expect(fs.readFileSync(occurrenceFile(fixture.repoDir, 1, 'implement', OUTPUT_FILE), 'utf8')).toBe('the vendor\'s unusable answer');
  });

  test('AC-5d — a missing key, a bad enum member and an undeclared property each stop the step', async () => {
    const step = { id: 'review', output: { verdict: 'approve|reject' } };
    const cases: [string, Record<string, unknown>, RegExp][] = [
      ['a missing required key', { summary: 's', verdict: 'approve' }, /missing "findings"/],
      ['an invalid enum member', { summary: 's', verdict: 'maybe', findings: ['nit: a.ts:1 x'] }, /"verdict" must be one of approve\|reject/],
      ['an undeclared property', { summary: 's', verdict: 'approve', findings: [], extra: 1 }, /unknown "extra"/],
    ];
    for (const [label, output, expected] of cases) {
      const fixture = runFixture();
      fixture.steps([step]);
      stubAdapter(() => ({ output, raw: JSON.stringify(output), usage: BILLED }));
      const { error } = await fixture.settle();
      expect((error as Error | undefined)?.message, label).toMatch(expected);
      vi.restoreAllMocks();
    }
  });

  test('AC-5e — the schema validated against IS the schema sent, not a second derivation', async () => {
    // Identity made observable: the stub MUTATES the schema object it was handed, adding a required
    // property, and then answers without it. If validation re-derived the schema the run would
    // complete; it can only fail if the same object reached `checkAgainstSchema`.
    const fixture = runFixture();
    fixture.steps([{ id: 'implement' }]);
    const stub = stubAdapter((options) => {
      options.schema.properties = { ...options.schema.properties, planted: { type: 'string' } };
      options.schema.required = [...(options.schema.required ?? []), 'planted'];
      return { output: { summary: 's' }, raw: '{}', usage: BILLED };
    });

    const { error } = await fixture.settle();

    expect((error as Error | undefined)?.message).toContain('missing "planted"');
    expect(stub.calls[0]?.schema.required).toContain('planted');
  });
});

describe('Q-0052 AC-10 — the occurrence seam is widened, and no occurrence is orphaned', () => {
  test('AC-10b/10d — an occurrence allocated and never closed is finalised by the run\'s catch', async () => {
    // The failure has to land BETWEEN allocation and the step's own terminal write, or the step
    // closes the occurrence itself and the test passes over an unregistered allocator. A ticket
    // write that throws is exactly that window. Red against an allocator that does not register:
    // the occurrence stays `running` in the manifest, which is the state E-22 describes.
    const fixture = runFixture();
    fixture.steps([{ id: 'implement', output: { write: 'dev/report.md' } }]);
    stubAdapter(() => ({ output: { summary: 's', document: '# doc\n' }, raw: '{}', usage: BILLED }));
    vi.spyOn(fixture.opts.backlog, 'writeFile').mockImplementation(() => { throw new Error('no space left on device'); });

    const { error } = await fixture.settle();

    expect(error).toBeInstanceOf(Error);
    const occurrence = manifestOf(fixture.repoDir).steps[0];
    expect(occurrence?.status).toBe('failed');
    // The full cause, not the 200-character note runs.log carries — a manifest reader has only this.
    expect(occurrence?.error?.message).toBe('no space left on device');
  });

  test('AC-10c — a completed occurrence is not closed a second time by a later failure', async () => {
    // Counted through the recorder rather than read off the manifest: `RunHistory.terminal` ignores
    // an occurrence it has already closed, so the manifest looks identical whether or not the
    // engine de-registers. What differs is the number of calls.
    const history = recordHistory();
    const fixture = runFixture();
    fixture.steps([{ id: 'first' }, { id: 'second' }]);
    stubAdapter((_options, call) => {
      if (call === 2) throw new Error('the second step dies');
      return { output: { summary: 's' }, raw: '{}', usage: BILLED };
    });

    await fixture.settle();

    expect(history.terminated).toStrictEqual([['first', 'completed'], ['second', 'failed']]);
    expect(manifestOf(fixture.repoDir).steps.map((step) => step.status)).toStrictEqual(['completed', 'failed']);
  });

  test('AC-10e — the run\'s own artifacts are the only things written under .quorum/', async () => {
    const fixture = runFixture();
    fixture.steps([{ id: 'implement' }]);
    stubAdapter(() => ({ output: { summary: 's' }, raw: 'the answer', usage: BILLED }));

    await fixture.settle();

    const occurrenceDir = path.dirname(occurrenceFile(fixture.repoDir, 1, 'implement', OUTPUT_FILE));
    expect(fs.readdirSync(occurrenceDir).sort()).toStrictEqual([OUTPUT_FILE, PROMPT_FILE]);
    expect(fs.readFileSync(path.join(occurrenceDir, OUTPUT_FILE), 'utf8')).toBe('the answer');
  });

  test('an occurrence records the branch it ran on and a REPOSITORY-RELATIVE worktree', async () => {
    // The step hands the writer an ABSOLUTE cwd and the writer relativises it, answering `null` for
    // the repository root — so passing the absolute path is the contract rather than an oversight.
    // A step that passed the already-relative path would write a path relative to the wrong root,
    // and a step that special-cased the root itself would duplicate a rule that already has an
    // owner. Both rows, because `null` alone is satisfied by a field nobody sets.
    const fixture = runFixture();
    fixture.steps([{ id: 'plain' }, { id: 'coding', worktree: true }]);
    stubAdapter(() => ({ output: { summary: 's' }, raw: '{}', usage: BILLED }));

    await fixture.settle();

    expect(manifestOf(fixture.repoDir).steps.map((step) => [step.step_id, step.branch, step.worktree]))
      .toStrictEqual([
        ['plain', null, null],
        ['coding', 'harness/Q-0052/coding', '.harness/worktrees/harness__Q-0052__coding'],
      ]);
  });

  test('a run whose history cannot be initialised allocates nothing and invokes nothing', async () => {
    // AC-13d. The refusal is the writer's — a run directory that already exists — and what this
    // asserts is what the engine does with it: a terminal runs.log line, no adapter call, no step.
    const fixture = runFixture();
    fixture.steps([{ id: 'implement' }]);
    const stub = stubAdapter(() => ({ output: { summary: 's' }, raw: '{}', usage: BILLED }));
    write(path.join(fixture.repoDir, '.quorum/runs/Q-0052-1/manifest.json'), '{}');

    const { events, error } = await fixture.settle();

    expect((error as Error).message).toContain('run directory allocation refused');
    expect(stub.calls).toStrictEqual([]);
    expect(events.at(-1)).toMatchObject({ type: 'terminal', status: 'failed', stageAfter: 'requirements' });
    const log = fs.readFileSync(path.join(fixture.ticketDir, 'runs.log'), 'utf8');
    expect(log).toMatch(/run=1 failed stage=requirements→requirements/);
  });
});
