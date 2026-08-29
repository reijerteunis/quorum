# Integration — run 3, iteration 4

Target: `harness/Q-0050/integration`

Evidence: `harness/Q-0050/integration` at 686de87, base `main`.
Evidence: `harness/Q-0050/tests` diverges from `harness/Q-0050/integration` at 686de87.

- ✓ base `main`
- ✓ harness/Q-0050/tests

Install: `npm install --prefix spike --no-audit --no-fund --silent && pnpm install --frozen-lockfile` → exit 0

Tests: `npm test --prefix spike && pnpm turbo run test --force` → exit 1 (expected fail) → OK
