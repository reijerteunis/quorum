/**
 * Q-0090 AC-8 (no command is implemented and no domain helper is copied), AC-4(d) (no signal
 * handler) and AC-12 (BYOS), as properties of this package's source rather than of one file
 * somebody remembered to list.
 *
 * **No file list is written down here**, and there are two of them because the criteria have two
 * subjects. AC-8 is about *modules*, so it derives recursively from `src`. AC-12 and AC-4(d) say
 * `packages/cli`, so they derive from what the package carries in any extension — see
 * {@link packageFiles}. A hand-written list is the failure Q-0051 found in
 * `q0050.source.test.ts`'s third list: it mapped over six names, a seventh file went unscanned, and
 * the suite reported green.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

import { COMMANDS } from './commands.js';

/** The directory the module scans walk — this package's `src`, reached package-relatively. */
const SRC = fileURLToPath(new URL('.', import.meta.url));

/** This package's root, the subject AC-12 and AC-4(d) name. */
const PACKAGE = fileURLToPath(new URL('..', import.meta.url));

/**
 * This file, excluded from the scans below because it quotes every string they look for.
 *
 * Spelled twice because the two inventories speak two vocabularies, and derived rather than typed
 * so that renaming this file cannot leave an exclusion excusing a file that is no longer here.
 */
const GUARD = path.relative(SRC, fileURLToPath(import.meta.url));
const GUARD_IN_PACKAGE = path.relative(PACKAGE, fileURLToPath(import.meta.url));

/** Every TypeScript file below `src`, as `[path relative to src, text]`, derived from the tree. */
const files = (): [string, string][] => fs
  .readdirSync(SRC, { withFileTypes: true, recursive: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
  .map((entry) => {
    const full = path.join(entry.parentPath, entry.name);
    return [path.relative(SRC, full), fs.readFileSync(full, 'utf8')];
  });

/** The production half: everything that is not a test, and the subject AC-8 names. */
const production = (): [string, string][] => files().filter(([name]) => !name.endsWith('.test.ts'));

/**
 * The production half, split into the two kinds AC-10 and AC-11 treat differently.
 *
 * **Derived from {@link COMMANDS} rather than hand-listed**, which is what makes the split a rule
 * instead of a list somebody remembers to extend: a module is a *command module* exactly when its
 * basename is a registered command name, so `validate.ts` is one because `validate` is dispatched,
 * and `main.ts` is not because `main` is not. A command added without a module, or a module named
 * after a command that is not registered, both fall out of the same derivation — and
 * {@link COMMAND_DOMAIN} is then required to name exactly the modules this produces, so neither can
 * happen silently. The failure this replaces is `q0050.source.test.ts`'s third list, which mapped
 * over six hand-written names while a seventh file went unscanned and the suite reported green
 * (Q-0051).
 */
const isCommandModule = ([name]: [string, string]): boolean =>
  (COMMANDS as readonly string[]).includes(path.basename(name, '.ts'));

/** The command modules: one per registered command that has a module of its own name. */
const commandModules = (): [string, string][] => production().filter(isCommandModule);

/** The frame: every production module that is not a command's. */
const frameModules = (): [string, string][] => production().filter((entry) => !isCommandModule(entry));

/**
 * Directory names the walk prunes, and the whole of what {@link inventory} excludes.
 *
 * Enumerated rather than delegated to `.gitignore`, because the two guards that ask for an
 * inventory ask two different questions. `packages/core/src/turbo-inputs.test.ts` asks *what does
 * turbo hash*, and answers it with `git ls-files --exclude-standard` — see *"Membership is a git
 * question, not a filesystem one"* (2026-08-28), whose argument is about a build tool's inputs.
 * AC-12 asks whether a credential is **present in this package's tree**, and a credential in an
 * ignored file is still on disk, still readable by any agent given `input.repo: true`, and still
 * one `git add -f` from being published — so the question is what exists, and existence is a
 * filesystem question. Two questions, two inventories, and neither decision needs amending. Ruled
 * in `requirements/errata.md` E-1, which exists to pre-empt the reading that would restore
 * `--exclude-standard` here.
 *
 * Every entry is installed or generated, nothing under any of them is authored, and each is
 * demonstrated below to excuse a real file rather than to sit in the list unexercised.
 *
 * **`dist` is the emitted output, and it is here because Q-0097 built it.** This said *"emitted
 * output is deliberately not among them"* while the workspace emitted nothing and the layout was
 * Q-0096's to choose — correct then, and false the moment a `build` task wrote `packages/cli/dist`.
 * `tsconfig.build.json` excludes every test file under `src`, so what lands there today is
 * production modules; the exclusion is what makes that a *choice* rather than something the scan
 * happens not to trip over, because an emitted copy of THIS file would carry every pattern below and
 * turn the scan red — and only in a checkout that had run a build, which is the
 * verdict-from-the-checkout defect Q-0096's round 2 caught in the assertion next door. Demonstrated
 * below in both directions.
 *
 * **There is no binary exclusion either**, and that direction is deliberate: text is decoded as
 * UTF-8 unconditionally, and a lossy decode can only make a scan report *more* than it should,
 * where an exclusion is the only thing that can make it report less.
 */
const GENERATED = ['node_modules', '.turbo', 'dist'];

/**
 * Every file below `root`, as paths relative to it, with {@link GENERATED} pruned.
 *
 * Pruned during the walk rather than filtered after it, so an installed dependency tree is never
 * read — the exclusion is what keeps this affordable as well as what keeps it narrow.
 *
 * An entry that is neither a file nor a directory **stops the guard** rather than being dropped
 * silently: a third case nobody enumerated is an exclusion nobody wrote down, which is exactly what
 * E-1 rules against. This package has none today and the refusal is demonstrated over a sandbox
 * below, so the clause is known to fire rather than assumed to.
 *
 * @param root the directory to walk — this package, unless a test hands it a sandbox.
 * @param prune the directory names to skip. A parameter so a fixture can ask the same question of
 *   the list as it stood **before** Q-0097 added the emit, which is what makes that entry
 *   demonstrable rather than asserted — the shape `collects(relative, patterns)` already uses in
 *   `packages/core/test/vitest-include.ts` for the same reason.
 */
function inventory(root: string, prune: readonly string[] = GENERATED): string[] {
  const found: string[] = [];
  const walk = (directory: string): void => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!prune.includes(entry.name)) walk(full);
      } else if (entry.isFile()) {
        found.push(path.relative(root, full));
      } else {
        throw new Error(
          `inventory: ${path.relative(root, full)} is neither a file nor a directory — this guard `
          + 'answers for everything the package carries, so it refuses to drop an entry it cannot classify',
        );
      }
    }
  };
  walk(root);
  return found;
}

