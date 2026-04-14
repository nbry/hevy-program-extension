# Hevy Program Extension

🚧 Under Construction 🚧

A desktop application for designing long-term workout programs and syncing them to [Hevy](https://hevy.com). Built for strength athletes, powerlifters, and coaches who need to plan structured training blocks with percentage-based programming.

## What It Does

Hevy is great for logging workouts, but it lacks tools for designing multi-week periodized programs. This app fills that gap with a spreadsheet-like interface for building training programs, then pushes them to Hevy as routine folders so you can execute them from the Hevy app.

### Key Features

- **Program Builder** — Grid-based editor for designing training blocks, mesocycles (weeks), and microcycles (training days) with exercises, sets, reps, and weights
- **Percentage-Based Programming** — Enter weights as percentages of your training max (e.g., "5x3 @ 85%") and the app calculates the actual weight
- **Training Max Management** — Set training maxes manually or auto-import estimated 1RMs from your Hevy workout history using Epley/Brzycki formulas
- **Hevy Sync** — Push your program to Hevy as a routine folder with individual routines for each training day. Update existing synced programs without creating duplicates
- **Unit Toggle** — Switch between kg and lbs display. All weights are stored in kg internally to match the Hevy API
- **Offline-First** — All program data is stored locally in SQLite. Internet is only needed for syncing to Hevy and importing exercise data

## Workflow

1. **Connect** — Enter your Hevy API key (requires Hevy Pro). The app validates it and fetches your exercise library.
2. **Build** — Create a program, add training blocks and weeks, then fill in exercises and set/rep schemes using the grid editor. Use the exercise autocomplete to pick from Hevy's full exercise library.
3. **Configure** — Set training maxes for your main lifts. Use percentages in the grid and watch weights update automatically when you adjust a TM.
4. **Sync** — Preview what will be sent to Hevy, then push. The app creates a routine folder and individual routines for each training day.
5. **Train** — Open Hevy on your phone, find your routines in the synced folder, and start logging.
6. **Iterate** — Edit your program locally, then re-sync to update the routines in Hevy.

## Program Structure

Programs follow standard periodization hierarchy:

```
Program (e.g., "16-Week Meet Prep")
└── Training Block (e.g., "Hypertrophy", "Strength", "Peaking")
    └── Mesocycle / Week (e.g., "Week 1", "Week 2", "Deload")
        └── Microcycle / Day (e.g., "Day 1 - Upper", "Day 2 - Lower")
            └── Exercise (e.g., "Squat (Barbell)")
                └── Sets (e.g., 3x5 @ 85%, 4x8-12 @ RPE 8)
```

Each microcycle maps to one Hevy routine when synced.

## Tech Stack

- **Framework**: [Tauri v2](https://v2.tauri.app/) (Rust backend + React frontend)
- **Frontend**: React 19, TypeScript, AG Grid, Zustand, Tailwind CSS v4
- **Storage**: SQLite (via rusqlite)
- **API Key Security**: OS keychain (via `keyring` crate)
- **Hevy API**: REST, requires Pro subscription

## Getting Your API Key

1. Subscribe to [Hevy Pro](https://hevy.com)
2. Go to [hevy.com/settings?developer](https://hevy.com/settings?developer)
3. Copy your API key
4. Paste it into the app on first launch

## License

MIT
