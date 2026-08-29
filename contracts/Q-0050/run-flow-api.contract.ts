/** Compile-time contract mirrored by the production-path stubs for Q-0050. */
import type { Event, Flow, GateAnswerEnvelope, GateQuestionEvent, ProjectConfig, Role, TicketHistoryEntry } from '@quorum/shared';
import type { Backlog, TicketRecord } from '../../packages/core/src/backlog/backlog.js';
import type { Project } from '../../packages/core/src/backlog/project.js';
export type RunStatus = 'completed' | 'regressed' | 'aborted' | 'failed' | 'interrupted';
export type StepResult = { goto: string; counter: string; limit: number } | { abort: true } | null;
export type AnswerGate = (question: GateQuestionEvent) => Promise<GateAnswerEnvelope>;
export interface RunFlowOptions { ticket: TicketRecord; flow: Flow; project: Project; backlog: Backlog; dry?: boolean; auto?: boolean; answerGate?: AnswerGate; signal?: AbortSignal }
export type EmitEvent = (event: Event) => void;
export type FinaliseAbandonment = () => Promise<void>;
export type BranchHeadReader = (repoDir: string, branch: string) => string | null;
export type BranchResetter = (repoDir: string, branch: string, revision: string) => void;
export interface RunPersistence { writeTicket(ticket: TicketRecord): void; appendLog(ticket: TicketRecord, line: string): void; recordOccurrenceEvent(ticket: TicketRecord, stage: string, event: string, cost: number): void | Promise<void>; finaliseActiveOccurrences(status: 'failed' | 'interrupted', cause: string): void | Promise<void> }
export interface RunStats { cost: number; tokens: number; unpriced: number }
export interface RunContext { ticket: TicketRecord; flow: Flow; repoDir: string; harnessDir: string; config: ProjectConfig; backlog: Backlog; runId: number; counters: Record<string, number>; vars: Record<string, unknown>; stats: RunStats; dry: boolean; auto: boolean; emit: EmitEvent; answerGate?: AnswerGate; signal?: AbortSignal; persistence: RunPersistence }
export interface RegressionFields { targetFlow: string; stageBefore: string; stageAfter: string; counter: string; count: number; limit: number; remaining: number }
export interface NonRegressionRunOutcome { status: 'completed' | 'aborted' | 'failed' | 'interrupted'; stage: string; cost: number; runId: number }
export interface RegressionRunOutcome extends RegressionFields { status: 'regressed'; stage: string; cost: number; runId: number }
export type RunOutcome = NonRegressionRunOutcome | RegressionRunOutcome;
export interface RoutingContext extends RunContext { loadNamedFlow(name: string, harnessDir: string): Flow; finishRun(stage: string, status: RunStatus, note: string | null, fields?: RegressionFields): Promise<RunOutcome> }
export interface LifecycleContext extends RunContext { branchHeadAtStart: string | null; readBranchHead: BranchHeadReader; resetBranch: BranchResetter }
export declare function runFlow(options: RunFlowOptions): AsyncIterable<Event>;
export { FlowError } from '../../packages/core/src/lint/lint.js';
export declare function loadFlow(file: string): Flow;
export declare function loadFlowByName(name: string, harnessDir: string): Flow;
export declare function loadRole(name: string | null | undefined, harnessDir: string): Role;
export declare function interpolate(template: string, values: Readonly<Record<string, unknown>>): string;
export declare function writesOf(step: Readonly<Record<string, unknown>>): readonly string[];
export declare function reviewRound(ticketDir: string): number;
export declare function askGate(request: GateQuestionEvent, context: RoutingContext): Promise<'advance' | 'retry' | 'abort'>;
export declare function runStep(step: Readonly<Record<string, unknown>>, context: RoutingContext): Promise<StepResult>;
export declare function handleFail(step: Readonly<Record<string, unknown>>, context: RoutingContext): Promise<StepResult>;
export declare function finish(context: LifecycleContext, stage: string, status: RunStatus, note: string | null, fields?: RegressionFields): Promise<RunOutcome>;
export declare function outcome(context: LifecycleContext, before: string, after: string, status: string, cost: number | null): TicketHistoryEntry;
export declare function recordEvent(context: LifecycleContext, stage: string, status: string, cost: number | null): Promise<void>;
