// Random events that threaten a chope'd tissue packet: wind & birds.
// Only one event is ever active at a time (per MVP spec).

const RandomEvents = {
  checkTimer: EVENT_CHECK_MS,
  active: false,
  type: null, // 'wind' | 'bird'
  targetTable: null,
  t: 0,

  reset() {
    this.checkTimer = EVENT_CHECK_MS;
    this.active = false;
    this.type = null;
    this.targetTable = null;
    this.t = 0;
  },

  update(dtMs, tables, bird, onTissueLost, onTelegraph) {
    if (!this.active) {
      this.checkTimer -= dtMs;
      if (this.checkTimer <= 0) {
        this.checkTimer = EVENT_CHECK_MS;
        const reserved = tables.filter((t) => t.state === 'reserved');
        if (reserved.length > 0 && Math.random() < EVENT_CHANCE) {
          this.start(choice(reserved), bird, onTelegraph);
        }
      }
      return;
    }

    this.t += dtMs;
    if (this.type === 'wind') this.updateWind(onTissueLost);
    else if (this.type === 'bird') this.updateBird(bird, onTissueLost);
  },

  start(table, bird, onTelegraph) {
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
