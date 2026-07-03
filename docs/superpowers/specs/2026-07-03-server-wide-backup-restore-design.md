# Server-Wide Backup And Restore Design

## Goal

Add a new menu-driven backup and restore workflow for all databases available on the currently connected PostgreSQL server. The new workflow must be easy for users to discover and operate, and it must not change the existing single-database Backup and Restore buttons in the connection card.

## User Experience

Add two menu items under `File`:

- `Backup Databases...`
- `Restore Databases...`

Both items open renderer modals. They use the active connected profile as the server connection. If there is no active connected profile, the modal shows a clear blocked state asking the user to connect first.

The backup modal lists all user-connectable databases on that PostgreSQL server. The user can select individual databases, select all, clear the selection, choose an output folder, and start backup. While backup is running, controls that could change the task are disabled. If any backup fails, the modal remains open with the failure details. The modal auto-closes only when every selected database finishes successfully.

The restore modal lets the user choose a folder or multiple `.sql` files, maps each file to a target database name, and lets the user select which entries to restore. The user can adjust target database names before running. Restore requires an explicit confirmation because it can create or modify databases. If a target database does not exist, PgDesk creates it before restoring that file. If any restore fails, the modal remains open with the failure details. The modal auto-closes only when every selected restore finishes successfully.

Successful operations show the existing database maintenance toast pattern. Restore refreshes the explorer when the active database was restored.

## Scope

This first version writes one plain SQL backup file per database into the selected folder. This keeps selected-database backup and restore simple, inspectable, and compatible with the current `pg_dump --format=plain` behavior. A future enhancement can add a single-file bundle mode, but it is not required for the first implementation.

Global objects such as roles, tablespaces, and server-wide grants are out of scope. The feature is intentionally database-level, not a full `pg_dumpall --globals-only` replacement.

## Architecture

Use Approach A: extend the existing backup service with new multi-database APIs while preserving the current single-database APIs.

Keep existing APIs unchanged:

- `database:backup`
- `database:restore`
- `window.pgdesk.database.backup`
- `window.pgdesk.database.restore`

Add new APIs:

- `database:list-databases`
- `database:choose-backup-folder`
- `database:choose-restore-files`
- `database:backup-many`
- `database:restore-many`
- renderer preload wrappers under `window.pgdesk.database`

The Electron menu sends renderer events such as `database:open-backup-modal` and `database:open-restore-modal`. The renderer owns modal state and calls the new IPC APIs.

## Backend Behavior

Database listing queries `pg_database` through the active connection pool and returns databases where `datallowconn = true`, excluding `template0` and `template1`. The currently connected database remains included when eligible.

Backup runs `pg_dump` once per selected database using the existing local or Docker tool runner resolution. For each database, create a temporary profile based on the active profile with `database` replaced by the selected database. Output files use sanitized database names, version numbering, and `.sql` extension. A multi-database backup result includes per-database success or failure entries.

Restore runs each selected `.sql` file against its target database. Before restoring, the service checks whether the target database exists. If it does not, the service connects through a maintenance database, preferably `postgres`, and executes `CREATE DATABASE` with a safely quoted identifier. If `postgres` is unavailable, it can fall back to the original profile database when possible. Restore then runs `psql` against the target database using the existing tool runner logic.

Plain SQL restore does not introduce destructive pre-clean behavior beyond what the SQL file itself contains. The UI copy must make this explicit: restore applies the selected SQL files and may create databases when missing.

## UI Design

Create a dedicated `ServerDatabaseMaintenanceModal` component with two modes: `backup` and `restore`.

Backup mode contains:

- Active connection summary.
- Database checklist with status and count.
- `Select all` and `Clear` controls.
- Folder selector with selected folder path.
- Primary `Back up selected` action.
- Inline progress and per-database result rows.

Restore mode contains:

- Active connection summary.
- File selector for a folder or multiple `.sql` files.
- A table of files with editable target database names.
- Checkboxes for which files to restore.
- Confirmation copy near the primary action.
- Primary `Restore selected` action.
- Inline progress and per-file result rows.

The modal should look professional and operational: compact typography, clear grouping, stable row heights, restrained colors, and no nested cards.

## Error Handling

The modal never closes on failure. It shows the failed database or file, the tool error message, and preserves the user's selection so they can retry after fixing the issue.

Cancellation from file or folder dialogs is not treated as an error. Missing tools reuse the existing helpful message for installing PostgreSQL client tools or configuring Docker.

If database creation fails during restore, that restore entry fails and the remaining selected entries can continue. The final result is successful only when every selected entry succeeds.

## Testing

Add focused tests for:

- Existing single-database backup and restore APIs still using the old behavior.
- Database list filtering excludes templates and non-connectable databases.
- Multi-backup builds one `pg_dump` call per selected database and produces sanitized file paths.
- Restore creates a missing database before running `psql`.
- Restore does not create a database when it already exists.
- Modal behavior keeps the modal open on errors and closes only after all entries succeed.
- Menu items send the correct renderer events without invoking the old single-database backup or restore APIs.

## Non-Goals

- Do not replace or modify the connection-card Backup and Restore buttons.
- Do not add role or tablespace backup in this version.
- Do not require superuser-only `pg_dumpall` behavior.
- Do not auto-drop existing databases before restore.
