/** Q-0050 contract stub: development replaces this file without changing its public boundary. */
import type { Event, Flow } from '@quorum/shared';
import type { TicketRecord } from '../backlog/backlog.js';

export { FlowError } from '../lint/lint.js';
export interface GateQuestion { type: 'gate'; gateId: string; kind: string; reason: string; ticketDir: string; retry?: string }
export interface GateAnswerEnvelope { gateId: string; answer: 'advance' | 'retry' | 'abort' }
export type AnswerGate = (question: GateQuestion) => Promise<GateAnswerEnvelope>;
export interface RunFlowOptions { ticket: TicketRecord; flow: Flow; repoDir: string; harnessDir: string; dry?: boolean; auto?: boolean; answerGate?: AnswerGate; signal?: AbortSignal }
export type EmitEvent = (event: Event) => void;
export type FinaliseAbandonment = () => Promise<void>;
export type BranchHeadReader = (repoDir: string, branch: string) => string | null;
export type BranchResetter = (repoDir: string, branch: string, revision: string) => void;
export interface RunPersistence { writeTicket(ticket: TicketRecord): void; appendLog(ticket: TicketRecord, line: string): void; recordOccurrenceEvent(ticket: TicketRecord, stage: string, event: string, cost: number): void | Promise<void>; finaliseActiveOccurrences(status: 'failed' | 'interrupted', cause: string): void | Promise<void> }
export interface RunStats { cost: number; tokens: number; unpriced: number }
export interface RunContext { ticket: TicketRecord; flow: Flow; repoDir: string; harnessDir: string; runId: number; counters: Record<string, number>; vars: Record<string, unknown>; stats: RunStats; dry: boolean; auto: boolean; emit: EmitEvent; answerGate?: AnswerGate; signal?: AbortSignal; persistence: RunPersistence }
export interface RoutingContext extends RunContext { loadNamedFlow(name: string, harnessDir: string): Flow; finishRun(status: RunStatus, fields?: FinishFields): Promise<RunOutcome> }
export interface LifecycleContext extends RunContext { branchHeadAtStart: string | null; readBranchHead: BranchHeadReader; resetBranch: BranchResetter }
export type RunStatus = 'completed' | 'regressed' | 'aborted' | 'failed' | 'interrupted';
export interface FinishFields { readonly [key: string]: string | number | undefined }
export interface RunOutcome extends Readonly<Record<string, unknown>> { status: RunStatus; stage: string; cost: number; runId: number }
