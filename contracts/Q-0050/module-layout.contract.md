# Q-0050 module and ownership contract

Production lands under `packages/core/src/engine/` with no barrel in that folder and no edit to
`packages/core/src/index.ts`.

| File | Owned declarations |
| --- | --- |
| `channel.ts` | lossless single-consumer FIFO, iterator `next`/`return`/`throw`, producer completion and post-terminal throw |
| `types.ts` | engine-internal context and injected capability types, including the lifecycle finalisation hook; public `RunFlowOptions` and `AnswerGate`; re-export of the landed `FlowError` from `../lint/lint.js` |
| `loaders.ts` | `loadFlow`, `loadFlowByName`, `loadRole`, `interpolate`, `writesOf`, `reviewRound` |
| `routing.ts` | `runStep`, `handleFail`, `askGate`, gate policy, counter arithmetic, intra-flow and cross-flow backward edges |
| `lifecycle.ts` | `finish`, `outcome`, `recordEvent`, cancellation/abandonment finalisation and rollback policy |
| `engine.ts` | `runFlow`, context construction, producer orchestration and the only composition of the files above |

Exports from the folder are imported by their concrete file paths. `engine.ts` exports `runFlow`;
the other five files export only the declarations named above that tests or sibling engine tickets
need. Every export and non-obvious interface field has JSDoc.

Allowed imports are Node builtins, `yaml`, `@quorum/shared`, and sibling modules under
`packages/core/src/`. No production file imports `spike/**`, writes to stdout/stderr, contains ANSI,
installs a process signal listener, or exits the process. No dependency is added.

QA owns all `*.test.ts` and `*.source.test.ts` files. Development tasks never modify tests. The red
suite extends the recursive corpus/module-folder assertion before implementation and transcribes
spike tests into `packages/core/src/engine/`; implementation satisfies those tests through the
production files above.

The architect commits compilable throwing stubs for all six production files at
`packages/core/src/engine/{types,channel,loaders,routing,lifecycle,engine}.ts`. They expose every
focused-test symbol in `run-flow-api.contract.ts`. `types.ts` re-exports `FlowError` from
`../lint/lint.js`; no engine file declares another error class. `merge-contracts` places these
stubs on qa-red's integration base, so tests fail on assertions rather than resolution. QA does not
author production-path stubs. Development replaces each stub only in its owning task. The contract
artifact is normative but is not a compilation root; the architect hand-syncs it with the stubs.

Focused tests import loaders directly; counter, gate, and regression tests import routing;
finish, dry-view, and record tests import lifecycle. Stage-precondition, cancellation, abandonment,
and end-to-end stream tests exercise `runFlow` through `engine.ts`.

Documentation changes are confined to `docs/03-adapter-contract.md`, `docs/04-architecture.md`, and
`docs/GLOSSARY.md`. They describe the terminal member, gate callback, cancellation ownership,
ordering limits, and the deliberate absence of timestamps/sequence ids. A durable decision entry
must be accepted before development; development cites its title and date but does not create or
edit the append-only decision record.

QA deliberately updates the landed `packages/core/src/corpus.test.ts`,
`packages/shared/src/events.test.ts`, and `packages/core/src/docs.test.ts` suites for the engine
module, strict event variants, and terminal/gate documentation respectively.
