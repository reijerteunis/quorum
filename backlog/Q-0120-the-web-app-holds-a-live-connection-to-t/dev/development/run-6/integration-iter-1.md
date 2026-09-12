# Integration — run 6, iteration 1

Target: `harness/Q-0120/integration`

Evidence: `harness/Q-0120/integration` at 3f75d86, base `main`.

- ✓ base `main`
- ✓ harness/Q-0120/backend-wire-schema
- ✓ harness/Q-0120/frontend-daemon-endpoints
- ✓ harness/Q-0120/frontend-connection-state
- ✓ harness/Q-0120/frontend-dev-proxy
- ✓ harness/Q-0120/backend-lockfile-test-input
- ✓ harness/Q-0120/frontend-run-connection
- ✓ harness/Q-0120/frontend-react-connection
- ✓ harness/Q-0120/backend-connection-docs
- ✓ harness/Q-0120/frontend-frame-parser

Install: `pnpm install --frozen-lockfile` → exit 0

Tests: `pnpm turbo run test --force --continue` → exit 0 (expected pass) → OK
