/**
 * Q-0126 AC-12 as a property of the workspace rather than of one folder: **one site launches a
 * browser, and it composes no command string.**
 *
 * "The only place" is not observable at run time — a second launcher somewhere else would work
 * perfectly and be wrong — so it is asserted over the source of every package and every app, which
 * is the only corpus in which the claim has a subject. `browser.test.ts` is the other half and
 * proves what the one site does.
 *
 * **Two independent clauses, because neither sees what the other does.** Clause A is keyed on the
 * launcher *name*, over every TypeScript file including tests, which is what backs AC-13's *no test
 * opens a real browser*. Clause B is keyed on the *shape* — a production module that both spawns and
 * reads the platform — and is what would catch a second launcher that never wrote the name. Either
 * alone has a hole the other closes.
 *
 * **The needle is `xdg-open` and not `open`, which is measured rather than chosen.** `open` is a
 * command of this product since this same ticket, and it is a quoted literal in sixteen files that
 * launch nothing — a scan keyed on it would report the registry, the help text and every test of
 * either. `xdg-open` is the discriminating half of the table and appears nowhere else in the
 * workspace. Clause B is what covers the launcher that spells only the other half.
 *
 * **The residual, stated rather than left to be found.** A second site that assembled its specifier
 * — joining two fragments, or reading a name out of configuration — is invisible to clause A, as it
 * is to every literal scan in this repository. Clause B closes that for a production module and not
 * for a test. The register below therefore refuses an *unused* entry as well as an unregistered
 * file, because a list that can only grow is a wish rather than a claim.
 */
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { coreSourceFiles, repoFile, repoRoot } from '../../test/corpus.js';

/** This folder, as `coreSourceFiles` keys it. */
const MODULE = 'browser/browser.ts';

/**
 * The launcher name clause A looks for, assembled rather than written.
 *
 * This file is inside its own corpus, so a literal here would make the scan report itself and the
 * register below would have to carry an entry excusing the guard — which is the exemption Q-0079's
 * round 2 found being used to excuse a real call. Assembling keeps this file genuinely clean, and
 * the assembly is asserted against the module's own text below so it cannot drift from the table it
 * describes.
 */
const LAUNCHER = ['xdg', 'open'].join('-');

/**
 * The files permitted to name the launcher, with why.
 *
 * On the {@link Record} shape the sibling registers in `packages/cli` use, so both directions fire:
 * a file naming it without an entry fails, and an entry for a file that has stopped naming it fails
 * too. Two entries, and neither is this guard.
 */
const LAUNCHES: Record<string, string> = {
  'packages/core/src/browser/browser.ts':
    'the primitive itself — the platform table, and the one spawn in the workspace that starts a browser',
  'packages/core/src/browser/browser.test.ts':
    'its behavioural half, which asserts the table per platform over an injected spawn and starts nothing',
  'packages/cli/src/open.test.ts':
    'Q-0126 AC-15 — a fixture for the warning `quorum open` renders, where the name is the payload of an `executable-unavailable` result rather than something spawned. Clause B is what covers that package for the real thing, and refuses it: no production module there may spawn at all',
};

/**
 * The production modules that both spawn a process and read the platform, with why — clause B.
 *
 * One entry. A second would be a second place deciding what to run from what machine it is on, which
 * is the shape a browser launcher has whatever it calls its executable.
 */
const PLATFORM_SPAWNERS: Record<string, string> = {
  'packages/core/src/browser/browser.ts':
    'the launcher table: one row per platform, and the row\'s absence is what answers `unsupported-platform`',
};

/**
 * The one package this walk does not enter, and the bound that costs — stated rather than implied.
 *
 * `packages/shared` is `@quorum/core`'s workspace **dependency**, so reading its source here would
 * mean declaring it as an input of this task, which is the edge's claim written a second time and
 * free to drift. `caught-failures.source.test.ts` states the same bound over the same package for
 * the same reason, and `turbo-inputs.test.ts` holds the other side of it — that core covers shared
 * by the edge and never by an input.
 *
 * **What that costs is exactly nothing here, and it is checkable rather than argued.** That package
 * is `@quorum/web`'s bundle dependency and its own suite asserts, over every one of its sources,
 * that none of them so much as names `child_process` — so a browser launcher cannot be there, and
 * the clause below reads that guard rather than taking this paragraph's word for it.
 */
