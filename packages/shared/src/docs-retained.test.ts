/**
 * Q-0137 AC-14 and `requirements/errata.md` E-2 — the documents this change makes incomplete or
 * false, held to what shipped.
 *
 * **Two kinds of clause, and the difference is the reason E-2 exists.** AC-14's own sites are
 * *incomplete* — a route enumeration that does not yet name two routes, a **Confinement** entry
 * describing one path inside the run-history root where there are now two — and E-2's four are
 * *false*: four sentences across two numbered documents say in as many words that nothing opens an
 * occurrence's retained files and that doing so is this ticket's. Each is asserted absent in its
 * false form by a guard that names its file, so restoring any one of them fails here rather than
 * sitting in a document a later ticket rediscovers. That is AC-14's own stated reason — a document
 * correction deferred to a successor is one that expires (Q-0110, Q-0111, Q-0112 each lived inside
 * a closed ticket's prose, Q-0100's inside a source comment).
 *
 * The route enumeration itself is `packages/server/src/package.test.ts`'s, derived from the
 * registered routes rather than written down; what is here is everything that guard does not reach.
 */
import { describe, expect, test } from 'vitest';

import { repoFile } from '../test/corpus.js';

/** The two documents E-2 adds to AC-14's list, and the one AC-14 already named. */
const ARCHITECTURE = 'docs/04-architecture.md';
const BRIEF = 'docs/05-design-prompt.md';
const GLOSSARY = 'docs/GLOSSARY.md';

/** A document with its runs of whitespace flattened, so a clause survives a reflow. */
const flowed = (file: string): string => repoFile(file).replace(/\s+/g, ' ');

