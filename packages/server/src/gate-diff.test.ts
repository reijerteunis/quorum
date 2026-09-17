/**
 * Q-0134 AC-2 and AC-4 to AC-7 — the diff a waiting gate's decision was made on.
 *
 * Over real runs of the mock adapter against repositories the fixtures build, for `host.test.ts`'s
 * reason: the claim is about a value crossing from the site a patch is produced at to the route that
 * answers with it, and a fixture that bound the evidence itself would prove only that the registry
 * hands back what it is handed.
 *
 * **R-2's constraint is the reason every fixture here builds a branch.** Every integration branch in
 * this repository's own backlog is contained in `main` — 42 of 42, re-measured at this ticket's gate
 * — so every diff range in it is empty and `materialiseDiff` refuses an empty range outright. There
 * is nothing here to demonstrate against. Each test therefore commits its own change on its own
 * branch, which is also what keeps a verdict a property of the commit rather than of the checkout
 * (2026-08-30).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, afterEach, describe, expect, test, vi } from 'vitest';

import { diffEvidenceSchema, type GateQuestionEvent, type WireRefusal } from '@quorum/shared';

import {
  DECIDING_DIFF_FLOW, commitOnBranch, fixture, removeTempDirs, tempDir, TICKET_ID,
} from '../test/fixture.js';
import { createApp } from './http.js';
import { createRunHost } from './host.js';
import type { RunHost } from './host.js';
import { DEFAULT_RETENTION } from './serve.js';
import { GATE_DIFF_REFUSAL_STATUS } from './wire.js';

afterAll(removeTempDirs);
afterEach(() => { vi.unstubAllEnvs(); });

/** The branch every fixture's range ends at — the ticket's own, which the range guard admits. */
const INTEGRATION = `harness/${TICKET_ID}/integration`;

/**
 * A token that appears in the change and nowhere else.
 *
 * What makes AC-4 assertable: a claim that no event carries the patch is only as good as the
 * needle, and a word from the fixture's own prose would be found in a prompt, a summary or a path.
 */
const MARKER = 'zzqq-patch-marker-0134';

/**
 * The same, for the change a SECOND diff site reads.
 *
 * Its own token rather than a reuse of {@link MARKER}, because the two-site clause below asserts
 * something no single needle can: that the gate was handed the deciding step's bytes **and** was not
 * handed the other site's. One marker proves the first half and is silent on the second, which is
 * exactly the shape that let a single-slot host pass for a round.
 */
const OTHER_MARKER = 'zzqq-other-site-marker-0134';

/** How long a poll waits before it says what never happened rather than hanging. */
const DEADLINE_MS = 10_000;

async function until(predicate: () => boolean, what: string): Promise<void> {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > DEADLINE_MS) throw new Error(`timed out waiting for ${what}`);
    await new Promise((resolve) => { setTimeout(resolve, 5); });
  }
}

/** One run parked at its gate, with the question it is parked on and the events it emitted. */
interface Parked {
  readonly host: RunHost;
  readonly handle: string;
  readonly question: GateQuestionEvent;
  readonly events: unknown[];
}

/**
 * Start one run over `flow` and wait until it is parked at a gate.
 *
 * `MOCK_ALWAYS_PASS` so the verdict is the passing one on the first call: the mock's counter is
 * module-scoped with no reset, so a fixture depending on being the first caller for a key would
 * have a verdict that depends on what ran before it in this file.
 */
async function parked(flow: string, prepare?: (repoDir: string) => void, config?: string): Promise<Parked> {
  vi.stubEnv('MOCK_ALWAYS_PASS', '1');
  const project = fixture(config === undefined ? { flow } : { flow, config });
  commitOnBranch(project.repoDir, INTEGRATION, 'changed.txt', `one\n${MARKER}\ntwo\n`);
  prepare?.(project.repoDir);
  const host = createRunHost({ project: project.project, retain: DEFAULT_RETENTION });
  const outcome = await host.start({ flow: project.flowName, ticket: TICKET_ID });
  if (!outcome.started) throw new Error(`the run did not start: ${outcome.refusal.condition}`);
  const subscription = host.subscribe(outcome.run.handle);
  if (!subscription) throw new Error('no subscription');
  const events: unknown[] = [];
  void (async () => { for await (const event of subscription.events) events.push(event); })();
  await until(() => (host.view(outcome.run.handle)?.gates.length ?? 0) > 0, 'the run to park at a gate');
  const question = host.view(outcome.run.handle)?.gates[0];
  if (!question) throw new Error('the run parked at no gate');
  return { host, handle: outcome.run.handle, question, events };
}

