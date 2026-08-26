/**
 * Contract validation. Solutioning emits JSON Schema contracts; qa-red writes tests that must fail
 * against them before development starts, which only works if something in the repository can
 * execute a schema ("Contracts are executable", docs/DECISIONS.md 2026-08-22).
 *
 * Deliberately separate from `checkAgainstSchema` in the adapter layer: that one guards vendor
 * output and must tolerate variance between CLIs, while a contract that bends is not a contract.
 * Vendor-wrapping tolerance belongs to `extractJson`, and neither is reachable from here
 * (register row 13).
 *
 * Nothing in this module prints. A result carries strings and states; the marker, the colour and
 * the indentation belong to the CLI, because M4's flow editor renders the same errors in a browser
 * and M3's server would otherwise put terminal control codes on a WebSocket (charter §7).
 *
 * Why: behaviour preserved from spike/src/contracts.js and spike/bin/harness.js:488–516 (Q-0045).
 */
import fs from 'node:fs';
import path from 'node:path';

import { Ajv2020 } from 'ajv/dist/2020.js';
import type { Schema } from 'ajv/dist/2020.js';
import * as ajvFormats from 'ajv-formats';
import type { FormatsPlugin } from 'ajv-formats';
import YAML from 'yaml';

import { checkRunManifestSemantics } from './run-manifest.js';

export { checkRunManifestSemantics };

/**
 * Both dependencies are CommonJS carrying declaration files written in ES module syntax, so under
 * `module: nodenext` a default import is typed as the whole module namespace rather than as the
 * value Node actually hands back. `Ajv2020` is taken as the named export the same declaration file
 * declares; the plugin has no named export, so its declared type is restored here. Both resolve at
 * run time to exactly what the spike's default imports resolve to, which the suite asserts.
 * `esModuleInterop` cannot help — it governs CommonJS emit and these files emit ES modules. See
 * Q-0045 OQ-4 and this ticket's implementation report.
 */
const addFormats = ajvFormats.default as unknown as FormatsPlugin;

/**
 * The one Ajv instance, built once at module scope.
 *
 * `ajv-formats` because contracts use `format: date-time` and ajv ignores unknown formats by
 * default — a contract declaring a check nobody performs is worse than one declaring nothing.
 * `strict: false` is what lets a product-level annotation such as `x-quorum-contract` sit in a
 * schema at all.
 *
 * Why: preserved defect, see AC-8 defects 1 and 2 — the instance caches every compiled schema by
 * `$id` for the life of the process, so a second read of the same schema file collides and a
 * long-lived server accumulates. Neither a per-call instance nor `removeSchema` may be introduced
 * here (Q-0045 OQ-6).
 */
const ajv = addFormats(new Ajv2020({ allErrors: true, strict: false }));

/** The one `x-quorum-contract` value that selects a semantic pass. */
const RUN_MANIFEST_CONTRACT = 'run-manifest-v1';

/** A structural verdict: `errors` is empty exactly when `ok`. */
export interface ValidationResult {
  ok: boolean;
  /** One `"<instance path>: <rule>"` per violation, in ajv's own order. Never an ajv error object. */
  errors: string[];
}

/** A verdict over two files, naming each by basename so a caller can print it without a path. */
export interface FileValidationResult extends ValidationResult {
  schema: string;
  data: string;
}

/**
 * Whether the semantic pass ran, and if not, why not. Three states, not two: `ran: true` is the
 * only value that may be read as "the semantic checks were performed", and no caller may infer it
 * from `ok` ("skipped is not passed", docs/DECISIONS.md 2026-08-25; register row 14).
 */
export type SemanticOutcome =
  | { contract: typeof RUN_MANIFEST_CONTRACT; ran: true }
  | { contract: typeof RUN_MANIFEST_CONTRACT; ran: false; reason: 'structurally-invalid' }
  | { contract: null; ran: false; reason: 'unrecognised-annotation' };

