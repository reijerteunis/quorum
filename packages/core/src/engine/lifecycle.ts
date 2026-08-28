/** Q-0050 contract stubs for terminal persistence and non-terminal history events. */
import type { TicketHistoryEntry } from '@quorum/shared';
import type { LifecycleContext, RegressionFields, RunOutcome, RunStatus } from './types.js';
export async function finish(_context: LifecycleContext, _stage: string, _status: RunStatus, _note: string | null, _fields?: RegressionFields): Promise<RunOutcome> { throw new Error('Q-0050 contract stub'); }
export function outcome(_context: LifecycleContext, _before: string, _after: string, _status: string, _cost: number | null): TicketHistoryEntry { throw new Error('Q-0050 contract stub'); }
export async function recordEvent(_context: LifecycleContext, _stage: string, _status: string, _cost: number | null): Promise<void> { throw new Error('Q-0050 contract stub'); }
