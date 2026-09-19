# Q-0137 — The drill-down serves what an occurrence retained

Stage: draft  
Iteration: 1  
Depends on: Q-0018

## Problem

The run-history screen shows what occurred in a run but cannot show the files retained for an occurrence. Adapter prompts and outputs already exist under `.quorum/runs`, but no server route reads them.

A retained file cannot be opened safely by joining paths in the server. The run manifest is parsed but not semantically validated on this read path, and its `occurrence_dir` may traverse outside the run directory. The untrusted path therefore comes from persisted run history, not from the browser.

The retained-file names are not a closed set: the writer accepts a file name as a parameter. The reader must enumerate an occurrence directory rather than hard-code `prompt.txt` and `output.txt`.

This ticket touches these surfaces:

- `packages/core`: confined occurrence-file listing and byte reading.
- `packages/shared`: wire types and runtime schemas for retained-file metadata and file content.
- `packages/server`: one retained-file route and the widened run-history detail response.
- `apps/web`: retained-file controls and text display inside Q-0018’s occurrence timeline.
- `docs/04-architecture.md`: the read-route register and package responsibilities.

The payload decision is settled here. `GET /history/:id` adds only file metadata `{name, bytes}` to each occurrence. A file’s text is fetched separately when a person opens that file. The measured largest occurrence is 355,744 bytes, while returning all text for a run could return 3,514,617 bytes and would pull Q-0076’s cap question into this ticket.

Serving a retained file is permitted. The daemon already serves manifest fields from `.quorum/runs`; retained text differs in payload size, not authority. The bounded, on-demand route remains part of the run-history surface and does not create a second surface over run state.

## User story

As a **solo maintainer**, I want each occurrence in a finished run to name the files it retained and let me open one file at a time, so I can inspect the exact prompt or output without using the filesystem and without allowing a damaged manifest to lead the daemon outside that run.

## Acceptance criteria

1. **Core — listing contract.** `@quorum/core` exports a function that accepts the runs root, a run token, and an occurrence sequence number. It returns a discriminated result for exactly one of: run not found, malformed manifest, occurrence not found, unsafe occurrence directory, occurrence files listed, or occurrence directory no longer readable. It does not return an absolute filesystem path.

2. **Core — occurrence identity.** The occurrence sequence number is the identity supplied by the caller. Core finds the manifest occurrence whose `occurrence_dir` yields that sequence. Zero matches return `occurrence-not-found`; more than one match returns `ambiguous-occurrence`. Core does not accept `occurrence_dir` from the caller.

3. **Core — manifest-path confinement.** Before enumerating files, core resolves the run directory and the manifest occurrence’s `occurrence_dir` with filesystem-aware confinement. The resolved occurrence directory must be inside that resolved run directory component by component. Absolute paths, `..` traversal, symlink escapes, missing targets, and non-directory targets are refused without enumerating or reading the external target.

4. **Core — traversal regression.** A core test first demonstrates the unsafe case with a fixture whose manifest contains `occurrence_dir: "../../../outside"`. The implemented listing and byte-reading functions refuse it, do not return any outside file name or content, and do not modify the fixture.

5. **Core — open file-name set.** A successful listing enumerates the occurrence directory at request time. It returns every direct regular file as `{name, bytes}`, sorted by name. It does not hard-code `prompt.txt`, `output.txt`, or any other retained-file register. Directories, sockets, and symbolic links are not listed.

