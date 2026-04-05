# XP Meter Improved

An enhanced replacement for Alt1 Toolkit's built-in XP Meter. Built on top of the original working XP Meter codebase — pure HTML/CSS/JS with no build step required.

## Features

- **Dark HUD interface** with tabbed layout (Graph, Skills, Drops, Settings)
- **Per-skill XP rates** tracked simultaneously with easy switching
- **XP drop clustering** identifies distinct XP drops and counts them
- **Session XP tracking** shows total XP gained since starting
- **AFK alerts** configurable timeout with tooltip notification
- **Live graph** with gradient fill showing XP over time
- **Fixed or rolling** time window modes
- **Drop tracking** click any XP drop to track how often it occurs

## Installation (Alt1)

Install directly into Alt1 Toolkit:

```
alt1://addapp/https://jb-darnic.github.io/XPTracker/appconfig.json
```

Or open the URL in Alt1's built-in browser and click "Add App".

> **Note:** GitHub Pages must be enabled on this repo (Settings > Pages > deploy from `main` branch, root folder).

## Requirements

- Alt1 Toolkit installed and linked to RS3
- RuneMetrics XP counters visible on screen
- **Precise XP values enabled** (not abbreviated like "15K")

## How It Works

The app uses the pre-built `xpcounter.bundle.js` (from Skillbert's alt1 libraries) which handles all the OCR detection of the RuneMetrics XP counter on screen. The improved UI and tracking logic sits on top of this working reader — no webpack, no TypeScript compilation, no build step. Just load and go.

## Usage

1. Open RuneMetrics XP counters in RS3
2. The app auto-detects the counter on screen
3. Status dot: green = active, yellow = searching, orange = AFK, red = not found
4. Click the rate display to switch between tracked skills
5. Use tabs to view the graph, all skills, XP drop breakdown, or settings

## Credits

- **Skillbert** — Alt1 Toolkit and the original `alt1/xpcounter` library
- Built on the [Alt1 open-source libraries](https://github.com/skillbert/alt1)

## License

MIT
