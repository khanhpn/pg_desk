# Result Table Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the SQL result table into a polished multi-row editor with icon actions for Add, Save, and Delete, while preserving the existing metadata-driven safety rules.

**Architecture:** Keep `useResultEditing` as the renderer-side source of truth for draft rows, dirty cells, new rows, and persistence status. Add one metadata-validated `query:apply-table-changes` IPC operation that applies updates, inserts, and deletes in a single PostgreSQL transaction. Keep existing single-cell and single-row IPC methods for compatibility, but move the result grid to the new operation.

**Tech Stack:** React 18, TypeScript, Electron IPC, PostgreSQL `pg`, Vitest, Testing Library, Vite, static HTML documentation.

## Global Constraints

- The existing query result flow and legacy `query:update-cell` / `query:delete-row` channels remain available.
- Editing is enabled only for one identifiable PostgreSQL base table with primary-key metadata and non-duplicate result column names.
- New rows are drafts until Save succeeds; database writes use bound parameters and quoted identifiers.
- Updates, inserts, and deletes from one Save/Delete command run in one backend transaction and roll back on failure.
- Icon-only controls must have accessible labels, tooltips, keyboard focus states, and visible disabled states.
- The repository requires Node `24.15.0` and pnpm `11.9.0` for normal verification.

---

### Task 1: Add the transactional table-change contract

**Files:**

- Modify: `electron/types/query.ts`
- Modify: `electron/preload.ts`
- Modify: `src/vite-env.d.ts`
- Modify: `electron/ipc/query-ipc.ts`
- Modify: `electron/services/postgres-connection-service.ts`
- Test: `src/services/postgres-connection-service.test.ts`

**Interfaces:**

- Produce `QueryTableChangePayload`, `QueryTableChangeResult`, and `applyPostgresTableChangesFromPool`.
- Consume the existing `PgPool` query interface and metadata validation pattern used by `updatePostgresCell` and `deletePostgresRow`.

- [ ] **Step 1: Write failing service tests** for an update/insert/delete transaction, parameterized values, and rollback when an affected row count is wrong.
- [ ] **Step 2: Run the focused service test** and confirm it fails because the new function and types do not exist.
- [ ] **Step 3: Implement the types and service** with metadata re-validation, quoted schema/table/column identifiers, `$n` parameters, `BEGIN`, `COMMIT`, and `ROLLBACK` on error.
- [ ] **Step 4: Register the IPC handler and expose `window.pgdesk.query.applyTableChanges`** in both preload type surfaces.
- [ ] **Step 5: Run the focused service test** and confirm all transaction and validation cases pass.

### Task 2: Replace single-row state with stable multi-row draft state

**Files:**

- Modify: `src/hooks/useResultEditing.ts`
- Modify: `src/hooks/useResultRowSelection.ts`
- Create: `src/hooks/useResultRowSelection.test.ts`

**Interfaces:**

- `useResultEditing` returns rows shaped as `{ id: string; values: Record<string, unknown>; isNew: boolean }`, plus `addRow`, `updateDraftCell`, `saveChanges`, `deleteSelectedRows`, `canInsertRows`, `isRowSelected`, and row target helpers.
- `useResultRowSelection` returns `selectedRowIds`, `selectedRowCount`, `allRowsSelected`, `toggleRow`, `toggleAllRows`, and `clearSelection`.

- [ ] **Step 1: Write failing hook tests** for toggling several rows, select-all, deselecting one row, resetting on a new query result, and adding a draft row.
- [ ] **Step 2: Run the focused hook tests** and confirm they fail against the single-selection implementation.
- [ ] **Step 3: Implement stable row IDs** and explicit checkbox selection without row-click side effects.
- [ ] **Step 4: Implement draft row creation** with visible columns initialized to `null`, primary keys read-only, and new-row edits tracked separately from persisted-row edits.
- [ ] **Step 5: Implement one Save command** that sends changed persisted rows and new-row insert values through `applyTableChanges`, then resets local state only after success.
- [ ] **Step 6: Implement bulk Delete** that sends only persisted selected rows, removes drafts locally, confirms once, and clears selection after success.
- [ ] **Step 7: Run focused hook tests and the existing query-result tests** and confirm the new state model passes without changing unrelated query behavior.

### Task 3: Build the icon action cluster and polished grid UX

**Files:**

- Modify: `src/components/ResultPanel.tsx`
- Modify: `src/components/ResultPanel.test.tsx`
- Modify: `src/styles/results.css`

**Interfaces:**

- Consume the Task 2 hook contracts.
- Render `Add`, `Save`, `Delete`, and select-all controls with accessible names: `Add row`, `Save changes`, `Delete selected rows`, and `Select all rows`.

- [ ] **Step 1: Write failing component tests** for icon-only buttons, multi-row selection, Add rendering a new row, combined Save behavior, and one confirmation for bulk Delete.
- [ ] **Step 2: Run the focused component test** and confirm it fails because the current radio selector and single-row toolbar do not expose the new controls.
- [ ] **Step 3: Replace the radio-style dot selector with native checkboxes** and remove implicit selection from row clicks.
- [ ] **Step 4: Add the compact action cluster** next to the select-all checkbox, with SVG icons, tooltips, focus-visible styles, disabled states, and selection-count badge.
- [ ] **Step 5: Render draft rows with a distinct accent rail/background** and keep dirty-cell highlighting and boolean input behavior intact.
- [ ] **Step 6: Run focused component tests** and then verify the result CSS at desktop and narrow widths.

### Task 4: Update user documentation and screenshot assets

**Files:**

- Modify: `README.md`
- Modify: `docs/documentation.html`
- Modify: `docs/index.html`
- Modify: `docs/styles.css` only if the new screenshot needs a caption/layout adjustment
- Create: `docs/assets/result-table-editing.png`

**Interfaces:**

- Documentation must describe multi-select, Add draft rows, Save, Delete, primary-key requirements, and read-only limitations.
- The new screenshot must show the finished icon cluster, selected rows, and a draft row from the running app.

- [ ] **Step 1: Add the user-facing editing workflow copy** to README and the Result Grid documentation section.
- [ ] **Step 2: Add the new screenshot to the documentation screenshot grid** with descriptive alt text and a concise caption.
- [ ] **Step 3: Start the app with the project-required Node version, use a safe local/demo result state, and capture the running result panel with the browser tooling.**
- [ ] \*\*Step 4: Inspect the screenshot for clipping, unreadable labels, and accidental local data before keeping it under `docs/assets/`.

### Task 5: Verify the complete feature

**Files:**

- No source changes unless verification finds a defect.

- [ ] **Step 1: Run the focused service, hook, and component tests.**
- [ ] **Step 2: Run the full Vitest suite with Node `24.15.0`.**
- [ ] **Step 3: Run `pnpm run lint`, `pnpm run build`, and `pnpm run format:check`.**
- [ ] **Step 4: Run the browser-based visual check and confirm the screenshot matches the shipped UI.**
- [ ] \*\*Step 5: Run `git diff --check`, inspect the final diff, and report any environment blocker with its exact command output.
