# Integration — run 4, iteration 1

Target: `harness/Q-0015/integration`

Evidence: `harness/Q-0015/integration` at 6642de9, base `main`.

- ✓ base `main`
- ✓ harness/Q-0015/T01
- ✓ harness/Q-0015/T02
- ✓ harness/Q-0015/T03
- ✓ harness/Q-0015/T04
- ✓ harness/Q-0015/T05
- ✓ harness/Q-0015/T06
- ✓ harness/Q-0015/T07
- ✓ harness/Q-0015/T08
- ✓ harness/Q-0015/T09
- ✓ harness/Q-0015/T10

Install: `pnpm install --frozen-lockfile` → exit 0

Tests: `pnpm turbo run test --force --continue` → exit 1 (expected pass) → NOT OK