/** Let a parked run go, so nothing is left holding a lock when the suite moves on. */
async function release(run: Parked): Promise<void> {
  run.host.answer(run.handle, { gateId: run.question.gateId, answer: 'abort' });
  await run.host.shutdown();
}

/** The gate-diff path, built here rather than imported: the transport is what is under test. */
const diffPath = (handle: string, gateId: string): string =>
  `/runs/${encodeURIComponent(handle)}/gates/${encodeURIComponent(gateId)}/diff`;

describe('Q-0134 AC-2 — the evidence is the reviewing step\'s, and it survives the steps between', () => {
  test('a gate whose deciding step read the diff is answered that step\'s own bytes', async () => {
    const run = await parked(DECIDING_DIFF_FLOW);
    try {
      // The join is `reached.stepId`, so the question has to carry one for this to be about anything.
      expect(run.question.reached?.stepId, 'the question carried no decision — this check has lost its subject')
        .toBe('work');
      const found = run.host.gateDiff(run.handle, run.question.gateId);
      expect('evidence' in found, 'the gate was answered no diff at all').toBe(true);
      if (!('evidence' in found)) return;
      expect(found.evidence.stepId, 'the evidence names a step other than the one that decided')
        .toBe(run.question.reached?.stepId);
      // The INTERPOLATED range, which is what a reader pastes into a terminal — never the flow
      // file's `{base}...harness/{id}/integration` template.
      expect(found.evidence.range).toBe(`main...${INTEGRATION}`);
      expect(found.evidence.patch, 'the patch is not the change this fixture made').toContain(MARKER);
      expect(found.evidence.stat, 'the summary does not name the file that changed').toContain('changed.txt');
      expect(found.evidence.truncated).toBe(false);
      expect(found.evidence.kept).toBe(found.evidence.total);
    } finally {
      await release(run);
    }
  });

  test('a step that materialises no diff between the decision and the gate replaces nothing', async () => {
    // `chore.yaml`'s own shape: `integrate` runs between `review` and the owner gate and reads no
    // diff, so the gate this repository reaches most often is two steps from the step that was given
    // the patch. A design holding the evidence on the step rather than on the run would lose it here.
    const run = await parked(`name: probe
consumes: draft
produces: requirements
steps:
  - id: work
    input:
      backlog: ["dev/work.md"]
      diff: "{base}...harness/{id}/integration"
    output:
      write: dev/work.md
      verdict: approve|changes-requested
    on_fail:
      goto: work
      max_iterations: 1
      on_exhausted: gate
  - id: after
    output:
      write: dev/after.md
  - gate: human
    reason: approve to advance
`);
    try {
      expect(run.question.reached?.stepId, 'the intervening step displaced the decision').toBe('work');
      const found = run.host.gateDiff(run.handle, run.question.gateId);
      expect('evidence' in found, 'the evidence did not survive a step that read no diff').toBe(true);
      if ('evidence' in found) expect(found.evidence.stepId).toBe('work');
    } finally {
      await release(run);
    }
  });

  test('a run with two diff sites gives the gate its deciding step\'s own bytes, and never the other site\'s', async () => {
    // **The clause the review of round 1 was about, and it used to assert the defect.** The second
    // step reads a DIFFERENT range and declares nothing, and `preflightDiffs` materialises BOTH
    // before any step executes — one loop over every site whose endpoints already exist — so the
    // most recent report at the moment the gate is reached is `other`'s. A host holding one slot
    // therefore answered `no-diff`: a claim that `work` read no diff, about a step that read one and
    // whose patch the host was still holding. This clause required that answer, so the defect had a
    // test asserting it.
    //
    // What it asserts now is the join: the gate gets `work`'s bytes because its decision names
    // `work`, and `other`'s bytes never reach it. Both halves, because a clause checking only the
    // first passes over a host that hands out whatever it has last.
    const run = await parked(`name: probe
consumes: draft
produces: requirements
steps:
  - id: work
    input:
      backlog: ["dev/work.md"]
      diff: "{base}...harness/{id}/integration"
    output:
      write: dev/work.md
      verdict: approve|changes-requested
    on_fail:
      goto: work
      max_iterations: 1
      on_exhausted: gate
  - id: other
    input:
      diff: "{base}...harness/{id}/other"
    output:
      write: dev/other.md
  - gate: human
    reason: approve to advance
`, (repoDir) => { commitOnBranch(repoDir, `harness/${TICKET_ID}/other`, 'elsewhere.txt', `${OTHER_MARKER}\n`); });
    try {
      expect(run.question.reached?.stepId).toBe('work');
      const found = run.host.gateDiff(run.handle, run.question.gateId);
      expect('evidence' in found, 'the deciding step\'s diff was lost to the other site\'s').toBe(true);
      if (!('evidence' in found)) return;
      expect(found.evidence.stepId, 'the evidence is attributed to the wrong step').toBe('work');
      expect(found.evidence.range, 'the range is the other site\'s').toBe(`main...${INTEGRATION}`);
      expect(found.evidence.patch, 'the patch is not the change the deciding step read').toContain(MARKER);
      // The half one marker cannot assert: the other site's change is absent from the bytes and from
      // the summary, so this is the deciding step's materialisation rather than a blend of the two.
      expect(found.evidence.patch, 'the gate was served the other site\'s patch').not.toContain(OTHER_MARKER);
      expect(found.evidence.stat, 'the summary names the other site\'s file').not.toContain('elsewhere.txt');
      expect(found.evidence.stat).toContain('changed.txt');
    } finally {
      await release(run);
    }
  });

  test('the other site\'s snapshot is never served to the gate under its own step id either', async () => {
    // **The other direction of the same join, so the fix is a lookup rather than a widening.** The
    // gate is `work`'s; asking for it must not answer `other`'s bytes, and there is no second gate
    // for `other` to be read through — its step declares no verdict, so nothing it read is ever
    // fetchable. A host that filed both snapshots and then served whichever it found would pass the
    // clause above and fail this one.
    const run = await parked(`name: probe
consumes: draft
produces: requirements
steps:
  - id: other
    input:
      diff: "{base}...harness/{id}/other"
    output:
      write: dev/other.md
  - id: work
    input:
      backlog: ["dev/work.md"]
      diff: "{base}...harness/{id}/integration"
    output:
      write: dev/work.md
      verdict: approve|changes-requested
    on_fail:
      goto: work
      max_iterations: 1
      on_exhausted: gate
  - gate: human
    reason: approve to advance
`, (repoDir) => { commitOnBranch(repoDir, `harness/${TICKET_ID}/other`, 'elsewhere.txt', `${OTHER_MARKER}\n`); });
    try {
      // Declared FIRST this time, so the deciding site is the later report and the clause is not
      // passing merely because the last writer happened to be the right one.
      expect(run.question.reached?.stepId).toBe('work');
      const found = run.host.gateDiff(run.handle, run.question.gateId);
      expect('evidence' in found, 'the gate was answered no diff').toBe(true);
      if (!('evidence' in found)) return;
      expect(found.evidence.stepId).toBe('work');
      expect(found.evidence.patch).toContain(MARKER);
      expect(found.evidence.patch, 'the gate was served the other site\'s patch').not.toContain(OTHER_MARKER);
      // And it is not on the stream either, which is AC-4's property holding for a site no gate took.
      expect(JSON.stringify(run.events), 'the unclaimed site\'s patch reached the event stream')
        .not.toContain(OTHER_MARKER);
    } finally {
      await release(run);
    }
  });

  test('a panel over one range yields one snapshot, and it is that range\'s', async () => {
    // `review.yaml`'s shape for the range and not for the verdict: two members read the same range,
    // and the preflight materialises a range whose endpoints all exist exactly once — Q-0038 AC-10's
    // identical-bytes guarantee, which is what makes *one snapshot* a property rather than a
    // deduplication somebody wrote. The gate that follows names the step that DECIDED, which here is
    // the first member, so the join holds and the second member's own read never happened.
    const run = await parked(`name: probe
consumes: draft
produces: requirements
steps:
  - parallel:
      - id: work
        input:
          backlog: ["dev/work.md"]
          diff: "{base}...harness/{id}/integration"
        output:
          write: dev/work.md
          verdict: approve|changes-requested
        on_fail:
          goto: work
          max_iterations: 1
          on_exhausted: gate
      - id: second
        input:
          diff: "{base}...harness/{id}/integration"
        output:
          write: dev/second.md
  - gate: human
    reason: approve to advance
`);
    try {
      const found = run.host.gateDiff(run.handle, run.question.gateId);
      expect('evidence' in found, 'the panel\'s gate was answered no diff').toBe(true);
      if (!('evidence' in found)) return;
      expect(found.evidence.stepId, 'the snapshot is the second member\'s rather than the first\'s').toBe('work');
      expect(found.evidence.patch).toContain(MARKER);
    } finally {
      await release(run);
    }
  });
});

