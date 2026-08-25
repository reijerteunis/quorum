// AC-1's resolution proof for Q-0041, and nothing more.
//
// The workspace had no precedent for one package importing another: no package declared `exports`,
// `turbo.json` has no `build` task and `tsconfig.base.json` emits nothing, so `@quorum/shared`
// resolves from its TypeScript source. Getting that wrong blocks thirteen tickets and the failure
// would otherwise surface inside Q-0042 rather than here.
//
// It is a NEW test file rather than an edit to a core source file, because Q-0041 wires the
// dependency and ports no `core` code: `packages/core/src/index.ts` is untouched. Q-0042 onward
// import these types for real.
import { expect, test } from 'vitest';

import type { Flow, Stage } from '@quorum/shared';
import { STAGES, integrationBranch, stageSchema } from '@quorum/shared';

test('core resolves @quorum/shared — types and values', () => {
  const stage: Stage = 'green';
  expect(stageSchema.parse(stage)).toBe('green');
  expect(STAGES).toContain('reviewed');
  expect(integrationBranch('Q-0042')).toBe('harness/Q-0042/integration');

  const flow: Pick<Flow, 'name' | 'consumes' | 'produces'> = { name: 'chore', consumes: 'requirements', produces: 'reviewed' };
  expect(flow.produces).toBe('reviewed');
});
