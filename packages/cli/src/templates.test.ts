/**
 * Q-0093 AC-4 — `packages/cli/templates/harness` mirrors what this repository runs, and it cannot
 * go stale.
 *
 * **Why byte identity is the whole assertion, and no second scoping check is owed.** What the ticket
 * cares about is that an adopter's first `harness/flows` carries the scoped write paths Q-0086,
 * Q-0087 and Q-0088 landed — every rewritable artifact named by `{run}`, plus `{iter}` where a
 * bounded loop can re-enter, and four flat paths surviving only as pointers beside a scoped copy.
 * That property is guarded by a chain, and this file is the front of it:
 *
 *   1. `packages/cli/templates/harness/flows` ≡ `harness/flows`, **here**, and the same for
 *      `roles/code-reviewer.md`, which is the rest of the byte-shared set;
 *   2. `harness/flows` carries the scoping rule, by `packages/shared/src/flow.test.ts`'s
 *      Q-0086/Q-0087 guard.
 *
 * **Q-0107 AC-14 took the middle link out.** The chain was three links: this file compared the
 * shipped tree against `spike/templates/harness`, and `packages/core/src/lint/lint.test.ts`'s
 * `SHIPPED` pair carried `spike/templates/harness/flows` ≡ `harness/flows`. Q-0103 deletes that
 * tree, so both ends were re-aimed at each other in one change rather than one end being left
 * pointing at nothing — and `lint.test.ts`'s pair is now the same two directories, asserting that
 * they produce the same `validateFlowDirectory` records where this asserts the bytes.
 *
 * A third assertion re-describing the scoping over this copy would be a second description of a
 * property already checked, which is the drift this repository keeps finding. The chain is written
 * here so a reviewer can walk it, and if a link stops holding that is a finding rather than a
 * licence to add the missing assertion here (Q-0093 merged.md R-10).
 *
 * **Q-0101 AC-9 re-homes one assertion here**, and it is not a second description of the chain
 * above. `smoke.js:216` claims that no shipped flow or role pins a vendor model name, over the
 * spike's own template tree; byte identity carries that claim onto this mirror only for as long as
 * the spike exists, and the cutover deletes it. So the claim is made about the corpus that survives
 * — the one an adopter's first `quorum init` copies — rather than inherited from a tree that will
 * not be there to compare against.
 *
 * The reads this file makes outside its own package — `harness/flows` and
 * `harness/roles/code-reviewer.md` — are declared in `packages/cli/turbo.json` and registered in
 * `package.test.ts`'s `OUTSIDE` pair, which is what keeps a cache hit on this package's `test`
 * honest (Q-0072).
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, test } from 'vitest';

/** This package's own root, reached package-relatively rather than by climbing to a repository. */
const PACKAGE = fileURLToPath(new URL('..', import.meta.url));

/** The workspace root, which is this package's grandparent. */
const WORKSPACE = path.resolve(PACKAGE, '..', '..');

/** This package's asset directory — the tree `quorum init` copies. */
const SHIPPED_TEMPLATES = path.join(PACKAGE, 'templates', 'harness');

/**
 * The byte-shared set, as `[what it is, this repository's copy, the shipped copy]`.
 *
 * Q-0107 AC-14 — `re-aimed`. This file compared `SHIPPED_TEMPLATES` against
 * `spike/templates/harness` as a WHOLE TREE, which was link 1 of a three-link chain; link 2 was
 * `spike/templates/harness/flows` ≡ `harness/flows`, read at the foot of this file. Q-0103 deletes
 * the middle link, so the chain becomes one comparison — and it is a comparison of the shared SET
 * rather than of two trees, because only part of an adopter's template tree has a counterpart here:
 * `harness.yaml`, `rules.md`, `architecture.md`, `product-context.md` and the developer roles
 * describe an adopter's project and must NOT acquire Quorum's own dogfood paths
 * (`docs/04-architecture.md` §Roles). What is shared is the flows and `code-reviewer.md`, and that
 * is what this asserts.
 */
const BYTE_SHARED: readonly [string, string, string][] = [
  ['the flow directory', path.join(WORKSPACE, 'harness', 'flows'), path.join(SHIPPED_TEMPLATES, 'flows')],
  [
    'the code-reviewer role',
    path.join(WORKSPACE, 'harness', 'roles', 'code-reviewer.md'),
    path.join(SHIPPED_TEMPLATES, 'roles', 'code-reviewer.md'),
  ],
];

