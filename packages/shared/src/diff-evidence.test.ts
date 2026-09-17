/**
 * Q-0134 — the one declaration of what a step's diff is, executed rather than read.
 *
 * The shape is declared once and three consumers use it: `packages/core` fills it,
 * `packages/server` holds one per waiting gate, and a browser parses the route's answer with the
 * schema below. So what is asserted here is what a browser will actually enforce — a shape checked
 * at only one of three ends is a cast at the other two.
 */
import { describe, expect, test } from 'vitest';

import { diffEvidenceSchema } from './diff-evidence.js';

/** One whole, valid answer, from which every case below is a single deliberate departure. */
const EVIDENCE = {
  stepId: 'review',
  range: 'main...harness/Q-0134/integration',
  stat: ' a.ts | 2 +-\n 1 file changed',
  patch: 'diff --git a/a.ts b/a.ts\n@@ -1 +1 @@\n-a\n+b\n',
  truncated: false,
  limit: 200000,
  kept: 48,
  total: 48,
  omitted: [] as string[],
};

describe('diffEvidenceSchema', () => {
  test('the whole shape parses, and the parsed value is the value', () => {
    const parsed = diffEvidenceSchema.safeParse(EVIDENCE);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).toStrictEqual(EVIDENCE);
  });

  test('every member is required, one at a time', () => {
    // One removed per case rather than several, so a schema that required eight of the nine fails
    // exactly where it is wrong rather than being covered by a neighbour.
    for (const member of Object.keys(EVIDENCE)) {
      const partial: Record<string, unknown> = { ...EVIDENCE };
      delete partial[member];
      expect(diffEvidenceSchema.safeParse(partial).success, `evidence survived without ${member}`).toBe(false);
    }
  });

  test('it is strict, so a field nobody asked for is refused rather than carried', () => {
    // `.strict()`'s own reasoning one layer out: *"an answer with a key nobody asked for is an
    // answer that did not follow the contract"*. It matters here because this shape is what a route
    // answers with, so an extra key would be a second transport nobody declared.
    expect(diffEvidenceSchema.safeParse({ ...EVIDENCE, sha: 'abc1234' }).success).toBe(false);
  });

  test('the three byte counts are non-negative integers, as every count in this package is', () => {
    for (const member of ['limit', 'kept', 'total'] as const) {
      expect(diffEvidenceSchema.safeParse({ ...EVIDENCE, [member]: -1 }).success,
        `${member} accepted a negative byte count`).toBe(false);
      expect(diffEvidenceSchema.safeParse({ ...EVIDENCE, [member]: 1.5 }).success,
        `${member} accepted a fractional byte count`).toBe(false);
      // **Zero is asserted on a COHERENT record, not by mutating one field of this one.** Since the
      // schema enforces `truncated === kept < total`, setting `kept` or `total` to 0 alone makes the
      // record self-contradictory, so a bare `{ ...EVIDENCE, kept: 0 }` would now be refused for a
      // reason that has nothing to do with zero. The real answer zero stands for is an EMPTY diff —
      // nothing kept, nothing measured, not truncated — which is what this asserts.
      const coherentZero = member === 'limit'
        ? { ...EVIDENCE, limit: 0 }
        : { ...EVIDENCE, kept: 0, total: 0, truncated: false };
      expect(diffEvidenceSchema.safeParse(coherentZero).success,
        `${member} refused zero, which a real answer can be`).toBe(true);
    }
  });

  test('the three cannot disagree, which is what the docblock claims and now what the schema enforces', () => {
    // **Added by a cross-vendor hand pass after this ticket's gate**, over the files its three
    // reviews were never handed a patch for — this file was omitted from the truncated diff on all
    // three rounds. The docblock says *"`truncated`, `kept` and `total` cannot disagree"* and that
    // `truncated` IS `kept < total`; that was true of the PRODUCER, which computes all three at one
    // site, and a runtime schema validates values that did not come from that site.
    //
    // The two directions are asserted separately, because a clause that only caught one would pass
    // over the other while reading as coverage for both.
    expect(diffEvidenceSchema.safeParse({ ...EVIDENCE, truncated: false, kept: 10, total: 20 }).success,
      'a record claiming it was not truncated while keeping less than it measured was accepted').toBe(false);
    expect(diffEvidenceSchema.safeParse({ ...EVIDENCE, truncated: true, kept: 20, total: 20 }).success,
      'a record claiming truncation while keeping everything it measured was accepted').toBe(false);
    // …and `kept` may never exceed `total`, which no ordering of the two booleans above implies.
    expect(diffEvidenceSchema.safeParse({ ...EVIDENCE, truncated: false, kept: 30, total: 20 }).success,
      'a truncation kept more bytes than it measured').toBe(false);
    // Anti-vacuity: the coherent forms of all three still parse, so the clause discriminates rather
    // than refusing everything it is shown.
    expect(diffEvidenceSchema.safeParse({ ...EVIDENCE, truncated: true, kept: 10, total: 20 }).success,
      'a coherent truncated record was refused').toBe(true);
    expect(diffEvidenceSchema.safeParse({ ...EVIDENCE, truncated: false, kept: 20, total: 20 }).success,
      'a coherent untruncated record was refused').toBe(true);
    // The message names the numbers rather than only the field, because the whole point is that the
    // three disagree and a reader needs to see which.
    const refused = diffEvidenceSchema.safeParse({ ...EVIDENCE, truncated: false, kept: 10, total: 20 });
    expect(refused.success ? '' : refused.error.issues[0]?.message ?? '',
      'the refusal does not say what disagreed with what').toMatch(/kept 10 and total 20/);
  });

  test('the types discriminate, so a value with the right keys is not a value of the right shape', () => {
    expect(diffEvidenceSchema.safeParse({ ...EVIDENCE, truncated: 'yes' }).success).toBe(false);
    expect(diffEvidenceSchema.safeParse({ ...EVIDENCE, omitted: 'a.ts' }).success).toBe(false);
    expect(diffEvidenceSchema.safeParse({ ...EVIDENCE, omitted: [1] }).success).toBe(false);
    expect(diffEvidenceSchema.safeParse({ ...EVIDENCE, patch: null }).success).toBe(false);
  });

  test('an empty patch and an empty summary parse, because neither is this schema\'s to refuse', () => {
    // A range with no patch is refused where it is produced — `materialiseDiff` stops the run on an
    // empty range — and a schema that refused it here would be a second rule for one condition,
    // answering in a vocabulary the first one does not have. Q-0060's lesson on the ticket schema,
    // at a smaller subject.
    expect(diffEvidenceSchema.safeParse({ ...EVIDENCE, patch: '', stat: '', kept: 0, total: 0 }).success).toBe(true);
  });
});
