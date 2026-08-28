/** Compile-time contract mirrored by the production-path stubs for Q-0050. */
import type { Event, Flow, Role } from '@quorum/shared';
import type { TicketRecord } from '../../packages/core/src/backlog/backlog.js';
export interface ContractGateQuestionEvent { type: 'gate'; gateId: string; kind: string; reason: string; ticketDir: string; retry?: string }
export interface ContractGateAnswerEnvelope { gateId: string; answer: 'advance' | 'retry' | 'abort' }
export type RunStatus = 'completed' | 'regressed' | 'aborted' | 'failed' | 'interrupted';
export type AnswerGate = (question: ContractGateQuestionEvent) => Promise<ContractGateAnswerEnvelope>;
export interface RunFlowOptions { ticket: TicketRecord; flow: Flow; repoDir: string; harnessDir: string; dry?: boolean; auto?: boolean; answerGate?: AnswerGate; signal?: AbortSignal }
export type EmitEvent = (event: Event) => void;
export type FinaliseAbandonment = () => Promise<void>;
export type BranchHeadReader = (repoDir: string, branch: string) => string | null;
export type BranchResetter = (repoDir: string, branch: string, revision: string) => void;
export interface RunPersistence { writeTicket(ticket: TicketRecord): void; appendLog(ticket: TicketRecord, line: string): void; recordOccurrenceEvent(ticket: TicketRecord, stage: string, event: string, cost: number): void | Promise<void>; finaliseActiveOccurrences(status: 'failed' | 'interrupted', cause: string): void | Promise<void> }
export interface RunStats { cost: number; tokens: number; unpriced: number }
export interface RunContext { ticket: TicketRecord; flow: Flow; repoDir: string; harnessDir: string; runId: number; counters: Record<string, number>; vars: Record<string, unknown>; stats: RunStats; dry: boolean; auto: boolean; emit: EmitEvent; answerGate?: AnswerGate; signal?: AbortSignal; persistence: RunPersistence }
export interface FinishFields { readonly [key: string]: string | number | undefined }
export interface RunOutcome extends Readonly<Record<string, unknown>> { status: RunStatus; stage: string; cost: number; runId: number }
export interface RoutingContext extends RunContext { loadNamedFlow(name: string, harnessDir: string): Flow; finishRun(status: RunStatus, fields?: FinishFields): Promise<RunOutcome> }
export interface LifecycleContext extends RunContext { branchHeadAtStart: string | null; readBranchHead: BranchHeadReader; resetBranch: BranchResetter }
export declare function runFlow(options: RunFlowOptions): AsyncIterable<Event>;
export { FlowError } from '../../packages/core/src/lint/lint.js';
export declare function loadFlow(file: string): Flow;
export declare function loadFlowByName(harnessDir: string, name: string): Flow;
export declare function loadRole(harnessDir: string, name?: string | null): Role;
export declare function interpolate(template: string, values: Readonly<Record<string, unknown>>): string;
export declare function writesOf(step: Readonly<Record<string, unknown>>): readonly string[];
export declare function reviewRound(ticketDir: string): number;
export declare function askGate(request: ContractGateQuestionEvent, context: RoutingContext): Promise<'advance' | 'retry' | 'abort'>;
export declare function runStep(step: Readonly<Record<string, unknown>>, context: RoutingContext): Promise<unknown>;
export declare function handleFail(step: Readonly<Record<string, unknown>>, context: RoutingContext): Promise<unknown>;
export declare function finish(context: LifecycleContext, status: RunStatus, fields?: FinishFields): Promise<RunOutcome>;
export declare function outcome(context: LifecycleContext, status: RunStatus, fields?: FinishFields): RunOutcome;
export declare function recordEvent(context: LifecycleContext, event: string, fields?: FinishFields): Promise<void>;
