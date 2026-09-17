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
      expect(diffEvidenceSchema.safeParse({ ...EVIDENCE, [member]: 0 }).success,
        `${member} refused zero, which a real answer can be`).toBe(true);
    }
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
