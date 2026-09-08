/**
 * The backlog: a ticket is `backlog/<id>-<slug>/ticket.md`, and its frontmatter is the state.
 *
 * This is the only writer of the files this product calls its database, so the exposure is not a
 * lost feature — it is a changed BYTE. A tidier emitter, or a validation added at the read boundary
 * because it looks like rigour, reformats the frontmatter of every ticket it touches from then on
 * and nothing goes red. Why: behaviour preserved from spike/src/backlog.js (charter §2, Q-0043).
 *
 * **It reads and writes inside its own root and nowhere else.** A ticket token resolves to a
 * directory directly under the backlog root, and every method taking a record works inside that
 * record's folder — file by file rather than folder by folder, because a link at a leaf is an
 * escape every check on the directory above it passes. Both checked in `./confine.js`, which closes
 * Q-0043's path-traversal non-goal on the read side and the write side together (Q-0059).
 */
import fs from 'node:fs';
import path from 'node:path';

import YAML from 'yaml';

import { RUNS_LOG_FILE, integrationBranch, parseTicketId } from '@quorum/shared';
import type { Ticket } from '@quorum/shared';

import { isFolderIn, isOneName, pathInside } from './confine.js';

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
  /**
   * The id to use, instead of the one {@link Backlog.nextId} would allocate. It is checked against
   * the grammar and against the backlog exactly as an allocated id is — it supplies the number and
   * skips no check, which is what makes a refusal from `nextId()` survivable rather than a dead end.
   */
  id?: string;
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
   * A token that is not one name is refused on the string alone, before anything is opened. A token
   * that is one name and resolves outside the root — through a link, which no string test sees — is
   * `ticket not found`, disclosing nothing about where it pointed. The answer is the JOINED path
   * and never the resolved one: `TicketRecord.dir` is what artifact paths, `wrote …` events and run
   * history are built from, and resolving it here would move all three on any symlinked checkout.
   *
   * Why: that prefix match consults `readdir` ORDER, so two folders sharing an id prefix resolve
   * non-deterministically — preserved, not endorsed (charter §2, Q-0043; Q-0059 non-goal 1).
   */
  dirOf(idOrFolder: string): string {
    if (!isOneName(idOrFolder)) throw new Error(notATicketToken(idOrFolder));
    const exact = path.join(this.root, idOrFolder);
    if (isFolderIn(this.root, exact)) return exact;
    const hit = fs.existsSync(this.root) && fs.readdirSync(this.root).find((n) => n === idOrFolder || n.startsWith(idOrFolder + '-'));
    if (!hit || !isFolderIn(this.root, path.join(this.root, hit))) throw new Error(`ticket not found: ${idOrFolder}`);
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

  /**
   * Replace `ticket.md`, and write nothing else — no index, no cache, no derived state.
   *
   * The destination is verified and not merely joined: `ticket.md` is a name on disk like any
   * other, so a link there sends the whole frontmatter outside the backlog root while every check
   * on the folder above it passes.
   */
  write(ticket: TicketRecord): void {
    fs.writeFileSync(fileInside(this.root, ticket, 'ticket.md'), renderFrontmatter(ticket.meta, ticket.body));
  }

  /**
   * The id the next ticket takes: the one prefix this backlog's tickets already carry, and one
   * more than the highest number under it. An empty backlog allocates `T-0001`.
   *
   * A backlog it cannot read is refused rather than reported as empty — "no tickets" and "no id I
   * recognise" are different answers, and returning the first for the second is what let two
   * invocations collide on one id and {@link create} overwrite the ticket before it (Q-0080).
   *
   * @throws {Error} when tickets exist and no id among them parses; when the ids that parse carry
   *   more than one prefix; or when the next number would leave the grammar. Each message names
   *   what it found and ends with the action.
   */
  nextId(): string {
    const tickets = this.list();
    // Why: `harness init` prints `harness run requirements T-0001` as the next command, so this is
    // the id the product already advertises for a fresh backlog (Q-0080 AC-3).
    if (!tickets.length) return 'T-0001';

    const ids = tickets.map((t) => parseTicketId(t.meta.id)).filter((id) => id !== null);
    if (!ids.length) throw new Error(unreadableBacklog(tickets));

    const counts = new Map<string, number>();
    for (const { prefix } of ids) counts.set(prefix, (counts.get(prefix) ?? 0) + 1);
    if (counts.size > 1) throw new Error(mixedPrefixes(counts));

    const { prefix } = ids[0];
    const highest = Math.max(...ids.map((id) => id.number));
    const next = `${prefix}-${String(highest + 1).padStart(4, '0')}`;
    // The grammar is the oracle rather than a second spelling of "four digits": one past the last
    // id a backlog can hold is exactly the string it rejects.
    if (!parseTicketId(next)) throw new Error(exhaustedPrefix(prefix, highest, next));
    return next;
  }

  /**
   * Allocate a ticket folder and write its `ticket.md`. The frontmatter key order below is the
   * file's key order: not alphabetised, not sorted, not "tidied".
   *
   * It refuses a taken id and an occupied folder rather than allocating around either: allocating
   * around one papers over an allocator that produced an id already in use, which is the state this
   * refusal exists to make impossible. Every check runs before anything is created, and the ticket
   * directory is then created exclusively, so a refusal leaves the backlog byte for byte as it was.
   *
   * Why: `branch` is a NAME and nothing here creates the ref, which is half of why the chore flow
   * cannot run on a ticket's first pass — Q-0038 carries that (register row 19).
   *
   * @throws {Error} when `id` is not of the form `<PREFIX>-nnnn`, when the id already belongs to a
   *   folder, or when the target folder exists. `nextId`'s refusals reach the caller unchanged.
   */
  create({ title, intent, owner = UNATTRIBUTED, repos = [], id: given }: NewTicket): TicketRecord {
    // `ticketSchema` types `owner` as a string, and this is the write boundary — a caller that hands
    // over a boolean, which `--owner` with no value does, would otherwise put a value in the backlog
    // that the product's own schema refuses. Refused here rather than at each surface, so the same
    // guarantee covers M3's server taking an owner from a request body. Q-0112.
    if (typeof owner !== 'string' || !owner.trim()) throw new Error(notAnOwner(owner));
    if (given !== undefined && !parseTicketId(given)) throw new Error(notATicketId(given));
    const id = given ?? this.nextId();
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40);
    const folder = `${id}-${slug}`;
    const dir = path.join(this.root, folder);
    const entries = fs.existsSync(this.root) ? fs.readdirSync(this.root) : [];
    if (entries.includes(folder)) throw new Error(`ticket folder already exists: ${folder}`);
    // The same resolution dirOf uses, so "the id already belongs to a folder" means what a reader
    // of this backlog would mean by it — a differing slug included.
    const taken = entries.find((name) => name === id || name.startsWith(`${id}-`));
    if (taken !== undefined) throw new Error(`ticket id already taken: ${id} already belongs to ${taken}`);
    // Two jobs, deliberately two calls: the root is created if it is missing, and the ticket
    // directory is created EXCLUSIVELY, so `ticket.md` is opened only once this call owns the
    // folder. One `recursive: true` over the whole path would do both and silently accept an
    // existing ticket folder, which is the overwrite (Q-0080 AC-5, AC-6).
    fs.mkdirSync(this.root, { recursive: true });
    fs.mkdirSync(dir);
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
   *
   * A pattern naming anything outside the ticket folder is REFUSED rather than answered with `[]`:
   * an empty list is what a legitimately absent directory answers below, so silence would shrink an
   * agent's prompt with nothing going red. So is an enumerated FILE that leaves it: the pattern
   * fixes the directory and the filesystem supplies the names under it, so a link at one of those
   * names is a path this caller never asked for and no check on the base can see.
   */
  readFiles(ticket: TicketRecord, pattern: string): TicketFile[] {
    const folder = folderOf(this.root, ticket);
    const joined = pathInside(folder, pattern);
    if (joined === null) throw new Error(notInsideTicket(pattern));
    const dir = path.dirname(joined);
    const base = path.basename(pattern);
    if (!fs.existsSync(dir)) return [];
    const one = (file: string): TicketFile => {
      const rel = path.relative(folder, file);
      if (pathInside(folder, rel) === null) throw new Error(notInsideTicket(rel));
      return { rel, text: fs.readFileSync(file, 'utf8') };
    };
    if (pattern.endsWith('/')) return walk(joined).map(one);
    const re = new RegExp('^' + base.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
    return fs.readdirSync(dir).filter((n) => re.test(n)).sort().map((n) => one(path.join(dir, n)));
  }

  /**
   * Write a file inside the ticket folder, creating parents, and return its absolute path.
   *
   * The destination usually does not exist yet, so what is verified is its deepest existing
   * ancestor — and the verification happens before `mkdirSync`, so a refused write leaves no
   * directory behind it, inside the root or outside it.
   */
  writeFile(ticket: TicketRecord, rel: string, text: string): string {
    const abs = fileInside(this.root, ticket, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, text.endsWith('\n') ? text : text + '\n');
    return abs;
  }

  /**
   * Append one line to the ticket's run log. Append-only: an existing line is never rewritten.
   *
   * `runs.log` is verified like any other destination — a link there appends this ticket's history
   * to a file outside the backlog root, and an append is the one write that leaves what was there.
   */
  log(ticket: TicketRecord, line: string): void {
    fs.appendFileSync(fileInside(this.root, ticket, RUNS_LOG_FILE), `${new Date().toISOString()} ${line}\n`);
  }
}

/**
 * What every allocation refusal ends with. A refusal that names no way forward reads as a wall,
 * and `--id` is the way past all three of them.
 */
const ACTION = 'pass --id <ID> or reconcile the backlog';

/** How the grammar is described to whoever has to fix an id by hand. */
const FORM = '<PREFIX>-nnnn';

/** At most this many ids are quoted back, so a hundred-ticket backlog still prints one line. */
const SAMPLE = 3;

/**
 * A control character in a value this message quotes back, rendered as an escape rather than
 * written through.
 *
 * Why: the value is attacker-controlled — it is whatever `--id` was given — and the message is one
 * line by contract. A newline splits it into three, and the second reads like harness output; an
 * ANSI escape colours the terminal. Reported as a nit by Q-0080's reviewer and reproduced before
 * it was believed.
 */
const printable = (value: string): string =>
  // eslint-disable-next-line no-control-regex -- the class being escaped is exactly the control range
  value.replace(/[\u0000-\u001f\u007f]/g, (c) => `\\x${c.codePointAt(0)!.toString(16).padStart(2, '0')}`);

/**
 * What a ticket carries when nobody said who it belongs to.
 *
 * `core` does not read the environment for an identity. `process.env.USER` stood here and named the
 * operating-system account rather than a person — on a shared machine, in CI, in a container and in
 * every worktree a flow creates — and the backlog carried eleven tickets stamped that way, corrected
 * by hand four times without the correction ever reaching the code. An admission is honest where a
 * guess is not; who a ticket belongs to is the surface's to supply. Q-0112.
 */
const UNATTRIBUTED = 'unknown';

/**
 * An owner that is not a name: whatever a caller handed over where a string was required.
 *
 * The condition and no remedy — which surface asked, and what it should tell its user to do about
 * it, is not knowable here. See *"A `core` error names the condition; the remedy belongs to the
 * surface"* (2026-09-07).
 */
const notAnOwner = (given: unknown): string =>
  `not an owner: ${typeof given === 'string' ? `'${printable(given)}'` : String(given)} — an owner is a non-empty name`;

/** An `--id` the grammar does not recognise, named with the shape it should have had. */
const notATicketId = (given: string): string =>
  `not a ticket id: '${printable(given)}' — an id is ${FORM}, like Q-0081`;

/**
 * The ticket folder a record names, verified to be one of THIS backlog's before anything is read
 * from it or written into it.
 *
 * `dir` is a field on a plain interface, so guarding a caller's `rel` against it while leaving it
 * unguarded would close nothing: the boundary is the backlog root, and this is where every method
 * taking a record meets it. What a surface then tells its user is the surface's own, per *"A `core`
 * error names the condition; the remedy belongs to the surface"* (2026-09-07).
 */
function folderOf(root: string, ticket: TicketRecord): string {
  if (!isFolderIn(root, ticket.dir)) throw new Error(notATicketFolder(ticket.dir));
  return ticket.dir;
}

/**
 * One file of a ticket folder, verified in its own right before anything opens it: the folder
 * against the root, and then the leaf against the folder.
 *
 * The second half is not covered by the first. A directory that is genuinely inside the boundary
 * can hold a name that is not — `pathInside` resolves the destination where it exists and its
 * deepest existing ancestor where it does not, so a file nobody has created yet is admitted while
 * a link standing at that name is not.
 */
function fileInside(root: string, ticket: TicketRecord, rel: string): string {
  const abs = pathInside(folderOf(root, ticket), rel);
  if (abs === null) throw new Error(notInsideTicket(rel));
  return abs;
}

/** A token that names a path rather than a ticket — decided on the string, so it names no file. */
const notATicketToken = (token: string): string =>
  `not a ticket token: '${printable(token)}' — a ticket is one folder directly under the backlog root`;

/** A record whose folder is not a ticket folder of the backlog it was handed to. */
const notATicketFolder = (dir: string): string =>
  `not a ticket folder in this backlog: '${printable(dir)}'`;

/** A write path or a glob that leaves the ticket folder, lexically or through a link. */
const notInsideTicket = (rel: string): string =>
  `not a path inside the ticket folder: '${printable(rel)}'`;

/**
 * Tickets are there and not one of their ids parses. Sorted before it is cut, so the sample is the
 * same sentence whatever order the filesystem listed the folders in.
 */
function unreadableBacklog(tickets: readonly TicketRecord[]): string {
  const seen = [...new Set(tickets.map((t) => String(t.meta.id)))].sort();
  const quoted = seen.slice(0, SAMPLE).map((id) => `'${id}'`).join(', ');
  const sample = seen.length > SAMPLE ? `${quoted}, …` : quoted;
  return `cannot allocate a ticket id: read ${tickets.length} tickets and none has an id of the form ${FORM} (saw ${sample}); ${ACTION}`;
}

/** More than one prefix parses, so there is no one backlog to count within. */
function mixedPrefixes(counts: ReadonlyMap<string, number>): string {
  const named = [...counts].sort(([a], [b]) => (a < b ? -1 : 1)).map(([prefix, n]) => `${prefix}- (${n})`);
  return `cannot allocate a ticket id: the backlog uses more than one prefix — ${named.join(', ')}; ${ACTION}`;
}

/** The prefix is full: a five-digit id is not one `harness runs` could resolve afterwards. */
const exhaustedPrefix = (prefix: string, highest: number, next: string): string =>
  `cannot allocate a ticket id: the next id after ${prefix}-${String(highest).padStart(4, '0')} `
  + `would be ${next}, which is not of the form ${FORM}; ${ACTION}`;

/** Every file under `dir`, recursively, in the filesystem's own order. Module-private. */
function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]);
}
