// Two shapes that sit next to each other, are named alike in conversation, and mean opposite
// things. One is what a FLOW FILE ASKS FOR; the other is what an AGENT ANSWERED. Importing the
// wrong one is a defect no type error would catch if they were structurally compatible, so they
// are deliberately incompatible: neither parses as the other, and there is a test that says so.
//
// ---------------------------------------------------------------------------------------------
// FOUR VALIDATIONS EXIST IN THIS PRODUCT AND NONE OF THEM IS ANOTHER
// ---------------------------------------------------------------------------------------------
//
//   1. zod, here — the shape of Quorum's OWN FILES: flow files, ticket frontmatter, role
//      frontmatter, and the two shapes below. Nothing here validates a vendor's output.
//   2. `checkAgainstSchema` (spike/src/adapters/index.js:181) — an agent's structured output
//      against the schema QUORUM ITSELF GENERATED from the flow file (`schemaFor`,
//      spike/src/engine.js:679). Strict, including the coupling that a pass verdict carries no
//      findings (:204-208). Ported by Q-0046.
//   3. ajv, fully strict (spike/src/contracts.js) — artifacts against SOLUTIONING'S CONTRACTS.
//      JSON Schema is the language solutioning emits and zod cannot read it, so ajv is not
//      replaced by anything here. Ported by Q-0045.
//   4. `extractJson` (spike/src/adapters/index.js:169) — tolerance for how a VENDOR WRAPS its
//      answer, and the only place that tolerance belongs.
//
// Register row 22 of harness/port-charter.md and "Step-output validation is Quorum's contract with
// its own agents" (docs/DECISIONS.md, 2026-08-22) both turn on keeping these four apart. Adding
// zod must not tempt anyone to collapse them.
import { z } from 'zod';

/**
 * (a) THE DECLARATION — a flow step's `output:` block. What the flow file asks the step to
 * produce.
 *
 * This is the one object in this package that rejects unknown keys instead of passing them
 * through, and it is the reason a declaration cannot be mistaken for a result. The engine reads
 * this block exhaustively — `writesOf` takes `write` and `writes` (spike/src/engine.js:739),
 * `runAgentStep` takes `verdict` and `verdict_file` (:287-289) — so a key it does not know is a
 * key nothing will ever act on, and silently ignoring one is how `wrties:` costs a run.
 *
 * Known casualty, named rather than absorbed: `output.append` is sketched at
 * docs/02-sdlc-pipeline-spec.md:365 for the unshipped `qa-final.yaml` and is implemented nowhere.
 * It is rejected here rather than typed, because typing it would imply something acts on it. That
 * is a stop-and-report for whichever ticket writes `qa-final.yaml` (Q-0012): implement `append` or
 * drop it from the sketch. No shipped flow uses it.
 */
export const stepOutputDeclarationSchema = z.object({
  /** One path inside the ticket folder — spike/src/engine.js:739. */
  write: z.string().optional(),
  /** Several. The document is written to each — spike/src/engine.js:283-286. */
  writes: z.array(z.string()).optional(),
  /**
   * The pipe-delimited vocabulary, as one string: the engine splits it at
   * spike/src/engine.js:684 and the FIRST option means pass (:307). Not a list.
   */
  verdict: z.string().optional(),
  /** Where the verdict JSON lands; defaults inside the engine, never here (:288). */
  verdict_file: z.string().optional(),
}).strict();

/**
 * (b) THE RESULT — Quorum's parsed structured answer from an agent step. What came back.
 *
 * `schemaFor` (spike/src/engine.js:679-692) can build exactly four shapes, from two independent
 * decisions:
 *
 *   `{summary}`                              — the step writes nothing and returns no verdict
 *   `{summary, document}`                    — the step declared `write`/`writes`
 *   `{summary, verdict, findings}`           — the step declared a verdict
 *   `{summary, document, verdict, findings}` — both
 *
 * and a fifth distinction that is not a fifth shape: when the verdict vocabulary contains
 * `changes-requested`, each finding must additionally match `FINDING_PATTERN` (constants.ts) —
 * severity, `file:line`, then the finding; otherwise any
 * string will do (:685-687). Which of those applies depends on the step's verdict vocabulary,
 * which this schema does not see — so `findings` is typed as strings and the pattern stays with
 * `checkAgainstSchema`, where the generated schema carries it.
 *
 * `verdict` is likewise a plain string. The legal values for a given step are that step's
 * generated enum, and the coupling that a pass verdict carries no findings is enforced at
 * spike/src/adapters/index.js:204-208. Restating either here would be a second, drifting copy.
 *
 * Strict for the same reason the generated schema is closed (spike/src/engine.js:691, enforced at
 * spike/src/adapters/index.js:185-187): an answer with a key nobody asked for is an answer that
 * did not follow the contract.
 */
export const agentStepResultSchema = z.union([
  z.object({
    summary: z.string(),
    document: z.string().optional(),
  }).strict(),
  z.object({
    summary: z.string(),
    document: z.string().optional(),
    verdict: z.string(),
    findings: z.array(z.string()),
  }).strict(),
]);

export type StepOutputDeclaration = z.infer<typeof stepOutputDeclarationSchema>;
export type AgentStepResult = z.infer<typeof agentStepResultSchema>;
