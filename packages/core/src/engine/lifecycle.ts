/** Q-0050 contract stubs for terminal persistence and non-terminal history events. */
import type { FinishFields, LifecycleContext, RunOutcome, RunStatus } from './types.js';
export async function finish(_context: LifecycleContext, _status: RunStatus, _fields: FinishFields = {}): Promise<RunOutcome> { throw new Error('Q-0050 contract stub'); }
export function outcome(_context: LifecycleContext, _status: RunStatus, _fields: FinishFields = {}): RunOutcome { throw new Error('Q-0050 contract stub'); }
export async function recordEvent(_context: LifecycleContext, _event: string, _fields: FinishFields = {}): Promise<void> { throw new Error('Q-0050 contract stub'); }
