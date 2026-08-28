/** Q-0050 contract stub: development replaces this file without changing its public boundary. */
import type { Event } from '@quorum/shared';
export { FlowError } from '../lint/lint.js';
export interface GateQuestion { type: 'gate'; gateId: string; kind: string; reason: string; ticketDir: string; retry?: string }
export interface GateAnswerEnvelope { gateId: string; answer: 'advance' | 'retry' | 'abort' }
export type AnswerGate = (question: GateQuestion) => Promise<GateAnswerEnvelope>;
export interface RunFlowOptions { ticket: { dir: string; meta: { id: string; stage: string; iterations?: Record<string, number>; history?: readonly unknown[] } }; flow: { name: string; consumes: string; produces: string; file: string; steps: readonly unknown[] }; repoDir: string; harnessDir: string; dry?: boolean; auto?: boolean; answerGate?: AnswerGate; signal?: AbortSignal }
export type EmitEvent = (event: Event) => void;
export type FinaliseAbandonment = () => Promise<void>;
export type BranchHeadReader = (branch: string) => string | null;
export interface RoutingContext { counters: Record<string, number>; vars: Record<string, unknown>; dry?: boolean; auto?: boolean; emit?: EmitEvent; answerGate?: AnswerGate; signal?: AbortSignal }
export type RunStatus = 'completed' | 'regressed' | 'aborted' | 'failed' | 'interrupted';
