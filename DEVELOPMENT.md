# Development Guide

## Prerequisites

- **Rust** 1.77+ (`rustup` recommended)
- **Node.js** 20+ and npm
- **Linux system dependencies** (Ubuntu/Debian):
  ```bash
  sudo apt-get install -y libgtk-3-dev libwebkit2gtk-4.1-dev librsvg2-dev patchelf libssl-dev libdbus-1-dev
  ```

## Running in Development

```bash
# Install frontend dependencies
npm install

# Start the app (launches both Vite dev server and Tauri)
npm run tauri dev
```

This starts the Vite dev server on `http://localhost:1420` with HMR, then launches the Tauri window pointing to it. Rust changes trigger a recompile; frontend changes hot-reload instantly.

### Other Commands

```bash
# Type-check frontend only
npx tsc --noEmit

# Build frontend only
npx vite build

# Check Rust compilation only (faster than full build)
cd src-tauri && cargo check

# Build release binary
npm run tauri build
```

## Hevy API Reference

The Hevy API docs are at https://api.hevyapp.com/docs/ (Swagger UI). The OpenAPI spec is embedded in the Swagger UI's JavaScript and isn't served at a separate URL. To extract the raw JSON spec:

```bash
# Download and extract the OpenAPI JSON
curl -s https://api.hevyapp.com/docs/swagger-ui-init.js | python3 -c "
import json, sys
content = sys.stdin.read()
start = content.index('\"swaggerDoc\": {') + len('\"swaggerDoc\": ')
depth, end = 0, start
for i in range(start, len(content)):
    if content[i] == '{': depth += 1
    elif content[i] == '}':
        depth -= 1
        if depth == 0: end = i + 1; break
json.dump(json.loads(content[start:end]), sys.stdout, indent=2)
" > hevy-openapi.json
```

### Key API Details

- Auth: `api-key` header (UUID), requires Hevy Pro
- Base URL: `https://api.hevyapp.com`
- Exercise templates: paginated, max 100 per page
- Routines/workouts: paginated, max 10 per page
- Exercises reference a Hevy `exercise_template_id` (e.g., `"D04AC939"` for Bench Press Barbell)
- All weights are in kg
- Set types: `warmup`, `normal`, `failure`, `dropset`
- RPE values: `6, 7, 7.5, 8, 8.5, 9, 9.5, 10`

## Project Structure

```
hevy-program-extension/
├── src-tauri/                    # Rust backend (Tauri)
│   ├── Cargo.toml                # Rust dependencies
│   ├── tauri.conf.json           # Window config, app identity, build settings
│   ├── capabilities/default.json # Tauri v2 permissions (SQL, HTTP, etc.)
│   ├── migrations/
│   │   └── 001_initial_schema.sql  # SQLite schema (12 tables)
│   └── src/
│       ├── lib.rs                # Entry point: plugin registration, DB init, command registration
│       ├── main.rs               # Binary entry (just calls lib::run)
│       ├── commands/             # Tauri invoke handlers (called from frontend)
│       │   ├── api_key.rs        # Store/retrieve/validate API key via OS keychain
│       │   ├── hevy_api.rs       # Exercise template sync, search, 1RM calculation
│       │   ├── program.rs        # Full program CRUD + grid save + training maxes
│       │   └── settings.rs       # User settings (units, etc.)
│       ├── db/
│       │   └── migrations.rs     # Opens SQLite DB, runs migrations on first launch
│       ├── hevy/
│       │   └── client.rs         # HTTP client wrapper for all Hevy API endpoints
│       ├── models/               # Rust structs for DB rows and API payloads
│       │   ├── exercise.rs       # ExerciseTemplate
│       │   ├── program.rs        # Program, Block, Mesocycle, Microcycle, Sets, TrainingMax
│       │   ├── settings.rs       # UserSettings
│       │   └── sync_metadata.rs  # SyncRecord
│       └── utils/
│           └── conversions.rs    # kg/lbs conversion
│
├── src/                          # React + TypeScript frontend
│   ├── main.tsx                  # React entry, mounts <App>
│   ├── App.tsx                   # Router, settings load, API key check, toast provider
│   ├── styles/
│   │   └── global.css            # Dark theme CSS vars, AG Grid overrides, base components
│   ├── types/                    # TypeScript interfaces matching the Rust models
│   │   ├── program.ts            # Program, Block, Mesocycle, Microcycle, Sets, TrainingMax
│   │   ├── exercise.ts           # ExerciseTemplate, MuscleGroup, EquipmentCategory enums
│   │   ├── settings.ts           # UserSettings, UnitSystem
│   │   └── index.ts              # Re-exports
│   ├── stores/                   # Zustand state management
│   │   ├── settingsStore.ts      # Unit system, API key status, Hevy user info
│   │   ├── exerciseStore.ts      # Cached exercise templates, client-side search
│   │   └── programStore.ts       # Active program tree, navigation state, training maxes
│   ├── hooks/                    # (Placeholder) React hooks for complex operations
│   ├── lib/
│   │   ├── tauri.ts              # Typed wrappers for all Tauri invoke() calls
│   │   ├── conversions.ts        # kg/lbs display conversion
│   │   ├── formulas.ts           # 1RM estimation (Epley, Brzycki), percentage-to-weight
│   │   └── constants.ts          # Set types, RPE values
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppShell.tsx      # Sidebar + main content flex layout
│   │   │   └── Sidebar.tsx       # Program list, new program input, settings link
│   │   ├── setup/
│   │   │   └── ApiKeyPrompt.tsx  # First-launch modal: enter + validate API key
│   │   ├── grid/                 # (Phase 2) AG Grid program editor components
│   │   ├── training-max/         # (Phase 3) Training max panel and import
│   │   └── sync/                 # (Phase 4) Sync preview and status
│   └── pages/
│       ├── HomePage.tsx          # Dashboard: stats, program cards, create button
│       ├── ProgramPage.tsx       # Program editor (loads program by route param)
│       └── SettingsPage.tsx      # API key management, unit toggle, exercise cache sync
│
├── index.html                    # Vite entry HTML
├── vite.config.ts                # Vite config (port 1420, React plugin)
├── tsconfig.json                 # TypeScript config (strict, React JSX)
├── package.json                  # npm scripts: dev, build, tauri
└── .gitignore
```

