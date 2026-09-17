# Review: Q-0130

Verdict: **revise**

- major: `apps/web/src/mission-control-screen.tsx:220` `daemonSaysRunning(metadata)` becomes false as soon as `readMetadata()` replaces the last loaded run with `in-flight`, and also remains false if that read becomes unreachable or unparseable. The screen therefore removes the stop control and withdraws its pending confirmation even though the daemon’s last reported run state is still `running`. AC-8 explicitly bases availability on the daemon’s **last reported** state; a request state is not a new run-state report. Preserve the last successfully reported run state while reads are pending or fail, and withdraw the confirmation only when a daemon response actually reports a non-running run. Add coverage showing that starting or failing a metadata refresh after a `running` response leaves the stop control and pending confirmation available.

observation: The supplied patch omitted `docs/05-design-prompt.md`, `packages/server/src/http.ts`, `packages/server/src/package.test.ts`, `packages/shared/src/docs.test.ts`, `packages/shared/src/wire.test.ts`, and `packages/shared/src/wire.ts` because of truncation; these files were inspected directly from `harness/Q-0130/implement`.
