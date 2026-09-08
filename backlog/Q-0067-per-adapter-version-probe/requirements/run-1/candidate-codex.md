# Q-0067 — Per-adapter version probe and unsupported CLI behaviour

## Problem

Quorum invokes vendor CLIs whose flags and structured-output formats can change independently. Each adapter already runs its configured `versionArgs` during `check()` and returns the CLI’s trimmed version string, but Quorum does not interpret or report what that version means for compatibility.

A static supported-version range would not solve this reliably. Quorum is local-first and has no authoritative offline mechanism for keeping such a range current. A newly released CLI could be compatible but fall outside a stale range, while a release inside a broad range could still change behaviour Quorum depends on. Refusing either case based only on the version string would create a cold-clone failure without proving an incompatibility.

The existing authenticated operation behind `quorum adapters --probe` already exercises the behaviour Quorum needs: the adapter must invoke the CLI, receive structured output, and map it through the adapter contract. Q-0067 therefore treats the installed version as diagnostic evidence and the probe result as the compatibility verdict. It does not introduce a static supported range or version-based capability selection.

This behaviour change requires an accepted decision entry before implementation because it defines what Quorum claims about CLI compatibility and when the CLI command refuses.

Surfaces touched: the `quorum adapters --probe` human-readable and `--json` reports, the per-adapter capabilities modules, the adapter contract documentation, and the decision index. The Studio, `harness/` file formats, backlog file formats, and run preflight are not changed.

## User story

As a **cold-clone adopter**, I want `quorum adapters --probe` to show the exact installed CLI version and whether that installed CLI completed Quorum’s real adapter probe, so that I can identify a CLI update as relevant evidence without being blocked merely because Quorum has not seen its version before.

As a **maintainer**, I want probe failures to preserve the installed version and the underlying failure, so that I can distinguish “this machine runs version X and the adapter contract probe failed” from an unsupported-version claim that Quorum cannot substantiate.

As an **adapter contributor**, I want version-probe arguments and compatibility reporting to remain per-adapter while the verdict follows one shared contract, so that a new adapter does not leak vendor-specific version rules into the CLI or core orchestration code.

## Acceptance criteria

1. Before implementation lands, `docs/decisions/` contains a new accepted decision entry, and `docs/DECISIONS.md` indexes it using the landing date. The decision states that:
   - Quorum does not ship a static supported-version range for an adapter in this ticket;
   - the installed version is diagnostic evidence;
   - a successful authenticated structured-output probe verifies the installed CLI for the behaviour exercised by that probe only;
   - an unrecognised, newer, older, or unparseable version string is not by itself grounds for refusal; and
   - no adapter behaviour branches on the version in this ticket.

2. Each shipped vendor capabilities module remains the source of its own `versionArgs`. `claude-capabilities.ts` and `codex-capabilities.ts` each provide the arguments used by that adapter’s `check()` call. No vendor-specific version command, parser, range, or comparison is introduced in `packages/cli`, shared flow code, or run-engine code.

3. For each installed shipped vendor CLI, `quorum adapters --probe` invokes the adapter’s existing `check()` exactly once before making the authenticated probe and reports the trimmed stdout returned by `check()` as the installed version. The command does not make a second version invocation.

