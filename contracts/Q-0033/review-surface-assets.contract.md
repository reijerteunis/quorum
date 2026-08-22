# Q-0033 review surface assets contract

This contract selects the human-authored surface of the frozen Q-0006 review design. It
does not amend any file under `contracts/Q-0006/`.

## Shipped flow

`harness/flows/review.yaml` and
`spike/templates/harness/flows/review.yaml` are byte-identical. After parsing either
file with `YAML.parse` and deleting the loader-only `file` property, its value deep-equals
`contracts/Q-0006/review-flow.contract.yaml` parsed the same way. In particular, the
shipped file uses no fields outside that fixture.

Every `.yaml` filename and byte sequence under `harness/flows/` has an identical peer
under `spike/templates/harness/flows/`, and vice versa. This directory parity rule is
limited to flows.

## Shipped role

`harness/roles/code-reviewer.md` and
`spike/templates/harness/roles/code-reviewer.md` are byte-identical and implement
`contracts/Q-0006/code-reviewer-role.contract.md`. Their frontmatter contains neither
`adapter` nor `model`. The body:

- reads the supplied requirement, solution, and diff;
- is read-only and never edits or rewrites code;
- classifies each finding as exactly `blocker`, `major`, or `nit`; and
- cites each finding as `file:line`.

Severity threshold language belongs only to the verdict step instructions in the flow,
not to this role. No directory-wide role parity rule exists: repository developer roles
and adopter-template developer roles intentionally differ.

## Frozen-input guard

The surface implementation and its tests do not modify `contracts/Q-0006/**` relative to
commit `5d16e06`. The executable guard is:

```sh
git diff --quiet 5d16e06 -- contracts/Q-0006/
```

