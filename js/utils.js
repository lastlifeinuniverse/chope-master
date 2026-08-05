// Small shared helpers.

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function randInt(min, max) {
  return Math.floor(rand(min, max + 1));
}

function randRange([min, max]) {
  return rand(min, max);
}

function choice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function moveToward(pos, target, speed) {
  const d = dist(pos, target);
  if (d <= speed) {
    pos.x = target.x;
    pos.y = target.y;
    return true; // arrived
  }
  const dx = (target.x - pos.x) / d;
  const dy = (target.y - pos.y) / d;
  pos.x += dx * speed;
  pos.y += dy * speed;
  return false;
}

function fmtSeconds(ms) {
  return Math.max(0, ms / 1000).toFixed(1);
}

function clampToWalkable(x, y, tables) {
  let cx = clamp(x, TISSUE_LAND_MARGIN, CANVAS_W - TISSUE_LAND_MARGIN);
  let cy = clamp(y, TISSUE_LAND_MARGIN, CANVAS_H - TISSUE_LAND_MARGIN);

  tables.forEach((table) => {
    const d = dist({ x: cx, y: cy }, table);
    if (d < TISSUE_LAND_CLEARANCE) {
      const angle = d === 0 ? 0 : Math.atan2(cy - table.y, cx - table.x);
      cx = clamp(table.x + Math.cos(angle) * TISSUE_LAND_CLEARANCE, TISSUE_LAND_MARGIN, CANVAS_W - TISSUE_LAND_MARGIN);
      cy = clamp(table.y + Math.sin(angle) * TISSUE_LAND_CLEARANCE, TISSUE_LAND_MARGIN, CANVAS_H - TISSUE_LAND_MARGIN);
    }
  });

  return { x: cx, y: cy };
}
