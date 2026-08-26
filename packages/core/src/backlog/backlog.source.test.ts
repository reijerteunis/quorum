// Q-0043: the criteria that are properties of the code rather than of its behaviour.
//
// "there is no second stage list", "nothing on a read path calls zod", "no private field" and "the
// entry point is untouched" cannot be observed at run time — and each is exactly what a later
// module, or a well-meaning tidy-up, breaks silently. The byte pin in particular fails at chore's
// `integrate` rather than at review, after both agents have been paid, so it is asserted here where
// it fails in seconds instead.
import { describe, expect, test } from 'vitest';

import * as backlogModule from './backlog.js';
import * as projectModule from './project.js';
import { coreSourceFiles, repoFile } from '../../test/corpus.js';

/**
 * Corpus keys are whole paths below `src`, so a same-named file in another folder can never answer
 * for one of these two (Q-0064).
 */
const BACKLOG_SOURCE = 'backlog/backlog.ts';
const PROJECT_SOURCE = 'backlog/project.ts';

const source = (name: string): string => {
  const found = coreSourceFiles().find(([file]) => file === name);
  if (!found) throw new Error(`corpus missing: packages/core/src/${name} does not exist`);
  return found[1];
};

describe('AC-1 — two modules, exactly this surface, and packages/core/src/index.ts untouched', () => {
  test('backlog.ts exports the two functions and the class, and nothing else', () => {
    expect(Object.keys(backlogModule).sort()).toStrictEqual(['Backlog', 'parseFrontmatter', 'renderFrontmatter']);
    expect(typeof backlogModule.Backlog).toBe('function');
    expect(typeof backlogModule.parseFrontmatter).toBe('function');
    expect(typeof backlogModule.renderFrontmatter).toBe('function');
  });

  test('project.ts exports the two functions and the error class, and nothing else', () => {
    expect(Object.keys(projectModule).sort()).toStrictEqual(['ProjectNotFoundError', 'findProject', 'loadProject']);
    expect(projectModule.ProjectNotFoundError.prototype).toBeInstanceOf(Error);
  });

  test('neither module declares a second stage vocabulary, a Ticket type or a ticket schema', () => {
    // All four come from the one package that owns them. A second spelling anywhere under
    // packages/core/src is what this goes red on.
    for (const [name, text] of coreSourceFiles()) {
      expect(text.includes("'qa-passed'"), `${name} must not declare its own stage list`).toBe(false);
      expect(text.includes('ticketSchema = '), `${name} must not declare its own ticket schema`).toBe(false);
      expect(/\binterface Ticket\b|\btype Ticket =/.test(text), `${name} must not declare its own Ticket type`).toBe(false);
    }
  });

  test('the two modules take their vocabulary from shared and import nothing from spike', () => {
    const backlog = source(BACKLOG_SOURCE);
    expect(backlog).toContain('integrationBranch');
    expect(backlog).toContain('RUNS_LOG_FILE');
    // The branch shape and the log filename belong to shared; a second spelling would drift.
    expect(backlog.includes('harness/${'), 'the branch shape belongs to shared').toBe(false);
    expect(backlog.includes("'runs.log'"), 'the log filename belongs to shared').toBe(false);
    for (const [name, text] of coreSourceFiles()) {
      for (const specifier of [...text.matchAll(/\b(?:from|import)\s+['"]([^'"\n]+)['"]/g)].map((m) => m[1])) {
        expect(specifier.includes('spike'), `${name} imports ${specifier}`).toBe(false);
      }
    }
  });

  test('packages/core/src/index.ts still holds Q-0041\'s exact bytes', () => {
    // Deliberate: this ticket adds no public re-export (OQ-3). Its consumers — Q-0050, Q-0052,
    // Q-0053 — are in this package and import ./backlog.js and ./project.js directly, and
    // packages/shared/src/index.test.ts:52-53 pins this file byte for byte.
    expect(repoFile('packages/core/src/index.ts')).toBe("export const name = '@quorum/core';\n");
  });
});

