# AGENTS.md

Instructions for AI agents working on this codebase.

## Commit discipline

**Always commit and push after every change.** Each logical alteration — a bug fix, a new feature, a refactor, a new data file — must be committed and pushed to the remote immediately. Do not batch unrelated changes into a single commit.

## Pull requests and commits

Do not add promotional footers, badges, or "Generated with" lines to pull request descriptions or commit messages. Keep them clean and technical.

## Project overview

LatencyMap is an Electron + React desktop app that measures network latency and traceroute to cloud provider endpoints. It runs native OS ping/traceroute commands (no external binaries).

### Structure

```
src/
  main/        Electron main process (IPC handlers, native ping/traceroute, persistence)
  renderer/    React UI (Vite, single-page app)
  shared/      Types and utilities shared between main and renderer
  preload/     Electron preload scripts (IPC bridge)
data/          Provider host catalog (one JSON file per provider, auto-discovered)
assets/        Build resources (icons, etc.)
```

### Key files

- `src/shared/catalog.ts` — Loads all `data/*.json` files via `import.meta.glob` and builds the provider catalog. Adding a new JSON file to `data/` is all that's needed for a new provider.
- `src/shared/types.ts` — All shared TypeScript interfaces.
- `src/renderer/src/App.tsx` — Main UI component.
- `src/renderer/src/lib/models.ts` — Display host logic, sorting, filtering, quality scoring.
- `src/main/native.ts` — OS-level ping and traceroute execution and parsing (Windows, macOS, Linux).
- `src/main/store.ts` — Persistent storage for settings, custom hosts, and measurement results.

## Commands

| Task | Command |
|------|---------|
| Dev server | `npm run dev` |
| Build | `npm run build` |
| Package (local) | `npm run package` |
| Release | `npm run release` |
| Run tests | `npm test` |

## Tech stack

- **Runtime**: Electron 37, Node (ES modules)
- **UI**: React 19, TypeScript (strict mode), Vite 7
- **Build**: electron-vite, electron-builder
- **Tests**: Vitest, @testing-library/react, jsdom
- **No linter/formatter configured** — keep code style consistent with the existing codebase.

## TypeScript

Two configs: `tsconfig.node.json` (main/preload/shared) and `tsconfig.web.json` (renderer/shared). Both use strict mode, target ES2022, module ESNext, bundler resolution.

Path aliases:
- `@renderer/*` → `src/renderer/src/*`
- `@shared/*` → `src/shared/*`

## Adding providers

Drop a JSON file in `data/` following the schema in the README. The catalog loader picks up any `*.json` automatically — no code changes needed. Icons are assigned deterministically from a pool based on the provider ID hash.

## Testing

Run `npm test` before pushing. Tests live in `src/renderer/src/test/`. The test framework is Vitest with jsdom environment and React Testing Library.

## CI/CD

GitHub Actions workflow (`.github/workflows/release.yml`) triggers on `v*` tags and builds for Linux, Windows, and macOS (x64 + arm64). It publishes to GitHub Releases.
