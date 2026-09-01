# Q-0090 code review — run 2, iteration 3

major: packages/cli/src/frame.source.test.ts:35 The BYOS guard derives only `*.ts` files below `packages/cli/src`, while AC-12 explicitly requires scanning all of `packages/cli/**`, including tests, fixtures, help text, and documentation examples. Credentials introduced in a non-TypeScript fixture, package-level documentation, or configuration file would therefore pass unnoticed. Derive the scan from the package root and cover all relevant text files, with narrow, asserted exclusions for the guard itself and any binary/generated content.