const COVERED_ELSEWHERE = 'packages/shared';

/** Every TypeScript file under `dir`, at any depth, keyed by path from the repository root. */
function walk(dir: string): [string, string][] {
  const descend = (here: string, below: string): [string, string][] =>
    fs.readdirSync(here, { withFileTypes: true }).flatMap((entry) => {
      if (['node_modules', 'dist', '.turbo'].includes(entry.name)) return [];
      const key = below === '' ? entry.name : `${below}/${entry.name}`;
      if (`${dir}/${key}` === COVERED_ELSEWHERE) return [];
      if (entry.isDirectory()) return descend(path.join(here, entry.name), key);
      return /\.tsx?$/.test(entry.name)
        ? [[`${dir}/${key}`, fs.readFileSync(path.join(here, entry.name), 'utf8')] as [string, string]]
        : [];
    });
  return descend(path.join(repoRoot, dir), '');
}

/** Every TypeScript file the workspace carries — the two globs `pnpm-workspace.yaml` declares. */
const workspaceFiles = (): [string, string][] => [...walk('packages'), ...walk('apps')];

/** What ships: neither a test file nor a test helper beside one. */
const production = (): [string, string][] => workspaceFiles()
  .filter(([name]) => !/\.test\.tsx?$/.test(name) && !name.split('/').includes('test'));

/** Whether `text` writes the launcher as a quoted literal. */
const namesTheLauncher = (text: string): boolean =>
  text.includes(`'${LAUNCHER}'`) || text.includes(`"${LAUNCHER}"`);

/** Whether `text` both starts a process and decides something from the machine it is on. */
const spawnsByPlatform = (text: string): boolean =>
  text.includes('node:child_process') && /\b(?:process|os)\.platform\b/.test(text);

/** Everything wrong with `files` as a description of `allowed`, one sentence each. */
function offenders(
  files: readonly [string, string][],
  allowed: Record<string, string>,
  does: (text: string) => boolean,
  what: string,
): string[] {
  const problems: string[] = [];
  for (const [name, text] of files) {
    if (does(text) && allowed[name] === undefined) problems.push(`${name}: it ${what} and no entry says why it may`);
    if (!does(text) && allowed[name] !== undefined) problems.push(`${name}: its entry permits what the file does not do`);
  }
  for (const name of Object.keys(allowed)) {
    if (!files.some(([file]) => file === name)) problems.push(`${name}: an entry for a file that is not here`);
  }
  return problems;
}

/** The module's own text, which several clauses below read. */
const moduleText = (): string => {
  const found = coreSourceFiles().find(([name]) => name === MODULE)?.[1];
  if (found === undefined) throw new Error(`${MODULE} is not in the corpus — every clause below proves nothing`);
  return found;
};

