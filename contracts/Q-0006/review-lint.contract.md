# Review lint contract

`harness lint` loads the complete flow directory before reporting success. It performs no
adapter spawn and no backlog write.

- Every `goto: flow:<target>` resolves to a loadable `<target>.yaml`.
- Starting at the target flow's `produces`, following the unique available flow whose
  `consumes` equals the current stage must reach the source flow's `consumes`. If no flow
  consumes a stage, the error names source flow, target flow, and that terminal stage.
- Every `on_fail` requires `max_iterations` to be an integer greater than zero and names
  the step and field on failure.
- `counter` is a non-empty unprefixed key. `iterations.review` is rejected with a message
  suggesting `review`.
- In `cross_vendor: required`, each parallel group containing two or more steps with the
  same role spans at least two adapters. Failure names all member ids and the shared
  adapter. A later verdict step may consume artifacts from both adapters.

