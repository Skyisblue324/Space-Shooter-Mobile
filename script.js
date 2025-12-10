// ===== Canvas =====
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
let mouseX = 0;
let mouseY = 0;
let pickingBuff = false; // freeze update() sementara animasi fly-to-slot berjalan

canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  mouseX = (e.clientX - rect.left) * scaleX;
  mouseY = (e.clientY - rect.top) * scaleY;
});
// ==== GLOBAL NO-SCROLL GUARDS ====
// Matikan wheel/trackpad scroll
window.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
  },
  { passive: false }
);
// Matikan scroll via touch (mobile)
window.addEventListener(
  "touchmove",
  (e) => {
    e.preventDefault();
  },
  { passive: false }
);
// Matikan scroll via middle mouse (drag)
window.addEventListener(
  "mousedown",
  (e) => {
    if (e.button === 1) {
      e.preventDefault();
    }
  },
  { passive: false }
);
// Arrow keys & Space fallback
window.addEventListener(
  "keydown",
  (e) => {
    const k = e.key;
    if (k === " " || k === "Spacebar" || k.startsWith("Arrow")) {
      e.preventDefault();
    }
  },
  { passive: false }
);
// Dialogue
const levelDialogs = {
  1: "Welcome, player. Your mission begins now. Eliminate all threats. Use the WASD or arrow keys to move around and space to shoot!",
  3: "This new enemy is deadly... it's shoots the rocket that deal a lot of damage to our ship",
  5: "A powerful boss awaits. Prepare for a tough battle!",
  7: "You're doing well. But the void is endless...",
  10: "Good luck, this is your second boss fight, also the game appear to be never end.",
  12: "I may be update the game, just wait some time but I'm all alone",
  15: "Survive still? I'm the dev behind of this suprised...",
  20: "Sigh... Go touch some grass. Get a life, this game never ends, I'm tired enough of you. No more dialogues from now on.",
};

const specialDeathDialogs = [
  "Died already? Improve your literacy and try again...",
  "Noobies.",
  "Really? This game is not designed for you, I guess...",
  "I'm so cold heck yeah.",
  "Hmm... this game hard, huh?",
];

let dialogTypingInterval = null;
let dialogTimeout = null;

function clearAllDialogTimers() {
  if (dialogTypingInterval) {
    clearInterval(dialogTypingInterval);
    dialogTypingInterval = null;
  }
  if (dialogTimeout) {
    clearTimeout(dialogTimeout);
    dialogTimeout = null;
  }
}

function showSpecialDeathDialog() {
  clearAllDialogTimers(); // ⛔ pastikan bersih

  const dialogBox = document.getElementById("dialogBox");
  const dialogText = document.getElementById("dialogText");

  const specialText =
    specialDeathDialogs[Math.floor(Math.random() * specialDeathDialogs.length)];
  dialogText.textContent = "";
  dialogBox.classList.remove("hidden");

  let i = 0;
  const typingSpeed = 45;
  const extraReadTime = 3000;

  dialogTypingInterval = setInterval(() => {
    dialogText.textContent += specialText[i];
    i++;
    if (i >= specialText.length) {
      clearInterval(dialogTypingInterval);
      dialogTypingInterval = null;
      const readTime = specialText.length * typingSpeed + extraReadTime;
      dialogTimeout = setTimeout(() => {
        dialogBox.classList.add("hidden");
        dialogTimeout = null;
      }, readTime);
    }
  }, typingSpeed);
}

function showLevelDialog(level) {
  clearAllDialogTimers(); // ⛔ pastikan bersih

  const dialog = levelDialogs[level];
  if (!dialog) return;

  const dialogBox = document.getElementById("dialogBox");
  const dialogText = document.getElementById("dialogText");

  dialogText.textContent = "";
  dialogBox.classList.remove("hidden");

  let i = 0;
  const typingSpeed = 40;

  dialogTypingInterval = setInterval(() => {
    dialogText.textContent += dialog[i];
    i++;
    if (i >= dialog.length) {
      clearInterval(dialogTypingInterval);
      dialogTypingInterval = null;
      const readTime = Math.max(4000, dialog.length * typingSpeed + 1500);
      dialogTimeout = setTimeout(() => {
        dialogBox.classList.add("hidden");
        dialogTimeout = null;
      }, readTime);
    }
  }, typingSpeed);
}
// ===== Space Themes (Parallax) =====
const spaceThemes = [
  {
    name: "Deep Space",
    bgTop: "#02030a",
    bgBottom: "#060a19",
    starColor: "#cfe8ff",
    twinkleColor: "#8fdcff",
    nebula: "rgba(80,140,255,0.15)",
  },
  {
    name: "Crimson Dusk",
    bgTop: "#0a0202",
    bgBottom: "#190606",
    starColor: "#ffd7d7",
    twinkleColor: "#ff9aa0",
    nebula: "rgba(255,80,120,0.12)",
  },
  {
    name: "Emerald Nebula",
    bgTop: "#01130a",
    bgBottom: "#062019",
    starColor: "#d3ffe6",
    twinkleColor: "#8effc2",
    nebula: "rgba(60,220,140,0.12)",
  },
  {
    name: "Violet Void",
    bgTop: "#0a0312",
    bgBottom: "#12061f",
    starColor: "#efd7ff",
    twinkleColor: "#cc99ff",
    nebula: "rgba(160,80,255,0.10)",
  },
  {
    name: "Golden Rift",
    bgTop: "#130f02",
    bgBottom: "#221b06",
    starColor: "#fff1c2",
    twinkleColor: "#ffd46b",
    nebula: "rgba(255,190,60,0.12)",
  },
];
let currentSpaceTheme = spaceThemes[0];
let shake = 0;
// ===== PERF: background cache =====
const bgCanvas = document.createElement("canvas");
const bgCtx = bgCanvas.getContext("2d");
// ===== PERF: star layers offscreen (tiled wrap) =====
const starLayers = {
  far: {
    cvs: document.createElement("canvas"),
    ctx: null,
    speedMul: 0.4,
    offsetY: 0,
  },
  mid: {
    cvs: document.createElement("canvas"),
    ctx: null,
    speedMul: 0.8,
    offsetY: 0,
  },
  near: {
    cvs: document.createElement("canvas"),
    ctx: null,
    speedMul: 1.3,
    offsetY: 0,
  },
};
starLayers.far.ctx = starLayers.far.cvs.getContext("2d");
starLayers.mid.ctx = starLayers.mid.cvs.getContext("2d");
starLayers.near.ctx = starLayers.near.cvs.getContext("2d");
// Twinkles (lightweight)
let twinkles = []; // {x,y,t}
const MAX_TWINKLES_HQ = 18;
const MAX_TWINKLES_LQ = 8;
// Quality tier auto-switch
let quality = "high"; // "high" | "low"
let fpsSamples = [];
let avgFPS = 60;
// ===== HUD throttle & dt clamp =====
const HUD_UPDATE_MS = 100; // ~10/s
let hudAccum = 0;
const MAX_DT_MS = 34; // ~30fps clamp
// Caps
const MAX_EXPLOSIONS = 120;
const MAX_ROCKET_RINGS = 24;
// ===== Game State =====
let player, bullets, enemies, enemyBullets, enemyQueue;
let score, lives, level, totalEnemies, enemiesKilled;
let keys = {};
let hitFlash = 0;
let showMenu = true;
let gameStarted = false;
let gameRunning = false;
let gameOverState = false;
let lastShot = 0;
let highScore = parseInt(localStorage.getItem("highScore") ?? "0", 10);
document.getElementById("highscore").textContent = highScore;
let showBuffSelection = false;
let activeBuffs = [];
let healUsed = false;
let shieldCharges = 0;
let boss = null;
let starSpeed = 1;
let warp = false;
let levelTextTimer = 0;
let levelCleared = false;
// === Dodge visual feedback ===
let dodgeTexts = []; // array efek teks lokal: {x, y, vx, vy, life, maxLife, alpha, scale}
let dodgeBanner = { life: 0, maxLife: 0 }; // banner top (opsional)
// Spawn teks "DODGED!" di titik benturan
function spawnDodgeText(x, y) {
  dodgeTexts.push({
    x,
    y,
    vx: Math.random() * 0.8 - 0.4, // sedikit geser kanan/kiri
    vy: -0.9, // naik pelan
    life: 800, // ms
    maxLife: 800,
    alpha: 1,
    scale: 1.0,
  });
  // batasi jumlah efek agar ringan
  if (dodgeTexts.length > 20) dodgeTexts.shift();
}

// Banner atas canvas selama ~0.8s
function triggerDodgeBanner(duration = 800) {
  dodgeBanner.life = duration;
  dodgeBanner.maxLife = duration;
}

// Demo
let demoPlayer,
  demoBullets,
  demoEnemies,
  demoEnemyBullets,
  demoTimer = 0;
let demoRespawnTimeout = null;
// Explosions
let explosions = [];
let rocketExplosions = [];
// Audio (base64)
const shootSFX = new Audio(
  "data:audio/wav;base64,UklGRtQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YZQAAACAgICAf39/f39/f3x8fHx7e3t7e3t6enp5eXl4eHh3d3d2dnZ1dXV0dHRzc3Nzc3Nzc3N0dHR1dXV2dnZ3d3d4eHh5eXl6enp7e3t8fHx/f3+AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA=="
);
const explodeSFX = new Audio(
  "data:audio/wav;base64,UklGRtQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YZQAAACAgYGBgoKCg4ODhISEhYWGh4eIiImKi4uMjY2Oj4+QkZKTlJWWmJmampydnp+goaKkpaaoq6ytsLGztLW4urq+wcPGyszO0tba3N7h5OXm6Ovr7/Dx8vP09vf5+vv8/f7/AQICAgQFBgcICQoLDA0ODw=="
);
const gameOverSFX = new Audio(
  "data:audio/wav;base64,UklGRqQAAABXQVZFZm10 IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YZQAAAB/f3x7e3p5eHd2dXNycXBycG9ubWxramloaGdmZWRjYmFgX15cW1pZWFdWVVRTUlFPTk1MS0pJSEdGRURDQkFAPz49PDs6OTg3NjU0MzIxMC8uLSwrKikoJyYlJCMiISAfHh0cGhoZGBcWFRQTEhEQDw4NDAsKCQgGBAICAA=="
);
// Const
const PLAYER_SPEED = 4,
  BULLET_SPEED = 8,
  ENEMY_SPEED = 0.6,
  ENEMY_BULLET_SPEED = 2,
  FIRE_RATE = 250;
const ENEMY_FIRE_MIN = 1600,
  ENEMY_FIRE_MAX = 2400,
  MAX_ENEMY_BULLETS = 8;