6. **Core — listing names.** Each listed `name` is one leaf name, not a relative path: it is non-empty, is neither `.` nor `..`, and contains no `/` or `\`. `bytes` is the file size in bytes and may be zero.

7. **Core — byte-reader contract.** `@quorum/core` exports a separate byte-reading function accepting the runs root, run token, occurrence sequence number, and leaf file name. It performs run and occurrence confinement itself and returns a discriminated result. It never requires or accepts a path previously returned by another function.

8. **Core — membership per read.** The byte reader enumerates the occurrence directory for that invocation and opens the requested name only when it is a regular file in that enumeration. A name that was never in that request’s listing returns `not-an-occurrence-file`. The server must not treat metadata previously sent to a browser as proof of current membership.

9. **Core — one complete read.** For a member file, the byte reader performs one whole-file byte read and returns those bytes without truncation, pagination, replacement, or normalization. The response size is measured from the bytes actually read, not from an earlier directory entry.

10. **Core — changed file.** If a listed member is missing, is no longer a regular file, or has become a symbolic link when core attempts the read, the reader returns `file-no-longer-readable`. It does not collapse this condition into `not-an-occurrence-file` and does not follow the replacement target.

11. **Wire — occurrence file metadata.** `WireRunHistoryOccurrence` gains a required `files` array whose elements are exactly `{name: string, bytes: non-negative integer}`. The shared runtime schema parses the same shape. The manifest remains carried unchanged inside `manifest`; file metadata exists only on the route’s derived top-level `steps` copy.

12. **Server — history detail listing.** `GET /history/:id` calls the core listing function for every occurrence it returns and places the resulting metadata on that occurrence. It preserves Q-0018’s occurrence order and existing fields. It does not read any retained file body. A manifest with an unsafe, ambiguous, or unreadable occurrence directory produces HTTP 422 with a distinct refusal code naming that condition; it is not silently rendered as an occurrence with no files.

13. **Server — retained-file route.** The daemon exposes `GET /history/:id/file?occurrence=<sequence>&name=<leaf-name>`. Both `occurrence` and `name` are query values. `occurrence` must be a base-10, non-negative safe integer with no sign or fractional part. `name` must satisfy the leaf-name rules in AC-6. Missing or malformed query values return HTTP 400 without reading a retained file.

14. **Server — route outcomes.** The retained-file route maps core results to stable machine-readable refusal codes:

    - unknown run: `no-such-run`, HTTP 404;
    - malformed manifest: `malformed-manifest`, HTTP 422;
    - missing occurrence: `no-such-occurrence`, HTTP 404;
    - duplicate sequence identity: `ambiguous-occurrence`, HTTP 422;
    - unsafe occurrence directory: `unsafe-occurrence-directory`, HTTP 422;
    - invalid file name: `not-a-file-name`, HTTP 400;
    - name absent from the request-time listing: `not-an-occurrence-file`, HTTP 400;
    - listed file no longer readable as a regular file: `no-such-file`, HTTP 404;
    - bytes not valid UTF-8: `unsupported-file-encoding`, HTTP 422.

    Every refusal uses the existing wire refusal shape and names the condition without exposing an absolute path.

15. **Server — successful file response.** A successful retained-file response is `{name, bytes, text}`. `name` is the requested leaf name, `bytes` is the length of the bytes actually read, and `text` is the complete decoded content. Empty files succeed with `bytes: 0` and `text: ""`.

16. **Server — UTF-8 verdict.** The route validates and decodes the same byte buffer with `TextDecoder('utf-8', {fatal: true})`, or an equivalent single decoder with the same verdict. It must not classify a file as invalid merely because the decoded text contains U+FFFD. Tests cover valid text containing U+FFFD and malformed UTF-8 as separate cases.

17. **Shared contract.** The retained-file success body and its file-metadata element are declared once in `packages/shared`, each with a TypeScript type and executable runtime schema used by the browser. The server and web app do not redeclare either shape.

18. **Web — occurrence file list.** When a run row is opened, every occurrence in Q-0018’s timeline shows its retained files in the metadata order received from the route, including each file’s byte count. A file name is a button, not a filesystem link. The browser sends the run id, occurrence sequence, and file name; it never receives or composes `occurrence_dir`.

19. **Web — one file on demand.** Selecting a file issues one retained-file request and displays that file’s complete text in a whitespace-preserving, scrollable text region. The app does not preload file bodies, concatenate an occurrence’s files, or fetch every file in a run. Selecting another file replaces the displayed file. Closing an occurrence discards its file response rather than retaining a hidden cache.

20. **Web — request states.** A file control visibly distinguishes loading, loaded-empty, failed, and loaded-with-text states. A late response for a file that is no longer selected must not reopen or overwrite the current selection. A retry repeats only the failed file request.

21. **Web — non-adapter occurrence.** When an occurrence has no `prompt.txt` and its manifest fields identify it as a non-adapter occurrence, the timeline says: “This step was not an adapter call.” It does not render an empty prompt control and does not infer damage from the absence. Tests cover an `integrate` occurrence.

22. **Web — unfinished occurrence.** When an occurrence has no `output.txt` and its status is `running`, the timeline says: “This step has not finished.” It does not render an empty output control and does not describe the history as damaged.

23. **Web — terminal occurrence without output.** When a terminal occurrence has no `output.txt`, the screen reports that no output file was retained. It must not use the unfinished sentence from AC-22 or manufacture an empty output, because the writer normally creates `output.txt` during terminalisation.

24. **Web — unknown retained names.** A retained file with a name other than `prompt.txt` or `output.txt` is listed and can be opened with the same behavior. Its presence requires no web or server code change.

25. **Read-only behavior.** Listing or reading retained files creates, repairs, rewrites, touches, or deletes no file under `.quorum/` or elsewhere. A refused traversing manifest remains unchanged.

26. **Documentation.** `docs/04-architecture.md` adds `GET /history/:id/file` to the server route enumeration, states that `GET /history/:id` derives retained-file metadata through core, and assigns occurrence confinement and byte reading to core. It records that file content is fetched one file at a time and that the browser never receives `occurrence_dir`.

27. **Regression coverage.** Tests cover at least: a traversing `occurrence_dir`; a symlink escaping the run; duplicate occurrence sequences; an unknown retained name; an empty file; valid text containing U+FFFD; malformed UTF-8; a file removed or replaced between enumeration and read; an integrate occurrence without a prompt; a running occurrence without output; and a terminal occurrence without output. Existing run-history, mock-adapter end-to-end, lint, and typecheck suites remain green.

28. **Cross-cutting constraints.** This work adds no subscription path, does not invoke an adapter, does not create or use a worktree, changes no gate behavior, persists no event or schema field, introduces no vendor-specific knowledge, and adds no dependency. It does not alter either supported installation path or lengthen the cold-clone path.

## Non-goals

1. Rebuilding Q-0018’s history listing, table, occurrence timeline, or per-vendor roll-up.
2. Persisting events or presenting retained files as a trace. Finished runs still have no persisted event stream.
3. Returning every retained file body with a run, occurrence, or history-list response.
4. Adding pagination, truncation, size caps, retention rules, compression, eviction, or streaming. Q-0076 owns storage and payload caps.
5. Hard-coding a closed register of retained-file names.
6. Rendering Markdown, syntax highlighting, diff views, search, download, editing, or copying controls.
7. Repairing a manifest, occurrence directory, or missing retained file.
8. Exposing absolute paths, `occurrence_dir`, or another path-returning core helper.
9. Serving files from a backlog route or changing Q-0127’s `.harness/` exclusion.
10. Supporting remote daemons, multi-user authorization, cloud sync, a plugin marketplace, or a desktop shell.
11. Changing the run-manifest format, adapter contract, flow format, gate behavior, or event union.

## Open questions

No blocking product question remains for implementation.

The earlier authority question is resolved by these requirements: the existing run-history surface may serve one retained text file on demand. If implementation evidence shows that a single retained file can exceed the current measured 353,626-byte maximum enough to require a cap, the owner must stop this ticket and take that scope to Q-0076 rather than inventing a limit here.

## Risks

1. **Manifest traversal.** A reader may validate the browser’s file name but forget that `occurrence_dir` is the dangerous value. AC-3, AC-4, and AC-7 make the core boundary and regression fixture mandatory.
2. **Check/read race.** A file can change after enumeration. The contract distinguishes a non-member name from a member that is no longer readable and rechecks the file before opening it; it does not claim filesystem transactions or eliminate every race.
3. **Payload growth.** Reading one complete file is currently bounded by observed data, not by a product limit. A future writer can retain a much larger file. That remains Q-0076’s subject.
4. **Wire duplication.** The manifest and the derived `steps` projection already duplicate occurrence data. Adding `files` only to the derived projection avoids a third authority but requires the server and shared schema to remain aligned.
5. **Misleading absence copy.** Missing prompts and outputs have different meanings. Treating either as an empty file would hide whether an adapter ran or whether an occurrence finished.
6. **UTF-8 false refusals.** Searching decoded text for U+FFFD would reject valid retained prompts already present in this repository. The fatal decoder must decide validity from the original bytes.
7. **Stale browser responses.** File reads can complete after a person selects another occurrence or collapses the run. Generation or request identity guards are required so stale content cannot appear under the wrong occurrence.