/**
 * Every file below `root`, relative to it with `/` separators, sorted.
 *
 * A single file answers `['']`, so {@link differences} compares a file pair by the same code path
 * as a directory pair — which is what lets the code-reviewer role and the flow directory be one
 * register rather than two assertions with two shapes.
 */
function filesUnder(root: string): string[] {
  if (fs.statSync(root).isFile()) return [''];
  const found: string[] = [];
  const walk = (directory: string): void => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) found.push(path.relative(root, full).split(path.sep).join('/'));
      else throw new Error(`${path.relative(root, full)} is neither a file nor a directory — a template tree holds neither`);
    }
  };
  walk(root);
  return found.sort();
}

/**
 * Everything that stops `left` and `right` being the same tree, one sentence each.
 *
 * A function over its two roots rather than assertions over the shipped pair, so it can be shown
 * red over copies — "a check is not established by reading it" (2026-08-29), and R-2 names the two
 * shapes to avoid: a tree compared to itself through a mis-joined path, and a name-set comparison
 * claiming to be a byte comparison. Both directions of the name set are reported separately,
 * because a copy that gained a file and one that lost a file are different failures.
 *
 * Q-0107 AC-14 changed only which side is which in the two name-set messages: `left` was the
 * spike's tree and is this repository's own copy now.
 */
function differences(left: string, right: string): string[] {
  const problems: string[] = [];
  const here = filesUnder(left);
  const there = filesUnder(right);
  const at = (root: string, name: string): string => (name === '' ? root : path.join(root, ...name.split('/')));
  for (const name of here.filter((entry) => !there.includes(entry))) problems.push(`${name}: in this repository's copy and not in the shipped one`);
  for (const name of there.filter((entry) => !here.includes(entry))) problems.push(`${name}: in the shipped copy and not in this repository's`);
  for (const name of here.filter((entry) => there.includes(entry))) {
    const a = fs.readFileSync(at(left, name));
    const b = fs.readFileSync(at(right, name));
    if (!a.equals(b)) problems.push(`${name}: the two trees differ by ${String(Math.abs(a.length - b.length))} bytes or more`);
  }
  return problems;
}

/**
 * The `flows` and `roles` files below `root` that pin a vendor model name, named rather than counted.
 *
 * Q-0101 AC-9. A function over its root so the mutation can be shown on a copy — *"a check is not
 * established by reading it"* (2026-08-29) — and returning the offenders so a red run says which
 * file rather than how many. The pattern is `smoke.js:216`'s, unchanged: a `model:` key whose value
 * begins `gpt-`, anchored per line.
 */
const pinning = (root: string): string[] =>
  ['flows', 'roles']
    .flatMap((kind) => filesUnder(path.join(root, kind)).map((name) => `${kind}/${name}`))
    .filter((relative) => /^\s*model:\s*gpt-/m.test(fs.readFileSync(path.join(root, ...relative.split('/')), 'utf8')))
    .sort();

