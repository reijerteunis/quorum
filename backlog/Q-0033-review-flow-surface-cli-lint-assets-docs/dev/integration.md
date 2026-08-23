# Integration — run 4, iteration 4

Target: `harness/Q-0033/integration`

- ✓ base `main`
- ✓ harness/Q-0033/Q0033-cli-lint-config
- ✓ harness/Q-0033/Q0033-assets-docs

Install: `npm install --prefix spike --no-audit --no-fund --silent` → exit 0

Tests: `npm test --prefix spike` → exit 1 (expected pass) → NOT OK
