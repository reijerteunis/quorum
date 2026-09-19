/**
 * Q-0137 AC-9 — the five shapes the retained-file routes answer with, each declared here once.
 *
 * A file of its own rather than a block in `wire.test.ts` for that file's own reason at a smaller
 * scale: these are five shapes with one subject, and the clauses about them are about the LEVELLING
 * rule — strict where Quorum owns the key set, loose where it does not — rather than about any one
 * route. Nothing here reads the filesystem except the glossary clause, which asserts that no term
 * was coined.
 */
import { describe, expect, test } from 'vitest';

import { repoFile } from '../test/corpus.js';
import * as shared from './index.js';
import {
  wireRunHistoryRetainedFileSchema, wireRunHistoryRetainedOccurrenceSchema,
  wireRunHistoryRetainedSchema, wireRunHistoryRetainedTextSchema,
  wireRunHistoryRetainedWarningSchema,
} from './wire.js';

/** One listed retained file, so a case changes the one field it is about. */
const FILE = { name: 'prompt.txt', bytes: 3 };

/** One occurrence's entry in a retained listing. */
const OCCURRENCE = { seq: 1, step_id: 'implement', files: [FILE] };

/** One occurrence the listing could not name files for. */
const WARNING = { seq: 2, step_id: 'integrate', message: "this occurrence's recorded directory is not there" };

