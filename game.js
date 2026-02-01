// ── Constants ──────────────────────────────────────────────────────────
const LOGICAL_W = 800;
const LOGICAL_H = 600;
const WORLD_W = 4000;
const SKY_RATIO = 0.625; // reduced from 0.75 to increase ground area by 50%
const GRASS_Y = LOGICAL_H * SKY_RATIO; // 375
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

const sammakkoImg = new Image();
sammakkoImg.src = 'sammakko.png';

const bossiImg = new Image();
bossiImg.src = 'bossi.png';

const hiveImg = new Image();
hiveImg.src = 'koti.png';

const grassImg = new Image();
grassImg.src = 'ruoho.png';

const treeImg = new Image();
treeImg.src = 'puu.png';

const kylalainen1Img = new Image();
kylalainen1Img.src = 'kylalainen1.png';

const kylalainen2Img = new Image();
kylalainen2Img.src = 'kylalainen2.png';

const lapsiImg = new Image();
lapsiImg.src = 'lapsi.png';

const kuningatarImg = new Image();
kuningatarImg.src = 'kuningatar.png';

// ── Game State & Levels ────────────────────────────────────────────────
let currentLevel = 1;
let levelComplete = false;

const LEVEL_CONFIG = {
  1: { friends: [], enemyType: 'sammakko', enemyCount: 3 },
  2: { friends: ['kylalainen1'], enemyType: 'sammakko', enemyCount: 3 },
  3: { friends: ['kylalainen1', 'kylalainen2'], enemyType: 'sammakko', enemyCount: 3 },
  4: { friends: ['kylalainen1', 'kylalainen2', 'lapsi'], enemyType: 'sammakko', enemyCount: 4 },
  5: { friends: ['kylalainen1', 'kylalainen2', 'lapsi', 'kuningatar'], enemyType: 'sammakko', enemyCount: 4 },
  6: { friends: ['kylalainen1', 'kylalainen2', 'lapsi', 'kuningatar'], enemyType: 'bossi', enemyCount: 1 },
};

function getFriendImages() {
  const config = LEVEL_CONFIG[currentLevel];
  if (!config) return [];
  const mapping = {
    'kylalainen1': kylalainen1Img,
    'kylalainen2': kylalainen2Img,
    'lapsi': lapsiImg,
    'kuningatar': kuningatarImg,
  };
  return config.friends.map(name => mapping[name]);
}

// ── Camera ─────────────────────────────────────────────────────────────
const camera = { x: 0 };
function updateCamera(dt) {
  const targetX = andrea.x - LOGICAL_W * 0.3;
  camera.x += (targetX - camera.x) * (1 - Math.exp(-8 * dt));
  camera.x = Math.max(0, Math.min(camera.x, WORLD_W - LOGICAL_W));
}