/**
 * Every file this package carries, as `[package-relative path, text]`, whatever its extension.
 *
 * AC-12 names `packages/cli/**` rather than `packages/cli/src/**`, so the manifest, the three
 * configuration files and any fixture or documentation a later ticket adds are all in scope — a
 * credential in `package.json` is a credential.
 *
 * **Membership is the filesystem's question here**, for the reason {@link GENERATED} gives: an
 * ignored file is still a file, and a guard enforcing a product boundary answers for what is on
 * disk. The exclusions are the two names in that list plus this file, all three enumerated and each
 * asserted to excuse something.
 *
 * **No verdict below depends on whether this checkout has run a build**, which since Q-0097 is a
 * property the {@link GENERATED} entry for `dist` *restores* rather than one the workspace supplies:
 * the emit exists after `turbo run build` and not before, and it is pruned, so the answer is the
 * same either way. Asserted rather than claimed — a test below runs both scans over this package
 * with the artifact present and absent and requires identical verdicts. The same reasoning covers
 * `node_modules/` and `.turbo/`, which exist after an install and a test run and not before, so what
 * they contain is asserted over a directory this file builds rather than over this package — a
 * gitignored directory that *use* creates may not move an answer (Q-0073).
 */
const packageFiles = (): [string, string][] => inventory(PACKAGE)
  .map((name) => [name, fs.readFileSync(path.join(PACKAGE, name), 'utf8')]);

/**
 * Modules **no** production module in this package may import: every read, spawn and prompt goes
 * through `@quorum/core`, which is ground rule 4 as an executable property rather than an intention.
 *
 * `node:path` left this list at Q-0091 and moved to {@link FRAME_ONLY_IO}. It is admitted for a
 * command module because `<harnessDir>/flows` has to be joined somewhere and `Project` carries no
 * `flowsDir` — the alternative, adding one, moves `project.test.ts:78`'s four-key pin in the package
 * Q-0092 to Q-0094 all consume, to save one import. **`node:url` stays forbidden everywhere in
 * production, and it is the one entry `init` could have needed**: `quorum init` copies a tree and
 * asks git for a branch name, and both are `@quorum/core`'s, so the list is unchanged and neither
 * new command module has an exemption from it (Q-0093 AC-10(a)).
 *
 * **What this regex does not see is an import, and that is why it never saw the thing its comment
 * claimed to forbid.** Until Q-0093 the sentence above went on to say that *"a module resolving its
 * own location is the mechanism Q-0090 AC-7 replaced"* — a promise this scan cannot keep, because
 * `import.meta.url` imports nothing: `URL` and `import.meta` are both ambient, so a module resolving
 * its own location passed here in silence. {@link resolvesOwnLocation} is the clause that sees it,
 * and Q-0093 is the first ticket to give it a subject.
 */
const IO_MODULE = /from '(node:fs[^']*|node:child_process|node:readline[^']*|node:os|node:url)'/;

/** The one module a command may import and the frame may not. */
const FRAME_ONLY_IO = /from 'node:path'/;

/**
 * `text` with its comments removed, so a clause below reads what a module **executes**.
 *
 * The two forms this repository writes prose in: a `/** … *\/` block, and a `//` remark on a line of
 * its own. A trailing `//` after code is deliberately **not** stripped — stripping it would need a
 * string-literal parser, since `'https://…'` is not a comment — so a claim about a scan that reads
 * this is a claim about those two forms and no others. Stated rather than left to be found.
 */
const codeOf = (text: string): string => text
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '');

/**
 * Whether a module resolves **its own location** — the mechanism `IO_MODULE`'s comment claimed to
 * forbid and could not see (Q-0093 AC-10(b)).
 *
 * Every spelling that answers *where am I*: `import.meta.url`, and the two properties Node added
 * beside it. Read out of {@link codeOf} rather than out of the raw text, so a comment naming the
 * mechanism cannot trip it and a guard cannot be talked out of firing by text it does not execute —
 * the failure Q-0079's round 1 found inside its own enforcer.
 */
const resolvesOwnLocation = (text: string): boolean =>
  /\bimport\.meta\.(url|dirname|filename)\b/.test(codeOf(text));

/**
 * The production modules permitted to resolve their own location, with why.
 *
 * **Split rather than blanket-enforced**, on the `node:path` precedent above: `quorum init` has to
 * find the shipped templates, and the only honest answer is *beside the file that is running* —
 * decision *"The emit serves the binary, and no test verdict moves behind it"* (2026-09-02) clause
 * (e) fixes the binary's depth so that `../templates/harness/` resolves to `<package>/templates/`
 * from `dist/` and from `src/` alike. A `process.cwd()` would answer the user's directory and an
 * environment variable would answer whatever was exported.
 *
 * **The frame is permitted none**, which is the half that keeps this a rule rather than a list: a
 * frame module resolving its own location is the mechanism Q-0090 AC-7 replaced, and a second
 * command module doing it would mean two places knew where the package is.
 */