describe('Q-0137 AC-9 — the retained-file shapes are declared once, each with a schema', () => {
  test('the five shapes parse what the routes answer, and the barrel exports every one', () => {
    expect(wireRunHistoryRetainedFileSchema.safeParse(FILE).success).toBe(true);
    expect(wireRunHistoryRetainedOccurrenceSchema.safeParse(OCCURRENCE).success).toBe(true);
    expect(wireRunHistoryRetainedWarningSchema.safeParse(WARNING).success).toBe(true);
    expect(wireRunHistoryRetainedSchema.safeParse({ occurrences: [OCCURRENCE], warnings: [WARNING] }).success).toBe(true);
    expect(wireRunHistoryRetainedTextSchema.safeParse({ name: 'prompt.txt', bytes: 3, text: 'ask' }).success).toBe(true);
    for (const named of [
      'wireRunHistoryRetainedFileSchema', 'wireRunHistoryRetainedOccurrenceSchema',
      'wireRunHistoryRetainedWarningSchema', 'wireRunHistoryRetainedSchema',
      'wireRunHistoryRetainedTextSchema',
    ]) {
      expect(shared, `index.ts must export ${named}`).toHaveProperty(named);
    }
  });

  test('all three levels are STRICT, which is a rule deciding each shape rather than a preference', () => {
    // *"Unknown keys are refused where Quorum owns the key set, and preserved where it does not"*
    // (2026-08-25). `WireRunHistory` is loose because it projects a document `core` writes and may
    // widen; every shape here is composed by the transport out of a directory listing, so Quorum
    // owns each key — the same reading that makes `WireRunHistoryRow` strict beside it.
    expect(wireRunHistoryRetainedFileSchema.safeParse({ ...FILE, mode: 420 }).success).toBe(false);
    expect(wireRunHistoryRetainedOccurrenceSchema.safeParse({ ...OCCURRENCE, occurrence_dir: 'steps/001-implement' }).success,
      'an occurrence directory was accepted on the wire').toBe(false);
    expect(wireRunHistoryRetainedWarningSchema.safeParse({ ...WARNING, dir: 'steps/002-integrate' }).success).toBe(false);
    expect(wireRunHistoryRetainedSchema.safeParse({ occurrences: [], warnings: [], total: 0 }).success).toBe(false);
    expect(wireRunHistoryRetainedTextSchema.safeParse({ name: 'a', bytes: 0, text: '', encoding: 'utf8' }).success).toBe(false);
  });

  test('a byte count cannot be negative or fractional, on either shape that carries one', () => {
    // Q-0127 AC-14(a)'s rule at a third and fourth site: a count on this wire is an integer and is
    // never negative, and a size the daemon could not have measured is a body a page refuses.
    for (const bytes of [-1, 1.5, Number.NaN]) {
      expect(wireRunHistoryRetainedFileSchema.safeParse({ name: 'a', bytes }).success, String(bytes)).toBe(false);
      expect(wireRunHistoryRetainedTextSchema.safeParse({ name: 'a', bytes, text: '' }).success, String(bytes)).toBe(false);
    }
    // …and an empty file is 0 rather than absent, which is the one value a reader must be able to
    // tell from *this was not measured*. Eight of the files this repository's run history retains
    // are empty, so the case is the ordinary one rather than an edge.
    expect(wireRunHistoryRetainedFileSchema.safeParse({ name: 'a', bytes: 0 }).success).toBe(true);
    expect(wireRunHistoryRetainedTextSchema.safeParse({ name: 'a', bytes: 0, text: '' }).success).toBe(true);
  });

  test('a sequence number is an integer and is never negative, on both shapes that carry one', () => {
    for (const seq of [-1, 1.5, '1']) {
      expect(wireRunHistoryRetainedOccurrenceSchema.safeParse({ ...OCCURRENCE, seq }).success, String(seq)).toBe(false);
      expect(wireRunHistoryRetainedWarningSchema.safeParse({ ...WARNING, seq }).success, String(seq)).toBe(false);
    }
    // `Number.MAX_SAFE_INTEGER` is accepted, and it has to be: `occurrenceSeq` answers it for a
    // directory name it cannot read, which is the very case a warning exists to report.
    expect(wireRunHistoryRetainedWarningSchema.safeParse({ ...WARNING, seq: Number.MAX_SAFE_INTEGER }).success)
      .toBe(true);
  });

  test('every field is required, so a partial answer is refused rather than rendered', () => {
    expect(wireRunHistoryRetainedFileSchema.safeParse({ name: 'a' }).success, 'bytes').toBe(false);
    expect(wireRunHistoryRetainedFileSchema.safeParse({ bytes: 1 }).success, 'name').toBe(false);
    expect(wireRunHistoryRetainedOccurrenceSchema.safeParse({ step_id: 'a', files: [] }).success, 'seq').toBe(false);
    expect(wireRunHistoryRetainedOccurrenceSchema.safeParse({ seq: 1, files: [] }).success, 'step_id').toBe(false);
    expect(wireRunHistoryRetainedOccurrenceSchema.safeParse({ seq: 1, step_id: 'a' }).success, 'files').toBe(false);
    expect(wireRunHistoryRetainedSchema.safeParse({ occurrences: [OCCURRENCE] }).success, 'warnings').toBe(false);
    expect(wireRunHistoryRetainedSchema.safeParse({ warnings: [] }).success, 'occurrences').toBe(false);
    // A `step_id` the manifest did not carry is the empty string rather than absent, which is what
    // makes the field requirable at all — a cast, never a check, on the other side of the wire.
    expect(wireRunHistoryRetainedOccurrenceSchema.safeParse({ ...OCCURRENCE, step_id: '' }).success).toBe(true);
  });

  test('the element schemas are what the envelopes validate, rather than a second copy of them', () => {
    // A file the element schema refuses must refuse the whole listing too, or the two would
    // disagree about one response — which is the drift a second inline copy of a shape is free to
    // produce, and the reason `wireVendorRollupSchema` was named at Q-0018 rather than written twice.
    const bad = { name: 'a', bytes: -1 };
    expect(wireRunHistoryRetainedFileSchema.safeParse(bad).success).toBe(false);
    expect(wireRunHistoryRetainedOccurrenceSchema.safeParse({ ...OCCURRENCE, files: [bad] }).success).toBe(false);
    expect(wireRunHistoryRetainedSchema.safeParse({
      occurrences: [{ ...OCCURRENCE, files: [bad] }],
      warnings: [],
    }).success).toBe(false);
    expect(wireRunHistoryRetainedSchema.safeParse({ occurrences: [], warnings: [{ ...WARNING, seq: -1 }] }).success)
      .toBe(false);
  });

  test('no name reuses `manifest` or `artifact`, and no glossary term was coined', () => {
    // Q-0127 E-2's homograph rule: `manifest` names a run's manifest in `docs/GLOSSARY.md` and
    // `artifact` is spent on **Emitted artifact**, so either would be one word for two subjects with
    // both readings surviving. The glossary's own words for this one are *retained files*, which is
    // the **Occurrence** entry's own wording and therefore coins nothing.
    const declared = Object.keys(shared).filter((name) => name.includes('Retained'));
    expect(declared.length, 'no retained shape is exported, so this clause has no subject').toBeGreaterThan(0);
    for (const name of declared) {
      expect(/manifest/i.test(name), `${name} reuses the word manifest`).toBe(false);
      expect(/artifact/i.test(name), `${name} reuses the word artifact`).toBe(false);
    }
    expect(repoFile('docs/GLOSSARY.md'), 'the glossary does not call them retained files')
      .toContain('retained files');
  });
});
