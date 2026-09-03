/**
 * Q-0093 AC-4 — `packages/cli/templates/harness` is a mirror of `spike/templates/harness`, and it
 * cannot go stale.
 *
 * **Why byte identity is the whole assertion, and no second scoping check is owed.** What the ticket
 * cares about is that an adopter's first `harness/flows` carries the scoped write paths Q-0086,
 * Q-0087 and Q-0088 landed — every rewritable artifact named by `{run}`, plus `{iter}` where a
 * bounded loop can re-enter, and four flat paths surviving only as pointers beside a scoped copy.
 * That property is guarded by a three-link chain, and this file is the front of it:
 *
 *   1. `packages/cli/templates/harness/flows` ≡ `spike/templates/harness/flows`, **here**;
 *   2. `spike/templates/harness/flows` ≡ `harness/flows`, by
 *      `packages/core/src/lint/lint.test.ts`'s `SHIPPED` pair — which asserts the two directories
 *      produce the same `validateFlowDirectory` records, write paths included — and by
 *      `spike/test/q0033-surface.js` S1.1/S1.2/S1.4's byte freeze;
 *   3. `harness/flows` carries the scoping rule, by `packages/shared/src/flow.test.ts`'s
 *      Q-0086/Q-0087 guard.
 *
 * A fourth assertion re-describing the scoping over this copy would be a second description of a
 * property already checked, which is the drift this repository keeps finding. The chain is written
 * here so a reviewer can walk it; link 2 is read rather than assumed, and if it stops holding that
 * is a finding rather than a licence to add the missing assertion here (merged.md R-10).
 *
 * **`spike/templates/**` is read and never written** — ground rules 1 and 2, and non-goal 1. The
 * read is declared in `packages/cli/turbo.json` and registered in `package.test.ts`'s `OUTSIDE`
 * pair, which is what keeps a cache hit on this package's `test` honest (Q-0072).
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

/** The two trees, named once each: the spike's live asset directory and this package's mirror. */
const SPIKE_TEMPLATES = path.join(WORKSPACE, 'spike', 'templates', 'harness');
const SHIPPED_TEMPLATES = path.join(PACKAGE, 'templates', 'harness');

/** Every file below `root`, relative to it with `/` separators, sorted. */
function filesUnder(root: string): string[] {
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
 */
function differences(left: string, right: string): string[] {
  const problems: string[] = [];
  const here = filesUnder(left);
  const there = filesUnder(right);
  for (const name of here.filter((entry) => !there.includes(entry))) problems.push(`${name}: in the spike's tree and not in the shipped one`);
  for (const name of there.filter((entry) => !here.includes(entry))) problems.push(`${name}: in the shipped tree and not in the spike's`);
  for (const name of here.filter((entry) => there.includes(entry))) {
    const a = fs.readFileSync(path.join(left, ...name.split('/')));
    const b = fs.readFileSync(path.join(right, ...name.split('/')));
    if (!a.equals(b)) problems.push(`${name}: the two trees differ by ${String(Math.abs(a.length - b.length))} bytes or more`);
  }
  return problems;
}

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

describe('AC-4 — the shipped template tree is the spike\'s, byte for byte and in both directions', () => {
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

  test('and it is byte-identical to the spike\'s, which is what stops it going stale', () => {
    expect(differences(SPIKE_TEMPLATES, SHIPPED_TEMPLATES)).toStrictEqual([]);
    // Both roots exist and neither walk is empty, so the comparison above is not two empty lists.
    expect(filesUnder(SPIKE_TEMPLATES).length).toBeGreaterThan(10);
    expect(filesUnder(SHIPPED_TEMPLATES).length).toBe(filesUnder(SPIKE_TEMPLATES).length);
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
      'roles/automation-qa.md: in the spike\'s tree and not in the shipped one',
      'roles/invented.md: in the shipped tree and not in the spike\'s',
    ]);
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

  test('link 2 of the chain holds today, read rather than assumed', () => {
    // R-10: this file establishes link 1 and cites links 2 and 3. Link 2 is the one that carries the
    // scoping into the spike's tree, and `lint.test.ts`'s `SHIPPED` pair is what proves the flows
    // agree — read here so the sufficiency argument above has a subject in this suite as well as in
    // that one. If the two directories stop being byte-identical, this fails and the argument is
    // reopened rather than quietly false.
    const shipped = path.join(WORKSPACE, 'harness', 'flows');
    expect(differences(path.join(SPIKE_TEMPLATES, 'flows'), shipped)).toStrictEqual([]);
    expect(fs.readdirSync(shipped).filter((name) => name.endsWith('.yaml')).length).toBe(6);
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