const SELF_LOCATING: Record<string, string> = {
  'init.ts': 'the shipped template tree is at <package>/templates/harness, which is knowable only relative to this module — 078(e)',
};

describe('the module scan has a subject', () => {
  test('it finds this package\'s modules, both halves are non-empty, and the paths are distinct', () => {
    const names = files().map(([name]) => name);
    expect(names, 'src holds no TypeScript — every scan below proves nothing').toContain('main.ts');
    expect(names, 'this file is outside its own scan — the exclusions below excuse nothing').toContain(GUARD);
    expect(production().length).toBeGreaterThan(4);
    expect(files().length).toBeGreaterThan(production().length);
    expect(names.sort()).toStrictEqual([...new Set(names)].sort());
  });

  test('and the frame/command split is a real partition, with both halves populated', () => {
    // Without this the AC-10 clauses below could pass over an empty half: a derivation that matched
    // nothing would leave "no frame module names a domain symbol" true of nothing at all, which is
    // the shape "a check that skips its subject must not report success" (2026-08-25) names.
    const names = (entries: [string, string][]): string[] => entries.map(([name]) => name).sort();
    expect(names(commandModules()), 'the command modules are not what COMMANDS says they are')
      .toStrictEqual(['init.ts', 'lint.ts', 'runs.ts', 'ticket.ts', 'validate.ts']);
    expect(names(commandModules()), 'the partition still holds the two modules it held before Q-0092')
      .not.toStrictEqual(['lint.ts', 'validate.ts']);
    // Added rather than replacing the line above, as Q-0092 added that one: each superseded value is
    // kept so a register that quietly shrank back is a failure naming the ticket it shrank past.
    expect(names(commandModules()), 'the partition still holds the three modules it held before Q-0093')
      .not.toStrictEqual(['lint.ts', 'runs.ts', 'validate.ts']);
    expect(names(frameModules())).toContain('main.ts');
    expect([...names(frameModules()), ...names(commandModules())].sort()).toStrictEqual(names(production()));
    expect(names(frameModules()).filter((name) => names(commandModules()).includes(name))).toStrictEqual([]);
  });

  test('Q-0093 OQ-4 — the package barrel re-exports every command module, derived rather than listed', () => {
    // `index.ts` exported `lint.js` and `validate.js` and not `runs.js`, so Q-0092's module was
    // absent from this package's own public surface by omission rather than by decision, and nothing
    // said so. Derived from the same `COMMANDS` the partition above uses, which is what stops the
    // next command being forgotten the same way — a register that can rot, closed rather than
    // re-typed. *"Resolve rather than open a successor."*
    const barrel = production().find(([name]) => name === 'index.ts')?.[1] ?? '';
    expect(barrel, 'index.ts is not among the production modules').not.toBe('');
    const modules = commandModules().map(([name]) => name).sort();
    expect(modules.length, 'the derivation found no command module — this test proves nothing').toBeGreaterThan(2);
    const missing = modules.filter((name) => !barrel.includes(`export * from './${name.replace(/\.ts$/, '.js')}';`));
    expect(missing, 'a command module the package does not export').toStrictEqual([]);
  });

  test('and that derivation has a subject — a barrel missing one is recognised as missing it', () => {
    // Shown over text rather than over the tree, because the shipped barrel passes: the expression
    // above is run against the barrel as it stood before this ticket, which omitted `runs.js`.
    const beforeQ0093 = "export * from './lint.js';\nexport * from './validate.js';\n";
    const missing = ['lint.ts', 'runs.ts', 'validate.ts']
      .filter((name) => !beforeQ0093.includes(`export * from './${name.replace(/\.ts$/, '.js')}';`));
    expect(missing).toStrictEqual(['runs.ts']);
  });
});

/**
 * Symbols that execute a run, write the backlog or open a project on disk.
 *
 * Every one lives in `@quorum/core` and belongs to a sibling ticket. The frame is a presentation
 * layer over an API that already exists; a helper that appears to be missing from `core` is
 * reported rather than reimplemented here (Q-0090 ground rule 4).
 */
const DOMAIN = [
  'runFlow', 'loadFlow', 'loadFlowByName', 'lintFlowDirectory', 'lintDirectory',
  'Backlog', 'loadProject', 'findProject', 'getAdapter', 'probeAdapter',
  'validateArtifact', 'readData', 'containment', 'overrideAdapters',
  'readRunsDir', 'sortRuns', 'isIncomplete', 'occurrenceSeq', 'vendorTokenTotal', 'readRun',
  'initProject',
];

/**
 * For each command module, the domain symbols **that command** needs.
 *
 * The other half of AC-10, and the reason the scan below could be narrowed without being weakened:
 * a command module has to name some of {@link DOMAIN}, so the prohibition alone would have had to
 * become an exemption, and an exemption with no shape is a hole. Here it has one — a `validate.ts`
 * naming `probeAdapter` is a failure, and so is an entry permitting a symbol its module does not
 * actually name, which is what stops the list rotting into a wish.
 *
 * Keyed by module rather than by command so the audit can compare it against the derivation above
 * directly. Q-0092 added `runs.ts`'s row with its command; Q-0093 added two, and Q-0094 and Q-0099
 * each add theirs the same way.
 *
 * `init.ts`'s row is one name, which is the point of it: `quorum init` scaffolds a project it has
 * not opened, so it reaches neither `loadProject` nor `Backlog` — and the row saying so is what
 * would fail if it started to.
 */
