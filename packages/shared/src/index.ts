// The package every other package imports, and the one that imports none of them. Declarations
// only: schemas, the types inferred from them, constants and pure functions over strings. No file
// under `src/` reads the filesystem, spawns anything or looks at the environment — apps/web will
// generate the flow editor's form from `flowSchema` (docs/04-architecture.md:31), so this has to
// be safe to put in a browser bundle.
export * from './constants.js';
export * from './containment.js';
export * from './events.js';
export * from './flow.js';
export * from './project.js';
export * from './role.js';
export * from './stages.js';
export * from './step-output.js';
export * from './ticket.js';