describe('AC-4 — no read path runs the object through zod', () => {
  test('backlog.ts calls neither parse nor safeParse on the ticket schema', () => {
    const text = source(BACKLOG_SOURCE);
    expect(text.includes('ticketSchema.parse('), 'a parse on read returns a reordered copy').toBe(false);
    expect(text.includes('.safeParse('), 'validating on read is a behaviour change, not a port').toBe(false);
  });

  test('the ticket schema is imported for its TYPE only', () => {
    const text = source(BACKLOG_SOURCE);
    expect(text).toContain("import type { Ticket } from '@quorum/shared'");
    expect(text.includes('ticketSchema,'), 'the schema itself is not needed here').toBe(false);
  });
});

describe('AC-5 — no private field, because --dry is Object.create(backlog)', () => {
  test('backlog.ts declares no # field and reaches for none', () => {
    const text = source(BACKLOG_SOURCE);
    expect(text.includes('this.#'), 'a private field makes every inherited method throw').toBe(false);
    expect(/^\s*(?:static\s+)?#[A-Za-z_]/m.test(text), 'backlog.ts must declare no # field').toBe(false);
  });

  test('root is declared readonly and public', () => {
    expect(source(BACKLOG_SOURCE)).toContain('readonly root: string;');
  });
});

describe('AC-10 — the lift does not exit the run or write to the terminal', () => {
  test('project.ts contains no exit and no terminal write', () => {
    const text = source(PROJECT_SOURCE);
    expect(text.includes('process.exit'), 'a library may not end its host').toBe(false);
    expect(text.includes('console.'), 'what a command prints is Q-0010\'s, not core\'s').toBe(false);
    expect(text).toContain('ProjectNotFoundError');
  });

  test('the sentence is the CLI\'s, byte for byte', () => {
    expect(source(PROJECT_SOURCE)).toContain('no harness/harness.yaml found — run `harness init` in your repo');
  });
});

describe('AC-11 — the project config is declared once, in shared, and validated nowhere', () => {
  test('core imports the type and declares no config shape of its own', () => {
    const text = source(PROJECT_SOURCE);
    expect(text).toContain("import type { ProjectConfig } from '@quorum/shared'");
    expect(text.includes('projectConfigSchema.parse('), 'loadProject does not validate').toBe(false);
    expect(text.includes('.safeParse('), 'loadProject does not validate').toBe(false);
    for (const [name, text2] of coreSourceFiles()) {
      expect(text2.includes('z.object('), `${name} must not declare a schema — they live in shared`).toBe(false);
      expect(text2.includes("from 'zod'"), `${name} must not import zod`).toBe(false);
    }
  });

  test('shared declares it, exports it from the entry point, and takes no new dependency', () => {
    expect(repoFile('packages/shared/src/index.ts')).toContain("export * from './project.js';");
    const shared = repoFile('packages/shared/src/project.ts');
    expect(shared).toContain('export const projectConfigSchema');
    expect(shared.includes('.default('), 'a default invents state the file did not carry').toBe(false);
    expect(shared.includes('.catch('), 'a catch invents state the file did not carry').toBe(false);
    const pkg = JSON.parse(repoFile('packages/shared/package.json')) as { dependencies: Record<string, string> };
    expect(Object.keys(pkg.dependencies)).toStrictEqual(['zod']);
  });
});

describe('AC-12 — one new dependency, and it is the emitter the format is defined by', () => {
  test('core declares exactly shared, yaml and the two ajv packages', () => {
    // The set stays exhaustive, which is the point of the assertion: a stray dependency still turns
    // it red. `ajv` and `ajv-formats` were added by Q-0045, whose AC-1 requires them at exactly the
    // versions spike/package.json already carries, and whose 2026-08-22 DECISIONS entry carries
    // their justification. Q-0043's own answer — yaml and nothing else — is unchanged.
    const pkg = JSON.parse(repoFile('packages/core/package.json')) as {
      dependencies: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    expect(pkg.dependencies).toStrictEqual({
      '@quorum/shared': 'workspace:*', ajv: '^8.20.0', 'ajv-formats': '^3.0.1', yaml: '^2.9.0',
    });
    expect(pkg.devDependencies).toBeUndefined();
  });
});