describe('Q-0134 AC-4 — no patch byte enters a retained event, proven at the cap', () => {
  test('a run whose diff is truncated emits no event carrying the patch', async () => {
    // The cap is configured small enough that a change this size exceeds it, so the run takes the
    // truncating branch: what AC-4 is about is a patch at its largest, and the largest a patch can
    // be is the limit.
    const run = await parked(DECIDING_DIFF_FLOW, undefined, 'adapterOverride: mock\nrepo:\n  base_branch: main\n  max_diff_bytes: 40\n');
    try {
      const found = run.host.gateDiff(run.handle, run.question.gateId);
      expect('evidence' in found, 'the fixture produced no evidence — this check has lost its subject').toBe(true);
      if (!('evidence' in found)) return;
      expect(found.evidence.truncated, 'the diff was not truncated, so this fixture is not at the cap').toBe(true);
      expect(found.evidence.limit).toBe(40);
      expect(found.evidence.kept).toBeLessThanOrEqual(40);
      expect(found.evidence.total).toBeGreaterThan(found.evidence.kept);

      // **The question first, field by field rather than by serialising it**: a patch smuggled onto
      // the union would be a key here, and `.strict()` at both levels is what refuses one.
      expect(JSON.stringify(run.question), 'the gate question carries the patch').not.toContain(MARKER);
      expect('diff' in run.question, 'the question gained a field for the diff').toBe(false);
      // …and then every event the run emitted, which is every event a late subscriber is replayed.
      await until(() => run.host.view(run.handle)?.gates.length === 1, 'the gate to be pending');
      expect(JSON.stringify(run.events), 'an event on the stream carries the patch').not.toContain(MARKER);
      // The retention is unchanged, which is the other half: the buffer still counts events.
      expect(DEFAULT_RETENTION).toBe(500);
    } finally {
      await release(run);
    }
  });
});

