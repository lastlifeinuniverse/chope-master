// Chope Master — main game loop, state machine, input, and rendering.

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

const Input = { up: false, down: false, left: false, right: false, sprint: false, interactQueue: false };

const G = {}; // mutable game state, populated by initGame()

// ---------- Setup ----------

function initGame(character) {
  character = character || CHARACTERS.cherie;
  G.player = createPlayer(character);
  G.tables = TABLE_POSITIONS.map((pos, i) => createTable(i, pos.x, pos.y));
  G.npcs = Array.from({ length: NPC_COUNT }, (_, i) => createNpc(i));
  G.bird = createBird();
  G.cat = createCat();

  G.tissueCount = character.tissues;
  G.tissueUsedCount = 0;
  G.playerSpeed = character.speed;
  G.playerSprintMult = SPRINT_MULT;

  G.foodStatus = 'not_ordered';
  G.foodTimer = 0;
  G.foodTimerMax = 1;

  G.graceActive = false;
  G.graceTableId = null;
  G.graceTimer = 0;

  G.stress = 0;
  G.closeCalls = 0;
  G.levelStartTime = performance.now();
  G.currentAction = null;

  RandomEvents.reset();

  UI.setTissueCount(G.tissueCount);
  UI.setFoodStatus('Not Ordered');
  UI.setTableIndicator(null);
  UI.setStress(0);
  UI.setActionTimer(null);
  UI.setPrompt(null);
  UI.hideAllScreens();

  G.phase = 'playing';
}

// ---------- Actions ----------

function placeTissue(table) {
  table.state = 'reserved';
  table.tissueOffset = { x: 0, y: 0 };
  table.tissueOpacity = 1;
  G.player.reservedTableId = table.id;
  G.tissueCount--;
  G.tissueUsedCount++;
  UI.setTissueCount(G.tissueCount);
  UI.setTableIndicator(table.id);
  UI.toast(`🧻 Chope! Table #${table.id + 1} is yours.`);
}

function joinQueue() {
  G.foodStatus = 'queuing';
  G.foodTimer = randRange(QUEUE_WAIT_MS);
  G.foodTimerMax = G.foodTimer;
  UI.setFoodStatus('Queuing…');
  UI.toast('🚶 Joined the queue!');
}

function collectFood() {
  G.foodStatus = 'carrying';
  G.foodTimer = CARRY_TIMER_MS;
  G.foodTimerMax = CARRY_TIMER_MS;
  G.player.carryingFood = true;
  UI.setFoodStatus('Carrying tray…');
  UI.toast('🍜 Got it — hurry back to your table!');
}

function sitAndEat(table) {
  G.foodStatus = 'delivered';
  G.player.carryingFood = false;
  G.player.eating = true;
  G.eatTimer = EAT_DURATION_MS;
  table.state = 'occupied_by_player';
  UI.setFoodStatus('Eating! 😋');
  UI.setActionTimer(null);
  UI.toast('Finally, lunch! 🎉');
}

function getAvailableAction() {
  const p = G.player;

  if (G.cat.active && G.cat.state === 'stopped_with_tissue' && dist(p, G.cat) < INTERACT_RANGE) {
    return { type: 'cat_retrieve', label: '[E] Get your tissue back from the cat!' };
  }
  if (G.cat.active && G.cat.state === 'retrieving' && dist(p, G.cat) < INTERACT_RANGE) {
    return { type: 'hint', label: 'Hold on... getting tissue back!' };
  }

  if (G.foodStatus === 'carrying') {
    const table = G.tables[p.reservedTableId];
    if (table && table.state === 'reserved' && dist(p, table) < INTERACT_RANGE) {
      return { type: 'eat', label: '[E] Sit & Eat', table };
    }
  }

  if (dist(p, QUEUE_SPOT) < INTERACT_RANGE) {
    if (G.foodStatus === 'not_ordered') {
      if (p.reservedTableId === null) return { type: 'hint', label: 'Chope a table before you queue!' };
      return { type: 'queue', label: '[E] Join Queue' };
    }
    if (G.foodStatus === 'ready') return { type: 'collect', label: '[E] Collect Food' };
    if (G.foodStatus === 'queuing' || G.foodStatus === 'preparing') {
      return { type: 'hint', label: 'Waiting for your order…' };
    }
  }

  if (p.reservedTableId === null) {
    const nearTable = G.tables.find((t) => t.state === 'empty' && dist(p, t) < INTERACT_RANGE);
    if (nearTable) {
      if (G.tissueCount > 0) return { type: 'chope', label: '[E] Place Tissue (Chope!)', table: nearTable };
      return { type: 'hint', label: 'Out of tissue packets!' };
    }
  }

  return null;
}

