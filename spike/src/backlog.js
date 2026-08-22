// Backlog = folders in git. A ticket is backlog/<id>-<slug>/ticket.md (frontmatter = state).
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

export const STAGES = [
  'draft', 'requirements', 'solutioned', 'red', 'green', 'reviewed', 'qa-passed', 'deployed',
  'blocked', 'abandoned',
];

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

  nextId() {
    const nums = this.list().map((t) => parseInt(String(t.meta.id).replace(/^T-/, ''), 10)).filter(Number.isFinite);
    return `T-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(4, '0')}`;
  }

  create({ title, intent, owner = process.env.USER ?? 'unknown', repos = [] }) {
    const id = this.nextId();
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40);
    const dir = path.join(this.root, `${id}-${slug}`);
    fs.mkdirSync(dir, { recursive: true });
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