describe('Q-0134 AC-5 and AC-7 — one read-only route, and its four outcomes are distinct', () => {
  test('the route answers the evidence for a pending gate of that handle', async () => {
    const run = await parked(DECIDING_DIFF_FLOW);
    try {
      const app = createApp({ host: run.host });
      const response = await app.request(diffPath(run.handle, run.question.gateId));
      expect(response.status).toBe(200);
      // PARSED rather than cast, through the same schema a browser executes.
      const body = diffEvidenceSchema.parse(await response.json());
      expect(body.patch).toContain(MARKER);
      expect(body.stepId).toBe('work');
    } finally {
      await release(run);
    }
  });

  test('a handle nobody minted and a gate nobody asked are two codes, and neither answers a patch', async () => {
    // The two outcomes one run can produce. `not-this-run` needs two runs of one host and `no-diff`
    // needs a flow whose deciding step read none; each has its own test below, and the four are
    // compared as a set in the clause after them.
    const run = await parked(DECIDING_DIFF_FLOW);
    try {
      const app = createApp({ host: run.host });
      const seen: [string, WireRefusal][] = [];
      for (const [what, path] of [
        ['no-such-run', diffPath('run-nobody-minted', run.question.gateId)],
        ['no-such-gate', diffPath(run.handle, 'gate-nobody-asked')],
      ] as const) {
        const response = await app.request(path);
        expect(response.status, `${what} did not answer 404`).toBe(404);
        const refusal = await response.json() as WireRefusal;
        expect(refusal.code, `${what} answered another code`).toBe(what);
        // **Neither is an empty success and neither carries a patch field**, which is the half a
        // status alone does not say: a `200 {"patch": ""}` would be this route reporting *there is
        // nothing to show* and *here is nothing* in one shape.
        expect('patch' in refusal, `${what} answered a patch`).toBe(false);
        expect(refusal.condition.trim(), `${what} answered a blank condition`).not.toBe('');
        seen.push([what, refusal]);
      }
      expect(seen.map(([what]) => what)).toStrictEqual(['no-such-run', 'no-such-gate']);
      // Two codes and two sentences: a reader told the same thing twice cannot tell them apart.
      expect(new Set(seen.map(([, refusal]) => refusal.condition)).size,
        'the two refusals answer one sentence').toBe(2);
    } finally {
      await release(run);
    }
  });

  test('the four codes are four, and they are the table this route answers from', () => {
    // An identity rather than a count (Q-0073): a count is satisfied by a member swapped for
    // another, and what would go wrong here is exactly that — an outcome quietly folded into a
    // neighbour's code, which is how a gate that read no diff comes to be reported as one that does
    // not exist. The statuses agreeing is not the claim; the codes being four is.
    expect(Object.keys(GATE_DIFF_REFUSAL_STATUS).sort())
      .toStrictEqual(['no-diff', 'no-such-gate', 'no-such-run', 'not-this-run']);
    expect(new Set(Object.values(GATE_DIFF_REFUSAL_STATUS)), 'a refusal answers something other than 404')
      .toStrictEqual(new Set([404]));
  });

  test('a gate waiting on ANOTHER run of the same host is refused rather than served', async () => {
    // Two runs of one host, which is the only shape `not-this-run` can arise in: a gate id is unique
    // within a run and not across runs, and this is the distinction `gates.ts` already draws for an
    // answer. Asking the wrong run for somebody else's gate is told which mistake it made.
    vi.stubEnv('MOCK_ALWAYS_PASS', '1');
    const project = fixture({ flow: DECIDING_DIFF_FLOW });
    commitOnBranch(project.repoDir, INTEGRATION, 'changed.txt', `one\n${MARKER}\ntwo\n`);
    // A second ticket whose `runs.log` seeds a different run number, so the two gate ids differ.
    project.addTicket({ id: 'T-0002', folder: 'T-0002-second', runsLog: 'run=7 flow=probe start stage=draft\n' });
    commitOnBranch(project.repoDir, 'harness/T-0002/integration', 'other.txt', 'a second change\n');
    const host = createRunHost({ project: project.project, retain: DEFAULT_RETENTION });
    try {
      const one = await host.start({ flow: project.flowName, ticket: TICKET_ID });
      const two = await host.start({ flow: project.flowName, ticket: 'T-0002' });
      expect(one.started && two.started, 'a fixture run did not start').toBe(true);
      await until(
        () => (host.view(one.run.handle)?.gates.length ?? 0) > 0 && (host.view(two.run.handle)?.gates.length ?? 0) > 0,
        'both runs to park',
      );
      const theirs = host.view(two.run.handle)?.gates[0]?.gateId ?? '';
      const mine = host.view(one.run.handle)?.gates[0]?.gateId ?? '';
      expect(theirs, 'the two runs asked the same gate id — this check has lost its subject').not.toBe(mine);

      const app = createApp({ host });
      const response = await app.request(diffPath(one.run.handle, theirs));
      expect(response.status).toBe(404);
      expect((await response.json() as WireRefusal).code).toBe('not-this-run');
    } finally {
      for (const view of host.runs()) {
        const gate = view.gates[0];
        if (gate) host.answer(view.handle, { gateId: gate.gateId, answer: 'abort' });
      }
      await host.shutdown();
    }
  });

  test('a gate whose deciding step read no diff is told so, and it is not an empty patch', async () => {
    // `review.yaml`'s shape: the panel reads the range and the step that DECIDES reads none, its own
    // instruction being *"Judge the reviews, not the code diff"*. Attributing the panel's bytes to it
    // would be naming a step over evidence it never saw.
    const run = await parked(`name: probe
consumes: draft
produces: requirements
steps:
  - id: work
    input:
      backlog: ["dev/work.md"]
      diff: "{base}...harness/{id}/integration"
    output:
      write: dev/work.md
  - id: verdict
    input:
      backlog: ["dev/verdict.md"]
    output:
      write: dev/verdict.md
      verdict: approve|changes-requested
    on_fail:
      goto: verdict
      max_iterations: 1
      on_exhausted: gate
  - gate: human
    reason: approve to advance
`);
    try {
      expect(run.question.reached?.stepId, 'the deciding step is not the one this fixture is about').toBe('verdict');
      const app = createApp({ host: run.host });
      const response = await app.request(diffPath(run.handle, run.question.gateId));
      expect(response.status).toBe(404);
      const refusal = await response.json() as WireRefusal;
      expect(refusal.code).toBe('no-diff');
      expect('patch' in refusal, 'the refusal answered an empty patch').toBe(false);
      // It is an ANSWER, so the surface composes a remedy saying there is nothing to fetch rather
      // than leaving a reader to retry a read that cannot change.
      expect(refusal.remedy ?? '', 'the no-diff answer offers no sentence about what to do').not.toBe('');
    } finally {
      await release(run);
    }
  });

  test('Q-0122 — the static route does not swallow it, with a bundle actually mounted', async () => {
    // **The shape Q-0120's B-1 and Q-0122's two blockers were about, one segment deeper.**
    // `mountStatic` registers `GET /*` AHEAD of everything else and `createApp` with no bundle
    // registers nothing at all — so every route test in this package that builds a bare app is
    // testing a chain this route will not be in when the product runs. With a bundle mounted the
    // fallback is first, and what keeps this route reachable is that a `fetch` is not a navigation:
    // `isNavigationRequest` wants `text/html`, and a client asking for it would be handed the shell
    // with a 200. Both directions, so the pass is about the discrimination rather than about the
    // bundle being empty.
    const run = await parked(DECIDING_DIFF_FLOW);
    const bundle = tempDir('bundle-');
    fs.writeFileSync(path.join(bundle, 'index.html'), '<!doctype html><title>shell</title>');
    try {
      const app = createApp({ host: run.host, bundle });
      // The shell is really being served, so the clause below is about a route that had to get past
      // it rather than about a mount that does nothing.
      const page = await app.request('/runs', { headers: { accept: 'text/html' } });
      expect(page.status, 'the bundle is not mounted — this check has lost its subject').toBe(200);
      expect(page.headers.get('content-type')).toContain('text/html');

      const answered = await app.request(diffPath(run.handle, run.question.gateId));
      expect(answered.status).toBe(200);
      expect(answered.headers.get('content-type'), 'the gate diff was answered with the shell')
        .toContain('application/json');
      expect(diffEvidenceSchema.parse(await answered.json()).patch).toContain(MARKER);
    } finally {
      await release(run);
    }
  });

  test('the route takes a GET and nothing else, and no other method is routed on it', async () => {
    const run = await parked(DECIDING_DIFF_FLOW);
    try {
      const app = createApp({ host: run.host });
      for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
        const response = await app.request(diffPath(run.handle, run.question.gateId), { method });
        expect(response.status, `${method} is routed on the gate-diff path`).toBe(404);
      }
      // …and the GET still answers, so the four absences above are about the methods rather than
      // about a path nothing serves.
      expect((await app.request(diffPath(run.handle, run.question.gateId))).status).toBe(200);
    } finally {
      await release(run);
    }
  });
});