// Update Log (tetap)
let updateLogs = [
  {
    version: "1.0.2 Revamped UI & Optimization",
    date: "2025-10-22",
    changes: [
      "🛠️ Improved gameplay & stability and newest UI!!!",
      "🪄 Added the brand new animations on cards selection buff, also improved QoL.",
      "💬 Dialogues!!!",
      "👾 Bugfixes: Kamikaze ship does not deal damage and require 3 hits instead 1.",
      "🔼 Dodge chance: 25% -> 50%",
    ],
  },
  {
    version: "1.0.1 Mini Update",
    date: "2025-09-17",
    changes: [
      "Fixed known bugs:",
      "🛠️ Arrow keys cause the web move",
      "Boss rework:",
      "🔻Difficulty step per level : 3x -> 1.8x",
      "🔻Boss HP : 100 -> 40",
      "🔻Boss shotgun firerate : 2s -> 3.5s",
      "🔻Boss firerate cooldown : 4s -> 3.75s",
      "🔻Boss' ability cooldown : 3s -> 3.75s",
      "🔻Boss' bullet count : 12 -> 9",
      "Buff adjustments:",
      "🔫 Sniper Damage : 45 -> 7",
      "🔫 Rocket Launcher Damage : 30 -> 9",
      "🚀 Rocket Launcher Ammo : 6 -> 3",
      "💥 Rocket Launcher Splash Radius 60 -> 75",
    ],
  },
  {
    version: "1.0.0 Launching Update",
    date: "2025-09-12",
    changes: [
      "🚀 New buff system with icons & animations",
      "🛡️ Shield & Rocket Launcher mechanics",
      "🎵 Retro sound effects",
      "📌 UI improvements",
    ],
  },
];
let currentLogIndex = 0;
function loadUpdateLogs() {
  currentLogIndex = 0;
  showLog(currentLogIndex);
}
function showLog(index) {
  if (!updateLogs.length) return;
  const log = updateLogs[index];
  document.getElementById(
    "updateLogTitle"
  ).textContent = `Update ${log.version}`;
  document.getElementById("updateLogDate").textContent = log.date;
  const list = document.getElementById("updateLogList");
  list.innerHTML = "";
  log.changes.forEach((c) => {
    const d = document.createElement("div");
    d.textContent = c;
    list.appendChild(d);
  });
  document.getElementById("btnPrevLog").disabled =
    index === updateLogs.length - 1;
  document.getElementById("btnNextLog").disabled = index === 0;
}
document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("updateLogModal");
  const btnOpen = document.getElementById("btnUpdateLog");
  const btnClose = document.getElementById("btnCloseUpdateLog");
  const btnPrev = document.getElementById("btnPrevLog");
  const btnNext = document.getElementById("btnNextLog");
  function openModal() {
    modal.classList.remove("hidden", "fade-out");
    void modal.offsetWidth;
    modal.classList.add("fade-in");
  }
  function closeModal() {
    modal.classList.remove("fade-in");
    modal.classList.add("fade-out");
    setTimeout(() => modal.classList.add("hidden"), 400);
  }
  btnOpen.addEventListener("click", openModal);
  btnClose.addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });
  btnPrev.addEventListener("click", () => {
    if (currentLogIndex < updateLogs.length - 1) {
      currentLogIndex++;
      showLog(currentLogIndex);
    }
  });
  btnNext.addEventListener("click", () => {
    if (currentLogIndex > 0) {
      currentLogIndex--;
      showLog(currentLogIndex);
    }
  });
  if (!localStorage.getItem("updateLogShown")) {
    openModal();
    localStorage.setItem("updateLogShown", "true");
  }
  loadUpdateLogs();
});
// ===== Buffs & Icons =====
let allBuffs = [
  "Dodge",
  "Rage",
  "Shield",
  "Agility",
  "Assault",
  "Bouncing Bullet",
  "Healing Ring",
  "Sniper Aid",
  "Rocket Launcher",
  "Second Chance",
];
const buffIcons = {};
allBuffs.forEach((b) => {
  const key = b.toLowerCase().replace(/ /g, "_");
  const img = new Image();
  img.src = `img/${key}.png`;
  buffIcons[b] = img;
});
// ===== Resize & caches rebuild =====
function rebuildBackgroundCache() {
  const W = canvas.width,
    H = canvas.height;
  bgCanvas.width = W;
  bgCanvas.height = H;
  const g = bgCtx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, currentSpaceTheme.bgTop);
  g.addColorStop(1, currentSpaceTheme.bgBottom);
  bgCtx.fillStyle = g;
  bgCtx.fillRect(0, 0, W, H);
  bgCtx.save();
  bgCtx.globalAlpha = 0.8;
  bgCtx.fillStyle = currentSpaceTheme.nebula;
  bgCtx.restore();
}
// Star layers re-render
function rebuildStarLayers() {
  const W = canvas.width,
    H = canvas.height;
  const color = currentSpaceTheme.starColor;
  for (const layer of Object.values(starLayers)) {
    layer.cvs.width = W;
    layer.cvs.height = H;
    const sctx = layer.ctx;
    sctx.clearRect(0, 0, W, H);
    sctx.fillStyle = color;
    const base = 140;
    const count =
      layer === starLayers.far
        ? base
        : layer === starLayers.mid
        ? Math.floor(base * 0.6)
        : Math.floor(base * 0.3);
    for (let i = 0; i < count; i++) {
      const x = Math.random() * W;
      const y = Math.random() * H;
      const size =
        layer === starLayers.far
          ? Math.random() * 1 + 0.5
          : layer === starLayers.mid
          ? Math.random() * 1.5 + 0.8
          : Math.random() * 2 + 1;
      sctx.globalAlpha =
        layer === starLayers.far
          ? 0.6 + Math.random() * 0.3
          : layer === starLayers.mid
          ? 0.8
          : 1;
      sctx.fillRect(x, y, size, size);
    }
    layer.offsetY = 0;
  }
  // Twinkles reset (jumlah tergantung quality)
  twinkles = [];
  const maxTw = quality === "high" ? MAX_TWINKLES_HQ : MAX_TWINKLES_LQ;
  for (let i = 0; i < maxTw; i++) {
    twinkles.push({
      x: Math.random() * W,
      y: Math.random() * H,
      t: Math.random() * 2000,
    });
  }
}
function setSpaceTheme(lvl) {
  currentSpaceTheme =
    spaceThemes[Math.floor((lvl - 1) / 3) % spaceThemes.length];
  rebuildBackgroundCache();
  rebuildStarLayers();
}
function resizeCanvas() {
  const scale = Math.min(window.innerWidth / 900, window.innerHeight / 600);
  canvas.style.width = canvas.width * scale + "px";
  canvas.style.height = canvas.height * scale + "px";
  rebuildBackgroundCache();
  rebuildStarLayers();
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas(); // first
// ===== Draw helpers =====
function drawBackground() {
  ctx.drawImage(bgCanvas, 0, 0);
}
function drawStars() {
  const W = canvas.width,
    H = canvas.height;
  for (const layer of Object.values(starLayers)) {
    layer.offsetY += starSpeed * layer.speedMul;
    if (layer.offsetY >= H) layer.offsetY -= H;
    ctx.globalAlpha = 1;
    ctx.drawImage(layer.cvs, 0, Math.floor(layer.offsetY));
    ctx.drawImage(layer.cvs, 0, Math.floor(layer.offsetY) - H);
  }
  // twinkles
  const twColor = currentSpaceTheme.twinkleColor;
  const doGlow = quality === "high";
  for (let i = 0; i < twinkles.length; i++) {
    const t = twinkles[i];
    t.t += 16;
    const a = (Math.sin(t.t / 400) * 0.5 + 0.5) * 0.6;
    if (doGlow) {
      ctx.save();
      ctx.shadowBlur = 8;
      ctx.shadowColor = twColor;
      ctx.fillStyle = twColor;
      ctx.globalAlpha = a;
      ctx.fillRect(t.x, t.y, 2, 2);
      ctx.restore();
    } else {
      ctx.globalAlpha = a;
      ctx.fillStyle = twColor;
      ctx.fillRect(t.x, t.y, 2, 2);
      ctx.globalAlpha = 1;
    }
  }
}
function addShake(strength = 6) {
  shake = Math.max(shake, strength);
}
// ===== Player/Enemy drawing =====
function drawPlayer(x, y, color = "#61dafb") {
  const doGlow = quality === "high";
  ctx.save();
  const grad = ctx.createLinearGradient(x, y - 20, x, y + 20);
  grad.addColorStop(0, "#9be7ff");
  grad.addColorStop(1, "#2b6b88");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(x, y - 14);
  ctx.lineTo(x - 12, y + 12);
  ctx.lineTo(x + 12, y + 12);
  ctx.closePath();
  ctx.fill();
  if (doGlow) {
    ctx.shadowBlur = 12;
    ctx.shadowColor = "#5fe8ff";
    ctx.strokeStyle = "rgba(95,232,255,0.6)";
    ctx.lineWidth = 2;
    ctx.stroke();
    const f = Math.random() * 6 + 8;
    ctx.shadowBlur = 18;
    ctx.shadowColor = "orange";
    ctx.fillStyle = "rgba(255,180,60,0.9)";
    ctx.beginPath();
    ctx.moveTo(x, y + 12);
    ctx.lineTo(x - 5, y + 12 + f);
    ctx.lineTo(x + 5, y + 12 + f);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.strokeStyle = "rgba(95,232,255,0.4)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "rgba(255,180,60,0.6)";
    ctx.beginPath();
    ctx.moveTo(x, y + 12);
    ctx.lineTo(x - 4, y + 20);
    ctx.lineTo(x + 4, y + 20);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}
function drawEnemy(e) {
  ctx.fillStyle =
    e.type === "yellow"
      ? "yellow"
      : e.type === "purple"
      ? "purple"
      : e.type === "mini"
      ? "red"
      : "lime";
  ctx.beginPath();
  if (e.type === "green") {
    ctx.moveTo(e.x, e.y - 12);
    ctx.lineTo(e.x - 12, e.y);
    ctx.lineTo(e.x, e.y + 12);
    ctx.lineTo(e.x + 12, e.y);
    ctx.closePath();
  } else if (e.type === "yellow") {
    ctx.moveTo(e.x, e.y + 14);
    ctx.lineTo(e.x - 12, e.y - 10);
    ctx.lineTo(e.x + 12, e.y - 10);
    ctx.closePath();
  } else if (e.type === "purple") {
    const size = 12;
    for (let i = 0; i < 6; i++) {
      let a = (Math.PI / 3) * i;
      let px = e.x + size * Math.cos(a),
        py = e.y + size * Math.sin(a);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  } else if (e.type === "mini") {
    ctx.arc(e.x, e.y, 8, 0, Math.PI * 2);
  }
  ctx.fill();
}
// ===== explodeBullet fix (canvas ctx) =====
function explodeBullet(bullet) {
  let explosion = { x: bullet.x, y: bullet.y, r: 2, alpha: 1 };
  const interval = setInterval(() => {
    const ctx2 = canvas.getContext("2d");
    ctx2.save();
    ctx2.globalAlpha = explosion.alpha;
    ctx2.strokeStyle = "red";
    ctx2.beginPath();
    ctx2.arc(explosion.x, explosion.y, explosion.r, 0, Math.PI * 2);
    ctx2.stroke();
    ctx2.restore();
    explosion.r += 2;
    explosion.alpha -= 0.1;
    if (explosion.alpha <= 0) clearInterval(interval);
  }, 30);
}
// ===== Input (keys) =====
function resetKeys() {
  keys = {};
}
window.addEventListener("keydown", (e) => {
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key))
    e.preventDefault();
  keys[e.key.toLowerCase()] = true;
});
window.addEventListener("keyup", (e) => {
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key))
    e.preventDefault();
  keys[e.key.toLowerCase()] = false;
});
// ===== Game Init =====
function initGame() {
  // ⛔ Reset dialog
  const dialogBox = document.getElementById("dialogBox");
  const dialogText = document.getElementById("dialogText");
  dialogBox.classList.add("hidden");
  dialogText.textContent = "";
  clearAllDialogTimers();

  gameStarted = false;
  player = { x: canvas.width / 2, y: canvas.height - 50, w: 24, h: 24 };
  bullets = [];
  enemies = [];
  enemyBullets = [];
  enemyQueue = [];
  score = 0;
  lives = 3;
  level = 1;
  totalEnemies = 0;
  enemiesKilled = 0;
  gameOverState = false;
  showMenu = false;
  explosions = [];
  boss = null;
  offeredBuffs = [];
  activeBuffs = [];
  rocketAmmo = 0;
  shieldCharges = 0;
  healUsed = false;
  sniperAlly = null;
  sniperUsedThisLevel = false;
  sniperShots = [];
  sniperLasers = [];
  secondChanceUsed = false;
  secondChanceShieldActive = false;
  secondChanceShieldTimer = 0;
  const buffGrid = document.getElementById("buffGrid");
  if (buffGrid) {
    buffGrid.querySelectorAll(".buffCard").forEach((card) => {
      card.dataset.status = "empty";
      card.dataset.refillTriggered = "0";
      card.dataset.expireTriggered = "0";
      card.dataset.fill = "0";
      card.style.removeProperty("--fill");
      card.style.removeProperty("--buff-color");
      card.style.borderImage = "";
      card.style.filter = "none";
      card.classList.remove(
        "buff-refill",
        "buff-expired",
        "buff-expired-anim",
        "buff-progress",
        "buff-border-refill"
      );
      const img = card.querySelector("img");
      const plus = card.querySelector(".plus");
      if (img) {
        img.style.display = "none";
        img.style.filter = "none";
        img.alt = "";
      }
      if (plus) plus.style.display = "";
    });
  }
  resetKeys();
  setSpaceTheme(1);
  gameRunning = true;
  startLevel();
  gameStarted = true;
  updateBuffList();
}
// ===== Levels & Buffs =====
let offeredBuffs = [],
  sniperAlly = null,
  sniperUsedThisLevel = false,
  sniperShots = [],
  sniperLasers = [];
