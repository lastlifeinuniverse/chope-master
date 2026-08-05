# Chope Master — Project Guide

## Overview
Chope Master is a casual 2D browser game inspired by Singapore hawker centre culture. The player chooses one of three characters (Cherie, Uncle Anson, or Zongyan), then must reserve a table with tissue paper, order food, survive random disruption events (wind/birds stealing the tissue), collect the meal, and eat before losing the seat. Each character has distinct stats affecting gameplay difficulty and strategy.

**Goal**: MVP playable on mobile and desktop browsers with no build step or dependencies.

**Status**: v1.3 — character selection, three interleaving random events (wind/bird/cat) all funneling into a shared ground-tissue pickup system, bird shoe-throw counterplay, cat chase-and-flee mechanic, extended round length, on-screen version number. GitHub Pages hosted at `https://lastlifeinuniverse.github.io/chope-master/`

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
- `QUEUE_WAIT_MS`, `PREP_TIME_MS`, `COLLECTION_TIMER_MS`, `CARRY_TIMER_MS`, `EAT_DURATION_MS` — pacing (scaled 1.5x in v1.3 to give events more room to interleave per round — a starting guess, not a tuned value)
- `TABLE_POSITIONS` — where tables spawn
- `NPC_COUNT`, `NPC_SIT_MS` — diner behavior
- `TISSUE_DESPAWN_MS`, `TISSUE_LAND_MARGIN`, `TISSUE_LAND_CLEARANCE` — shared ground-tissue drop/pickup system
- `BIRD_SPEED_SLOW`, `THROW_RANGE`, `THROW_COOLDOWN_MS` — bird shoe-throw counterplay
- `CAT_EVENT_CHANCE`, `CAT_SPEED`, `CAT_FLEE_RADIUS`, `CAT_FLEE_SPEED`, `CAT_GIVEUP_MS`, `CAT_HIDEOUT_POSITIONS` — cat chase mechanic

**No magic numbers in game.js or entities.js** — if you need to tweak timing or size, edit constants.js.

### Adding New Events
See `js/events.js`:
1. Design the visual (wind strokes, bird flight path) in `RandomEvents.draw()`
2. Add update logic to `updateWind()`, `updateBird()`, or `updateCat()` (duration, phases, triggering loss)
3. Call `onTissueLost()` when the table itself is actually lost
4. Call `onTelegraph()` to show warning toast before impact
5. If the event should leave something recoverable behind, spawn one via `dropTissue(x, y)` (threaded through as the last param of `RandomEvents.update()`, wired to `spawnGroundTissue()` in game.js) rather than inventing a new recovery mechanism

**Three event types exist**: wind, bird, cat. Wind/bird share one check timer + `EVENT_CHANCE` roll; the cat is rolled independently (`CAT_EVENT_CHANCE`, same `EVENT_CHECK_MS` cadence) but still gated by the same `RandomEvents.active` mutex, so only one event of any kind runs at a time.

**Shared ground-tissue system** (`G.groundTissues`, an array — multiple can exist at once since events can now overlap over a longer round): any event that wants to leave a recoverable tissue behind calls `spawnGroundTissue(x, y)`, which runs the landing point through `clampToWalkable()` (utils.js) to keep it on-canvas and clear of table footprints, then pushes a `createGroundTissue()` entity (entities.js) that the player can walk up to and interact with — a normal single `[E]` press via the existing `getAvailableAction()`/`handleInteract()` pattern, no hold required. Unclaimed ones fade/flash in their last 20% of `TISSUE_DESPAWN_MS` and then vanish for good. Retrieval only ever refunds a tissue *packet* to `G.tissueCount` — it never re-opens a lost table reservation; the player has to spend it re-choping like any other spare tissue.

