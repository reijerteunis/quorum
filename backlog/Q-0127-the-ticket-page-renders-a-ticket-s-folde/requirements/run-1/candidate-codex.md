# Q-0127 — The ticket page renders a ticket's folder

## Problem

The Studio route `/backlog/:ticketId` is a placeholder. A solo maintainer can open the backlog board but cannot inspect a ticket's intent, artifacts, or `runs.log` without leaving the Studio and browsing the repository.

The daemon has no read route for one ticket. Returning every file in one response is not acceptable: the largest measured ticket folder is 3,108,985 bytes, its largest file is 1,460,837 bytes, and a modern folder contains 61 files. The ticket layout is also run-scoped and iteration-scoped, optional artifact directories are not uniformly present, and hidden `.harness/` content is untracked engine state rather than part of the ticket record.

This ticket touches the local daemon, `apps/web`, and shared wire schemas. It is read-only and inherits Q-0017's fetch module and request-state vocabulary.

## User story

As a **solo maintainer**, I want to open a ticket from the Studio backlog board and inspect its ticket file, artifacts, and run log in their on-disk hierarchy, so that I can understand the ticket without loading its whole folder at once or leaving the Studio.

## Acceptance criteria

1. The shared package defines and exports runtime schemas and TypeScript types for:
   - a ticket-folder manifest;
   - one manifest entry;
   - one ticket-file response; and
   - every new successful response added by this ticket.

   Both the daemon and `apps/web` use these shared definitions. A parsed JSON value is never accepted through a type assertion alone.

2. `GET /tickets/:id` returns a JSON manifest for one ticket. `:id` is the ticket id used by the existing board link, such as `Q-0127`; the route resolves it through `Backlog.dirOf` and does not implement a second lookup rule.

3. A successful manifest contains:
   - `id`, `title`, `stage`, and `owner` from `ticket.md`;
   - the resolved ticket folder name;
   - a `files` array; and
   - a `directories` array.

   Each file entry contains its ticket-relative POSIX path and byte size. Each directory entry contains its ticket-relative POSIX path. Paths are sorted lexicographically so the same folder produces a stable response independent of filesystem enumeration order. File contents are not included in this response.

4. The manifest distinguishes an absent directory from an existing empty directory. An existing empty `solution/` or `qa/` directory appears in `directories` even though no file has that prefix; an absent directory does not appear.

5. The manifest omits `.harness/` and every descendant of `.harness/`. It also omits any file or directory whose relative path contains a segment beginning with `.`. Hidden engine state and incidental hidden filesystem files are neither named nor readable through this surface. The implementation must not depend on the current number of hidden files.

6. `GET /tickets/:id/files?path=<relative-path>` returns exactly one file as JSON with its ticket-relative POSIX `path`, exact byte `size`, and complete UTF-8 `text`. The response is lazy: opening the page fetches the manifest, and the browser requests file contents only when it needs to display that file.

7. File responses are not truncated, summarized, or capped by this ticket. In particular, a valid 1,460,837-byte UTF-8 artifact is returned in full when selected. Introducing a storage or display cap belongs to Q-0076 or a separate decision; the split route limits the initial response without silently changing file contents.

8. Both new routes enforce confinement in `core`, including after symlink resolution. A ticket token that is not one path-segment name, a file path that is absolute, a file path containing `.` or `..` segments, an encoded traversal, a backslash-based traversal, a hidden path, a directory requested as a file, or a symlinked leaf escaping the ticket folder is refused and no outside file is read.

9. The daemon returns the existing strict `WireRefusal` shape for every failure, with the following stable status and code distinctions:
   - `400 invalid-ticket-id` when `:id` is not one valid ticket token;
   - `400 invalid-file-path` when the file query is missing, repeated, empty, non-relative, hidden, traversing, or otherwise not one confined file path;
   - `404 no-such-ticket` when a valid ticket token resolves to no ticket folder;
   - `404 no-such-file` when the ticket exists but the requested confined path does not name a regular file;
   - `415 unsupported-file-encoding` when the complete file is not valid UTF-8; and
   - `422 malformed-ticket` for the validation failure in AC-10.

   A confinement refusal is never collapsed into a 404, and an unreadable existing file is never reported as absent.

