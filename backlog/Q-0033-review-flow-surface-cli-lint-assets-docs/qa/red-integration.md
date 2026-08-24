# Integration — run 9, iteration 1

Target: `harness/Q-0033/integration`

Evidence: `harness/Q-0033/integration` at 65f0cdb, base `main`.
Evidence: `harness/Q-0033/tests` diverges from `harness/Q-0033/integration` at 65f0cdb.

- ✓ base `main`
- ✓ harness/Q-0033/tests

Install: `npm install --prefix spike --no-audit --no-fund --silent` → exit 0

Tests: `npm test --prefix spike` → exit 1 (expected fail) → OK
