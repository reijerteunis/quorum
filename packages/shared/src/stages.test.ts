import { describe, expect, test } from 'vitest';


import { STAGES, stageSchema } from './stages.js';
import { sharedSourceFiles, spikeSource } from '../test/corpus.js';

/** The ten names as spike/src/backlog.js:6-9 lists them, parsed out of the spike itself. */
function stagesFromSpike(): string[] {
  const source = spikeSource('src/backlog.js');
  const block = source.match(/export const STAGES = \[([\s\S]*?)\];/);
  if (!block) throw new Error('spike/src/backlog.js no longer declares STAGES as an array literal');
  return [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

describe('AC-11 — STAGES moves unchanged, and the state machine is not invented', () => {
  test('the exported tuple deep-equals the spike declaration, in order', () => {
    expect([...STAGES]).toEqual(stagesFromSpike());
  });

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
