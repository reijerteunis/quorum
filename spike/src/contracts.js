// Contract validation. Solutioning emits JSON Schema contracts; qa-red writes tests that must
// fail against them before development starts. That only works if something in the repository can
// actually execute a schema — see the "contracts must be executable" decision, 2026-08-22.
//
// Deliberately separate from checkAgainstSchema() in adapters/: that one is minimal on purpose,
// because it guards vendor output and must tolerate variance between CLIs. This one is strict,
// because a contract that bends is not a contract.
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

// ajv-formats because contracts use `format: date-time` (ticket history timestamps) and ajv
// ignores unknown formats by default — a contract that declares a check nobody performs is worse
// than one that declares nothing.
const ajv = addFormats(new Ajv2020({ allErrors: true, strict: false }));

// Returns { ok, errors: [ "path: message", … ] }. Never throws on invalid data — only on a
// schema that does not compile, which is an authoring bug and must be loud.
export function validate(schema, data) {
  const check = ajv.compile(schema);
  if (check(data)) return { ok: true, errors: [] };
  return {
    ok: false,
    errors: (check.errors ?? []).map((e) => `${e.instancePath || '/'}: ${e.message}${e.params?.additionalProperty ? ` ("${e.params.additionalProperty}")` : ''}`),
  };
}

// Read a .json or .yaml/.yml file. Contracts are JSON Schema; the artifacts under test may be
// either, and tasks.yaml is YAML, so accept both rather than making callers care.
export function readData(file) {
  const text = fs.readFileSync(file, 'utf8');
  return /\.ya?ml$/i.test(file) ? YAML.parse(text) : JSON.parse(text);
}

export function validateFile(schemaFile, dataFile) {
  const schema = readData(schemaFile);
  const data = readData(dataFile);
  return { ...validate(schema, data), schema: path.basename(schemaFile), data: path.basename(dataFile) };
}
