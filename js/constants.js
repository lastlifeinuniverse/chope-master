// Chope Master — tunable constants. Change these to rebalance the game.

const CANVAS_W = 960;
const CANVAS_H = 600;

const PLAYER_SPEED = 2.4;
const SPRINT_MULT = 1.9;
const NPC_SPEED = 1.1;

const INTERACT_RANGE = 46;

const TISSUE_START_COUNT = 3;
const TABLE_COUNT = 5;

// Random event timing (wind / bird) — only fires while a table is reserved.
const EVENT_CHECK_MS = 3200;
const EVENT_CHANCE = 0.30;
const EVENT_WARNING_MS = 900; // brief telegraph before the event actually hits

// Food order timing
const QUEUE_WAIT_MS = [1000, 2200];
const PREP_TIME_MS = [7000, 12000];
const COLLECTION_TIMER_MS = 9000; // must collect once ready before it's abandoned
const CARRY_TIMER_MS = 14000; // must deliver once carrying before it's abandoned

// If tissue is lost, player has this long to re-chope before a table is up for grabs
const TABLE_GRACE_MS = 8000;

// NPC diners wandering in to steal empty tables
const NPC_COUNT = 2;
const NPC_SIT_MS = [9000, 16000];
const NPC_RETARGET_MS = 4000;

// Cat event — sneaks up on a reserved table, steals the tissue, and flees to
// a hideout. Player can chase it down and hold position nearby to get it
// back before the retrieval window runs out. Rolled independently from the
// wind/bird pool (own CAT_CHANCE) but reuses EVENT_CHECK_MS as its cadence
// and shares the same "only one event active at a time" mutex.
const CAT_SPEED = 2.6; // px/frame, ground movement (unscaled, matches NPC_SPEED style)
const CAT_CHANCE = 0.22;
const CAT_GRAB_MS = 500; // pause at the table while the tissue fades out
const CAT_HIDEOUT_POSITIONS = [
  { x: 60, y: 560 },
  { x: 900, y: 560 },
  { x: 480, y: 40 },
];
const CAT_RETRIEVAL_HOLD_MS = 2200; // must stay next to the cat this long to retrieve it
const CAT_RETRIEVAL_WINDOW_MS = 11000; // total time the cat holds the tissue before it's gone for good

const EAT_DURATION_MS = 3000;

const TABLE_POSITIONS = [
  { x: 250, y: 190 },
  { x: 470, y: 150 },
  { x: 690, y: 200 },
  { x: 330, y: 365 },
  { x: 560, y: 330 },
];

const STALL = { x: 820, y: 320, w: 120, h: 150 };
const QUEUE_SPOT = { x: 760, y: 340 };
const SPAWN_POINT = { x: 90, y: 500 };
const NPC_SPAWN_POINTS = [
  { x: 40, y: 60 },
  { x: 920, y: 60 },
];

// Characters
const CHARACTERS = {
  cherie: {
    name: 'Cherie',
    emoji: '👸',
    desc: 'Balanced. Good at everything.',
    speed: 2.4,
    tissues: 3,
    color: '#e879ac',
    strokeColor: '#b8447e',
  },
  anson: {
    name: 'Uncle Anson',
    emoji: '🦍',
    desc: 'Slow but tanky. 5 tissues!',
    speed: 1.6,
    tissues: 5,
    color: '#7ea3c9',
    strokeColor: '#4f7398',
    flipEmoji: true,
  },
  zongyan: {
    name: 'Zongyan',
    emoji: '🧚',
    desc: 'Quick but risky. Only 2 tissues.',
    speed: 3.2,
    tissues: 2,
    color: '#b895e0',
    strokeColor: '#8763b8',
  },
};
