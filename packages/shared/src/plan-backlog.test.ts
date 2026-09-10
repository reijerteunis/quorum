// The development plan and `backlog/` are two records of the same set of tickets, and until now
// nothing checked them against each other. The gap is measured rather than asserted: Q-0074 and
// Q-0077 sat in `backlog/` for three days without the plan naming either, and Q-0039 and Q-0040
// had full entries in the plan for a week with no folder — the same drift, once in each direction,
// twice in four days. That is the class Q-0072 and Q-0073 closed one layer down: a claim nothing
// executes.
//
// The two directions are NOT symmetric, which is the whole design.
//
//   backlog → plan   is absolute. A ticket that exists is work in flight, and the plan is where
//                    this project records what is in flight. There is no legitimate reason for one
//                    to be missing, so this direction needs no exceptions and has none.
//
//   plan → backlog   is not. M3–M6 name their tickets years before anyone creates them, which is
//                    what a plan is for. Only the CURRENT milestone's bullets are held to it, and
//                    even there a bullet may legitimately name uncreated work — so those are a
//                    register with a reason each, not a blanket rule. A NEW uncreated bullet fails
//                    until someone classifies it, which is Q-0054's spike-parity shape: keys from
//                    the tree, so the register cannot silently stop covering anything.
import { describe, expect, test } from 'vitest';

import { read, repoFile, ticketFiles } from '../test/corpus.js';

const PLAN = 'docs/06-development-plan.md';

/** The ticket id grammar, as `docs/GLOSSARY.md` defines it and `harness runs <token>` resolves it. */
const ID = /\bQ-[0-9]{4}\b/g;

/** Every id with a folder in `backlog/`, from the tree rather than from any document. */
function created(): Set<string> {
  const ids = ticketFiles().map((file) => {
    const folder = file.split('/').at(-2) ?? '';
    const id = /^(Q-[0-9]{4})/.exec(folder)?.[1];
    if (!id) throw new Error(`backlog folder does not begin with a ticket id: ${folder}`);
    return id;
  });
  return new Set(ids);
}

/** Every id the plan names anywhere — prose, tables, headings, strike-through. */
const named = (): Set<string> => new Set(repoFile(PLAN).match(ID) ?? []);

/**
 * A ticket bullet in the plan, at any nesting depth.
 *
 * The anchor was `^- ` until 2026-09-10, which excluded every INDENTED bullet — and the plan nests
 * a cut's children under their parent, so Q-0009's fourteen port children, Q-0010's eleven CLI
 * children and Q-0102 were outside two of this file's three directions. Censused before the rule
 * moved: 64 bullets matched at column zero, 101 with nesting allowed, and **all 37 newly visible
 * ids have a folder in `backlog/`** — the relaxation admits no prose and no false positive. It was
 * found by the check below firing on Q-0102's absence at M2's close, which is the
 * `q0050.source.test.ts` shape Q-0051 found: a guard that fails OPEN for a shape nobody considered.
 *
 * Prose is still excluded, which was the original anchor's purpose: an id mentioned inside another
 * ticket's paragraph is not a bullet, because a bullet needs its `- ` after nothing but whitespace.
 */
const BULLET = /^[ \t]*- (?:~~)?(Q-[0-9]{4})\b/gm;

/** Every milestone heading, in document order, with its `Mn` label. */
const MILESTONE = /^## (M\d) [^\n]*$/gm;

/**
 * The ids that head a bullet in the current milestone's ticket list.
 *
 * A bullet is `- Q-nnnn` or `- ~~Q-nnnn` (withdrawn). An id mentioned *inside* another ticket's
 * prose is not a bullet and is not held to this rule, which is why the anchor is the line start.
 */
/** The `Mn` label of the first milestone heading the plan does not mark closed. */
function currentMilestone(): string {
  const headings = [...repoFile(PLAN).matchAll(MILESTONE)];
  return headings.find((heading) => !/✅ closed/.test(heading[0]))?.[1] ?? 'no open milestone';
}

function currentMilestoneBullets(): string[] {
  const text = repoFile(PLAN);
  const headings = [...text.matchAll(MILESTONE)];
  const index = headings.findIndex((heading) => !/✅ closed/.test(heading[0]));
  if (index < 0) {
    throw new Error(`${PLAN} marks every "## Mn" heading ✅ closed — this test cannot locate the current milestone and refuses to pass over a corpus it cannot read`);
  }
  const from = headings[index]!.index! + headings[index]![0].length;
  const to = index + 1 < headings.length ? headings[index + 1]!.index! : text.length;
  const bullets = [...text.slice(from, to).matchAll(BULLET)].map((m) => m[1]);
  if (!bullets.length) throw new Error(`${PLAN}'s ${headings[index]![1]!} section lists no ticket bullets — this test proves nothing without them`);
  return [...new Set(bullets)];
}

/**
 * M2 bullets that deliberately have no folder, each with the reason it does not.
 *
 * A register of identities rather than a count, per Q-0073: a floor passes while a member is
 * swapped out. Removing an id from here without creating its folder fails, and creating a folder
 * for one listed here fails too — so the register cannot rot in either direction.
 */
const UNCREATED: Record<string, string> = {
  'Q-0012': 'qa-final.yaml and deploy.yaml. Blocked by Q-0056, which must first settle what `route` is.',
  'Q-0013': "M3's planned ticket, not yet opened: server package with REST + WS.",
  'Q-0014': "M3's planned ticket, not yet opened: web app shell, theme, routing, WS client.",
  'Q-0015': "M3's planned ticket, not yet opened: mission control screen.",
  'Q-0016': "M3's planned ticket, not yet opened: gate screen with diffs.",
  'Q-0017': "M3's planned ticket, not yet opened: backlog board and ticket page.",
  'Q-0018': "M3's planned ticket, not yet opened: run history and trace drill-down.",
  'Q-0019': "M3's planned ticket, not yet opened: resume interrupted runs.",
};


