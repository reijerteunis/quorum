import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { roleSchema } from './role.js';
import { parseFrontmatter, read, repoFile, roleFiles, sharedSourceFiles } from '../test/corpus.js';

describe('AC-6 — the role schema matches all eleven role files, including the empty one', () => {
  test('every harness/roles/*.md parses', () => {
    const files = roleFiles();
    expect(files.length).toBe(11);
    expect(files.map((f) => path.basename(f))).toContain('code-reviewer.md');
    for (const file of files) {
      const { meta } = parseFrontmatter(read(file));
      const result = roleSchema.safeParse(meta);
      expect(result.error?.issues ?? [], `${path.basename(file)} must parse`).toEqual([]);
    }
  });

  test('code-reviewer.md really is the empty case, and it is empty for a reason worth recording', () => {
    const file = roleFiles().find((f) => path.basename(f) === 'code-reviewer.md');
    if (!file) throw new Error('corpus missing: harness/roles/code-reviewer.md');
    const text = read(file);
    expect(text.startsWith('---\n---\n'), 'two consecutive --- lines').toBe(true);

    // The requirement says the engine reaches this through `YAML.parse('') ?? {}`
    // (spike/src/backlog.js:14). It does not: with two consecutive `---` lines and no third one,
    // the regular expression at :12 finds no match at all and :13 returns `{ meta: {}, body: text }`
    // before any YAML is parsed. The OUTCOME the schema has to accept is identical — an empty
    // object — but the route differs, and the whole body (delimiters included) becomes `body`.
    // Reported, not fixed; Q-0043 owns parseFrontmatter.
    const { meta, body } = parseFrontmatter(text);
    expect(meta).toEqual({});
    expect(body).toBe(text);
    expect(roleSchema.parse(meta)).toEqual({});
  });

  test('all three fields are optional, and none of them is enforced by this schema', () => {
    expect(roleSchema.parse({})).toEqual({});
    expect(roleSchema.parse({ adapter: 'codex' })).toEqual({ adapter: 'codex' });
    expect(roleSchema.parse({ adapter: 'claude', model: 'opus' })).toEqual({ adapter: 'claude', model: 'opus' });
    const withPaths = { adapter: 'codex', paths: ['packages/core', 'packages/shared'] };
    expect(roleSchema.parse(withPaths)).toEqual(withPaths);
    // Not judged here: whether a path exists, or whether a model is valid for an adapter.
    expect(roleSchema.safeParse({ adapter: 'gemini', model: 'nonexistent', paths: ['no/such/dir'] }).success).toBe(true);
    // A frontmatter key nothing reads yet (02-sdlc-pipeline-spec.md §6 mentions `tools`) survives.
    expect(roleSchema.parse({ adapter: 'claude', tools: ['bash'] })).toEqual({ adapter: 'claude', tools: ['bash'] });
  });

  test('`paths` is documented as advisory, with the citation that makes it advisory', () => {
    const role = sharedSourceFiles().find(([name]) => name === 'role.ts');
    if (!role) throw new Error('packages/shared/src/role.ts is missing');
    expect(role[1]).toContain('ADVISORY');
    expect(role[1]).toContain('harness/architecture.md');
  });

  // Q-0107 AC-9/AC-10 — `retired`. A test stood here reading four `spike/src/*.js` files and
  // requiring none of them to contain `.paths`, as the executable half of `role.ts`'s claim that
  // the field is advisory. Its subject is a tree Q-0103 deletes, and the sibling that carries the
  // claim over the tree that survives is `packages/core/src/engine/q0052.source.test.ts`'s
  // *"a role's `paths` is read by nothing"* — the ported engine, asserted the same way.
});