const COMMAND_DOMAIN: Record<string, readonly string[]> = {
  'init.ts': ['initProject'],
  'lint.ts': ['loadProject', 'lintDirectory'],
  'ticket.ts': ['Backlog', 'loadProject'],
  'validate.ts': ['validateArtifact', 'readData'],
  'runs.ts': [
    'loadProject', 'readRunsDir', 'sortRuns', 'isIncomplete', 'occurrenceSeq', 'vendorTokenTotal',
    'readRun',
  ],
};

/** Whether `text` names `symbol` as a word rather than as part of a longer one. */
const names = (text: string, symbol: string): boolean => new RegExp(`\\b${symbol}\\b`).test(text);

/**
 * Everything wrong with `frame`, `commands` and `allowed` as a description of AC-10, one sentence
 * each.
 *
 * A function over its inputs rather than assertions over the three constants, so each clause can be
 * shown firing on a mutated copy — demonstrating that a guard has a subject proves the guard fires,
 * not that each of its clauses does (Q-0071).
 */
function domainOffenders(
  frame: readonly [string, string][],
  commands: readonly [string, string][],
  allowed: Record<string, readonly string[]>,
): string[] {
  const problems: string[] = [];
  for (const [name, text] of frame) {
    for (const symbol of DOMAIN) {
      if (names(text, symbol)) problems.push(`${name}: ${symbol} belongs to @quorum/core and to a command`);
    }
  }
  for (const [name, text] of commands) {
    const permitted = allowed[name];
    if (permitted === undefined) {
      problems.push(`${name}: a command module with no entry saying which domain symbols it may name`);
      continue;
    }
    for (const symbol of DOMAIN) {
      if (names(text, symbol) && !permitted.includes(symbol)) {
        problems.push(`${name}: ${symbol} is not one of [${permitted.join(', ')}]`);
      }
    }
    for (const symbol of permitted) {
      if (!names(text, symbol)) problems.push(`${name}: its entry permits ${symbol}, which the module does not name`);
    }
  }
  for (const name of Object.keys(allowed)) {
    if (!commands.some(([module]) => module === name)) problems.push(`${name}: an entry for a module that is no command's`);
  }
  return problems;
}

describe('AC-8 and Q-0091 AC-10 — the frame implements no command, and a command reaches only its own', () => {
  test('no frame module names a run-executing or backlog-writing symbol, and no command names another\'s', () => {
    expect(domainOffenders(frameModules(), commandModules(), COMMAND_DOMAIN), 'AC-10').toStrictEqual([]);
    expect(DOMAIN.length, 'the symbol list is empty — this test proves nothing').toBeGreaterThan(10);
  });

  test('and that scan has a subject — the symbol names are found where they are written down', () => {
    // Demonstrated over this file, which names all fourteen: the regexes match real text rather
    // than never matching anything.
    const here = files().find(([name]) => name === GUARD);
    expect(here).toBeDefined();
    expect(DOMAIN.filter((symbol) => names(here?.[1] ?? '', symbol))).toStrictEqual(DOMAIN);
  });

  test('AC-10 — a domain symbol in the frame fails, and so does one in the wrong command', () => {
    // Both directions, over mutated copies rather than over the tree, because the shipped tree
    // passes and a clause that can only be observed passing is not established (2026-08-29).
    const stray: [string, string][] = [['main.ts', 'const x = loadProject();']];
    expect(domainOffenders(stray, [], {}))
      .toStrictEqual(['main.ts: loadProject belongs to @quorum/core and to a command']);

    const wrongCommand: [string, string][] = [['validate.ts', 'validateArtifact(); readData(); probeAdapter();']];
    expect(domainOffenders([], wrongCommand, { 'validate.ts': COMMAND_DOMAIN['validate.ts'] }))
      .toStrictEqual(['validate.ts: probeAdapter is not one of [validateArtifact, readData]']);
  });

  test('AC-10 — an unregistered command module fails, and so does an entry with no module', () => {
    // The two ways the register and the derivation can come apart. The first is what a fifth command
    // landing without a row would do; the second is what deleting a command's module would do while
    // leaving its row behind, which is how a register decays into prose.
    const unregistered: [string, string][] = [['board.ts', 'containment();']];
    expect(domainOffenders([], unregistered, COMMAND_DOMAIN))
      .toContain('board.ts: a command module with no entry saying which domain symbols it may name');
    expect(domainOffenders([], [], COMMAND_DOMAIN))
      .toContain("lint.ts: an entry for a module that is no command's");
  });

  test('AC-10 — an entry permitting a symbol its module does not name fails, so the list cannot rot', () => {
    const stale: [string, string][] = [['lint.ts', 'loadProject(); lintDirectory();']];
    expect(domainOffenders([], stale, { 'lint.ts': ['loadProject', 'lintDirectory', 'containment'] }))
      .toStrictEqual(['lint.ts: its entry permits containment, which the module does not name']);
  });

  test('Q-0092 AC-4 — the runs row fails in both directions, over mutated copies', () => {
    // The row this ticket added, shown discriminating rather than observed passing. Both halves,
    // because a register that only refused *extra* symbols would let a real import go unrecorded.
    const permitted = COMMAND_DOMAIN['runs.ts'];
    const extra: [string, string][] = [['runs.ts', `${permitted.join('(); ')}(); containment();`]];
    expect(domainOffenders([], extra, { 'runs.ts': permitted }))
      .toStrictEqual([`runs.ts: containment is not one of [${permitted.join(', ')}]`]);

    const missing: [string, string][] = [['runs.ts', permitted.filter((s) => s !== 'readRun').join('(); ')]];
    expect(domainOffenders([], missing, { 'runs.ts': permitted }))
      .toStrictEqual(['runs.ts: its entry permits readRun, which the module does not name']);
  });

  test('Q-0092 AC-4 — readRun and readRunsDir are two symbols, not one matching the other', () => {
    // `\breadRun\b` must not be satisfied by `readRunsDir`, or the register could permit the
    // single-run reader while the module names only the directory walk. Asserted because the two
    // names differ by a suffix and the word-boundary is the only thing keeping them apart.
    expect(names('readRunsDir(root);', 'readRun'), 'readRunsDir answers for readRun').toBe(false);
    expect(names('readRun(root, token);', 'readRun')).toBe(true);
    expect(names('readRunsDir(root);', 'readRunsDir')).toBe(true);
  });

  test('AC-11 — no production module imports a filesystem, process-spawning or terminal module', () => {
    // Every read, spawn and prompt goes through `@quorum/core`. The gate reader that owns
    // `node:readline` is Q-0094's, and it will need this clause split again rather than deleted.
    expect(production().filter(([, text]) => IO_MODULE.test(text)).map(([name]) => name)).toStrictEqual([]);
  });

  test('and that clause has a subject — this package\'s tests do import them', () => {
    expect(files().filter(([, text]) => IO_MODULE.test(text)).length).toBeGreaterThan(2);
  });

  test('AC-11 — node:path is a command\'s to import and never the frame\'s', () => {
    // The clause split rather than shrunk: `node:path` came out of the package-wide list and became
    // this, so the frame's prohibition is unchanged and only the commands gained one module.
    expect(frameModules().filter(([, text]) => FRAME_ONLY_IO.test(text)).map(([name]) => name)).toStrictEqual([]);
    expect(commandModules().filter(([, text]) => FRAME_ONLY_IO.test(text)).map(([name]) => name))
      .toStrictEqual(['init.ts', 'lint.ts', 'runs.ts', 'ticket.ts']);
    // Q-0092: `runs.ts` joins the runs root, relativises a manifest path and normalises an
    // occurrence directory to forward slashes, all of which the spike does with `node:path`. Shown
    // red against the value it replaced rather than edited to fit.
    expect(commandModules().filter(([, text]) => FRAME_ONLY_IO.test(text)).map(([name]) => name),
      'the list still holds the one module it held before Q-0092').not.toStrictEqual(['lint.ts']);
    // Q-0093: `init.ts` resolves the directory to scaffold with `path.resolve(rest[0] ?? '.')` and
    // `ticket.ts` relativises the created folder against the working directory, both of which the
    // spike does with `node:path`. Same demonstration, against the value this ticket replaced.
    expect(commandModules().filter(([, text]) => FRAME_ONLY_IO.test(text)).map(([name]) => name),
      'the list still holds the two modules it held before Q-0093').not.toStrictEqual(['lint.ts', 'runs.ts']);
  });

  test('and both halves of that clause fire — it is neither vacuous nor blind', () => {
    // Shown discriminating over text rather than over the tree: the regex matches a real import and
    // is not satisfied by a mention of the module's name in prose, which is the failure Q-0079's
    // round 1 found — a guard that can be talked out of firing by text it does not execute.
    expect(FRAME_ONLY_IO.test("import path from 'node:path';")).toBe(true);
    expect(FRAME_ONLY_IO.test('// joins <harnessDir> and flows with node:path')).toBe(false);
    expect(IO_MODULE.test("import path from 'node:path';"), 'node:path is still package-wide').toBe(false);
  });
});

