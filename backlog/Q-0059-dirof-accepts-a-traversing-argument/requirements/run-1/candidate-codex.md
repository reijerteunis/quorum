# Q-0059 — Confine backlog ticket access to the backlog root

## Problem

The `Backlog` class accepts paths supplied as ticket identifiers or ticket folders without proving that the resolved directory remains inside its configured backlog root. `dirOf('..')` can therefore resolve to the parent of `backlog/`, and `read()` can return a `ticket.md` from elsewhere on the filesystem. A lexical path comparison alone does not close the defect because a symlink inside `backlog/` can resolve to a directory outside it.

The write side has the same trust-boundary problem: a caller can supply a `TicketRecord` whose `dir`, or a relative file path, resolves outside the backlog root. The ticket body is inconsistent about whether this change must cover `Backlog.write`, `Backlog.writeFile`, or both; that scope decision is recorded as a blocking open question below.

This affects the `backlog/` file surface and the CLI behavior that reads or writes tickets through `packages/core/src/backlog/backlog.ts`. It must be resolved before the Studio accepts a ticket identifier over HTTP in M3.

## User story

As a **maintainer**, I want every ticket read and in-scope ticket write to be confined to the configured backlog root, so that a malformed ticket argument or an in-root symlink cannot cause Quorum to read or modify files elsewhere on my machine.

## Acceptance criteria

1. **Direct traversal is refused.** On the CLI and core backlog surface, `Backlog.dirOf()` throws when its argument would resolve to the backlog root itself, its parent, or any other path outside the backlog root. Tests include `..` and at least one multi-segment value such as `../outside-ticket`. The method does not return an outside path.

2. **Absolute paths are refused.** `Backlog.dirOf()` throws when given an absolute path, including an absolute path that names an existing ticket directory outside the backlog root. The refusal does not depend on whether that outside directory contains `ticket.md`.

3. **Symlink traversal is refused using filesystem resolution.** Given a single-segment symlink directly inside the backlog root whose target is a directory outside that root, `Backlog.dirOf()` and `Backlog.read()` throw. `read()` does not open, parse, or return the target's `ticket.md`. A lexical-only check does not satisfy this criterion.

4. **The backlog root may itself be reached through a symlink.** When the configured backlog root is a symlink to the real backlog directory, genuine direct child ticket directories remain resolvable. Confinement is evaluated relative to the root's filesystem-resolved path, not only its lexical spelling.

5. **Only direct ticket children resolve.** A successful `Backlog.dirOf()` result is an existing ticket directory whose filesystem-resolved parent is the filesystem-resolved backlog root. A symlink to a sibling ticket directory does not satisfy this direct-child rule unless product explicitly answers OQ-2 otherwise.

6. **Existing exact-folder and id-prefix lookup remains compatible.** For genuine direct child directories, `dirOf(<folder-name>)` continues to resolve an exact folder and `dirOf(<ticket-id>)` continues to use the existing equal-or-`<id>-` prefix lookup. This ticket does not change ambiguous-prefix selection or filesystem ordering.

7. **A genuine miss keeps its existing error.** When an argument is confined but no exact folder or id-prefix match exists, `dirOf()` throws `ticket not found: <argument>` verbatim. A missing backlog root continues to produce the same genuine-miss error and `list()` continues to return an empty array.

8. **Invalid paths fail before ticket contents are disclosed.** A traversal, absolute-path, symlink-escape, missing, or unresolvable candidate does not return a `TicketRecord`, ticket metadata, ticket body, or content-derived error from an outside `ticket.md`. The caller receives the backlog refusal selected in OQ-3.

9. **`Backlog.write` is confined if confirmed in scope.** Subject to OQ-1, `Backlog.write(ticket)` verifies that `ticket.dir` identifies a genuine direct child of the configured backlog root using filesystem-resolved paths before replacing `ticket.md`. A record whose `dir` traverses or follows a symlink outside the root is refused, and the outside filesystem is byte-for-byte unchanged.

10. **`Backlog.writeFile` is confined if confirmed in scope.** Subject to OQ-1, `Backlog.writeFile(ticket, rel, text)` verifies both the ticket directory and the final destination against their filesystem-resolved containment boundaries. It refuses an absolute `rel`, a `rel` containing traversal that escapes the ticket directory, and an existing symlink path segment that resolves outside the ticket directory. On refusal it creates no parent directories and writes no file inside or outside the backlog root.

11. **Valid writes keep their existing contract.** For every write method confirmed in scope by OQ-1, a genuine ticket child and confined destination retain current behavior: `write()` replaces only `ticket.md`; `writeFile()` creates required parent directories, appends one newline only when the supplied text has none, and returns the absolute destination path.

