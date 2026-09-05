import { describe, expect, test } from 'vitest';


import { STAGES, stageSchema } from './stages.js';
import { sharedSourceFiles } from '../test/corpus.js';

describe('AC-11 — STAGES moves unchanged, and the state machine is not invented', () => {
  // Q-0107 AC-9/AC-10 — `retired`. One test stood here: *"the exported tuple deep-equals the spike
  // declaration, in order"*, which parsed `STAGES` out of `spike/src/backlog.js` and compared the
  // two. Its subject is evidence about a tree Q-0103 deletes, and *"A check outlives its subject
  // only if it can still fail"* (2026-09-05) forbids transcribing that comparison into a frozen
  // copy of the spike's array. The property it proved — the ten names, in this order — is carried
  // by the test immediately below, which is a transcription of what the STATE MACHINE documents
  // rather than of what the spike happened to hold, and which was already green beside it.
  test('the ten members are the ones the state machine documents', () => {
    expect([...STAGES]).toEqual([
      'draft', 'requirements', 'solutioned', 'red', 'green', 'reviewed', 'qa-passed', 'deployed',
      'blocked', 'abandoned',
    ]);
  });

  test('the schema and the type derive from that one tuple — no second list in the package', () => {
    for (const stage of STAGES) expect(stageSchema.parse(stage)).toBe(stage);
    expect(stageSchema.safeParse('shipped').success).toBe(false);

    // A second hand-written list would show up as another source file quoting a stage name that
    // stages.ts does not own. Only the tuple itself may hold them as string literals in code.
    const offenders = sharedSourceFiles()
      .filter(([name]) => name !== 'stages.ts')
      .filter(([, text]) => /['"](qa-passed|solutioned)['"]/.test(text));
    expect(offenders.map(([name]) => name)).toEqual([]);
  });

  test('no transition table is encoded here — transitions are the flow directory\'s', () => {
    const table = sharedSourceFiles().filter(([, text]) => /\b(TRANSITIONS|STAGE_GRAPH|nextStage|canAdvance)\b/.test(text));
    expect(table.map(([name]) => name)).toEqual([]);
  });
});