**All three events now share one "immediate loss, recoverable packet" shape**: the table's fate (`state = 'empty'`, grace period via `onTissueLost()`) is always decided at the moment of the actual steal — wind's blow finishing, the bird's grab completing, the cat's grab completing — never at the end of a longer animation. What differs per event is only whether/how the stolen packet becomes recoverable afterward:
- **Wind**: always drops a recoverable tissue at the blow-direction landing spot (`updateWind()`) — the simplest case, no player input needed to make it recoverable.
- **Bird**: normally flies off clean (no drop, that packet's just gone) unless the player lands a shoe hit first. `hitBird()` is called from the player's throw input (`handleThrow()` in game.js), not from `update()`, since a hit needs to end the event immediately rather than wait for the flight animation to finish. A hit *before* the grab completes prevents the theft outright (table never even opens up); a hit *after* drops the stolen packet via `dropTissue()`. Bird flight uses `moveToward()` at `BIRD_SPEED_SLOW` (not the old fixed-duration lerp) so its position is always well-defined for a hit-detection check at any moment, and slow enough that a player can actually track and react to it.
- **Cat**: drops a recoverable tissue only if the player forces a give-up (`CAT_GIVEUP_MS` of total time spent in the `fleeing` state); if it reaches its hideout first, that packet's gone for good, no drop. While fleeing, if the player is within `CAT_FLEE_RADIUS` the cat moves on a blended vector — 60% directly away from the player, 40% toward the hideout — rather than a pure away-from-player vector, so it's always making *some* net progress toward the hideout even under pressure. This avoids two failure modes at once: a player trailing directly behind it can't force an infinite treadmill (the hideout-ward component keeps closing distance), and a player who never chases at all still lets it reach the hideout comfortably before `CAT_GIVEUP_MS` (unpressured travel time is well under the giveup threshold for any table/hideout pairing on this map) — so "don't intervene and it gets away" stays the default, and forcing a give-up requires genuinely sustained pursuit, not a fluke.

Cat movement (`CAT_SPEED`, `CAT_FLEE_SPEED`) and bird movement (`BIRD_SPEED_SLOW`) are per-frame steps like `NPC_SPEED`, not dt-scaled — consistent with how NPC movement already worked, not something this pass changed.

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

**Cache-busting**: all CSS/JS links have `?v=20260805d` query strings. Bump this version string on every push to force browsers to re-fetch instead of serving cached files. This is separate from `GAME_VERSION` in constants.js (the on-screen version label) — bump both, but they don't need to match numerically.

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
- [ ] Full game loop: chope → queue → survive wind/bird/cat → collect → deliver → eat → win
- [ ] All 4 lose conditions: out of tissue, table stolen, food expired, food abandoned
- [ ] Touch D-pad doesn't stick (finger drifts off before lifting)
- [ ] Toasts are readable and don't overlap with timer bar, prompt, or throw indicator
- [ ] Mobile viewport (375px) has no scrolling, no overlaps, no cut-off UI
- [ ] Interact prompt clears all touch buttons across screen sizes
- [ ] Rotation doesn't crash (layout may reflow, should still be playable)
- [ ] Wind, bird, and cat each tested in isolation, then with overlapping/sequential events across one longer round
- [ ] Multiple simultaneous ground tissues (e.g. an unclaimed wind drop while a cat is also fleeing) render and despawn independently
- [ ] Bird throw button doesn't stick/misfire on touch; throw count resets to 2 on each new bird event
- [ ] A shoe hit before the bird's grab prevents the theft outright; a hit after only recovers the packet, not the table
- [ ] Cat give-up/flee behavior feels fair — sustained chasing can force a give-up, a player who never chases lets it escape, neither seems impossible or free
- [ ] Ground-tissue despawn flash is visible/readable on mobile viewport
- [ ] Longer round duration doesn't make early-game feel sluggish — playtest pacing, not just correctness

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
3. Update the version string in index.html (`?v=20260805d` → `?v=20260805e`, etc.) so your changes aren't cached

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

## Changelog

### v1.3 (2026-08-05)
- **Extended round duration**: food-order pacing constants (`QUEUE_WAIT_MS`, `PREP_TIME_MS`, `COLLECTION_TIMER_MS`, `CARRY_TIMER_MS`, `EAT_DURATION_MS`) scaled 1.5x so a round runs long enough for random events to interleave more; `EVENT_CHECK_MS`/`EVENT_CHANCE` deliberately left alone, so this means more event occurrences per round, not denser ones per minute.
- **Shared ground-tissue system**: `G.groundTissues`, `spawnGroundTissue()`/`collectGroundTissue()` (game.js), `clampToWalkable()` (utils.js), `createGroundTissue()`/`drawGroundTissue()` (entities.js). A single, reusable "steal produces a recoverable dropped packet" mechanism that wind, bird, and cat all now funnel into.
- **Bird rework**: flight switched from fixed-duration lerp to speed-based movement (`BIRD_SPEED_SLOW`) so it's trackable and reactable to. Added a 2-attempt shoe-throw counterplay (`btn-throw`, `F` key, `THROW_RANGE`, `THROW_COOLDOWN_MS`) — a hit before the grab prevents the theft entirely, a hit after only recovers the packet.
- **Cat rework**: replaced the old "flee to a hideout, then hold `[E]` next to it to retrieve" design with an active chase — staying within `CAT_FLEE_RADIUS` forces evasive movement blended toward the hideout; sustained pressure for `CAT_GIVEUP_MS` makes it drop the tissue (recoverable via the shared ground system), while reaching the hideout unpressured loses it for good. `CAT_EVENT_CHANCE` replaces the old `CAT_CHANCE`, roughly half the effective bird rate. This was a deliberate redesign, not a bugfix — the earlier version made the cat strictly easier to deal with than wind/bird despite demanding more player effort, which didn't hold up.
- **On-screen version number**: `GAME_VERSION` constant, shown as a low-contrast tag on the start/win/lose screens.

---

**Last updated**: 2026-08-05  
**Hosted at**: https://lastlifeinuniverse.github.io/chope-master/  
**Repository**: https://github.com/lastlifeinuniverse/chope-master