12. **The regression tests exercise real links.** `packages/core/src/backlog/backlog.test.ts` contains filesystem-backed tests for an in-root symlink targeting an outside directory and for a backlog root reached through a symlink. A test using only strings or mocked filesystem metadata does not satisfy this criterion. The symlink tests may explicitly skip only when the operating system refuses creation of the fixture, not when the implementation rejects it.

13. **Existing backlog behavior remains green.** The existing tests in `backlog.test.ts` and `backlog.source.test.ts` remain green, including read-only behavior, exact folder lookup, id-prefix lookup, listing, genuine-miss text, file formatting, and valid write return values. The repository's mock-adapter end-to-end regression suite also remains green.

14. **No new dependency or persistent state is introduced.** The implementation uses the existing Node filesystem and path facilities or an existing core helper. It creates no index, cache, lock file, or daemon-held state. Files remain the database.

15. **Failure is non-mutating.** For every rejected write case in scope, snapshots taken before and after the call show no created directory, created file, truncated file, or modified file under the backlog root or at the attempted outside target.

16. **Cross-cutting constraints remain unchanged.** This change adds no subscription-authentication path, performs no flow write to the user's working tree, changes no gate behavior, changes no ticket file format or schema, changes no flow lint rule or cross-vendor rule, and adds no cold-clone setup step.

## Non-goals

- Changing the `ticket.md` schema, frontmatter parsing, or validation of ticket contents.
- Changing ambiguous ticket-id prefix behavior, `readdir` ordering, or duplicate-id resolution.
- Recursively discovering tickets below direct children of the backlog root.
- Changing `Backlog.create`, `nextId`, `list`, or `readFiles` except where an agreed shared confinement helper is called without changing their externally observable valid-path behavior.
- Protecting run-history paths; that boundary is already handled by the run-history reader.
- Adding Studio or daemon endpoints, request validation, or UI error presentation.
- Adding a database, index, cache, lock, or persisted containment field.
- Changing any flow, gate, adapter contract, subscription behavior, worktree placement, or branch behavior.
- Fixing unrelated filesystem defects discovered during implementation.
- Restoring or changing any deleted `spike/` file.

## Open questions

| ID | Question | Owner | Blocking? |
| --- | --- | --- | --- |
| OQ-1 | The ticket first says to cover the write-side `writeFile` defect, while the 2026-09-07 correction identifies `Backlog.write` as the write side. Must this ticket cover `write`, `writeFile`, or both? The recommendation is **both**, because both accept caller-controlled paths and otherwise leave the same escape available through a neighboring method. | Product owner and security owner | **Yes.** It determines which of AC-9 and AC-10 are mandatory and materially changes scope. |
| OQ-2 | Should a symlink directly under `backlog/` that resolves to a sibling ticket directory be accepted as an alias, as run history currently accepts sibling aliases, or refused because a ticket must be a real direct child? The recommendation is **refuse**: backlog folder identity is persisted and mutable, unlike a read-only run-history alias. | Product owner | **Yes.** It changes externally observable lookup behavior and the confinement test oracle. |
| OQ-3 | What exact error message or error type distinguishes an unsafe path from a genuine missing ticket? The recommendation is a single explicit confinement error that does not reveal whether an outside target exists; `ticket not found: <argument>` remains reserved for a confined genuine miss. | Core owner | **Yes.** QA needs a stable oracle, and callers must not infer outside filesystem contents. |
| OQ-4 | If `writeFile` is in scope, must it refuse a final destination that does not yet exist when its nearest existing parent is a symlink remaining inside the ticket directory? The recommendation is **allow it** after resolving the nearest existing ancestor and proving the eventual lexical suffix remains beneath the real ticket directory. | Core owner and security owner | No, provided the implementation demonstrates equivalent safe behavior and tests both existing and not-yet-existing destinations. |

## Risks

- A lexical prefix check can appear correct while remaining vulnerable to symlink traversal. The tests must use real filesystem links and compare path boundaries by components, not raw string prefixes.
- Checking only an existing final path is insufficient for `writeFile`, because the destination and some parent directories may not exist yet. The implementation must validate the nearest existing ancestor before creating anything.
- A raw string-prefix test can confuse sibling names such as `/backlog` and `/backlog-old`; containment must require the resolved root itself or a path separated by the platform path separator.
- Resolving the backlog root and candidate at different times leaves a time-of-check/time-of-use race if a symlink is replaced between validation and access. Full race-proof descriptor-relative filesystem operations are outside this ticket unless the security owner judges the residual local-process risk unacceptable.
- Reusing the run-history helper without adapting its direct-child and missing-destination semantics could accidentally reject valid backlog writes or accept sibling aliases.
- Applying confinement only in `dirOf()` leaves callers able to construct a `TicketRecord` directly and bypass the read-side guard when writing.
- Returning different errors based on outside-target existence could disclose filesystem information even though ticket contents are no longer read.
- Symlink creation may require additional privileges on some platforms. Tests must report an environment refusal honestly rather than treating an uncreated fixture as a passing security test.
