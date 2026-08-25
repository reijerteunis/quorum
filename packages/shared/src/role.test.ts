import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { roleSchema } from './role.js';
import { parseFrontmatter, read, roleFiles, sharedSourceFiles, spikeSource } from '../test/corpus.js';

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

  test('nothing in the spike reads a role\'s `paths`', () => {
    // The claim the doc-comment makes, checked rather than asserted. `taskPromptSection` and the
    // role loader read `meta.adapter` and `meta.model`; no reader of `meta.paths` exists.
    for (const file of ['src/engine.js', 'src/fanout.js', 'src/lint.js', 'src/backlog.js']) {
      expect(spikeSource(file), `${file} must not read a role's paths`).not.toContain('.paths');
    }
  });
});
