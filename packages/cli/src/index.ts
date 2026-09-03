// The frame Q-0091 to Q-0094 build their commands on — argv, colour, the error paths and the exit
// table, plus the entry that dispatches them — and the commands themselves. The domain logic stays
// in `@quorum/core`, whose export surface Q-0096 opened; this package renders what that API returns
// and, since Q-0093, five commands are what do the rendering: `lint` and `validate` read, `runs`
// reads, and `init` and `ticket` write where the user pointed them. No module here reads or writes a
// file: every read, every write and every spawn goes through `@quorum/core`.
//
// Every command module is re-exported, which is a rule rather than a habit — `frame.source.test.ts`
// derives the command modules from `COMMANDS` and requires each to appear here. `runs.js` was absent
// until Q-0093 by omission rather than by decision (Q-0093 OQ-4), which is exactly what a derived
// check stops happening again.
export * from './argv.js';
export * from './colour.js';
export * from './commands.js';
export * from './exit.js';
export * from './fail.js';
export * from './init.js';
export * from './lint.js';
export * from './main.js';
export * from './runs.js';
export * from './ticket.js';
export * from './validate.js';
