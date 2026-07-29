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
