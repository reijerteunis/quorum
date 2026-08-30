// Backlog = folders in git. A ticket is backlog/<id>-<slug>/ticket.md (frontmatter = state).
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

export const STAGES = [
  'draft', 'requirements', 'solutioned', 'red', 'green', 'reviewed', 'qa-passed', 'deployed',
  'blocked', 'abandoned',
];

/**
 * A ticket id as `<PREFIX>-nnnn`, taken apart — or `null`, which is "this is not a ticket id".
 *
 * The one spelling of the grammar in this tree: `harness runs <token>` resolves through it too, so
 * the CLI cannot drift from the allocator. Pure, and tolerant of a non-string, because a damaged
 * `ticket.md` carries no id at all and an allocator has to count that as unreadable.
 */
export function parseTicketId(value) {
  const found = /^([A-Z]+)-([0-9]{4})$/.exec(String(value));
  return found === null ? null : { prefix: found[1], number: Number(found[2]) };
}

// What an allocation refusal names: the grammar, and the way past it.
const ACTION = 'pass --id <ID> or reconcile the backlog';
const FORM = '<PREFIX>-nnnn';
const SAMPLE = 3;

function unreadableBacklog(tickets) {
  const seen = [...new Set(tickets.map((t) => String(t.meta.id)))].sort();
  const quoted = seen.slice(0, SAMPLE).map((id) => `'${id}'`).join(', ');
  const sample = seen.length > SAMPLE ? `${quoted}, …` : quoted;
  return `cannot allocate a ticket id: read ${tickets.length} tickets and none has an id of the form ${FORM} (saw ${sample}); ${ACTION}`;
}

function mixedPrefixes(counts) {
  const named = [...counts].sort(([a], [b]) => (a < b ? -1 : 1)).map(([prefix, n]) => `${prefix}- (${n})`);
  return `cannot allocate a ticket id: the backlog uses more than one prefix — ${named.join(', ')}; ${ACTION}`;
}

const exhaustedPrefix = (prefix, highest, next) =>
  `cannot allocate a ticket id: the next id after ${prefix}-${String(highest).padStart(4, '0')} `
  + `would be ${next}, which is not of the form ${FORM}; ${ACTION}`;

// A control character in a value quoted back is rendered as an escape rather than written through:
// the value is whatever `--id` was given, and the message is one line by contract. A newline splits
// it into three and the second reads like harness output. See Q-0080's review nit.
const printable = (value) => String(value).replace(/[\u0000-\u001f\u007f]/g, (c) => `\\x${c.codePointAt(0).toString(16).padStart(2, '0')}`);

const notATicketId = (given) => `not a ticket id: '${printable(given)}' — an id is ${FORM}, like Q-0081`;

export function parseFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: text };
  return { meta: YAML.parse(m[1]) ?? {}, body: m[2] };
}

export function renderFrontmatter(meta, body) {
  return `---\n${YAML.stringify(meta).trimEnd()}\n---\n${body.replace(/^\n+/, '')}`;
}

export class Backlog {
  constructor(root) {
    this.root = root; // absolute path of backlog folder
  }

  list() {
    if (!fs.existsSync(this.root)) return [];
    return fs.readdirSync(this.root, { withFileTypes: true })
      .filter((d) => d.isDirectory() && fs.existsSync(path.join(this.root, d.name, 'ticket.md')))
      .map((d) => this.read(d.name));
  }

  dirOf(idOrFolder) {
    if (fs.existsSync(path.join(this.root, idOrFolder))) return path.join(this.root, idOrFolder);
    const hit = fs.existsSync(this.root) && fs.readdirSync(this.root).find((n) => n === idOrFolder || n.startsWith(idOrFolder + '-'));
    if (!hit) throw new Error(`ticket not found: ${idOrFolder}`);
    return path.join(this.root, hit);
  }

  read(idOrFolder) {
    const dir = this.dirOf(idOrFolder);
    const { meta, body } = parseFrontmatter(fs.readFileSync(path.join(dir, 'ticket.md'), 'utf8'));
    return { dir, folder: path.basename(dir), meta, body };
  }

  write(ticket) {
    fs.writeFileSync(path.join(ticket.dir, 'ticket.md'), renderFrontmatter(ticket.meta, ticket.body));
  }

  // The prefix this backlog's tickets already carry, and one more than the highest number under
  // it; an empty backlog allocates T-0001, which is the id `harness init` advertises. A backlog
  // whose ids it cannot read is refused rather than reported as empty — that answer is what let
  // two invocations collide on one id and create() overwrite the ticket before it. See Q-0080.
  nextId() {
    const tickets = this.list();
    if (!tickets.length) return 'T-0001';

    const ids = tickets.map((t) => parseTicketId(t.meta.id)).filter((id) => id !== null);
    if (!ids.length) throw new Error(unreadableBacklog(tickets));

    const counts = new Map();
    for (const { prefix } of ids) counts.set(prefix, (counts.get(prefix) ?? 0) + 1);
    if (counts.size > 1) throw new Error(mixedPrefixes(counts));

    const { prefix } = ids[0];
    const highest = Math.max(...ids.map((id) => id.number));
    const next = `${prefix}-${String(highest + 1).padStart(4, '0')}`;
    // The grammar is the oracle rather than a second spelling of "four digits".
    if (!parseTicketId(next)) throw new Error(exhaustedPrefix(prefix, highest, next));
    return next;
  }

  // Refuses a taken id and an occupied folder rather than allocating around either, before
  // anything is created; the ticket directory is then created EXCLUSIVELY, so a single
  // `recursive: true` can no longer accept an existing folder and let write() replace its
  // ticket.md. The backlog root is still created when it is missing. See Q-0080.
  create({ title, intent, owner = process.env.USER ?? 'unknown', repos = [], id: given }) {
    if (given !== undefined && !parseTicketId(given)) throw new Error(notATicketId(given));
    const id = given ?? this.nextId();
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40);
    const folder = `${id}-${slug}`;
    const dir = path.join(this.root, folder);
    const entries = fs.existsSync(this.root) ? fs.readdirSync(this.root) : [];
    if (entries.includes(folder)) throw new Error(`ticket folder already exists: ${folder}`);
    // The same resolution dirOf uses, so a differing slug is still the same id.
    const taken = entries.find((n) => n === id || n.startsWith(`${id}-`));
    if (taken !== undefined) throw new Error(`ticket id already taken: ${id} already belongs to ${taken}`);
    fs.mkdirSync(this.root, { recursive: true });
    fs.mkdirSync(dir);
    const ticket = {
      dir, folder: path.basename(dir), body: intent.trim() + '\n',
      meta: {
        id, title, stage: 'draft', owner, repos,
        branch: `harness/${id}/integration`, priority: 'p2',
        created: new Date().toISOString().slice(0, 10),
        iterations: {}, history: [],
      },
    };
    this.write(ticket);
    return ticket;
  }

  // Read a file inside the ticket folder; supports simple globs like requirements/candidate-*.md
  readFiles(ticket, pattern) {
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

  writeFile(ticket, rel, text) {
    const abs = path.join(ticket.dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, text.endsWith('\n') ? text : text + '\n');
    return abs;
  }

  log(ticket, line) {
    fs.appendFileSync(path.join(ticket.dir, 'runs.log'), `${new Date().toISOString()} ${line}\n`);
  }
}

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]);
}
