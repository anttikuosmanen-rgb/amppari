// ── Constants ──────────────────────────────────────────────────────────
const LOGICAL_W = 800;
const LOGICAL_H = 600;
const WORLD_W = 4000;
const SKY_RATIO = 0.75;
const GRASS_Y = LOGICAL_H * SKY_RATIO; // 450
const PLAYER_SPEED = 200;
const ANDREA_W = 64;
const ANDREA_H = 48;
const SHADOW_Y = GRASS_Y + (LOGICAL_H - GRASS_Y) / 2; // middle of grass
const GROUND_LAND_Y = SHADOW_Y;

// ── Audio (buzz) ───────────────────────────────────────────────────────
let audioCtx = null;
let buzzOsc = null;
let buzzGain = null;
let buzzStarted = false;

function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  buzzGain = audioCtx.createGain();
  buzzGain.gain.value = 0;
  buzzGain.connect(audioCtx.destination);
  buzzOsc = audioCtx.createOscillator();
  buzzOsc.type = 'sawtooth';
  buzzOsc.frequency.value = 180;
  buzzOsc.connect(buzzGain);
  buzzOsc.start();
  buzzStarted = true;
}

function updateBuzz() {
  if (!buzzStarted) return;
  let targetVol = andrea.landed ? 0 : 0.07;
  buzzGain.gain.value += (targetVol - buzzGain.gain.value) * 0.15;
  const speed = Math.sqrt(joystick.dx * joystick.dx + joystick.dy * joystick.dy);
  buzzOsc.frequency.value = 180 + speed * 40;
}

// ── Canvas Setup ───────────────────────────────────────────────────────
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let scaleRatio = 1, offsetX = 0, offsetY = 0;

function resize() {
  const ww = window.innerWidth, wh = window.innerHeight;
  const ratio = LOGICAL_W / LOGICAL_H;
  let cw, ch;
  if (ww / wh > ratio) { ch = wh; cw = wh * ratio; }
  else { cw = ww; ch = ww / ratio; }
  canvas.style.width = cw + 'px';
  canvas.style.height = ch + 'px';
  scaleRatio = cw / LOGICAL_W;
  offsetX = (ww - cw) / 2;
  offsetY = (wh - ch) / 2;
}
function screenToLogical(sx, sy) {
  return { x: (sx - offsetX) / scaleRatio, y: (sy - offsetY) / scaleRatio };
}
window.addEventListener('resize', resize);
resize();

// ── Image Loading ──────────────────────────────────────────────────────
// Load images directly — just drawImage, no getImageData (avoids file:// CORS)
const andreaImg = new Image();
andreaImg.src = 'amppari.png';

const frogImg = new Image();
frogImg.src = 'sammakot.webp';

const hiveImg = new Image();
hiveImg.src = 'koti.png';

// ── Camera ─────────────────────────────────────────────────────────────
const camera = { x: 0 };
function updateCamera(dt) {
  const targetX = andrea.x - LOGICAL_W * 0.3;
  camera.x += (targetX - camera.x) * (1 - Math.exp(-8 * dt));
  camera.x = Math.max(0, Math.min(camera.x, WORLD_W - LOGICAL_W));
}

// ── Background ─────────────────────────────────────────────────────────
const clouds = [];
for (let i = 0; i < 12; i++) {
  clouds.push({
    x: Math.random() * WORLD_W,
    y: 40 + Math.random() * (GRASS_Y * 0.5),
    w: 80 + Math.random() * 120,
    h: 30 + Math.random() * 30,
  });
}