function handleInteract() {
  const action = getAvailableAction();
  if (!action) return;
  if (action.type === 'chope') placeTissue(action.table);
  else if (action.type === 'queue') joinQueue();
  else if (action.type === 'collect') collectFood();
  else if (action.type === 'eat') sitAndEat(action.table);
  else if (action.type === 'cat_retrieve') startCatRetrieval();
}

function startCatRetrieval() {
  G.cat.state = 'retrieving';
  G.cat.holdTimer = CAT_RETRIEVAL_HOLD_MS;
  UI.toast('🐈 Hold still, getting your tissue back...', 1400);
}

// ---------- Event callbacks ----------

function onTelegraph(type, table) {
  if (type === 'wind') UI.toast(`💨 The wind is picking up near table #${table.id + 1}...`, 1200);
  else if (type === 'bird') UI.toast(`🐦 A bird is eyeing table #${table.id + 1}...`, 1200);
  else UI.toast(`🐈 A cat is eyeing table #${table.id + 1}'s tissue...`, 1200);
}

function onCatRetrieved() {
  G.tissueCount++;
  UI.setTissueCount(G.tissueCount);
  UI.toast('🐈 Got your tissue packet back! Chope a table again to use it.');
}

function onCatEscaped(table) {
  UI.toast(`🐈 The cat got away with table #${table.id + 1}'s tissue for good...`, 1800);
}

function onTissueLost(table, type) {
  G.closeCalls++;
  G.stress = clamp(G.stress + 0.25, 0, 1);
  if (G.player.reservedTableId === table.id) G.player.reservedTableId = null;
  UI.setTableIndicator(G.player.reservedTableId);

  const label = type === 'wind' ? '💨 Wind blew your tissue off'
    : type === 'bird' ? '🐦 A bird stole your tissue from'
    : '🐈 A cat snatched the tissue from';
  UI.toast(`${label} table #${table.id + 1}!`);

  const foodOrdered = ['queuing', 'preparing', 'ready', 'carrying'].includes(G.foodStatus);
  if (!foodOrdered) return;

  if (G.tissueCount <= 0) {
    triggerLose('out_of_tissue', 'Your tissue was gone and you had no packets left to chope another table!');
    return;
  }

  G.graceActive = true;
  G.graceTableId = table.id;
  G.graceTimer = TABLE_GRACE_MS;
}

// ---------- Win / Lose ----------

function triggerLose(key, message) {
  if (G.phase !== 'playing') return;
  G.phase = 'lose';
  UI.showLose(message);
}

function winGame() {
  G.phase = 'win';
  const timeSec = ((performance.now() - G.levelStartTime) / 1000).toFixed(1);
  UI.showWin({ timeSec, tissueUsed: G.tissueUsedCount, closeCalls: G.closeCalls });
}

// ---------- Per-frame updates ----------

