major: apps/web/test/source.test.ts:289 `writingFunctions` recognizes only `function name(...)` declarations. A fourth writer expressed as an arrow function—for example, `export const deleteRun = async (...) => fetch(..., { method: 'POST' })`—is permitted by `WRITE_RULES` yet remains invisible to the identity register, leaving the asserted set unchanged. AC-11 explicitly requires the register to fail against any fourth writing function. Parse all supported function forms, preferably through the TypeScript AST, and add a red fixture for an arrow-function writer.

observation: The supplied patch omitted six files because of truncation; they were inspected directly from `harness/Q-0130/implement`.

observation: Focused tests could not be rerun in this read-only environment because Vite attempted to create `apps/web/node_modules/.vite-temp`; the implementer’s recorded forced suite remains the available execution evidence.
