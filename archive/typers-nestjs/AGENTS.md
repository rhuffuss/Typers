# Typers NestJS compatibility laboratory

Read `README.md` and `docs/architecture.md` before changing the application.
Documentation is Spanish; code and public identifiers are English.

This repository is a NestJS reference application for testing Typers. Keep the
normal application valid standard TypeScript, ESM and pnpm. Use Nest CLI for
generation and Vitest for tests. Use explicit `.js` relative imports, real Nest
decorators and runtime metadata. Do not hide compiler incompatibilities through
a silent fallback to another compiler.

The owner chose maximum documentation coverage: Express main application,
alternative executable labs, PostgreSQL with TypeORM, Docker Compose profiles.
Keep optional services out of the default in-memory test run. Every implemented
chapter needs identifiable source, a reproducible command and meaningful
behavioral evidence. Planned, implemented and verified are different states.

Validate changes with the relevant tests, build, typecheck and lint. Tests must
close apps, sockets and database/broker clients. Integration tests use real
services. External account requirements stay explicit in the coverage matrix.
Do not claim universal NestJS or Typers compatibility from this corpus.

The owner also requires substantial business logic and broad TypeScript variety.
Build meaningful rules, workflows, invariants and failure cases. Use functional,
object-oriented, declarative and asynchronous styles where they clarify an actual
domain scenario. Exercise advanced types with positive and negative compiler
contracts, and pair erased type guarantees with runtime boundary validation.
Document which language features each case exercises. Preserve standard TS/ESM
as the reference; no claim of exhaustive language coverage or Typers support.

The API inventory is a separate dimension from chapter coverage. After changing
Nest usage or dependencies, review `docs/nest-api-evidence.json`, regenerate with
`pnpm api:inventory` and run `pnpm api:check`. Only explicit behavior and named
assertions justify verified cases; an import is not coverage. Language profiles
that need standard decorators or TSX belong in isolated fixtures, preserving the
root Nest legacy decorator and ESM configuration.

The owner designated this repository as the ongoing development, validation and
demonstration corpus for Typers. Every compiler/runtime/adapter increment must
add or update readable examples and observable contracts here, alongside the
native compiler's own tests. Read `docs/typers-features.md` and run the relevant
`pnpm demo:typers` profile with explicitly built local tarballs. Keep the root
application and its official TypeScript dependency as the standard reference.
The owner clarified that working Nest applications using Typers must also be
available as application code. `apps/typers/src` contains the running commerce
application, with modules, services, repositories, controllers and Swagger.
`pnpm start:typers` builds it natively and starts its server. `fixtures/typers`
continues to hold compiler tests, not the only examples of application usage.
Both directories have explicit configurations and are excluded from the root
TypeScript reference check. Only the native Typers compiler may compile their
experimental syntax. A Vitest transform is
not evidence of Typers emission. Preserve hashes, diagnostics and unsupported
cases; use a separate report for selected tests so global evidence is not lost.