function updatePlayerMovement(dtMs) {
  const p = G.player;
  let dx = 0;
  let dy = 0;
  if (Input.up) dy -= 1;
  if (Input.down) dy += 1;
  if (Input.left) dx -= 1;
  if (Input.right) dx += 1;

  p.moving = dx !== 0 || dy !== 0;
  p.sprinting = Input.sprint && p.moving;

  if (p.moving) {
    const len = Math.hypot(dx, dy);
    dx /= len;
    dy /= len;
    const speed = G.playerSpeed * (Input.sprint ? G.playerSprintMult : 1) * (dtMs / 16.6667);
    p.x = clamp(p.x + dx * speed, 24, CANVAS_W - 24);
    p.y = clamp(p.y + dy * speed, 24, CANVAS_H - 24);
    p.bob += dtMs / 90;
  }
}

function updateFoodTimer(dtMs) {
  if (!['queuing', 'preparing', 'ready', 'carrying'].includes(G.foodStatus)) return;
  G.foodTimer -= dtMs;

  if (G.foodStatus === 'queuing' && G.foodTimer <= 0) {
    G.foodStatus = 'preparing';
    G.foodTimer = randRange(PREP_TIME_MS);
    G.foodTimerMax = G.foodTimer;
    UI.setFoodStatus('Preparing…');
    UI.toast('👩‍🍳 Order placed — noodles incoming!');
    return;
  }
  if (G.foodStatus === 'preparing' && G.foodTimer <= 0) {
    G.foodStatus = 'ready';
    G.foodTimer = COLLECTION_TIMER_MS;
    G.foodTimerMax = G.foodTimer;
    UI.setFoodStatus('Ready!');
    UI.toast('🍜 Order up! Go collect your food!');
    return;
  }
  if (G.foodStatus === 'ready' && G.foodTimer <= 0) {
    triggerLose('food_expired', 'Your food sat at the counter too long and the auntie gave it to someone else!');
    return;
  }
  if (G.foodStatus === 'carrying' && G.foodTimer <= 0) {
    triggerLose('food_abandoned', 'You took too long carrying your tray back — the noodles went cold and you abandoned the meal!');
  }
}

function updateGrace(dtMs) {
  if (!G.graceActive) return;
  const table = G.tables[G.graceTableId];

  if (G.player.reservedTableId !== null) {
    G.graceActive = false;
    return;
  }

  if (!table || table.state !== 'empty') {
    G.graceActive = false;
    triggerLose('table_stolen', `You didn't make it back in time — another customer sat down at table #${G.graceTableId + 1}!`);
    return;
  }

  G.graceTimer -= dtMs;
  if (G.graceTimer <= 0) {
    table.state = 'occupied_by_npc';
    table.occupantNpcId = null;
    G.graceActive = false;
    triggerLose('table_stolen', `You didn't make it back in time — another customer sat down at table #${G.graceTableId + 1}!`);
  }
}

function updateEating(dtMs) {
  if (!G.player.eating) return;
  G.eatTimer -= dtMs;
  if (G.eatTimer <= 0) {
    G.player.eating = false;
    winGame();
  }
}

function syncHud() {
  const action = getAvailableAction();
  G.currentAction = action;
  UI.setPrompt(action ? action.label : null);

  if (G.cat.active && G.cat.state === 'retrieving') {
    UI.setActionTimer(G.cat.holdTimer / CAT_RETRIEVAL_HOLD_MS, false);
  } else if (G.graceActive) {
    UI.setActionTimer(G.graceTimer / TABLE_GRACE_MS, true);
  } else if (['queuing', 'preparing', 'ready', 'carrying'].includes(G.foodStatus)) {
    const fraction = G.foodTimer / G.foodTimerMax;
    const urgent = (G.foodStatus === 'ready' || G.foodStatus === 'carrying') && fraction < 0.35;
    UI.setActionTimer(fraction, urgent);
  } else {
    UI.setActionTimer(null);
  }

  UI.setStress(G.stress);
}

