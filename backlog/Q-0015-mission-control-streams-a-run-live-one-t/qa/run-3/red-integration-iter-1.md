# Integration — run 3, iteration 1

Target: `harness/Q-0015/integration`

Evidence: `harness/Q-0015/integration` at 616f047, base `main`.
Evidence: `harness/Q-0015/tests` diverges from `harness/Q-0015/integration` at 616f047.

- ✓ base `main`
- ✓ harness/Q-0015/tests

Install: `pnpm install --frozen-lockfile` → exit 0

Tests: `pnpm turbo run test --force --continue` → exit 1 (expected fail) → OK
