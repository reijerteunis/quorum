// The backlog stage vocabulary, moved from the spike's `STAGES` (spike/src/backlog.js:6-9)
// unchanged and in order. One source: the `Stage` type and `stageSchema` are both derived from
// this tuple, and no second hand-written list of stage names exists in this package.
//
// This is a LIST, not a state machine. The spike contains no transition table — `STAGES` is used
// only to order the board's columns (spike/bin/harness.js:434) and, with a hard-coded first-three
// subset, to decide which empty columns still render (:436). Transitions are the flow directory's
// `consumes`/`produces` fields: the engine guards on them (spike/src/engine.js:38-40), advances on
// them (:622-624), and the whole-directory lint walks the return chain through them
// (spike/src/lint.js:147-181). Nothing anywhere validates that a ticket's `stage` is a member of
// this list at read or write time.
//
// The edges drawn at docs/02-sdlc-pipeline-spec.md:92-101 — the three bounded backward edges and
// chore's three-stage skip — are deliberately NOT encoded here. Encoding them would be new
// behaviour, which "The port preserves behaviour; one exception is authorised and everything else
// stops the child" (docs/DECISIONS.md, 2026-08-25) forbids without a decision of its own.
import { z } from 'zod';

export const STAGES = [
  'draft', 'requirements', 'solutioned', 'red', 'green', 'reviewed', 'qa-passed', 'deployed',
  'blocked', 'abandoned',
] as const;

export type Stage = (typeof STAGES)[number];

export const stageSchema = z.enum(STAGES);
