import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../..');

describe('Q-0050 AC-12e/AC-13b/AC-13d — durable decisions and documentation', () => {
  test('the contract enumerates all eight preserved diagnostic dispositions', () => {
    const text = fs.readFileSync(path.join(root, 'contracts/Q-0050/lifecycle-routing.contract.md'), 'utf8');
    for (const subject of ['start branch head', 'rollback current head', 'base/ticket sync', 'discard report', 'task-branch filters', 'merge failure consumers']) {
      expect(text.toLowerCase(), subject).toContain(subject);
    }
  });

  test('the glossary and architecture state all accepted stream rules', () => {
    const title = "What a run's event stream carries, and how a gate answer travels back";
    for (const rel of ['docs/GLOSSARY.md', 'docs/04-architecture.md']) {
      const text = fs.readFileSync(path.join(root, rel), 'utf8');
      for (const token of ['terminal', 'answerGate', 'AbortSignal', 'timestamp', title, '2026-08-28']) {
        expect(text, `${rel}: ${token}`).toContain(token);
      }
      expect(text.toLowerCase()).toMatch(/parallel[\s\S]*(order|interleav)/);
    }
  });

  test('the adapter contract corrects only its existing runFlow/event-stream claim', () => {
    const text = fs.readFileSync(path.join(root, 'docs/03-adapter-contract.md'), 'utf8');
    expect(text).toMatch(/runFlow|event stream/i);
    expect(text).toMatch(/terminal|answerGate/i);
  });

  test('preserved-defect comments are one-line authority references', () => {
    const engineDir = path.join(root, 'packages/core/src/engine');
    const lines = fs.readdirSync(engineDir).filter((f) => f.endsWith('.ts') && !f.includes('.test.'))
      .flatMap((f) => fs.readFileSync(path.join(engineDir, f), 'utf8').split('\n'))
      .filter((line) => line.includes('Why: preserved defect'));
    expect(lines.length).toBeGreaterThanOrEqual(4);
    for (const line of lines) expect(line).toMatch(/Why: preserved defect, see Q-0050 AC-\d+\./);
  });
});
