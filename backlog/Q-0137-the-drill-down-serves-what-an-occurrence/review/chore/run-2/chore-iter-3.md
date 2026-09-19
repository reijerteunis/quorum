# Review — Q-0137 run 2, iteration 3

major: packages/core/src/run-history/reader.ts:635 `readRetainedFile` maps every non-confinement `retainedIn` failure—including `EACCES` or `EIO` while enumerating or measuring the occurrence directory—to `not-an-occurrence-file`. That outcome and AC-5’s corresponding 400 code assert that the name was not in this request’s own listing, but here no listing could be derived. This turns “could not tell” into a false negative and can mislead clients into treating a retained file as absent. Add a discriminated unreadable-occurrence outcome/refusal, or otherwise preserve the inability-to-enumerate condition, and test that an entry-level metadata failure does not produce `not-an-occurrence-file`.

observation: The supplied patch was truncated and omitted seven files; I reviewed the omitted production server and shared wire files directly from `harness/Q-0137/implement`.
