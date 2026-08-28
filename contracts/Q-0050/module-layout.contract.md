# Q-0050 module and ownership contract

Production lands under `packages/core/src/engine/` with no barrel in that folder and no edit to
`packages/core/src/index.ts`.

| File | Owned declarations |
| --- | --- |
| `channel.ts` | lossless single-consumer FIFO, iterator `next`/`return`/`throw`, producer completion and post-terminal throw |
| `types.ts` | engine-internal context and injected capability types, including the lifecycle finalisation hook; public `RunFlowOptions`, `AnswerGate`, and `FlowError` |
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

Before writing assertions, qa-red also owns declaration-only compilable stubs at
`packages/core/src/engine/types.ts`, `channel.ts`, and `engine.ts`. They export the public shapes in
`run-flow-api.contract.ts`, use contract-local gate shapes until shared is widened, and throw from
every body. Red tests import these production paths and must fail on assertions, never missing
modules or symbols. Development replaces the stubs in its later phase. The contract artifact under
`contracts/` is normative but is not itself a workspace compilation root.

Documentation changes are confined to `docs/03-adapter-contract.md`, `docs/04-architecture.md`, and
`docs/GLOSSARY.md`. They describe the terminal member, gate callback, cancellation ownership,
ordering limits, and the deliberate absence of timestamps/sequence ids. A durable decision entry
must be accepted before development; development cites its title and date but does not create or
edit the append-only decision record.
