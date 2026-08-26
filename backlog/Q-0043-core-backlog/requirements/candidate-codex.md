# Q-0043 — core backlog, frontmatter, stages and project loading

## Problem

Quorum’s ticket store and project-loading logic remain split between `spike/src/backlog.js` and the spike CLI. The CLI, the future Studio server, and later core modules need one public, typed API for discovering a project, loading its configuration, and reading or writing tickets.

This port is sensitive because `backlog/` is the persistent database. Rewriting a ticket must not create unrelated changes to its body, history, iteration counters, or frontmatter formatting. The port must use Q-0041’s ticket and stage declarations without introducing a second schema or a stage-transition model that does not exist in the spike.

Surfaces touched: `packages/core`, `packages/shared`, and the on-disk `backlog/` and `harness/harness.yaml` formats. The CLI and Studio consume this API later; neither surface is implemented here.

## User story

**`maintainer`** — I want Quorum’s core package to discover and load my project and provide a typed ticket store, so every Quorum surface reads and writes the same repository files without damaging unrelated ticket history or metadata.

**`adopter`** — I want project discovery to work from the repository or any descendant directory, so I can run Quorum without repeatedly supplying the project root and receive a clear error when I am outside a Quorum project.

**`contributor`** — I want a public, typed core API backed by the shared schemas, so a CLI or Studio feature can load projects and tickets without copying filesystem, YAML, stage, or path-resolution logic.

## Acceptance criteria

1. **Public core exports.** `packages/core` exports `parseFrontmatter`, `renderFrontmatter`, `Backlog`, `findProject`, and `loadProject` from its public entry point. Their implementations use TypeScript strict mode, contain no `any`, and do not import source from `spike/**`. No file under `spike/**` is modified.

2. **Frontmatter parsing preserves the spike contract.** `parseFrontmatter(text)` recognizes only a document beginning with `---\n`, followed by a closing `\n---` delimiter. For a recognized document it returns the YAML mapping as `meta` and all text after the delimiter as `body`. Empty YAML becomes `{}`. Text without matching frontmatter returns `{ meta: {}, body: text }` and does not throw merely because no delimiter exists. Tests cover populated frontmatter, empty frontmatter, an optional newline after the closing delimiter, an empty body, and plain Markdown.

3. **Malformed YAML fails explicitly.** When delimiters are present but their YAML content cannot be parsed, parsing throws an error that identifies the input as invalid frontmatter. It does not return an empty object, discard the original body, or supply defaults. Tests prove this failure behavior.

4. **Frontmatter rendering preserves the file format.** `renderFrontmatter(meta, body)` emits one opening delimiter, YAML for `meta`, one closing delimiter, and the body. It removes leading blank lines from the supplied body exactly as the spike does and does not otherwise alter body bytes. It does not add ticket fields, reorder arrays, coerce dates into `Date` objects, or omit empty `iterations` and `history` values supplied by the caller. Tests pin the emitted delimiter and newline behavior.

5. **Existing ticket round trips are stable.** For every checked-in `backlog/*/ticket.md`, parsing and rendering without a metadata or body change produces byte-identical content. A fixture with non-empty `iterations` and `history` is included. A test that changes only `stage` proves the Markdown body and the serialized values of every other frontmatter field remain unchanged. The corpus test fails if no ticket files are found.

6. **Shared ticket validation is authoritative.** `Backlog.read` parses frontmatter and validates it with Q-0041’s exported `ticketSchema`. Valid metadata is returned with unknown accepted fields preserved as Q-0041 specifies. Invalid ticket metadata throws a clear error naming the affected `ticket.md` and reporting the schema failure. Core does not declare a second ticket schema, stage list, or `Ticket` type.

7. **The stage list is imported, not reproduced.** Any stage ordering needed by this module uses Q-0041’s exported `STAGES`, whose order remains exactly `draft`, `requirements`, `solutioned`, `red`, `green`, `reviewed`, `qa-passed`, `deployed`, `blocked`, `abandoned`. This ticket adds no allowed-transition table or transition predicate and does not change a ticket’s stage except when a caller explicitly changes metadata and calls `write`.

8. **Backlog listing preserves the ticket walk.** `new Backlog(root)` accepts an absolute backlog directory. `list()` returns one parsed ticket for each immediate child directory containing `ticket.md`, ignores files and directories without `ticket.md`, and returns `[]` when the backlog root does not exist. It does not recursively discover tickets. Tests cover all four cases.

9. **Ticket lookup preserves id-or-folder behavior.** `dirOf(idOrFolder)` first accepts an existing exact child folder. Otherwise it selects the first directory entry whose name equals the supplied value or starts with `<value>-`, matching the spike’s directory walk behavior. With no match it throws `ticket not found: <value>`. `read(idOrFolder)` returns the absolute `dir`, folder basename, validated `meta`, and unchanged Markdown `body`. The port adds no duplicate-id resolution policy.