/** A structural verdict plus the disposition of the product-level pass that sits on top of it. */
export interface ArtifactValidationResult extends FileValidationResult {
  semantic: SemanticOutcome;
}

/**
 * Checks `data` against `schema`.
 *
 * @param schema a JSON Schema document, already parsed.
 * @param data the artifact under test.
 * @returns the verdict; never throws on invalid data.
 * @throws {Error} ajv's own error when the schema does not compile, which is an authoring bug and
 *   must stay loud, and when a schema carrying an `$id` this instance already holds is compiled a
 *   second time (AC-8 defect 1).
 */
export function validate(schema: unknown, data: unknown): ValidationResult {
  const check = ajv.compile(schema as Schema);
  if (check(data)) return { ok: true, errors: [] };
  return {
    ok: false,
    errors: (check.errors ?? []).map((e) => `${e.instancePath || '/'}: ${e.message}${e.params?.additionalProperty ? ` ("${e.params.additionalProperty}")` : ''}`),
  };
}

/**
 * Reads a `.json` or `.yaml`/`.yml` file. Contracts are JSON Schema; the artifacts under test may
 * be either, and `tasks.yaml` is YAML, so both are accepted rather than making callers care.
 *
 * The extension decides and nothing else: there is no content sniffing, no inferred extension and
 * no JSONL — `contracts/Q-0011/runs-cli.contract.md:36` refuses the last in as many words.
 *
 * @throws whatever the read or the parser throws, unchanged.
 */
export function readData(file: string): unknown {
  const text = fs.readFileSync(file, 'utf8');
  return /\.ya?ml$/i.test(file) ? YAML.parse(text) : JSON.parse(text);
}

/**
 * Reads a schema and an artifact from disk and checks one against the other.
 *
 * The schema is read on every call, which is what makes the `$id` collision above reachable from a
 * caller that loops over several data files. Hoisting the read is a fix, and fixing it here is not
 * this ticket's to make.
 */
export function validateFile(schemaFile: string, dataFile: string): FileValidationResult {
  const schema = readData(schemaFile);
  const data = readData(dataFile);
  return { ...validate(schema, data), schema: path.basename(schemaFile), data: path.basename(dataFile) };
}

/**
 * Structural validation, then the product-level semantic pass the schema's `x-quorum-contract`
 * annotation selects — in that order, because the pass assumes a well-formed document.
 *
 * Selection is by annotation and never by filename, path, title or `$id`; a missing, empty or
 * unrecognised value selects no pass and says so in `semantic`, which is the difference between
 * "checked against `run-manifest-v1`" and "structurally fine, nobody looked"
 * ("Product-level schema annotations select semantic validation", docs/DECISIONS.md 2026-08-23).
 *
 * The semantic errors REPLACE the structural ones rather than joining them, which costs nothing:
 * the pass runs only when structural validation returned none.
 *
 * Each file is read once here and reused for both passes. The spike reads each twice
 * (spike/bin/harness.js:494 and :510 against `validateFile`'s own reads); read count is internal
 * and charter §2 does not preserve it, and reading once removes a race between the two reads
 * rather than changing any outcome.
 */
export function validateArtifact(schemaFile: string, dataFile: string): ArtifactValidationResult {
  const schema = readData(schemaFile);
  const data = readData(dataFile);
  const structural = { ...validate(schema, data), schema: path.basename(schemaFile), data: path.basename(dataFile) };
  if ((schema as Record<string, unknown>)['x-quorum-contract'] !== RUN_MANIFEST_CONTRACT) {
    return { ...structural, semantic: { contract: null, ran: false, reason: 'unrecognised-annotation' } };
  }
  if (!structural.ok) {
    return { ...structural, semantic: { contract: RUN_MANIFEST_CONTRACT, ran: false, reason: 'structurally-invalid' } };
  }
  const errors = checkRunManifestSemantics(data);
  return { ...structural, ok: errors.length === 0, errors, semantic: { contract: RUN_MANIFEST_CONTRACT, ran: true } };
}
