# Mock adapter verdict switches

`spike/src/adapters/mock.js` supports deterministic, test-only verdict controls:

- `MOCK_ALWAYS_PASS=1` selects the first (passing) verdict enum value.
- `MOCK_ALWAYS_FAIL=1` selects the last (failing) verdict enum value.
- Setting both is an explicit configuration error before a verdict is emitted.
- With neither set, the existing per-role/per-task call-count behaviour is unchanged.

The controls affect only steps whose output schema contains `verdict`. They do not alter
adapter failures, document generation, task fan-out, or production engine routing.
