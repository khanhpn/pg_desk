---
name: pg-desk-engineering
description: Use when implementing, debugging, refactoring, reviewing, or documenting production code in the pg_desk repository, especially React components and hooks, Electron IPC and services, PostgreSQL queries or maintenance workflows, imports, tests, and repository cleanup.
---

# PgDesk Engineering

## Core principle

Preserve the existing architecture while making the smallest complete change. Keep React components declarative, put behavior in focused custom hooks or services, maintain typed Electron boundaries, and verify every claim with current repository evidence.

## Required workflow

1. Inspect the relevant implementation, tests, types, and recent diff before editing.
2. Check `git status --short`. Treat unrelated changes as user-owned and preserve them.
3. Trace the complete data path: component → hook → preload → IPC → service → PostgreSQL or filesystem.
4. For a bug, reproduce or encode the failure before implementing the fix.
5. For a feature, define observable behavior and add focused tests before production code.
6. Implement within existing boundaries. Do not move unrelated code or redesign adjacent systems.
7. Update comments, mirrored types, preload contracts, tests, and documentation affected by the change.
8. Remove artifacts made obsolete by the implementation.
9. Run focused checks, then the full verification gate.
10. Perform final artifact cleanup before handoff.
11. Review the final diff for scope, accuracy, dead code, and accidental user-change loss.

## Architecture boundaries

### Renderer components

- Keep components responsible for composition, rendering, accessibility, and forwarding event callbacks.
- Move state, async operations, business rules, persistence, data conversion, and multi-step event handling into custom hooks.
- A component may contain a trivial UI-only calculation when extracting it would obscure intent.
- If modifying a component exposes existing substantial logic, extract that logic into a focused custom hook as part of the change.
- Do not create a large catch-all hook. Split by state ownership and lifecycle.

Preferred shape:

```tsx
const { rows, isLoading, selectRow, refresh } = useResultController(options);

return (
  <ResultTable
    rows={rows}
    isLoading={isLoading}
    onRefresh={refresh}
    onSelectRow={selectRow}
  />
);
```

### Custom hooks

- Give each hook one clear state ownership responsibility.
- Expose semantic commands such as `selectQueryTab` or `saveChanges`, not raw setters when a transition has rules.
- Keep cross-component coordination in a hook rather than in `App.tsx`.
- Use functional state updates when next state depends on current state.
- Protect async state against stale requests, unmounted consumers, and out-of-order responses where applicable.
- Clean up event listeners, subscriptions, observers, and timers in the effect cleanup function.
- Keep hooks deterministic during render. Perform external synchronization in effects or explicit commands.

### Electron boundaries

- The renderer must access privileged capabilities only through `window.pgdesk`.
- Keep the flow typed across Electron service types, preload, renderer declarations, and renderer domain types.
- IPC registration functions should delegate domain work to services instead of containing business logic.
- Normalize expected operational failures into typed results at the intended boundary.
- Do not expose Node, Electron, filesystem, process, or database primitives directly to the renderer.
- Use narrowly named IPC channels and payloads. Avoid generic command multiplexers.

### PostgreSQL services

- Parameterize data values. Never interpolate user-controlled values into SQL values.
- Quote schema, table, column, database, and role identifiers with the established identifier helper.
- Validate raw SQL fragments such as data types and default expressions before constructing DDL.
- Use a transaction for logically atomic multi-row or multi-step mutations.
- Roll back on every failure path after a transaction starts.
- Verify affected row counts for optimistic concurrency; report stale or missing rows instead of silently succeeding.
- Keep destructive operations explicit. Do not add `CASCADE`, overwrite files, drop databases, or broaden restore scope without a reviewed requirement.
- For backup and restore, preserve audit logging, database-scope validation, temporary-file cleanup, and command exit-code checks.

## React performance rules

Use memoization to preserve meaningful identity or avoid measurable repeated work, not as decoration.

### `useCallback`

Use `useCallback` when a function:

- Is returned by a custom hook.
- Is passed to a memoized child or participates in another hook dependency list.
- Registers or removes an external listener and therefore requires stable identity.
- Represents a stable semantic command consumed by multiple components.

Do not add `useCallback` to every local event handler. A trivial inline JSX callback is acceptable when identity has no downstream effect.

### `useMemo`

Use `useMemo` when a value:

- Is expensive to derive from state or props.
- Must retain identity for a memoized consumer or effect dependency.
- Builds a non-trivial lookup, filtered tree, column model, or aggregate used during render.

Do not memoize constants, primitive arithmetic, or cheap string formatting. Module-level constants are preferable when no render state is needed.

### `useEffect`

- Use effects only to synchronize React state with an external system or lifecycle.
- Do not use an effect to calculate state that can be derived during render.
- Include all dependencies. Restructure unstable code instead of suppressing dependency lint rules.
- Make repeated execution safe, including React Strict Mode behavior.

## Imports and module organization

- Use `@/` for renderer modules and configured aliases such as `@electron/` for shared Electron contracts.
- Use relative imports only for truly colocated files when no alias exists.
- Do not introduce deep imports such as `../../../hooks/...`.
- Group imports in the repository's existing order and let Prettier enforce formatting.
- Avoid barrel files unless the repository already uses one for that boundary; barrels can hide cycles and increase bundle scope.
- Keep types in the existing renderer/Electron contract locations. Update every mirrored contract together.
- Prefer named exports consistent with the current codebase.

## Comments and documentation

- Update TSDoc whenever purpose, parameters, return contract, side effects, failure behavior, or sequencing changes.
- Add TSDoc to exported functions, hooks, components, service operations, IPC registration functions, and internal helpers with non-obvious business rules.
- Document every meaningful parameter with `@param` and returned value with `@returns`.
- Add `@throws` only when the implementation intentionally propagates an exception.
- Describe state, filesystem, IPC, database, or lifecycle side effects when they matter to callers.
- Explain intent, invariants, safety boundaries, and ordering. Do not translate syntax into prose.
- Remove stale comments immediately. Incorrect documentation is a defect.
- Keep comments in English to match identifiers and existing technical documentation.

Example:

```ts
/**
 * Applies selected row changes in one PostgreSQL transaction.
 *
 * @param pool - Connected pool used to acquire the transaction client.
 * @param payload - Table identity and validated insert, update, and delete changes.
 * @returns Counts of committed row mutations.
 * @throws When validation fails, a target row is stale, or the transaction fails.
 */
```

## TypeScript and API design

- Prefer precise types over `any`, unsafe assertions, or broadly optional objects.
- Model variant requests and states with discriminated unions.
- Validate unknown runtime data at process, storage, file, and IPC boundaries.
- Keep nullable states explicit; do not use empty strings or magic numbers as hidden sentinels.
- Return structured domain results rather than parsing display messages in callers.
- Keep function parameters focused. Use an options object when parameters form one domain request or exceed a readable positional signature.
- Preserve backward compatibility for persisted local data by treating newly added fields as optional during deserialization and normalizing them internally.

## Async and error handling

- Await operations whose completion controls subsequent state or safety.
- Do not leave floating promises except deliberate UI event dispatch; prefix those calls with `void`.
- Catch errors only where the code can add context, normalize a result, clean up resources, or update user-visible state.
- Preserve the original error message through the established error helper.
- Use `try/finally` for loading flags, locks, temporary files, streams, clients, and other acquired resources.
- Do not report success until the underlying operation and required refresh complete.
- Prevent duplicate execution while destructive or long-running work is active.

## Testing and debugging

- For features and bug fixes, use RED → GREEN → REFACTOR.
- Test behavior and public contracts rather than implementation details.
- Keep tests deterministic. Do not add sleeps when a state, event, or promise can be awaited.
- Cover success, validation failure, service failure, and stale/concurrent data when relevant.
- For PostgreSQL mutations, verify SQL parameterization, transaction commit, rollback, and affected-row guards.
- For hooks, test state transitions and async ordering with `renderHook` and `act`.
- For components, test accessible roles, user-visible behavior, and callback invocation.
- When a failure appears unrelated, reproduce it with the repository's required Node version before changing code.

