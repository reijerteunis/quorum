# Architecture context

Read by the architect and the architecture reviewer. Everything here becomes a contract
downstream, so state only what is true in this repository; mark anything unverified.

## Shape of the repository
Directory layout and what each top-level area is for (apps, services, packages…).
Framework, language, runtime, package manager.

## Boundaries the architect must respect
Numbered rules: where business logic lives, how schema changes happen, who may import
whom, how user-facing strings, analytics events and auth guards are declared.

## Contract conventions (what solutioning must emit)
A table of contract kinds → format → example path (API: OpenAPI fragment; domain:
typed interface + stub; schema: migration skeleton in your tool's format; UI: prop types
and states; …). Tests in the red phase compile against these stubs.

## Roles for task fan-out
A table of role → directories it may write in → typical contracts. Must match the
`developer-<role>.md` files in `harness/roles/`.

## Testing and tooling
The exact commands: unit/integration, e2e, lint, typecheck. `harness.yaml → commands.test`
is what `integrate` runs; "green" means all of these pass.

## Things the reviewer should be suspicious of
Your project's recurring mistakes, stated bluntly.
