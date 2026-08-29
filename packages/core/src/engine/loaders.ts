/** Q-0050 contract stubs for loaders and focused pure helpers. */
import type { Flow, Role } from '@quorum/shared';
export function loadFlow(_file: string): Flow { throw new Error('Q-0050 contract stub'); }
export function loadFlowByName(_name: string, _harnessDir: string): Flow { throw new Error('Q-0050 contract stub'); }
export function loadRole(_name: string | null | undefined, _harnessDir: string): Role { throw new Error('Q-0050 contract stub'); }
export function interpolate(_template: string, _values: Readonly<Record<string, unknown>>): string { throw new Error('Q-0050 contract stub'); }
export function writesOf(_step: Readonly<Record<string, unknown>>): readonly string[] { throw new Error('Q-0050 contract stub'); }
export function reviewRound(_ticketDir: string): number { throw new Error('Q-0050 contract stub'); }
