// The frame Q-0091 to Q-0094 build their commands on — argv, colour, the error paths and the exit
// table, plus the entry that dispatches them — and the commands themselves. The domain logic stays
// in `@quorum/core`, whose export surface Q-0096 opened; this package renders what that API returns
// and, since Q-0091, the two read-only commands are what do the rendering. No module here reads or
// writes a file: every read goes through `@quorum/core`.
export * from './argv.js';
export * from './colour.js';
export * from './commands.js';
export * from './exit.js';
export * from './fail.js';
export * from './lint.js';
export * from './main.js';
export * from './validate.js';