## Cleanup and repository hygiene

- Remove unused imports, dead branches, superseded helpers, stale props, obsolete types, and abandoned UI placeholders introduced or exposed by the change.
- Delete temporary plans, specifications, screenshots, generated samples, debug logs, and one-off scripts when they are no longer deliverables.
- Retain product documentation, approved design documents, tests, migrations, and audit artifacts that remain part of the feature.
- Do not delete an unfamiliar file merely because it is unreferenced; inspect ownership and history first.
- Never overwrite, restore, stage, or commit unrelated user changes.
- Do not use destructive Git commands to clean a dirty worktree.
- Avoid dependency additions when existing platform or repository utilities solve the problem.

### Final artifact cleanup

After verification passes and before the final handoff:

1. Check `git status --short` against the task's baseline status.
2. Delete task-only planning artifacts created during execution, including files under `docs/superpowers/plans/` and `docs/superpowers/specs/`.
3. Delete generated test output, screenshots, traces, temporary scripts, and diagnostic files created by the task.
4. Re-run `git status --short` and `git diff --check` after cleanup.

Keep a planning or specification file only when the user explicitly requested it, it was an agreed deliverable, or it is durable product documentation. Never delete pre-existing or user-owned artifacts while cleaning up the current task.

## Verification gate

Use Node `24.15.0` and repository-local binaries:

```bash
git diff --check
PATH=/Users/bravesoft/.nvm/versions/node/v24.15.0/bin:$PATH ./node_modules/.bin/prettier --check src electron
PATH=/Users/bravesoft/.nvm/versions/node/v24.15.0/bin:$PATH ./node_modules/.bin/tsc --noEmit
PATH=/Users/bravesoft/.nvm/versions/node/v24.15.0/bin:$PATH ./node_modules/.bin/eslint .
PATH=/Users/bravesoft/.nvm/versions/node/v24.15.0/bin:$PATH ./node_modules/.bin/vitest run
PATH=/Users/bravesoft/.nvm/versions/node/v24.15.0/bin:$PATH ./node_modules/.bin/vite build
```

Run focused tests during development. Run the full gate before claiming completion. Report existing warnings separately from failures.

## Completion checklist

- [ ] Behavior matches the user request and existing architecture.
- [ ] Component changes keep business logic in custom hooks.
- [ ] `useCallback` and `useMemo` are used only where identity or cost justifies them.
- [ ] Imports use configured aliases and introduce no cycles.
- [ ] Renderer, preload, IPC, service, and mirrored type contracts agree.
- [ ] SQL values are parameterized and identifiers are safely quoted.
- [ ] Async resources and subscriptions are cleaned up.
- [ ] TSDoc and product documentation reflect changed behavior.
- [ ] Obsolete files and code introduced or superseded by the task are removed safely.
- [ ] Task-only `docs/superpowers/` plans and specifications have been removed unless they are explicit deliverables.
- [ ] Focused tests and the full verification gate pass.
- [ ] Final diff contains no unrelated or accidental changes.

## Red flags

Stop and correct the design when any of these appear:

- Business logic added directly to a React component or `App.tsx`.
- `useMemo` or `useCallback` added without an identity or computation reason.
- Deep relative imports where an alias exists.
- Renderer code importing Electron or Node APIs directly.
- SQL constructed with interpolated values or unvalidated identifiers.
- A transaction without guaranteed rollback or acquired resources without `finally` cleanup.
- An effect with suppressed dependencies or missing listener cleanup.
- Behavior changed while comments, tests, or mirrored contracts remain stale.
- Placeholder UI, temporary files, dead code, or debug logging left behind.
- Task-generated `docs/superpowers/` plans or specifications retained without an explicit deliverable requirement.
- Completion claimed without fresh verification output.