describe('the workspace scan has a subject', () => {
  test('it reaches both globs, at a plausible size, and this guard is inside it', () => {
    const names = workspaceFiles().map(([name]) => name);
    // A floor rather than a count: this corpus grows every ticket, and what must fail is a walk
    // that collapsed rather than one that grew. Measured 2026-09-14 at 227 files.
    expect(names.length, `the corpus is ${String(names.length)} files, which is implausibly small`)
      .toBeGreaterThan(150);
    expect(names.some((name) => name.startsWith('packages/')), 'the packages glob contributed nothing').toBe(true);
    expect(names.some((name) => name.startsWith('apps/')), 'the apps glob contributed nothing').toBe(true);
    expect(names, 'this guard is outside its own scan, so it excuses itself by construction')
      .toContain('packages/core/src/browser/browser.source.test.ts');
    expect(names.sort()).toStrictEqual([...new Set(names)].sort());
    // The one package the walk does not enter is named, so the gap is a measurement rather than a
    // silence, and the remaining four packages plus the app ARE entered.
    expect(names.some((name) => name.startsWith(`${COVERED_ELSEWHERE}/`)), 'the excluded package was walked')
      .toBe(false);
    for (const entered of ['packages/cli/', 'packages/server/', 'packages/core/', 'apps/web/']) {
      expect(names.some((name) => name.startsWith(entered)), `${entered} was not walked`).toBe(true);
    }
    // And the production half is a real subset rather than the whole corpus or none of it, which is
    // what clause B rests on.
    expect(production().length).toBeGreaterThan(20);
    expect(production().length).toBeLessThan(names.length);
  });

  test('and the package it does not walk is covered by that package\'s own guard, which is read', () => {
    // The bound made checkable. `@quorum/shared`'s suite refuses `child_process` as an import
    // specifier in every one of its sources — a stronger claim than this scan makes about anything,
    // and the one that matters, because a launcher has to import it. Read rather than described,
    // which is the difference between a bound and a hope: delete that clause and this fails, naming
    // the package this walk stopped covering.
    //
    // **The needles are the clause's own mechanism and not the bare word**, which this test needed
    // the hard way: a first version asserted that the file contains `child_process` at all, and
    // deleting the guard left it green — the name also appears in prose and in a second list. A
    // check satisfied by an occurrence that is not its subject is the failure this repository
    // records most, met here inside the assertion written to close a gap.
    const sibling = repoFile(`${COVERED_ELSEWHERE}/src/index.test.ts`);
    expect(sibling, `${COVERED_ELSEWHERE} no longer refuses a child process among its importable builtins`)
      .toMatch(/BUILTINS\s*=\s*\[[^\]]*'child_process'/);
    expect(sibling, 'that list is no longer applied to what a source imports')
      .toContain('BUILTINS.includes(specifier)');
    expect(sibling, 'that clause no longer runs over every source of that package')
      .toContain('sharedSourceFiles()');
  });

  test('and the assembled needle is the table the module actually ships', () => {
    // Without this the scan could be looking for a string nothing uses, and clause A would be green
    // over nothing. Read out of the module rather than out of this file's constant.
    expect(moduleText(), `the module no longer names ${LAUNCHER}`).toContain(`'${LAUNCHER}'`);
    expect(namesTheLauncher(`const a = ['xdg', 'open'].join('-');`), 'an assembled name is invisible — the stated residual')
      .toBe(false);
  });
});

