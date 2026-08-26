// The rule that once broke `adapters --probe`, as something a test can execute rather than a
// comment somebody has to notice.
//
// Every schema Quorum sends a vendor must list every property it declares in `required` and must be
// closed. OpenAI strict structured outputs reject anything else, and the vendor error that comes
// back looks exactly like a broken login — which is how the probe reported codex unusable while the
// login was fine, for as long as the rule lived only in a comment (Q-0034).
//
// It lives here, beside `corpus.ts` and `repo.ts`, rather than inside one module's suite, because it
// has TWO subjects and they land in different tickets: `PROBE_SCHEMA` (Q-0046) and `schemaFor`
// (Q-0052, still in spike/src/engine.js). spike/test/q0034-probe-schema.js keeps covering the second
// until Q-0052 ports it, and Q-0052 imports this rather than retyping the rule.

/** The part of a JSON Schema the rule reads. Structural, so a caller imports no type to use it. */
export interface StrictSchemaSubject {
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
}

/**
 * @param schema a schema that is about to be handed to a vendor.
 * @param label what a problem names, so a caller checking several knows which one failed.
 * @returns every way `schema` breaks the rule. Empty when it obeys it.
 */
export function strictSchemaProblems(schema: StrictSchemaSubject, label: string): string[] {
  const problems: string[] = [];
  if (schema.additionalProperties !== false) problems.push(`${label}: additionalProperties must be false`);
  const undeclared = Object.keys(schema.properties ?? {}).filter((property) => !(schema.required ?? []).includes(property));
  if (undeclared.length) problems.push(`${label}: every property must appear in required (codex rejects the schema otherwise): ${undeclared.join(', ')}`);
  return problems;
}
