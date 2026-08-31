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

import { repoFile, ticketFiles } from '../test/corpus.js';

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
 * The ids that head a bullet in the current milestone's ticket list.
 *
 * A bullet is `- Q-nnnn` or `- ~~Q-nnnn` (withdrawn). An id mentioned *inside* another ticket's
 * prose is not a bullet and is not held to this rule, which is why the anchor is the line start.
 */
function currentMilestoneBullets(): string[] {
  const text = repoFile(PLAN);
  const start = text.indexOf('\n## M2 ');
  const end = text.indexOf('\n## M3 ');
  if (start < 0 || end < 0 || end <= start) {
    throw new Error(`${PLAN} no longer has an "## M2 " section followed by "## M3 " — this test cannot locate the current milestone and refuses to pass over a corpus it cannot read`);
  }
  const bullets = [...text.slice(start, end).matchAll(/^- (?:~~)?(Q-[0-9]{4})\b/gm)].map((m) => m[1]);
  if (!bullets.length) throw new Error(`${PLAN}'s M2 section lists no ticket bullets — this test proves nothing without them`);
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
  'Q-0010': 'the CLI package. M2\'s largest remaining item; the cutover queues behind it. Needs its own cut, like Q-0009 did.',
  'Q-0012': 'qa-final.yaml and deploy.yaml. Blocked by Q-0056, which must first settle what `route` is.',
};

describe('the development plan and backlog/ agree about which tickets exist', () => {
  test('every ticket in backlog/ is named in the plan', () => {
    const missing = [...created()].filter((id) => !named().has(id)).sort();
    expect(missing, `${PLAN} names no entry for ${missing.join(', ')} — a ticket exists in backlog/ and the plan does not know. Add its line rather than deleting the folder.`).toStrictEqual([]);
  });

  test('every M2 bullet either has a folder or is registered as deliberately uncreated', () => {
    const unexplained = currentMilestoneBullets()
      .filter((id) => !created().has(id) && !(id in UNCREATED))
      .sort();
    expect(unexplained, `${PLAN}'s M2 list has a bullet for ${unexplained.join(', ')} with no folder in backlog/ and no entry in UNCREATED. Create the ticket, or register it here with the reason it does not exist.`).toStrictEqual([]);
  });

  test('the register names only uncreated bullets, so it cannot excuse a ticket that exists', () => {
    // The failure Q-0073 found in `NOT_READ`: nothing asserted a key was still a member of the set
    // it excuses, so an entry could go on reading as coverage while excusing nothing.
    const stale = Object.keys(UNCREATED).filter((id) => created().has(id)).sort();
    expect(stale, `UNCREATED excuses ${stale.join(', ')}, which now has a folder in backlog/. Remove the entry.`).toStrictEqual([]);
    const notBullets = Object.keys(UNCREATED).filter((id) => !currentMilestoneBullets().includes(id)).sort();
    expect(notBullets, `UNCREATED names ${notBullets.join(', ')}, which is not an M2 bullet, so the entry excuses nothing.`).toStrictEqual([]);
  });

  test('both directions have a subject, so neither can pass over an empty corpus', () => {
    expect(created().size).toBeGreaterThan(50);
    expect(currentMilestoneBullets().length).toBeGreaterThan(20);
    // The register is load-bearing: without it the second test would be red today.
    const registered = Object.keys(UNCREATED).filter((id) => currentMilestoneBullets().includes(id) && !created().has(id));
    expect(registered.length, 'UNCREATED excuses nothing, so the M2-bullet test would pass with or without it').toBeGreaterThan(0);
  });
});
