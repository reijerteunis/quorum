---
id: Q-0104
title: The offline mirror re-packs third-party dependencies and can lose files
stage: draft
owner: ruud
repos: []
branch: harness/Q-0104/integration
priority: p1
created: 2026-09-05
iterations: {}
history: []
---
**CI run 33967146498, 2026-09-05, is the evidence.** Three of seven jobs failed —
`workspace (lint, typecheck, test)` and **both** `git identity sweep` cells — every one of them on
the same single test, deterministically:

```
FAIL src/build.test.ts > Q-0098 AC-19 and AC-20 —
     the packed set installs outside the workspace with the registry dead, and runs
Error: Command failed: /tmp/quorum-cli-consumer-XXXXXX/project/node_modules/.bin/quorum help
ERR_MODULE_NOT_FOUND: Cannot find module '.../node_modules/zod/v4/core/json-schema.js'
     imported from '.../node_modules/zod/v4/core/index.js'
```

**This is the packaging path, not a flake, and not Q-0102.** That ticket describes an unstable
`@quorum/core` failure clustering on worktree lifecycle. This is `@quorum/cli`, one test, all three
jobs, same message. It also **had never run on CI before**: the test landed in `68a83f0` (Q-0098,
2026-09-02) and the last CI run before this one was `729dcb3` on 2026-09-01. Its first CI execution
failed. Four days and 89 unpushed commits are why nobody knew.

## What was measured, and what four hypotheses it kills

The fixture mirrors the distribution set's third-party closure — `zod`, `ajv`, `ajv-formats`,
`yaml` — by running `npm pack` over each dependency's installed directory, then installs those
tarballs with a dead registry. Measured locally on 2026-09-05, every input is complete:

| hypothesis | measurement | verdict |
| --- | --- | --- |
| the packer omits files | `npm pack` of zod's store directory: **718 entries**, `v4/core/json-schema.js` present | refuted |
| npm's version | npm 11.12.1 **and** npm 10.9.9 both pack 718 | refuted |
| Node's version | the fixture passes under Node 24.15.0 **and** CI's exact 22.23.2 | refuted |
| the installed tree is stale or partial | published `zod@4.4.3` is 718 entries; the local store directory is 718 files | refuted |

**So the mechanism is not reproducible on this machine and remains unidentified.** What is
established is narrower and is enough to act on: *the mirror is re-derived rather than copied, and
its verdict is therefore a property of the machine that packs it.*

## Why the fix does not depend on the mechanism

`npm pack` re-applies **publish** semantics — the package's own `files` field, its ignore files, and
whatever `npm-packlist` in the ambient npm makes of them. That is right for the three packages this
suite is *about*, whose declared allow-list is AC-19's subject. It is wrong for the offline mirror,
whose only job is to reproduce a tree pnpm has already installed and checked against the lockfile.
Re-deriving a publishable file set there adds a failure mode that belongs to neither this repository
nor its criteria — and one that is environment-dependent, which *"A test's verdict is a property of
the commit, not of the checkout or the account"* (2026-08-30) forbids.

**Shipped in the same change** rather than deferred, because the fix is smaller than the ticket:
`mirror()` copies each dependency's directory whole and tars it with a `package/` prefix through a
staging directory — portable, since GNU `tar` spells the rewrite `--transform` and BSD `tar` spells
it `-s`. A copy cannot lose a file, because it consults no rule. Beside it, a guard asserts each
mirrored tarball's entry count equals its installed tree's file count **before** the install, so a
short mirror names the package and the counts instead of surfacing as an opaque
`ERR_MODULE_NOT_FOUND` from inside somebody else's package. Demonstrated red by mutation: filtering
one file out of the copy fails with *"the offline mirror of ajv is short of its installed tree:
expected 465 to be 466"*.

## What is still owed, and is this ticket's actual work

1. **Confirm the fix on CI.** Local green proves nothing here — the whole defect is that local green
   proved nothing. The next CI run is the measurement.
2. **The mechanism is still unknown.** If CI goes green, that is evidence the mirror was the cause
   and not merely a fragility, but it is not a diagnosis. Whether to spend more on identifying it is
   a judgement call: the honest position is that a copy is correct regardless, and a mechanism nobody
   can reproduce is expensive to chase.
3. **Q-0098's and Q-0093's entries both claim the packed path was "verified end to end after the
   gate".** Both verifications were local, and the path they certified was broken on a clean machine
   for three days. Those entries are append-only history and are not edited; what is owed is that
   the development plan stop presenting that verification as covering CI.
4. **Nothing checks that `main` has been validated by CI.** 89 commits and four days is how this
   stayed hidden, and Q-0073 recorded the same gap at 15 commits. That is a fifth direction of the
   plan/backlog drift and wants its own ticket if it is to be closed.

## Non-goals

- Q-0102's flake, which is a different subject in a different package.
- Any change to what AC-19 asserts about the three `@quorum` packages' declared `files`. The mirror
  is scaffolding; the distribution set is the subject, and it does not move.

Belongs to M2 in `docs/06-development-plan.md`. Opened from CI run 33967146498.