const sandboxes: string[] = [];
afterAll(() => {
  for (const dir of sandboxes.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

/** A throwaway pair of copies of the shipped tree, so a mutation is demonstrated on neither tree. */
function copies(): { left: string; right: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'quorum-cli-templates-'));
  sandboxes.push(root);
  const left = path.join(root, 'left');
  const right = path.join(root, 'right');
  fs.cpSync(SHIPPED_TEMPLATES, left, { recursive: true });
  fs.cpSync(SHIPPED_TEMPLATES, right, { recursive: true });
  return { left, right };
}

describe('AC-4 — the shipped template tree carries this repository\'s, byte for byte, both ways', () => {
  test('the twenty files exist at packages/cli/templates/harness, at the depth 078(e) fixes', () => {
    // An identity rather than a count (Q-0073): a role silently renamed leaves this red rather than
    // passing on twenty. The depth is the criterion's other half — `path.join(here, '..')` from the
    // emitted binary is the package root, so the tree sits directly under it.
    expect(filesUnder(SHIPPED_TEMPLATES)).toStrictEqual([
      'architecture.md',
      'flows/chore.yaml',
      'flows/development.yaml',
      'flows/qa-red.yaml',
      'flows/requirements.yaml',
      'flows/review.yaml',
      'flows/solutioning.yaml',
      'harness.yaml',
      'product-context.md',
      'roles/architecture-reviewer.md',
      'roles/automation-qa.md',
      'roles/code-reviewer.md',
      'roles/developer-backend.md',
      'roles/developer-data.md',
      'roles/developer-frontend.md',
      'roles/developer-generalist.md',
      'roles/head-of-product.md',
      'roles/principal-architect.md',
      'roles/product-manager.md',
      'rules.md',
    ]);
    expect(path.resolve(SHIPPED_TEMPLATES, '..', '..')).toBe(path.resolve(PACKAGE));
  });

  test('and the byte-shared set is byte-identical, which is what stops it going stale', () => {
    for (const [what, here, shipped] of BYTE_SHARED) {
      expect(differences(here, shipped), what).toStrictEqual([]);
      // Both sides exist and neither walk is empty, so the comparison above is not two empty lists.
      expect(filesUnder(here).length, `${what}: this repository's copy is empty`).toBeGreaterThan(0);
      expect(filesUnder(shipped).length, `${what}: the counts differ`).toBe(filesUnder(here).length);
    }
    // The flow half is six files, named rather than counted, so a flow silently dropped from BOTH
    // sides leaves this red rather than passing on an agreed-upon absence.
    expect(filesUnder(BYTE_SHARED[0][2])).toStrictEqual([
      'chore.yaml', 'development.yaml', 'qa-red.yaml', 'requirements.yaml', 'review.yaml', 'solutioning.yaml',
    ]);
  });

  test('one byte in one flow is enough to fail it, in either tree', () => {
    // R-2: shown red before it is trusted, and over copies rather than over either shipped tree.
    // A single byte, in a flow file, because a diff of names alone would not see it.
    const { left, right } = copies();
    const flow = path.join(right, 'flows', 'chore.yaml');
    fs.writeFileSync(flow, `${fs.readFileSync(flow, 'utf8')} `);
    expect(differences(left, right)).toStrictEqual(['flows/chore.yaml: the two trees differ by 1 bytes or more']);
    expect(differences(right, left), 'the comparison is not symmetric').toHaveLength(1);
  });

  test('and so is a file gained or lost, which are two failures and not one', () => {
    const { left, right } = copies();
    fs.rmSync(path.join(right, 'roles', 'automation-qa.md'));
    fs.writeFileSync(path.join(right, 'roles', 'invented.md'), '# invented\n');
    expect(differences(left, right)).toStrictEqual([
      'roles/automation-qa.md: in this repository\'s copy and not in the shipped one',
      'roles/invented.md: in the shipped copy and not in this repository\'s',
    ]);
  });

  test('a single-file pair is compared by the same code path, and one byte fails it', () => {
    // The code-reviewer row is a file rather than a directory, and `filesUnder` answering `['']`
    // is what lets one register hold both shapes. Shown red over copies rather than read: a
    // file-pair comparison that silently walked nothing would report no differences over any
    // mutation, which is the first shape R-2 names, arriving through the new branch.
    const { left, right } = copies();
    const role = (root: string): string => path.join(root, 'roles', 'code-reviewer.md');
    expect(differences(role(left), role(right)), 'two copies of one file agree').toStrictEqual([]);
    fs.writeFileSync(role(right), `${fs.readFileSync(role(right), 'utf8')} `);
    expect(differences(role(left), role(right)))
      .toStrictEqual([': the two trees differ by 1 bytes or more']);
  });

  test('the comparison cannot be satisfied by a tree compared with itself', () => {
    // The second shape R-2 names. A mis-joined path that resolved both sides to one directory would
    // report no differences over any mutation at all, so the mutation above is run with both roots
    // pointing at the same copy and required to report nothing — which is what makes the *first*
    // demonstration evidence rather than coincidence.
    const { right } = copies();
    const flow = path.join(right, 'flows', 'chore.yaml');
    fs.writeFileSync(flow, `${fs.readFileSync(flow, 'utf8')} `);
    expect(differences(right, right), 'a tree differs from itself').toStrictEqual([]);
  });

  // Q-0107 AC-14 removed a test called *"link 2 of the chain holds today, read rather than
  // assumed"*. It compared `spike/templates/harness/flows` against `harness/flows` — the middle
  // link of the three-link chain this file's header used to describe — so that the sufficiency
  // argument had a subject in this suite as well as in `lint.test.ts`'s. There is no middle link
  // now: the byte comparison at the top of this describe IS that pair, so the test would have been
  // a second description of the assertion above it rather than a check on a different one.

  test('Q-0101 AC-9 — no shipped flow or role pins a vendor model name', () => {
    // Re-homed from `smoke.js:216` rather than translated: that assertion reads
    // `spike/templates/harness/{flows,roles}`, which the cutover deletes, and the claim is about the
    // corpus an adopter's first `quorum init` copies — which since Q-0093 is this package's mirror.
    // A name goes stale, and one that works on an API key is rejected on a subscription (Q-0001:
    // codex 0.149.0 rejected every `gpt-5*`).
    //
    // **The walk is recursive**, which is strictly stronger than the spike's flat `readdirSync` over
    // two directories: both are flat today, and a subdirectory added later must not escape the pin.
    // **It names the offenders** rather than reporting a count, so a red run says which file.
    //
    // Distinct from its two neighbours, checked rather than assumed: `capabilities.source.test.ts`
    // guards adapter capability module literals — a different corpus for a different reason — and
    // `q0033-surface.js:161` is a single-file check inside a role-directory scenario, not this claim.
    expect(pinning(SHIPPED_TEMPLATES), 'a shipped template pins a codex model name').toStrictEqual([]);
    // The corpus is not empty and does carry `model:` lines, so the silence above is a measurement
    // rather than a walk over nothing: eleven of them at the time of writing, none matching.
    const declaring = ['flows', 'roles'].flatMap((kind) => filesUnder(path.join(SHIPPED_TEMPLATES, kind))
      .filter((name) => /^\s*model:/m.test(fs.readFileSync(path.join(SHIPPED_TEMPLATES, kind, ...name.split('/')), 'utf8'))));
    expect(declaring.length, 'no shipped template declares a model at all, so the pin has no subject')
      .toBeGreaterThan(0);
  });

  test('and it is shown red by a template that does pin one, in a copy rather than in the tracked tree', () => {
    // The pin is green on landing, so it needs a mutation to be trusted — and the mutation lives in a
    // throwaway copy, never in the tree a `pnpm pack` ships. Two shapes: a flow and a role, because
    // the walk covers two directories and a scan that had lost one would still pass over the other.
    const { right } = copies();
    fs.writeFileSync(path.join(right, 'flows', 'review.yaml'),
      `${fs.readFileSync(path.join(right, 'flows', 'review.yaml'), 'utf8')}\n    model: gpt-5\n`);
    expect(pinning(right)).toStrictEqual(['flows/review.yaml']);
    fs.writeFileSync(path.join(right, 'roles', 'code-reviewer.md'), 'model: gpt-5-codex\n');
    expect(pinning(right), 'the walk covers one of its two directories').toStrictEqual([
      'flows/review.yaml', 'roles/code-reviewer.md',
    ]);
  });

  test('and the walk reaches a subdirectory, which is where the spike\'s flat readdir stopped', () => {
    // The one place this is stronger than the assertion it re-homes. Both directories are flat
    // today, so the claim has a subject only over a copy that is not.
    const { right } = copies();
    fs.mkdirSync(path.join(right, 'flows', 'nested'));
    fs.writeFileSync(path.join(right, 'flows', 'nested', 'panel.yaml'), 'name: panel\n  model: gpt-5\n');
    expect(pinning(right), 'a template one directory down escapes the pin')
      .toStrictEqual(['flows/nested/panel.yaml']);
  });

  test('the mirror is tracked, so what a tarball ships is the commit and not the checkout', () => {
    // The templates are assets rather than an emit, so they must be in git's inventory: a tree that
    // existed only in a working directory would pack from whatever the packer's checkout happened to
    // hold. Asked of the tracked-and-unignored set, which is the same oracle `build.test.ts` uses
    // and which answers before a commit as well as after one — *"Membership is a git question, not a
    // filesystem one"* (2026-08-28).
    const listed = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', 'packages/cli/templates'], {
      cwd: WORKSPACE, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    }).split('\0').filter(Boolean).map((entry) => entry.replace('packages/cli/templates/harness/', '')).sort();
    expect(listed, 'git can see none of the templates — a pack would ship nothing').toStrictEqual(filesUnder(SHIPPED_TEMPLATES));
  });
});
