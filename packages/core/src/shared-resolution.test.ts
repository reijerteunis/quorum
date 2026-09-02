// AC-1's resolution proof for Q-0041, and nothing more.
//
// The workspace had no precedent for one package importing another, and the reason this file gave
// for the resolution reaching TypeScript source was that *"no package declared `exports`,
// `turbo.json` has no `build` task and `tsconfig.base.json` emits nothing"*. **All three clauses
// have since stopped being true** — Q-0096 gave `shared` and `core` an `exports` map, Q-0097 added
// the `build` task, and `packages/*/tsconfig.build.json` is what emits — while the test went on
// passing, which is why the comment is corrected here rather than left to be believed.
//
// The real reason it passes is now `quorum-source`, the workspace-only export condition Q-0096
// landed: `vitest.shared.js` puts it in `ssr.resolve.conditions`, so Vitest takes the branch of both
// export maps that resolves `./src/index.ts`, while a plain `node` process — which knows no such
// condition — is sent to `./dist/index.js`. So this file is the Vitest half of decision 078(b)'s
// two-directional proof, and the value import below is what would fail if that condition were
// dropped. The Node half is `packages/cli/src/build.test.ts`.
//
// Getting the original wiring wrong blocked thirteen tickets and the failure would otherwise have
// surfaced inside Q-0042 rather than here.
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
