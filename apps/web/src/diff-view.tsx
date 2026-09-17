/**
 * The reviewed diff, rendered as a patch and as text.
 *
 * **Written here rather than fetched from a package, and the reason is AC-9's own words.** A patch
 * renderer is a natural dependency and this workspace has none — `diff2html`, `diff` and `jsdiff`
 * appear in no manifest — but the two things this file has to do are *classify a unified-diff line
 * by its first character* and *render text as text*, and the renderers on offer answer the second by
 * producing an HTML string, which reaches a React tree only through the one property
 * `apps/web/test/source.test.ts` forbids every file here by name — assembled there so that scan is
 * not its own subject, and unwritten here for the same reason. It is forbidden because a summary and
 * a patch are the one place on the gate screen where a stranger's bytes arrive. So a dependency
 * would have to be
 * paid for — in bundle bytes against a measured 352,894 B of JavaScript, and in a justification
 * register — to buy the half of the job that is one `switch`, and then defeated for the half that
 * matters. Nothing is computed here: the diff is git's, already taken, and this only reads it.
 *
 * **Nothing is capped and nothing is collapsed.** The bytes were bounded where they were produced,
 * by `repo.max_diff_bytes`, and a second bound here would be a second truncation account — the drift
 * this ticket's own body warns about. What a reader is shown is exactly what the step was shown.
 *
 * **Colour is a second signal and never the only one.** A unified diff carries its own marker in the
 * first character of every line, and that character is RENDERED rather than stripped into a class:
 * an added line reads `+…`, a removed one `-…`, a context line ` …`, a hunk header `@@ …` and file
 * metadata its own `diff --git`/`index`/`---`/`+++`. So the distinction survives a monochrome
 * screen, a copy-paste and a reader who cannot see the palette, and the styling below is decoration
 * over a distinction the text already makes.
 */
import type { ReactNode } from 'react';

import type { DiffEvidence } from '@quorum/shared';

/** What one line of a unified diff is, as a closed set so a renderer over it can be total. */
export const DIFF_LINE_KINDS = ['meta', 'hunk', 'added', 'removed', 'context', 'other'] as const;

/** One of {@link DIFF_LINE_KINDS}. */
export type DiffLineKind = (typeof DIFF_LINE_KINDS)[number];

/** One classified line, carrying its own text exactly as the patch holds it. */
export interface DiffLine {
  readonly kind: DiffLineKind;
  /** The line, byte for byte — its leading marker included, and nothing trimmed. */
  readonly text: string;
}

/**
 * The line openings that are file metadata rather than content.
 *
 * **Read before `+` and `-`**, which is the whole reason this is a list and not an afterthought:
 * `--- a/x` and `+++ b/x` open with the same characters a removed and an added line do, so a
 * classifier that tested the single character first would file every file header as content. The
 * rename, mode and binary forms are here for the same reason they are in a patch at all — a diff
 * with no hunks still says what changed, and a reader owed *what the reviewer saw* is owed those
 * lines too.
 *
 * `\ No newline at end of file` is metadata rather than context: it is git describing the file
 * rather than a line of it, and filing it as context would put a sentence inside the change.
 */
const METADATA_OPENINGS = [
  'diff --git ', 'index ', '--- ', '+++ ', '---', '+++',
  'old mode ', 'new mode ', 'new file mode ', 'deleted file mode ',
  'similarity index ', 'dissimilarity index ',
  'rename from ', 'rename to ', 'copy from ', 'copy to ',
  'Binary files ', 'GIT binary patch', '\\ No newline',
] as const;

/**
 * What one line of a unified diff is.
 *
 * **Every line gets a kind and none is dropped**, which is what `other` is for: a patch may carry a
 * line this classifier has no rule for — a format git gains, a line inside a binary payload, the
 * first line of a truncated patch's final cut — and dropping it would be this screen deciding a
 * reader does not need something the reviewer was given. An unrecognised line renders whole, under
 * its own kind, so it is visible as unrecognised rather than mis-filed as content.
 */
export function classifyDiffLine(line: string): DiffLineKind {
  if (METADATA_OPENINGS.some((opening) => line.startsWith(opening))) return 'meta';
  if (line.startsWith('@@')) return 'hunk';
  if (line.startsWith('+')) return 'added';
  if (line.startsWith('-')) return 'removed';
  if (line === '' || line.startsWith(' ')) return 'context';
  return 'other';
}

/**
 * Every line of `patch`, classified, in order.
 *
 * The one terminating newline is not a line and is dropped; every other empty line is kept, because
 * a patch's blank lines are the file's. Nothing is trimmed, reordered, deduplicated or coalesced:
 * the lines out are the lines in.
 */
export function diffLines(patch: string): DiffLine[] {
  const raw = patch.split('\n');
  if (raw.length > 1 && raw[raw.length - 1] === '') raw.pop();
  return raw.map((text) => ({ kind: classifyDiffLine(text), text }));
}

/** How each kind is coloured. Decoration only — see this module's header. */
const LINE_CLASS: Record<DiffLineKind, string> = {
  meta: 'text-muted',
  hunk: 'text-accent',
  added: 'text-text',
  removed: 'text-muted',
  context: 'text-muted',
  other: 'text-text',
};

/** How the screen heads the diff region, in one place so a test and the view cannot disagree. */
export const DIFF_HEADING = 'The diff that decision was made on';

/** How it names the range, spelled as git spells it so a reader can paste it into a terminal. */
export const DIFF_RANGE = 'Range:';

/** How it names the step the bytes were put in front of. */
export const DIFF_STEP = 'Given to step:';

