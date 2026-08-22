# Q-0033 documentation and evidence contract

## Product documentation

The documentation shipped with Q-0033 describes the same review surface as
`contracts/Q-0006/review-flow.contract.yaml` and
`contracts/Q-0033/cli-review-surface.contract.md`:

- `docs/02-sdlc-pipeline-spec.md` routes rejection to the derived target stage, shows
  `{base}...harness/{id}/integration`, `{round}`, `counter: review`, the configured base,
  the `200000`-byte default, and exhaustion that `--auto` cannot bypass. Its review
  example has no `judge` type, payload-only fields, `with`, or pinned model, and it closes
  the M1 lighter-flow question with no lighter `fix` flow.
- `docs/06-development-plan.md` attributes the review engine to Q-0006 and the shipped
  surface to Q-0033, and includes that surface in M1's completion condition.
- `docs/DECISIONS.md` appends, without rewriting prior entries, one decision for derived
  regression and one for the non-auto exhaustion gate. Each entry follows the repository
  format: dated title, **Decision**, **Alternatives considered**, and **Why**.
- `docs/GLOSSARY.md` extends **Gate** to distinguish an author-declared
  `human-locked` deploy gate from the engine-presented exhaustion gate that uses the same
  kind. **Role** is unchanged.

README is outside this contract; Q-0028 owns its first-run rewrite.

## Automated evidence

`npm test --prefix spike` is deterministic and covers the asset parity, init discovery
and fallback, all whole-directory lint fixtures, run-preflight ordering and zero side
effects, ordered gate answers, non-interactive failures, `--auto` exhaustion protection,
and unchanged board display/cost behavior. Existing API-key refusal and no-pinned-Codex-
model assertions remain green. Tests requiring a gate provide explicit answers.

## Manual closing evidence

After automated implementation is integrated, the maintainer runs the first real review
against Q-0006 using authenticated Claude Code and Codex CLIs. The maintainer records in
the Q-0033 ticket folder that both reviewers received the harness-materialised diff under
plan/read-only sandbox and that the verdict applied the severity threshold. This task is
manual, subscription-consuming, and never runs during developer fan-out or automated
tests. No API key is introduced.

