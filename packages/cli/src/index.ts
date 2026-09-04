// The frame Q-0091 to Q-0094 and Q-0099 build their commands on — argv, colour, the error paths and
// the exit table, plus the entry that dispatches them — and the commands themselves. The domain
// logic stays in `@quorum/core`, whose export surface Q-0096 opened; this package renders what that
// API returns and, since Q-0099, eight commands are what do the rendering: `lint`, `validate`,
// `runs`, `board` and `adapters` read, `init` and `ticket` write where the user pointed them, and
// `run` drives a flow. No module here reads or writes a file: every read, every write and every
// spawn goes through `@quorum/core`.
//
// `gate.ts` and `trace.ts` are `run`'s two halves rather than commands of their own — the reader a
// human answers at a gate, and the renderer that turns one `Event` into one line — and they are
// separate modules because M3's server wants both without the command around them.
//
// Every command module is re-exported, which is a rule rather than a habit — `frame.source.test.ts`
// derives the command modules from `COMMANDS` and requires each to appear here. `runs.js` was absent
// until Q-0093 by omission rather than by decision (Q-0093 OQ-4), which is exactly what a derived
// check stops happening again.
export * from './adapters.js';
export * from './argv.js';
export * from './board.js';
export * from './colour.js';
export * from './commands.js';
export * from './exit.js';
export * from './fail.js';
export * from './gate.js';
export * from './init.js';
export * from './lint.js';
export * from './main.js';
export * from './run.js';
export * from './runs.js';
export * from './ticket.js';
export * from './trace.js';
export * from './validate.js';
