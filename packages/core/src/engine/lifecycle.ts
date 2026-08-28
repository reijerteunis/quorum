/** Q-0050 contract stubs for terminal persistence and non-terminal history events. */
import type { RunStatus } from './types.js';
export interface FinishFields { readonly [key: string]: string | number | undefined }
export async function finish(_context: unknown, _status: RunStatus, _fields: FinishFields = {}): Promise<Readonly<Record<string, unknown>>> { throw new Error('Q-0050 contract stub'); }
export function outcome(_context: unknown, _status: RunStatus, _fields: FinishFields = {}): Readonly<Record<string, unknown>> { throw new Error('Q-0050 contract stub'); }
export async function recordEvent(_context: unknown, _event: string, _fields: FinishFields = {}): Promise<void> { throw new Error('Q-0050 contract stub'); }
