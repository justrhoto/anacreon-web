# Anacreon: Reconstruction 4021 — Browser Port

A native browser port of the DOS strategy game Anacreon (TMA / George Moromisato; v2.0 by Adam Luker).

The game engine is a faithful hand translation of the original Turbo Pascal source into JavaScript. It covers the economy, fleets, combat, NPE (computer empire) AI, scenarios, news and messages. The DOS text-mode interface has been replaced with a browser-native UI: a zoomable galaxy map, a selection panel with context actions, list tabs and dialogs for every command.

**Play it now:** the port is fully playable in your browser at **https://justrhoto.github.io/anacreon-web/**. You don't need to install anything.

## Running

```
npm install
npm run dev       # development server
npm run build     # static build in dist/ (works from any sub-path)
npm test          # engine simulation and API smoke tests
```

Games are saved in the browser (IndexedDB). You can export saves and import them again, and you can also import custom `.SCN` scenario files.

## Layout

- `src/runtime/`: Pascal semantics (Turbo Pascal RNG, Round, Str/Val, sets), the in-memory file system and CP437 decoding.
- `src/engine/`: the translated game units (PRIMINTR, FLEET, UPDATE, ATTACK, NPE*, NEWGAME, …), plus a UI-free API:
  - `views.js`: read-only views.
  - `commands.js`: player commands.
  - `battle.js`: interactive battles.
  - `game.js`: turn flow, save and load.
- `src/ui/`: the React interface.
- `public/data/`: the original scenarios and help file.

## Deliberate deviations from the original

- Version 11 scenarios (PRINCES.SCN) have an extra reserved field in CREATESTARBASE. The port now skips it; before, the scenario failed to load.
- Auto-attacking a construction site or stargate now actually destroys it. The original only printed the message.
- Dangling-fleet cases that could crash the original (refuel or abort orders aimed at a destroyed fleet) are guarded.

The original DOS source and release files are kept locally in `.dos/` and are not committed.
