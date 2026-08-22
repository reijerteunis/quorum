# Mock-adapter run-history contract

Q-0011 tests exercise real engine output without a vendor login. These deterministic environment
switches extend the existing mock adapter; their values control fixture data and are never copied
into run-history artifacts.

- `HARNESS_MOCK_VENDOR`, when non-empty, is the emitted usage vendor; default is `mock`.
- `HARNESS_MOCK_TOKEN_ONLY=1` makes `cost_usd` null; otherwise existing mock cost behaviour remains.
- `HARNESS_MOCK_CACHED_INPUT_TOKENS` and `HARNESS_MOCK_CACHE_WRITE_INPUT_TOKENS` set the respective
  non-negative numeric usage fields; when absent those fields are null. Invalid or negative values
  fail explicitly before emitting usage.
- `HARNESS_MOCK_RUN_HISTORY_PROFILES` may be a JSON object keyed by role whose values override
  `vendor`, `token_only`, `cached_input_tokens`, and `cache_write_input_tokens` for matching steps.
  This is the deterministic lever for producing priced and token-only vendors in one real run;
  malformed profiles fail explicitly.
- Every mock adapter run emits the normal typed lifecycle, text, verdict/retry where configured,
  final aggregate usage, and terminal events. It also emits at least one `raw` event containing
  preservation-only mock text, so deleting all raw lines proves they are not required.
- The engine receives only the resulting vendor-neutral events, never the switches or profile.

The mock reports cached fields as subsets of `input_tokens` and never adds them again when forming
that total. Existing Q-0006 mock switches retain their meanings.