describe('Q-0134 AC-6 — the evidence lives exactly as long as the gate that owns it', () => {
  test('two reads while the gate waits return identical bytes', async () => {
    const run = await parked(DECIDING_DIFF_FLOW);
    try {
      const first = run.host.gateDiff(run.handle, run.question.gateId);
      const second = run.host.gateDiff(run.handle, run.question.gateId);
      expect(first).toStrictEqual(second);
      expect('evidence' in first, 'neither read answered anything').toBe(true);
    } finally {
      await release(run);
    }
  });

  test('answering the gate releases it, and the read afterwards says the gate is not waiting', async () => {
    const run = await parked(DECIDING_DIFF_FLOW);
    try {
      expect('evidence' in run.host.gateDiff(run.handle, run.question.gateId)).toBe(true);
      expect(run.host.answer(run.handle, { gateId: run.question.gateId, answer: 'abort' })).toBeNull();
      const after = run.host.gateDiff(run.handle, run.question.gateId);
      expect('refusal' in after, 'an answered gate still serves its diff').toBe(true);
      // `no-such-gate` rather than `no-diff`: the gate is gone, which is a different sentence from
      // *that gate is waiting and read nothing*.
      if ('refusal' in after) expect(after.refusal).toBe('no-such-gate');
    } finally {
      await run.host.shutdown();
    }
  });

  test('a preflight that stops the run after materialising an earlier site is not a refusal', async () => {
    // **The shape round 2's review was about, built so the answer is measured rather than argued.**
    // `preflightDiffs` walks every diff site before any step runs, so a flow whose SECOND site names
    // a ref that does not exist stops the run with the FIRST site's patch already reported to the
    // host. The review read that as reaching `begin`'s refusal path — the one exit `consume`'s
    // clean-up never covers, on a record nothing prunes. **It does not reach it**, and this fixture
    // is what says so: the start SUCCEEDS and the failure arrives afterwards, on the loop whose
    // `finally` clears the map.
    //
    // **Two mechanisms in `core` keep it on that path and either alone would be enough**, which is
    // why the `started` clause below is a recorded measurement rather than a guard anyone should
    // lean on: `runFlow` emits its `info` line above the preflight, and a run that fails emits its
    // terminal event before the error that closes the channel — `channel.ts`'s own documented
    // guarantee. The first pull is settled by whichever arrives, and a rejection needs both to have
    // been skipped, which is why the only refusals this host meets are the two its own header names
    // — the stage precondition and the run lock, neither of which reaches a diff. By mutation:
    // moving that emit below the preflight leaves this green, and making a closing error beat a
    // queued event leaves it green too. So the clean-up on the refusal exit is pinned by the source
    // clause below and not here.
    //
    // What each clause here can still fail on: the `runs.log` line, if the first site stops being
    // materialised before the second stops the run — the premise of the whole finding; the failure
    // text, if something other than the second site stops it; and `started`, if the refusal path
    // ever does become reachable with a patch in hand.
    vi.stubEnv('MOCK_ALWAYS_PASS', '1');
    const project = fixture({
      flow: `name: probe
consumes: draft
produces: requirements
steps:
  - id: work
    input:
      backlog: ["dev/work.md"]
      diff: "{base}...harness/{id}/integration"
    output:
      write: dev/work.md
      verdict: approve|changes-requested
    on_fail:
      goto: work
      max_iterations: 1
      on_exhausted: gate
  - id: later
    input:
      diff: "{base}...harness/{id}/nowhere"
    output:
      write: dev/later.md
  - gate: human
    reason: approve to advance
`,
      // Small enough that the first site TRUNCATES, which is the one thing a materialisation leaves
      // on disk: `runs.log` then names the range it cut. Without it the premise — a patch actually in
      // hand at the moment the run stopped — would be inferred from the flow file rather than
      // measured, and a clause resting on an inference is the shape this ticket keeps refusing.
      config: 'adapterOverride: mock\nrepo:\n  base_branch: main\n  max_diff_bytes: 40\n',
    });
    commitOnBranch(project.repoDir, INTEGRATION, 'changed.txt', `one\n${MARKER}\ntwo\n`);
    const host = createRunHost({ project: project.project, retain: DEFAULT_RETENTION });
    try {
      const outcome = await host.start({ flow: project.flowName, ticket: TICKET_ID });
      // **First, because it is the claim** — and because a refused start never reaches `ended`, so
      // asserting it after the wait below would report a ten-second timeout for a one-line answer.
      expect(outcome.started, 'the start was refused with a patch already reported — read the refusal clause below')
        .toBe(true);
      await until(() => host.view(outcome.run.handle)?.state === 'ended', 'the run to end');
      expect(project.runsLog(), 'the first site was never materialised — this check has lost its subject')
        .toContain(`diff truncated range=main...${INTEGRATION}`);
      expect(host.view(outcome.run.handle)?.failure ?? '', 'the run stopped on something other than the second site')
        .toContain(`harness/${TICKET_ID}/nowhere`);
    } finally {
      await host.shutdown();
    }
  });

  test('the releases nothing can observe are asserted over the source, and each discriminates', () => {
    // **The properties this package's own API cannot see, registered rather than left to a comment.**
    //
    // The first is `answer`'s: the pending gate is deleted before it is settled, so a read after an
    // answer says `no-such-gate` whether or not the bytes went with it — which means the behavioural
    // clause above passes over a registry that keeps a 200,000-byte patch until the run ends. The
    // second is R-3's: `observe` TRANSFERS the snapshot to the gate rather than copying it, and a
    // copy is correct in every answer this package gives and doubles what one run holds. The last two
    // are the run's two exits — an ended run and a refused start — each of which leaves a record
    // nothing prunes, and neither of which projects the map through `viewOf`.
    //
    // So the instrument is the source, in `q0050.source.test.ts`'s shape and on the immediate
    // precedent of Q-0123's own guard, which pins an eviction that no behaviour reaches either. Each
    // clause is shown discriminating against the same text with the line removed, so an absence here
    // is an absence rather than a needle that matches nothing.
    const here = path.dirname(fileURLToPath(import.meta.url));
    // From a declaration's head to the line that closes it, so a clause is about ONE function
    // rather than about a window of bytes: a fixed slice length is a clause that quietly stops
    // covering its subject the moment somebody writes a paragraph inside it.
    const body = (text: string, open: string, close: string): string => {
      const at = text.indexOf(open);
      expect(at, `${open} is not in the source — this clause has lost its subject`).toBeGreaterThan(-1);
      const end = text.indexOf(close, at);
      expect(end, `${open} is not closed by ${close.trim()} — this clause cannot bound its subject`)
        .toBeGreaterThan(at);
      return text.slice(at, end);
    };

    const gates = fs.readFileSync(path.join(here, 'gates.ts'), 'utf8');
    const answering = body(gates, 'answer(handle, envelope) {', '\n    },');
    const FORGETS_EVIDENCE = /evidence\.get\(handle\)\?\.delete\(gateId\)/;
    expect(FORGETS_EVIDENCE.test(answering), 'an answered gate keeps the patch it was decided on').toBe(true);
    expect(answering, 'the pending entry is no longer deleted here, so the pair is not a pair')
      .toMatch(/gates\.delete\(gateId\)/);
    expect(FORGETS_EVIDENCE.test(answering.replace(FORGETS_EVIDENCE, '')),
      'the needle matches text it was removed from').toBe(false);

    const host = fs.readFileSync(path.join(here, 'host.ts'), 'utf8');
    const observing = body(host, 'const observe =', '\n  };');
    // Re-aimed at the map's spelling and not weakened: the property is still *the run stops holding
    // the bytes the gate now holds*, and what changed is that the thing given up is one entry rather
    // than the whole slot. A `delete` keyed on the id that was just bound is what says the two are
    // the same snapshot; `record.evidence.clear()` here would forget the OTHER sites too, which is
    // the over-correction this clause also refuses by naming the key.
    const TRANSFERS = /record\.evidence\.delete\(reached\)/;
    expect(observing, 'the gate no longer takes the snapshot at all').toMatch(/bindEvidence/);
    expect(TRANSFERS.test(observing), 'the snapshot is copied to the gate rather than transferred').toBe(true);
    expect(TRANSFERS.test(observing.replace(TRANSFERS, '')), 'the needle matches text it was removed from').toBe(false);
    // **And the join is a lookup, not a comparison against the most recent report.** The defect this
    // clause now also covers was one line: `event.reached?.stepId === record.evidence.stepId` reads
    // as an identity test and is one — against whichever site reported last, which at the first gate
    // of a two-site run is never the deciding one. A `.get` on the reached id cannot make that
    // mistake, so the shape is what is pinned rather than the outcome.
    const LOOKUP = /record\.evidence\.get\(reached\)/;
    expect(LOOKUP.test(observing), 'the gate is matched against the most recent report rather than looked up')
      .toBe(true);
    expect(LOOKUP.test(observing.replace(LOOKUP, '')), 'the needle matches text it was removed from').toBe(false);

    // **The third unobservable property, and it is the one a map created.** A slot was emptied by the
    // gate that took it; a map can be left holding a site no gate ever claimed — `other` in the
    // two-site clauses above, and every site of a run that ended before its gate. Nothing this
    // package exposes can see that, `viewOf` projecting no such field and `records` never being
    // pruned (Q-0123), so the instrument is the source here too.
    const ending = body(host, 'const consume = async', '\n  };');
    const CLEARS = /record\.evidence\.clear\(\)/;
    expect(CLEARS.test(ending), 'a run that ended keeps the snapshots no gate took').toBe(true);
    expect(CLEARS.test(ending.replace(CLEARS, '')), 'the needle matches text it was removed from').toBe(false);
    expect(ending, 'the clean-up is no longer beside the gate release, so the pair is not a pair')
      .toMatch(/gates\.release\(record\.handle\)/);

    // **And the same on the run's other exit, which `consume` never reaches.** A refused start never
    // becomes `running`, so the loop above is never entered and its `finally` never fires — and a
    // refused record is kept like every other (Q-0123), so anything filed on it before the refusal is
    // held for the life of the process. Nothing this package exposes can see that either, and the
    // clause below is the only thing between it and a silent retention: what keeps the map EMPTY
    // there today is two orderings in `core` — measured by the behavioural test above — and neither
    // of them is this file's to keep.
    const refusing = body(host, 'const refused =', '\n  };');
    expect(CLEARS.test(refusing), 'a refused start keeps whatever the run had already reported').toBe(true);
    expect(CLEARS.test(refusing.replace(CLEARS, '')), 'the needle matches text it was removed from').toBe(false);
    expect(refusing, 'the clean-up is no longer beside the gate release on the refusal exit either')
      .toMatch(/gates\.release\(record\.handle\)/);
  });

  test('shutdown releases it, and a run that ended holds no patch afterwards', async () => {
    const run = await parked(DECIDING_DIFF_FLOW);
    expect('evidence' in run.host.gateDiff(run.handle, run.question.gateId)).toBe(true);
    await run.host.shutdown();
    const after = run.host.gateDiff(run.handle, run.question.gateId);
    expect('refusal' in after, 'a released run still serves its diff').toBe(true);
    // **The record survives and the gate does not**, which is the arrangement Q-0123 measured and
    // ruled: nothing is evicted, so the run is still listed and still viewable, and what goes is the
    // gate the patch was evidence for.
    expect(run.host.view(run.handle), 'the record was evicted, which Q-0123 rules it is not').not.toBeNull();
    expect(run.host.runs().map((view) => view.handle), 'the run left the listing').toContain(run.handle);
    // **A `JSON.stringify` over the listing stood here and is deliberately gone.** It read as a
    // claim that no run row carries the patch and could not fail: `viewOf` projects nine named
    // fields and `evidence` is not among them, so the needle had no way to reach the slot it was
    // written about. What can reach it is the source, and the clause above is where that is asked.
  });
});