10. **Ticket writes remain file writes.** `Backlog.write(ticket)` writes only `<ticket.dir>/ticket.md` using the frontmatter renderer. It does not write an index, cache, database, event stream, or hidden daemon state. A test records the surrounding ticket directory and proves no other file changes.

11. **Ticket creation preserves observable behavior.** `Backlog.create` accepts `title`, `intent`, optional `owner`, and optional `repos`; allocates the next id; creates `<id>-<slug>/ticket.md`; and returns the created ticket. It writes `stage: draft`, `branch: harness/<id>/integration`, `priority: p2`, the current UTC date as `YYYY-MM-DD`, `iterations: {}`, and `history: []`. The default owner is `process.env.USER` or `unknown`, and the default repositories value is `[]`. The intent is trimmed and stored with exactly one trailing newline. The slug uses the spike’s lowercase ASCII replacement and 40-character limit. Tests use a controlled clock and environment.

12. **ID allocation preserves the spike format.** `nextId()` derives numeric values from listed ticket metadata by removing a leading `T-`, ignoring non-numeric results, choosing one greater than the maximum, and returning a zero-padded `T-0001`-style id. An empty or absent backlog yields `T-0001`. This ticket does not migrate the existing `Q-` namespace or invent a new allocation rule.

13. **Ticket artifact reads preserve walk and glob behavior.** `readFiles(ticket, pattern)` supports the spike’s simple basename `*` wildcard and a trailing `/` for recursive directory reads. Missing target directories return `[]`; matching files are returned as `{ rel, text }`; basename-glob results are sorted; recursive results preserve the spike walk’s filesystem order. Tests cover a literal filename, `candidate-*.md`, recursive directory input, no match, and a missing directory. No broader glob syntax is introduced.

14. **Ticket artifact writes and logs preserve behavior.** `writeFile(ticket, rel, text)` creates parent directories, writes under the supplied ticket directory, ensures exactly that text has at least one trailing newline, and returns the absolute path. `log(ticket, line)` appends `<ISO timestamp> <line>\n` to `runs.log`. Tests use a controlled clock and prove existing content is appended rather than replaced. These methods do not persist the core event stream.

15. **Project discovery walks upward.** `findProject(start)` resolves the supplied starting directory and walks through it and each parent until it finds `harness/harness.yaml`. It returns the absolute project root for the nearest match and returns `null` after reaching the filesystem root without a match. Tests cover starting at the root, a nested directory, nested projects where the nearest project wins, a relative start path, and no project.

16. **Project configuration has one shared schema.** Q-0043 adds and exports from `packages/shared` a permissive Zod schema and inferred type for the existing `harness/harness.yaml` structure consumed by `loadProject`. It types at least `backlog.path` and preserves all accepted existing keys and values, including `backlog.layout`, `adapters`, `budget`, `repo`, and `commands`. It contains no `.default()` or `.catch()` that invents persisted values. The checked-in `harness/harness.yaml` parses without keys being removed or added. Core imports this schema and does not declare a competing configuration shape.

17. **Project loading is a core concern.** `loadProject(dir)` uses `dir` as the discovery starting point, calls the same upward-discovery behavior as `findProject`, reads `<repoDir>/harness/harness.yaml`, parses YAML, validates it with the shared project-config schema, and returns `{ repoDir, harnessDir, config, backlog }`. `repoDir` and `harnessDir` are absolute; `backlog` is a `Backlog` instance.

18. **Backlog path resolution preserves the spike contract.** `loadProject` resolves `config.backlog.path` relative to the discovered project root. When that property is absent, it uses `backlog`. An absolute configured path remains absolute through Node path resolution. Loading does not create the backlog directory or any other file. Tests cover configured relative, configured absolute, and absent paths.

19. **Project-loading failures are explicit.** If discovery finds no project, `loadProject` throws an error containing `no harness/harness.yaml found`. Missing or unreadable configuration, malformed YAML, and schema-invalid configuration each throw an error naming `harness/harness.yaml` and retaining a useful cause. The core function does not print, call `process.exit`, or use the spike CLI’s `die` helper.

20. **Files remain the database.** After loading and read-only operations (`findProject`, `loadProject`, `list`, `dirOf`, `read`, and `readFiles`), a filesystem snapshot is unchanged. Mutating operations write only within the selected ticket directory under the configured backlog root. Core introduces no SQLite file, cache, daemon-owned ticket index, or persistent containment field.

21. **Containment invariant is not absorbed into ticket state.** Register row 9 is preserved: this module does not compute, store, cache, or write branch containment. In particular, reading, listing, or rewriting a ticket does not add a containment field or alter any `ticket.md` byte for board-derived containment. Containment remains computed on each future `board` invocation by its owner.

