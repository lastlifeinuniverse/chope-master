# Chope Master — Project Guide

## Overview
Chope Master is a casual 2D browser game inspired by Singapore hawker centre culture. The player chooses one of three characters (Cherie, Uncle Anson, or Zongyan), then must reserve a table with tissue paper, order food, survive random disruption events (wind/birds stealing the tissue), collect the meal, and eat before losing the seat. Each character has distinct stats affecting gameplay difficulty and strategy.

**Goal**: MVP playable on mobile and desktop browsers with no build step or dependencies.

**Status**: MVP complete with character selection. GitHub Pages hosted at `https://lastlifeinuniverse.github.io/chope-master/`

---

## Architecture

### Tech Stack
- **HTML5 Canvas** for rendering (no sprite assets, emoji-based art)
- **Vanilla JavaScript** (no frameworks, no build tools)
- **Self-contained**: single HTML file + one CSS + modular JS modules (all in git)
- **Responsive**: scales from mobile portrait (375px) to desktop (1280px)

### File Structure
```
chope-master/
├── index.html              # Entry point (canvas, HUD markup, screen overlays)
├── style.css               # All styling (responsive, touch controls, overlays)
└── js/
    ├── constants.js        # Tunable values (speeds, timers, positions, counts)
    ├── utils.js            # Helpers (distance, lerp, formatting, etc.)
    ├── entities.js         # Player, NPCs, tables, drawing functions
    ├── events.js           # Random wind/bird event system
    ├── ui.js               # DOM manipulation (HUD, toasts, screens)
    └── game.js             # Main loop, state machine, input binding
```

### Characters

Three selectable characters, each with distinct stats that affect gameplay:

| Character | Emoji | Speed | Tissues | Playstyle |
|-----------|-------|-------|---------|-----------|
| **Cherie** | 👸 | 2.4 (normal) | 3 | Balanced, good all-rounder |
| **Uncle Anson** | 🦍 | 1.6 (slow) | 5 | Tank build, forgiving difficulty |
| **Zongyan** | 🧚 | 3.2 (fast) | 2 | High-risk/high-reward speedrun |

Character data lives in `constants.js` (the `CHARACTERS` object). When a player selects a character at the start screen, that character's `speed` and `tissues` values are copied into the game state (`G.playerSpeed`, `G.tissueCount`). The character object is also stored on the player entity, so the emoji renders correctly in `drawPlayer()`.

**Character select flow**:
1. Boot shows character-select screen (not start screen)
2. Player clicks a character's "Select" button
3. `initGame(character)` initializes with that character's stats
4. Game enters playing phase

### Core Concepts