// ── Background ─────────────────────────────────────────────────────────
// Seeded pseudo-random for consistent level generation
function seededRandom(seed) {
  let s = seed;
  return function() {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
}

let clouds = [];
let bgGrassTufts = [];
let fgGrassTufts = [];
let trees = [];

function generateLevel(levelNum) {
  const seed = levelNum * 1000;

  // Clouds
  clouds = [];
  const cloudRng = seededRandom(seed + 1);
  for (let i = 0; i < 12; i++) {
    clouds.push({
      x: cloudRng() * WORLD_W,
      y: 40 + cloudRng() * (GRASS_Y * 0.5),
      w: 80 + cloudRng() * 120,
      h: 30 + cloudRng() * 30,
    });
  }

  // Background grass tufts
  bgGrassTufts = [];
  const bgRng = seededRandom(seed + 2);
  const avgBgSpacing = 180;
  let x = bgRng() * avgBgSpacing * 0.5;
  while (x < WORLD_W) {
    bgGrassTufts.push({
      x: x,
      yOff: bgRng() * 30 - 20, // more variation, biased down
      scale: 0.85 + bgRng() * 0.3,
    });
    x += avgBgSpacing * 0.5 + bgRng() * avgBgSpacing;
  }

  // Foreground grass tufts
  fgGrassTufts = [];
  const fgRng = seededRandom(seed + 3);
  const avgFgSpacing = 300;
  x = fgRng() * avgFgSpacing;
  const fgWorldW = WORLD_W * 1.4;
  while (x < fgWorldW) {
    fgGrassTufts.push({
      x: x,
      yOff: fgRng() * 60 - 40, // more variation, biased up
      scale: 0.8 + fgRng() * 0.4,
    });
    x += avgFgSpacing * 0.5 + fgRng() * avgFgSpacing;
  }

  // Trees
  trees = [];
  const treeRng = seededRandom(seed + 4);
  const treeCount = 3 + Math.floor(treeRng() * 2); // 3-4 trees
  for (let i = 0; i < treeCount; i++) {
    trees.push({
      x: (WORLD_W / (treeCount + 1)) * (i + 1) + (treeRng() - 0.5) * 400,
      scale: 0.8 + treeRng() * 0.3,
    });
  }
  // Always one tree at hive
  trees.push({ x: 3800, scale: 1.0 });
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
}

// Background grass sprites near horizon (rendered after trees, in front)
function renderBackgroundGrass() {
  if (!grassImg.complete || grassImg.naturalWidth === 0) return;
  const bgGrassH = 120;
  const bgGrassW = 120;
  const bgGrassY = GRASS_Y - bgGrassH * 0.45;

  for (let i = 0; i < bgGrassTufts.length; i++) {
    const tuft = bgGrassTufts[i];
    const drawX = tuft.x - camera.x;
    if (drawX > -bgGrassW && drawX < LOGICAL_W + bgGrassW) {
      // Check if grass is near any tree
      let nearTree = false;
      for (const tree of trees) {
        const treeScreenX = tree.x - camera.x;
        const distToTree = Math.abs(tuft.x - tree.x);
        if (distToTree < 200) { // within 200px of tree
          nearTree = true;
          break;
        }
      }

      // Lower grass that's near trees so they appear behind
      const yOffset = nearTree ? tuft.yOff + 60 : tuft.yOff;
      ctx.drawImage(grassImg, drawX, bgGrassY + yOffset, bgGrassW * tuft.scale, bgGrassH * tuft.scale);
    }
  }
}

// Trees (same parallax as background grass, extends to top of screen)
function renderTrees() {
  if (!treeImg.complete || treeImg.naturalWidth === 0) return;

  const parallaxSpeed = 1.0; // same as background grass
  const imgAspect = treeImg.naturalWidth / treeImg.naturalHeight;

  for (const tree of trees) {
    const drawX = tree.x - camera.x * parallaxSpeed;

    // Tree extends from top of screen to ground, with bottom quarter in green area
    const groundAreaH = LOGICAL_H - GRASS_Y; // height of green ground area
    const rootsIntoGround = groundAreaH * 0.25; // bottom quarter of roots extend into ground
    const baseY = GRASS_Y + rootsIntoGround; // base sits 25% into ground area

    // Calculate width to maintain aspect ratio
    const totalHeight = baseY; // height from top (0) to base
    const treeW = totalHeight * imgAspect * tree.scale * 0.5; // scaled narrower

    if (drawX < -treeW || drawX > LOGICAL_W + treeW) continue;

    // Full tree image height that we'll tile
    const fullTreeH = treeW / imgAspect;

    // Draw tree starting from base, going up to top
    let currentY = baseY;

    // First draw the full tree at the base
    ctx.drawImage(treeImg, drawX - treeW / 2, currentY - fullTreeH, treeW, fullTreeH);
    currentY -= fullTreeH;

    // If tree doesn't reach top yet, repeat the top half of the image
    while (currentY > 0) {
      const remainingH = currentY;
      const segmentH = Math.min(fullTreeH * 0.5, remainingH);

      // Draw top half of tree image, repeated
      ctx.drawImage(
        treeImg,
        0, 0, treeImg.naturalWidth, treeImg.naturalHeight * 0.5, // source: top half
        drawX - treeW / 2, currentY - segmentH, treeW, segmentH  // dest
      );
      currentY -= segmentH;
    }
  }
}

// Foreground grass (4x size, faster parallax, semi-transparent, randomized)
function renderForegroundGrass() {
  if (!grassImg.complete || grassImg.naturalWidth === 0) return;
  const fgGrassH = 240;
  const fgGrassW = 240;
  const fgGrassY = LOGICAL_H - fgGrassH * 0.7;
  const parallaxSpeed = 1.4;

  ctx.save();
  ctx.globalAlpha = 0.66;
  for (let i = 0; i < fgGrassTufts.length; i++) {
    const tuft = fgGrassTufts[i];
    const drawX = tuft.x - camera.x * parallaxSpeed;
    if (drawX > -fgGrassW && drawX < LOGICAL_W + fgGrassW) {
      ctx.drawImage(grassImg, drawX, fgGrassY + tuft.yOff, fgGrassW * tuft.scale, fgGrassH * tuft.scale);
    }
  }
  ctx.restore();
}

// ── Andrea (Player) ────────────────────────────────────────────────────
const andrea = {
  x: 200, y: 300,
  landed: false,
  facingLeft: false,
  wingPhase: 0,
  hp: 2,
  damaged: false,
  damageTimer: 0,
  dead: false,
  fatigue: 0,        // 0-1, builds when flying high
  timeAtHighAlt: 0,  // seconds spent above middle of screen
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

  // Fatigue system - tire when flying high
  const middleY = LOGICAL_H / 2;
  const isHigh = andrea.y < middleY;

  if (isHigh && !andrea.landed) {
    andrea.timeAtHighAlt += dt;
    // Build fatigue after 5 seconds, accelerating
    if (andrea.timeAtHighAlt > 5) {
      const excessTime = andrea.timeAtHighAlt - 5;
      andrea.fatigue = Math.min(1, excessTime / 10); // reaches max after 15s total
    }
  } else {
    // Recover fatigue when flying low or landed
    andrea.timeAtHighAlt = Math.max(0, andrea.timeAtHighAlt - dt * 2);
    andrea.fatigue = Math.max(0, andrea.fatigue - dt * 0.3);
  }

  // Apply fatigue - gradual fall toward middle
  if (andrea.fatigue > 0 && !andrea.landed) {
    const fallSpeed = andrea.fatigue * 80; // up to 80 px/s
    andrea.y += fallSpeed * dt;
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

  // Body sprite first (behind wings)
  if (andreaImg.complete && andreaImg.naturalWidth > 0) {
    ctx.drawImage(andreaImg, -ANDREA_W / 2, -ANDREA_H / 2, ANDREA_W, ANDREA_H);
  }

  // Procedural wings on top, shifted toward the back of the wasp
  if (!andrea.dead) {
    const flapAmt = andrea.landed ? 0 : Math.sin(andrea.wingPhase);
    ctx.fillStyle = 'rgba(160, 210, 245, 0.55)';
    ctx.strokeStyle = 'rgba(100, 170, 220, 0.5)';
    ctx.lineWidth = 1;

    ctx.save();
    ctx.translate(-ANDREA_W * 0.15, -ANDREA_H * 0.3);
    ctx.rotate(-0.3 + flapAmt * 0.6);
    ctx.beginPath();
    ctx.ellipse(0, -10, 12, 18, -0.2, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.translate(-ANDREA_W * 0.15, -ANDREA_H * 0.15);
    ctx.rotate(0.1 - flapAmt * 0.45);
    ctx.beginPath();
    ctx.ellipse(0, -4, 9, 14, -0.15, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

// ── Enemies ────────────────────────────────────────────────────────────
const SAMMAKKO_W = 100;
const SAMMAKKO_H = 120;
const BOSSI_W = 200; // double size
const BOSSI_H = 240;
const FROG_JUMP_SPEED = 250;
const FROG_JUMP_HEIGHT = 240;
const BOSSI_JUMP_HEIGHT = 480; // double height
const FROG_JUMP_DURATION = 1.2;

let enemies = [];

function generateEnemies(levelNum) {
  const config = LEVEL_CONFIG[levelNum];
  enemies = [];
  const rng = seededRandom(levelNum * 1000 + 5);

  if (config.enemyType === 'bossi') {
    // Level 6: Boss frog appears one screen before hive, jumping back and forth
    enemies.push({
      worldX: WORLD_W - LOGICAL_W - 200,
      type: 'bossi',
      w: BOSSI_W,
      h: BOSSI_H,
      jumpHeight: BOSSI_JUMP_HEIGHT,
      x: 0,
      y: SHADOW_Y,
      jumpTimer: 0,
      jumping: false,
      jumpStartX: 0,
      active: false,
    });
  } else {
    // Normal sammakko frogs with random jump height variation
    for (let i = 0; i < config.enemyCount; i++) {
      const spacing = WORLD_W / (config.enemyCount + 1);
      enemies.push({
        worldX: spacing * (i + 1) + (rng() - 0.5) * 300,
        type: 'sammakko',
        w: SAMMAKKO_W,
        h: SAMMAKKO_H,
        jumpHeight: FROG_JUMP_HEIGHT + (rng() - 0.5) * 100, // ±50px variation
        x: 0,
        y: SHADOW_Y,
        jumpTimer: 0,
        jumping: false,
        jumpStartX: 0,
        active: false,
      });
    }
  }
}

function updateEnemies(dt) {
  for (const enemy of enemies) {
    // Activate when camera is near
    const screenDist = enemy.worldX - camera.x;
    if (!enemy.active && screenDist < LOGICAL_W * 1.2 && screenDist > -LOGICAL_W * 0.5) {
      enemy.active = true;
      enemy.jumping = true;
      enemy.jumpTimer = 0;
      enemy.jumpStartX = enemy.worldX + LOGICAL_W * 0.6;
      enemy.x = enemy.jumpStartX;
      enemy.y = SHADOW_Y;
    }

    if (!enemy.active || !enemy.jumping) continue;

    enemy.jumpTimer += dt;
    const t = enemy.jumpTimer / FROG_JUMP_DURATION;

    if (t >= 1) {
      // Jump finished — reset for next jump
      enemy.jumping = false;
      // Re-activate after a delay by resetting
      setTimeout(() => {
        enemy.jumpStartX = enemy.worldX + LOGICAL_W * 0.6;
        enemy.x = enemy.jumpStartX;
        enemy.y = SHADOW_Y;
        enemy.jumpTimer = 0;
        enemy.jumping = true;
      }, 1500 + Math.random() * 1000);
      continue;
    }

    // Horizontal: right to left
    enemy.x = enemy.jumpStartX - FROG_JUMP_SPEED * FROG_JUMP_DURATION * t;
    // Vertical: parabolic arc
    enemy.y = SHADOW_Y - enemy.jumpHeight * 4 * t * (1 - t);

    // Collision with Andrea
    if (!andrea.dead && !andrea.damaged) {
      const dx = enemy.x - andrea.x;
      const dy = enemy.y - andrea.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < (ANDREA_W + enemy.w) * 0.35) {
        hitAndrea();
      }
    }
  }
}

function renderEnemies() {
  for (const enemy of enemies) {
    if (!enemy.active || !enemy.jumping) continue;

    const sx = enemy.x - camera.x;
    const sy = enemy.y;

    // Skip if off screen
    if (sx < -enemy.w || sx > LOGICAL_W + enemy.w) continue;

    // Shadow on ground
    const enemyAlt = Math.max(0, SHADOW_Y - enemy.y);
    const maxEnemyAlt = enemy.jumpHeight;
    const enemyAltFrac = Math.min(enemyAlt / maxEnemyAlt, 1);
    const enemyShadowScale = 0.5 + 0.5 * (1 - enemyAltFrac);
    const enemyShadowAlpha = 0.1 + 0.25 * (1 - enemyAltFrac);
    ctx.save();
    ctx.globalAlpha = enemyShadowAlpha;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(sx, SHADOW_Y, enemy.w * 0.35 * enemyShadowScale, 8 * enemyShadowScale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Draw enemy sprite
    let img = enemy.type === 'bossi' ? bossiImg : sammakkoImg;
    if (img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, sx - enemy.w / 2, sy - enemy.h / 2, enemy.w, enemy.h);
    }
  }
}

// ── Hive (Goal) & Friends ──────────────────────────────────────────────
const HIVE_W = ANDREA_W * 3;
const HIVE_H = ANDREA_H * 3;
const HIVE_X = WORLD_W - 200;
const HIVE_Y = 200;
const FRIEND_W = ANDREA_W * 0.9;
const FRIEND_H = ANDREA_H * 0.9;

let friends = [];

function generateFriends() {
  const friendImgs = getFriendImages();
  const friendNames = LEVEL_CONFIG[currentLevel].friends;
  const rng = seededRandom(currentLevel * 1000 + 6);

  friends = friendImgs.map((img, i) => {
    const name = friendNames[i];
    let sizeScale = 1.0;
    if (name === 'lapsi') sizeScale = 0.6;
    else if (name === 'kuningatar') sizeScale = 1.5;

    return {
      img: img,
      name: name,
      sizeScale: sizeScale,
      baseX: HIVE_X - 300 + (rng() - 0.5) * 400,
      baseY: HIVE_Y + (rng() - 0.5) * 200,
      x: HIVE_X - 300 + (rng() - 0.5) * 400,
      y: HIVE_Y + (rng() - 0.5) * 200,
      hoverPhase: i * Math.PI / 2,
      vertPhase: i * Math.PI / 3,
      wingPhase: i * Math.PI / 4, // for wing flapping
      shadowY: SHADOW_Y,
      approachAndrea: i === 0,
    };
  });
}

function updateFriends(dt) {
  for (const friend of friends) {
    friend.hoverPhase += dt * 2;
    friend.vertPhase += dt * 1.5;
    friend.wingPhase += dt * 15 * Math.PI * 2; // flapping animation

    const distToAndrea = Math.abs(andrea.x - friend.baseX);

    if (friend.approachAndrea) {
      // First friend actively approaches Andrea when she gets close
      const approachDist = 800;
      if (distToAndrea < approachDist) {
        const targetX = andrea.x - 80;
        const targetY = andrea.y - 30;
        // Match Andrea's speed - use direct speed matching instead of lerp
        const dx = targetX - friend.x;
        const dy = targetY - friend.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 5) {
          // Move at same speed as Andrea can move (PLAYER_SPEED)
          const speed = PLAYER_SPEED;
          friend.x += (dx / dist) * speed * dt;
          friend.y += (dy / dist) * speed * dt;
        }
      } else {
        friend.x += (friend.baseX - friend.x) * dt * 1.5;
        friend.y += (friend.baseY - friend.y) * dt * 1.5;
      }
    } else {
      // Other friends just hover at their base position
      const attractDist = 600;
      if (distToAndrea < attractDist) {
        const attractForce = 1 - (distToAndrea / attractDist);
        const targetX = friend.baseX + (andrea.x - friend.baseX) * attractForce * 0.15;
        const targetY = friend.baseY + (andrea.y - friend.baseY) * attractForce * 0.1;
        friend.x += (targetX - friend.x) * dt * 2;
        friend.y += (targetY - friend.y) * dt * 2;
      } else {
        friend.x += (friend.baseX - friend.x) * dt * 2;
        friend.y += (friend.baseY - friend.y) * dt * 2;
      }
    }

    // Animate shadow up/down to simulate in/out movement
    const shadowRange = 40;
    const targetShadowY = SHADOW_Y + Math.sin(friend.vertPhase) * shadowRange;
    friend.shadowY += (targetShadowY - friend.shadowY) * dt * 3;
  }
}

function renderFriends() {
  for (const friend of friends) {
    const sx = friend.x - camera.x;
    const sy = friend.y + Math.sin(friend.hoverPhase) * 8;

    const friendW = FRIEND_W * friend.sizeScale;
    const friendH = FRIEND_H * friend.sizeScale;

    if (sx < -friendW || sx > LOGICAL_W + friendW) continue;

    // Shadow - position varies to simulate in/out depth
    const distToShadow = friend.shadowY - sy;
    const maxShadowDist = 300;
    const shadowDistFrac = Math.max(0, Math.min(distToShadow / maxShadowDist, 1));
    const shadowScale = 0.4 + 0.4 * (1 - shadowDistFrac);
    const shadowAlpha = 0.08 + 0.2 * (1 - shadowDistFrac);

    ctx.save();
    ctx.globalAlpha = shadowAlpha;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(sx, friend.shadowY, friendW * 0.3 * shadowScale, 5 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Draw friend sprite with wings
    ctx.save();
    ctx.translate(sx, sy);

    // Draw friend body first
    if (friend.img.complete && friend.img.naturalWidth > 0) {
      ctx.drawImage(friend.img, -friendW / 2, -friendH / 2, friendW, friendH);
    }

    // Draw procedural wings on top
    const flapAmt = Math.sin(friend.wingPhase);
    ctx.fillStyle = 'rgba(160, 210, 245, 0.45)';
    ctx.strokeStyle = 'rgba(100, 170, 220, 0.4)';
    ctx.lineWidth = 1;

    const wingScale = friend.sizeScale * 0.9;

    // Left wing
    ctx.save();
    ctx.translate(-friendW * 0.15, -friendH * 0.25);
    ctx.rotate(-0.3 + flapAmt * 0.5);
    ctx.beginPath();
    ctx.ellipse(0, -8 * wingScale, 10 * wingScale, 15 * wingScale, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Right wing
    ctx.save();
    ctx.translate(-friendW * 0.15, -friendH * 0.1);
    ctx.rotate(0.1 - flapAmt * 0.4);
    ctx.beginPath();
    ctx.ellipse(0, -3 * wingScale, 8 * wingScale, 12 * wingScale, -0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }
}

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
    ctx.drawImage(hiveImg, sx - HIVE_W / 2, HIVE_Y - HIVE_H / 2, HIVE_W, HIVE_H);
  }
}

function renderLevelCompleteMessage() {
  if (!levelComplete) return;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

  if (currentLevel < 6) {
    // Regular level complete
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('LEVEL COMPLETE!', LOGICAL_W / 2, LOGICAL_H / 2 - 40);
    ctx.font = '24px sans-serif';
    ctx.fillText('Tap to continue to level ' + (currentLevel + 1), LOGICAL_W / 2, LOGICAL_H / 2 + 20);
  } else {
    // Final congratulatory screen
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 56px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('CONGRATULATIONS!', LOGICAL_W / 2, LOGICAL_H / 2 - 80);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText('Andrea saved the hive!', LOGICAL_W / 2, LOGICAL_H / 2 - 20);

    ctx.font = '20px sans-serif';
    ctx.fillText('All 6 levels completed', LOGICAL_W / 2, LOGICAL_H / 2 + 30);

    // Restart button
    const buttonY = LOGICAL_H / 2 + 80;
    const buttonW = 200;
    const buttonH = 50;
    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(LOGICAL_W / 2 - buttonW / 2, buttonY, buttonW, buttonH);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.strokeRect(LOGICAL_W / 2 - buttonW / 2, buttonY, buttonW, buttonH);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('PLAY AGAIN', LOGICAL_W / 2, buttonY + buttonH / 2);
  }
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
  initAudio();

  // Handle level complete screen tap
  if (levelComplete) {
    if (currentLevel < 6) {
      // Next level
      currentLevel++;
      initLevel(currentLevel);
    } else {
      // Restart from level 1
      currentLevel = 1;
      initLevel(currentLevel);
    }
    return;
  }

  if (joystick.active) return;
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

// ── Level Initialization ───────────────────────────────────────────────
function initLevel(levelNum) {
  currentLevel = levelNum;
  levelComplete = false;

  // Reset Andrea
  andrea.x = 200;
  andrea.y = 300;
  andrea.landed = false;
  andrea.facingLeft = false;
  andrea.wingPhase = 0;
  andrea.hp = 2;
  andrea.damaged = false;
  andrea.damageTimer = 0;
  andrea.dead = false;
  andrea.fatigue = 0;
  andrea.timeAtHighAlt = 0;

  // Reset camera
  camera.x = 0;

  // Generate level content
  generateLevel(levelNum);
  generateEnemies(levelNum);
  generateFriends();
}

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
    updateEnemies(dt);
    updateFriends(dt);
    updateHive();
  }
  updateCamera(dt);
  updateBuzz();

  // Render
  ctx.clearRect(0, 0, LOGICAL_W, LOGICAL_H);
  renderBackground();
  renderTrees();
  renderBackgroundGrass();
  renderHive();
  renderFriends();
  renderEnemies();
  renderAndrea();
  renderForegroundGrass();
  renderJoystick();
  renderLevelCompleteMessage();
  renderHP();
  renderLevelNumber();
}

function renderLevelNumber() {
  ctx.fillStyle = '#fff';
  ctx.font = '16px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('Level ' + currentLevel, LOGICAL_W - 12, 24);
}

// Initialize level 1
initLevel(1);
requestAnimationFrame(gameLoop);
