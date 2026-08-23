# Mock-adapter run-history contract

Q-0011 tests exercise real engine output without a vendor login. These deterministic environment
switches extend the existing mock adapter. New switches use the existing `MOCK_` prefix. Switch
names and environment representation are never
copied into run-history artifacts. Values intentionally emitted as domain data may be copied: in
particular `MOCK_VENDOR` becomes `usage.vendor`, which is required for multi-vendor tests.

- `MOCK_VENDOR`, when non-empty, is the adapter's self-declared vendor and emitted usage vendor;
  default is `mock`.
- `MOCK_TOKEN_ONLY=1` makes `cost_usd` null; otherwise existing mock cost behaviour remains.
- `MOCK_CACHED_INPUT_TOKENS` and `MOCK_CACHE_WRITE_INPUT_TOKENS` set the respective
  non-negative numeric usage fields; when absent those fields are null. Invalid or negative values
  fail explicitly before emitting usage.
- `MOCK_RUN_HISTORY_PROFILES` may be a JSON object keyed by role whose values override
  `vendor`, `token_only`, `cached_input_tokens`, and `cache_write_input_tokens` for matching steps.
  This is the deterministic lever for producing priced and token-only vendors in one real run;
  malformed profiles fail explicitly.
- Every mock-backed occurrence returns normal text, structured output, and aggregate usage through
  the existing adapter result/error boundary. Live `onEvent` behaviour is unchanged and is never
  persisted by Q-0011.
- `MOCK_FAIL_WRITE` remains the billed-failure fixture. Its thrown usage receives the selected
  profile's vendor and cache fields through the same wrapper as every other billed failure, and
  exposes the actual adapter-attempt count.
- The engine receives only the resulting values, never an environment object or switch name.

The mock reports cached fields as subsets of `input_tokens` and never adds them again when forming
that total. Existing Q-0006 mock switches retain their meanings.