let rocketAmmo = 0,
  secondChanceUsed = false,
  secondChanceShieldActive = false,
  secondChanceShieldTimer = 0;
const buffDescriptions = {
  Dodge: "50% chance to avoid damage.",
  Rage: "Shoot faster (+20%) per lost life.",
  Shield: "One shield per level, absorbs 2 hits.",
  Agility: "Increase ship speed by 20%.",
  Assault: "Reduce enemy waves by 10%.",
  "Bouncing Bullet": "Bullets bounce up to 2 enemies, 20% chance for 3rd.",
  "Healing Ring": "Heal 1 life per level (once per level).",
  "Sniper Aid": "A sniper ally targets 3 strongest enemies each level.",
  "Rocket Launcher": "3 rockets per level, high damage, splash on hit.",
  "Second Chance": "Revive once after death.",
};
function startLevel() {
  setSpaceTheme(level);
  showLevelDialog(level);
  levelCleared = false;
  totalEnemies = Math.min(200, 5 + Math.floor((level - 1) * 1.8));
  if (activeBuffs.includes("Assault"))
    totalEnemies = Math.floor(totalEnemies * 0.9);
  if (activeBuffs.includes("Healing Ring")) healUsed = false;
  if (activeBuffs.includes("Sniper Aid")) {
    sniperShots = [];
    sniperUsedThisLevel = false;
  }
  if (activeBuffs.includes("Rocket Launcher")) rocketAmmo = 3;
  enemiesKilled = 0;
  enemies = [];
  enemyQueue = [];
  boss = null;
  if (level % 5 === 0) {
    boss = {
      x: canvas.width / 2,
      y: 100,
      w: 80,
      h: 80,
      hp: 40,
      maxHp: 40,
      fireCooldown: 3500,
      summonCooldown: 3750,
    };
    let helperCount = Math.floor(totalEnemies * 0.2);
    for (let i = 0; i < helperCount; i++) {
      let type = "green";
      if (level >= 3 && Math.random() < 0.2) type = "yellow";
      if (level >= 5 && Math.random() < 0.2) type = "purple";
      enemyQueue.push({
        x: 40 + (i % 10) * 60,
        y: -30 - i * 30,
        w: 24,
        h: 24,
        type,
        vy: ENEMY_SPEED,
        vx: Math.random() < 0.5 ? -0.3 : 0.3,
        alpha: 0,
        enter: true,
        fireCooldown:
          ENEMY_FIRE_MIN + Math.random() * (ENEMY_FIRE_MAX - ENEMY_FIRE_MIN),
      });
    }
  } else {
    for (let i = 0; i < totalEnemies; i++) {
      let type = "green";
      if (level >= 3 && Math.random() < 0.2) type = "yellow";
      if (level >= 5 && Math.random() < 0.2) type = "purple";
      enemyQueue.push({
        x: 40 + (i % 10) * 60,
        y: -30 - i * 30,
        w: 24,
        h: 24,
        type,
        vy: ENEMY_SPEED,
        vx: Math.random() < 0.5 ? -0.3 : 0.3,
        alpha: 0,
        enter: true,
        fireCooldown:
          ENEMY_FIRE_MIN + Math.random() * (ENEMY_FIRE_MAX - ENEMY_FIRE_MIN),
      });
    }
  }
  if (activeBuffs.includes("Shield")) shieldCharges = 2;
  refreshBuffCards(true);
  levelTextTimer = 2000;
}
// Buff selection (mouse)
canvas.addEventListener("click", (e) => {
  // ⛔ blok saat tidak di layer pilih / sedang animasi
  if (!showBuffSelection || pickingBuff) return;

  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width,
    scaleY = canvas.height / rect.height;
  const x = (e.clientX - rect.left) * scaleX,
    y = (e.clientY - rect.top) * scaleY;

  // Gunakan for biasa (bisa "break"), bukan forEach (tidak bisa break)
  for (let i = 0; i < offeredBuffs.length; i++) {
    const buff = offeredBuffs[i];
    let cardW = canvas.width * 0.18,
      cardH = canvas.height * 0.38;
    let totalW = offeredBuffs.length * (cardW + 30) - 30;
    let startX = (canvas.width - totalW) / 2;
    let bx = startX + i * (cardW + 30),
      by = canvas.height * 0.32;

    if (x >= bx && x <= bx + cardW && y >= by && y <= by + cardH) {
      // ==== ANIMASI + ANTI-DOUBLETAP ====
      // 1) tandai sedang picking (blok klik selanjutnya)
      pickingBuff = true;
      // 2) nonaktifkan pointer di canvas sementara
      canvas.style.pointerEvents = "none";

      // fromRect untuk ghost
      const cRect = rect; // sudah dapat di atas
      const fromRect = {
        left: cRect.left + bx * (cRect.width / canvas.width),
        top: cRect.top + by * (cRect.height / canvas.height),
        width: cardW * (cRect.width / canvas.width),
        height: cardH * (cRect.height / canvas.height),
      };

      // Sembunyikan overlay pemilihan agar slot tujuan kelihatan
      showBuffSelection = false;

      // Jalankan animasi
      animateBuffPick(buff, fromRect, () => {
        // Pastikan tidak duplikat:
        if (!activeBuffs.includes(buff)) {
          activeBuffs.push(buff);
          if (buff === "Healing Ring") {
            const bannerDuration = 1600;
            const bannerText = "Press 'E' to activate Healing Ring";
            const bannerImage = new Image();
            bannerImage.src = "img/healing_ring.png";
            bannerImage.onload = () => {
              const bannerCanvas = document.createElement("canvas");
              bannerCanvas.width = 400;
              bannerCanvas.height = 100;
              const bctx = bannerCanvas.getContext("2d");
              bctx.fillStyle = "rgba(0, 0, 0, 0.8)";
              bctx.fillRect(0, 0, bannerCanvas.width, bannerCanvas.height);
              bctx.drawImage(bannerImage, 10, 10, 80, 80);
              bctx.fillStyle = "#FFFFFF";
              bctx.font = "16px Orbitron, sans-serif";
              bctx.fillText(bannerText, 100, 50);
              const banner = document.createElement("div");
              banner.style.position = "fixed";
              banner.style.left = "50%";
              banner.style.top = "20px";
              banner.style.transform = "translateX(-50%)";
              banner.style.zIndex = "9999";
              banner.appendChild(bannerCanvas);
              document.body.appendChild(banner);
              setTimeout(() => banner.remove(), bannerDuration);
            };
          }
        }

        updateBuffList();
        if (buff === "Shield") shieldCharges = 2;
        if (buff === "Assault") totalEnemies = Math.floor(totalEnemies * 0.9);

        startLevel(); // lanjut level

        // pulihkan state anti-spam
        pickingBuff = false;
        canvas.style.pointerEvents = "";
      });

      break; // ⬅️ stop, jangan cek kartu lain
    }
  }
});

