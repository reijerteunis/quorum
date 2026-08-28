/** Q-0050 contract stubs for routing, gates, and bounded failure handling. */
import type { GateQuestion, RoutingContext } from './types.js';
export async function askGate(_request: GateQuestion, _context: RoutingContext): Promise<'advance' | 'retry' | 'abort'> { throw new Error('Q-0050 contract stub'); }
export async function runStep(_step: Readonly<Record<string, unknown>>, _context: RoutingContext): Promise<unknown> { throw new Error('Q-0050 contract stub'); }
export async function handleFail(_step: Readonly<Record<string, unknown>>, _context: RoutingContext): Promise<unknown> { throw new Error('Q-0050 contract stub'); }
