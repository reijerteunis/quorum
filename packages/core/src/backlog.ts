// Backlog = folders in git. A ticket is backlog/<id>-<slug>/ticket.md (frontmatter = state).
//
// Ported from spike/src/backlog.js for Q-0043 with behaviour preserved (harness/port-charter.md §2).
// This module is the only writer of the files this product calls its database, and the exposure is
// not that the port loses a feature — it is that the port keeps every feature and changes the
// BYTES. A tidier emitter, a zod parse one line too eager, a validation added at the read boundary
// because it looks like rigour: each produces a `ticket.md` that still parses, still runs, still
// shows the right stage, and reformats the frontmatter of every ticket it touches from then on.
// Nothing goes red, because the spike keeps the old emitter and a test ported alongside a
// mis-ported module agrees with it. Three rules follow from that, and each has an obvious
// implementation that is wrong:
//
//   1. `YAML.stringify` is called with NO OPTIONS. Its default `lineWidth` is 80 and the longest
//      `title:` line in this repository is exactly 80 — one character from the boundary. Passing
//      `lineWidth: 0`, the natural thing to reach for when a title wraps oddly, unfolds every long
//      line in the backlog on the next write.
//   2. NOTHING ON A READ PATH CALLS ZOD. `ticketSchema.passthrough().parse()` returns a NEW object
//      whose declared keys come first and whose unknown keys come last, so a ticket carrying a
//      hand-added key between two declared ones (backlog/Q-0033-…/ticket.md does) has that key
//      moved to the end the next time anything writes it. The schema types; it does not police.
//   3. `Backlog` STAYS `Object.create`-COMPATIBLE. `--dry` is implemented as
//      `Object.create(backlog)` with three writers stubbed (spike/src/engine.js:29-35). A `#private`
//      field compiles cleanly, passes every direct test, and makes every inherited method throw
//      `TypeError` on the one path whose whole promise is that it mutates nothing.
import fs from 'node:fs';
import path from 'node:path';

import YAML from 'yaml';

import { RUNS_LOG_FILE, integrationBranch } from '@quorum/shared';
import type { Ticket } from '@quorum/shared';

/**
 * A frontmatter block and the markdown under it.
 *
 * `meta` is `unknown` on purpose. This function is ALSO the reader of `harness/roles/*.md`
 * (spike/src/engine.js:727-732), so it is not a ticket-specific function and must not become one:
 * it validates nothing, requires nothing and invents nothing, and typing its output as a ticket
 * would be a claim it has not checked. Each caller narrows to the shape it expects.
 */
export interface Frontmatter {
  meta: unknown;
  body: string;
}

/** One ticket as it exists on disk: where it is, and what its file holds. */
export interface TicketRecord {
  /** Absolute path of the ticket folder. */
  dir: string;
  /** That folder's basename — `Q-0043-core-backlog`. */
  folder: string;
  meta: Ticket;
  body: string;
}

/** One file read out of a ticket folder, as {@link Backlog.readFiles} yields it. */
export interface TicketFile {
  /** Path relative to the ticket folder — what a prompt cites. */
  rel: string;
  text: string;
}

/** What {@link Backlog.create} needs to allocate a ticket. */
export interface NewTicket {
  title: string;
  intent: string;
  owner?: string;
  repos?: string[];
}

/**
 * Split a file into its frontmatter and its body.
 *
 * No match returns the WHOLE FILE as body with empty meta, silently — no error, no warning. That
 * contradicts `harness/rules.md`'s "errors are explicit" and it is preserved rather than fixed
 * (charter §2); it is named in the implementation report. When the delimiters ARE present and
 * their content is not valid YAML, `YAML.parse`'s own error propagates unchanged: it is not
 * caught, not wrapped and not re-messaged, because the message a command prints is externally
 * observable.
 */
export function parseFrontmatter(text: string): Frontmatter {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: text };
  return { meta: YAML.parse(m[1]) ?? {}, body: m[2] };
}

/**
 * The inverse, and the one place a "tidier" emitter would produce a large, meaningless diff on
 * every stage transition. `stringify` takes no options — see rule 1 at the top of this file. All
 * thirty tickets in this repository round-trip through these two functions byte for byte, which is
 * a property the suite asserts against the real corpus rather than a fixture.
 *
 * The limit, stated rather than promised: comments inside a frontmatter block and hand-written
 * flow style are not preserved, and were not before. The contract being ported is
 * `YAML.stringify(meta)`, not a surgical YAML editor.
 */
export function renderFrontmatter(meta: unknown, body: string): string {
  return `---\n${YAML.stringify(meta).trimEnd()}\n---\n${body.replace(/^\n+/, '')}`;
}

export class Backlog {
  /**
   * Absolute path of the backlog folder.
   *
   * PUBLIC AND READONLY, never `#root`: see rule 3 at the top of this file. A derived object built
   * with `Object.create` reaches this through the prototype chain, and a private field would make
   * every inherited method throw.
   */
  readonly root: string;

  constructor(root: string) {
    this.root = root;
  }

  /**
   * Every ticket directly under the backlog root. Non-recursive: a `ticket.md` two levels down is
   * not a ticket, and a missing backlog root is empty rather than an error.
   */
  list(): TicketRecord[] {
    if (!fs.existsSync(this.root)) return [];
    return fs.readdirSync(this.root, { withFileTypes: true })
      .filter((d) => d.isDirectory() && fs.existsSync(path.join(this.root, d.name, 'ticket.md')))
      .map((d) => this.read(d.name));
  }