/**
 * Everything wrong with `frame`, `commands` and `allowed` as a description of AC-10's self-location
 * clause, one sentence each.
 *
 * A function over its inputs for the same reason {@link domainOffenders} is one: each clause is
 * shown firing on a mutated copy rather than observed passing over a tree that satisfies it.
 */
function locationOffenders(
  frame: readonly [string, string][],
  commands: readonly [string, string][],
  allowed: Record<string, string>,
): string[] {
  const problems: string[] = [];
  for (const [name, text] of frame) {
    if (resolvesOwnLocation(text)) problems.push(`${name}: the frame may not resolve its own location`);
  }
  for (const [name, text] of commands) {
    if (resolvesOwnLocation(text) && allowed[name] === undefined) {
      problems.push(`${name}: it resolves its own location and no entry says why it may`);
    }
    if (!resolvesOwnLocation(text) && allowed[name] !== undefined) {
      problems.push(`${name}: its entry permits a self-location the module does not perform`);
    }
  }
  for (const name of Object.keys(allowed)) {
    if (!commands.some(([module]) => module === name)) problems.push(`${name}: an entry for a module that is no command's`);
  }
  return problems;
}

describe('Q-0093 AC-10 — one module knows where the package is, and the guard can see it', () => {
  test('the frame resolves no location, and the one command that does is the one with an entry', () => {
    expect(locationOffenders(frameModules(), commandModules(), SELF_LOCATING)).toStrictEqual([]);
    expect(Object.keys(SELF_LOCATING), 'the register is empty — this test proves nothing')
      .toStrictEqual(['init.ts']);
  });

  test('a frame module doing it fails, and so does a second command module', () => {
    // Both mutations AC-10(d) names, over copies rather than over the tree: the shipped tree passes,
    // and a clause that can only be observed passing is not established (2026-08-29).
    const stray: [string, string][] = [['main.ts', "const here = new URL('.', import.meta.url);"]];
    expect(locationOffenders(stray, [], {}))
      .toStrictEqual(['main.ts: the frame may not resolve its own location']);

    const second: [string, string][] = [['runs.ts', "const root = new URL('../runs/', import.meta.url);"]];
    expect(locationOffenders([], second, {}))
      .toStrictEqual(['runs.ts: it resolves its own location and no entry says why it may']);
  });

  test('and an entry permitting a self-location its module does not perform fails, so the list cannot rot', () => {
    // The other direction, which is what stops the register outliving the mechanism it excuses —
    // the shape `domainOffenders` already refuses for the domain symbols.
    const plain: [string, string][] = [['init.ts', "import path from 'node:path';"]];
    expect(locationOffenders([], plain, SELF_LOCATING))
      .toStrictEqual(['init.ts: its entry permits a self-location the module does not perform']);
    expect(locationOffenders([], [], SELF_LOCATING))
      .toStrictEqual(["init.ts: an entry for a module that is no command's"]);
  });

  test('the clause reads what a module executes, not what its prose says — which is why IO_MODULE missed it', () => {
    // AC-10(b) and (e) together. The first two assertions are the finding this clause exists for:
    // `IO_MODULE` matches an IMPORT, and `import.meta.url` imports nothing, so the expression the
    // shipped `init.ts` uses passed a scan whose own comment promised to forbid it. The rest is the
    // discrimination Q-0079's round 1 asked for — a guard must not be satisfiable by text it does
    // not execute, and must not be talked out of firing by text that is only a comment.
    const expression = "const TEMPLATES = new URL('../templates/harness/', import.meta.url);";
    expect(IO_MODULE.test(expression), 'the import scan sees a self-location after all').toBe(false);
    expect(resolvesOwnLocation(expression)).toBe(true);
    expect(resolvesOwnLocation('// a module resolving its own location is what Q-0090 AC-7 replaced')).toBe(false);
    expect(resolvesOwnLocation('/**\n * the shape is new URL(x, import.meta.url), handed to core\n */\nexport const a = 1;')).toBe(false);
    expect(resolvesOwnLocation('const here = import.meta.dirname;'), 'the newer spelling is invisible').toBe(true);
    expect(resolvesOwnLocation('const here = fileURLToPath(import.meta.filename);')).toBe(true);
    // And it is not satisfied by the words alone: `import.meta` without one of the three properties
    // is a module record, not a location.
    expect(resolvesOwnLocation('const m = import.meta;')).toBe(false);
  });

  test('and the comment stripping has a subject in this package, so the clause above is not vacuous', () => {
    // Without this, `codeOf` could be removing nothing and the two negative assertions would hold
    // for a reason that has nothing to do with comments. Measured over the real modules.
    const stripped = production().filter(([, text]) => codeOf(text).length < text.length);
    expect(stripped.length, 'no production module carries a comment — the stripping excuses nothing')
      .toBeGreaterThan(3);
    const shipped = production().find(([name]) => name === 'init.ts');
    expect(shipped, 'init.ts is not among the production modules').toBeDefined();
    expect(resolvesOwnLocation(shipped?.[1] ?? ''), 'the shipped module no longer resolves its own location').toBe(true);
  });
});