4. The BYOS refusal remains earlier than every CLI invocation. If any of `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, or `CODEX_API_KEY` is set, the affected adapter refuses before its version command or authenticated probe is invoked. Tests prove the subprocess was not started.

5. A successful authenticated probe produces a compatibility verdict of `verified` for that adapter. `verified` means only that this installed CLI completed the current probe through the adapter contract; it does not claim that every flag, event shape, model, or future flow operation is compatible.

6. A failed authenticated probe produces a compatibility verdict of `unverified` for that adapter and preserves the probe’s actionable error. The human-readable report must not label the version `unsupported` unless Quorum has evidence specific to that version; this ticket adds no such evidence source.

7. A version string that is empty after trimming is treated as a failed presence check and is not reported as a verified installed version. The adapter entry records the existing runnable/presence error shape, the authenticated probe is not invoked for that adapter, and processing continues to the next adapter.

8. A non-empty version string is treated as opaque text. Representative tests cover at least:
   - the currently observed plain numeric form, such as `2.1.236`;
   - a prefixed form, such as `codex-cli 0.150.1`;
   - a prerelease or vendor-suffixed form; and
   - a future version not named in the repository.

   None is refused or downgraded solely because its text cannot be compared with a repository value.

9. In the human-readable `quorum adapters --probe` output, each installed adapter’s section shows:
   - the adapter name;
   - the exact trimmed version string;
   - `compatibility verified` when the authenticated probe succeeds, or `compatibility unverified` when it fails; and
   - the existing round-trip, reported cost, reported token count, or failure detail where available.

10. In the `quorum adapters --probe --json` report, every installed adapter entry contains:
    - `adapter` with the adapter name;
    - `installed: true`;
    - `version` with the exact trimmed version string;
    - `compatibility`, whose value is exactly `verified` or `unverified`; and
    - the existing probe result fields.

    An adapter whose presence check fails retains `installed: false` and its `error`; it does not receive a fabricated `version` or `compatibility` value.

11. `quorum adapters --probe` retains its existing command-level exit policy: it exits successfully only when every reported shipped vendor adapter completes the authenticated probe successfully, and exits with the established soft error status when any adapter is absent, fails its presence check, or has `compatibility: unverified`. The command completes the report for all adapters before returning that status.

12. `quorum adapters` without `--probe` remains a presence-only report. It reports the exact version returned by `check()`, makes no authenticated request, makes no compatibility claim, retains `login: unverified` in its existing JSON contract, and retains its existing report-only exit behaviour.

13. `board`, `lint`, `run`, and run preflight gain no authenticated request and no version verdict. Their use of an adapter presence check, where applicable, does not refuse a CLI merely because its version is unfamiliar.

14. No capability, flag, JSONL field, envelope field, retry rule, or model selection branches on an installed version. Source-level tests fail if a version comparison or version-selected capability set is added to either shipped adapter as part of Q-0067.

15. `docs/03-adapter-contract.md` is updated to define the version and compatibility fields, distinguish presence from compatibility, and state the exact limited meaning of `verified`. Its verification table may record the versions used for a dated observation, but must not present those versions as a supported range.

16. `docs/04-architecture.md` is updated so that its version-probe statement matches the accepted policy: per-adapter version invocation data lives with adapter capabilities, while runtime compatibility is established by `adapters --probe`; Q-0067 is no longer described as deferred after it lands.

17. Automated tests cover both shipped vendor adapters and the CLI report in human-readable and `--json` modes. They include a successful probe on an unfamiliar future version and a failed probe on a familiar version, proving that the verdict follows observed behaviour rather than version comparison.

18. The mock-adapter end-to-end regression suite remains green. Tests use controlled CLI stubs and values they set themselves; their verdict does not depend on which real vendor CLI version, subscription login, gitignored directory, or account configuration exists on the test machine.

19. The change adds no dependency. If implementation determines that a dependency is necessary, requirements must return to the gate because parsing or comparing versions is outside the accepted policy.

20. Cross-cutting checks are satisfied as follows:
    - **BYOS:** applicable; the existing environment refusal remains before both version and authenticated probes.
    - **Worktree safety:** not applicable; this command does not run a flow or write code.
    - **Gate behaviour:** not applicable; no flow gate changes.
    - **Files and schema:** no persistent file format changes; the command’s `--json` report gains the `compatibility` field defined in AC-10.
    - **Cross-vendor rule:** not applicable; no flow or reviewing step changes.
    - **Product-agnostic:** applicable; vendor knowledge stays inside each adapter and its capabilities module.
    - **Cold-clone impact:** the explicit probe performs no additional vendor request beyond the authenticated request it already performs; ordinary commands gain no request and do not reject unfamiliar versions.

## Non-goals

- Defining a static minimum, maximum, semantic-version range, allowlist, or denylist for a vendor CLI.
- Declaring a CLI version unsupported solely because it is older, newer, unparseable, or absent from Quorum’s dated verification evidence.
- Selecting different capability sets, flags, JSONL fields, or parsing behaviour by installed version.
- Providing a compatibility shim for an older CLI.
- Automatically updating compatibility data from a registry, vendor service, release feed, or remote Quorum service.
- Adding network access other than the authenticated vendor request already made by `adapters --probe`.
- Moving the version verdict into `check()`, `board`, `lint`, `run`, or run preflight.
- Changing model-selection policy or pinning a vendor model name.
- Repairing unrelated preserved defects in `probeAdapter` or redesigning the complete `adapters --probe` JSON format.
- Adding support for another adapter, including Gemini.
- Changing the Studio, a flow file, ticket schema, run-history schema, worktree handling, or gate behaviour.

## Open questions

None blocking. The following assumptions are explicit and must return to the requirements gate if implementation evidence disproves them:

1. **Owner: product manager.** The existing authenticated probe exercises enough of the adapter contract to justify the narrow phrase `compatibility verified`. If it validates only login and not structured output through the adapter contract, the verdict must instead be named `probe passed`; implementation must not silently broaden the claim.

2. **Owner: CLI maintainer.** Adding `compatibility` to each installed adapter entry is additive for known consumers of the combined `--json` report. If a documented consumer requires an exact closed schema, compatibility and migration handling need a separate decision before this field lands.

3. **Owner: adapter maintainer.** An empty successful stdout from the version command is not a valid installed-version observation. If either shipped vendor intentionally emits its version somewhere other than stdout, that adapter needs a separately specified extraction rule rather than accepting an empty value.

## Risks

- A successful minimal probe can verify only the behaviour it exercises. Users may read `verified` as a guarantee covering all flow operations. The CLI and adapter contract must state the narrow meaning directly.
- A CLI can pass the probe while breaking a flag or event shape used only by longer runs. This ticket improves diagnostics but does not eliminate the need for adapter regression tests against real CLIs.
- A failed probe may result from subscription state, connectivity, model availability, or a CLI compatibility change. Reporting `unverified` avoids a false unsupported-version diagnosis, but maintainers may still need the preserved error and version to identify the cause.
- The added JSON field changes machine-readable output. Even an additive field can affect consumers that incorrectly assume an exact key set.
- Keeping versions opaque deliberately prevents proactive refusal of a known-bad release. If Quorum later obtains reliable version-specific evidence and needs to refuse or branch, that is a new behaviour decision with its own maintenance policy and tests.
