# Result Table Editing UX Design

## Goal

Make the SQL result table feel like a professional data grid: users can select multiple rows, add a new row, save edits, and delete selected rows without leaving the table. The existing query result flow remains intact, and editing stays available only when PostgreSQL metadata proves the result maps safely to one editable base table.

## Product decisions

- Replace the current single-row radio-style selector with native checkboxes.
- Put the table actions in one compact action cluster beside the row selector: Add, Save, Delete.
- Use icon-only buttons to preserve horizontal space. Each button has an accessible label and tooltip.
- Add creates a draft row at the bottom of the current result. The draft is visually distinct until saved.
- Save is one commit action for all dirty cell edits and new rows.
- Delete removes all selected persisted rows after one confirmation. Draft rows are removed locally without a database request.
- The selection badge shows the number of selected rows, and action buttons communicate their disabled state through opacity, cursor, and tooltip.
- For a result that is read-only, ambiguous, duplicated, or sourced from more than one table, editing actions stay disabled and the existing read-only message remains the source of truth.

## Layout

The result header keeps the `Result` tab on the left. On the right, the message is followed by a single action group:

```text
Result                                             [status]  [☑] [+] [save] [trash]
                                                       select     Add Save Delete
```

The first table column becomes a select-all checkbox column. Each row gets a matching checkbox. The row number remains a quiet gutter column. Buttons use a 28px square hit area, an 8px group gap, and a subtle group container so they read as one toolset rather than unrelated controls.

Visual hierarchy:

- Add uses the accent color and creates the primary entry point.
- Save uses the accent fill only when there are pending changes; otherwise it is muted and disabled.
- Delete uses a danger-tinted border/icon and is enabled only when at least one selected row is safely deletable.
- New rows use a left accent rail and a `new-row` background tint. Dirty cells retain the warning tint used by the current editor.

## Frontend state model

`useResultEditing` remains the single owner of editable draft data and persistence state. It will extend its state with:

- `newRowIds`: stable local IDs for draft rows so row selection does not depend on shifting array indexes.
- `selectedRowIds`: a set of stable row IDs owned by a focused selection hook.
- `hasNewRows`, `hasPendingChanges`, and `canInsertRows` derived from query metadata.
- `addRow`, `saveChanges`, and `deleteSelectedRows` commands.

Existing query result rows receive stable IDs when loaded. A new row is initialized with every visible column set to `null`, except generated/identity primary-key columns, which stay read-only and blank. Only columns marked editable by the result metadata render as inputs. Primary-key values are required for persisted update/delete operations; insert validation reports the missing columns before any database call.

The selection hook will expose `toggleRow`, `toggleAllRows`, `selectedRowCount`, `allRowsSelected`, and `clearSelection`. Clicking a row no longer selects it implicitly; selection is explicit through checkboxes so editing a cell does not accidentally change the delete target.

## Persistence contract

The renderer will use a new table-change IPC operation so a Save or Delete action is one backend transaction per user command.

The payload identifies one table by `tableOid` and contains:

- `updates`: row primary-key values plus changed editable column values.
- `inserts`: column/value maps for new rows.
- `deletes`: primary-key values for persisted rows.

The main-process service re-reads table metadata by OID, validates that all referenced columns and primary keys belong to the same base table, quotes identifiers, and binds all values as parameters. It runs the requested changes in a transaction. For updates and deletes, affected-row counts must match the request; if a row changed or disappeared, the transaction rolls back and the UI receives a clear error. For inserts, only editable columns are sent, allowing database defaults and generated keys to work normally.

This extends the existing safe metadata-driven update/delete path instead of creating a second ad-hoc SQL path. The current `query:update-cell` and `query:delete-row` IPC methods remain available for compatibility while the result editor moves to the table-change operation.

## Error and safety behavior

- No active connection: return the existing connection error without mutating local drafts.
- Read-only/ambiguous result: disable Add, Save, and Delete with an explanatory tooltip.
- Missing primary-key value on update/delete: block the entire command and identify the row number.
- Insert validation failure: keep all drafts in the grid, focus the first invalid cell when possible, and show the database message in the result header.
- Partial persistence is never reported as success; the backend transaction rolls back on failure.
- After a successful Save, clear dirty state and refresh the query result through the existing query runner so generated values/defaults appear in the grid.
- After a successful Delete, clear selection and refresh the result so row numbering and database state stay authoritative.

## Documentation and visual QA

Update the user-facing documentation with a short “Editing result tables” section covering multi-select, Add, Save, Delete, read-only limitations, and the requirement to select a base-table primary key in the query. Add a screenshot under `docs/assets/` showing the finished action cluster, selected rows, and a draft row. The screenshot must be captured from the running app after the UI and behavior tests pass.

## Verification

- Renderer tests cover select-all, multi-row selection, add-row draft rendering, combined update/insert Save, and bulk Delete confirmation.
- Service tests cover transaction ordering, identifier validation, parameter binding, rollback on mismatch, and generated/default insert columns.
- Run the focused tests first, then the full Vitest suite, TypeScript build, lint, and production build.
- Perform a browser-based visual check at a normal desktop viewport and capture the final screenshot from the running app.
