// The frame Q-0091 to Q-0094 build their commands on: argv, colour, the error paths and the exit
// table, plus the entry that dispatches them. No command is implemented here and nothing in this
// package reads or writes a file — the domain logic is in `@quorum/core`, which this package
// declares as a dependency and which does not resolve until Q-0096 opens its export surface.
export * from './argv.js';
export * from './colour.js';
export * from './commands.js';
export * from './exit.js';
export * from './fail.js';
export * from './main.js';