function update(dtMs) {
  updatePlayerMovement(dtMs);
  G.npcs.forEach((npc) => updateNpc(npc, dtMs, G.tables));
  RandomEvents.update(dtMs, G.tables, G.player, G.bird, G.cat, onTissueLost, onTelegraph, onCatRetrieved, onCatEscaped);
  updateFoodTimer(dtMs);
  updateGrace(dtMs);
  updateEating(dtMs);

  G.stress = clamp(G.stress - dtMs / 20000, 0, 1);

  if (Input.interactQueue) {
    handleInteract();
    Input.interactQueue = false;
  }

  syncHud();
}

// ---------- Rendering ----------

function drawFloor() {
  const tile = 48;
  for (let y = 0; y < CANVAS_H; y += tile) {
    for (let x = 0; x < CANVAS_W; x += tile) {
      const even = (x / tile + y / tile) % 2 === 0;
      ctx.fillStyle = even ? '#f2e6d0' : '#ece0c8';
      ctx.fillRect(x, y, tile, tile);
    }
  }
  ctx.strokeStyle = '#c9b48c';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, CANVAS_W - 6, CANVAS_H - 6);
}

function drawQueueArea() {
  ctx.save();
  ctx.strokeStyle = 'rgba(180,60,60,0.5)';
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.moveTo(QUEUE_SPOT.x - 60, QUEUE_SPOT.y + 40);
  ctx.lineTo(QUEUE_SPOT.x, QUEUE_SPOT.y);
  ctx.lineTo(STALL.x, STALL.y + STALL.h / 2 - 10);
  ctx.stroke();
  ctx.restore();
  drawEmoji(ctx, '🚧', QUEUE_SPOT.x - 60, QUEUE_SPOT.y + 40, 22);
  drawEmoji(ctx, '🚧', QUEUE_SPOT.x, QUEUE_SPOT.y, 22);
}

function drawStall() {
  ctx.save();
  ctx.fillStyle = '#c0453b';
  ctx.fillRect(STALL.x - STALL.w / 2, STALL.y - STALL.h / 2, STALL.w, 26);
  ctx.fillStyle = '#e8d9b8';
  ctx.fillRect(STALL.x - STALL.w / 2, STALL.y - STALL.h / 2 + 26, STALL.w, STALL.h - 26);
  ctx.strokeStyle = '#8a5a3b';
  ctx.lineWidth = 3;
  ctx.strokeRect(STALL.x - STALL.w / 2, STALL.y - STALL.h / 2 + 26, STALL.w, STALL.h - 26);
  ctx.restore();

  drawEmoji(ctx, '🧑‍🍳', STALL.x, STALL.y - 6, 30);

  ctx.save();
  ctx.font = 'bold 12px sans-serif';
  ctx.fillStyle = '#5a3d2b';
  ctx.textAlign = 'center';
  ctx.fillText("Auntie Lucy's Noodles", STALL.x, STALL.y + STALL.h / 2 - 12);
  ctx.restore();

  if (G.foodStatus === 'ready') {
    drawEmoji(ctx, '❗', STALL.x + STALL.w / 2 - 6, STALL.y - STALL.h / 2, 22);
  }
}

function draw() {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  drawFloor();
  drawQueueArea();
  drawStall();

  const drawables = [
    ...G.tables.map((t) => ({ y: t.y, fn: () => drawTable(ctx, t, t.id === G.player.reservedTableId) })),
    ...G.npcs.map((n) => ({ y: n.y, fn: () => drawNpc(ctx, n) })),
    { y: G.player.y, fn: () => drawPlayer(ctx, G.player) },
  ];
  if (G.cat.active) drawables.push({ y: G.cat.y, fn: () => drawCat(ctx, G.cat) });
  drawables.sort((a, b) => a.y - b.y);
  drawables.forEach((d) => d.fn());

  drawBird(ctx, G.bird);
  RandomEvents.draw(ctx);
}

// ---------- Main loop ----------