**Game State** (`G` global object in game.js):
- Player position, movement, food-carrying status, reserved table
- Table array with state (empty, reserved, occupied_by_player, occupied_by_npc)
- NPC array tracking diners walking/sitting
- Food status machine (not_ordered → queuing → preparing → ready → carrying → delivered)
- Timers for queuing, prep, collection, carry, eating
- Grace period (when tissue lost but haven't rechoped yet)

**Event Loop** (`requestAnimationFrame`):
1. Tick input (keyboard/touch held flags)
2. Update player movement
3. Update NPC AI
4. Check random events (wind/bird)
5. Tick all timers
6. Draw everything sorted by Y (painter's algorithm for depth)

**Lose Conditions** (checked in `updateFoodTimer()` and `updateGrace()`):
- Tissue count hits 0 while food is ordered → `out_of_tissue`
- Grace period expires before rechoping → `table_stolen`
- Food ready timer expires → `food_expired`
- Carry timer expires → `food_abandoned`

**Win Condition**:
- Eat timer completes → `winGame()` shows stats and replay button

---

## Development Patterns

### Tuning the Game
All game balance lives in `js/constants.js` at the top level:
- `PLAYER_SPEED`, `SPRINT_MULT` — movement feel
- `EVENT_CHECK_MS`, `EVENT_CHANCE` — how often wind/bird strike
- `QUEUE_WAIT_MS`, `PREP_TIME_MS`, `COLLECTION_TIMER_MS`, `CARRY_TIMER_MS` — pacing
- `TABLE_POSITIONS` — where tables spawn
- `NPC_COUNT`, `NPC_SIT_MS` — diner behavior

**No magic numbers in game.js or entities.js** — if you need to tweak timing or size, edit constants.js.

### Adding New Events
See `js/events.js`:
1. Design the visual (wind strokes, bird flight path) in `RandomEvents.draw()`
2. Add update logic to `updateWind()` or `updateBird()` (duration, phases, triggering loss)
3. Call `onTissueLost()` when event succeeds
4. Call `onTelegraph()` to show warning toast before impact

**Three event types exist**: wind, bird, cat. Wind/bird share one check timer + `EVENT_CHANCE` roll; the cat is rolled independently (`CAT_CHANCE`, same `EVENT_CHECK_MS` cadence) but still gated by the same `RandomEvents.active` mutex, so only one event of any kind runs at a time.

The cat's table consequence is identical to wind/bird: the instant the grab animation finishes, `onTissueLost(table, 'cat')` fires immediately — table opens up (`state = 'empty'`), grace period starts, same as always. Chasing the cat down does **not** undo that; it only wins back the tissue *packet* into `G.tissueCount` (via `onCatRetrieved`), which the player then has to spend re-choping a table (the same one, if it's still free within the grace period, or a different one) just like any other spare tissue. This was a deliberate correction from an earlier version where retrieval silently restored the table reservation for free — that made the cat strictly easier to deal with than wind/bird despite requiring more effort, which didn't make sense.

If the player never catches up (window in `stopped_with_tissue`/`retrieving` runs out), `onCatEscaped()` fires — just a closure toast, since the real loss already happened at grab time; there's no second `onTissueLost()` call and no tissue-count penalty beyond the original theft.

**Timing gotcha**: the retrieval window starts counting only once the cat *arrives* at its hideout (`stopped_with_tissue`), not when it starts fleeing. Flee duration varies with distance-to-hideout and framerate (`CAT_SPEED` is a per-frame step like `NPC_SPEED`, not dt-scaled), so starting the clock earlier could burn away the player's whole window before the cat is even catchable — this was caught by simulating a sustained 20fps/50ms-per-frame worst case (the ceiling `loop()` clamps dt to) during testing.

### Rendering Order
All drawables in `draw()` are sorted by Y position before rendering (painter's algorithm). This keeps depth correct as sprites move around. If you add a new entity, add it to the `drawables` array in `draw()` with a Y value.

### Touch Input Handling
- D-pad buttons (`btn-up/down/left/right`) and Sprint/Interact (`btn-sprint/btn-interact`) set flags in the global `Input` object
- Movement is **not** queued — held flags drive continuous motion each frame
- **Pointer release is tracked globally** (not per-button) by `pointerId` in a Map, so a finger that drifts off a button still stops when it lifts anywhere on screen
- Fallback: blur/visibilitychange clears all movement flags in case the app switches mid-hold

### Styling & Responsive Design

**Canvas sizing**: `max-width: 960px`, scales to fill viewport width, locked to 960:600 aspect ratio (landscape). On narrow phones, this makes the canvas short; all overlays and controls are positioned relative to the canvas box.

**Touch controls**: fixed pixel sizes (32px D-pad buttons, 38-46px action buttons) in `#touch-controls`, positioned absolute within the canvas box. They DON'T scale with the canvas — as the canvas shrinks, they become a larger visual fraction.

**Overlays** (start/win/lose screens, toasts, interact-prompt): most moved to `position: fixed` (full viewport) in last iterations to avoid being clipped by the aspect-ratio box. Interact-prompt uses `bottom: calc(5% + 85px)` to clear the D-pad regardless of screen size.

**Cache-busting**: all CSS/JS links have `?v=20260729a` query strings. Bump this version string on every push to force browsers to re-fetch instead of serving cached files.

---

## Known Issues & Tech Debt

### Orientation
- **Portrait only**: landscape would work at data level (no orientation-dependent logic) but canvas sizing isn't optimized for it; would need height-based constraints and extra testing.
- **No orientation lock API**: relies on user not rotating their phone mid-game (gracefully handles if they do, but layout might reflow).

### Emoji Rendering
- Art is emoji-based (browser's own emoji font)
- Some platforms (old Android, some browsers) render emojis oddly
- 🧻 tissue emoji may look different on different devices
- **Avoid ZWJ (zero-width-joiner) emoji sequences for canvas-rendered characters** — e.g. `👩‍🎨` is actually two codepoints (woman + palette) glued by an invisible joiner. `ctx.fillText` doesn't reliably shape these into one glyph across platforms; on iOS Safari it rendered with a skewed anchor point, making the character look misaligned inside its circle even though the circle itself was positioned correctly. Stick to single-codepoint emoji (`👸`, `🦍`, `🧚`, `🐱`, `🦄`, etc.) for anything drawn via canvas.
- Consider upgrading to custom SVG/sprite art if visual consistency matters for future releases

### NPC Behavior
- NPCs only chase empty tables; don't interact with player or block paths
- Sitting duration is random but not influenced by game state
- No "looking for a table" behavior if they can't find one quickly
- Could be extended with more nuanced AI (greeting player, table preference, etc.)

### Performance
- No optimization for large sprite counts
- Canvas is redrawn every frame (no dirty-rect or offscreen rendering)
- Currently fine for 2 NPCs + 1 player + 5 tables + UI, but would struggle with 50+ entities
- No asset preloading (all drawing is immediate in-frame)

### Accessibility
- No keyboard-only mode (touch/click only for now)
- No screen reader support
- Color contrast is reasonable but not WCAG-tested
- Game text is English only

---

## Testing & Deployment

### Local Testing
```bash
cd chope-master
python3 -m http.server 8934
# Open http://localhost:8934/index.html in browser
# Test at mobile (375px) and desktop (1280px) viewports
```

### Test Checklist
- [ ] Full game loop: chope → queue → survive wind/bird → collect → deliver → eat → win
- [ ] All 4 lose conditions: out of tissue, table stolen, food expired, food abandoned
- [ ] Touch D-pad doesn't stick (finger drifts off before lifting)
- [ ] Toasts are readable and don't overlap with timer bar or prompt
- [ ] Mobile viewport (375px) has no scrolling, no overlaps, no cut-off UI
- [ ] Interact prompt clears all touch buttons across screen sizes
- [ ] Rotation doesn't crash (layout may reflow, should still be playable)

### Deployment
- All changes committed to git
- Push to `origin main` (GitHub)
- GitHub Pages auto-deploys from `/` in `main` branch
- Live at `https://lastlifeinuniverse.github.io/chope-master/`
- Cache-busting via `?v=` query strings means changes appear within ~5 min (on first hard refresh)

---

## Future Roadmap

### Short Term (Polish MVP)
- [ ] Add the "curious child" tissue-loss event (designed, not implemented)
- [ ] Tweak timers/difficulty based on playtester feedback
- [ ] Consider orientation-lock (portrait-only vs. responsive landscape)

### Medium Term (Progression)
- [ ] Multiple meals/levels; each level unlocks with a different food
- [ ] High score tracking (localStorage)
- [ ] Difficulty modes (easy: longer timers, hard: shorter, more events)
- [ ] Stress meter actually affects gameplay (higher stress = slower movement?)

### Longer Term (Polish & Variety)
- [ ] Custom sprite art instead of emoji
- [ ] Multiple hawker centres with different layouts
- [ ] More stall types (noodles, rice, dessert, etc.)
- [ ] Audio (SFX for wind, birds, food ready; ambient hawker centre chatter)
- [ ] Cosmetic unlocks (Cherie outfit skins, stall themes)
- [ ] Local multiplayer (turn-based pass-and-play on same phone)

### Nice-to-Haves (Future Major Release)
- [ ] Tutorial/onboarding screen (how to play)
- [ ] Settings (sound toggle, difficulty select)
- [ ] Pause menu (mid-game)
- [ ] Share score (generate screenshot or text)
- [ ] Leaderboard (if server-backed)
- [ ] Landscape mode fully supported & optimized

---

## How to Contribute to This Project

**Before making changes**:
1. Read this file and the relevant source file (constants.js for balance, game.js for logic, style.css for layout)
2. Test locally before pushing
3. Update the version string in index.html (`?v=20260729a` → `?v=20260729b`, etc.) so your changes aren't cached

**Commit messages**:
- Start with a short summary (under 70 chars)
- Follow with details on *why* the change (not just what changed)
- Example: "Increase bird speed to 1.5x — events felt too rare on fast internet"

**Code style**:
- No comments unless the *why* is non-obvious
- Use clear variable names (not `x`, but `playerX` or `tableY`)
- Keep game logic in game.js, rendering in entities.js, styling in CSS, tuning in constants.js
- Test on mobile before declaring victory

---

**Last updated**: 2026-08-03  
**Hosted at**: https://lastlifeinuniverse.github.io/chope-master/  
**Repository**: https://github.com/lastlifeinuniverse/chope-master