describe('AC-12 — one site launches a browser, across every package and every app', () => {
  test('clause A: exactly the registered files name the launcher, tests included', () => {
    expect(offenders(workspaceFiles(), LAUNCHES, namesTheLauncher, 'names a browser launcher')).toStrictEqual([]);
  });

  test('clause B: exactly one production module spawns by platform', () => {
    expect(offenders(production(), PLATFORM_SPAWNERS, spawnsByPlatform, 'spawns a process chosen by platform'))
      .toStrictEqual([]);
  });

  test('and each clause is reported by name, in both directions', () => {
    // Over copies rather than over the tree: the shipped workspace passes, and a clause that can
    // only be observed passing is not established (2026-08-29). Every failure below produces its own
    // sentence, so no one of them is shown red only by a neighbour (Q-0107).
    const planted: [string, string][] = [['apps/web/src/launch.ts', `spawn('${LAUNCHER}', [url]);`]];
    expect(offenders(planted, {}, namesTheLauncher, 'names a browser launcher'))
      .toStrictEqual(['apps/web/src/launch.ts: it names a browser launcher and no entry says why it may']);

    const stopped: [string, string][] = [['packages/core/src/browser/browser.ts', 'export const nothing = 1;']];
    expect(offenders(stopped, LAUNCHES, namesTheLauncher, 'names a browser launcher')).toStrictEqual([
      'packages/core/src/browser/browser.ts: its entry permits what the file does not do',
      'packages/core/src/browser/browser.test.ts: an entry for a file that is not here',
      'packages/cli/src/open.test.ts: an entry for a file that is not here',
    ]);

    // Clause B fires on the shape alone, which is the half that would see a second launcher spelling
    // only the other row of the table — the name this scan deliberately does not look for.
    const darwinOnly: [string, string][] = [[
      'packages/server/src/launch.ts',
      "import { spawn } from 'node:child_process';\nconst c = process.platform === 'darwin' ? 'op' + 'en' : '';",
    ]];
    expect(namesTheLauncher(darwinOnly[0][1]), 'clause A sees this one, so clause B proves nothing').toBe(false);
    expect(offenders(darwinOnly, {}, spawnsByPlatform, 'spawns a process chosen by platform'))
      .toStrictEqual(['packages/server/src/launch.ts: it spawns a process chosen by platform and no entry says why it may']);
  });

  test('the URL is spawned as an argument and no shell is asked for anywhere in the folder', () => {
    // The source half of "never composed into a command string"; `browser.test.ts` proves the
    // behaviour over a hostile URL. `spawn` is the one entry point taken, because `exec` and
    // `execSync` take a command LINE — a shell is what they are for, and that is the injection
    // surface *"`core` opens a URL, and the ninth folder is named for what it is about"*
    // (2026-09-14) clause 4 forbids.
    const text = moduleText();
    expect(text, 'the folder no longer imports the argument-based spawn')
      .toContain("import { spawn } from 'node:child_process';");
    for (const forbidden of ['execSync', 'execFileSync', 'exec(', 'shell:', 'spawnSync']) {
      expect(text.includes(forbidden), `${MODULE} must not contain ${forbidden}`).toBe(false);
    }
    // The URL reaches the spawn inside an array literal and is the only element of it.
    expect(text, 'the URL stopped being a single argv element').toContain('launch(command, [url])');
  });

  test('the launcher is detached and unreferenced, which its own docblock calls load-bearing', () => {
    // **The clause this file was missing.** `spawnLauncher`'s docblock says `detached` is "the
    // load-bearing option and it is not a tidy-up": without it the launcher — and on Linux any
    // browser it execs rather than hands off to — shares this process's group, so the Ctrl-C that
    // stops `quorum open` reaches a browser the operator is at that moment reading. `unref` follows
    // from it, this process not being held open by a child it has stopped waiting for.
    //
    // Measured before it was written: with both removed the whole workspace stayed green — 7/7
    // tasks forced, 0 cached — because the `LaunchSpawn` seam is `(command, args)` and carries no
    // options object, so no behavioural test can reach the real launcher's. That made the docblock
    // a claim nothing backed, which `.claude/rules/engineering.md` refuses, and it is a source fact
    // rather than a seam that was missing. Found by hand at Q-0126's chore gate, the cross-vendor
    // review having been handed a diff truncated 67,881 bytes before this folder began.
    const text = moduleText();
    expect(text, 'the launcher stopped being detached, so Ctrl-C would reach the browser')
      .toContain("detached: true");
    expect(text, 'the launcher stopped being unreferenced, so this process waits on a child it abandoned')
      .toContain('.unref();');
    // And the two are on the real launcher rather than anywhere in the file: the spawn options and
    // the call are asserted together, so moving either into a comment or a second function fails.
    expect(text, 'the spawn options are no longer the real launcher\'s')
      .toMatch(/spawn\(command, \[\.\.\.args\], \{ stdio: 'ignore', detached: true \}\)/);
  });

  test('the folder is exactly one source file, and nothing in it prints', () => {
    // The `adapters/` and `fanout/` rule at a ninth folder: a second file here would be a second
    // place that knows how to start a process, which is what "one exported primitive" forbids.
    const here = coreSourceFiles().filter(([name]) => name.startsWith('browser/')).map(([name]) => name);
    expect(here).toStrictEqual([MODULE]);
    const text = moduleText();
    for (const forbidden of ['console.', '\\x1b', '\\u001b', '✓', '✗']) {
      expect(text.includes(forbidden), `${MODULE} must not contain ${JSON.stringify(forbidden)}`).toBe(false);
    }
  });

  test('and it reaches no network and no secret — principle 1 widened by one item only', () => {
    // What decision *"`core` opens a URL, and the ninth folder is named for what it is about"*
    // (2026-09-14) clause 2 keeps: the enumeration gained a browser launch and the rule did not
    // move. A folder reaching the network here would be the widening read generally, which that
    // clause exists to refuse.
    const text = moduleText();
    for (const forbidden of ['node:http', 'node:https', 'fetch(', 'API_KEY', 'process.env']) {
      expect(text.includes(forbidden), `${MODULE} must not contain ${forbidden}`).toBe(false);
    }
  });
});