/** How it heads the per-file summary git produced for the whole range, omitted files included. */
export const DIFF_SUMMARY_HEADING = 'Files in this range';

/** What it says where the patch is the whole of what git produced. */
export const DIFF_COMPLETE = 'This is the whole diff that step was given.';

/**
 * What it says where the patch was cut, ahead of the figures.
 *
 * **It never says the diff is complete and never implies the change is what is shown.** A review
 * whose subject was partly absent is a weaker verdict than it looks, and the one human who can act
 * on that is the one answering this gate — which is why the sentence is on the screen and not only
 * on the trace, where `runs.log` and a `warn` already carry it and nobody reads either mid-run.
 */
export const DIFF_TRUNCATED = 'This diff was cut before that step saw all of it, so the review below it covers less than the change.';

/** What it says where the cut fell inside a file the reader can still see some of. */
export const DIFF_NONE_ABSENT = 'Every file above has some patch and the last one is cut short, so no file is wholly absent.';

/** How it introduces the files the step was given no patch for at all. */
export const DIFF_OMITTED_PREFIX = 'That step was given no patch at all for these files, though they appear in the summary above:';

/**
 * The bytes kept, the limit they were kept under, and what fell outside.
 *
 * **Rendered from the producer's own measurement and never from a second one.** Every figure here
 * is a typed field of {@link DiffEvidence}, computed once inside `materialiseDiff` from the two
 * buffers it compared — so this agrees with the notice that step was given by construction rather
 * than by two renderers being written to say the same thing. Nothing here parses a sentence, and no
 * second cap is applied: this screen shows what was kept and says what was not.
 */
export function TruncationNotice({ evidence }: { evidence: DiffEvidence }): ReactNode {
  if (!evidence.truncated) {
    return <p className="text-sm text-muted" data-diff-truncation="complete">{DIFF_COMPLETE}</p>;
  }
  return (
    <div className="flex flex-col gap-1 text-sm" data-diff-truncation="cut">
      <p className="text-text">{DIFF_TRUNCATED}</p>
      <p className="font-mono text-xs text-muted">
        {/* The three numbers as numbers, never read out of prose: they are typed fields, which is
            what `apps/web/test/source.test.ts`'s no-coercion clause exists to keep true. */}
        <span data-diff-kept>{String(evidence.kept)}</span>
        {' of '}
        <span data-diff-total>{String(evidence.total)}</span>
        {' bytes kept, under a limit of '}
        <span data-diff-limit>{String(evidence.limit)}</span>
        {'.'}
      </p>
      {evidence.omitted.length === 0
        ? <p className="text-muted" data-diff-omitted="none">{DIFF_NONE_ABSENT}</p>
        : (
          <div className="flex flex-col gap-1" data-diff-omitted="named">
            <p className="text-muted">{DIFF_OMITTED_PREFIX}</p>
            {evidence.omitted.map((file) => (
              <p key={file} className="font-mono text-xs text-text" data-diff-omitted-file>{file}</p>
            ))}
          </div>
        )}
    </div>
  );
}

/**
 * The patch, line by line, as text.
 *
 * **`whitespace-pre` and a horizontal scroller, which is AC-9's long-line clause as a property.** A
 * wrapped patch line is a lie about where a change is, and a page that widened to fit one would
 * push everything else off the screen — so the block scrolls and the page does not, and a line's
 * tail is reached by scrolling rather than being hidden. The same declaration is what keeps a tab a
 * tab and a run of spaces a run of spaces: nothing here substitutes, collapses or normalises
 * whitespace, so indentation is the file's own.
 */
export function PatchView({ patch }: { patch: string }): ReactNode {
  const lines = diffLines(patch);
  return (
    <div className="overflow-x-auto rounded border border-border bg-surface p-3" data-diff-patch>
      {lines.map((line, at) => (
        <div
          // The index, which is the position — and the position is the identity here. This list is
          // replaced whole or not at all: a patch is a snapshot, nothing reorders, inserts into or
          // removes from it, and two identical lines at two positions are two lines. Keying on the
          // text would put a copy of every line in a key as well as in the document, which at the
          // 200,000-byte cap is a second copy of the patch bought for nothing.
          key={String(at)}
          data-diff-line={line.kind}
          className={`whitespace-pre font-mono text-xs ${LINE_CLASS[line.kind]}`}
        >
          {line.text}
        </div>
      ))}
    </div>
  );
}

/**
 * The whole region: what was compared, what fell outside, and the patch itself.
 *
 * The `--stat` is rendered above the patch rather than derived from it, and the difference is the
 * point when a patch was cut: it names every file in the range, the ones with no hunks included, so
 * a reader can see what they are not being shown beside what they are. It is git's own text and is
 * rendered as text.
 */
export function DiffRegion({ evidence }: { evidence: DiffEvidence }): ReactNode {
  return (
    <div className="flex flex-col gap-3 rounded border border-border bg-surface p-3" data-diff="stated">
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 className="text-sm text-text">{DIFF_HEADING}</h2>
        <p className="font-mono text-xs text-muted">{DIFF_STEP} <span className="text-text">{evidence.stepId}</span></p>
      </div>
      <p className="font-mono text-xs text-muted">{DIFF_RANGE} <span className="text-text" data-diff-range>{evidence.range}</span></p>
      <TruncationNotice evidence={evidence} />
      <div className="flex flex-col gap-1">
        <p className="font-mono text-xs uppercase text-muted">{DIFF_SUMMARY_HEADING}</p>
        <div className="overflow-x-auto whitespace-pre font-mono text-xs text-muted" data-diff-stat>{evidence.stat}</div>
      </div>
      <PatchView patch={evidence.patch} />
    </div>
  );
}
