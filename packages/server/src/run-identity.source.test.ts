/**
 * Q-0131 AC-3 — the two sentences about run identity that moved, and the three that must not.
 *
 * **Both directions, in one file, because the failure this guards against is a partial
 * correction.** This repository's most-recorded operator failure is fixing the instance a reviewer
 * names rather than the class it belongs to (Q-0112, five rounds; Q-0039 erratum E-1; Q-0129
 * rounds one to four), and this change has exactly that shape: two sentences dated the run number's
 * arrival to the end of the run and went false, while three sentences saying only the terminal
 * EVENT carries run identity stayed true — because a callback is not an event, which is the whole
 * of erratum E-1's reasoning. Correcting one of the first two, or "correcting" one of the last
 * three, are both single-site edits that a clause over one file would pass.
 *
 * **What it reads and why nothing is declared for it.** `packages/shared/src/wire.ts` and
 * `packages/shared/src/events.ts` reach this task through the workspace dependency edge, and
 * `docs/GLOSSARY.md` reaches it the way `docs/04-architecture.md` already does and which this
 * package's `turbo.json` states at length: `@quorum/shared#test` declares that document for its own
 * assertions, and the root `test` task's `^test` edge puts that task's hash inside this one. So
 * this file adds no input, and the coverage is transitive and said out loud rather than assumed —
 * Q-0072 erratum E-1's discipline, that a registered gap is acceptable and the same gap unmentioned
 * is the defect.
 *
 * Every needle is assembled, on `gate-evidence.source.test.ts`'s rule: the retired wordings are
 * what this file asserts the ABSENCE of, so writing one out here would be fine for the two files it
 * reads and would make this file its own subject the day anything scans this package for them.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

/** The repository root: `packages/server/src/` → three levels up. */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

/** One file of this repository, by path from the root, failing loudly when it is not there. */
function repoFile(relative: string): string {
  const file = path.join(ROOT, relative);
  if (!fs.existsSync(file)) throw new Error(`this check has lost its subject: ${relative} is not there`);
  return fs.readFileSync(file, 'utf8');
}

const WIRE = 'packages/shared/src/wire.ts';
const HOST = 'packages/server/src/host.ts';
const EVENTS = 'packages/shared/src/events.ts';
const GLOSSARY = 'docs/GLOSSARY.md';

/**
 * The wordings that went false, each as `[what it was, where it was]`.
 *
 * Both say the same thing in different words — *the number is not there until the run ends* — which
 * is what a reader of either would have believed and what a live run now disproves.
 */
const RETIRED: [string, string][] = [
  [['`null` until the terminal ', 'event carries it'].join(''), WIRE],
  [['correlated when the terminal event arrives ', 'and `null` before it'].join(''), HOST],
];

/**
 * The sentences that stayed, each as `[the sentence, where it is]`.
 *
 * They are the three erratum E-1 measured before the transport was chosen, and they are why the
 * number travels out of band at all: a `start` member on the event union would have made every one
 * of them false by a word and owed a decision entry before a line of code.
 */
const UNMOVED: [string, string][] = [
  ['only the terminal event carries run identity', GLOSSARY],
  [['run identity only to the terminal event and ', 'deliberately adds no timestamp or sequence number'].join(''), EVENTS],
  [['The terminal event is the only event carrying run identity, ', 'and its `runId` is a typed field'].join(''), HOST],
];

describe('Q-0131 AC-3 — what the run number\'s earlier arrival did and did not make false', () => {
  test('neither corrected site still dates the number to the end of the run', () => {
    for (const [retired, where] of RETIRED) {
      expect(repoFile(where).includes(retired), `${where} still says the number arrives only at the end`).toBe(false);
      // The needle has a subject: the same reading finds the wording where it is written, so the
      // absence above is an absence rather than a typo that matches nothing.
      expect(`/** ${retired} */`.includes(retired), `the needle for ${where} matches nothing`).toBe(true);
    }
    // …and each corrected site says the true thing rather than merely not saying the false one. A
    // deletion would satisfy the clause above and leave a reader with no account at all.
    expect(repoFile(WIRE), 'the wire no longer says when the number arrives').toContain('reported out of band at run start');
    expect(repoFile(HOST), 'the host no longer says where the number comes from').toContain('reportRunNumber');
  });

  test('the three sentences a callback did not make false are byte-identical', () => {
    for (const [sentence, where] of UNMOVED) {
      expect(repoFile(where).includes(sentence), `${where} no longer carries the sentence this change left alone`).toBe(true);
    }
    // The needles discriminate: a text that does not carry one is reported, so the three passes
    // above are readings of real bytes rather than of a predicate satisfied by anything.
    for (const [sentence] of UNMOVED) {
      expect('a document that says nothing of the kind'.includes(sentence),
        'a needle for an unmoved sentence matches text that does not contain it').toBe(false);
    }
  });

  test('the host reads no event message and takes no correlation token apart', () => {
    // The rule `observe` states, as a property of the file rather than as a sentence in it. `core`
    // is the one authority for a run's number, and the two routes to a second one are parsing the
    // narration — which carries the number in prose — and splitting a `gateId`, which `nextGateId`
    // spells `<run number>:<n>`. Both are refused by decision 097's own measurements and by
    // Q-0015's ground rule 2, and this is where the daemon's half of that is checked.
    const host = repoFile(HOST);
    const readsMessage = /\b(?:event|message)\s*\.\s*message\s*\.\s*(?:match|split|slice|substring|substr|replace|indexOf|search)/;
    expect(readsMessage.test(host), 'the host takes an event message apart').toBe(false);
    const splitsGateId = /\bgateId\s*(?:\.\s*(?:split|slice|substring|substr|match|replace|indexOf|charAt)|\[)/;
    expect(splitsGateId.test(host), 'the host takes the correlation token apart').toBe(false);
    // Both needles discriminate, over fixtures assembled so this file is not its own subject.
    expect(readsMessage.test(`const n = event${'.'}message${'.'}match(/\\d+/);`)).toBe(true);
    expect(splitsGateId.test(`const run = gateId${'.'}split(':')[0];`)).toBe(true);
    // …and the benign forms are not reported: the host DOES publish events and DOES echo a gate id.
    expect(readsMessage.test('record.broadcast?.publish(event);')).toBe(false);
    expect(splitsGateId.test('gates.answer(handle, envelope)')).toBe(false);
  });
});
