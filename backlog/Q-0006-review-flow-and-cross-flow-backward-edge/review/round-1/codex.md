# Code review

- **major** — `spike/src/adapters/index.js:130`: `PROBE_SCHEMA` declares the optional `summary` property but leaves it out of `required`. Codex strict structured-output schemas require every declared property to be required, as the adjacent comment itself notes. Consequently, `harness adapters --probe` can be rejected by Codex before a response is produced, regressing an existing required path (AC-29). Remove the unused property or include it in `required` and update the probe prompt to return it.
