# Integration — run 3, iteration 2

Target: `harness/Q-0120/integration`

Evidence: `harness/Q-0120/integration` at 8b73663, base `main`.
Evidence: `harness/Q-0120/tests` diverges from `harness/Q-0120/integration` at 8b73663.

- ✓ base `main`
- ✓ harness/Q-0120/tests

Install: `pnpm install --frozen-lockfile` → exit 0

Tests: `pnpm turbo run test --force --continue` → exit 1 (expected fail) → OK
