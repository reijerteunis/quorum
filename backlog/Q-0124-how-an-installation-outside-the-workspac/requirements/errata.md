# Q-0124 — errata to `requirements/merged.md`

Amendments decided at or after the gate and binding on the implementer and the reviewer alike. Each
names the clause it supersedes. The rest of `merged.md` stands.

## E-1 — GO-1 and GO-2 are discharged; the entry is landed and the import is static — 2026-09-15

**Supersedes** GO-1's and GO-2's status as work owed, and every clause of §3 describing the decision
entry as absent. `merged.md` is otherwise unamended and all its criteria stand.

### The entry is landed

**It is *"The distribution set is five, and rejoins the emitting set"* (2026-09-15)**,
`docs/decisions/096-the-distribution-set-is-five-and-rejoins-the-emitting-set.md`, indexed in
`docs/DECISIONS.md` under `## 2026-09-15`. Cite it by **title and date**, never by number or file
name. What it rules, which the criteria now implement rather than decide:

1. **Five packed, and the two sets coincide again.** Decisions 092 and 093 are **named and not
   edited**; their *resolved* / *served* distinction is a fact about shape and survives. What changed
   is only that both shapes ship, and the sets coinciding is a property of the moment rather than a
   rule restored.
2. **`private: true` stays on all five and 078(d) is untouched.** Measured: the three packed today
   are all private and pack, because `pnpm pack` does not refuse a private package — only
   `npm publish` does. *Distribution* here means **a tarball this repository packs and installs**,
   never publication. **No criterion may be read as moving registry-resolved `npx quorum`**, which is
   still Q-0029's in M6.
3. **`files` and a `license` are owed; `engines` is not.** Neither new member declares a `license`
   today while all three packed ones carry `Apache-2.0`.
4. **The daemon import becomes STATIC and the clause-D register is deleted**, `isDaemonUnresolved`
   with it. This is the ruling the gate made: `deferredOffenders` reports in both directions, so the
   exemption cannot be deleted while the import stays dynamic, and 094's *"may become static"* was
   loose. **The trap, named in advance because its failure reads as unrelated to its cause**:
   `namedAsWritten` scans the file as written, so `packages/cli/src/open.ts` must end with **zero**
   occurrences of `import(` — comments included, and including the `typeof import('@quorum/server')`
   type query at `:213`, which a static import makes unnecessary anyway.
5. **`react`, `react-dom` and `@quorum/shared` move to `devDependencies` in `apps/web`**, inverting a
   landed division on the evidence that the bundle is self-contained — measured, 7.94 MB of React a
   100 K tarball already contains.

**The implementer is therefore NOT blocked on GO-1 or GO-2.** `blocked` remains correct for anything
else outside `developer-generalist`'s authority.

### What iteration 2 found that the criteria must carry

Recorded here because it is measured and a round should not rediscover it:

- **`packages/core/src/test-discovery.test.ts`'s `namesTheDaemon` actively forbids this change.** It
  returns `packages/cli/package.json requires @quorum/server, which kills the packed install` for a
  required edge, with a `hostile`/`permitted` fixture pair asserting both sentences by identity. It
  was written by hand at Q-0126's GO-2 and inverts here.
- **`build.test.ts`'s offline mirror cannot walk the daemon's closure.** `collect` resolves
  `<name>/package.json`, and `hono`, `@hono/node-server` and `@hono/node-ws` all fail
  `ERR_PACKAGE_PATH_NOT_EXPORTED` — verified — while `ajv`, `ajv-formats`, `yaml`, `zod`, `react`
  and `react-dom` all resolve from their own packages. That criterion is **design work**, not a
  register extension.
- **`packages/<name>` is assumed at three sites**, including `versionOf` reached with a name from
  `workspaceDepsOf`, so a path column does not fix it — only a name-to-directory map spanning both
  workspace roots does. **`README.md:74` encodes the same assumption on a user-facing surface.**
- **Three assertion groups in the packed fixture invert, not one**, and the damaged-daemon block
  deletes the installed daemon and asserts it stays deleted — which under a required edge must
  become save-and-restore or every later assertion runs against an installation the fixture broke.

### The ticket body's figures are wrong and are the human's to correct

Do not transcribe them. Byte-exact, re-derived: the daemon closure is **4 packages / 652 files /
1.72 MB**; `apps/web`'s is **3 / 85 / 7.94 MB**; the distributed emit goes **889,298 B to
1,340,507 B, +451,209 B**. The body's figures came from `du`, which reports block sizes, and its
closure walk did not resolve through `realpath`, so transitive dependencies — `ws` and `scheduler` —
were invisible to it. Two line citations in it are also wrong: the packed refusal is
`build.test.ts:2461–2462`, `:2482` is the damaged-daemon case, and the workspace assertion is
`:2134`.