let lastTime = performance.now();
function loop(now) {
  const dtMs = Math.min(now - lastTime, 50);
  lastTime = now;

  if (G.phase === 'playing') update(dtMs);
  draw();

  requestAnimationFrame(loop);
}

// ---------- Input binding ----------

function bindInput() {
  window.addEventListener('keydown', (e) => {
    switch (e.key) {
      case 'ArrowUp': case 'w': case 'W': Input.up = true; break;
      case 'ArrowDown': case 's': case 'S': Input.down = true; break;
      case 'ArrowLeft': case 'a': case 'A': Input.left = true; break;
      case 'ArrowRight': case 'd': case 'D': Input.right = true; break;
      case 'Shift': Input.sprint = true; break;
      case 'e': case 'E': case ' ':
        if (!e.repeat) Input.interactQueue = true;
        e.preventDefault();
        break;
      default: break;
    }
  });

  window.addEventListener('keyup', (e) => {
    switch (e.key) {
      case 'ArrowUp': case 'w': case 'W': Input.up = false; break;
      case 'ArrowDown': case 's': case 'S': Input.down = false; break;
      case 'ArrowLeft': case 'a': case 'A': Input.left = false; break;
      case 'ArrowRight': case 'd': case 'D': Input.right = false; break;
      case 'Shift': Input.sprint = false; break;
      default: break;
    }
  });

  // Track which flag each active touch/pointer is holding down, keyed by
  // pointerId. Release is handled at the window level (not on the button
  // itself) because on real touchscreens a finger easily drifts off a small
  // button before lifting, and the button's own pointerup/pointerleave can
  // then never fire — leaving that direction stuck "on" forever.
  const pointerFlags = new Map();

  const bindHold = (id, flag) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      pointerFlags.set(ev.pointerId, flag);
      Input[flag] = true;
    });
  };
  bindHold('btn-up', 'up');
  bindHold('btn-down', 'down');
  bindHold('btn-left', 'left');
  bindHold('btn-right', 'right');
  bindHold('btn-sprint', 'sprint');

  const releasePointer = (ev) => {
    const flag = pointerFlags.get(ev.pointerId);
    if (flag) {
      Input[flag] = false;
      pointerFlags.delete(ev.pointerId);
    }
  };
  window.addEventListener('pointerup', releasePointer);
  window.addEventListener('pointercancel', releasePointer);

  // Extra safety net: if a touch ends without ever delivering pointerup/
  // pointercancel at all (app switch, incoming call, OS alert mid-hold),
  // drop every held direction rather than leave Cherie walking forever.
  const releaseAllMovement = () => {
    Input.up = false;
    Input.down = false;
    Input.left = false;
    Input.right = false;
    Input.sprint = false;
    pointerFlags.clear();
  };
  window.addEventListener('blur', releaseAllMovement);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) releaseAllMovement();
  });

  const interactBtn = document.getElementById('btn-interact');
  if (interactBtn) {
    interactBtn.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      Input.interactQueue = true;
    });
  }
}

function bindButtons() {
  document.getElementById('btn-start').addEventListener('click', showCharacterSelect);
  document.getElementById('btn-play-again').addEventListener('click', showCharacterSelect);
  document.getElementById('btn-try-again').addEventListener('click', showCharacterSelect);

  // Character select buttons
  Object.entries(CHARACTERS).forEach(([key, char]) => {
    const btn = document.getElementById(`btn-char-${key}`);
    if (btn) {
      btn.addEventListener('click', () => {
        initGame(char);
        G.phase = 'playing';
        UI.hideAllScreens();
      });
    }
  });
}

function showCharacterSelect() {
  UI.showCharacterSelect();
}

function boot() {
  UI.init();
  initGame(CHARACTERS.cherie);
  G.phase = 'start';
  UI.showStart();
  bindInput();
  bindButtons();
  requestAnimationFrame(loop);
}

window.addEventListener('DOMContentLoaded', boot);
