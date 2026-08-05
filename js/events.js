// Random events that threaten a chope'd tissue packet: wind, birds, and cats.
// Only one event is ever active at a time (per MVP spec). Wind/bird share one
// check timer + chance roll; the cat is rolled independently (its own
// CAT_EVENT_CHANCE) but still gated by the same `active` mutex so it never
// overlaps a wind/bird event (or another cat event).

const RandomEvents = {
  checkTimer: EVENT_CHECK_MS,
  catCheckTimer: EVENT_CHECK_MS,
  active: false,
  type: null, // 'wind' | 'bird' | 'cat'
  targetTable: null,
  t: 0,

  reset() {
    this.checkTimer = EVENT_CHECK_MS;
    this.catCheckTimer = EVENT_CHECK_MS;
    this.active = false;
    this.type = null;
    this.targetTable = null;
    this.t = 0;
  },

  update(dtMs, tables, player, bird, cat, onTissueLost, onTelegraph, onCatGiveUp, onCatEscaped, dropTissue) {
    if (!this.active) {
      this.checkTimer -= dtMs;
      this.catCheckTimer -= dtMs;

      if (this.checkTimer <= 0) {
        this.checkTimer = EVENT_CHECK_MS;
        const reserved = tables.filter((t) => t.state === 'reserved');
        if (!this.active && reserved.length > 0 && Math.random() < EVENT_CHANCE) {
          this.startWindOrBird(choice(reserved), bird, onTelegraph);
        }
      }

      if (!this.active && this.catCheckTimer <= 0) {
        this.catCheckTimer = EVENT_CHECK_MS;
        const reserved = tables.filter((t) => t.state === 'reserved');
        if (reserved.length > 0 && Math.random() < CAT_EVENT_CHANCE) {
          this.startCat(choice(reserved), cat, onTelegraph);
        }
      }
      return;
    }

    this.t += dtMs;
    if (this.type === 'wind') this.updateWind(onTissueLost, dropTissue);
    else if (this.type === 'bird') this.updateBird(dtMs, bird, onTissueLost);
    else if (this.type === 'cat') this.updateCat(dtMs, cat, player, onTissueLost, onCatGiveUp, onCatEscaped, dropTissue);
  },

  startWindOrBird(table, bird, onTelegraph) {
    this.active = true;
    this.targetTable = table;
    // If a previously-hit bird is still finishing its exit flight, force
    // wind instead — the bird entity is a single reused object, so starting
    // a new bird event now would teleport the still-fleeing one mid-flight.
    this.type = (Math.random() < 0.5 || bird.active) ? 'wind' : 'bird';
    this.t = 0;

    if (this.type === 'bird') {
      bird.active = true;
      bird.phase = 'in';
      bird.startX = CANVAS_W + 30;
      bird.startY = table.y - 90;
      bird.x = bird.startX;
      bird.y = bird.startY;
      bird.targetTableId = table.id;
      bird.throwsRemaining = 2;
      bird.throwCooldown = 0;
    }

    if (onTelegraph) onTelegraph(this.type, table);
  },

  updateWind(onTissueLost, dropTissue) {
    const table = this.targetTable;
    const WARN = EVENT_WARNING_MS;
    const BLOW = 1300;

    if (this.t < WARN) {
      table.tissueOffset.x = Math.sin(this.t / 40) * 2;
      return;
    }

    const t = clamp((this.t - WARN) / BLOW, 0, 1);
    table.tissueOffset.x = lerp(0, 140, t * t);
    table.tissueOffset.y = lerp(0, -30, t);
    table.tissueOpacity = 1 - t;

    if (t >= 1) {
      // Land it where the animation actually blew it to, before finishLoss()
      // resets tissueOffset back to {0,0}.
      const landX = table.x + table.tissueOffset.x;
      const landY = table.y + table.tissueOffset.y;
      this.finishLoss(table, 'wind', onTissueLost);
      if (dropTissue) dropTissue(landX, landY);
    }
  },

  updateBird(dtMs, bird, onTissueLost) {
    const table = this.targetTable;
    const GRAB = 450;

    if (bird.throwCooldown > 0) bird.throwCooldown -= dtMs;

    if (bird.phase === 'in') {
      const arrived = moveToward(bird, { x: table.x + 20, y: table.y - 18 }, BIRD_SPEED_SLOW);
      if (arrived) {
        bird.phase = 'grab';
        this.t = 0;
      }
      return;
    }

    if (bird.phase === 'grab') {
      // this.t is already accumulated by the caller in update(); don't
      // double-increment here, or GRAB finishes in half the intended time.
      table.tissueOpacity = clamp(1 - this.t / GRAB, 0, 1);
      if (this.t >= GRAB) {
        // Same immediate-loss pattern as wind/cat: the table's fate is
        // decided the instant the grab finishes, not when the bird finally
        // gets offscreen. A shoe hit during 'out' only wins back the
        // tissue packet (via ground-tissue drop), not the table.
        table.state = 'empty';
        table.tissueOffset = { x: 0, y: 0 };
        table.tissueOpacity = 1;
        bird.phase = 'out';
        bird.exitX = bird.startX;
        bird.exitY = bird.startY - 40;
        if (onTissueLost) onTissueLost(table, 'bird');
      }
      return;
    }

    if (bird.phase === 'out') {
      const arrived = moveToward(bird, { x: bird.exitX, y: bird.exitY }, BIRD_SPEED_SLOW);
      if (arrived) {
        bird.active = false;
        this.active = false;
        this.type = null;
        this.targetTable = null;
      }
    }
  },

  // Called from the player's throw input, not from update() — a shoe hit
  // ends the bird *event* immediately (table/tissue outcome is fully decided
  // right here) rather than waiting for its flight to finish. The bird
  // itself doesn't vanish though — it keeps flying off-screen on its own
  // (see updateFleeingBird() in game.js), independent of RandomEvents, so a
  // new event is free to start while it's still finishing its exit.
  // Returns whether the tissue had already been grabbed (so the caller
  // knows whether to show "prevented the theft" vs "won it back").
  hitBird(bird, dropTissue) {
    if (this.type !== 'bird' || !bird.active) return null;
    const alreadyGrabbed = bird.phase === 'grab' || bird.phase === 'out';
    if (alreadyGrabbed && dropTissue) dropTissue(bird.x, bird.y);
    bird.phase = 'out';
    bird.exitX = bird.startX;
    bird.exitY = bird.startY - 40;
    bird.fleeingAfterHit = true;
    this.active = false;
    this.type = null;
    this.targetTable = null;
    return alreadyGrabbed;
  },

  startCat(table, cat, onTelegraph) {
    this.active = true;
    this.targetTable = table;
    this.type = 'cat';
    this.t = 0;

    cat.active = true;
    cat.state = 'approaching';
    cat.x = table.x;
    cat.y = CANVAS_H + 30;
    cat.targetTableId = table.id;
    cat.hideout = choice(CAT_HIDEOUT_POSITIONS);
    cat.t = 0;
    cat.giveupTimer = 0;

    if (onTelegraph) onTelegraph('cat', table);
  },

  updateCat(dtMs, cat, player, onTissueLost, onCatGiveUp, onCatEscaped, dropTissue) {
    const table = this.targetTable;

    if (cat.state === 'approaching') {
      const arrived = moveToward(cat, { x: table.x, y: table.y + 22 }, CAT_SPEED);
      if (arrived) {
        cat.state = 'grabbing';
        cat.t = 0;
      }
      return;
    }

    if (cat.state === 'grabbing') {
      cat.t += dtMs;
      table.tissueOpacity = clamp(1 - cat.t / CAT_GRAB_MS, 0, 1);
      if (cat.t >= CAT_GRAB_MS) {
        // Same immediate-loss pattern as wind/bird: the table's fate is
        // decided the instant the grab finishes. Chasing the cat down from
        // here doesn't undo that — it only wins back the tissue *packet*.
        table.state = 'empty';
        table.tissueOffset = { x: 0, y: 0 };
        table.tissueOpacity = 1;
        cat.state = 'fleeing';
        cat.giveupTimer = 0;
        if (onTissueLost) onTissueLost(table, 'cat');
      }
      return;
    }

    if (cat.state === 'fleeing') {
      cat.giveupTimer += dtMs;
      if (cat.giveupTimer >= CAT_GIVEUP_MS) {
        cat.active = false;
        cat.state = 'idle';
        this.active = false;
        this.type = null;
        this.targetTable = null;
        if (dropTissue) dropTissue(cat.x, cat.y);
        if (onCatGiveUp) onCatGiveUp(table);
        return;
      }

      const toHideout = dist(cat, cat.hideout);
      if (toHideout <= CAT_SPEED) {
        // Reached the hideout before giving up — gone for good, no drop.
        cat.active = false;
        cat.state = 'idle';
        this.active = false;
        this.type = null;
        this.targetTable = null;
        if (onCatEscaped) onCatEscaped(table);
        return;
      }
      const hdx = (cat.hideout.x - cat.x) / toHideout;
      const hdy = (cat.hideout.y - cat.y) / toHideout;

      const toPlayer = dist(cat, player);
      if (toPlayer < CAT_FLEE_RADIUS) {
        // Evade: blend "away from player" with "toward hideout" so it's
        // always making some net progress rather than treadmilling forever
        // if the player just trails directly behind it.
        const adx = toPlayer > 0 ? (cat.x - player.x) / toPlayer : 1;
        const ady = toPlayer > 0 ? (cat.y - player.y) / toPlayer : 0;
        const dx = adx * 0.6 + hdx * 0.4;
        const dy = ady * 0.6 + hdy * 0.4;
        const len = Math.hypot(dx, dy) || 1;
        cat.x = clamp(cat.x + (dx / len) * CAT_FLEE_SPEED, 20, CANVAS_W - 20);
        cat.y = clamp(cat.y + (dy / len) * CAT_FLEE_SPEED, 20, CANVAS_H - 20);
      } else {
        cat.x += hdx * CAT_SPEED;
        cat.y += hdy * CAT_SPEED;
      }
    }
  },

  finishLoss(table, type, onTissueLost) {
    table.state = 'empty';
    table.tissueOffset = { x: 0, y: 0 };
    table.tissueOpacity = 1;
    this.active = false;
    this.type = null;
    this.targetTable = null;
    if (onTissueLost) onTissueLost(table, type);
  },

  draw(ctx) {
    if (this.active && this.type === 'wind' && this.targetTable && this.t > EVENT_WARNING_MS) {
      const table = this.targetTable;
      const alpha = clamp(0.6 - this.t / 3000, 0, 0.6);
      ctx.save();
      ctx.strokeStyle = `rgba(180, 210, 255, ${alpha})`;
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const yy = table.y - 20 + i * 14;
        ctx.beginPath();
        ctx.moveTo(table.x - 65, yy);
        ctx.lineTo(table.x - 22, yy - 6);
        ctx.stroke();
      }
      ctx.restore();
    }
  },
};
