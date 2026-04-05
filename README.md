# XPTracker

A modern, open-source replacement for Alt1 Toolkit's built-in XPMeter. Built with TypeScript, event-driven architecture, and a clean RS3-native dark HUD aesthetic.

## Features

- **Sliding window rate calculation** - configurable window (default 5min) for responsive, accurate XP/hr rates
- **AFK detection** - automatically pauses session timer when no XP gained, so AFK time doesn't deflate your rates
- **Multi-font OCR** - supports 10pt, 12pt, and 14pt text sizes (auto-detects on first read)
- **XP drop counting** - tracks individual actions per hour alongside XP rates
- **Session persistence** - saves completed sessions to local storage with full history
- **In-game overlay** - renders XP rates directly on your game screen via Alt1's overlay API
- **Auto-recovery** - automatically re-scans for RuneMetrics if detection is lost
- **Fuzzy detection** - tolerance-based color matching instead of exact pixel values

## Architecture

```
EventBus (typed)
    |
    +-- XpCounterReader (detection + OCR)
    |       emits: counter:found, counter:lost, counter:updated
    |
    +-- SessionTracker (rates + AFK + history)
    |       emits: rate:updated, session:started/ended, afk:detected
    |
    +-- OverlayManager (in-game overlay rendering)
    |       listens: rate:updated, counter:found/lost
    |
    +-- UI (index.ts, DOM manipulation)
            listens: all events, drives the panel interface
```

## Setup

```bash
# Install dependencies
npm install

# Development (auto-reload)
npm run watch

# Production build
npm run build
```

## Installation (Alt1)

After building, host the `dist/` folder on GitHub Pages (or any static host), then install in Alt1:

```
alt1://addapp/https://jb-darnic.github.io/XPTracker/dist/appconfig.json
```

Or open the URL in Alt1's built-in browser and click "Add App".

> **Note:** You'll need to enable GitHub Pages on this repo (Settings → Pages → deploy from `main` branch) for the install link to work.

## Requirements

- Alt1 Toolkit installed and linked to RS3
- RuneMetrics XP counters visible on screen
- **Precise XP values enabled** (not abbreviated like "15K")
- Interface scaling at 100%

## Key Files

| File | Purpose |
|---|---|
| `src/reader/XpCounterReader.ts` | Core detection engine (ported from alt1/xpcounter) |
| `src/reader/types.ts` | All TypeScript interfaces |
| `src/reader/constants.ts` | Skill mappings, colors, dimensions |
| `src/tracker/SessionTracker.ts` | Rate calculation, AFK detection, session history |
| `src/overlay/OverlayManager.ts` | Alt1 overlay API abstraction |
| `src/events/EventBus.ts` | Typed event system |
| `src/settings/Settings.ts` | localStorage-backed configuration |
| `src/index.ts` | App entry point and UI orchestration |
| `src/index.html` | Full UI template with styling |

## Credits

- **Skillbert** - Alt1 Toolkit and the original `alt1/xpcounter` library
- **NadyaNayme** - Architectural inspiration from BetterBuffsBar and plugin patterns
- Built with research from the [Alt1 open-source libraries](https://github.com/skillbert/alt1)

## License

MIT
