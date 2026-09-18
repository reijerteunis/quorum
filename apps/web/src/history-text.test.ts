/**
 * Q-0018 AC-10 and AC-13's value-level halves.
 *
 * No DOM and no fetcher: every clause is over a value, so a verdict here is a property of the commit
 * rather than of the machine — and, for AC-10, so that the two statuses this repository has never
 * produced are asserted by NAME rather than reached through a fixture drawn from a gitignored
 * `.quorum/runs` that a fresh clone does not have.
 */
import { describe, expect, test } from 'vitest';

import {
  EMPTY_HISTORY_TEXT, RUN_STATUSES, runStatusText, unknownStatusText,
} from './history-text.js';
import { REQUEST_STATE_KINDS, requestStateText, type RequestState } from './request-state.js';

describe('Q-0018 AC-10 — status rendering is closed over the union, not over this backlog', () => {
  test('the vocabulary is the eight `core` declares, as an identity and in its order', () => {
    // An identity rather than a count (Q-0073): a count of eight is satisfied by one member swapped
    // for another. The two this repository has never produced — `exhausted` and `undecided` — are
    // written out here, which is the whole point of deriving the register from the union: a list
    // taken from `.quorum/runs` would have been a list of what this machine happens to hold.
    expect([...RUN_STATUSES]).toStrictEqual([
      'running', 'completed', 'failed', 'aborted', 'regressed', 'exhausted', 'interrupted', 'undecided',
    ]);
  });

  test('each of the eight renders a distinct, non-empty sentence — the two unobserved included', () => {
    const sentences = RUN_STATUSES.map((status) => runStatusText(status));
    for (const [index, sentence] of sentences.entries()) {
      expect(sentence.length, `${RUN_STATUSES[index]} renders nothing`).toBeGreaterThan(20);
      expect(sentence.trim().endsWith('.'), `${RUN_STATUSES[index]} does not render a sentence`).toBe(true);
    }
    expect(new Set(sentences).size, 'two statuses render the same sentence').toBe(RUN_STATUSES.length);
    // Named rather than covered by the loop above, because these two are the criterion: a rendering
    // derived from this corpus would leave both of them reaching the unknown-status fall-through.
    for (const status of ['exhausted', 'undecided']) {
      expect(runStatusText(status), `${status} fell through to the unknown-status sentence`)
        .not.toBe(unknownStatusText(status));
    }
  });

  test('a status the vocabulary does not hold is NAMED, and never dropped or re-filed', () => {
    // `WireRunHistoryRow.status` is a plain string on purpose: refusing a status this vocabulary
    // does not know would refuse a document this product itself wrote. So the fall-through quotes
    // what the manifest recorded rather than substituting a member of the eight for it.
    const said = runStatusText('half-baked');
    expect(said, 'the unrecognised status is not quoted back').toContain('"half-baked"');
    expect(said.length, 'an unrecognised status renders nothing').toBeGreaterThan(20);
    expect(RUN_STATUSES.map((status) => runStatusText(status)),
      'an unrecognised status was rendered as one of the eight').not.toContain(said);
    // The empty string is a status a damaged manifest can carry, and it is named too rather than
    // rendering as silence — which is the one answer no member of this vocabulary may be.
    expect(runStatusText('').length, 'an empty recorded status renders nothing').toBeGreaterThan(20);
  });
});

describe('Q-0018 AC-13 — every request state renders a sentence, and an empty store is a sixth', () => {
  test('six distinct non-empty sentences, and the empty store is not the unreachable one', () => {
    // A store that answered and holds nothing is not a failure and is not one of the five: it is
    // `readRunsDir`'s answer for a root never written to, which is the only state an adopter's first
    // clone can produce — `.quorum/` being gitignored. Reporting it as `unreachable` would send a
    // reader to restart a daemon that is running and answering.
    const states: RequestState<unknown>[] = [
      { kind: 'in-flight', path: '/history' },
      { kind: 'loaded', value: null, fetchedAt: '2026-09-18T01:00:00.000Z' },
      { kind: 'unreachable', path: '/history' },
      { kind: 'refused', path: '/history', refusal: { code: 'no-project', condition: 'none open', remedy: null } },
      { kind: 'unparseable', path: '/history', problem: 'not the shape this page can read' },
    ];
    expect(states.map((state) => state.kind), 'the five kinds moved and this clause did not')
      .toStrictEqual([...REQUEST_STATE_KINDS]);
    const sentences = [...states.map((state) => requestStateText(state)), EMPTY_HISTORY_TEXT];
    for (const sentence of sentences) expect(sentence.trim().length, 'a state renders nothing').toBeGreaterThan(20);
    expect(new Set(sentences).size, 'two of the six render the same sentence').toBe(6);
    expect(EMPTY_HISTORY_TEXT, 'the empty store is rendered as the daemon not answering')
      .not.toBe(requestStateText(states[2]));
  });

  test('the empty-store sentence says what would put a run there, rather than only that there is none', () => {
    // `docs/04-architecture.md` forbids a placeholder that is a blank panel, a spinner or a
    // skeleton, and a sentence saying only *nothing here* is the prose form of one.
    expect(EMPTY_HISTORY_TEXT, 'it does not say where a run is started').toContain('ticket page');
    expect(EMPTY_HISTORY_TEXT, 'it does not name the command line as the other way')
      .toContain(['quorum', 'run'].join(' '));
  });
});
