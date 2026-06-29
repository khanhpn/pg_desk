# Contributing to PgDesk

Thanks for your interest in contributing. This guide covers local development setup and project conventions.

## Tech stack

- [Electron](https://www.electronjs.org/) — desktop shell
- [Vite](https://vitejs.dev/) + [React](https://react.dev/) — renderer UI
- [TypeScript](https://www.typescriptlang.org/) — type safety
- [node-postgres](https://node-postgres.com/) (`pg`) — PostgreSQL driver
- [CodeMirror](https://codemirror.net/) — SQL editing

## Prerequisites

- [Node.js](https://nodejs.org/) `24.15.0` (see `.nvmrc`)
- [pnpm](https://pnpm.io/) `11.9.0`
- A running PostgreSQL instance for testing connections

## Getting started

```bash
# Install dependencies
pnpm install

# Start the app in development mode
pnpm dev
```

## Scripts

| Command                  | Description                                                    |
| ------------------------ | -------------------------------------------------------------- |
| `pnpm dev`               | Run the app with hot reload                                    |
| `pnpm build`             | Type-check, bundle, and package the app                        |
| `pnpm release:mac`       | Build macOS DMG artifacts for Apple Silicon and Intel          |
| `pnpm release:mac:intel` | Build macOS DMG artifacts for Intel Macs only                  |
| `pnpm lint`              | Run ESLint                                                     |
| `pnpm lint:fix`          | Run ESLint with auto-fix                                       |
| `pnpm format`            | Format code with Prettier                                      |
| `pnpm format:check`      | Check formatting without writing                               |

## Project structure

```
pgdesk/
├── electron/          # Main process, IPC handlers, PostgreSQL services
├── src/               # React renderer (UI, hooks, components)
├── public/            # Static assets
└── docs/              # Screenshots and documentation assets
```

## Path aliases

| Alias         | Maps to          |
| ------------- | ---------------- |
| `@/*`         | `src/*`          |
| `@electron/*` | `electron/*`     |
| `@ipc/*`      | `electron/ipc/*` |
