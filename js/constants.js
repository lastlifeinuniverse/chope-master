// Chope Master — tunable constants. Change these to rebalance the game.

const GAME_VERSION = '1.3.0';

const CANVAS_W = 960;
const CANVAS_H = 600;

const PLAYER_SPEED = 2.4;
const SPRINT_MULT = 1.9;
const NPC_SPEED = 1.1;

const INTERACT_RANGE = 46;

// Bird shoe-throw mechanic — bird flies slowly enough to track and react to;
// player gets 2 throws to knock the tissue loose before it gets away clean.
const BIRD_SPEED_SLOW = 1.0; // px/frame, slower than NPC_SPEED so it's trackable
const THROW_RANGE = 180;
const THROW_COOLDOWN_MS = 500;
const SHOE_FLIGHT_MS = 250; // purely visual — hit/miss is resolved instantly, this just animates it
const BIRD_HIT_FLEE_SPEED = 2.5; // px/frame — startled flight after a hit, faster than the normal approach

const TISSUE_START_COUNT = 3;
const TABLE_COUNT = 5;

// Random event timing (wind / bird) — only fires while a table is reserved.
const EVENT_CHECK_MS = 3200;
const EVENT_CHANCE = 0; // TEMP: wind/bird disabled for cat-only testing — restore to 0.30 when done
const EVENT_WARNING_MS = 900; // brief telegraph before the event actually hits

// Ground tissue — dropped by wind/bird/cat, walk up + interact to reclaim it.
// Multiple instances can exist at once (an array, not a single object) since
// events can now overlap over a longer round.
const TISSUE_DESPAWN_MS = 9000;
const TISSUE_LAND_MARGIN = 24; // matches the player's own canvas-edge clamp
const TISSUE_LAND_CLEARANCE = 55; // keeps landing spot clear of a table's footprint

// Food order timing — scaled 1.5x from v1.2 values (1000/2200, 7000/12000,
// 9000, 14000) to lengthen the round so wind/bird/cat events get more
// chances to trigger and interleave per playthrough. 1.5x is a starting
// guess, not a tuned value — revisit after playtesting; EVENT_CHECK_MS/
// EVENT_CHANCE deliberately weren't scaled alongside it, so a longer round
// means more event occurrences rather than denser ones per minute.
const QUEUE_WAIT_MS = [1500, 3300];
const PREP_TIME_MS = [10500, 18000];
const COLLECTION_TIMER_MS = 13500; // must collect once ready before it's abandoned
const CARRY_TIMER_MS = 21000; // must deliver once carrying before it's abandoned

// If tissue is lost, player has this long to re-chope before a table is up for grabs
const TABLE_GRACE_MS = 8000;

// NPC diners wandering in to steal empty tables
const NPC_COUNT = 2;
const NPC_SIT_MS = [9000, 16000];
const NPC_RETARGET_MS = 4000;

// Cat event — sneaks up on a reserved table and steals the tissue (same
// immediate table-loss consequence as wind/bird: grace period starts right
// away). Then it's a chase: staying close forces it into evasive movement
// away from the player, blended with its own drive toward a hideout. Corner
// it long enough (CAT_GIVEUP_MS of total flee time) and it drops the tissue
// on the ground — same shared pickup as a wind drop. Let it reach the
// hideout first and the tissue's gone for good, no ground drop.
// Rolled independently from the wind/bird pool (own CAT_EVENT_CHANCE) but
// reuses EVENT_CHECK_MS as its cadence and shares the "only one event
// active at a time" mutex. Default is roughly half the effective bird rate
// (EVENT_CHANCE * 0.5 for bird alone) since a chase is a bigger time
// investment than dodging wind/bird — flag as tunable.
const CAT_SPEED = 2.6; // px/frame, calm travel speed (unpressured approach / unchased flee)
const CAT_EVENT_CHANCE = 0.075;
const CAT_GRAB_MS = 500; // pause at the table while the tissue fades out
const CAT_HIDEOUT_POSITIONS = [
  { x: 60, y: 560 },
  { x: 900, y: 560 },
  { x: 480, y: 40 },
];
const CAT_MIN_HIDEOUT_DIST = 250; // a hideout closer than this to the target table is skipped — table #1 sits only ~110px from {480,40}, close enough that the cat could reach it in ~1s no matter how well the player chases
const CAT_FLEE_RADIUS = 220; // player proximity that triggers evasive movement — generous, so you don't need to be right on top of it
const CAT_FLEE_SPEED = 2.0; // px/frame while actively evading — deliberately slower than calm CAT_SPEED and every character's base PLAYER_SPEED, so any character can keep pace on foot, sprint not required
const CAT_GIVEUP_MS = 10500; // total time fleeing before it drops the tissue and bolts (bumped 50% from 7000 to give a sustained chase a realistic chance)

const EAT_DURATION_MS = 4500; // also scaled 1.5x, see food order timing note above

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
