# Q-0124 review — run 2, iteration 2

Verdict: **revise**

major: docs/USAGE.md:288 The documented `--filter=@quorum/cli --no-deps` example cannot demonstrate the missing-bundle refusal because this Turbo version rejects `--no-deps` as an unexpected argument before running any build. Replace it with the supported dependency-excluding form (for example, verify and document `--only`), and add coverage that executes or otherwise validates the documented command so the advice cannot drift from the installed Turbo CLI.
