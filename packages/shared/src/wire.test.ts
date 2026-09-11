import { describe, expect, test } from 'vitest';

import { repoFile } from '../test/corpus.js';
import { wireMessageSchema } from './wire.js';

describe('AC-12/14 — browser-safe wire envelope', () => {
  test('accepts only the two envelope shapes and finite non-negative integer counts', () => {
    expect(wireMessageSchema.safeParse({ type: 'event', event: { anything: true } }).success).toBe(true);
    expect(wireMessageSchema.safeParse({ type: 'missed', count: 0 }).success).toBe(true);
    for (const count of ['7', -1, 1.5, Infinity]) expect(wireMessageSchema.safeParse({ type: 'missed', count }).success).toBe(false);
    expect(wireMessageSchema.safeParse({ type: 'heartbeat' }).success).toBe(false);
  });

  test('the web importer declares shared in the lockfile', () => {
    const lock = repoFile('pnpm-lock.yaml');
    const importer = lock.slice(lock.indexOf('  apps/web:'), lock.indexOf('\n  packages/', lock.indexOf('  apps/web:')));
    const scope = `@${'quorum'}/shared`;
    expect(importer).toContain(`'${scope}':`);
    expect(importer).toContain('workspace:*');
  });
});
