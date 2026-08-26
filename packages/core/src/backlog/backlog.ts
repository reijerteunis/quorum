/**
 * The backlog: a ticket is `backlog/<id>-<slug>/ticket.md`, and its frontmatter is the state.
 *
 * This is the only writer of the files this product calls its database, so the exposure is not a
 * lost feature — it is a changed BYTE. A tidier emitter, or a validation added at the read boundary
 * because it looks like rigour, reformats the frontmatter of every ticket it touches from then on
 * and nothing goes red. Why: behaviour preserved from spike/src/backlog.js (charter §2, Q-0043).
 */
import fs from 'node:fs';
import path from 'node:path';

import YAML from 'yaml';

import { RUNS_LOG_FILE, integrationBranch } from '@quorum/shared';
import type { Ticket } from '@quorum/shared';

/**
 * A frontmatter block and the markdown under it.
 *
 * `meta` is `unknown` on purpose: this is ALSO the reader of `harness/roles/*.md`, so it is not a
 * ticket-specific function and must not become one — it validates nothing, requires nothing and
 * invents nothing. Each caller narrows to the shape it expects.
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
 * Split a file into its frontmatter and its body. When the delimiters are present and their content
 * is not valid YAML, `YAML.parse`'s own error propagates unchanged — not caught, not wrapped, not
 * re-messaged, because the message a command prints is externally observable.
 *
 * Why: no match returns the WHOLE FILE as body with empty meta, silently, against "errors are
 * explicit" — a preserved defect (charter §2, reported by Q-0043, carried by Q-0060).
 */
export function parseFrontmatter(text: string): Frontmatter {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: text };
  return { meta: YAML.parse(m[1]) ?? {}, body: m[2] };
}

/**
 * The inverse, and the one place a "tidier" emitter would produce a large, meaningless diff on
 * every stage transition. Every ticket in this repository round-trips through these two functions
 * byte for byte, asserted against the real corpus rather than a fixture. The limit, stated rather
 * than promised: comments inside a frontmatter block and hand-written flow style are not preserved,
 * and were not before.
 *
 * Why: `stringify` takes NO OPTIONS — its default `lineWidth` is 80 and the longest `title:` line
 * here is exactly 80, so `lineWidth: 0` would unfold every long line in the backlog (Q-0043).
 */
export function renderFrontmatter(meta: unknown, body: string): string {
  return `---\n${YAML.stringify(meta).trimEnd()}\n---\n${body.replace(/^\n+/, '')}`;
}

/** One backlog root, and every read and write this product performs against it. */
export class Backlog {
  /**
   * Absolute path of the backlog folder. Public and readonly, never `#root`.
   *
   * Why: `--dry` is implemented as `Object.create(backlog)` with three writers stubbed, and a
   * private field makes every inherited method throw on the one path that must mutate nothing.
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
   * Why: that prefix match consults `readdir` ORDER, so two folders sharing an id prefix resolve
   * non-deterministically — preserved, not endorsed (charter §2; Q-0059 carries the traversal twin).
   */
  dirOf(idOrFolder: string): string {
    if (fs.existsSync(path.join(this.root, idOrFolder))) return path.join(this.root, idOrFolder);
    const hit = fs.existsSync(this.root) && fs.readdirSync(this.root).find((n) => n === idOrFolder || n.startsWith(idOrFolder + '-'));
    if (!hit) throw new Error(`ticket not found: ${idOrFolder}`);
    return path.join(this.root, hit);
  }

  /** One ticket, read from disk. The `meta` assertion is this module's only one. */
  read(idOrFolder: string): TicketRecord {
    const dir = this.dirOf(idOrFolder);
    const { meta, body } = parseFrontmatter(fs.readFileSync(path.join(dir, 'ticket.md'), 'utf8'));
    // Why: an assertion rather than a parse — zod on a read path returns a REORDERED copy that the
    // next write() would commit, moving a hand-added key to the end of the frontmatter (Q-0043).
    return { dir, folder: path.basename(dir), meta: meta as Ticket, body };
  }

  /** Replace `ticket.md`, and write nothing else — no index, no cache, no derived state. */
  write(ticket: TicketRecord): void {
    fs.writeFileSync(path.join(ticket.dir, 'ticket.md'), renderFrontmatter(ticket.meta, ticket.body));
  }

  /**
   * One more than the highest ticket number on disk, zero-padded to `T-nnnn`.
   *
   * Why: it strips a leading `T-` and nothing else, so every `Q-nnnn` id in this repository yields
   * `NaN` and is filtered out — `nextId()` returns `T-0001` here, and `create()` would then
   * overwrite an existing folder without a word. Carried, not fixed, and asserted as it is so that
   * a later fix has to be deliberate (charter §2, Q-0043).
   */
  nextId(): string {
    const nums = this.list().map((t) => parseInt(String(t.meta.id).replace(/^T-/, ''), 10)).filter(Number.isFinite);
    return `T-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(4, '0')}`;
  }

  /**
   * Allocate a ticket folder and write its `ticket.md`. The frontmatter key order below is the
   * file's key order: not alphabetised, not sorted, not "tidied".
   *
   * Why: `branch` is a NAME and nothing here creates the ref, which is half of why the chore flow
   * cannot run on a ticket's first pass — Q-0038 carries that (register row 19).
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
   * Read files inside the ticket folder, with the simple glob every flow's `input.backlog` uses —
   * so this decides what an adapter is invoked with, which the charter calls externally observable.
   * The syntax is deliberately narrow and is not widened: only `*` is a wildcard, and every other
   * regex metacharacter is escaped and matches literally. A pattern ending in `/` walks that
   * subtree and preserves the walk's own filesystem order; everything else is sorted by basename.
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

  /** Append one line to the ticket's run log. Append-only: an existing line is never rewritten. */
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
