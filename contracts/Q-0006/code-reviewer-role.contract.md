# Code reviewer role contract

`harness/roles/code-reviewer.md` and its template copy are byte-identical. Frontmatter
must contain an `adapter` whenever it contains `model`; the shipped role contains neither,
so each review step controls its own vendor and no vendor receives another vendor's model.

The persona reads the supplied requirement, solution, and diff; never edits or rewrites
code; classifies every finding as exactly `blocker`, `major`, or `nit`; and cites every
finding as `file:line`. The verdict instruction in `review-flow.contract.yaml` is tested
literally for the threshold: nits alone approve, while any surviving blocker or major
requests changes. Schema tests separately reject `approve` with non-empty findings.
Real-CLI evidence that the instruction is followed is saved in the ticket folder.