22. **Worktree-safety invariant is not weakened.** Register row 19 remains owned by the git, fan-out, and engine children. This ticket creates no branches or worktrees and adds no flow-writing path to the user’s working tree. The branch value written during ticket creation remains only the name `harness/<id>/integration`; no Git ref is created.

23. **Port regression coverage ships with the module.** Vitest tests compare the behaviors above against fixtures derived from `spike/src/backlog.js` and `spike/bin/harness.js:46–61`. Tests use temporary directories and do not modify the repository’s checked-in backlog. Existing workspace tests, lint, and strict typechecking remain green. If a test exposes a spike defect outside these requirements, implementation stops and reports it instead of fixing it in this ticket.

24. **Cross-cutting quality check.** The implementation report explicitly records: BYOS is not applicable and no subscription handling is added; worktree safety is unchanged; gate behavior is unchanged; ticket and project configuration remain file-backed and schema-validated; no flow lint rule is added or changed; product-specific SaaS knowledge is absent; and cold-clone setup gains no new command or required input.

## Non-goals

- Stage transitions, flow `consumes`/`produces` rules, backward-edge behavior, failure-stage behavior, or deciding what Q-0011’s current stage should mean; these belong to Q-0050.
- Computing or persisting Git containment for the board.
- Creating `harness/<id>/integration` or any other Git ref when a ticket is created; the known missing-ref behavior is carried for Q-0038 or its eventual owner.
- Porting engine, flow loading, lint, Git/worktree, fan-out, adapter, contract, run-history, CLI command, or Studio code.
- Editing or deleting anything under `spike/**`.
- Implementing the `quorum` binary, CLI flag handling, terminal output, or process exit behavior.
- Persisting the event stream or adding daemon-only state.
- Changing existing ticket ids, folder names, history shapes, iteration keys, branch names, priority values, or ticket bodies.
- Replacing the current frontmatter representation with a general-purpose Markdown document editor.
- Fixing path traversal, ambiguous ticket-prefix lookup, filesystem ordering, id-allocation concurrency, or other defects discovered in the spike without a separately accepted behavior-change decision.
- Budget enforcement, new gate behavior, or any item on the v1 exclusion list: multi-user support, remote daemon, cloud sync, plugin marketplace, visual node canvas, eval suites, Gemini adapter, or desktop shell.

## Open questions

| ID | Question | Owner | Blocking? |
| --- | --- | --- | --- |
| OQ-1 | Does “round-tripping must not reformat what it did not change” apply only to the checked-in/generated ticket format, as AC-5 specifies, or must core preserve arbitrary hand-formatted YAML including comments, quoting, and custom key spacing? Supporting arbitrary YAML would require retaining the original YAML document or performing surgical edits rather than porting the spike’s `YAML.stringify(meta)` contract. | Product owner and Q-0043 engineer | **Yes.** It changes the frontmatter representation and writer design. |
| OQ-2 | Should `loadProject(dir)` require `dir`, or may omission default to `process.cwd()` as `findProject` does in the spike? The architecture names a required `dir`, while the CLI implementation has no function parameter and derives its start from flags/current working directory. | Q-0043 owner | No. Implement the explicit `dir` API in AC-17 unless amended; the future CLI can pass its selected directory. |
| OQ-3 | The spike’s prefix lookup chooses the first filesystem entry when two ticket folders share an id prefix. Should ambiguity become an explicit error? | Q-0043 owner | No. AC-9 preserves the spike behavior; changing it requires a separate behavior-change decision. |
| OQ-4 | The spike’s `writeFile(ticket, rel, text)` accepts paths that can resolve outside the ticket directory. Should core reject traversal? | Safety owner | No for this port. A guard would be desirable but is externally observable new behavior and requires its own ticket or accepted erratum before implementation. |

## Risks

- A standard YAML serializer may rewrite quoting, comments, key order, or collection layout and produce large unrelated diffs. The byte-level corpus and stage-only mutation tests are the primary control; OQ-1 must be resolved before choosing a writer design.
- Adding schema validation at the read boundary can expose legacy ticket or configuration shapes not represented by current fixtures. The complete checked-in corpus must be tested, and contradictions must be reported rather than silently defaulted.
- The existing prefix lookup can select an unintended ticket when folder prefixes collide. This is preserved behavior, not an endorsement.
- `nextId()` is not safe for concurrent creators. Concurrency control is outside this port.
- `writeFile` carries the spike’s permissive relative-path behavior. Until OQ-4 is handled separately, callers remain responsible for supplying ticket-relative paths.
- Consumers may mistake the persisted branch name for proof that the Git ref exists. This ticket deliberately does not create the ref.
- A future CLI or Studio implementation could duplicate discovery or configuration parsing instead of using core. Public export tests and the one shared configuration schema reduce that risk.
