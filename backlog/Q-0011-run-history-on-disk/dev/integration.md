# Integration — run 9, iteration 1

Target: `harness/Q-0011/integration`

- ✓ base `main`
- ✓ harness/Q-0011/q0011-engine-writer
- ✓ harness/Q-0011/q0011-cli-reader-validator

Install: `npm install --prefix spike --no-audit --no-fund --silent` → exit 0

Tests: `npm test --prefix spike` → exit 1 (expected pass) → NOT OK