## Architecture

### Data Flow

Frontend (React) communicates with the Rust backend exclusively via Tauri's `invoke()` IPC. The frontend never touches SQLite or the Hevy API directly.

```
React Component
  → Zustand Store action
    → lib/tauri.ts (typed invoke wrapper)
      → Tauri IPC
        → Rust #[tauri::command]
          → SQLite (rusqlite) or Hevy API (reqwest)
```

### Database

SQLite database lives at `~/.local/share/com.hevy-program-extension.app/hevy_programs.db` (Linux). Schema is defined in `src-tauri/migrations/001_initial_schema.sql` and applied automatically on first launch.

The `AppState` struct (holding the `rusqlite::Connection`) is managed as Tauri state behind a `Mutex`. Every command receives it via `State<'_, Mutex<AppState>>`.

### API Key Storage

The Hevy API key is stored in the OS keychain via the `keyring` crate (service: `hevy-program-extension`, user: `api-key`). It is never written to disk or to SQLite. On Linux this uses the Secret Service API (GNOME Keyring / KWallet).

### Weights and Units

All weights are stored and transmitted in kilograms. The Hevy API uses kg. The frontend renders weights in the user's preferred unit by applying a display conversion (`src/lib/conversions.ts`). When the user enters a weight in lbs, it's converted to kg before being saved.

### Where the Most Important Features Live

| Feature             | Frontend                               | Backend                                                          |
| ------------------- | -------------------------------------- | ---------------------------------------------------------------- |
| API key flow        | `ApiKeyPrompt.tsx`, `SettingsPage.tsx` | `commands/api_key.rs`                                            |
| Exercise library    | `exerciseStore.ts`                     | `commands/hevy_api.rs` (sync + search)                           |
| Program CRUD        | `programStore.ts`, `Sidebar.tsx`       | `commands/program.rs`                                            |
| Program grid editor | `components/grid/` (Phase 2)           | `commands/program.rs` (`save_microcycle_exercises`)              |
| Training maxes      | `components/training-max/` (Phase 3)   | `commands/program.rs` (`get/set_training_max`)                   |
| 1RM calculation     | `lib/formulas.ts`                      | `commands/hevy_api.rs` (`calculate_1rm_from_history`)            |
| Hevy sync           | `components/sync/` (Phase 4)           | `hevy/client.rs` (API calls), `commands/sync.rs` (orchestration) |
| Settings/units      | `settingsStore.ts`, `SettingsPage.tsx` | `commands/settings.rs`                                           |

## Implementation Phases

The project is being built in phases:

1. **Foundation** (complete) — Project scaffold, DB schema, API key flow, exercise cache, settings, app shell
2. **Program Builder** — AG Grid integration, exercise autocomplete, set/rep editing, auto-save
3. **Training Max & Percentages** — TM panel, percentage-based weight display, 1RM import from Hevy history
4. **Hevy Sync** — Routine folder creation, routine push/update, sync preview, status tracking
5. **Polish** — Command palette, keyboard shortcuts, mesocycle duplication with auto-increment, week overview
