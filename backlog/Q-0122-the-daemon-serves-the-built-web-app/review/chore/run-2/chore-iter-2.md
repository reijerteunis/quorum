# Q-0122 — code review, run 2, iteration 2

**Verdict: `revise`.**

blocker: packages/server/src/static.ts:218 `confinedFile()` validates the path and returns its name, but `sendFile()` subsequently reopens that name with `readFileSync`. Between those operations, a rebuild or local filesystem actor can replace the validated file or one of its parent directories with a symlink, causing the read to escape the supplied bundle root. The implementation explicitly supports rebuilding while the daemon runs, and AC-17 unconditionally requires that no outside path is served, so the new per-request check does not fully close the confinement boundary. Open the validated target without following a replaced link and read from that already-open handle, with equivalent protection for replaceable parent components; add a deterministic regression test that swaps the target after validation but before the read and proves outside bytes are never returned.
