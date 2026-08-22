# Review lint contract

`harness lint` loads the complete flow directory before reporting success. `harness run`
performs the same directory validation before its first `adapter.run` and before any
ticket-folder write; it reports the identical lint error. Both entry points perform no
adapter spawn or backlog write on failure.

- Every `goto: flow:<target>` resolves to a loadable `<target>.yaml`.
- Starting at the target flow's `produces`, follow flows by matching `consumes` to the
  current stage until the source flow's `consumes` is reached. The walk keeps a visited
  set of `(flow, stage)` pairs and must terminate. No consumer is a dead end; more than
  one consumer on a stage actually reached by this walk is ambiguous; a repeated pair is
  a cycle. Unreached stages with multiple consumers do not make lint fail. Each error names the source
  flow, target flow, current stage, and (for ambiguity/cycle) the implicated flows.
  `review -> development` and `review -> qa-red` are positive fixtures. Self-target
  `review -> review` is built in a temporary harness directory as the named negative
  fixture: it dies at stage `reviewed`.
- Every `on_fail` requires `max_iterations` to be an integer greater than zero and names
  the step and field on failure.
- `counter` is a non-empty unprefixed key. `iterations.review` is rejected with a message
  suggesting `review`.
- In `cross_vendor: required`, each parallel group containing two or more steps with the
  same role spans at least two adapters. Failure names all member ids and the shared
  adapter. A later verdict step may consume artifacts from both adapters.