describe('Q-0091 AC-2 — no command re-parses the command line', () => {
  test('no command module reads process.argv or calls the parser', () => {
    // `main.ts` hands every handler the whole `ParsedArgv` for exactly this reason (Q-0090 review
    // round 6, which found `main` discarding `rest`, `flags` and `gateAnswers`). A command that
    // parsed again would need a second flag table, and the two would drift.
    const offenders = commandModules()
      .filter(([, text]) => /process\.argv|\bparseArgv\s*\(/.test(text))
      .map(([name]) => name);
    expect(offenders, 'the frame parses once and the handler is given the result').toStrictEqual([]);
  });

  test('and that scan has a subject — the frame does both of the things it forbids', () => {
    // `main.ts` calls `parseArgv` and `quorum.ts` reads `process.argv`, so the two patterns match
    // real text in this tree rather than never matching anything.
    const frameText = frameModules().map(([, text]) => text).join('\n');
    expect(/\bparseArgv\s*\(/.test(frameText)).toBe(true);
    expect(/process\.argv/.test(frameText)).toBe(true);
  });
});

describe('Q-0091 AC-5 — the flattening lives in core and is not copied here', () => {
  test('no command module carries the regexes that split a lint message', () => {
    // `flattenProblems` (`packages/core/src/lint/lint.ts:388`) has already split each multi-line
    // message, dropped its header and stripped the leading hyphens, so the CLI adds a marker, a
    // colour and an indent and nothing else. A second copy of these two literals would be the
    // transcription defect this repository keeps paying for, and it would go stale silently — the
    // copy still renders something, just not what `core` computed.
    const offenders = commandModules()
      .filter(([, text]) => /\^-\+|invalid:\$/.test(text))
      .map(([name]) => name);
    expect(offenders, 'the flattening belongs to core').toStrictEqual([]);
  });

  test('and that clause has a subject — the literals it looks for are the ones core uses', () => {
    // Shown to match the real thing rather than asserted: these are the two anchors of
    // `flattenProblems`, written out here so the scan is known to be aimed at them.
    expect(/\^-\+|invalid:\$/.test("problem.replace(/^-+\\s*/, '')")).toBe(true);
    expect(/\^-\+|invalid:\$/.test('/invalid:$/.test(parts[0])')).toBe(true);
    expect(/\^-\+|invalid:\$/.test('`  - ${problem}`'), 'the indent is the CLI\'s and must not trip it').toBe(false);
  });
});

describe('AC-4(d) — 130 is a row of the table and nothing installs a handler for it', () => {
  test('no file in this package registers a signal handler', () => {
    // `core` installs none either (Q-0050 AC-5), so the handler is this package's to place — and it
    // is Q-0094's, with `run`. The spike's engine registers both SIGINT and SIGTERM through one
    // `process.once` handler at `spike/src/engine.js:113–114` and exits 130 at `:111`.
    //
    // Over the package rather than over `src/**/*.ts`, because the criterion's subject is
    // `packages/cli` and `vitest.config.js` is executable too. Same reasoning as AC-12's scan, and
    // widened in the same change so the claim and the subject do not disagree here either.
    const offenders = packageFiles()
      .filter(([name]) => name !== GUARD_IN_PACKAGE)
      .filter(([, text]) => /process\.(on|once|addListener)\s*\(\s*['"]SIG/.test(text))
      .map(([name]) => name);
    expect(offenders).toStrictEqual([]);
  });

  test('and loading the frame adds none at runtime', async () => {
    // Counted before and after rather than asserted to be zero: whatever the test runner installs
    // for itself is not this package's, and a verdict that depended on it would be a property of
    // the runner rather than of the commit.
    const before = { SIGINT: process.listenerCount('SIGINT'), SIGTERM: process.listenerCount('SIGTERM') };
    await import('./index.js');
    expect({ SIGINT: process.listenerCount('SIGINT'), SIGTERM: process.listenerCount('SIGTERM') })
      .toStrictEqual(before);
  });
});

/** Every spelling that would mean a key, a token or a credential had a path through the CLI. */
const CREDENTIAL = [
  /API_KEY/i, /\bapiKey\b/i, /ANTHROPIC_/, /OPENAI_/, /CODEX_/,
  /\bbearer\b/i, /\bcredential/i, /\bsecret\b/i, /\bauth[- ]?token\b/i,
];

describe('AC-12 — BYOS: no API-key path exists anywhere in this package', () => {
  test('nothing in source, test, fixture, configuration or help text matches any credential spelling', () => {
    const offenders = CREDENTIAL.flatMap((pattern) => packageFiles()
      .filter(([name]) => name !== GUARD_IN_PACKAGE)
      .filter(([, text]) => pattern.test(text))
      .map(([name]) => `${name}: ${pattern.source}`));
    expect(offenders, 'adapters run on the vendor CLI\'s own login; there is no key path').toStrictEqual([]);
  });

  test('and the scan reaches past src and past TypeScript, which is the whole of what AC-12 asks', () => {
    // Without this, the criterion's claim is `packages/cli/**` and its subject is `src/**/*.ts`: a
    // credential in the manifest, in a JSON fixture or in a package-level document passes unnoticed
    // while the suite reports green. Each of the four is named, so losing one is a failure rather
    // than a quietly smaller scan.
    const names = packageFiles().map(([name]) => name);
    for (const outside of ['package.json', 'turbo.json', 'tsconfig.json', 'vitest.config.js']) {
      expect(names, `${outside} is not scanned — a credential in it would pass unnoticed`).toContain(outside);
    }
    expect(names, 'the scan no longer reaches the modules').toContain(path.join('src', 'main.ts'));
    expect(names.filter((name) => !name.endsWith('.ts')).length).toBeGreaterThan(3);
    expect(names.sort()).toStrictEqual([...new Set(names)].sort());
  });

  test('the self-exclusion is load-bearing, and it is the only one', () => {
    // This file quotes every pattern above, so scanning it would report itself — and it is the
    // *only* file the exclusion excuses, which is the half that stops the exclusion from growing
    // into a filter. Demonstrated rather than assumed.
    const matching = packageFiles()
      .filter(([, text]) => CREDENTIAL.some((pattern) => pattern.test(text)))
      .map(([name]) => name);
    expect(matching).toStrictEqual([GUARD_IN_PACKAGE]);
  });

  test('an ignored file is scanned, which is the whole of what E-1 ruled', () => {
    // The finding this replaces: `git ls-files --exclude-standard` drops every ignored file, so a
    // gitignored fixture, documentation example, shell script or local config carrying a credential
    // passed a guard whose criterion covers all of `packages/cli/**`. Pinned over a repository this
    // test builds, where both sides are values it set itself.
    //
    // Both halves are asserted, because the first alone could pass over a `.gitignore` that never
    // ignored anything: git is *shown* to drop the file, and the inventory is shown to carry it.
    // Restoring `--exclude-standard` turns the second assertion red.
    const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'quorum-cli-inventory-'));
    try {
      execFileSync('git', ['init', '--quiet'], { cwd: sandbox, stdio: ['ignore', 'pipe', 'pipe'] });
      fs.writeFileSync(path.join(sandbox, '.gitignore'), 'ignored/\n');
      fs.mkdirSync(path.join(sandbox, 'ignored'));
      fs.writeFileSync(path.join(sandbox, 'ignored', 'notes.txt'), 'ANTHROPIC_API_KEY=x\n');
      const credential = path.join('ignored', 'notes.txt');

      const tracked = execFileSync(
        'git',
        ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
        { cwd: sandbox, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
      ).split('\0').filter((entry) => entry !== '');
      expect(tracked, 'the fixture is not ignored, so it discriminates nothing').not.toContain(credential);
      expect(inventory(sandbox), 'an ignored credential is invisible again — E-1').toContain(credential);
    } finally {
      fs.rmSync(sandbox, { recursive: true, force: true });
    }
  });

  test('each enumerated exclusion excuses a real file, and nothing else is dropped', () => {
    // A fixture per entry, derived from the list rather than written out, so a third exclusion added
    // later arrives with a subject or fails here. Showing that the pruning fires proves the pruning
    // fires and not that each entry does (Q-0071), which is why this loops.
    const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'quorum-cli-generated-'));
    try {
      fs.writeFileSync(path.join(sandbox, 'kept.json'), '{}\n');
      fs.mkdirSync(path.join(sandbox, 'src'));
      fs.writeFileSync(path.join(sandbox, 'src', 'kept.ts'), 'export const kept = 1;\n');
      for (const name of GENERATED) {
        fs.mkdirSync(path.join(sandbox, name, 'nested'), { recursive: true });
        fs.writeFileSync(path.join(sandbox, name, 'nested', 'output.txt'), 'ANTHROPIC_API_KEY=x\n');
      }

      // An identity and not a count, because the fixtures are derived from the list: removing an
      // entry would otherwise remove its own subject, and the behavioural assertion below would
      // stay green over a shorter rule. A count of two would too. So the list is written out once
      // more, and that is what makes a removal visible (Q-0073, "a count is not an identity").
      expect(GENERATED, 'the exclusion list moved — each entry is a named claim').toStrictEqual([
        'node_modules', '.turbo', 'dist',
      ]);
      expect(inventory(sandbox).sort()).toStrictEqual(['kept.json', path.join('src', 'kept.ts')]);
      for (const name of GENERATED) {
        expect(
          fs.existsSync(path.join(sandbox, name, 'nested', 'output.txt')),
          `${name} excuses nothing — the fixture it prunes is not there`,
        ).toBe(true);
      }
    } finally {
      fs.rmSync(sandbox, { recursive: true, force: true });
    }
  });

  test('Q-0097 AC-12 — an emitted copy of a test file turns this scan red without the emit exclusion', () => {
    // **The two-directional demonstration**, which is what proves the `dist` entry has a subject
    // rather than being a precaution. The fixture is an emitted copy of a test file — the exact
    // thing `tsc` would write from `src/` if `tsconfig.build.json` did not exclude `src/**/*.test.ts`
    // — and it carries a pattern this scan looks for, so:
    //
    //   - under the list as it stood BEFORE this ticket, the scan finds it and goes red;
    //   - under the list as it stands now, the scan does not see it at all.
    //
    // Both directions in one fixture, so neither can be satisfied by a walk that collects nothing.
    const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'quorum-cli-emit-'));
    try {
      const BEFORE_Q0097 = ['node_modules', '.turbo'];
      fs.mkdirSync(path.join(sandbox, 'src'));
      fs.writeFileSync(path.join(sandbox, 'src', 'frame.source.test.ts'), 'const CREDENTIAL = [/API_KEY/i];\n');
      fs.mkdirSync(path.join(sandbox, 'dist'));
      fs.writeFileSync(path.join(sandbox, 'dist', 'frame.source.test.js'), 'const CREDENTIAL = [/API_KEY/i];\n');
      const emitted = path.join('dist', 'frame.source.test.js');

      const matching = (prune: readonly string[]): string[] => inventory(sandbox, prune)
        .filter((name) => CREDENTIAL.some((pattern) => pattern.test(fs.readFileSync(path.join(sandbox, name), 'utf8'))));

      expect(matching(BEFORE_Q0097), 'the emitted copy was invisible before the exclusion — the fixture proves nothing')
        .toContain(emitted);
      expect(matching(GENERATED), 'the emit exclusion does not reach an emitted test file').not.toContain(emitted);
      expect(matching(GENERATED), 'the exclusion swallowed the source file too, which is not what it is for')
        .toStrictEqual([path.join('src', 'frame.source.test.ts')]);
    } finally {
      fs.rmSync(sandbox, { recursive: true, force: true });
    }
  });

  test('Q-0097 AC-12 — both scans return identical verdicts with the artifact present and absent', () => {
    // Decision 078(b)'s guarantee applied to this file: whether a checkout has run a build may not
    // move an answer. Asked of BOTH scans this file performs — the one above and AC-4(d)'s
    // signal-handler sweep — because the exclusion is shared and a regression would hit both.
    //
    // Over a sandbox rather than over the live package, for two reasons stated rather than left to
    // be found. A test that built and deleted `packages/cli/dist` would be mutating the tree it is
    // judging (Q-0073), and `src/build.test.ts` — which legitimately does mutate it — runs in a
    // parallel Vitest worker, so the two would race and the flake would look like a code defect.
    // What that file asserts on the live package is the same claim for the collected test set
    // (AC-23); what this asserts is that the walk itself cannot tell the two states apart.
    const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'quorum-cli-present-absent-'));
    try {
      fs.mkdirSync(path.join(sandbox, 'src'));
      fs.writeFileSync(path.join(sandbox, 'src', 'main.ts'), 'export const main = 1;\n');
      const absent = inventory(sandbox);

      fs.mkdirSync(path.join(sandbox, 'dist'));
      fs.writeFileSync(path.join(sandbox, 'dist', 'main.js'), 'export const main = 1;\n');
      fs.writeFileSync(path.join(sandbox, 'dist', 'main.d.ts'), 'export declare const main = 1;\n');
      fs.writeFileSync(path.join(sandbox, 'dist', 'leaked.test.js'), 'const t = "ANTHROPIC_API_KEY";\n');
      const present = inventory(sandbox);

      expect(present, 'the emit is visible to the walk, so every verdict below moves with the checkout')
        .toStrictEqual(absent);
      expect(absent, 'the sandbox holds nothing — both sides are empty and the comparison is vacuous')
        .toStrictEqual([path.join('src', 'main.ts')]);
      expect(fs.existsSync(path.join(sandbox, 'dist', 'leaked.test.js')), 'the fixture emit is not there').toBe(true);
    } finally {
      fs.rmSync(sandbox, { recursive: true, force: true });
    }
  });

  test('an entry it cannot classify stops the walk instead of leaving the scan', () => {
    // The exclusion that would otherwise be written nowhere. A symlink is neither `isFile` nor
    // `isDirectory`, so a walk that tested only those two would drop it in silence — an unenumerated
    // exclusion, which is the shape E-1 forbids.
    const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'quorum-cli-unclassified-'));
    try {
      fs.symlinkSync(path.join(sandbox, 'nowhere'), path.join(sandbox, 'link'));
      expect(() => inventory(sandbox)).toThrow(/neither a file nor a directory/);
    } finally {
      fs.rmSync(sandbox, { recursive: true, force: true });
    }
  });
});