/**
 * The role table in `harness/architecture.md`, and the role files it is a contract about.
 *
 * **Q-0107 AC-18 — `re-aimed`, and it is the one dependency whose loss would have been silent.**
 * `spike/test/smoke.js:452–485` was the only thing comparing a role's `paths:` frontmatter against
 * the third column of that table, and Q-0103 deletes it. The table's own prose says frontmatter and
 * prose *"must agree so tooling can validate them"*, and the reason it says so is that nothing
 * validated it once before: `developer-tooling.md` existed on disk while being invisible to the
 * architect, and every Q-0033 task went to `backend` by default — a single-vendor fan-out where the
 * whole point is two.
 *
 * It lands here rather than in `packages/core` because the role corpus is already this file's
 * subject, and because `roleSchema` is what types the field the table is about. It costs one
 * declared input (`../../harness/architecture.md`) and one register row in
 * `packages/core/src/turbo-inputs.test.ts` — OQ-4, which measured the cost as identical either way.
 *
 * Written as a FUNCTION over its two inputs rather than as assertions over the shipped pair, so
 * both directions can be shown red on fixtures: *"a check is not established by reading it"*
 * (2026-08-29). One sentence per disagreement, so a red run says which row and which side.
 */
function tableDisagreements(architecture: string, roleText: (role: string) => string | null): string[] {
  const problems: string[] = [];
  // Scoped to the role section rather than to the whole file, because the file legitimately holds
  // other tables — Q-0120's gate filled the five sections that were template prose, and the contract
  // conventions table's `| kind | format |` and `| fixture | JSON |` rows were read as roles, sending
  // the check looking for `developer-kind.md`. A row shape is not a subject. The slice is asserted
  // non-empty so a renamed heading fails here rather than silently matching nothing.
  const start = architecture.indexOf('\n## Roles for task fan-out');
  if (start < 0) return ['harness/architecture.md has no "## Roles for task fan-out" section — this check has lost its subject'];
  const rest = architecture.indexOf('\n## ', start + 1);
  const section = architecture.slice(start, rest < 0 ? architecture.length : rest);
  const rows = [...section.matchAll(/^\| (\w+) \| (\w+) \| ([^|]+)\|/gm)]
    .filter(([, role]) => role !== 'role');
  if (rows.length < 2) return [`the role table has ${rows.length} rows — this check proves nothing without them`];

  for (const [, role, vendor, directories] of rows) {
    const text = roleText(role);
    if (text === null) { problems.push(`${role}: the table names a row with no harness/roles/developer-${role}.md`); continue; }
    if (!new RegExp(`^adapter:\\s*${vendor}$`, 'm').test(text)) {
      problems.push(`${role}: the table says ${vendor} and the role file's adapter does not`);
    }
    const declared = /^paths:\s*\[(.+)\]$/m.exec(text)?.[1];
    if (declared === undefined) { problems.push(`${role}: the role file declares no paths in frontmatter`); continue; }
    const tabled = directories.split(',').map((entry) => entry.replace(/`/g, '').trim().replace(/\/$/, '')).sort();
    const front = declared.split(',').map((entry) => entry.trim().replace(/\/$/, '')).sort();
    if (JSON.stringify(front) !== JSON.stringify(tabled)) {
      problems.push(`${role}: frontmatter is [${front.join()}] and the table is [${tabled.join()}]`);
    }
    // The engine never reads `paths`; the allow-list only reaches an agent through the prose, so a
    // granted directory the body never names is granted to nobody.
    //
    // Over the BODY rather than the whole file, which is the one place this differs from
    // `smoke.js:476`'s version of the clause. There it read the whole text, so the `paths:` line it
    // had just parsed satisfied it: every directory the frontmatter granted was trivially "named in
    // the prose" by the frontmatter. Found by demonstrating the first direction red, which returned
    // one problem where two were expected — a clause that could not fail for the reason it gives.
    const prose = parseFrontmatter(text).body;
    for (const directory of front) {
      if (!prose.includes(directory)) problems.push(`${role}: the prose does not name its allowed path ${directory}`);
    }
  }

  // Two live roles on two vendors, or a fan-out can never be multi-vendor.
  const vendors = new Set(rows.map(([, , vendor]) => vendor));
  if (vendors.size < 2) problems.push(`the role table spans one vendor (${[...vendors].join()})`);
  return problems;
}

describe('Q-0107 AC-18 — the role table and the role files are one contract, and it is checked', () => {
  const architecture = (): string => repoFile('harness/architecture.md');
  const shippedRole = (role: string): string | null => {
    const file = roleFiles().find((candidate) => path.basename(candidate) === `developer-${role}.md`);
    return file === undefined ? null : read(file);
  };

  test('the shipped table and the shipped roles agree, in every row', () => {
    expect(tableDisagreements(architecture(), shippedRole)).toStrictEqual([]);
    // And it examined something: a table nobody could parse would return no disagreements above.
    const section = architecture().slice(architecture().indexOf('\n## Roles for task fan-out'));
    expect([...section.slice(0, section.indexOf('\n## ', 1) + 1 || undefined)
      .matchAll(/^\| (\w+) \| (\w+) \| ([^|]+)\|/gm)]
      .filter(([, role]) => role !== 'role').length, 'the live table').toBeGreaterThanOrEqual(5);
  });

  test('changing a role\'s paths without the table fails — the first direction', () => {
    const mutated = (role: string): string | null => {
      const text = shippedRole(role);
      if (text === null || role !== 'tooling') return text;
      return text.replace(/^paths: \[.+\]$/m, 'paths: [packages/core, packages/shared, packages/cli, packages/ui]');
    };
    expect(tableDisagreements(architecture(), mutated)).toStrictEqual([
      'tooling: frontmatter is [packages/cli,packages/core,packages/shared,packages/ui] and the table is [packages/cli,packages/core,packages/shared]',
      'tooling: the prose does not name its allowed path packages/ui',
    ]);
  });

  test('changing the table without the role fails — the other direction', () => {
    const table = architecture().replace(
      '| tooling | claude | `packages/core/`, `packages/shared/`, `packages/cli/` |',
      '| tooling | codex | `packages/core/`, `packages/shared/` |');
    expect(tableDisagreements(table, shippedRole)).toStrictEqual([
      'tooling: the table says codex and the role file\'s adapter does not',
      'tooling: frontmatter is [packages/cli,packages/core,packages/shared] and the table is [packages/core,packages/shared]',
    ]);
  });

  test('and the rest of the check discriminates too: a missing row, a missing file, one vendor', () => {
    // Each remaining clause on its own, so the two demonstrations above are not the only evidence
    // that this function can fail — Q-0071's point that showing a guard has a subject proves the
    // guard fires and not that each of its clauses does.
    expect(tableDisagreements(architecture(), (role) => (role === 'data' ? null : shippedRole(role))))
      .toStrictEqual(['data: the table names a row with no harness/roles/developer-data.md']);
    expect(tableDisagreements('\n## Roles for task fan-out\n| role | vendor | dirs | contracts |\n', shippedRole))
      .toStrictEqual(['the role table has 0 rows — this check proves nothing without them']);
    // The slice itself, which is new with Q-0120's gate: a renamed heading must fail here rather
    // than match nothing and report a table that agrees with everything.
    expect(tableDisagreements(architecture().replace('\n## Roles for task fan-out', '\n## Roles'), shippedRole))
      .toStrictEqual(['harness/architecture.md has no "## Roles for task fan-out" section — this check has lost its subject']);
    // And the scoping is load-bearing rather than decorative: the contract conventions table in the
    // same file must not be read as roles. Unscoped, `| kind | format |` and `| fixture | JSON |`
    // sent this function looking for harness/roles/developer-kind.md.
    expect(tableDisagreements(architecture(), shippedRole)
      .filter((problem) => problem.startsWith('kind') || problem.startsWith('fixture'))).toStrictEqual([]);
    expect(tableDisagreements(architecture().replace(/^\| (\w+) \| codex \|/gm, '| $1 | claude |'), shippedRole)
      .filter((problem) => problem.startsWith('the role table spans')))
      .toStrictEqual(['the role table spans one vendor (claude)']);
  });
});
