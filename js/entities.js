// Entity factories, drawing, and (for simple NPCs) their behaviour.

function drawEmoji(ctx, emoji, x, y, size = 28) {
  ctx.save();
  ctx.font = `${size}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, x, y);
  ctx.restore();
}

// ---------- Table ----------

function createTable(id, x, y) {
  return {
    id,
    x,
    y,
    state: 'empty', // empty | reserved | occupied_by_player | occupied_by_npc
    tissueOffset: { x: 0, y: 0 },
    tissueOpacity: 1,
    occupantNpcId: null,
  };
}

function drawTable(ctx, table, isPlayersTable) {
  const { x, y } = table;

  if (isPlayersTable && table.state === 'reserved') {
    const pulse = 3 + Math.sin(Date.now() / 200) * 2;
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 196, 0, 0.9)';
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.arc(x, y, 40 + pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // chairs
  ctx.fillStyle = '#8a5a3b';
  [
    [-32, -2],
    [32, -2],
    [0, -32],
    [0, 28],
  ].forEach(([dx, dy]) => {
    ctx.fillRect(x + dx - 7, y + dy - 7, 14, 14);
  });

  // table top
  ctx.fillStyle = '#d9b98a';
  ctx.beginPath();
  ctx.arc(x, y, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#b08a5c';
  ctx.lineWidth = 2;
  ctx.stroke();

  if (table.state === 'reserved') {
    ctx.save();
    ctx.globalAlpha = clamp(table.tissueOpacity, 0, 1);
    drawEmoji(ctx, '🧻', x + table.tissueOffset.x, y + table.tissueOffset.y, 24);
    ctx.restore();
  } else if (table.state === 'occupied_by_npc') {
    drawEmoji(ctx, '🍲', x, y, 20);
  } else if (table.state === 'occupied_by_player') {
    drawEmoji(ctx, '🍜', x, y, 20);
  }

  ctx.save();
  ctx.font = '11px sans-serif';
  ctx.fillStyle = 'rgba(80,60,40,0.65)';
  ctx.textAlign = 'center';
  ctx.fillText(`#${table.id + 1}`, x, y + 46);
  ctx.restore();
}

// ---------- Player ----------

function createPlayer(character) {
  character = character || CHARACTERS.cherie;
  return {
    x: SPAWN_POINT.x,
    y: SPAWN_POINT.y,
    moving: false,
    sprinting: false,
    carryingFood: false,
    reservedTableId: null,
    bob: 0,
    eating: false,
    eatT: 0,
    character,
  };
}

function drawPlayer(ctx, player) {
  const bobY = player.moving ? Math.sin(player.bob) * 3 : 0;
  const x = player.x;
  const y = player.y + bobY;

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(player.x, player.y + 25, 19, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.fillStyle = player.character.color;
  ctx.beginPath();
  ctx.arc(x, y, 21, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  const displayEmoji = player.eating ? '😋' : player.character.emoji;
  drawEmoji(ctx, displayEmoji, x, y - 1, 26);
  ctx.restore();

  if (player.carryingFood) {
    drawEmoji(ctx, '🍜', x, y - 36, 26);
  }

  if (player.sprinting && player.moving) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 27, y + 5);
    ctx.lineTo(x - 40, y + 5);
    ctx.moveTo(x - 25, y - 8);
    ctx.lineTo(x - 38, y - 8);
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  ctx.font = 'bold 12px sans-serif';
  ctx.fillStyle = '#5a3d2b';
  ctx.textAlign = 'center';
  ctx.fillText('Cherie', x, y + 38);
  ctx.restore();
}

// ---------- NPC diners ----------

function createNpc(id) {
  const spawn = choice(NPC_SPAWN_POINTS);
  return {
    id,
    x: spawn.x,
    y: spawn.y,
    home: spawn,
    state: 'seeking', // seeking | walking | sitting | leaving
    targetTableId: null,
    sitTimer: 0,
    retargetTimer: rand(800, NPC_RETARGET_MS),
    bob: Math.random() * Math.PI * 2,
  };
}

function updateNpc(npc, dtMs, tables) {
  npc.bob += dtMs / 300;

  if (npc.state === 'seeking') {
    npc.retargetTimer -= dtMs;
    if (npc.retargetTimer <= 0) {
      const free = tables.filter((t) => t.state === 'empty');
      if (free.length > 0) {
        const table = choice(free);
        npc.targetTableId = table.id;
        npc.state = 'walking';
      } else {
        npc.retargetTimer = NPC_RETARGET_MS;
      }
    }
    return;
  }

  if (npc.state === 'walking') {
    const table = tables[npc.targetTableId];
    if (!table || table.state !== 'empty') {
      npc.state = 'seeking';
      npc.retargetTimer = rand(500, NPC_RETARGET_MS);
      return;
    }
    const arrived = moveToward(npc, { x: table.x, y: table.y + 34 }, NPC_SPEED);
    if (arrived) {
      table.state = 'occupied_by_npc';
      table.occupantNpcId = npc.id;
      npc.state = 'sitting';
      npc.sitTimer = randRange(NPC_SIT_MS);
    }
    return;
  }

  if (npc.state === 'sitting') {
    npc.sitTimer -= dtMs;
    if (npc.sitTimer <= 0) {
      const table = tables[npc.targetTableId];
      if (table && table.occupantNpcId === npc.id) {
        table.state = 'empty';
        table.occupantNpcId = null;
      }
      npc.state = 'leaving';
    }
    return;
  }

  if (npc.state === 'leaving') {
    const arrived = moveToward(npc, npc.home, NPC_SPEED);
    if (arrived) {
      npc.state = 'seeking';
      npc.retargetTimer = rand(1500, NPC_RETARGET_MS);
    }
  }
}

function drawNpc(ctx, npc) {
  const bobY = npc.state === 'sitting' ? 0 : Math.sin(npc.bob) * 2;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.beginPath();
  ctx.ellipse(npc.x, npc.y + 22, 16, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.fillStyle = '#6c8ebf';
  ctx.beginPath();
  ctx.arc(npc.x, npc.y + bobY, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#4d6a94';
  ctx.lineWidth = 2;
  ctx.stroke();
  drawEmoji(ctx, '🙂', npc.x, npc.y + bobY - 1, 22);
  ctx.restore();
}

// ---------- Bird (random event actor) ----------

function createBird() {
  return {
    active: false,
    x: 0,
    y: 0,
    startX: 0,
    startY: 0,
    targetTableId: null,
    phase: 'in', // in | grab | out
    t: 0,
  };
}

function drawBird(ctx, bird) {
  if (!bird.active) return;
  ctx.save();
  ctx.translate(bird.x, bird.y);
  if (bird.phase === 'out') ctx.scale(-1, 1);
  drawEmoji(ctx, '🐦', 0, 0, 26);
  ctx.restore();
}
