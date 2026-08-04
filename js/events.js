// Random events that threaten a chope'd tissue packet: wind, birds, and cats.
// Only one event is ever active at a time (per MVP spec). Wind/bird share one
// check timer + chance roll; the cat is rolled independently (its own
// CAT_CHANCE) but still gated by the same `active` mutex so it never overlaps
// a wind/bird event (or another cat event).

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

  update(dtMs, tables, player, bird, cat, onTissueLost, onTelegraph, onCatRetrieved, onCatEscaped) {
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
        if (reserved.length > 0 && Math.random() < CAT_CHANCE) {
          this.startCat(choice(reserved), cat, onTelegraph);
        }
      }
      return;
    }

    this.t += dtMs;
    if (this.type === 'wind') this.updateWind(onTissueLost);
    else if (this.type === 'bird') this.updateBird(bird, onTissueLost);
    else if (this.type === 'cat') this.updateCat(dtMs, cat, player, onTissueLost, onCatRetrieved, onCatEscaped);
  },

  startWindOrBird(table, bird, onTelegraph) {
    this.active = true;
    this.targetTable = table;
    this.type = Math.random() < 0.5 ? 'wind' : 'bird';
    this.t = 0;

    if (this.type === 'bird') {
      bird.active = true;
      bird.phase = 'in';
      bird.startX = CANVAS_W + 30;
      bird.startY = table.y - 90;
      bird.x = bird.startX;
      bird.y = bird.startY;
      bird.targetTableId = table.id;
    }

    if (onTelegraph) onTelegraph(this.type, table);
  },

  updateWind(onTissueLost) {
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

    if (t >= 1) this.finishLoss(table, 'wind', onTissueLost);
  },

  updateBird(bird, onTissueLost) {
    const table = this.targetTable;
    const FLY_IN = 650;
    const GRAB = 450;
    const FLY_OUT = 650;

    if (bird.phase === 'in') {
      const t = clamp(this.t / FLY_IN, 0, 1);
      bird.x = lerp(bird.startX, table.x + 20, t);
      bird.y = lerp(bird.startY, table.y - 18, t);
      if (t >= 1) {
        bird.phase = 'grab';
        this.t = 0;
      }
      return;
    }

    if (bird.phase === 'grab') {
      const t = clamp(this.t / GRAB, 0, 1);
      table.tissueOpacity = 1 - t;
      if (t >= 1) {
        bird.phase = 'out';
        this.t = 0;
      }
      return;
    }

    if (bird.phase === 'out') {
      const t = clamp(this.t / FLY_OUT, 0, 1);
      bird.x = lerp(table.x + 20, bird.startX, t);
      bird.y = lerp(table.y - 18, bird.startY - 40, t);
      if (t >= 1) {
        bird.active = false;
        this.finishLoss(table, 'bird', onTissueLost);
      }
    }
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
    cat.windowTimer = 0;
    cat.holdTimer = 0;

    if (onTelegraph) onTelegraph('cat', table);
  },

  updateCat(dtMs, cat, player, onTissueLost, onCatRetrieved, onCatEscaped) {
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
        // The steal is real the instant the cat has it — same immediate
        // consequence as a successful wind/bird hit (table opens up, grace
        // period starts). Chasing the cat down doesn't undo the table loss;
        // it only wins back the tissue *packet* for later use.
        table.state = 'empty';
        table.tissueOffset = { x: 0, y: 0 };
        table.tissueOpacity = 1;
        cat.state = 'fleeing';
        if (onTissueLost) onTissueLost(table, 'cat');
      }
      return;
    }

    if (cat.state === 'fleeing') {
      // Retrieval window starts once the cat actually settles at its hideout,
      // not from when it starts running — flee duration varies with distance
      // and framerate, and starting the clock earlier could burn away the
      // player's whole window before the cat is even catchable.
      const arrived = moveToward(cat, cat.hideout, CAT_SPEED);
      if (arrived) {
        cat.state = 'stopped_with_tissue';
        cat.windowTimer = CAT_RETRIEVAL_WINDOW_MS;
      }
      return;
    }

    // stopped_with_tissue and retrieving share the retrieval-window countdown.
    // The table's fate was already decided at grab time above, so a timeout
    // here just means the packet itself is gone for good — no further table
    // consequence, hence no onTissueLost() call this time.
    cat.windowTimer -= dtMs;
    if (cat.windowTimer <= 0) {
      cat.active = false;
      cat.state = 'idle';
      this.active = false;
      this.type = null;
      this.targetTable = null;
      if (onCatEscaped) onCatEscaped(table);
      return;
    }

    if (cat.state === 'retrieving') {
      if (dist(player, cat) >= INTERACT_RANGE) {
        // wandered off mid-retrieval — must walk back and start again
        cat.state = 'stopped_with_tissue';
        return;
      }
      cat.holdTimer -= dtMs;
      if (cat.holdTimer <= 0) {
        cat.active = false;
        cat.state = 'idle';
        this.active = false;
        this.type = null;
        this.targetTable = null;
        if (onCatRetrieved) onCatRetrieved(table);
      }
    }
    // stopped_with_tissue: just waiting for the player to walk up and interact
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