10. Before either route returns ticket data, the daemon verifies that the parsed `ticket.md` contains non-empty string values for `id`, `title`, `stage`, and `owner`, and that `id` equals the requested `:id`. Failure returns `422 malformed-ticket`; its condition names `ticket.md` and the invalid or mismatched field without returning file contents. This is an HTTP-boundary check only: it does not change `parseFrontmatter`, `Backlog.read`, or Q-0017's requirement that the listing still name a damaged ticket by its folder.

11. UTF-8 validity is checked against the complete file bytes with fatal decoding or an equivalent whole-file check. Detection must not inspect only a prefix, because a prefix may end inside a valid multi-byte character. Invalid bytes are never replaced with U+FFFD and presented as source text.

12. The new routes perform no write, repair, cache, index, stage transition, or browser persistence. Their answers are derived from the ticket folder for each request. Reading a ticket does not alter tracked or untracked files.

13. `apps/web` adds the new paths to its single daemon endpoint register and extends the existing fetch module. It percent-encodes the ticket id as one path segment and the selected relative path as one query value. No component assembles a second literal copy of either daemon route.

14. The `/backlog/:ticketId` placeholder is replaced by a ticket-detail screen. Navigating from a linkable board card opens that screen for the card's `id`. A direct navigation to the same URL produces the same result.

15. On first render and on an explicit retry, the screen uses Q-0017's existing request-state vocabulary for the manifest request. Each state is visible in plain language:
   - in flight names what is being requested;
   - loaded renders the ticket;
   - unreachable says the daemon did not answer and offers retry;
   - refused renders the daemon's condition and applicable remedy and offers retry; and
   - unparseable says the daemon response did not match the shared schema and offers retry.

   The screen does not use a blank panel, spinner, skeleton, fabricated ticket, or stale successful value as a substitute for any state.

16. After a manifest loads, the main content provides tabs in this order when applicable: `Ticket`, `Requirements`, `Solution`, `Dev`, `Review`, `QA`, and `Other`.
   - `Ticket` contains `ticket.md` and is always present after a valid manifest.
   - Each artifact tab is present when its corresponding directory exists, including when it is empty.
   - `Other` is present only when at least one non-hidden manifest file is not `ticket.md`, `runs.log`, or beneath one of the five named artifact directories.
   - An absent optional directory produces no tab.
   - An existing empty directory produces its tab with an explicit empty-state sentence.

17. Within each artifact tab, files are shown according to their actual relative directory hierarchy rather than inferred from filenames. Distinct `run-N` directories remain distinct, and directories or filenames containing `iter-N` remain nested or named as stored. The screen does not merge artifacts from multiple runs or iterations into one implied round.

18. Selecting a file requests and displays that file. Each file request independently uses the existing request-state vocabulary and offers retry on failure. A failed second file does not erase an already loaded manifest or mislabel the entire ticket as missing. When navigating to a different ticket id, content or failures from the previous ticket are not rendered under the new id.

19. `runs.log` is rendered in a persistent side region when it exists, separate from the artifact tabs. It is displayed as text and is not parsed into run links. If `runs.log` is absent, the region says that this ticket has no `runs.log`; absence is not treated as a request failure.

20. All ticket and artifact content is rendered as escaped preformatted text. Repository-controlled text cannot create HTML elements, execute script, install event handlers, load remote resources, or alter navigation. This ticket adds no Markdown renderer, HTML passthrough, syntax-highlighting dependency, or sanitiser dependency.

21. The layout remains usable when a filename is long, a file contains long unbroken lines, a tab contains 61 files, or the selected file is at least 1,460,837 bytes. Long content scrolls within its content region and does not make the rail or file selector inaccessible.

22. The inherited cost finding is resolved as follows: `billedCostOf` returns `null` when history is absent, empty, or every history entry has `cost: null`; it sums the numeric costs when at least one priced entry exists, treating unpriced entries as absent from that sum. Tests cover no history, empty history, all-unpriced history, genuine zero cost, mixed priced and unpriced history, and fully priced history. The JSDoc states this contract. This prevents an all-unpriced history from being rendered as a measured `$0.00`.

23. The shared wire schemas require both `not-contained.ahead` and `unpushed.ahead` to be non-negative integers. Schema tests prove that zero and positive counts pass and negative counts fail for both shapes.

24. The documentation test that checks the architecture and source statements about same-origin requests retains its three anti-vacuity checks for `same-origin`, `absolute URL`, and `font host`. Its title and comment are corrected to say that it checks both statements against those shared obligations; it no longer claims the two complete strings are compared directly.

