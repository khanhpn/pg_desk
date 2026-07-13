# Production Code Documentation Design

## Goal

Document the production TypeScript and TSX code so maintainers can understand each important unit's purpose, inputs, outputs, side effects, and failure behavior without first reading its implementation.

## Scope

Documentation applies to production code under `src/` and `electron/`.

The following files are excluded:

- Unit and component tests (`*.test.ts`, `*.test.tsx`)
- End-to-end tests
- Build and test configuration
- Generated declarations and declarations whose types are already self-explanatory

No runtime behavior, public contract, data flow, styling, or architecture will change as part of this work.

## Documentation Standard

Use English TSDoc blocks (`/** ... */`) to match the codebase language and TypeScript tooling.

Document:

- Exported functions, React components, custom hooks, services, IPC registration functions, and utility functions.
- Internal helpers that contain business rules, SQL construction, persistence behavior, state transitions, transaction handling, data conversion, or non-obvious error handling.
- Important exported types and fields when their role or invariant is not clear from the type name.

Each applicable function block must contain:

- A concise statement of purpose.
- One `@param` entry for every function parameter, including callback contracts when relevant.
- An `@returns` entry describing the returned value or promise result. Functions returning `void` only need `@returns` when the absence of a value or the side-effect completion contract needs clarification.
- An `@throws` entry when errors intentionally propagate to the caller.
- A side-effect or lifecycle note when the function mutates React state, local storage, Electron state, files, PostgreSQL state, or IPC registrations.

React component documentation will describe the rendered responsibility and its props as one props object unless individual prop behavior is non-obvious. Custom hooks will describe state ownership, external effects, accepted options, and the returned controller/state object.

## Comment Quality Rules

- Explain intent, invariants, sequencing, and constraints rather than translating code syntax into prose.
- Keep comments adjacent to the declaration they document.
- Do not add comments to trivial JSX callbacks, simple property accessors, obvious constants, or one-line mappers unless they encode a business rule.
- Do not claim behavior that is not guaranteed by the implementation.
- Use exact domain terminology already present in the application: connection profile, active connection, query tab, relation, metadata, backup, restore, and update lifecycle.
- Keep comments stable across implementation changes by describing contracts instead of incidental implementation details.

## Work Areas

The review and documentation pass will be organized by responsibility:

1. Shared domain types and utilities.
2. Renderer custom hooks and state orchestration.
3. React components and application composition.
4. Electron services and PostgreSQL operations.
5. Electron IPC, preload bridge, and application startup.

Existing uncommitted feature changes will be preserved. Documentation edits will not overwrite or revert them.

## Verification

Completion requires:

- A coverage audit confirming all in-scope production files were reviewed.
- `git diff --check`.
- Prettier validation.
- TypeScript type checking.
- ESLint validation.
- The complete Vitest suite.
- Production renderer, Electron main, and preload builds.

Any pre-existing build warning will be reported separately from errors introduced by the documentation pass.
