// Environment switches, set and put back.
//
// The mock adapter reads nine of them and `withRetry` is exercised through one of them, so more than
// one suite needs this. It restores through a `finally`, because a test that leaks `MOCK_ALWAYS_FAIL`
// into the next file is a failure nobody can read.

/**
 * Runs `fn` with `values` applied to `process.env`, then restores every key it touched — including
 * the ones that were not set before, which are deleted rather than left as the string `"undefined"`.
 *
 * @param values the switches to set; `null` unsets one for the duration.
 */
export async function withEnv<T>(values: Record<string, string | null>, fn: () => Promise<T> | T): Promise<T> {
  const previous = Object.keys(values).map((key): [string, string | undefined] => [key, process.env[key]]);
  for (const [key, value] of Object.entries(values)) {
    if (value === null) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return await fn();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}