  /**
   * Resolve a ticket id or folder name to its directory: an exact path first, then the first
   * `readdir` entry equal to the argument or beginning with it and a hyphen.
   *
   * That prefix match consults `readdir` ORDER, so two folders sharing an id prefix resolve
   * non-deterministically. Preserved, not endorsed, and named in the implementation report.
   */
  dirOf(idOrFolder: string): string {
    if (fs.existsSync(path.join(this.root, idOrFolder))) return path.join(this.root, idOrFolder);
    const hit = fs.existsSync(this.root) && fs.readdirSync(this.root).find((n) => n === idOrFolder || n.startsWith(idOrFolder + '-'));
    if (!hit) throw new Error(`ticket not found: ${idOrFolder}`);
    return path.join(this.root, hit);
  }

  read(idOrFolder: string): TicketRecord {
    const dir = this.dirOf(idOrFolder);
    const { meta, body } = parseFrontmatter(fs.readFileSync(path.join(dir, 'ticket.md'), 'utf8'));
    // The one type assertion in this module, and it is an assertion rather than a parse for the
    // reason rule 2 at the top of this file gives: `parseFrontmatter` validates nothing by design,
    // and running the object through zod here would return a reordered copy that the next `write`
    // would commit. `ticketSchema` supplies this static type and does no work at run time, so a
    // ticket that reads today still reads, whatever its frontmatter says.
    return { dir, folder: path.basename(dir), meta: meta as Ticket, body };
  }

  /** Replace `ticket.md`, and write nothing else — no index, no cache, no derived state. */
  write(ticket: TicketRecord): void {
    fs.writeFileSync(path.join(ticket.dir, 'ticket.md'), renderFrontmatter(ticket.meta, ticket.body));
  }

  /**
   * One more than the highest ticket number on disk, zero-padded to `T-nnnn`.
   *
   * It strips a leading `T-` and nothing else, so every `Q-nnnn` id in this repository yields `NaN`
   * and is filtered out — `nextId()` returns `T-0001` here, and `create()` would then overwrite an
   * existing `T-0001-<slug>/ticket.md` without a word. Carried, not fixed (charter §2), asserted as
   * it is by the suite so a later fix has to be deliberate, and named in the implementation report.
   */
  nextId(): string {
    const nums = this.list().map((t) => parseInt(String(t.meta.id).replace(/^T-/, ''), 10)).filter(Number.isFinite);
    return `T-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(4, '0')}`;
  }

  /**
   * Allocate a ticket folder and write its `ticket.md`.
   *
   * `branch` is a NAME and nothing here creates the ref — which is half of why the chore flow
   * cannot run on a ticket's first pass. Q-0038 carries that; a port that quietly started creating
   * branches would be changing behaviour under cover of a translation (register row 19).
   *
   * The frontmatter key order below is the file's key order, so it is not alphabetised, not sorted
   * and not "tidied".
   */
  create({ title, intent, owner = process.env.USER ?? 'unknown', repos = [] }: NewTicket): TicketRecord {
    const id = this.nextId();
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40);
    const dir = path.join(this.root, `${id}-${slug}`);
    fs.mkdirSync(dir, { recursive: true });
    const ticket: TicketRecord = {
      dir, folder: path.basename(dir), body: intent.trim() + '\n',
      meta: {
        id, title, stage: 'draft', owner, repos,
        branch: integrationBranch(id), priority: 'p2',
        created: new Date().toISOString().slice(0, 10),
        iterations: {}, history: [],
      },
    };
    this.write(ticket);
    return ticket;
  }

  /**
   * Read files inside the ticket folder, with the simple glob every flow's `input.backlog` uses
   * (spike/src/engine.js:704-705) — so this decides what an adapter is invoked with, which the
   * charter calls externally observable. The syntax is deliberately narrow and is not widened:
   * only `*` is a wildcard; `?`, `.`, `+`, `^`, `$`, `{}`, `()`, `|`, `[]` and `\` are escaped and
   * match literally. A pattern ending in `/` walks that subtree and preserves the walk's own
   * filesystem order; everything else is sorted by basename.
   */
  readFiles(ticket: TicketRecord, pattern: string): TicketFile[] {
    const dir = path.dirname(path.join(ticket.dir, pattern));
    const base = path.basename(pattern);
    if (!fs.existsSync(dir)) return [];
    if (pattern.endsWith('/')) {
      return walk(path.join(ticket.dir, pattern)).map((f) => ({ rel: path.relative(ticket.dir, f), text: fs.readFileSync(f, 'utf8') }));
    }
    const re = new RegExp('^' + base.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
    return fs.readdirSync(dir).filter((n) => re.test(n)).sort()
      .map((n) => ({ rel: path.relative(ticket.dir, path.join(dir, n)), text: fs.readFileSync(path.join(dir, n), 'utf8') }));
  }

  /** Write a file inside the ticket folder, creating parents, and return its absolute path. */
  writeFile(ticket: TicketRecord, rel: string, text: string): string {
    const abs = path.join(ticket.dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, text.endsWith('\n') ? text : text + '\n');
    return abs;
  }

  /** Append one line to the ticket's `runs.log`. Append-only: an existing line is never rewritten. */
  log(ticket: TicketRecord, line: string): void {
    fs.appendFileSync(path.join(ticket.dir, RUNS_LOG_FILE), `${new Date().toISOString()} ${line}\n`);
  }
}

/** Every file under `dir`, recursively, in the filesystem's own order. Module-private. */
function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]);
}