25. Automated tests cover at least:
   - a manifest for a real-shaped ticket containing multiple runs and iterations;
   - a 3,108,985-byte-or-larger fixture manifest without file contents in the response;
   - a complete 1,460,837-byte-or-larger UTF-8 file response;
   - absent and empty optional directories;
   - hidden files and `.harness/` descendants being absent and unreadable;
   - malformed and mismatched `ticket.md` fields;
   - every status/code row in AC-9;
   - whole-file UTF-8 acceptance where a chunk boundary divides a multi-byte character;
   - invalid UTF-8 refusal;
   - traversal and symlink escapes;
   - tab order, multiple run/iteration hierarchy, `runs.log` present and absent, escaped rendering, and every request state; and
   - direct navigation and board-card navigation.

26. The mock-adapter end-to-end regression suite remains green. Before claiming the workspace suite is green, dependencies are installed with `pnpm install --frozen-lockfile` and tests are run with `pnpm turbo run test --force --continue`. Lint and typecheck also pass.

27. The architecture documentation's daemon route list and `apps/web` screen description are updated in the same change. If implementing the manifest/file split or hidden-file rule contradicts an existing decision, a new append-only decision entry is added rather than silently changing the earlier decision.

28. Cross-cutting product checks are explicit:
   - **BYOS:** no subscription-login behavior changes and no API-key path, fixture, documentation example, or environment-variable acceptance is added.
   - **Worktree safety:** no flow behavior changes; both routes are read-only and never write to the user's working tree.
   - **Gate behavior:** not applicable; no flow or gate changes.
   - **Files are the database:** the routes read current ticket files and add no daemon or browser persistence.
   - **Cross-vendor rule:** not applicable; no adapter, role, or flow changes.
   - **Product-agnostic:** no SaaS-specific behavior or examples are added.
   - **Cold-clone impact:** no installation step or external dependency is added; the workspace-local and locally packed paths continue to serve the same screen.

## Non-goals

- Building or changing the backlog board covered by Q-0017.
- Changing the shared frontmatter parser or fixing Q-0060.
- Returning a ticket's entire folder in one response.
- Showing hidden files, `.harness/` engine state, or files outside the ticket folder.
- Rendering binary or non-UTF-8 files.
- Adding file-size truncation, pagination, range requests, streaming, virtualized text, or a configurable payload cap.
- Parsing `runs.log` into links or adding run-history drill-down.
- Mission control, the gate screen, or any run-control action.
- Editing, creating, deleting, renaming, repairing, or downloading ticket files.
- Markdown or HTML rendering, syntax highlighting, previews, or remote assets.
- Redesigning artifact paths or renaming run- or iteration-scoped directories.
- Fixing the nondeterministic prefix-match behavior already preserved in `Backlog.dirOf`.
- Addressing `repo.max_diff_bytes` or the review-diff truncation ticket.
- Adding multi-user behavior, a remote daemon, cloud sync, a plugin marketplace, a visual node canvas, eval suites, another adapter, or a desktop shell.

## Open questions

None. The requirements choose a manifest plus lazy file route, exclude hidden engine state, preserve the on-disk hierarchy, refuse malformed ticket detail, require whole-file UTF-8, and render escaped text. These choices do not require a file-format or adapter-contract change.

## Risks

- A selected file can still be large. Lazy loading prevents a multi-megabyte initial folder response but does not reduce the cost of intentionally opening a large artifact. AC-7 makes that cost visible and leaves truncation to separately scoped work.
- Files can change between the manifest request and a file request. The file response therefore carries its current byte size, and the UI must render the returned file rather than assume the manifest size is a consistency guarantee.
- Symlink and traversal handling is security-sensitive. Tests must exercise raw and percent-encoded request paths through the real HTTP boundary, because URL constructors may normalize dot segments before the server receives them.
- A large preformatted text node can make browser rendering slow. The implementation must meet AC-21 without changing file contents or introducing an unstated cap.
- Optional tabs can produce a visually sparse page for older tickets. The absent-versus-empty rules are deliberate and must not be replaced with fabricated directories.
- The inherited fixes touch neighboring code outside the ticket screen. Their behavior is pinned by AC-22 through AC-24 so they do not expand into broader cost accounting or documentation rewrites.
