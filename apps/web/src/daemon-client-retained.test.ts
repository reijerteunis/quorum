/**
 * Q-0137 AC-9 and AC-12's client halves — the two readers that answer for what a run retained.
 *
 * Both are `fetchTicket`/`fetchTicketFile`'s arrangement at a second store and are asserted the
 * same way: every body is parsed through the schema `@quorum/shared` declares rather than cast, a
 * non-2xx carries the daemon's own refusal, and a body that is well formed JSON and the wrong shape
 * is a failure state rather than a half-rendered screen.
 */
import { describe, expect, test } from 'vitest';

import { historyFilePath, historyRetainedPath } from './daemon-endpoints.js';
import {
  fetchRunHistoryFile, fetchRunHistoryRetained, runHistoryFileInFlight, runHistoryRetainedInFlight,
  type FetchLike,
} from './daemon-client.js';
import type { RequestState } from './request-state.js';

const CLOCK = (): string => '2026-09-19T09:00:00.000Z';
const RUN = 'Q-0137-1';

/** The listing body its route answers on the happy path. */
const LISTING = {
  occurrences: [{ seq: 1, step_id: 'implement', files: [{ name: 'prompt.txt', bytes: 3 }] }],
  warnings: [{ seq: 2, step_id: 'integrate', message: "this occurrence's recorded directory is not there" }],
};

/** The file body its route answers on the happy path. */
const FILE = { name: 'prompt.txt', bytes: 3, text: 'ask' };

/** What one answer came to, reduced to the pair a reader acts on. */
const signature = (state: RequestState<unknown>): string => {
  switch (state.kind) {
    case 'refused': return `refused:${state.refusal.code}`;
    case 'unparseable': return 'unparseable';
    default: return state.kind;
  }
};

/** Every path a run of one case asked for. */
let asked: string[] = [];

/** A fetch answering `body` with `status`. */
const gives = (body: unknown, status = 200): FetchLike => (path: string) => {
  asked.push(path);
  return Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) });
};

/** A fetch that answers nothing at all, which is the daemon being gone rather than refusing. */
const unreachable: FetchLike = (path: string) => {
  asked.push(path);
  return Promise.reject(new Error('fetch failed'));
};

/**
 * The two readers, each with its path, its good body, a body that is the wrong shape, and the two
 * refusals its own route raises.
 *
 * The codes are the daemon's rather than invented here: `read.ts` answers `no-such-run` and
 * `malformed-manifest` for the listing, and `no-such-occurrence` and `unsupported-file-encoding`
 * for the file — which is what makes a 404 and a 422 two answers rather than one status apart.
 */
const READERS = [
  {
    named: 'fetchRunHistoryRetained',
    path: historyRetainedPath(RUN),
    read: (fetcher: FetchLike): Promise<RequestState<unknown>> => fetchRunHistoryRetained(fetcher, RUN, CLOCK),
    inFlight: () => runHistoryRetainedInFlight(RUN),
    good: LISTING,
    // Well-formed JSON, and not the shape: a listed file with no `bytes`, which is the one field
    // that tells a reader what a file costs before asking for it.
    wrongShape: { occurrences: [{ seq: 1, step_id: 'implement', files: [{ name: 'prompt.txt' }] }], warnings: [] },
    notFound: 'no-such-run',
    unprocessable: 'malformed-manifest',
  },
  {
    named: 'fetchRunHistoryFile',
    path: historyFilePath(RUN, 1, 'prompt.txt'),
    read: (fetcher: FetchLike): Promise<RequestState<unknown>> => fetchRunHistoryFile(fetcher, RUN, 1, 'prompt.txt', CLOCK),
    inFlight: () => runHistoryFileInFlight(RUN, 1, 'prompt.txt'),
    good: FILE,
    // The file's own text missing, which is the whole of what this route exists to carry.
    wrongShape: { name: 'prompt.txt', bytes: 3 },
    notFound: 'no-such-occurrence',
    unprocessable: 'unsupported-file-encoding',
  },
] as const;

describe('Q-0137 — the two retained-file readers, over every answer their routes give', () => {
  for (const reader of READERS) {
    describe(reader.named, () => {
      test('asks its own path and nothing else', async () => {
        asked = [];
        await reader.read(gives(reader.good));
        expect(asked, `${reader.named} asked for something else`).toStrictEqual([reader.path]);
      });

      test('every answer its route gives becomes its own state', async () => {
        const cases: [string, FetchLike, string][] = [
          ['a body its schema accepts', gives(reader.good), 'loaded'],
          ['a 404 carrying the daemon\'s refusal', gives({ code: reader.notFound, condition: 'x', remedy: null }, 404), `refused:${reader.notFound}`],
          ['a 422 carrying the other one', gives({ code: reader.unprocessable, condition: 'x', remedy: null }, 422), `refused:${reader.unprocessable}`],
          ['well-formed JSON of the wrong shape', gives(reader.wrongShape), 'unparseable'],
          ['nothing at all', unreachable, 'unreachable'],
        ];
        for (const [what, fetcher, expected] of cases) {
          asked = [];
          expect(signature(await reader.read(fetcher)), `${reader.named}: ${what}`).toBe(expected);
        }
      });

      test('a loaded answer carries the instant it was fetched, and the parsed value', async () => {
        const state = await reader.read(gives(reader.good));
        expect(state.kind).toBe('loaded');
        if (state.kind !== 'loaded') return;
        expect(state.fetchedAt, 'the clock this module was given was not used').toBe(CLOCK());
        expect(state.value, 'the body was not carried through the schema').toStrictEqual(reader.good);
      });

      test('its in-flight state names the path it is about to ask for', () => {
        expect(reader.inFlight()).toStrictEqual({ kind: 'in-flight', path: reader.path });
      });
    });
  }

  test('the file path carries the occurrence as a sequence number and the name as a leaf', () => {
    // Both are QUERY values, which is the daemon's own shape — and the occurrence is addressed by
    // the number its listing carries rather than by the directory the manifest records, which this
    // app neither receives nor composes.
    const path = historyFilePath(RUN, 7, 'transcript.jsonl');
    expect(path).toBe(`/history/${RUN}/file?occurrence=7&name=transcript.jsonl`);
    expect(path.includes('occurrence_dir'), 'the path names an occurrence directory').toBe(false);
    expect(path.includes('steps/'), 'the path composes a filesystem path').toBe(false);
  });

  test('a run id and a retained name are encoded rather than trusted', () => {
    // A run id is a directory name and a retained name is whatever a directory holds — `persist`
    // takes an artifact's name as a plain parameter — so neither is a token this app composed.
    expect(historyRetainedPath('Q-0137 1')).toBe('/history/Q-0137%201/retained');
    expect(historyFilePath('Q/0137', 1, 'a b&c=d.txt'))
      .toBe('/history/Q%2F0137/file?occurrence=1&name=a%20b%26c%3Dd.txt');
    // …and the two never collide with the detail path, which is one segment shorter.
    expect(historyRetainedPath(RUN).startsWith(`/history/${RUN}/`)).toBe(true);
    expect(historyFilePath(RUN, 1, 'a').startsWith(`/history/${RUN}/`)).toBe(true);
  });
});
