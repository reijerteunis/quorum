import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

import { wireMessageSchema } from './wire.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

describe('AC-12/14 — browser-safe wire envelope', () => {
  test('accepts only the two envelope shapes and finite non-negative integer counts', () => {
    expect(wireMessageSchema.safeParse({ type: 'event', event: { anything: true } }).success).toBe(true);
    expect(wireMessageSchema.safeParse({ type: 'missed', count: 0 }).success).toBe(true);
    for (const count of ['7', -1, 1.5, Infinity]) expect(wireMessageSchema.safeParse({ type: 'missed', count }).success).toBe(false);
    expect(wireMessageSchema.safeParse({ type: 'heartbeat' }).success).toBe(false);
  });

  test('the web importer declares shared in the lockfile', () => {
    const lock = fs.readFileSync(path.join(ROOT, 'pnpm-lock.yaml'), 'utf8');
    const importer = lock.slice(lock.indexOf('  apps/web:'), lock.indexOf('\n  packages/', lock.indexOf('  apps/web:')));
    const scope = `@${'quorum'}/shared`;
    expect(importer).toContain(`'${scope}':`);
    expect(importer).toContain('workspace:*');
  });
});