function renderBackground() {
  const grad = ctx.createLinearGradient(0, 0, 0, GRASS_Y);
  grad.addColorStop(0, '#4db8ff');
  grad.addColorStop(1, '#b3e0ff');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, LOGICAL_W, GRASS_Y);

  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  for (const c of clouds) {
    const drawX = ((c.x - camera.x * 0.3) % WORLD_W + WORLD_W) % WORLD_W - WORLD_W * 0.1;
    if (drawX > -c.w && drawX < LOGICAL_W + c.w) {
      ctx.beginPath();
      ctx.ellipse(drawX + c.w / 2, c.y, c.w / 2, c.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const grassGrad = ctx.createLinearGradient(0, GRASS_Y, 0, LOGICAL_H);
  grassGrad.addColorStop(0, '#4caf50');
  grassGrad.addColorStop(1, '#2e7d32');
  ctx.fillStyle = grassGrad;
  ctx.fillRect(0, GRASS_Y, LOGICAL_W, LOGICAL_H - GRASS_Y);

  ctx.strokeStyle = 'rgba(0,0,0,0.08)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 40; i++) {
    const adjX = ((i * 110 - camera.x) % (LOGICAL_W + 200) + (LOGICAL_W + 200)) % (LOGICAL_W + 200) - 100;
    ctx.beginPath(); ctx.moveTo(adjX, GRASS_Y + 5); ctx.lineTo(adjX - 4, GRASS_Y + 25); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(adjX + 6, GRASS_Y + 3); ctx.lineTo(adjX + 10, GRASS_Y + 20); ctx.stroke();
  }
}

// ── Andrea (Player) ────────────────────────────────────────────────────
const andrea = {
  x: 200, y: 300,
  landed: false,
  facingLeft: false,
  wingPhase: 0,
  hp: 2,          // 2 hits before dropping
  damaged: false,  // flashing state
  damageTimer: 0,
  dead: false,
};

function updateAndrea(dt) {
  if (andrea.dead) return;

  // Damage flash timer
  if (andrea.damaged) {
    andrea.damageTimer -= dt;
    if (andrea.damageTimer <= 0) andrea.damaged = false;
  }

  const isMoving = Math.abs(joystick.dx) > 0.05 || Math.abs(joystick.dy) > 0.05;
  if (isMoving) {
    andrea.x += joystick.dx * PLAYER_SPEED * dt;
    andrea.y += joystick.dy * PLAYER_SPEED * dt;
    andrea.landed = false;
    if (joystick.dx < -0.1) andrea.facingLeft = true;
    else if (joystick.dx > 0.1) andrea.facingLeft = false;
  }

  andrea.x = Math.max(ANDREA_W / 2, Math.min(andrea.x, WORLD_W - ANDREA_W / 2));
  andrea.y = Math.max(ANDREA_H / 2, Math.min(andrea.y, GROUND_LAND_Y));

  if (andrea.y >= GROUND_LAND_Y - 1 && !isMoving) {
    andrea.y = GROUND_LAND_Y;
    andrea.landed = true;
  }

  if (!andrea.landed) {
    andrea.wingPhase += dt * 20 * Math.PI * 2;
  }
}

function hitAndrea() {
  if (andrea.damaged || andrea.dead) return;
  andrea.hp--;
  if (andrea.hp <= 0) {
    // Drop to ground
    andrea.dead = true;
    andrea.y = GROUND_LAND_Y;
    andrea.landed = true;
  } else {
    andrea.damaged = true;
    andrea.damageTimer = 1.0; // 1 second invulnerability
  }
}

function renderAndrea() {
  const sx = andrea.x - camera.x;
  const sy = andrea.y;

  // Shadow
  const distToGround = GROUND_LAND_Y - andrea.y;
  const maxDist = GROUND_LAND_Y - ANDREA_H / 2;
  const altFraction = Math.max(0, Math.min(distToGround / maxDist, 1));
  const shadowScale = 0.5 + 0.5 * (1 - altFraction);
  const shadowAlpha = 0.1 + 0.3 * (1 - altFraction);

  ctx.save();
  ctx.globalAlpha = shadowAlpha;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(sx, SHADOW_Y, ANDREA_W * 0.35 * shadowScale, 6 * shadowScale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Flash when damaged
  if (andrea.damaged && Math.floor(andrea.damageTimer * 10) % 2 === 0) return;

  ctx.save();
  ctx.translate(sx, sy);
  if (andrea.facingLeft) ctx.scale(-1, 1);

  // Procedural wings
  if (!andrea.dead) {
    const flapAmt = andrea.landed ? 0 : Math.sin(andrea.wingPhase);
    ctx.fillStyle = 'rgba(160, 210, 245, 0.55)';
    ctx.strokeStyle = 'rgba(100, 170, 220, 0.5)';
    ctx.lineWidth = 1;

    ctx.save();
    ctx.translate(2, -ANDREA_H * 0.3);
    ctx.rotate(-0.3 + flapAmt * 0.6);
    ctx.beginPath();
    ctx.ellipse(0, -10, 12, 18, -0.2, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.translate(2, -ANDREA_H * 0.15);
    ctx.rotate(0.1 - flapAmt * 0.45);
    ctx.beginPath();
    ctx.ellipse(0, -4, 9, 14, -0.15, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  // Body sprite — use multiply composite to hide white background
  if (andreaImg.complete && andreaImg.naturalWidth > 0) {
    // draw solid
    ctx.drawImage(andreaImg, -ANDREA_W / 2, -ANDREA_H / 2, ANDREA_W, ANDREA_H);
    // solid done
  }

  ctx.restore();
}

// ── Frogs (Enemies) ────────────────────────────────────────────────────
// sammakot.webp has two frogs side by side — left frog ~left half, right frog ~right half
const FROG_W = 100;
const FROG_H = 120;
const FROG_JUMP_SPEED = 250;
const FROG_JUMP_HEIGHT = 120;
const FROG_JUMP_DURATION = 1.2;

// 3 frogs at predefined world-x positions
const frogs = [
  { worldX: 800, type: 0 },
  { worldX: 1800, type: 1 },
  { worldX: 3000, type: 0 },
].map(f => ({
  worldX: f.worldX,
  type: f.type,           // 0 = left frog, 1 = right (crowned) frog
  x: f.worldX + LOGICAL_W * 0.6,  // start off-screen right
  y: SHADOW_Y,
  jumpTimer: 0,
  jumping: false,
  jumpStartX: 0,
  jumpStartY: SHADOW_Y,
  active: false,
}));

function updateFrogs(dt) {
  for (const frog of frogs) {
    // Activate when camera is near
    const screenDist = frog.worldX - camera.x;
    if (!frog.active && screenDist < LOGICAL_W * 1.2 && screenDist > -LOGICAL_W * 0.5) {
      frog.active = true;
      frog.jumping = true;
      frog.jumpTimer = 0;
      frog.jumpStartX = frog.worldX + LOGICAL_W * 0.6;
      frog.x = frog.jumpStartX;
      frog.y = SHADOW_Y;
    }

    if (!frog.active || !frog.jumping) continue;

    frog.jumpTimer += dt;
    const t = frog.jumpTimer / FROG_JUMP_DURATION;

    if (t >= 1) {
      // Jump finished — reset for next jump
      frog.jumping = false;
      // Re-activate after a delay by resetting
      setTimeout(() => {
        frog.jumpStartX = frog.worldX + LOGICAL_W * 0.6;
        frog.x = frog.jumpStartX;
        frog.y = SHADOW_Y;
        frog.jumpTimer = 0;
        frog.jumping = true;
      }, 1500 + Math.random() * 1000);
      continue;
    }

    // Horizontal: right to left
    frog.x = frog.jumpStartX - FROG_JUMP_SPEED * FROG_JUMP_DURATION * t;
    // Vertical: parabolic arc
    frog.y = SHADOW_Y - FROG_JUMP_HEIGHT * 4 * t * (1 - t);

    // Collision with Andrea
    if (!andrea.dead && !andrea.damaged) {
      const dx = frog.x - andrea.x;
      const dy = frog.y - andrea.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < (ANDREA_W + FROG_W) * 0.35) {
        hitAndrea();
      }
    }
  }
}

function renderFrogs() {
  if (!frogImg.complete || frogImg.naturalWidth === 0) return;

  const imgW = frogImg.naturalWidth;
  const imgH = frogImg.naturalHeight;
  // Left frog: left ~45% of image, Right frog: right ~55%
  const splitX = imgW * 0.42;

  for (const frog of frogs) {
    if (!frog.active || !frog.jumping) continue;

    const sx = frog.x - camera.x;
    const sy = frog.y;

    // Skip if off screen
    if (sx < -FROG_W || sx > LOGICAL_W + FROG_W) continue;

    // Shadow on ground
    const frogAlt = Math.max(0, SHADOW_Y - frog.y);
    const maxFrogAlt = FROG_JUMP_HEIGHT;
    const frogAltFrac = Math.min(frogAlt / maxFrogAlt, 1);
    const frogShadowScale = 0.5 + 0.5 * (1 - frogAltFrac);
    const frogShadowAlpha = 0.1 + 0.25 * (1 - frogAltFrac);
    ctx.save();
    ctx.globalAlpha = frogShadowAlpha;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(sx, SHADOW_Y, FROG_W * 0.35 * frogShadowScale, 8 * frogShadowScale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Draw frog sprite — source rect depends on type
    ctx.save();
    // draw solid
    if (frog.type === 0) {
      // Left frog from image
      ctx.drawImage(frogImg, 0, 0, splitX, imgH,
        sx - FROG_W / 2, sy - FROG_H / 2, FROG_W, FROG_H);
    } else {
      // Right frog (crowned) from image
      ctx.drawImage(frogImg, splitX, 0, imgW - splitX, imgH,
        sx - FROG_W / 2, sy - FROG_H / 2, FROG_W, FROG_H);
    }
    // solid done
    ctx.restore();
  }
}

// ── Hive (Goal) ────────────────────────────────────────────────────────
const HIVE_W = ANDREA_W * 3;
const HIVE_H = ANDREA_H * 3;
const HIVE_X = WORLD_W - 200; // near end of world
const HIVE_Y = 200;           // up in the sky
let levelComplete = false;

function updateHive() {
  if (levelComplete || andrea.dead) return;
  const dx = HIVE_X - andrea.x;
  const dy = HIVE_Y - andrea.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < (HIVE_W + ANDREA_W) * 0.35) {
    levelComplete = true;
  }
}

function renderHive() {
  const sx = HIVE_X - camera.x;
  if (sx < -HIVE_W || sx > LOGICAL_W + HIVE_W) return;

  if (hiveImg.complete && hiveImg.naturalWidth > 0) {
    ctx.save();
    // draw solid
    ctx.drawImage(hiveImg, sx - HIVE_W / 2, HIVE_Y - HIVE_H / 2, HIVE_W, HIVE_H);
    // solid done
    ctx.restore();
  }
}

function renderWinMessage() {
  if (!levelComplete) return;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 48px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('HOME SWEET HOME!', LOGICAL_W / 2, LOGICAL_H / 2 - 20);
  ctx.font = '24px sans-serif';
  ctx.fillText('Andrea made it safely!', LOGICAL_W / 2, LOGICAL_H / 2 + 30);
  ctx.restore();
}

// ── Virtual Joystick ───────────────────────────────────────────────────
const joystick = {
  active: false, pointerId: null,
  baseX: 0, baseY: 0, knobX: 0, knobY: 0,
  dx: 0, dy: 0, baseRadius: 50, knobRadius: 20,
};

function renderJoystick() {
  if (!joystick.active) return;
  ctx.beginPath();
  ctx.arc(joystick.baseX, joystick.baseY, joystick.baseRadius, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(joystick.knobX, joystick.knobY, joystick.knobRadius, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fill();
}

// ── HP display ─────────────────────────────────────────────────────────
function renderHP() {
  ctx.fillStyle = '#fff';
  ctx.font = '16px sans-serif';
  ctx.textAlign = 'left';
  const hpText = andrea.dead ? 'KNOCKED OUT!' : 'HP: ' + '❤'.repeat(andrea.hp);
  ctx.fillText(hpText, 12, 24);
}

// ── Input ──────────────────────────────────────────────────────────────
function onPointerDown(e) {
  if (joystick.active) return;
  initAudio();
  const pos = screenToLogical(e.clientX, e.clientY);
  if (pos.y < LOGICAL_H * 0.4) return;
  joystick.active = true;
  joystick.pointerId = e.pointerId;
  joystick.baseX = pos.x; joystick.baseY = pos.y;
  joystick.knobX = pos.x; joystick.knobY = pos.y;
  joystick.dx = 0; joystick.dy = 0;
}
function onPointerMove(e) {
  if (!joystick.active || e.pointerId !== joystick.pointerId) return;
  const pos = screenToLogical(e.clientX, e.clientY);
  let dx = pos.x - joystick.baseX, dy = pos.y - joystick.baseY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist > joystick.baseRadius) { dx = dx / dist * joystick.baseRadius; dy = dy / dist * joystick.baseRadius; }
  joystick.knobX = joystick.baseX + dx; joystick.knobY = joystick.baseY + dy;
  joystick.dx = dx / joystick.baseRadius; joystick.dy = dy / joystick.baseRadius;
}
function onPointerUp(e) {
  if (e.pointerId !== joystick.pointerId) return;
  joystick.active = false; joystick.pointerId = null;
  joystick.dx = 0; joystick.dy = 0;
}

window.addEventListener('pointerdown', onPointerDown);
window.addEventListener('pointermove', onPointerMove);
window.addEventListener('pointerup', onPointerUp);
window.addEventListener('pointercancel', onPointerUp);
window.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
window.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// ── Game Loop ──────────────────────────────────────────────────────────
let lastTime = 0;

function gameLoop(timestamp) {
  requestAnimationFrame(gameLoop);
  if (lastTime === 0) { lastTime = timestamp; return; }
  let dt = (timestamp - lastTime) / 1000;
  lastTime = timestamp;
  if (dt > 0.1) dt = 0.1;

  // Update
  if (!levelComplete) {
    updateAndrea(dt);
    updateFrogs(dt);
    updateHive();
  }
  updateCamera(dt);
  updateBuzz();

  // Render
  ctx.clearRect(0, 0, LOGICAL_W, LOGICAL_H);
  renderBackground();
  renderHive();
  renderFrogs();
  renderAndrea();
  renderJoystick();
  renderWinMessage();
  renderHP();
}

requestAnimationFrame(gameLoop);
