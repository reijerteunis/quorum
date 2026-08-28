/** Q-0050 contract stub for the lossless single-consumer event channel. */
import type { Event } from '@quorum/shared';
import type { FinaliseAbandonment } from './types.js';
export interface EventSink { emit(event: Event): void; complete(error?: Error): void }
export function createEventChannel(_start: () => void, _finalise: FinaliseAbandonment): { stream: AsyncIterable<Event>; sink: EventSink } { throw new Error('Q-0050 contract stub'); }
