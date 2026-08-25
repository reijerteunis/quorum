// A role file's frontmatter. The markdown body underneath is the persona prompt and is
// deliberately outside this schema — nothing interprets role prose, and a schema that pretended to
// would be claiming a capability the product does not have.
//
// EVERY FIELD IS OPTIONAL, and one role proves why: harness/roles/code-reviewer.md opens with two
// consecutive `---` lines and carries no frontmatter at all, so the engine is handed an empty
// object for it (spike/src/backlog.js:11-15). A schema requiring even `adapter` would reject a
// role the product ships and runs on every review.
import { z } from 'zod';

export const roleSchema = z.object({
  /**
   * The role's default adapter. A step always wins over it, and it is inherited across steps only
   * when the vendors match (spike/src/engine.js:670-675). Open string, like every other adapter
   * name here.
   */
  adapter: z.string().optional(),
  /**
   * The role's default model — a VENDOR ALIAS, and therefore only inherited by a step running on
   * this role's own adapter. Sending one vendor's alias to another fails or silently degrades
   * ("Flows never pin a vendor model name", docs/DECISIONS.md 2026-08-22). The schema does not
   * judge whether a model is valid for an adapter; only the vendor's own login knows that.
   */
  model: z.string().optional(),
  /**
   * The role's write allow-list — and it is ADVISORY. Nothing reads it: a search of the spike's
   * source for `paths` returns no reader, and ownership reaches an agent only as prose, in the
   * role body and in a task's `description` (harness/architecture.md;
   * harness/roles/principal-architect.md:17-18). Typing it here must not be read as enforcement.
   * `spike/test/smoke.js` compares it against the third column of the role table in
   * harness/architecture.md, which is the only thing that checks it at all.
   */
  paths: z.array(z.string()).optional(),
}).passthrough();

export type Role = z.infer<typeof roleSchema>;