// ===== Spawns =====
function spawnEnemies() {
  const onScreenLimit = quality === "high" ? 15 : 10; // QUALITY cap
  while (enemies.length < onScreenLimit && enemyQueue.length > 0) {
    enemies.push(enemyQueue.shift());
  }
}
// rect overlap
function rectsOverlap(a, b) {
  return (
    a.x - a.w / 2 < b.x + b.w / 2 &&
    a.x + a.w / 2 > b.x - b.w / 2 &&
    a.y - a.h / 2 < b.y + b.h / 2 &&
    a.y + a.h / 2 > b.y - b.h / 2
  );
}
// Explosions
function createExplosion(x, y, color = "yellow", power = 30) {
  if (explosions.length > MAX_EXPLOSIONS)
    explosions.splice(0, explosions.length - MAX_EXPLOSIONS);
  const count = quality === "high" ? 14 : 8;
  for (let i = 0; i < count; i++)
    explosions.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 5,
      vy: (Math.random() - 0.5) * 5,
      life: power,
      color,
    });
  if (rocketExplosions.length > MAX_ROCKET_RINGS)
    rocketExplosions.splice(0, rocketExplosions.length - MAX_ROCKET_RINGS);
  rocketExplosions.push({
    x,
    y,
    r: 0,
    maxR: quality === "high" ? 55 : 45,
    life: quality === "high" ? 16 : 10,
    ring: true,
  });
  addShake(4);
  explodeSFX.cloneNode().play();
}
// ===== Sniper logic & drawing =====
function updateSniper(dt) {
  if (!activeBuffs.includes("Sniper Aid")) return;
  for (let li = sniperLasers.length - 1; li >= 0; li--) {
    sniperLasers[li].life -= dt;
    if (sniperLasers[li].life <= 0) sniperLasers.splice(li, 1);
  }
  if (!sniperAlly && !sniperUsedThisLevel) {
    sniperAlly = {
      x: player.x,
      y: player.y - 80,
      state: "idle",
      shotsLeft: 3,
      target: null,
      aimTimer: 0,
      aimDuration: 0,
      currentLaser: null,
    };
  }
  if (!sniperAlly) return;
  if (sniperAlly.state !== "leave") {
    sniperAlly.x += (player.x - sniperAlly.x) * 0.1;
    sniperAlly.y = player.y - 80;
  }
  if (sniperAlly.state === "idle") {
    if (sniperAlly.shotsLeft > 0) {
      let visibleEnemies = enemies.filter((e) => e.y > 0 && !e._sniperTargeted);
      let candidates = [];
      if (boss && boss.y > 0 && !boss._sniperTargeted) candidates.push(boss);
      candidates.push(...visibleEnemies);
      if (candidates.length > 0) {
        candidates.sort((a, b) => {
          const rank = (e) =>
            e === boss
              ? 4
              : e.type === "purple" || e.type === "mini"
              ? 3
              : e.type === "yellow"
              ? 2
              : 1;
          return rank(b) - rank(a);
        });
        let tgt = candidates[0];
        sniperAlly.target = tgt;
        if (tgt) tgt._sniperTargeted = true;
        sniperAlly.aimDuration = 1800 + Math.random() * 600;
        sniperAlly.aimTimer = sniperAlly.aimDuration;
        sniperAlly.currentLaser = {
          x1: sniperAlly.x,
          y1: sniperAlly.y - 12,
          x2: tgt.x + (tgt.w ?? 0) / 2,
          y2: tgt.y + (tgt.h ?? 0) / 2,
          life: sniperAlly.aimDuration,
        };
        sniperLasers.push(sniperAlly.currentLaser);
        sniperAlly.state = "aiming";
      }
    } else {
      sniperAlly.state = "leave";
    }
  }
  if (sniperAlly.state === "aiming") {
    let candidates = [];
    if (boss && boss.y > 0 && boss.y < canvas.height) candidates.push(boss);
    for (let e of enemies) {
      if (e.y > 0 && e.y < canvas.height) candidates.push(e);
    }
    if (candidates.length === 0) {
      if (sniperAlly.currentLaser)
        sniperLasers = sniperLasers.filter(
          (l) => l !== sniperAlly.currentLaser
        );
      sniperAlly.target = null;
      sniperAlly.state = "idle";
      return;
    }
    const getPriority = (enemy) =>
      enemy === boss
        ? 4
        : enemy.type === "purple" || enemy.type === "mini"
        ? 3
        : enemy.type === "yellow"
        ? 2
        : 1;
    candidates.sort((a, b) => {
      const pr = getPriority(b) - getPriority(a);
      if (pr !== 0) return pr;
      const da = Math.hypot(a.x - sniperAlly.x, a.y - sniperAlly.y),
        db = Math.hypot(b.x - sniperAlly.x, b.y - sniperAlly.y);
      return da - db;
    });
    sniperAlly.target = candidates[0];
    if (sniperAlly.target) {
      if (!sniperAlly.currentLaser) {
        sniperAlly.currentLaser = {
          x1: sniperAlly.x,
          y1: sniperAlly.y - 12,
          x2: sniperAlly.target.x,
          y2: sniperAlly.target.y,
          life: sniperAlly.aimTimer,
        };
        sniperLasers.push(sniperAlly.currentLaser);
      } else {
        sniperAlly.currentLaser.x1 = sniperAlly.x;
        sniperAlly.currentLaser.y1 = sniperAlly.y - 12;
        sniperAlly.currentLaser.x2 = sniperAlly.target.x;
        sniperAlly.currentLaser.y2 = sniperAlly.target.y;
        sniperAlly.currentLaser.life = sniperAlly.aimTimer;
      }
    }
    sniperAlly.aimTimer -= dt;
    if (sniperAlly.aimTimer <= 0 && sniperAlly.target) {
      let dx = sniperAlly.target.x - sniperAlly.x;
      let dy = sniperAlly.target.y - (sniperAlly.y - 12);
      let len = Math.sqrt(dx * dx + dy * dy) || 1;
      sniperShots.push({
        x: sniperAlly.x,
        y: sniperAlly.y - 12,
        vx: (dx / len) * 25,
        vy: (dy / len) * 25,
        w: 6,
        h: 6,
        target: sniperAlly.target,
      });
      sniperLasers = sniperLasers.filter((l) => l !== sniperAlly.currentLaser);
      sniperAlly.currentLaser = null;
      sniperAlly.target = null;
      sniperAlly.shotsLeft--;
      updateBuffList(); // ✅ Sinkronkan UI segera saat peluru Sniper terpakai
      sniperAlly.state = sniperAlly.shotsLeft > 0 ? "idle" : "leave";
    }
  }
  if (sniperAlly.state === "leave") {
    sniperAlly.y -= 5;
    if (sniperAlly.currentLaser) {
      sniperLasers = sniperLasers.filter((l) => l !== sniperAlly.currentLaser);
      sniperAlly.currentLaser = null;
    }
    if (sniperAlly.y < -60) {
      sniperAlly = null;
      sniperUsedThisLevel = true;
      updateBuffList();
    }
  }
}
function drawSniper() {
  if (sniperAlly) {
    ctx.save();
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.moveTo(sniperAlly.x, sniperAlly.y - 12);
    ctx.lineTo(sniperAlly.x - 10, sniperAlly.y + 12);
    ctx.lineTo(sniperAlly.x + 10, sniperAlly.y + 12);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  for (let i = 0; i < sniperLasers.length; i++) {
    const l = sniperLasers[i];
    ctx.save();
    ctx.strokeStyle = "red";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(l.x1, l.y1);
    ctx.lineTo(l.x2, l.y2);
    ctx.stroke();
    ctx.restore();
  }
  ctx.fillStyle = "cyan";
  for (let i = 0; i < sniperShots.length; i++) {
    const s = sniperShots[i];
    ctx.fillRect(s.x - 2, s.y - 8, 4, 16);
  }
}
// ===== Update =====
function update(dt) {
  if (!gameRunning) return;
  // if (pickingBuff) return; // jeda semua logika update selama animasi pick
  // Clamp dt
  if (dt > MAX_DT_MS) dt = MAX_DT_MS;
  // Auto quality switch
  fpsSamples.push(1000 / (dt || 16));
  if (fpsSamples.length > 30) fpsSamples.shift();
  avgFPS = fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length;
  if (avgFPS < 45 && quality !== "low") {
    quality = "low";
    rebuildStarLayers();
  } else if (avgFPS > 55 && quality !== "high") {
    quality = "high";
    rebuildStarLayers();
  }
  updateBuffList();
  updateSniper(dt);
  starSpeed = warp ? 6 : quality === "high" ? 1 : 0.8;
  let speed = PLAYER_SPEED;
  if (activeBuffs.includes("Agility")) speed *= 1.2;
  if (secondChanceShieldActive) {
    secondChanceShieldTimer -= dt;
    if (secondChanceShieldTimer <= 0) secondChanceShieldActive = false;
  }
  if (keys["arrowleft"] || keys["a"]) player.x -= speed;
  if (keys["arrowright"] || keys["d"]) player.x += speed;
  if (keys["arrowup"] || keys["w"]) player.y -= speed;
  if (keys["arrowdown"] || keys["s"]) player.y += speed;
  player.x = Math.max(20, Math.min(canvas.width - 20, player.x));
  player.y = Math.max(20, Math.min(canvas.height - 20, player.y));
  let fireRateBonus = 1;
  if (activeBuffs.includes("Rage")) {
    let lost = 3 - lives;
    fireRateBonus += lost * 0.2;
  }
  if (keys.space && Date.now() - lastShot > FIRE_RATE / fireRateBonus) {
    if (activeBuffs.includes("Rocket Launcher") && rocketAmmo > 0) {
      bullets.push({
        x: player.x,
        y: player.y - 20,
        w: 8,
        h: 20,
        vy: -BULLET_SPEED * 0.8,
        rocket: true,
      });
      rocketAmmo--;
      explodeSFX.cloneNode().play();
    } else {
      bullets.push({
        x: player.x,
        y: player.y - 15,
        w: 4,
        h: 10,
        vy: -BULLET_SPEED,
      });
      shootSFX.cloneNode().play();
    }
    lastShot = Date.now();
  }
  for (let i = 0; i < bullets.length; i++) {
    const b = bullets[i];
    if (activeBuffs.includes("Bouncing Bullet")) {
      if (b.bounce >= 2 && Math.random() > 0.2) continue;
    }
    b.x += b.vx ?? 0;
    b.y += b.vy;
  }
  bullets = bullets.filter((b) => b.y > -20 && b.y < canvas.height + 20);
  // Enemy bullets
  for (let i = 0; i < enemyBullets.length; i++) {
    const b = enemyBullets[i];
    b.x += b.vx;
    b.y += b.vy;
    if (b.style === "rocket") {
      const sampleEvery = quality === "high" ? 32 : 48;
      if (!b._trailAccum) b._trailAccum = 0;
      b._trailAccum += 16;
      if (b._trailAccum >= sampleEvery) {
        b._trailAccum = 0;
        b.trailX[b.trailHead] = b.x;
        b.trailY[b.trailHead] = b.y + 10;
        b.trailHead = (b.trailHead + 1) % b.trailX.length;
        if (b.trailLen < b.trailX.length) b.trailLen++;
      }
    }
  }
  enemyBullets = enemyBullets.filter((b) => b.y < canvas.height + 20);
  // Bullet vs boss
  if (boss) {
    for (let bi = bullets.length - 1; bi >= 0; bi--) {
      const b = bullets[bi];
      if (
        b.x > boss.x - boss.w / 2 &&
        b.x < boss.x + boss.w / 2 &&
        b.y > boss.y - boss.h / 2 &&
        b.y < boss.y + boss.h / 2
      ) {
        boss.hp -= 1;
        bullets.splice(bi, 1);
        explosions.push({
          x: b.x,
          y: b.y,
          vx: 0,
          vy: 0,
          life: 15,
          color: "white",
        });
      }
    }
    if (boss.hp <= 0) {
      createExplosion(boss.x, boss.y, "orange");
      for (let i = enemies.length - 1; i >= 0; i--) {
        createExplosion(enemies[i].x, enemies[i].y, "red");
        enemies.splice(i, 1);
        enemiesKilled++;
        score += 10;
        if (score > highScore) {
          highScore = score;
          localStorage.setItem("highScore", highScore);
        }
      }
      enemyQueue = [];
      enemyBullets.forEach((b) => createExplosion(b.x, b.y, "red"));
      enemyBullets = [];
      score += 200;
      boss = null;
      enemiesKilled = Math.min(enemiesKilled, totalEnemies);
      levelCleared = true;
      warp = true;
      setTimeout(() => {
        warp = false;
        level++;
        if (level % 2 === 0 && activeBuffs.length < allBuffs.length) {
          offeredBuffs = allBuffs
            .filter((b) => !activeBuffs.includes(b))
            .sort(() => Math.random() - 0.5)
            .slice(0, 3);
          showBuffSelection = true;
        } else startLevel();
      }, 1000);
    }
  }
  spawnEnemies();
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (e.enter) {
      e.alpha += 0.03;
      if (e.alpha >= 1) e.enter = false;
    } else {
      if (e.type === "mini") {
        let dx = player.x - e.x,
          dy = player.y - e.y;
        let len = Math.sqrt(dx * dx + dy * dy) || 1;
        e.x += (dx / len) * 2;
        e.y += (dy / len) * 2;

        // === PATCH: Mini kamikaze collision vs player ===
        // Ketika mini menabrak player, terapkan damage setara peluru musuh:
        // - Perhitungkan Dodge (25%) dan Shield (2 charges/level).
        // - Mini meledak dan menghilang setelah menabrak.
        // - Player menerima 1 damage bila tidak dodge/shield.
        if (rectsOverlap({ x: e.x, y: e.y, w: e.w, h: e.h }, player)) {
          // Ledakan kecil di titik tabrakan
          createExplosion(e.x, e.y, "red", 18);

          // Cek Dodge
          if (activeBuffs.includes("Dodge") && Math.random() < 0.5) {
            // Efek teks di titik tabrakan mini (pakai posisi musuh mini)
            spawnDodgeText(e.x, e.y);
            triggerDodgeBanner(800); // banner opsional

            // Mini dihapus setelah gagal menabrak (karena didodge)
            enemies.splice(i, 1);
            i--;
            continue; // NO DAMAGE
          }

          // Cek Shield atau Second Chance shield aktif
          if (
            (activeBuffs.includes("Shield") || secondChanceShieldActive) &&
            shieldCharges > 0
          ) {
            shieldCharges--;
            enemies.splice(i, 1);
            i--;
            // Sinkronkan UI buff (mis. indikator shield)
            updateBuffList();
            continue;
          }

          // Berikan damage ke player
          lives -= 1;
          if (lives < 0) lives = 0;
          hitFlash = 200;

          // Mini dihapus setelah tabrakan
          enemies.splice(i, 1);
          i--;

          if (lives <= 0) {
            gameOver();
          } else {
            updateBuffList();
          }
          continue; // lanjut ke musuh berikutnya
        }
        // === END PATCH ===
      } else {
        e.y += e.vy;
        e.x += e.vx;
        if (e.x < 20 || e.x > canvas.width - 20) e.vx *= -1;
      }
      if (e.type === "green" || e.type === "purple") {
        e.fireCooldown -= dt;
        if (e.fireCooldown <= 0 && enemyBullets.length < MAX_ENEMY_BULLETS) {
          let dx = player.x - e.x,
            dy = player.y - e.y,
            len = Math.sqrt(dx * dx + dy * dy) || 1;
          enemyBullets.push({
            x: e.x,
            y: e.y,
            w: 4,
            h: 8,
            vx: (dx / len) * ENEMY_BULLET_SPEED,
            vy: (dy / len) * ENEMY_BULLET_SPEED,
            dmg: 1,
            style: "plasma",
          });
          e.fireCooldown =
            ENEMY_FIRE_MIN + Math.random() * (ENEMY_FIRE_MAX - ENEMY_FIRE_MIN);
        }
      } else if (e.type === "yellow") {
        e.fireCooldown -= dt;
        if (e.fireCooldown <= 0) {
          enemyBullets.push({
            x: e.x,
            y: e.y,
            w: 6,
            h: 14,
            vx: 0,
            vy: ENEMY_BULLET_SPEED * 0.7,
            dmg: 2,
            style: "rocket",
            trailX: new Float32Array(quality === "high" ? 8 : 4),
            trailY: new Float32Array(quality === "high" ? 8 : 4),
            trailLen: 0,
            trailHead: 0,
          });
          e.fireCooldown = ENEMY_FIRE_MIN * 2;
        }
      }
      // === PATCH: gameOver karena lewat batas bawah hanya untuk non-mini ===
      if (e.type !== "mini" && e.y > canvas.height - 20) gameOver();
      // === END PATCH ===
    }
  }
  // Bullets vs Enemies (+ rocket splash)
  for (let bi = bullets.length - 1; bi >= 0; bi--) {
    let b = bullets[bi];
    let hitHandled = false;
    for (let ei = enemies.length - 1; ei >= 0; ei--) {
      let e = enemies[ei];
      if (rectsOverlap(b, e)) {
        if (b.rocket) {
          const cx = b.x,
            cy = b.y,
            BLAST = quality === "high" ? 75 : 60;
          createExplosion(cx, cy, "orange");
          rocketExplosions.push({
            x: cx,
            y: cy,
            r: 0,
            maxR: BLAST,
            life: quality === "high" ? 9 : 7,
          });
          for (let j = enemies.length - 1; j >= 0; j--) {
            let enemy = enemies[j];
            let dx = enemy.x - cx,
              dy = enemy.y - cy;
            let dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= BLAST) {
              if (enemy._sniperTargeted) enemy._sniperTargeted = false;
              createExplosion(enemy.x, enemy.y, "red");
              enemies.splice(j, 1);
              enemiesKilled++;
              score += 10;
              if (score > highScore) {
                highScore = score;
                localStorage.setItem("highScore", highScore);
              }
            }
          }
          if (boss) {
            let dx = boss.x - cx,
              dy = boss.y - cy;
            let dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= BLAST) {
              boss.hp -= 45;
              if (boss.hp <= 0) {
                createExplosion(boss.x, boss.y, "orange");
                boss = null;
                score += 200;
              }
            }
          }
          bullets.splice(bi, 1);
          hitHandled = true;
          break;
        }
        const ex = e.x,
          ey = e.y,
          etype = e.type;
        if (e._sniperTargeted) e._sniperTargeted = false;
        createExplosion(ex, ey, "lime");
        bullets.splice(bi, 1);
        enemies.splice(ei, 1);
        enemiesKilled++;
        score += 10;
        if (score > highScore) {
          highScore = score;
          localStorage.setItem("highScore", highScore);
        }
        if (etype === "purple") {
          enemies.push({
            x: ex,
            y: ey,
            w: 16,
            h: 16,
            type: "mini",
            enter: false,
            alpha: 1,
          });
        }
        if (activeBuffs.includes("Bouncing Bullet")) {
          let bounceCount = b.bounce ?? 0;
          let canBounce =
            bounceCount === 0 || (bounceCount === 1 && Math.random() < 0.2);
          if (canBounce) {
            let candidates = enemies;
            if (candidates.length > 0) {
              let target =
                candidates[Math.floor(Math.random() * candidates.length)];
              let dx = target.x - ex,
                dy = target.y - ey,
                len = Math.sqrt(dx * dx + dy * dy) || 1;
              bullets.push({
                x: ex,
                y: ey,
                w: 4,
                h: 10,
                vx: (dx / len) * BULLET_SPEED * 2,
                vy: (dy / len) * BULLET_SPEED * 2,
                bounce: bounceCount + 1,
                angle: Math.atan2(dy, dx),
                bouncing: true,
              });
              explosions.push({
                x: ex,
                y: ey,
                vx: (Math.random() - 0.5) * 2,
                vy: (Math.random() - 0.5) * 2,
                life: 10,
                color: "cyan",
              });
            }
          }
        }
        hitHandled = true;
        break;
      }
    }
    if (hitHandled) continue;
  }
  // Enemy bullets vs Player
  for (let i = enemyBullets.length - 1; i >= 0; i--) {
    const b = enemyBullets[i];
    if (rectsOverlap(b, player)) {
      // 1) Cek Dodge terlebih dahulu
      if (activeBuffs.includes("Dodge") && Math.random() < 0.5) {
        spawnDodgeText(b.x, b.y); // titik benturan pakai posisi peluru
        triggerDodgeBanner(800); // banner opsional
        enemyBullets.splice(i, 1); // hapus peluru yang “miss”
        continue; // NO DAMAGE
      }

      // 2) Shield
      if (
        (activeBuffs.includes("Shield") || secondChanceShieldActive) &&
        shieldCharges > 0
      ) {
        shieldCharges--;
        enemyBullets.splice(i, 1);
        continue;
      }

      // 3) Kena beneran (tanpa dodge/shield)
      if (b.style === "rocket") createExplosion(b.x, b.y, "orange", 22);
      createExplosion(player.x, player.y, "red");
      enemyBullets.splice(i, 1);
      lives -= b.dmg ?? 1;
      if (lives < 0) lives = 0;
      hitFlash = 200;
      if (lives <= 0) gameOver();
      else updateBuffList();
    }
  }
  // Explosions / rocket rings
  for (let i = 0; i < explosions.length; i++) {
    const ex = explosions[i];
    ex.x += ex.vx;
    ex.y += ex.vy;
    ex.life--;
  }
  explosions = explosions.filter((ex) => ex.life > 0);
  for (let i = rocketExplosions.length - 1; i >= 0; i--) {
    let re = rocketExplosions[i];
    re.r += 3;
    re.life -= 1;
    if (re.life <= 0) rocketExplosions.splice(i, 1);
  }
  // Boss logic
  if (boss) {
    boss.x += Math.sin(Date.now() / 1000) * 0.5;
    boss.summonCooldown -= dt;
    if (boss.summonCooldown <= 0) {
      boss.summonCooldown = 5000;
      const summonCount = quality === "high" ? 4 : 3;
      for (let i = 0; i < summonCount; i++) {
        let roll = Math.random();
        let type = "green";
        if (roll < 0.1) type = "purple";
        else if (roll < 0.4) type = "yellow";
        enemies.push({
          x: boss.x + (Math.random() * 100 - 50),
          y: boss.y + 80 + i * 20,
          w: 24,
          h: 24,
          type,
          vy: ENEMY_SPEED,
          vx: Math.random() < 0.5 ? -0.3 : 0.3,
          alpha: 1,
          enter: false,
          fireCooldown:
            ENEMY_FIRE_MIN + Math.random() * (ENEMY_FIRE_MAX - ENEMY_FIRE_MIN),
        });
        totalEnemies++;
      }
    }
    boss.fireCooldown -= dt;
    if (boss.fireCooldown <= 0) {
      boss.fireCooldown = 3750;
      let bulletCount = quality === "high" ? 9 : 7,
        spread = Math.PI / 2;
      let dx = player.x - boss.x,
        dy = player.y - boss.y,
        baseAngle = Math.atan2(dy, dx);
      for (let i = 0; i < bulletCount; i++) {
        let offset = -spread / 2 + (spread / (bulletCount - 1)) * i;
        let angle = baseAngle + offset;
        enemyBullets.push({
          x: boss.x,
          y: boss.y,
          w: 8,
          h: 8,
          vx: Math.cos(angle) * 4,
          vy: Math.sin(angle) * 4,
          dmg: 1,
          style: "shotgun",
        });
      }
    }
  }
  // Sniper bullets update
  for (let i = sniperShots.length - 1; i >= 0; i--) {
    let s = sniperShots[i];
    if (
      !s.target ||
      (s.target === boss && !boss) ||
      (s.target !== boss && enemies.indexOf(s.target) === -1) ||
      s.target.y < 0 ||
      s.target.y > canvas.height
    ) {
      sniperShots.splice(i, 1);
      continue;
    }
    const tx = s.target.x,
      ty = s.target.y;
    if (!s.locked) {
      let dx = tx - s.x,
        dy = ty - s.y,
        len = Math.sqrt(dx * dx + dy * dy) || 1;
      s.vx = (dx / len) * 25;
      s.vy = (dy / len) * 25;
      s.locked = true;
      s.retargetTimer = 100;
    }
    s.retargetTimer -= dt;
    if (s.retargetTimer <= 0) {
      s.retargetTimer = 100;
      let dx = tx - s.x,
        dy = ty - s.y,
        len = Math.sqrt(dx * dx + dy * dy) || 1;
      s.vx = s.vx * 0.7 + (dx / len) * 25 * 0.3;
      s.vy = s.vy * 0.7 + (dy / len) * 25 * 0.3;
    }
    s.x += s.vx;
    s.y += s.vy;
    const halfW = (s.target.w ?? 10) / 2,
      halfH = (s.target.h ?? 10) / 2;
    if (
      s.x > s.target.x - halfW &&
      s.x < s.target.x + halfW &&
      s.y > s.target.y - halfH &&
      s.y < s.target.y + halfH
    ) {
      createExplosion(s.target.x, s.target.y, "red");
      if (s.target === boss) {
        boss.hp -= 7;
        if (boss.hp <= 0) {
          createExplosion(boss.x, boss.y, "orange");
          boss = null;
          score += 200;
        }
      } else {
        if (s.target._sniperTargeted) s.target._sniperTargeted = false;
        enemies = enemies.filter((e) => e !== s.target);
        enemiesKilled++;
        score += 50;
        if (score > highScore) {
          highScore = score;
          localStorage.setItem("highScore", highScore);
        }
      }
      sniperShots.splice(i, 1);
      continue;
    }
    if (
      s.x < -50 ||
      s.x > canvas.width + 50 ||
      s.y < -50 ||
      s.y > canvas.height + 50
    )
      sniperShots.splice(i, 1);
  }
  sniperLasers = sniperLasers.filter((l) => {
    l.life -= dt;
    return l.life > 0;
  });
  if (levelTextTimer > 0) levelTextTimer -= dt;
  if (
    !levelCleared &&
    !boss &&
    enemiesKilled >= totalEnemies &&
    enemies.length === 0 &&
    enemyQueue.length === 0
  ) {
    levelCleared = true;
    warp = true;
    enemyBullets.forEach((b) => createExplosion(b.x, b.y, "red"));
    enemyBullets = [];
    setTimeout(() => {
      warp = false;
      level++;
      if (level % 2 === 0 && activeBuffs.length < allBuffs.length) {
        offeredBuffs = allBuffs
          .filter((b) => !activeBuffs.includes(b))
          .sort(() => Math.random() - 0.5)
          .slice(0, 3);
        showBuffSelection = true;
      } else startLevel();
    }, 1000);
  }
  // HUD throttled
  hudAccum += dt;
  if (hudAccum >= HUD_UPDATE_MS) {
    hudAccum = 0;
    document.getElementById("score").textContent = score;
    document.getElementById("lives").textContent = lives;
    document.getElementById("level").textContent = level;
    document.getElementById("remaining").textContent = Math.max(
      0,
      totalEnemies - enemiesKilled
    );
    document.getElementById("highscore").textContent = highScore;
  }
}
// ===== Boss draw =====
function drawBoss(b) {
  ctx.save();
  ctx.fillStyle = "magenta";
  ctx.beginPath();
  ctx.arc(b.x, b.y, b.w / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "cyan";
  ctx.beginPath();
  ctx.arc(b.x, b.y, b.w / 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
// ===== Draw =====
function draw() {
  let shook = false;
  if (shake > 0) {
    ctx.save();
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    shake *= 0.9;
    shook = true;
  }
  drawBackground();
  drawStars();
  if (showBuffSelection) {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.92)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const pulse = Math.sin(Date.now() / 500) * 0.3 + 0.7;
    ctx.strokeStyle = `rgba(95,232,255,${pulse * 0.3})`;
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
    ctx.shadowBlur = quality === "high" ? 20 : 0;
    ctx.shadowColor = "rgba(95,232,255,0.8)";
    ctx.fillStyle = "#5FE8FF";
    ctx.font = "bold 32px Orbitron, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("⚡ CHOOSE YOUR POWER ⚡", canvas.width / 2, 80);
    ctx.shadowBlur = 0;
    ctx.font = "16px Orbitron, sans-serif";
    ctx.fillStyle = "#88D5FF";
    ctx.fillText(
      `Level ${level} • Select a Buff to Continue`,
      canvas.width / 2,
      115
    );
    offeredBuffs.forEach((b, i) => {
      let cardW = canvas.width * 0.18,
        cardH = canvas.height * 0.38;
      let totalW = offeredBuffs.length * (cardW + 30) - 30;
      let startX = (canvas.width - totalW) / 2;
      let bx = startX + i * (cardW + 30),
        by = canvas.height * 0.32;

      // Deteksi hover
      let isHovered = false;
      if (
        mouseX >= bx &&
        mouseX <= bx + cardW &&
        mouseY >= by &&
        mouseY <= by + cardH
      ) {
        isHovered = true;
      }

      ctx.save();

      // Wiggle hanya jika tidak di-hover
      if (!isHovered) {
        let wiggleAngle = Math.sin(Date.now() / 200 + i * 2) * 0.03;
        ctx.translate(bx + cardW / 2, by + cardH / 2);
        ctx.rotate(wiggleAngle);
        ctx.translate(-(bx + cardW / 2), -(by + cardH / 2));
      }

      // Perbesar jika di-hover
      if (isHovered) {
        ctx.translate(bx + cardW / 2, by + cardH / 2);
        ctx.scale(1.1, 1.1);
        ctx.translate(-(bx + cardW / 2), -(by + cardH / 2));
      }

      // Gambar kartu seperti biasa
      ctx.shadowBlur = quality === "high" ? 25 : 0;
      ctx.shadowColor = "rgba(95,232,255,0.4)";
      const gradient = ctx.createLinearGradient(bx, by, bx, by + cardH);
      gradient.addColorStop(0, "rgba(25,35,45,0.95)");
      gradient.addColorStop(0.5, "rgba(15,20,30,0.95)");
      gradient.addColorStop(1, "rgba(10,15,20,0.95)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      if (typeof ctx.roundRect === "function")
        ctx.roundRect(bx, by, cardW, cardH, 12);
      else ctx.rect(bx, by, cardW, cardH);
      ctx.fill();

      let borderColor =
        b === "Rocket Launcher"
          ? "#AA00FF"
          : b === "Shield"
          ? "#00AAFF"
          : b === "Healing Ring"
          ? "#FF69B4"
          : b === "Sniper Aid"
          ? "#00FF00"
          : "#5FE8FF";
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.shadowBlur = 0;

      const icon = buffIcons[b];
      if (icon && icon.complete) {
        const maxW = cardW * 0.75,
          maxH = cardH * 0.4;
        const ratio = Math.min(maxW / icon.width, maxH / icon.height);
        const iw = icon.width * ratio,
          ih = icon.height * ratio;
        const ix = bx + (cardW - iw) / 2,
          iy = by + 20;
        ctx.shadowBlur = quality === "high" ? 15 : 0;
        ctx.shadowColor = borderColor;
        ctx.drawImage(icon, ix, iy, iw, ih);
        ctx.shadowBlur = 0;
      }

      ctx.fillStyle = borderColor;
      ctx.font = `bold ${Math.floor(
        canvas.height * 0.028
      )}px Orbitron, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(b, bx + cardW / 2, by + cardH * 0.58);

      ctx.fillStyle = "#B0D0E0";
      ctx.font = `${Math.floor(canvas.height * 0.02)}px Orbitron, sans-serif`;
      let desc = buffDescriptions[b] ?? "";
      let words = desc.split(" ");
      let line = "",
        lh = canvas.height * 0.032,
        y = by + cardH * 0.68;
      words.forEach((w) => {
        let test = line + w + " ";
        let m = ctx.measureText(test);
        if (m.width > cardW * 0.88) {
          ctx.fillText(line, bx + cardW / 2, y);
          line = w + " ";
          y += lh;
        } else line = test;
      });
      ctx.fillText(line, bx + cardW / 2, y);

      const clickPulse = Math.sin(Date.now() / 300) * 0.3 + 0.7;
      ctx.fillStyle = `rgba(255,255,255,${clickPulse})`;
      ctx.font = `${Math.floor(canvas.height * 0.018)}px Orbitron, sans-serif`;
      ctx.fillText("[ CLICK TO SELECT ]", bx + cardW / 2, by + cardH - 15);

      ctx.restore();
    });

    ctx.restore();
    if (shook) ctx.restore();
    return;
  }
  // Menu (Demo)
  if (showMenu) {
    if (!demoPlayer) initDemo();
    updateDemo();
    if (demoPlayer.alive) drawPlayer(demoPlayer.x, demoPlayer.y);
    ctx.fillStyle = "white";
    for (let i = 0; i < demoBullets.length; i++) {
      const b = demoBullets[i];
      ctx.fillRect(b.x - 2, b.y - 5, 4, 10);
    }
    for (let i = 0; i < demoEnemies.length; i++) {
      drawEnemy(demoEnemies[i]);
    }
    ctx.fillStyle = "orange";
    for (let i = 0; i < demoEnemyBullets.length; i++) {
      const b = demoEnemyBullets[i];
      ctx.fillRect(b.x - 2, b.y - 4, 4, 8);
    }
    for (let i = 0; i < explosions.length; i++) {
      const ex = explosions[i];
      ctx.fillStyle = ex.color;
      ctx.globalAlpha = ex.life / 30;
      ctx.fillRect(ex.x, ex.y, 4, 4);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = "cyan";
    ctx.font = "32px Orbitron, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("SPACE SHOOTER", canvas.width / 2, 100);
    ctx.font = "18px Orbitron, sans-serif";
    ctx.fillText("Arrow Keys / WASD to move", canvas.width / 2, 160);
    ctx.fillText("Space to shoot", canvas.width / 2, 190);
    ctx.fillText("Press START or Enter to Play", canvas.width / 2, 230);
    if (shook) ctx.restore();
    return;
  }
  // Player + shields/rage
  if (!gameOverState) {
    drawPlayer(player.x, player.y);
    if (activeBuffs.includes("Rage")) {
      let lost = 3 - lives;
      if (lost > 0) {
        ctx.save();
        let a = Math.min(0.6, 0.2 * lost);
        ctx.strokeStyle = `rgba(255,0,0,${a})`;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(player.x, player.y, 30, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }
    if (
      (activeBuffs.includes("Shield") || secondChanceShieldActive) &&
      shieldCharges > 0
    ) {
      ctx.save();
      let a = shieldCharges === 2 ? 0.5 : 0.25;
      ctx.strokeStyle = `rgba(0,150,255,${a})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(player.x, player.y, 36, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
  // Bullets
  for (let i = 0; i < bullets.length; i++) {
    const b = bullets[i];
    if (b.rocket) {
      ctx.fillStyle = "red";
      ctx.fillRect(b.x - 4, b.y - 10, 8, 20);
    } else if (b.bouncing) {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.angle || 0);
      ctx.fillStyle = "cyan";
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(-3, 6);
      ctx.lineTo(3, 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else {
      ctx.fillStyle = "white";
      ctx.fillRect(b.x - 2, b.y - 5, 4, 10);
    }
  }
  // Enemy bullets
  for (let i = 0; i < enemyBullets.length; i++) {
    const b = enemyBullets[i];
    if (b.style === "plasma") {
      if (quality === "high") {
        ctx.save();
        ctx.shadowBlur = 12;
        ctx.shadowColor = "#ff9e00";
        ctx.fillStyle = "rgba(255,158,0,0.9)";
        ctx.fillRect(b.x - 2, b.y - 4, 4, 8);
        ctx.restore();
      } else {
        ctx.fillStyle = "rgba(255,158,0,0.8)";
        ctx.fillRect(b.x - 2, b.y - 4, 4, 8);
      }
    } else if (b.style === "rocket") {
      ctx.save();
      ctx.fillStyle = "gold";
      ctx.fillRect(b.x - 3, b.y - 8, 6, 16);
      ctx.fillStyle = "orange";
      ctx.beginPath();
      ctx.moveTo(b.x, b.y + 8);
      ctx.lineTo(b.x - 3, b.y + 13);
      ctx.lineTo(b.x + 3, b.y + 13);
      ctx.closePath();
      ctx.fill();
      if (b.trailLen > 1) {
        const latestIdx = (b.trailHead - 1 + b.trailX.length) % b.trailX.length;
        const oldestIdx =
          (latestIdx - (b.trailLen - 1) + b.trailX.length) % b.trailX.length;
        const gx1 = b.trailX[latestIdx],
          gy1 = b.trailY[latestIdx],
          gx2 = b.trailX[oldestIdx],
          gy2 = b.trailY[oldestIdx];
        const grad = ctx.createLinearGradient(gx1, gy1, gx2, gy2);
        grad.addColorStop(0.0, "rgba(200,200,200,0.35)");
        grad.addColorStop(1.0, "rgba(200,200,200,0.0)");
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2;
        ctx.beginPath();
        let idx = oldestIdx;
        for (let k = 0; k < b.trailLen; k++) {
          const xk = b.trailX[idx],
            yk = b.trailY[idx];
          if (k === 0) ctx.moveTo(xk, yk);
          else ctx.lineTo(xk, yk);
          idx = (idx + 1) % b.trailX.length;
        }
        ctx.stroke();
      }
      ctx.restore();
    } else if (b.style === "shotgun") {
      if (quality === "high") {
        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = "#5fe8ff";
        ctx.fillStyle = "#5fe8ff";
        ctx.beginPath();
        ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        ctx.fillStyle = "#5fe8ff";
        ctx.beginPath();
        ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.fillStyle = "orange";
      ctx.fillRect(b.x - 2, b.y - 4, 4, 8);
    }
  }
  // Sniper bullets
  ctx.fillStyle = "cyan";
  for (let i = 0; i < sniperShots.length; i++) {
    const s = sniperShots[i];
    ctx.fillRect(s.x - 2, s.y - 8, 4, 16);
  }
  // Enemies
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    ctx.globalAlpha = e.alpha;
    ctx.shadowBlur = quality === "high" ? 8 : 0;
    ctx.shadowColor = ctx.fillStyle;
    drawEnemy(e);
    ctx.globalAlpha = 1;
  }
  // Explosions & rocket rings
  for (let i = 0; i < explosions.length; i++) {
    const ex = explosions[i];
    ctx.fillStyle = ex.color;
    ctx.globalAlpha = ex.life / 30;
    ctx.fillRect(ex.x, ex.y, 4, 4);
    ctx.globalAlpha = 1;
  }
  for (let i = 0; i < rocketExplosions.length; i++) {
    const re = rocketExplosions[i];
    ctx.save();
    ctx.beginPath();
    ctx.arc(re.x, re.y, re.r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,100,0,${re.life / 30})`;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }
  drawSniper();
  if (levelTextTimer > 0 && !gameOverState) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, levelTextTimer / 500);
    ctx.fillStyle = "cyan";
    ctx.font = "24px Orbitron,sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      `LEVEL ${level} — Enemies: ${totalEnemies}`,
      canvas.width / 2,
      canvas.height / 2
    );
    ctx.restore();
  }
  if (gameOverState) {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "red";
    ctx.font = "32px Orbitron,sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2 - 30);
    ctx.fillStyle = "white";
    ctx.font = "20px Orbitron,sans-serif";
    ctx.fillText(
      `Final Score: ${score}`,
      canvas.width / 2,
      canvas.height / 2 + 10
    );
    if (Math.floor(Date.now() / 500) % 2 === 0) {
      ctx.fillStyle = "yellow";
      ctx.font = "18px Orbitron,sans-serif";
      ctx.fillText(
        "Press R to Restart",
        canvas.width / 2,
        canvas.height / 2 + 50
      );
    }
    ctx.restore();
  }
  if (boss) {
    drawBoss(boss);
    ctx.save();
    ctx.textAlign = "center";
    ctx.font = "20px Orbitron, sans-serif";
    ctx.fillStyle = "white";
    ctx.fillText("Omega Core", canvas.width / 2, 30);
    ctx.fillStyle = "red";
    ctx.fillRect(canvas.width / 2 - 150, 40, 300, 12);
    ctx.fillStyle = "lime";
    ctx.fillRect(canvas.width / 2 - 150, 40, (boss.hp / boss.maxHp) * 300, 12);
    ctx.restore();
  }
  if (hitFlash > 0) {
    ctx.save();
    ctx.fillStyle = "rgba(255,0,0,0.4)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    hitFlash -= 16;
  }
  // === Render Dodge floating texts ===
  if (dodgeTexts.length > 0) {
    ctx.save();
    ctx.textAlign = "center";
    ctx.font = "bold 18px Orbitron, sans-serif";
    for (let i = dodgeTexts.length - 1; i >= 0; i--) {
      const t = dodgeTexts[i];
      // update efek sederhana
      t.x += t.vx;
      t.y += t.vy;
      t.life -= 16; // kira-kira per frame (16ms)
      const progress = Math.max(0, t.life) / t.maxLife;
      t.alpha = Math.max(0, progress); // fade out
      t.scale = 1.0 + (1 - progress) * 0.1; // sedikit membesar saat memudar

      // warna cyan terang dengan glow kecil jika quality high
      if (quality === "high") {
        ctx.shadowBlur = 10;
        ctx.shadowColor = "#5fe8ff";
      } else {
        ctx.shadowBlur = 0;
      }
      ctx.fillStyle = `rgba(95,232,255,${Math.min(1, 0.9 * t.alpha)})`;
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.scale(t.scale, t.scale);
      ctx.fillText("DODGED!", 0, 0);
      ctx.restore();

      if (t.life <= 0) dodgeTexts.splice(i, 1);
    }
    ctx.restore();
  }

  // === Render Dodge banner (opsional) ===
  if (dodgeBanner.life > 0) {
    const a = Math.min(1, dodgeBanner.life / dodgeBanner.maxLife);
    ctx.save();
    ctx.textAlign = "center";
    ctx.font = "bold 22px Orbitron, sans-serif";
    if (quality === "high") {
      ctx.shadowBlur = 12;
      ctx.shadowColor = "#5fe8ff";
    }
    ctx.fillStyle = `rgba(95,232,255,${0.85 * a})`;
    ctx.fillText("DODGED!", canvas.width / 2, 60);
    ctx.restore();

    dodgeBanner.life -= 16;
  }
  if (shook) ctx.restore();
}
// ===== Buff UI (asli, tetap) =====
function initBuffUI() {
  const buffGrid = document.getElementById("buffGrid");
  const tooltip = document.getElementById("buffTooltip");
  if (!buffGrid || !tooltip) return;
  buffGrid.innerHTML = "";
  for (let i = 0; i < 10; i++) {
    const card = document.createElement("div");
    card.className = "buffCard";
    card.dataset.index = i;
    card.dataset.status = "empty";
    card.dataset.refillTriggered = "0";
    card.dataset.expireTriggered = "0";
    card.dataset.fill = "0";
    const fill = document.createElement("div");
    fill.className = "buffFill";
    fill.style.setProperty("--fill", "0");
    card.appendChild(fill);
    const face = document.createElement("div");
    face.className = "buffFace";
    const img = document.createElement("img");
    img.style.display = "none";
    img.alt = "";
    const plus = document.createElement("div");
    plus.className = "plus";
    plus.textContent = "+";
    face.appendChild(img);
    face.appendChild(plus);
    card.appendChild(face);
    card.addEventListener("animationend", (ev) => {
      const name = ev.animationName;
      if (name === "borderRefill") {
        card.classList.remove("buff-border-refill", "buff-refill");
        card.classList.add("buff-progress");
        card.dataset.refillTriggered = "2";
        card.dataset.status = "active";
        card.style.setProperty("--fill", "1");
        card.dataset.fill = "1";
        const im = card.querySelector("img");
        if (im) im.style.filter = "none";
      }
      if (name === "fillUp" || name === "flipForward") {
        card.classList.remove("buff-refill");
        card.dataset.refillTriggered = "2";
        card.dataset.status = "active";
        card.style.setProperty("--fill", "1");
        card.dataset.fill = "1";
      }
      if (name === "fillDown" || name === "flipBackward") {
        card.classList.remove("buff-expired-anim");
        card.classList.add("buff-expired");
        card.dataset.status = "expired";
        card.dataset.expireTriggered = "2";
        card.style.setProperty("--fill", "0");
        card.dataset.fill = "0";
        const im = card.querySelector("img");
        if (im) im.style.filter = "grayscale(100%) brightness(0.6)";
      }
    });
    buffGrid.appendChild(card);
  }
  buffGrid.addEventListener("mouseover", (e) => {
    const card = e.target.closest(".buffCard");
    if (!card) return;
    const related = e.relatedTarget;
    if (related && card.contains(related)) return;
    const idx = Number(card.dataset.index);
    showBuffTooltip(idx, card);
  });
  buffGrid.addEventListener("mouseout", (e) => {
    const card = e.target.closest(".buffCard");
    if (!card) return;
    const related = e.relatedTarget;
    if (related && card.contains(related)) return;
    tooltip.classList.add("hidden");
  });
  buffGrid.addEventListener("mouseleave", () =>
    tooltip.classList.add("hidden")
  );
}
function showBuffTooltip(idx, card) {
  const tooltip = document.getElementById("buffTooltip");
  if (!tooltip) return;
  if (idx < activeBuffs.length) {
    const buff = activeBuffs[idx];
    let text = buffDescriptions[buff] ?? "";
    if (buff === "Rage") {
      let lost = 3 - lives;
      text += ` (Current: +${lost * 20}%)`;
    }
    if (buff === "Shield") {
      text += ` (Charges: ${shieldCharges})`;
    }
    tooltip.innerHTML = `<strong style="color:cyan">${buff}</strong><br>${text}`;
  } else
    tooltip.innerHTML = `<strong style="color:cyan">Empty Slot</strong><br>A new buff will appear here when selected.`;
  const rect = card.getBoundingClientRect();
  tooltip.style.left = rect.right + 10 + "px";
  tooltip.style.top = rect.top + "px";
  tooltip.classList.remove("hidden");
}
function refreshBuffCards(forceRefill = false) {
  const buffGrid = document.getElementById("buffGrid");
  if (!buffGrid) return;
  const cards = buffGrid.querySelectorAll(".buffCard");
  const consumptiveList = [
    "Rocket Launcher",
    "Shield",
    "Healing Ring",
    "Sniper Aid",
    "Second Chance",
  ];
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    if (i >= activeBuffs.length) {
      card.classList.remove(
        "buff-refill",
        "buff-progress",
        "buff-border-refill",
        "buff-expired-anim",
        "buff-expired"
      );
      card.dataset.status = "empty";
      card.dataset.refillTriggered = "0";
      card.dataset.expireTriggered = "0";
      card.dataset.fill = "0";
      card.style.removeProperty("--fill");
      card.style.removeProperty("--buff-color");
      const im = card.querySelector("img");
      const plus = card.querySelector(".plus");
      if (im) im.style.display = "none";
      if (plus) plus.style.display = "";
      continue;
    }
    const buff = activeBuffs[i];
    let color =
      buff === "Rocket Launcher"
        ? "purple"
        : buff === "Shield"
        ? "deepskyblue"
        : buff === "Healing Ring"
        ? "hotpink"
        : buff === "Sniper Aid"
        ? "lime"
        : "cyan";
    card.style.setProperty("--buff-color", color);
    const im = card.querySelector("img");
    const plus = card.querySelector(".plus");
    if (im) {
      im.style.display = "";
      im.src = `img/${buff.toLowerCase().replace(/ /g, "_")}.png`;
      im.alt = buff;
      im.style.filter = "none";
    }
    if (plus) plus.style.display = "none";
    const isConsumptive = consumptiveList.includes(buff);
    if (isConsumptive) {
      if (!gameStarted) {
        card.classList.remove(
          "buff-refill",
          "buff-progress",
          "buff-border-refill",
          "buff-expired-anim"
        );
        card.classList.add("buff-expired");
        card.dataset.status = "expired";
        card.dataset.expireTriggered = "2";
        card.dataset.refillTriggered = "0";
        card.style.setProperty("--fill", "0");
        card.dataset.fill = "0";
        if (im) im.style.filter = "grayscale(100%) brightness(0.6)";
        continue;
      }
      if (forceRefill) {
        const wasUsed =
          card.dataset.status === "expired" ||
          card.dataset.expireTriggered === "1" ||
          card.dataset.expireTriggered === "2";
        if (wasUsed) {
          card.classList.remove(
            "buff-expired",
            "buff-expired-anim",
            "buff-border-refill"
          );
          card.classList.add(
            "buff-refill",
            "buff-border-refill",
            "buff-progress"
          );
          card.dataset.refillTriggered = "1";
          card.dataset.expireTriggered = "0";
          card.dataset.status = "active";
          card.style.setProperty("--fill", "1");
          card.dataset.fill = "1";
          if (im) im.style.filter = "none";
        }
      } else {
        card.classList.remove(
          "buff-expired",
          "buff-expired-anim",
          "buff-border-refill"
        );
        card.classList.add("buff-progress");
        card.dataset.status = "active";
        card.dataset.refillTriggered = "2";
        card.style.setProperty("--fill", "1");
        card.dataset.fill = "1";
      }
    } else {
      card.classList.remove(
        "buff-expired",
        "buff-expired-anim",
        "buff-border-refill"
      );
      card.classList.add("buff-progress");
      card.dataset.status = "active";
      card.dataset.refillTriggered = "2";
      card.style.setProperty("--fill", "1");
      card.dataset.fill = "1";
    }
    card.dataset.status = "active";
    card.classList.add("buff-progress");
    card.classList.remove("buff-expired");
    card.style.setProperty("--fill", "1");
    card.dataset.fill = "1";
    if (im) im.style.filter = "none";
  }
}
// === Animate selected buff card fly from canvas to first empty slot ===
function animateBuffPick(buff, fromRect, onDone) {
  const grid = document.getElementById("buffGrid");
  if (!grid) {
    onDone?.();
    return;
  }

  // Slot tujuan = slot kosong pertama (index = activeBuffs.length sekarang)
  const targetIndex = Math.min(
    activeBuffs.length,
    grid.querySelectorAll(".buffCard").length - 1
  );
  const targetCard = grid.querySelectorAll(".buffCard")[targetIndex];
  if (!targetCard) {
    onDone?.();
    return;
  }

  // >>> Pilih anchor: pakai wajah kartu agar terlihat 'masuk ke dalam' slot
  const face = targetCard.querySelector(".buffFace");
  const toRect = face
    ? face.getBoundingClientRect()
    : targetCard.getBoundingClientRect();

  // Buat ghost
  const ghost = document.createElement("div");
  ghost.className = "flyBuff";
  const img = new Image();
  img.src = `img/${buff.toLowerCase().replace(/ /g, "_")}.png`;
  img.alt = buff;
  ghost.appendChild(img);
  document.body.appendChild(ghost);

  // Ukuran & posisi awal dari canvas (sudah dipetakan ke viewport)
  const startW = fromRect.width;
  const startH = fromRect.height;
  const startX = fromRect.left;
  const startY = fromRect.top;
  ghost.style.width = `${startW}px`;
  ghost.style.height = `${startH}px`;
  ghost.style.transform = `translate(${startX}px, ${startY}px) scale(1) rotate(-0.6deg)`;
  ghost.style.opacity = "0";
  void ghost.offsetWidth; // ensure initial styles applied

  // ---- Hitung skala target ----
  // Kita pakai uniform scale (rasio terkecil) supaya ghost masuk ke slot tanpa distorsi.
  const scaleX = toRect.width / startW;
  const scaleY = toRect.height / startH;
  const s = Math.min(scaleX, scaleY); // uniform
  // Ukuran ghost setelah di-scale:
  const endGhostW = startW * s;
  const endGhostH = startH * s;

  // ---- Hitung posisi akhir (top-left) agar ghost center == slot center ----
  const endX = toRect.left + (toRect.width - endGhostW) / 2;
  const endY = toRect.top + (toRect.height - endGhostH) / 2;

  // Pasang CSS var yang dibaca keyframes
  ghost.style.setProperty("--end-x", `${endX}px`);
  ghost.style.setProperty("--end-y", `${endY}px`);
  ghost.style.setProperty("--end-scale", `${s}`);

  // Pulse slot tujuan
  targetCard.classList.add("acceptPulse");

  // Jalankan animasi
  ghost.classList.add("animating");

  const cleanup = () => {
    targetCard.classList.remove("acceptPulse");
    ghost.remove();
    onDone?.();
  };
  ghost.addEventListener("animationend", cleanup, { once: true });
  setTimeout(() => {
    if (document.body.contains(ghost)) cleanup();
  }, 600); // fallback
}
function updateBuffList() {
  const buffGrid = document.getElementById("buffGrid");
  if (!buffGrid) return;
  const cards = buffGrid.querySelectorAll(".buffCard");
  const consumptiveList = [
    "Rocket Launcher",
    "Shield",
    "Healing Ring",
    "Sniper Aid",
  ];
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i],
      faceImg = card.querySelector("img"),
      plus = card.querySelector(".plus");
    const prev = card.dataset.status ?? "empty";
    if (i >= activeBuffs.length) {
      if (prev !== "empty") {
        card.classList.remove(
          "buff-refill",
          "buff-expired-anim",
          "buff-expired",
          "buff-progress",
          "buff-border-refill"
        );
        card.style.removeProperty("--fill");
        card.style.removeProperty("--buff-color");
        card.dataset.fill = "0";
        if (faceImg) faceImg.style.display = "none";
        if (plus) plus.style.display = "";
        card.dataset.status = "empty";
        card.dataset.refillTriggered = "0";
        card.dataset.expireTriggered = "0";
      }
      continue;
    }
    const buff = activeBuffs[i],
      src = `img/${buff.toLowerCase().replace(/ /g, "_")}.png`;
    if (faceImg.getAttribute("src") !== src) faceImg.setAttribute("src", src);
    faceImg.alt = buff;
    faceImg.style.display = "";
    if (plus) plus.style.display = "none";
    let remaining = 1,
      max = 1,
      color = "cyan";
    if (buff === "Rage") {
      let lost = 3 - lives;
      remaining = Math.min(1, Math.max(0, lost / 3));
      color = "red";
    } else if (buff === "Healing Ring") {
      max = 1;
      remaining = healUsed ? 0 : 1;
      color = "hotpink";
    } else if (buff === "Rocket Launcher") {
      max = 3;
      remaining = rocketAmmo / max;
      color = "purple";
    } else if (buff === "Shield") {
      max = 2;
      remaining = shieldCharges / max;
      color = "deepskyblue";
    } else if (buff === "Sniper Aid") {
      // === FIX: hitung progress Sniper dengan benar ===
      max = 3;
      let used = sniperUsedThisLevel
        ? 3
        : sniperAlly
        ? 3 - sniperAlly.shotsLeft
        : 0;
      remaining = (max - used) / max;
      color = "lime";
    } else if (buff === "Second Chance") {
      max = 1;
      remaining = secondChanceUsed ? 0 : 1;
      color = "gold";
    }
    card.style.setProperty("--buff-color", color);
    card.style.setProperty("--fill", String(remaining));
    card.dataset.fill = String(remaining);
    const isConsumptive = consumptiveList.includes(buff);
    if (isConsumptive) {
      if (remaining <= 0) {
        if (
          card.dataset.expireTriggered === "0" &&
          card.dataset.status !== "expired" &&
          card.dataset.refillTriggered !== "1"
        ) {
          card.dataset.expireTriggered = "1";
          card.dataset.status = "expiring";
          if (!card.classList.contains("buff-expired-anim"))
            card.classList.add("buff-expired-anim");
        }
      } else {
        if (card.dataset.status === "expired") {
          /* tetap expired hingga level selesai */
        } else {
          card.classList.remove("buff-expired-anim", "buff-expired");
          if (card.dataset.expireTriggered !== "1")
            card.dataset.expireTriggered = "0";
          if (card.dataset.status !== "active") card.dataset.status = "active";
        }
      }
    } else {
      card.classList.remove("buff-expired", "buff-expired-anim");
      card.dataset.expireTriggered = "0";
      card.dataset.status = "active";
    }
  }
  // === FIX: jangan paksa --fill kembali ke 1 tiap frame pada buff konsumtif ===
  document.querySelectorAll(".buffCard").forEach((card, i) => {
    const buff = activeBuffs[i];
    if (
      ["Rocket Launcher", "Shield", "Healing Ring", "Sniper Aid"].includes(
        buff
      ) &&
      card.dataset.status !== "expired"
    ) {
      card.classList.add("buff-progress");
      card.classList.remove("buff-expired");
      const im = card.querySelector("img");
      if (im) im.style.filter = "none";
    }
  });
}
// Init Buff UI
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    initBuffUI();
    updateBuffList();
  });
} else {
  initBuffUI();
  updateBuffList();
}
document.addEventListener("DOMContentLoaded", () => {
  const buffGrid = document.getElementById("buffGrid");
  const tooltip = document.getElementById("buffTooltip");
  buffGrid.addEventListener("mouseleave", () => {
    tooltip.classList.add("hidden");
  });
});
// ===== Game Over =====
function gameOver() {
  if (level === 1) {
    showSpecialDeathDialog();
  }

  if (activeBuffs.includes("Second Chance") && !secondChanceUsed) {
    secondChanceUsed = true;
    lives = 2;
    secondChanceShieldActive = true;
    secondChanceShieldTimer = 12000;
    shieldCharges = 2;
    gameRunning = true;
    gameOverState = false;
    return;
  }
  gameRunning = false;
  gameOverState = true;
  if (score > highScore) {
    highScore = score;
    localStorage.setItem("highScore", highScore);
  }
}
// ===== Demo =====
function initDemo() {
  demoPlayer = {
    x: canvas.width / 2,
    y: canvas.height - 80,
    w: 24,
    h: 24,
    alive: true,
    respawnScheduled: false,
    targetX: canvas.width / 2,
  };
  demoBullets = [];
  demoEnemies = [];
  demoEnemyBullets = [];
  explosions = [];
  demoTimer = 0;
  const cnt = quality === "high" ? 5 : 4;
  for (let i = 0; i < cnt; i++) {
    let roll = Math.random(),
      type = "green";
    if (roll < 0.1) type = "purple";
    else if (roll < 0.4) type = "yellow";
    demoEnemies.push({
      x: 100 + Math.random() * 440,
      y: -20 - i * 60,
      w: 24,
      h: 24,
      vy: 1,
      fireCooldown: 60 + Math.random() * 60,
      type,
      alpha: 1,
      enter: false,
    });
  }
  if (demoRespawnTimeout) {
    clearTimeout(demoRespawnTimeout);
    demoRespawnTimeout = null;
  }
}
function updateDemo() {
  demoTimer++;
  if (demoTimer % 180 === 0) {
    let roll = Math.random(),
      type = "green";
    if (roll < 0.1) type = "purple";
    else if (roll < 0.4) type = "yellow";
    demoEnemies.push({
      x: 100 + Math.random() * 440,
      y: -20,
      w: 24,
      h: 24,
      vy: 1,
      fireCooldown: 60 + Math.random() * 60,
      type,
      alpha: 1,
      enter: false,
    });
  }
  for (let i = 0; i < demoEnemies.length; i++) {
    const e = demoEnemies[i];
    e.y += e.vy;
    if (e.y > canvas.height + 20) {
      e.y = -20;
      e.x = 100 + Math.random() * 440;
      let roll = Math.random();
      e.type = roll < 0.1 ? "purple" : roll < 0.4 ? "yellow" : "green";
    }
  }
  let target = null;
  if (demoEnemies.length > 0)
    target = demoEnemies.reduce((a, b) => (a.y > b.y ? a : b));
  if (demoPlayer.alive) {
    if (!demoPlayer.targetX) demoPlayer.targetX = demoPlayer.x;
    if (target) demoPlayer.targetX = target.x;
    let danger = null;
    for (let i = 0; i < demoEnemyBullets.length; i++) {
      const b = demoEnemyBullets[i];
      if (b.y < demoPlayer.y && Math.abs(b.x - demoPlayer.x) < 15) {
        if (!danger || b.y > danger.y) danger = b;
      }
    }
    if (danger) {
      demoPlayer.targetX += danger.x < demoPlayer.x ? 40 : -40;
    }
    demoPlayer.x += (demoPlayer.targetX - demoPlayer.x) * 0.05;
    if (target && target.y > 50 && demoTimer % 60 === 0) {
      let dx = target.x - demoPlayer.x,
        dy = target.y - demoPlayer.y,
        len = Math.sqrt(dx * dx + dy * dy) || 1;
      demoBullets.push({
        x: demoPlayer.x,
        y: demoPlayer.y,
        w: 4,
        h: 10,
        vx: (dx / len) * 4,
        vy: (dy / len) * 4,
      });
      shootSFX.cloneNode().play();
    }
  }
  for (let i = 0; i < demoBullets.length; i++) {
    const b = demoBullets[i];
    b.x += b.vx ?? 0;
    b.y += (b.vy ?? 0) - 5;
  }
  demoBullets = demoBullets.filter((b) => b.y > -20 && b.y < canvas.height);
  for (let bi = demoBullets.length - 1; bi >= 0; bi--) {
    const b = demoBullets[bi];
    for (let ei = demoEnemies.length - 1; ei >= 0; ei--) {
      const e = demoEnemies[ei];
      if (rectsOverlap(b, e)) {
        createExplosion(e.x, e.y, "lime");
        demoBullets.splice(bi, 1);
        demoEnemies.splice(ei, 1);
        break;
      }
    }
  }
  for (let i = 0; i < demoEnemies.length; i++) {
    const e = demoEnemies[i];
    e.fireCooldown--;
    if (e.fireCooldown <= 0) {
      demoEnemyBullets.push({ x: e.x, y: e.y, w: 4, h: 8, vx: 0, vy: 3 });
      e.fireCooldown = 60 + Math.random() * 60;
    }
  }
  for (let i = 0; i < demoEnemyBullets.length; i++) {
    const b = demoEnemyBullets[i];
    b.x += b.vx;
    b.y += b.vy;
  }
  demoEnemyBullets = demoEnemyBullets.filter((b) => b.y < canvas.height + 20);
  for (let i = demoEnemyBullets.length - 1; i >= 0; i--) {
    const b = demoEnemyBullets[i];
    if (demoPlayer.alive && rectsOverlap(b, demoPlayer)) {
      createExplosion(demoPlayer.x, demoPlayer.y, "red");
      demoEnemyBullets.splice(i, 1);
      demoPlayer.alive = false;
      if (!demoPlayer.respawnScheduled) {
        demoPlayer.respawnScheduled = true;
        demoRespawnTimeout = setTimeout(() => {
          initDemo();
          demoRespawnTimeout = null;
        }, 1200);
      }
    }
  }
  for (let i = 0; i < demoEnemies.length; i++) {
    const e = demoEnemies[i];
    if (e.y > canvas.height - 30 && demoPlayer.alive) {
      createExplosion(demoPlayer.x, demoPlayer.y, "red");
      demoPlayer.alive = false;
      if (!demoPlayer.respawnScheduled) {
        demoPlayer.respawnScheduled = true;
        demoRespawnTimeout = setTimeout(() => {
          initDemo();
          demoRespawnTimeout = null;
        }, 1200);
      }
    }
  }
  for (let i = 0; i < explosions.length; i++) {
    const ex = explosions[i];
    ex.x += ex.vx;
    ex.y += ex.vy;
    ex.life--;
  }
  explosions = explosions.filter((ex) => ex.life > 0);
}
// ===== Loop =====
let lastTime = performance.now();
function loop(ts) {
  let dt = ts - lastTime;
  lastTime = ts;
  if (gameRunning) update(dt);
  draw();
  requestAnimationFrame(loop);
}
// ===== Input =====
window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    keys.space = true;
  }
  if (e.code === "Enter" && showMenu) initGame();
  if (e.key.toLowerCase() === "r" && gameOverState) initGame();
  keys[e.key.toLowerCase()] = true;
  keys[e.code.toLowerCase()] = true;
  if (
    e.key.toLowerCase() === "e" &&
    activeBuffs.includes("Healing Ring") &&
    !healUsed
  ) {
    if (lives < 3) {
      lives++;
      healUsed = true;
      createExplosion(player.x, player.y, "lime");
    }
  }
});
window.addEventListener("keyup", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    keys.space = false;
  }
  keys[e.key.toLowerCase()] = false;
  keys[e.code.toLowerCase()] = false;
});
document.getElementById("btnStart").addEventListener("click", () => {
  if (showMenu) initGame();
});
document.getElementById("btnReset").addEventListener("click", initGame);
// ===== Start =====
rebuildBackgroundCache();
rebuildStarLayers();
requestAnimationFrame(loop);