/**
 * Ticket ids bulleted under a milestone heading the plan marks closed.
 *
 * The two existing directions check whether a ticket EXISTS on both sides. Neither asks whether a
 * ticket's own state agrees with the milestone that claims to have delivered it — which is how
 * Q-0001, Q-0002 and Q-0003 sat at `draft`, two of them p1, for ten days after M0 closed with a
 * decision entry naming their work as done. A board that lists them is not wrong about the files;
 * it is wrong about what is open, and that is the question a board exists to answer.
 */
function closedMilestoneBullets(): string[] {
  const text = repoFile(PLAN);
  const headings = [...text.matchAll(MILESTONE)];
  const ids: string[] = [];
  headings.forEach((heading, index) => {
    if (!/✅ closed/.test(heading[0])) return;
    const from = heading.index! + heading[0].length;
    const to = index + 1 < headings.length ? headings[index + 1]!.index! : text.length;
    for (const [, id] of text.slice(from, to).matchAll(BULLET)) ids.push(id!);
  });
  return [...new Set(ids)];
}

/**
 * A ticket's `stage:`, read from its own frontmatter rather than from any document.
 *
 * Reads through `read` and the path `ticketFiles()` produced, rather than re-deriving a
 * repo-relative one: the audited walk already knows where the file is, and slicing its own output
 * to feed a second reader is an indirection Q-0072's input guard correctly refuses.
 */
function stageOf(id: string): string | null {
  const file = ticketFiles().find((path) => (path.split('/').at(-2) ?? '').startsWith(`${id}-`));
  return file ? (/^stage:\s*(\S+)/m.exec(read(file))?.[1] ?? null) : null;
}

describe('the development plan and backlog/ agree about which tickets exist', () => {
  test('every ticket in backlog/ is named in the plan', () => {
    const missing = [...created()].filter((id) => !named().has(id)).sort();
    expect(missing, `${PLAN} names no entry for ${missing.join(', ')} — a ticket exists in backlog/ and the plan does not know. Add its line rather than deleting the folder.`).toStrictEqual([]);
  });

  // The third direction, and the one nothing asked until 2026-09-01.
  test('no ticket of a closed milestone is still a draft', () => {
    const stillDraft = closedMilestoneBullets()
      .filter((id) => stageOf(id) === 'draft')
      .sort();
    expect(stillDraft, `${stillDraft.join(', ')} sit at stage: draft under a milestone the plan marks ✅ closed. Either the milestone is not closed or the ticket is not a draft — advance the ticket, or say in its runs.log where its work was actually done.`).toStrictEqual([]);
  });

  // The check must be able to see something: a closed milestone whose bullets all lack folders
  // would make the test above pass over nothing at all.
  test('the closed milestones do name tickets that exist, so the check above has a subject', () => {
    const withFolders = closedMilestoneBullets().filter((id) => stageOf(id) !== null);
    expect(withFolders.length, 'M0 and M1 must between them name at least four tickets with folders').toBeGreaterThanOrEqual(4);
  });

  test('every M2 bullet either has a folder or is registered as deliberately uncreated', () => {
    const unexplained = currentMilestoneBullets()
      .filter((id) => !created().has(id) && !(id in UNCREATED))
      .sort();
    expect(unexplained, `${PLAN}'s ${currentMilestone()} list has a bullet for ${unexplained.join(', ')} with no folder in backlog/ and no entry in UNCREATED. Create the ticket, or register it here with the reason it does not exist.`).toStrictEqual([]);
  });

  test('the register names only uncreated bullets, so it cannot excuse a ticket that exists', () => {
    // The failure Q-0073 found in `NOT_READ`: nothing asserted a key was still a member of the set
    // it excuses, so an entry could go on reading as coverage while excusing nothing.
    const stale = Object.keys(UNCREATED).filter((id) => created().has(id)).sort();
    expect(stale, `UNCREATED excuses ${stale.join(', ')}, which now has a folder in backlog/. Remove the entry.`).toStrictEqual([]);
    const notBullets = Object.keys(UNCREATED).filter((id) => !currentMilestoneBullets().includes(id)).sort();
    expect(notBullets, `UNCREATED names ${notBullets.join(', ')}, which is not a ${currentMilestone()} bullet, so the entry excuses nothing.`).toStrictEqual([]);
  });

  test('both directions have a subject, so neither can pass over an empty corpus', () => {
    expect(created().size).toBeGreaterThan(50);
    // The floor is deliberately small and must stay that way. It read `> 20` until 2026-09-10 and
    // went red the moment M2 closed and M3 became current with nineteen bullets — a floor tuned to
    // one milestone's size is a check whose verdict depends on which milestone is current, which is
    // the class `git-identity.test.ts` exists to forbid. Its only job is that the reader found more
    // than a stray line; `currentMilestoneBullets` already throws on an empty parse.
    expect(currentMilestoneBullets().length).toBeGreaterThan(3);
    // The register is load-bearing: without it the second test would be red today.
    const registered = Object.keys(UNCREATED).filter((id) => currentMilestoneBullets().includes(id) && !created().has(id));
    expect(registered.length, 'UNCREATED excuses nothing, so the current-milestone bullet test would pass with or without it').toBeGreaterThan(0);
  });
});
