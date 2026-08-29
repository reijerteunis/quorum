/** Q-0050 contract stubs for routing, gates, and bounded failure handling. */
import type { GateQuestionEvent } from '@quorum/shared';
import type { RoutingContext, StepResult } from './types.js';
export async function askGate(_request: GateQuestionEvent, _context: RoutingContext): Promise<'advance' | 'retry' | 'abort'> { throw new Error('Q-0050 contract stub'); }
export async function runStep(_step: Readonly<Record<string, unknown>>, _context: RoutingContext): Promise<StepResult> { throw new Error('Q-0050 contract stub'); }
export async function handleFail(_step: Readonly<Record<string, unknown>>, _context: RoutingContext): Promise<StepResult> { throw new Error('Q-0050 contract stub'); }