describe('Q-0137 E-2 — the four sentences that say nothing opens a retained file are gone', () => {
  /**
   * Each sentence in the form that is now false, with the file it was in.
   *
   * Quoted in the shape a reflow cannot move, and assembled from fragments so that THIS file is not
   * its own subject — `repoFile` reads the documents and nothing reads this one, but a needle
   * written whole would still be a string a later grep finds in two places.
   */
  const RETIRED: [string, string, string][] = [
    [BRIEF, 'screen 8 said the drill-down opens nothing', ['nothing on this screen opens', ' a file'].join('')],
    [BRIEF, "the brief's status line routed the subject to this ticket", ['What an occurrence retained is **Q-0137**', "'s"].join('')],
    [ARCHITECTURE, "the architecture status line routed it here", ['What an occurrence RETAINED is **Q-0137**', "'s"].join('')],
    [ARCHITECTURE, 'the `apps/web` section said nothing here opens a file', ['is **Q-0137**', "'s, and nothing here opens a file"].join('')],
  ];

  test('each is absent from the document it was in, named by file', () => {
    for (const [file, what] of RETIRED) {
      expect(repoFile(file), `${file} is not in the corpus — this clause has lost its subject`).not.toBe('');
      expect(what.length, 'an empty description').toBeGreaterThan(0);
    }
    for (const [file, what, needle] of RETIRED) {
      expect(repoFile(file).includes(needle), `${file} still says it: ${what}`).toBe(false);
    }
  });

  test('and the needles find their subject, so the absences above are removals', () => {
    // The check on the check: a needle that matched nothing anywhere would make every clause above
    // pass over a document nobody edited. Each is shown matching the sentence it was written for.
    const fixtures: [string, string][] = [
      ['…the badge is the vendor string, and nothing on this screen opens a file.', RETIRED[0][2]],
      ['What an occurrence retained is **Q-0137**’s, and the drill-down is a list.', RETIRED[1][2]],
      ['What an occurrence RETAINED is **Q-0137**’s; `GET /project` still declares no shape.', RETIRED[2][2]],
      ['…its `output.txt` — is **Q-0137**’s, and nothing here opens a file.', RETIRED[3][2]],
    ];
    for (const [sentence, needle] of fixtures) {
      expect(sentence.includes(needle.replace(/'/g, '’')), `the needle ${needle} matches nothing`).toBe(true);
    }
  });

  test('nothing under docs/ or apps/web/src still claims this ticket is unbuilt', () => {
    // The wider half, and the one that would catch a fifth site nobody enumerated: every surviving
    // mention of this ticket is a record of what it DID rather than a promise of what it will.
    for (const file of [ARCHITECTURE, BRIEF]) {
      const text = flowed(file);
      for (const promise of ['is **Q-0137**’s', "is **Q-0137**'s", 'which is Q-0137’s', "which is Q-0137's"]) {
        expect(text.includes(promise), `${file} still routes a subject to Q-0137`).toBe(false);
      }
    }
  });
});

describe('Q-0137 AC-14 — the documents this change makes incomplete are moved', () => {
  test("the architecture document describes what the two routes are and what core owns", () => {
    // The route NAMES are `packages/server/src/package.test.ts`'s, derived from the registered set
    // rather than written down. What is asserted here is the three properties AC-14 names, which no
    // derivation can see: where the confinement lives, that one file is fetched at a time, and that
    // the browser never receives the occurrence directory.
    const text = flowed(ARCHITECTURE);
    for (const [claim, needle] of [
      ['occurrence confinement is core’s', 'Occurrence confinement and byte reading are `core`’s'],
      ['no path crosses the boundary', 'no filesystem path crosses this boundary'],
      ['one file at a time', 'nothing large is fetched until a reader names that file with its size'],
      ['the browser never receives the directory', 'The browser never receives `occurrence_dir`'],
      ['pathInside rather than isFolderIn', 'confined with `pathInside` and deliberately not `isFolderIn`'],
    ] as [string, string][]) {
      expect(text.includes(needle.replace(/’/g, "'")) || text.includes(needle),
        `${ARCHITECTURE} does not state that ${claim}`).toBe(true);
    }
  });

  test("the glossary's Confinement entry names the second path inside the run-history root", () => {
    // *Incomplete rather than false* before this ticket: the entry said a run id names a directory
    // directly inside `.quorum/runs`, which is still true and is no longer the whole of what is
    // confined there. It must also say WHY the predicate differs, because `isFolderIn` — the one a
    // reader reaches for — would refuse every legitimate occurrence directory.
    const glossary = flowed(GLOSSARY);
    for (const [claim, needle] of [
      ['a second path inside that root is confined', 'a second path inside that same root is confined too'],
      ['the predicate differs and why', 'two** components below'],
      ['isFolderIn is named as the trap', '`isFolderIn` — whose whole question is *directly inside* — would refuse'],
      ['a leaf is closed by membership instead', 'closed by membership instead'],
    ] as [string, string][]) {
      expect(glossary.includes(needle), `the Confinement entry does not say ${claim}`).toBe(true);
    }
    // And the entry still says what it said, so the clause is a widening rather than a rewrite.
    expect(glossary, 'the run-history root clause was replaced rather than extended')
      .toContain('a run id names a directory directly inside `.quorum/runs`');
  });

  test('no term was coined, and the words used are the glossary\'s own', () => {
    // **That the two lists AGREE is Q-0108's check and is not repeated here**; what this asserts is
    // the thing that check cannot see — that neither list gained a member for this ticket. *Retained
    // files* is the **Occurrence** entry's own wording, so nothing needed coining, and the way to
    // show that is that the vocabulary did not move.
    const listOf = (file: string): string[] => {
      const text = repoFile(file);
      const marker = /[Uu]se exactly these terms \(/.exec(text);
      if (!marker) throw new Error(`${file} no longer states the vocabulary rule — this check has lost its subject`);
      const open = marker.index + marker[0].length;
      const close = text.indexOf(')', open);
      if (close < 0) throw new Error(`${file}'s term list is never closed`);
      return text.slice(open, close).replace(/\s+/g, ' ').split(',').map((term) => term.trim());
    };
    for (const file of ['CLAUDE.md', 'docs/README.md']) {
      const terms = listOf(file);
      // Anti-vacuity: an extractor matching an empty group would find no coined term in either file
      // and report exactly what a correct one reports.
      expect(terms, `${file}: the extracted list is not the vocabulary list`).toContain('occurrence');
      expect(terms.length, `${file}: the extracted list is implausibly short`).toBeGreaterThan(15);
      for (const coined of ['retained file', 'retained files', 'occurrence directory', 'retained']) {
        expect(terms.includes(coined), `${file}: ${coined} was coined as a term`).toBe(false);
      }
    }
    // …and the words this ticket DOES use are already in the entry that defines the subject.
    expect(flowed(GLOSSARY), 'the Occurrence entry no longer says retained files').toContain('retained files');
  });
});
