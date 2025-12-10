(() => {
  /* ===== Canvas & ctx ===== */
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(window.devicePixelRatio ?? 1, 2);

  /* ===== State ===== */
  const state = {
    running: false,
    inDraft: false,
    score: 0,
    level: 1,
    time: 0,
    enemies: [],
    bullets: [],
    enemyBullets: [],
    particles: [],
    stars: [],
    lastFire: 0,
    draftEvery: 2,
    cardsTaken: 0,
    multipliers: {
      enemyHP: 1,
      enemySpeed: 1,
      enemySpawn: 1,
      enemyBulletSpeed: 1,
      enemyDamage: 1,
      enemyArmor: 0,
    },
    draftCards: [],
    skipBtn: null,
    lastWaveCount: 0,
    banner: null,
    failReason: "",
    cardLevels: {},
    drones: [],
    shieldPulse: null, // {interval, duration, t}
    regen: {
      rate: 0,
      bonusRate: 0,
      outDelay: 2.5,
      sinceHit: Infinity,
      level: 0,
    },
    bossKills: 0,
    enemiesKilled: 0,
  };

  /* ===== Persistent economy ===== */
  let coins = parseInt(localStorage.getItem("coins") ?? "0", 10);
  const saveCoins = () => localStorage.setItem("coins", String(coins));
  const ownedSet = new Set(
    JSON.parse(localStorage.getItem("pendantsOwned") ?? "[]")
  );
  const saveOwned = () =>
    localStorage.setItem("pendantsOwned", JSON.stringify([...ownedSet]));
  const EQUIP_LIMIT = 2;
  const equippedSet = new Set(
    JSON.parse(localStorage.getItem("pendantsEquipped") ?? "[]")
  );
  const saveEquipped = () =>
    localStorage.setItem("pendantsEquipped", JSON.stringify([...equippedSet]));

  /* ===== Size & resize ===== */
  let W = 0,
    H = 0;
  function resize() {
    W = Math.max(320, Math.floor(window.innerWidth));
    H = Math.max(480, Math.floor(window.innerHeight));
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (state.inDraft) layoutDraftCards();
  }
  window.addEventListener("resize", resize, { passive: true });
  resize();

  /* ===== Utils & Input ===== */
  const rand = (min, max) => Math.random() * (max - min) + min;
  const randI = (min, max) => Math.floor(rand(min, max + 1));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const MARGIN_X = 18;

  let pointerDown = false;
  const pointer = { x: W / 2, y: H / 2 };
  function setPointer(e) {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
  }
  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    pointerDown = true;
    setPointer(e);
    if (state.inDraft) handleDraftTap(pointer.x, pointer.y);
    else e.target.setPointerCapture?.(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (pointerDown) setPointer(e);
  });
  canvas.addEventListener("pointerup", (e) => {
    pointerDown = false;
    try {
      e.target.releasePointerCapture(e.pointerId);
    } catch (_) {}
  });
  canvas.addEventListener("pointercancel", () => {
    pointerDown = false;
  });

  /* ===== DOM ===== */
  const scoreEl = document.getElementById("score");
  const levelEl = document.getElementById("level");
  const hpFill = document.getElementById("hpFill");
  const hpText = document.getElementById("hpText");
  const menuOverlay = document.getElementById("menuOverlay");
  const playBtn = document.getElementById("playBtn");
  const indexBtn = document.getElementById("indexBtn");
  const shopBtn = document.getElementById("shopBtn");
  const menuCoinsEl = document.getElementById("menuCoins");
  const indexOverlay = document.getElementById("indexOverlay");
  const indexClose = document.getElementById("indexClose");
  const shopOverlay = document.getElementById("shopOverlay");
  const shopCoinsEl = document.getElementById("shopCoins");
  const shopGrid = document.getElementById("shopGrid");
  const shopClose = document.getElementById("shopClose");
  const gameOverOverlay = document.getElementById("gameOverOverlay");
  const gameOverReasonEl = document.getElementById("gameOverReason");
  const gameOverStatsEl = document.getElementById("gameOverStats");
  const gameOverCoinsEl = document.getElementById("gameOverCoins");
  const retryBtn = document.getElementById("retryBtn");
  const goShopBtn = document.getElementById("goShopBtn");
  const goMenuBtn = document.getElementById("goMenuBtn");
  const overlays = [menuOverlay, indexOverlay, shopOverlay, gameOverOverlay];

  function cancelDraft() {
    if (state.inDraft) {
      state.inDraft = false;
      state.draftCards.length = 0;
      state.skipBtn = null;
    }
  }
  const showOverlay = (el) => {
    cancelDraft();
    overlays.forEach((o) => o.classList.add("hidden"));
    el.classList.remove("hidden");
    el.classList.add("show");
  };
  const hideAllOverlays = () => {
    overlays.forEach((o) => o.classList.add("hidden"));
    overlays.forEach((o) => o.classList.remove("show"));
  };
  const updateCoinUI = () => {
    menuCoinsEl.textContent = `🪙 ${coins}`;
    shopCoinsEl.textContent = `🪙 ${coins}`;
  };

  /* ===== Player ===== */
  const player = {
    x: W / 2,
    y: H - 90,
    w: 26,
    h: 26,
    baseSpeed: 560,
    speed: 560,
    maxHp: 100,
    hp: 100,
    fireRate: 6,
    bulletSpeed: 660,
    bulletDamage: 10,
    spread: 1,
    spreadAngle: (16 * Math.PI) / 180,
    bulletColor: "#58dbff",
    pierce: 0,
    invuln: 0,
    // weapon fields
    weaponType: "basic",
    twinOffset: 0,
    burstCount: 0,
    jitterAngle: 0,
    isSeeker: false,
    seekAccel: 0,
    seekerMax: 0,
  };

  /* ===== Background ===== */
  function initStars() {
    state.stars.length = 0;
    for (let i = 0; i < 160; i++) {
      state.stars.push({
        x: rand(0, W),
        y: rand(0, H),
        size: rand(1, 2.2),
        speed: rand(30, 140),
        hue: randI(180, 220),
      });
    }
  }
  initStars();
  function spawnExplosion(x, y, color = "#a0c6ff") {
    for (let i = 0; i < 26; i++) {
      state.particles.push({
        x,
        y,
        vx: rand(-220, 220),
        vy: rand(-260, 80),
        life: rand(0.4, 0.9),
        t: 0,
        color,
      });
    }
  }

  /* ===== Enemy factory ===== */
  function spawnWave(level) {
    const base = 6 + Math.floor(level * 0.8);
    const count = Math.floor(base * state.multipliers.enemySpawn);
    state.lastWaveCount = count;
    for (let i = 0; i < count; i++) {
      const pool = ["basic"];
      if (level >= 3) pool.push("shooter");
      if (level >= 4) pool.push("dasher");
      if (level >= 6) pool.push("shield");
      if (level >= 7) pool.push("splitter");
      const type = pool[randI(0, pool.length - 1)];
      const x = rand(MARGIN_X, W - MARGIN_X);
      const y = rand(-H * 0.6, -40);
      const baseSpeed = {
        basic: [60, 120],
        shooter: [70, 110],
        dasher: [80, 130],
        shield: [60, 100],
        splitter: [70, 120],
      }[type];
      let speed =
        rand(baseSpeed[0], baseSpeed[1]) * state.multipliers.enemySpeed;
      if (type === "shooter") speed *= 0.75;
      const baseHP = {
        basic: 20,
        shooter: 34,
        dasher: 26,
        shield: 40,
        splitter: 28,
      }[type];
      const hp = baseHP * state.multipliers.enemyHP * (1 + level * 0.06);
      const color = {
        basic: "#f7d15f",
        shooter: "#ff6e6e",
        dasher: "#58dbff",
        shield: "#9cf05b",
        splitter: "#d685ff",
      }[type];
      state.enemies.push({
        type,
        x,
        y,
        w: 26,
        h: 26,
        hp,
        speed,
        fireCd: rand(1.8, 3.0),
        t: 0,
        color,
        vx: 0,
        dashCountdown: type === "dasher" ? rand(1.2, 2.2) : 0,
        shieldTimer: type === "shield" ? rand(0, 1.0) : 0,
        shieldActive: type === "shield" ? false : false,
        generation: type === "splitter" ? 1 : 0,
        // === tracking velocity for lead pursuit ===
        _vx: 0,
        _vy: 0,
        _px: x,
        _py: y,
      });
    }
  }

  /* ===== Boss spawns ===== */
  function spawnBossArc(level) {
    const bossHP = 260 * state.multipliers.enemyHP * (1 + level * 0.07);
    state.enemies.push({
      type: "boss_arc",
      x: W / 2,
      y: -100,
      w: 96,
      h: 96,
      hp: bossHP,
      speed: 32 * state.multipliers.enemySpeed,
      fireCd: 1.0,
      t: 0,
      color: "#ff4edb",
      abilityTimer: 0,
      abilityIndex: 0,
      laser: null,
      _vx: 0,
      _vy: 0,
      _px: W / 2,
      _py: -100,
    });
    state.lastWaveCount += 1;
  }
  function spawnBossChrono(level) {
    const bossHP = 280 * state.multipliers.enemyHP * (1 + level * 0.08);
    state.enemies.push({
      type: "boss_chrono",
      x: W / 2,
      y: -110,
      w: 100,
      h: 100,
      hp: bossHP,
      speed: 36 * state.multipliers.enemySpeed,
      fireCd: 0.9,
      t: 0,
      color: "#62ffd5",
      abilityTimer: 0,
      abilityIndex: 0,
      spiralAngle: 0,
      _vx: 0,
      _vy: 0,
      _px: W / 2,
      _py: -110,
    });
    state.lastWaveCount += 1;
  }

  /* ===== Bullets ===== */

  // === Target selection: prioritas semakin ke bawah (y besar), lalu jarak ===
  function selectDistinctTargets(maxCount, sx, sy) {
    if (!maxCount || state.enemies.length === 0) return [];
    const arr = state.enemies.map((e) => {
      const d2 = (e.x - sx) * (e.x - sx) + (e.y - sy) * (e.y - sy);
      return { e, y: e.y, d2 };
    });
    // sort by y desc (bottom-most first), then distance asc
    arr.sort((a, b) => b.y - a.y || a.d2 - b.d2);
    return arr.slice(0, maxCount).map((x) => x.e);
  }

  function firePlayer() {
    const now = state.time,
      interval = 1 / player.fireRate;
    if (now - state.lastFire < interval) return;
    state.lastFire = now;

    const angles = [];
    if (player.spread <= 1) angles.push(-Math.PI / 2);
    else {
      const n = player.spread,
        total = player.spreadAngle * (n - 1);
      for (let i = 0; i < n; i++)
        angles.push(-Math.PI / 2 + -total / 2 + i * player.spreadAngle);
    }

    const origins = [];
    if (player.twinOffset && player.twinOffset > 0)
      origins.push(player.x - player.twinOffset, player.x + player.twinOffset);
    else origins.push(player.x);

    // === MULTI-LOCK: 1 + level Arc Spread, prioritas bottom-most ===
    let uniqueTargets = [];
    if (player.isSeeker) {
      const arcLv = state.cardLevels["arc_spread"] ?? 0;
      const maxDistinct = Math.min(
        1 + arcLv,
        Math.max(1, state.enemies.length)
      );
      uniqueTargets = selectDistinctTargets(maxDistinct, player.x, player.y);
    }

    let bulletIdx = 0;

    function emitBullet(ox, oy, baseAngle, initialLock) {
      const initSpeedFactor = player.isSeeker ? 0.35 : 1.0;

      let a = baseAngle;
      if (player.jitterAngle && player.jitterAngle > 0)
        a += (Math.random() * 2 - 1) * player.jitterAngle;

      const vx = Math.cos(a) * player.bulletSpeed * initSpeedFactor;
      const vy = Math.sin(a) * player.bulletSpeed * initSpeedFactor;

      const b = {
        x: ox,
        y: oy - player.h / 2,
        vx,
        vy,
        dmg: player.bulletDamage,
        color: player.bulletColor,
        pierce: player.pierce,
        w: 4,
        h: 12,
      };

      // SEEKER agresif + ramp + lock awal
      if (player.isSeeker) {
        b.seek = true;
        b.age = 0;
        b.accelBase = player.seekAccel; // ~420
        b.accelGrow = 0.65; // aksel bertambah
        b.accelCapMul = 3.0;
        b.maxSpeedBase = player.bulletSpeed * 0.55;
        b.maxSpeedGrow = player.seekerMax * 0.35;
        b.maxSpeedCap = player.seekerMax;
        b.turnRate = player.seekTurnRate ?? Math.PI * 12.0; // sangat cepat
        b.navConst = 5.2; // PN agresif
        b.snapCone = 0.95; // mudah snap
        b.retargetEvery = 0.03;
        b.retargetT = 0;
        b.prevLos = null;
        b.lock = initialLock ?? null;
        b.lockTimer = 0;
        b.lockPersist = 0.5; // tahan kunci lebih lama
      }

      state.bullets.push(b);
    }

    const perTrigger =
      player.burstCount && player.burstCount > 1 ? player.burstCount : 1;
    const burstSpread =
      player.weaponType === "burst" ? (10 * Math.PI) / 180 : 0;

    for (const ox of origins) {
      for (const baseAngle of angles) {
        if (perTrigger === 1) {
          const tgt =
            player.isSeeker && uniqueTargets.length
              ? uniqueTargets[bulletIdx % uniqueTargets.length]
              : null;
          emitBullet(ox, player.y, baseAngle, tgt);
          bulletIdx++;
        } else {
          const start = (-burstSpread * (perTrigger - 1)) / 2;
          for (let k = 0; k < perTrigger; k++) {
            const tgt =
              player.isSeeker && uniqueTargets.length
                ? uniqueTargets[bulletIdx % uniqueTargets.length]
                : null;
            emitBullet(ox, player.y, baseAngle + start + k * burstSpread, tgt);
            bulletIdx++;
          }
        }
      }
    }
  }

  function fireEnemy(e) {
    const speed = 230 * state.multipliers.enemyBulletSpeed;
    state.enemyBullets.push({
      x: e.x,
      y: e.y + e.h / 2,
      vx: 0,
      vy: speed,
      dmg: 10 * state.multipliers.enemyDamage,
      color: "#ff9a5b",
      w: 6,
      h: 16,
    });
  }

  /* ===== Collision ===== */
  function aabbHit(a, b) {
    return !(
      a.x + a.w / 2 < b.x - b.w / 2 ||
      a.x - a.w / 2 > b.x + b.w / 2 ||
      a.y + a.h / 2 < b.y - b.h / 2 ||
      a.y - a.h / 2 > b.y + b.h / 2
    );
  }

  /* ===== Cards (draft) ===== */
  function pickCard(card) {
    const id = card.id;
    const cur = state.cardLevels[id] ?? 0;
    if (cur >= 3) return;
    const next = cur + 1;
    state.cardLevels[id] = next;
    card.buff(1, next);
    card.debuff(1, next);
  }
  const CARD_POOL = [
    {
      id: "rapid_fire",
      name: "Rapid Fire",
      buffDesc: "+laju tembakan",
      debuffDesc: "Musuh bergerak lebih cepat",
      buff: (d) => {
        for (let i = 0; i < d; i++) player.fireRate *= 1.15;
      },
      debuff: (d) => {
        for (let i = 0; i < d; i++) state.multipliers.enemySpeed *= 1.12;
      },
    },
    {
      id: "overcharge",
      name: "Overcharged Bullets",
      buffDesc: "+damage peluru",
      debuffDesc: "HP musuh bertambah",
      buff: (d) => {
        for (let i = 0; i < d; i++)
          player.bulletDamage = Math.round(player.bulletDamage * 1.22);
      },
      debuff: (d) => {
        for (let i = 0; i < d; i++) state.multipliers.enemyHP *= 1.15;
      },
    },
    {
      id: "hull_plating",
      name: "Hull Plating",
      buffDesc: "Regen HP per detik (+bonus out-of-combat)",
      debuffDesc: "Damage musuh meningkat",
      buff: (delta, lv) => {
        const baseRates = [0, 2.6, 3.8, 5.0],
          bonusRates = [0, 1.2, 1.8, 2.6],
          delays = [0, 2.5, 2.0, 1.5];
        state.regen.rate = baseRates[lv];
        state.regen.bonusRate = bonusRates[lv];
        state.regen.outDelay = delays[lv];
        state.regen.level = lv;
        if (lv >= 2) {
          const add = lv === 2 ? 6 : 12;
          player.maxHp += add;
          player.hp = Math.min(player.maxHp, player.hp + add * 0.5);
        }
      },
      debuff: (delta) => {
        for (let i = 0; i < delta; i++) state.multipliers.enemyDamage *= 1.08;
      },
    },
    {
      id: "afterburner",
      name: "Afterburner",
      buffDesc: "+kecepatan kapal",
      debuffDesc: "Spawn musuh meningkat",
      buff: (d) => {
        for (let i = 0; i < d; i++) player.baseSpeed *= 1.15;
        player.speed = player.baseSpeed;
      },
      debuff: (d) => {
        for (let i = 0; i < d; i++) state.multipliers.enemySpawn *= 1.12;
      },
    },
    {
      id: "arc_spread",
      name: "Arc Spread",
      buffDesc: "+peluru menyebar",
      debuffDesc: "HP musuh lebih tebal",
      buff: (d) => {
        player.spread = Math.min(player.spread + d, 7);
      },
      debuff: (d) => {
        for (let i = 0; i < d; i++) state.multipliers.enemyHP *= 1.1;
      },
    },
    {
      id: "pulse_beam",
      name: "Pulse Beam",
      buffDesc: "+kecepatan peluru",
      debuffDesc: "Damage musuh naik",
      buff: (d) => {
        for (let i = 0; i < d; i++) player.bulletSpeed *= 1.2;
      },
      debuff: (d) => {
        for (let i = 0; i < d; i++) state.multipliers.enemyDamage *= 1.12;
      },
    },
    {
      id: "nanobot",
      name: "Nanobot Repair",
      buffDesc: "Heal instan",
      debuffDesc: "Spawn musuh naik",
      buff: (d) => {
        player.hp = Math.min(player.maxHp, player.hp + 15 * d);
      },
      debuff: (d) => {
        for (let i = 0; i < d; i++) state.multipliers.enemySpawn *= 1.1;
      },
    },
    {
      id: "quantum_shield",
      name: "Quantum Shield",
      buffDesc: "Pulsa invuln berkala",
      debuffDesc: "Musuh ber-armor (damage↓)",
      buff: (d, lv) => {
        const interval = Math.max(4, 8 - lv),
          duration = 0.6 + 0.2 * lv;
        if (!state.shieldPulse)
          state.shieldPulse = { interval, duration, t: 0 };
        else {
          state.shieldPulse.interval = interval;
          state.shieldPulse.duration = duration;
        }
      },
      debuff: (d) => {
        state.multipliers.enemyArmor = Math.min(
          0.8,
          (state.multipliers.enemyArmor ?? 0) + 0.1 * d
        );
      },
    },
    {
      id: "drone_companion",
      name: "Drone Companion",
      buffDesc: "+Drone penembak",
      debuffDesc: "Spawn musuh naik",
      buff: (d) => {
        for (let i = 0; i < d; i++) {
          if (state.drones.length >= 3) break;
          state.drones.push({
            x: player.x,
            y: player.y - 40,
            angle: Math.PI * 2 * (state.drones.length / 3),
            radius: 32 + 8 * state.drones.length,
            fireRate: 3.5,
            bulletSpeed: 520,
            bulletDamage: 6,
            color: "#7effa7",
            lastFire: 0,
          });
        }
      },
      debuff: (d) => {
        for (let i = 0; i < d; i++) state.multipliers.enemySpawn *= 1.1;
      },
    },
    {
      id: "piercing_rounds",
      name: "Piercing Rounds",
      buffDesc: "Peluru menembus musuh",
      debuffDesc: "Peluru musuh lebih cepat",
      buff: (d) => {
        player.pierce = Math.min(player.pierce + d, 3);
      },
      debuff: (d) => {
        for (let i = 0; i < d; i++) state.multipliers.enemyBulletSpeed *= 1.12;
      },
    },
    {
      id: "cryo_field",
      name: "Cryo Field",
      buffDesc: "Musuh bergerak lebih lambat",
      debuffDesc: "Kapal sedikit lebih lambat",
      buff: (delta) => {
        for (let i = 0; i < delta; i++) state.multipliers.enemySpeed *= 0.88;
      },
      debuff: (delta) => {
        for (let i = 0; i < delta; i++) {
          player.baseSpeed *= 0.95;
          player.speed = player.baseSpeed;
        }
      },
    },
    {
      id: "corrosive_cloud",
      name: "Corrosive Cloud",
      buffDesc: "Armor musuh berkurang (damage masuk lebih besar)",
      debuffDesc: "Damage peluru pemain turun sedikit",
      buff: (delta) => {
        state.multipliers.enemyArmor = Math.max(
          0,
          (state.multipliers.enemyArmor ?? 0) - 0.12 * delta
        );
      },
      debuff: (delta) => {
        for (let i = 0; i < delta; i++)
          player.bulletDamage = Math.max(
            1,
            Math.round(player.bulletDamage * 0.94)
          );
      },
    },
    {
      id: "emp_disruptor",
      name: "EMP Disruptor",
      buffDesc: "Kecepatan peluru musuh turun",
      debuffDesc: "Laju tembakan pemain turun sedikit",
      buff: (delta) => {
        for (let i = 0; i < delta; i++)
          state.multipliers.enemyBulletSpeed *= 0.82;
      },
      debuff: (delta) => {
        for (let i = 0; i < delta; i++) player.fireRate *= 0.95;
      },
    },
  ];

  /* ===== Draft layer ===== */
  function openDraft() {
    state.inDraft = true;
    state.banner = null;
    state.draftCards.length = 0;
    const picks = [];
    while (picks.length < 3) {
      const c = CARD_POOL[randI(0, CARD_POOL.length - 1)];
      if (!picks.includes(c)) picks.push(c);
    }
    for (const c of picks)
      state.draftCards.push({ card: c, x: 0, y: 0, w: 0, h: 0 });
    layoutDraftCards();
  }
  function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
    const words = String(text).split(/\s+/).filter(Boolean);
    const lines = [];
    let line = "",
      i = 0;
    const fitWithEllipsis = (s) => {
      let t = s;
      while (t.length > 1 && ctx.measureText(t + "…").width > maxWidth)
        t = t.slice(0, -1);
      return t + "…";
    };
    while (i < words.length) {
      const test = line ? line + " " + words[i] : words[i];
      if (ctx.measureText(test).width <= maxWidth) {
        line = test;
        i++;
      } else {
        if (!line) {
          let cut = words[i];
          while (cut.length > 1 && ctx.measureText(cut).width > maxWidth)
            cut = cut.slice(0, -1);
          lines.push(cut);
          i++;
        } else {
          lines.push(line);
          line = "";
        }
        if (lines.length === maxLines) break;
      }
    }
    if (line && lines.length < maxLines) lines.push(line);
    if (i < words.length) {
      const last = lines[lines.length - 1] ?? "";
      lines[lines.length - 1] = fitWithEllipsis(last);
    }
    for (const ln of lines) {
      ctx.fillText(ln, x, y);
      y += lineHeight;
    }
    return y;
  }
  function layoutDraftCards() {
    const SAFE_TOP = Math.floor(Math.min(H * 0.16, 120));
    const SAFE_BOTTOM = Math.floor(Math.min(H * 0.14, 110));
    const cardW = Math.min(Math.floor(W * 0.82), 320);
    const gap = Math.max(10, Math.floor(H * 0.018));
    const visibleCards = Math.max(1, state.draftCards.length);
    const availableH = Math.max(120, H - SAFE_TOP - SAFE_BOTTOM);
    let cardH = Math.floor(
      (availableH - (visibleCards - 1) * gap) / visibleCards
    );
    cardH = clamp(cardH, 110, 160);
    let x = Math.round(W / 2) - Math.round(cardW / 2);
    x = clamp(x, 12, W - cardW - 12);
    const startY = clamp(SAFE_TOP, 12, Math.max(12, SAFE_TOP));
    for (let i = 0; i < state.draftCards.length; i++) {
      const dc = state.draftCards[i];
      dc.w = cardW;
      dc.h = cardH;
      dc.x = x;
      dc.y = startY + i * (cardH + gap);
    }
    const lastBottom = startY + visibleCards * (cardH + gap) - gap;
    const btnH = Math.max(40, Math.min(52, Math.floor(H * 0.065)));
    const buttonTop = lastBottom + Math.max(12, Math.floor(gap * 1.2));
    state.skipBtn = {
      text: "Lewati",
      x,
      y: Math.min(
        buttonTop,
        H - SAFE_BOTTOM + Math.floor((SAFE_BOTTOM - btnH) / 2)
      ),
      w: cardW,
      h: btnH,
    };
  }
  function closeDraft() {
    state.inDraft = false;
    state.draftCards.length = 0;
    state.skipBtn = null;
    showBanner("Level " + state.level, "Musuh: " + state.lastWaveCount);
  }
  function handleDraftTap(px, py) {
    for (const dc of state.draftCards) {
      if (px >= dc.x && px <= dc.x + dc.w && py >= dc.y && py <= dc.y + dc.h) {
        const id = dc.card.id;
        const cur = state.cardLevels[id] ?? 0;
        if (cur < 3) {
          pickCard(dc.card);
          closeDraft();
        }
        return;
      }
    }
    if (state.skipBtn) {
      const b = state.skipBtn;
      if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h)
        closeDraft();
    }
  }

  /* ===== Overlay & Level Flow ===== */
  function showBanner(text, sub, duration = 2.2) {
    state.banner = { text, sub, t: 0, duration };
  }
  function resetRunState() {
    state.running = true;
    state.inDraft = false;
    state.score = 0;
    state.level = 1;
    state.time = 0;
    state.enemies.length = 0;
    state.bullets.length = 0;
    state.enemyBullets.length = 0;
    state.particles.length = 0;
    state.multipliers.enemyHP = 1;
    state.multipliers.enemySpeed = 1;
    state.multipliers.enemySpawn = 1;
    state.multipliers.enemyBulletSpeed = 1;
    state.multipliers.enemyDamage = 1;
    state.multipliers.enemyArmor = 0;
    state.cardLevels = {};
    state.drones = [];
    state.shieldPulse = null;
    state.regen = {
      rate: 0,
      bonusRate: 0,
      outDelay: 2.5,
      sinceHit: Infinity,
      level: 0,
    };
    state.lastFire = -1e9;
    state.bossKills = 0;
    state.enemiesKilled = 0;

    player.x = W / 2;
    player.y = H - 90;
    player.maxHp = 100;
    player.hp = 100;
    player.fireRate = 6;
    player.bulletSpeed = 660;
    player.bulletDamage = 10;
    player.spread = 1;
    player.baseSpeed = 560;
    player.speed = player.baseSpeed;
    player.invuln = 0;
    player.pierce = 0;
    player.weaponType = "basic";
    player.twinOffset = 0;
    player.burstCount = 0;
    player.jitterAngle = 0;
    player.isSeeker = false;
    player.seekAccel = 0;
    player.seekerMax = 0;
  }
  function startGame() {
    hideAllOverlays();
    resetRunState();
    applyWeapon(equippedWeapon);
    applyPendantsPassives();
    spawnWave(state.level);
    if (state.level % 10 === 5) spawnBossArc(state.level);
    if (state.level % 10 === 0) spawnBossChrono(state.level);
    showBanner("Level " + state.level, "Musuh: " + state.lastWaveCount);
  }
  function nextLevel() {
    state.level++;
    levelEl.textContent = state.level;
    spawnWave(state.level);
    if (state.level % 10 === 5) spawnBossArc(state.level);
    if (state.level % 10 === 0) spawnBossChrono(state.level);
    if (state.level % state.draftEvery === 0) openDraft();
    else showBanner("Level " + state.level, "Musuh: " + state.lastWaveCount);
  }
  function fail(reason) {
    state.running = false;
    state.failReason = reason ?? "Gagal.";
    const coinsEarned = Math.floor(
      state.score * 0.1 + state.level * 3 + state.bossKills * 50
    );
    coins += Math.max(0, coinsEarned);
    saveCoins();
    updateCoinUI();
    gameOverReasonEl.textContent = state.failReason;
    gameOverStatsEl.innerHTML = `Skor: <b>${state.score}</b> · Level: <b>${state.level}</b> · Boss Kill: <b>${state.bossKills}</b>`;
    gameOverCoinsEl.textContent = `🪙 +${Math.max(0, coinsEarned)} coins`;
    showOverlay(gameOverOverlay);
  }
  function gameOver() {
    fail("Kapal hancur!");
  }

  /* ===== UI Drawing helpers ===== */
  function drawVignette() {
    const g = ctx.createRadialGradient(
      W / 2,
      H * 0.45,
      Math.min(W, H) * 0.1,
      W / 2,
      H * 0.45,
      Math.max(W, H) * 0.65
    );
    g.addColorStop(0, "rgba(40,60,150,0.10)");
    g.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  function roundRect(x, y, w, h, r, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }
  function drawHeading(text, sub) {
    const titleSize = clamp(Math.floor(H * 0.035), 16, 22);
    const subSize = clamp(Math.floor(H * 0.024), 12, 14);
    ctx.save();
    ctx.textAlign = "center";
    ctx.font = `700 ${titleSize}px system-ui, Segoe UI, Roboto`;
    ctx.fillStyle = "#cfe5ff";
    ctx.shadowBlur = 12;
    ctx.shadowColor = "#4fa3ff";
    const titleY = Math.floor(H * 0.12);
    ctx.fillText(text, W / 2, titleY);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(225,238,255,0.75)";
    ctx.font = `600 ${subSize}px system-ui, Segoe UI, Roboto`;
    ctx.fillText(sub, W / 2, titleY + subSize + 8);
    ctx.restore();
  }
  function drawBadge(level, x, y) {
    if (!level || level <= 0) return;
    const R = 13,
      cx = x - R - 8,
      cy = y + R + 8;
    ctx.save();
    const grd = ctx.createRadialGradient(cx, cy, 4, cx, cy, R);
    grd.addColorStop(0, level >= 3 ? "#ffd55b" : "#5b69ff");
    grd.addColorStop(1, level >= 3 ? "#ffb83a" : "#2b48ff");
    ctx.fillStyle = grd;
    ctx.shadowBlur = 10;
    ctx.shadowColor = level >= 3 ? "#ffcf5b" : "#4fa3ff";
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#0b1240";
    ctx.textAlign = "center";
    ctx.font = "700 12px system-ui, Segoe UI, Roboto";
    ctx.fillText(level >= 3 ? "MAX" : String(level), cx, cy + 4);
    ctx.restore();
  }
  function drawCard(dc) {
    const r = 12,
      x = dc.x,
      y = dc.y,
      w = dc.w,
      h = dc.h;
    const grd = ctx.createLinearGradient(x, y, x + w, y + h);
    grd.addColorStop(0, "rgba(24,30,80,0.92)");
    grd.addColorStop(1, "rgba(16,20,56,0.92)");
    ctx.fillStyle = grd;
    roundRect(x, y, w, h, r, true, false);
    ctx.shadowBlur = 16;
    ctx.shadowColor = "#5b69ff";
    ctx.strokeStyle = "rgba(91,105,255,0.7)";
    ctx.lineWidth = 1.5;
    roundRect(x, y, w, h, r, false, true);
    ctx.shadowBlur = 0;

    const titleSize = clamp(Math.floor(h * 0.22), 14, 18);
    let lineSize = clamp(Math.floor(h * 0.16), 12, 14);
    let hintSize = clamp(Math.floor(h * 0.14), 11, 12);
    let lineHeight = Math.max(14, Math.floor(lineSize * 1.28));

    ctx.textAlign = "center";
    ctx.fillStyle = "#e6e9ff";
    ctx.font = `700 ${titleSize}px system-ui, Segoe UI, Roboto`;
    ctx.fillText(dc.card.name, x + w / 2, y + Math.floor(h * 0.28));

    const PAD = Math.max(16, Math.floor(w * 0.06));
    const LEFT = x + PAD;
    const MAXW = w - PAD * 2;
    let curY = y + Math.floor(h * 0.48);
    const hintGap = Math.max(10, Math.floor(h * 0.12));
    const hintY = y + h - hintGap;

    let availableLines = Math.floor((hintY - curY - hintSize - 6) / lineHeight);
    if (availableLines < 2) {
      lineSize = Math.max(11, Math.floor(lineSize * 0.92));
      hintSize = Math.max(10, Math.floor(hintSize * 0.92));
      lineHeight = Math.max(13, Math.floor(lineSize * 1.24));
      availableLines = Math.floor((hintY - curY - hintSize - 6) / lineHeight);
    }
    availableLines = Math.max(2, availableLines);

    const buffLines = Math.min(2, Math.max(1, Math.floor(availableLines / 2)));
    const debuffLines = Math.min(2, Math.max(1, availableLines - buffLines));

    ctx.textAlign = "left";
    ctx.fillStyle = "#3af0d5";
    ctx.font = `600 ${lineSize}px system-ui, Segoe UI, Roboto`;
    curY = drawWrappedText(
      ctx,
      "Buff: " + dc.card.buffDesc,
      LEFT,
      curY,
      MAXW,
      lineHeight,
      buffLines
    );
    curY += Math.max(6, Math.floor(h * 0.06));
    ctx.fillStyle = "#ff6e6e";
    ctx.font = `600 ${lineSize}px system-ui, Segoe UI, Roboto`;
    curY = drawWrappedText(
      ctx,
      "Debuff: " + dc.card.debuffDesc,
      LEFT,
      curY,
      MAXW,
      lineHeight,
      debuffLines
    );

    ctx.fillStyle = "rgba(220,230,255,0.85)";
    ctx.font = `500 ${hintSize}px system-ui, Segoe UI, Roboto`;
    ctx.textAlign = "center";
    ctx.fillText("Sentuh untuk memilih/upgrade (maks Lv 3)", x + w / 2, hintY);

    const curLv = state.cardLevels[dc.card.id] ?? 0;
    drawBadge(curLv, x + w, y);
  }
  function drawButton(btn) {
    const x = btn.x,
      y = btn.y,
      w = btn.w,
      h = btn.h,
      r = 10;
    const grd = ctx.createLinearGradient(x, y, x + w, y + h);
    grd.addColorStop(0, "#5b69ff");
    grd.addColorStop(1, "#2b48ff");
    ctx.fillStyle = grd;
    roundRect(x, y, w, h, r, true, false);
    ctx.shadowBlur = 14;
    ctx.shadowColor = "#4fa3ff";
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 1;
    roundRect(x, y, w, h, r, false, true);
    ctx.shadowBlur = 0;
    const btnFont = clamp(Math.floor(h * 0.42), 12, 16);
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.font = `700 ${btnFont}px system-ui, Segoe UI, Roboto`;
    ctx.fillText(btn.text, x + w / 2, y + h / 2 + Math.floor(btnFont * 0.35));
  }
  function drawBanner(dt) {
    if (state.inDraft || !state.banner) return;
    const b = state.banner;
    b.t += dt;
    const remain = Math.max(0, b.duration - b.t);
    const alpha = Math.min(1, Math.max(0, remain / 0.6));
    ctx.save();
    ctx.globalAlpha = alpha * 0.85;
    const panelW = Math.min(320, Math.floor(W * 0.8)),
      panelH = 86;
    const x = Math.round(W / 2 - panelW / 2),
      y = Math.round(H * 0.28);
    ctx.fillStyle = "rgba(10,16,50,0.6)";
    roundRect(x, y, panelW, panelH, 12, true, false);
    ctx.globalAlpha = alpha;
    ctx.textAlign = "center";
    ctx.fillStyle = "#cfe5ff";
    ctx.font = "700 22px system-ui, Segoe UI, Roboto";
    ctx.fillText(b.text, x + panelW / 2, y + 32);
    ctx.fillStyle = "rgba(225,238,255,0.85)";
    ctx.font = "600 14px system-ui, Segoe UI, Roboto";
    ctx.fillText(b.sub, x + panelW / 2, y + 56);
    ctx.restore();
    if (b.t >= b.duration) state.banner = null;
  }

  /* ===== Boss abilities ===== */
  function bossArcRadial(b) {
    const n = 24,
      s = 180 * state.multipliers.enemyBulletSpeed;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const vx = Math.cos(a) * s,
        vy = Math.sin(a) * s + 60;
      state.enemyBullets.push({
        x: b.x,
        y: b.y + b.h / 2,
        vx,
        vy,
        dmg: 12 * state.multipliers.enemyDamage,
        color: "#ff9a5b",
        w: 6,
        h: 16,
      });
    }
  }
  function bossArcSummon() {
    for (let i = 0; i < 6; i++) {
      const x = rand(30, W - 30),
        y = rand(-H * 0.4, -60),
        speed = rand(70, 120) * state.multipliers.enemySpeed;
      const hp = 22 * state.multipliers.enemyHP * (1 + state.level * 0.05);
      state.enemies.push({
        type: "basic",
        x,
        y,
        w: 26,
        h: 26,
        hp,
        speed,
        fireCd: 0,
        t: 0,
        color: "#f7d15f",
        _vx: 0,
        _vy: 0,
        _px: x,
        _py: y,
      });
    }
    state.lastWaveCount += 6;
  }
  function bossArcLaser(b) {
    b.laser = {
      x: b.x,
      width: 18,
      charge: 0.9,
      active: false,
      t: 0,
      duration: 0.6,
    };
  }
  function updateBossArc(b, dt) {
    b.abilityTimer += dt;
    const topBound = Math.min(H * 0.18, 140),
      dy = topBound - b.y;
    const prevX = b.x,
      prevY = b.y;
    b.y += clamp(dy, -b.speed * dt, b.speed * dt);
    b.x += Math.sin(state.time * 0.8) * 60 * dt;
    b.x = clamp(b.x, 40, W - 40);
    b._vx = (b.x - prevX) / Math.max(1e-4, dt);
    b._vy = (b.y - prevY) / Math.max(1e-4, dt);

    if (b.laser) {
      const L = b.laser;
      L.t += dt;
      if (!L.active && L.t >= L.charge) {
        L.active = true;
        L.t = 0;
      } else if (L.active && L.t >= L.duration) {
        b.laser = null;
      }
      if (L.active) {
        const half = L.width / 2;
        if (Math.abs(player.x - L.x) <= half && player.y > b.y) {
          player.hp -= 28 * dt * state.multipliers.enemyDamage;
          if (player.hp <= 0) gameOver();
        }
      }
    }

    const cycle = 4.5;
    if (b.abilityTimer >= cycle && !b.laser) {
      b.abilityTimer = 0;
      if (b.abilityIndex === 0) bossArcRadial(b);
      else if (b.abilityIndex === 1) bossArcSummon();
      else bossArcLaser(b);
      b.abilityIndex = (b.abilityIndex + 1) % 3;
    }
  }
  function drawBossLaser(b) {
    const L = b.laser;
    if (!L) return;
    const half = L.width / 2;
    if (!L.active) {
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = "#ff6e6e";
      ctx.fillRect(L.x - half, b.y, L.width, H - b.y);
      ctx.restore();
    } else {
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = "#ff2f2f";
      ctx.shadowBlur = 18;
      ctx.shadowColor = "#ff2f2f";
      ctx.fillRect(L.x - half, b.y, L.width, H - b.y);
      ctx.restore();
    }
  }
  function chronoVortex(b) {
    b.vortex = { t: 0, duration: 3.0, factor: 0.6, x: b.x, y: b.y + 30 };
  }
  function chronoMeteor(b) {
    for (let i = 0; i < 6; i++) {
      const x = rand(40, W - 40),
        w = rand(14, 28),
        h = rand(28, 46);
      const vy = rand(180, 260) * state.multipliers.enemyBulletSpeed;
      state.enemyBullets.push({
        x,
        y: b.y + 10,
        vx: rand(-20, 20),
        vy,
        dmg: 18 * state.multipliers.enemyDamage,
        color: "#ffb15b",
        w,
        h,
      });
    }
  }
  function chronoSpiral(b) {
    const shots = 18,
      s = 160 * state.multipliers.enemyBulletSpeed;
    b.spiralAngle = (b.spiralAngle ?? 0) + 0.28;
    for (let i = 0; i < shots; i++) {
      const a = b.spiralAngle + (i / shots) * Math.PI * 2;
      const vx = Math.cos(a) * s,
        vy = Math.sin(a) * s + 80;
      state.enemyBullets.push({
        x: b.x,
        y: b.y + b.h / 2,
        vx,
        vy,
        dmg: 10 * state.multipliers.enemyDamage,
        color: "#62ffd5",
        w: 6,
        h: 16,
      });
    }
  }
  function updateBossChrono(b, dt) {
    b.abilityTimer += dt;
    const topBound = Math.min(H * 0.18, 140),
      dy = topBound - b.y;
    const prevX = b.x,
      prevY = b.y;
    b.y += clamp(dy, -b.speed * dt, b.speed * dt);
    b.x += Math.sin(state.time * 0.7) * 70 * dt;
    b.x = clamp(b.x, 40, W - 40);
    b._vx = (b.x - prevX) / Math.max(1e-4, dt);
    b._vy = (b.y - prevY) / Math.max(1e-4, dt);

    if (b.vortex) {
      b.vortex.t += dt;
      if (b.vortex.t <= b.vortex.duration) {
        player.speed = player.baseSpeed * b.vortex.factor;
        ctx.save();
        ctx.globalAlpha = 0.2;
        ctx.fillStyle = "#62ffd5";
        ctx.beginPath();
        ctx.arc(b.vortex.x, b.vortex.y, 120, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        player.speed = player.baseSpeed;
        b.vortex = null;
      }
    }

    const cycle = 5.0;
    if (b.abilityTimer >= cycle) {
      b.abilityTimer = 0;
      if (b.abilityIndex === 0) chronoVortex(b);
      else if (b.abilityIndex === 1) chronoMeteor(b);
      else chronoSpiral(b);
      b.abilityIndex = (b.abilityIndex + 1) % 3;
    }
  }

  /* ===== Drones ===== */
  function updateDrones(dt) {
    for (const d of state.drones) {
      d.angle += dt * 0.8;
      d.x = player.x + Math.cos(d.angle) * d.radius;
      d.y = player.y - 40 + Math.sin(d.angle) * 8;
      const now = state.time,
        interval = 1 / d.fireRate;
      if (now - d.lastFire >= interval) {
        d.lastFire = now;
        state.bullets.push({
          x: d.x,
          y: d.y - 8,
          vx: 0,
          vy: -d.bulletSpeed,
          dmg: d.bulletDamage,
          color: d.color,
          pierce: 0,
        });
      }
    }
  }

  /* ======= PENDANTS (Shop items) ======= */
  const PENDANTS = [
    {
      id: "pendant_fleet",
      name: "Fleet Pendant",
      cost: 80,
      desc: "+10% kecepatan kapal",
      apply() {
        player.baseSpeed *= 1.1;
        player.speed = player.baseSpeed;
      },
    },
    {
      id: "pendant_vitalis",
      name: "Vitalis Pendant",
      cost: 100,
      desc: "+12 Max HP & heal +6 saat mulai",
      apply() {
        player.maxHp += 12;
        player.hp = Math.min(player.maxHp, player.hp + 6);
      },
    },
    {
      id: "pendant_precision",
      name: "Precision Pendant",
      cost: 120,
      desc: "+12% damage peluru",
      apply() {
        player.bulletDamage = Math.round(player.bulletDamage * 1.12);
      },
    },
    {
      id: "pendant_zephyr",
      name: "Zephyr Pendant",
      cost: 120,
      desc: "+10% laju tembakan",
      apply() {
        player.fireRate *= 1.1;
      },
    },
    {
      id: "pendant_aegis",
      name: "Aegis Pendant",
      cost: 140,
      desc: "Invuln +0.15s saat kena hit",
      apply() {
        enableOnHitInvuln = true;
        bonusOnHitInvuln += 0.15;
      },
    },
    {
      id: "pendant_pierce",
      name: "Pierce Pendant",
      cost: 140,
      desc: "Peluru menembus +1",
      apply() {
        player.pierce = Math.min(3, player.pierce + 1);
      },
    },
    {
      id: "pendant_photon",
      name: "Photon Pendant",
      cost: 130,
      desc: "+8% kecepatan peluru",
      apply() {
        player.bulletSpeed = Math.round(player.bulletSpeed * 1.08);
      },
    },
    {
      id: "pendant_focus",
      name: "Focus Pendant",
      cost: 110,
      desc: "Spread angle -10% (lebih rapat)",
      apply() {
        player.spreadAngle *= 0.9;
      },
    },
    {
      id: "pendant_regen",
      name: "Regen Pendant",
      cost: 150,
      desc: "Regen dasar +1.2 HP/s",
      apply() {
        state.regen.rate = (state.regen.rate ?? 0) + 1.2;
      },
    },
    {
      id: "pendant_drone",
      name: "Drone Pendant",
      cost: 160,
      desc: "+1 Drone kecil",
      apply() {
        if (state.drones.length < 4) {
          state.drones.push({
            x: player.x,
            y: player.y - 40,
            angle: Math.PI * 2 * (state.drones.length / 4),
            radius: 28 + 6 * state.drones.length,
            fireRate: 3.2,
            bulletSpeed: 520,
            bulletDamage: 5,
            color: "#a7ffda",
            lastFire: 0,
          });
        }
      },
    },
    {
      id: "pendant_voidflare",
      name: "Voidflare Pendant",
      cost: 200,
      desc: "+15% damage, +8% fire rate; peluru musuh lebih lambat",
      apply() {
        player.bulletDamage = Math.round(player.bulletDamage * 1.15);
        player.fireRate *= 1.08;
        state.multipliers.enemyBulletSpeed *= 0.9;
      },
    },
    {
      id: "pendant_gravwell",
      name: "Gravwell Pendant",
      cost: 220,
      desc: "+10 Max HP (+5 heal); musuh bergerak lebih lambat",
      apply() {
        player.maxHp += 10;
        player.hp = Math.min(player.maxHp, player.hp + 5);
        state.multipliers.enemySpeed *= 0.92;
      },
    },
  ];
  let bonusOnHitInvuln = 0;
  let enableOnHitInvuln = false;
  function applyPendantsPassives() {
    bonusOnHitInvuln = 0;
    enableOnHitInvuln = false;
    for (const p of PENDANTS) if (equippedSet.has(p.id)) p.apply();
  }

  /* ======= WEAPONS (Shop section) ======= */
  const WEAPONS = [
    {
      id: "weapon_basic",
      name: "Standard Blaster",
      cost: 0,
      desc: "Baseline seimbang. Cocok di semua situasi.",
      apply() {
        player.weaponType = "basic";
        player.fireRate = 6;
        player.bulletDamage = 10;
        player.bulletSpeed = 660;
        player.spread = 1;
        player.spreadAngle = (16 * Math.PI) / 180;
        player.pierce = 0;
        player.bulletColor = "#58dbff";
        player.twinOffset = 0;
        player.burstCount = 0;
        player.jitterAngle = 0;
        player.isSeeker = false;
        player.seekAccel = 0;
        player.seekerMax = 0;
      },
    },
    {
      id: "weapon_railgun",
      name: "Railgun",
      cost: 200,
      desc: "Damage besar, pierce +2, tapi fire rate turun.",
      apply() {
        player.weaponType = "railgun";
        player.fireRate = 3.0;
        player.bulletDamage = 25;
        player.bulletSpeed = 900;
        player.spread = 1;
        player.pierce = Math.min(3, 2);
        player.bulletColor = "#c0c7ff";
        player.twinOffset = 0;
        player.burstCount = 0;
        player.jitterAngle = 0;
        player.isSeeker = false;
        player.seekAccel = 0;
        player.seekerMax = 0;
      },
    },
    {
      id: "weapon_scatter",
      name: "Scattershot",
      cost: 180,
      desc: "5 pellets lebar; bullet speed -15%, damage per pellet -40%.",
      apply() {
        player.weaponType = "scatter";
        player.fireRate = 7.2;
        player.bulletDamage = Math.round(10 * 0.6);
        player.bulletSpeed = Math.round(660 * 0.85);
        player.spread = Math.min(7, 5);
        player.pierce = 0;
        player.bulletColor = "#ffd55b";
        player.twinOffset = 0;
        player.burstCount = 0;
        player.jitterAngle = 0;
        player.isSeeker = false;
        player.seekAccel = 0;
        player.seekerMax = 0;
      },
    },
    {
      id: "weapon_smg",
      name: "Pulse SMG",
      cost: 190,
      desc: "Fire rate +60% dengan jitter; damage -35%.",
      apply() {
        player.weaponType = "smg";
        player.fireRate = Math.round(6 * 1.6 * 10) / 10;
        player.bulletDamage = Math.round(10 * 0.65);
        player.bulletSpeed = 640;
        player.spread = 1;
        player.pierce = 0;
        player.bulletColor = "#58dbff";
        player.jitterAngle = (6 * Math.PI) / 180;
        player.twinOffset = 0;
        player.burstCount = 0;
        player.isSeeker = false;
        player.seekAccel = 0;
        player.seekerMax = 0;
      },
    },
    {
      id: "weapon_twin",
      name: "Twinshot",
      cost: 170,
      desc: "Dua laras paralel; fire rate -10%, pierce 0.",
      apply() {
        player.weaponType = "twin";
        player.fireRate = Math.round(6 * 0.9 * 10) / 10;
        player.bulletDamage = 9;
        player.bulletSpeed = 660;
        player.spread = 1;
        player.pierce = 0;
        player.bulletColor = "#7ea8ff";
        player.twinOffset = 9;
        player.burstCount = 0;
        player.jitterAngle = 0;
        player.isSeeker = false;
        player.seekAccel = 0;
        player.seekerMax = 0;
      },
    },
    {
      id: "weapon_burst",
      name: "Charged Burst",
      cost: 210,
      desc: "Tiap tembakan 3 peluru sekaligus; bullet speed -25%.",
      apply() {
        player.weaponType = "burst";
        player.fireRate = 4.5;
        player.bulletDamage = 7;
        player.bulletSpeed = Math.round(660 * 0.75);
        player.spread = 1;
        player.pierce = 0;
        player.bulletColor = "#62ffd5";
        player.burstCount = 3;
        player.twinOffset = 0;
        player.jitterAngle = 0;
        player.isSeeker = false;
        player.seekAccel = 0;
        player.seekerMax = 0;
      },
    },
    {
      id: "weapon_seeker",
      name: "Seeker Micro-Missiles",
      cost: 230,
      desc: "Peluru homing ringan; damage -20%, fire rate -15%.",
      apply() {
        player.weaponType = "seeker";
        player.fireRate = Math.round(6 * 0.85 * 10) / 10;
        player.bulletDamage = Math.round(10 * 0.8);
        player.bulletSpeed = 520;
        player.spread = 1;
        player.pierce = 0;
        player.bulletColor = "#ff9a5b";
        player.isSeeker = true;
        player.seekTurnRate = Math.PI * 12.0; // menikung sangat cepat
        player.seekAccel = 420;
        player.seekerMax = 820;
        player.twinOffset = 0;
        player.burstCount = 0;
        player.jitterAngle = 0;
      },
    },
  ];
  let weaponsOwned = new Set(
    JSON.parse(localStorage.getItem("weaponsOwned") ?? "[]")
  );
  let equippedWeapon = localStorage.getItem("equippedWeapon") ?? "weapon_basic";
  function saveWeapons() {
    localStorage.setItem("weaponsOwned", JSON.stringify([...weaponsOwned]));
    localStorage.setItem("equippedWeapon", equippedWeapon);
  }
  if (!weaponsOwned.has("weapon_basic")) {
    weaponsOwned.add("weapon_basic");
    saveWeapons();
  }
  function applyWeapon(id) {
    const w = WEAPONS.find((x) => x.id === id) ?? WEAPONS[0];
    w.apply();
  }

  /* ======= SHOP RENDER / LOGIC (tabs statis) ======= */
  let shopActiveTab = "pendants"; // default
  const tabPendantsBtn = document.getElementById("tabPendants");
  const tabWeaponsBtn = document.getElementById("tabWeapons");
  tabPendantsBtn?.addEventListener("click", () => {
    shopActiveTab = "pendants";
    renderShop();
  });
  tabWeaponsBtn?.addEventListener("click", () => {
    shopActiveTab = "weapons";
    renderShop();
  });

  function renderPendantsShop() {
    shopGrid.innerHTML = "";
    updateCoinUI();
    const svgNS = "http://www.w3.org/2000/svg";
    const xlinkNS = "http://www.w3.org/1999/xlink";
    PENDANTS.forEach((p) => {
      const card = document.createElement("div");
      card.className = "shop-card";
      if (ownedSet.has(p.id)) card.classList.add("owned");
      if (equippedSet.has(p.id)) card.classList.add("equipped");

      const h3 = document.createElement("h3");
      const icon = document.createElementNS(svgNS, "svg");
      const suffix = p.id.split("pendant_")[1] ?? "fleet";
      icon.setAttribute("class", `pendant-icon pendant-${suffix}`);
      icon.setAttribute("aria-hidden", "true");
      const use = document.createElementNS(svgNS, "use");
      use.setAttribute("href", `#icon-${p.id}`);
      use.setAttributeNS(xlinkNS, "href", `#icon-${p.id}`);
      icon.appendChild(use);
      const titleText = document.createTextNode(p.name);
      h3.appendChild(icon);
      h3.appendChild(titleText);

      const price = document.createElement("div");
      price.className = "shop-price";
      price.textContent = `🪙 ${p.cost}`;

      const desc = document.createElement("p");
      desc.textContent = p.desc;

      const buyBtn = document.createElement("button");
      buyBtn.className = "btn buy-btn";
      buyBtn.textContent = "Beli";
      buyBtn.disabled = false;

      const equipBtn = document.createElement("button");
      equipBtn.className = "btn equip-btn";

      function updateCardClasses() {
        ownedSet.has(p.id)
          ? card.classList.add("owned")
          : card.classList.remove("owned");
        equippedSet.has(p.id)
          ? card.classList.add("equipped")
          : card.classList.remove("equipped");
      }
      function updateEquipBtn() {
        if (!ownedSet.has(p.id)) {
          equipBtn.textContent = "Equip";
          equipBtn.disabled = true;
        } else {
          equipBtn.disabled = false;
          equipBtn.textContent = equippedSet.has(p.id) ? "Unequip" : "Equip";
        }
      }

      equipBtn.addEventListener("click", () => {
        if (!ownedSet.has(p.id)) return;
        if (equippedSet.has(p.id)) {
          equippedSet.delete(p.id);
          saveEquipped();
          updateEquipBtn();
          updateCardClasses();
        } else {
          if (equippedSet.size >= EQUIP_LIMIT) {
            const prevText = equipBtn.textContent;
            equipBtn.textContent = `Slot penuh (${EQUIP_LIMIT}/${EQUIP_LIMIT})`;
            equipBtn.disabled = true;
            setTimeout(() => {
              equipBtn.disabled = false;
              equipBtn.textContent = prevText;
            }, 1100);
            return;
          }
          equippedSet.add(p.id);
          saveEquipped();
          updateEquipBtn();
          updateCardClasses();
        }
      });

      buyBtn.addEventListener("click", () => {
        if (ownedSet.has(p.id)) return;
        if (coins < p.cost) {
          buyBtn.textContent = "Coins kurang";
          setTimeout(() => (buyBtn.textContent = "Beli"), 1200);
          return;
        }
        coins -= p.cost;
        saveCoins();
        updateCoinUI();
        ownedSet.add(p.id);
        saveOwned();
        if (equippedSet.size < EQUIP_LIMIT) {
          equippedSet.add(p.id);
          saveEquipped();
        }
        buyBtn.remove();
        updateEquipBtn();
        updateCardClasses();
        card.append(equipBtn);
      });

      updateEquipBtn();
      updateCardClasses();
      card.append(h3, price, desc);
      !ownedSet.has(p.id) ? card.append(buyBtn) : card.append(equipBtn);
      shopGrid.appendChild(card);
    });
  }

  function renderWeaponsShop() {
    shopGrid.innerHTML = "";
    updateCoinUI();
    WEAPONS.forEach((w) => {
      const card = document.createElement("div");
      card.className = "shop-card";
      if (weaponsOwned.has(w.id)) card.classList.add("owned");
      if (equippedWeapon === w.id) card.classList.add("equipped");

      const h3 = document.createElement("h3");
      h3.textContent = w.name;
      const price = document.createElement("div");
      price.className = "shop-price";
      price.textContent = `🪙 ${w.cost}`;
      const desc = document.createElement("p");
      desc.textContent = w.desc;

      const buyBtn = document.createElement("button");
      buyBtn.className = "btn buy-btn";
      buyBtn.textContent = "Beli";
      buyBtn.disabled = false;

      const equipBtn = document.createElement("button");
      equipBtn.className = "btn equip-btn";

      function refreshCard() {
        weaponsOwned.has(w.id)
          ? card.classList.add("owned")
          : card.classList.remove("owned");
        equippedWeapon === w.id
          ? card.classList.add("equipped")
          : card.classList.remove("equipped");
        if (!weaponsOwned.has(w.id)) {
          equipBtn.textContent = "Equip";
          equipBtn.disabled = true;
        } else {
          const isEq = equippedWeapon === w.id;
          equipBtn.disabled = isEq;
          equipBtn.textContent = isEq ? "Equipped" : "Equip";
        }
      }

      equipBtn.addEventListener("click", () => {
        if (!weaponsOwned.has(w.id)) return;
        equippedWeapon = w.id;
        saveWeapons();
        renderWeaponsShop();
      });

      buyBtn.addEventListener("click", () => {
        if (weaponsOwned.has(w.id) || w.cost === 0) return;
        if (coins < w.cost) {
          buyBtn.textContent = "Coins kurang";
          setTimeout(() => (buyBtn.textContent = "Beli"), 1200);
          return;
        }
        coins -= w.cost;
        saveCoins();
        updateCoinUI();
        weaponsOwned.add(w.id);
        equippedWeapon = w.id;
        saveWeapons();
        renderWeaponsShop();
        buyBtn.remove();
        card.append(equipBtn);
        refreshCard();
      });

      refreshCard();
      card.append(h3, price, desc);
      !weaponsOwned.has(w.id) && w.cost > 0
        ? card.append(buyBtn)
        : card.append(equipBtn);
      shopGrid.appendChild(card);
    });
  }

  function renderShop() {
    updateCoinUI();
    tabPendantsBtn?.classList.toggle("active", shopActiveTab === "pendants");
    tabWeaponsBtn?.addEventListener;
    tabWeaponsBtn?.classList.toggle("active", shopActiveTab === "weapons");
    if (shopActiveTab === "pendants") renderPendantsShop();
    else renderWeaponsShop();
  }

  /* ======== INDEX BOOK (DINAMIS & PRESISI) ======== */
  function makeRegularPolygonPoints(
    sides,
    r = 9,
    cx = 12,
    cy = 12,
    startDeg = -90
  ) {
    const pts = [];
    for (let i = 0; i < sides; i++) {
      const a = ((startDeg + (360 / sides) * i) * Math.PI) / 180;
      const x = cx + r * Math.cos(a);
      const y = cy + r * Math.sin(a);
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return pts.join(" ");
  }
  function buildEnemySVG(kind) {
    const common = `class="enemy-icon" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" aria-hidden="true"`;
    switch (kind.type) {
      case "diamond":
        return `<svg ${common}><polygon points="12,3 21,12 12,21 3,12" fill="currentColor"/></svg>`;
      case "circle":
        return `<svg ${common}><circle cx="12" cy="12" r="9" fill="currentColor"/></svg>`;
      case "triangle_down":
        return `<svg ${common}><polygon points="4,8 20,8 12,20" fill="currentColor"/></svg>`;
      case "diamond_ring":
        return `<svg ${common}>
<polygon points="12,3 21,12 12,21 3,12" fill="currentColor"/>
<circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="2"/>
</svg>`;
      case "regular_polygon":
        return `<svg ${common}><polygon points="${makeRegularPolygonPoints(
          kind.sides,
          kind.r ?? 9
        )}" fill="currentColor"/></svg>`;
      default:
        return `<svg ${common}><rect x="5" y="5" width="14" height="14" fill="currentColor"/></svg>`;
    }
  }

  const INDEX_BOOK = [
    {
      id: "basic",
      name: "Basic",
      tagClass: "",
      figureClass: "enemy-basic",
      shape: { type: "diamond" },
      desc: "Unit standar zig-zag ringan.",
      lore: "Dulu hanyalah drone tambang di Sabuk Orpheus, kini direprogram untuk perang. Mereka bergerak dalam formasi rapat, memancarkan dengung statis radio yang terdengar seperti nyanyian karbida. Setiap unit membawa serpihan memori industri, seakan menuntut balas atas eksploitasi masa lalu.",
      strength: ["Datang berombongan"],
      weakness: ["Arc Spread / Rapid Fire"],
    },
    {
      id: "shooter",
      name: "Shooter",
      tagClass: "red",
      figureClass: "enemy-shooter",
      shape: { type: "circle" },
      desc: "Penembak jarak menengah.",
      lore: "Menara portabel dengan inti safir retak, menyimpan log pertempuran dari perang yang dilupakan. Setiap tembakan adalah gema konflik kunu, ditembakkan dengan presisi dingin. Mereka tidak mengenal mundur, hanya pola tembak yang terprogram untuk menghancurkan.",
      strength: ["Tembakan konsisten"],
      weakness: ["EMP Disruptor / Cryo Field"],
    },
    {
      id: "dasher",
      name: "Dasher",
      tagClass: "cyan",
      figureClass: "enemy-dasher",
      shape: { type: "triangle_down" },
      desc: "Melakukan dash mendadak.",
      lore: "Rangka ringan berlapis polimer cerdas, pendorongnya memancarkan aroma ozon dan kilatan biru. Mereka hidup untuk kecepatan, menukik seperti petir yang membelah langit hampa. Setiap dash adalah tarian maut, memanfaatkan celah sekecil apapun untuk menembus pertahanan.",
      strength: ["Dash cepat ke bawah"],
      weakness: ["Afterburner / Overcharge"],
    },
    {
      id: "shield",
      name: "Shield",
      tagClass: "green",
      figureClass: "enemy-shield",
      shape: { type: "diamond_ring" },
      desc: "Perisai aktif berkala.",
      lore: "Prototipe dari laboratorium orbital yang dibajak. Saat medan aktif dilepaskan, udara bergetar halus, seakan ada denyut jantung buatan yang bersembunyi di balik lapisan energi. Rumor pilot mengatakan, jika menempelkan helm ke rangka mereka, terdengar bisikan AI penjaga yang tak ingin mati.",
      strength: ["Block 1 hit saat shield aktif"],
      weakness: ["Corrosive Cloud / Rapid Fire"],
    },
    {
      id: "splitter",
      name: "Splitter",
      tagClass: "purple",
      figureClass: "enemy-splitter",
      shape: { type: "diamond" },
      desc: "Meledak jadi dua unit kecil.",
      lore: "Produk nanoforge semi-stabil yang gagal di jalur produksi. Saat hancur, mereka pecah menjadi dua fragmen yang lebih cepat, membawa panas memori yang membentuk bayangan jalur perdagangan kuno. Pecahan mereka adalah serpihan dendam yang tak pernah padam.",
      strength: ["Fragmen cepat & mengecoh"],
      weakness: ["Arc Spread / Pierce"],
    },
    {
      id: "boss_arc",
      name: "Boss: Arc Overlord",
      tagClass: "boss",
      figureClass: "enemy-boss-arc boss-pink",
      shape: { type: "regular_polygon", sides: 8, r: 9 },
      desc: "Radial shot, summon, laser.",
      lore: "AI arkival yang terhubung ke relay purba. Ia mengarsipkan pertempuran dengan menulis kilatan energi di ruang hampa. Setiap garis merah laser adalah catatan amarah yang tak pernah usai, sebuah simfoni kehancuran yang dimainkan di panggung kosmik.",
      strength: ["Proyektil padat + laser"],
      weakness: ["EMP Disruptor / Overcharge"],
    },
    {
      id: "boss_chrono",
      name: "Boss: Chrono Titan",
      tagClass: "boss",
      figureClass: "enemy-boss-chrono boss-teal",
      shape: { type: "regular_polygon", sides: 7, r: 9 },
      desc: "Vortex lambat, meteor, spiral.",
      lore: "Mesin waktu kompak yang terjebak dalam loop emosi. Jam internalnya berderak mundur, setiap dentang anomali memanggil serpihan masa depan untuk menghancurkan yang kini. Ia bukan sekadar musuh, tapi paradoks yang menari di antara detik dan kehancuran.",
      strength: ["Slow + pola peluru kompleks"],
      weakness: ["Photon / Precision"],
    },
  ];

  function renderIndexBook() {
    const container = document.querySelector("#indexOverlay .index-content");
    if (!container) return;
    container.innerHTML = "";
    INDEX_BOOK.forEach((item) => {
      const card = document.createElement("div");
      card.className = "enemy-card";
      const fig = document.createElement("div");
      fig.className = `enemy-fig ${item.figureClass}`;
      fig.innerHTML = buildEnemySVG(item.shape);
      const info = document.createElement("div");
      info.className = "enemy-info";
      const tag = document.createElement("span");
      tag.className = `index-tag ${item.tagClass}`;
      tag.textContent = item.name;
      const pDesc = document.createElement("p");
      pDesc.innerHTML = `<b>Deskripsi:</b> ${item.desc}`;
      const pLore = document.createElement("p");
      pLore.className = "lore";
      pLore.innerHTML = `<b>Lore:</b> ${item.lore}`;
      const pStr = document.createElement("p");
      pStr.innerHTML = `<b>Strength:</b> ${
        Array.isArray(item.strength) ? item.strength.join("; ") : item.strength
      }`;
      const pWeak = document.createElement("p");
      pWeak.innerHTML = `<b>Weakness:</b> ${
        Array.isArray(item.weakness) ? item.weakness.join("; ") : item.weakness
      }`;
      info.append(tag, pDesc, pLore, pStr, pWeak);
      card.append(fig, info);
      container.appendChild(card);
    });
  }

  /* ===== Main Loop ===== */
  function drawInvulnAura(x, y, t, invulnLeft) {
    if (invulnLeft <= 0) return;
    const baseR = 30,
      pulse = 6 * Math.sin(t * 6),
      R = baseR + pulse;
    const alpha = clamp(
      0.18 + 0.12 * Math.min(invulnLeft, 0.8) * 1.2,
      0.15,
      0.35
    );
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#7ee6ff";
    ctx.shadowBlur = 22;
    ctx.shadowColor = "#58dbff";
    ctx.beginPath();
    ctx.arc(x, y, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = alpha + 0.1;
    ctx.strokeStyle = "#58dbff";
    ctx.lineWidth = 1.6;
    ctx.shadowBlur = 14;
    ctx.shadowColor = "#58dbff";
    const sides = 6,
      r = R * 0.72;
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2 + t * 0.8;
      const px = x + Math.cos(a) * r,
        py = y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    ctx.save();
    const flick = 0.2 + 0.2 * Math.sin(t * 14);
    ctx.globalAlpha = clamp(flick, 0.1, 0.35);
    ctx.fillStyle = "#d7f7ff";
    ctx.beginPath();
    ctx.arc(x, y - 2, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawLockIcon(x, y) {
    const size = 12;
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = "#ffdb5b";
    ctx.lineWidth = 1.4;
    ctx.shadowBlur = 10;
    ctx.shadowColor = "#ffdb5b";
    ctx.beginPath();
    ctx.arc(0, 0, size, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-size, 0);
    ctx.lineTo(-size + 4, 0);
    ctx.moveTo(size, 0);
    ctx.lineTo(size - 4, 0);
    ctx.moveTo(0, -size);
    ctx.lineTo(0, -size + 4);
    ctx.moveTo(0, size);
    ctx.lineTo(0, size - 4);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = "#ffdb5b";
    ctx.font = "700 10px system-ui, Segoe UI, Roboto";
    ctx.textAlign = "center";
    ctx.fillText("LOCK", 0, -size - 6);
    ctx.restore();
  }

  let last = performance.now();
  let locksToDraw = [];

  function loop(now) {
    const dt = Math.min((now - last) / 1000, 0.033);
    last = now;
    state.time += dt;
    locksToDraw = [];

    // background
    ctx.clearRect(0, 0, W, H);
    for (const s of state.stars) {
      s.y += s.speed * dt;
      if (s.y > H + 4) {
        s.y = -4;
        s.x = rand(0, W);
      }
      ctx.fillStyle = `hsl(${s.hue}, 75%, ${
        60 + Math.sin(now / 700 + s.x * 0.01) * 20
      }%)`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    }
    drawVignette();

    // shield pulse
    if (state.shieldPulse) {
      state.shieldPulse.t += dt;
      if (state.shieldPulse.t >= state.shieldPulse.interval) {
        state.shieldPulse.t = 0;
        player.invuln = Math.max(player.invuln, state.shieldPulse.duration);
      }
    }

    // regen
    if (state.running && !state.inDraft) {
      state.regen.sinceHit += dt;
      const activeRate =
        state.regen.rate +
        (state.regen.sinceHit >= state.regen.outDelay
          ? state.regen.bonusRate
          : 0);
      if (activeRate > 0) {
        player.hp = Math.min(player.maxHp, player.hp + activeRate * dt);
        ctx.save();
        const alpha = 0.15 + 0.1 * Math.sin(state.time * 4);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "#3af06b";
        ctx.beginPath();
        ctx.arc(
          player.x,
          player.y,
          28 + 6 * Math.sin(state.time * 2),
          0,
          Math.PI * 2
        );
        ctx.fill();
        ctx.restore();
      }
    }

    if (state.running && !state.inDraft) {
      const targetX = clamp(pointer.x, MARGIN_X, W - MARGIN_X);
      const dx = targetX - player.x;
      player.x += clamp(dx, -player.speed * dt, player.speed * dt);
      player.y = H - 90;

      firePlayer();
      updateDrones(dt);

      // ===== PLAYER BULLETS (Seeker guidance: lead + terminal pure pursuit) =====
      for (let i = state.bullets.length - 1; i >= 0; i--) {
        const b = state.bullets[i];
        if (b.seek) b.age += dt;

        b.x += b.vx * dt;
        b.y += b.vy * dt;

        if (b.seek) {
          // Retarget: gunakan bottom-first, lalu jarak
          b.retargetT += dt;
          const needRetarget =
            !b.lock ||
            b.retargetT >= (b.retargetEvery ?? 0.03) ||
            b.lockTimer > b.lockPersist;

          if (needRetarget) {
            b.retargetT = 0;
            const sx = b.x,
              sy = b.y;
            const arr = state.enemies.map((e) => {
              const d2 = (e.x - sx) ** 2 + (e.y - sy) ** 2;
              return { e, y: e.y, d2 };
            });
            arr.sort((a, b2) => b2.y - a.y || a.d2 - b2.d2);
            b.lock = arr.length ? arr[0].e : null;
            b.lockTimer = 0;
          }

          const target = b.lock;
          if (target) {
            // HUD lock icon
            locksToDraw.push({
              target,
              x: target.x,
              y: target.y - target.h / 2 - 14,
            });

            // ==== Lead pursuit: aim ke posisi prediksi ====
            const tx0 = target.x,
              ty0 = target.y;
            const sp = Math.max(60, Math.hypot(b.vx, b.vy));
            const dist = Math.hypot(tx0 - b.x, ty0 - b.y);

            // estimasi kecepatan target (dihitung di enemy update)
            const tvx = target._vx ?? 0;
            const tvy = target._vy ?? 0;

            // waktu intersep perkiraan (dibatasi supaya stabil)
            const tLead = clamp(dist / Math.max(sp, 60), 0.05, 0.8);

            let tx = tx0 + tvx * tLead;
            let ty = ty0 + tvy * tLead;

            // Terminal mode: jika dekat, gunakan pure pursuit langsung ke target saat ini
            const terminal = dist <= 80;
            if (terminal) {
              tx = tx0;
              ty = ty0;
            }

            const los = Math.atan2(ty - b.y, tx - b.x);
            let losRate = 0;
            if (b.prevLos != null) {
              let dLos = los - b.prevLos;
              if (dLos > Math.PI) dLos -= Math.PI * 2;
              else if (dLos < -Math.PI) dLos += Math.PI * 2;
              losRate = dLos / dt;
            }
            b.prevLos = los;

            const heading = Math.atan2(b.vy, b.vx);
            let delta = los - heading;
            if (delta > Math.PI) delta -= Math.PI * 2;
            else if (delta < -Math.PI) delta += Math.PI * 2;

            // PN + cross-track correction + boost saat terminal
            const kGain = terminal ? 2.8 : 2.0;
            const turnBoost = terminal
              ? 1.6
              : 1.0 + clamp(Math.abs(delta) / Math.PI, 0, 1.0);
            const pn = (b.navConst ?? 4.0) * losRate * dt * turnBoost;
            const maxTurn = (b.turnRate ?? Math.PI * 2.0) * dt * turnBoost;
            let turn = clamp(delta * kGain + pn, -maxTurn, maxTurn);
            let newHeading = heading + turn;

            // Snap saat sudah selaras
            const toAimX = Math.cos(los),
              toAimY = Math.sin(los);
            const fwdX = Math.cos(newHeading),
              fwdY = Math.sin(newHeading);
            const align = toAimX * fwdX + toAimY * fwdY;
            const snapCone = terminal
              ? Math.max(0.96, b.snapCone ?? 0.95)
              : b.snapCone ?? 0.95;
            if (align > snapCone) newHeading = los;

            // Akselerasi bertahap (semakin lama semakin cepat)
            const accelCur = Math.min(
              b.accelBase * (1 + b.accelGrow * b.age),
              b.accelBase * b.accelCapMul
            );
            // Terminal: tambah dorongan agar pasti mengejar
            const accelBoost = terminal ? 1.25 : 1.0;
            b.vx += Math.cos(newHeading) * accelCur * accelBoost * dt;
            b.vy += Math.sin(newHeading) * accelCur * accelBoost * dt;

            // Batas kecepatan dengan cap ikut bertambah
            const newSp = Math.hypot(b.vx, b.vy);
            const maxSp = clamp(
              b.maxSpeedBase + b.maxSpeedGrow * b.age,
              b.maxSpeedBase,
              b.maxSpeedCap
            );
            if (newSp > maxSp) {
              b.vx = (b.vx / newSp) * maxSp;
              b.vy = (b.vy / newSp) * maxSp;
            }

            // Cone check: toleransi kecil, reset lockTimer saat dalam cone
            const toTargetX = tx0 - b.x,
              toTargetY = ty0 - b.y;
            const dotFwd =
              (toTargetX * Math.cos(newHeading) +
                toTargetY * Math.sin(newHeading)) /
              Math.max(1e-3, Math.hypot(toTargetX, toTargetY));
            const coneOk = dotFwd > 0.08; // toleransi kecil → akurat
            b.lockTimer = coneOk ? 0 : b.lockTimer + dt;
          } else {
            // tanpa target: jaga kecepatan agar siap mengejar
            const sp = Math.hypot(b.vx, b.vy);
            const maxSp = clamp(
              b.maxSpeedBase + b.maxSpeedGrow * b.age,
              b.maxSpeedBase,
              b.maxSpeedCap
            );
            if (sp < maxSp * 0.85) {
              const a = Math.atan2(b.vy, b.vx);
              const accelCur = Math.min(
                b.accelBase * (1 + b.accelGrow * b.age),
                b.accelBase * b.accelCapMul
              );
              b.vx += Math.cos(a) * accelCur * 0.6 * dt;
              b.vy += Math.sin(a) * accelCur * 0.6 * dt;
            }
          }
        }

        if (b.y < -30 || b.y > H + 30 || b.x < -30 || b.x > W + 30)
          state.bullets.splice(i, 1);
      }

      // === LOCK HUD (dibatasi 1 + level Arc Spread) ===
      const maxLockIcons = 1 + (state.cardLevels["arc_spread"] ?? 0);
      const seen = new Set();
      const uniqueLocks = [];
      for (const lk of locksToDraw) {
        const key = lk.target;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueLocks.push({ x: lk.x, y: lk.y });
        }
      }
      locksToDraw = uniqueLocks.slice(0, Math.max(0, maxLockIcons));

      // ===== ENEMIES UPDATE + velocity tracking =====
      for (let i = state.enemies.length - 1; i >= 0; i--) {
        const e = state.enemies[i];
        e.t += dt;
        const prevX = e.x,
          prevY = e.y;

        if (e.type === "boss_arc") updateBossArc(e, dt);
        else if (e.type === "boss_chrono") updateBossChrono(e, dt);
        else {
          if (e.type === "basic") {
            e.y += e.speed * dt;
            e.x += Math.sin((e.t + i * 0.2) * 1.8) * 30 * dt;
          } else if (e.type === "shooter") {
            e.y += e.speed * dt;
            e.x += Math.sin((e.t + i * 0.2) * 1.6) * 28 * dt;
            if (e.t > e.fireCd) {
              e.t = 0;
              fireEnemy(e);
            }
          } else if (e.type === "dasher") {
            e.y += e.speed * dt;
            e.x += clamp((player.x - e.x) * 0.8, -120 * dt, 120 * dt);
            e.dashCountdown -= dt;
            if (e.dashCountdown <= 0) {
              e.y += e.speed * 1.8;
              e.dashCountdown = rand(1.0, 2.0);
            }
          } else if (e.type === "shield") {
            e.y += e.speed * dt;
            e.x += Math.sin((e.t + i * 0.2) * 1.5) * 26 * dt;
            e.shieldTimer += dt;
            const period = 2.2,
              activeDur = 0.8;
            e.shieldActive = e.shieldTimer % period < activeDur;
          } else if (e.type === "splitter") {
            e.y += e.speed * dt;
            e.x += Math.sin((e.t + i * 0.25) * 1.7) * 28 * dt;
          }

          if (e.x < MARGIN_X) {
            e.x = MARGIN_X;
            if (e.vx) e.vx = Math.abs(e.vx);
          }
          if (e.x > W - MARGIN_X) {
            e.x = W - MARGIN_X;
            if (e.vx) e.vx = -Math.abs(e.vx);
          }
          if (e.y + e.h / 2 >= H) {
            fail("Musuh lolos!");
          }
        }

        // update velocity for lead pursuit
        e._vx = (e.x - prevX) / Math.max(1e-4, dt);
        e._vy = (e.y - prevY) / Math.max(1e-4, dt);
      }
    }

    // enemy bullets movement
    for (let i = state.enemyBullets.length - 1; i >= 0; i--) {
      const b = state.enemyBullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.y < -30 || b.y > H + 30 || b.x < -30 || b.x > W + 30)
        state.enemyBullets.splice(i, 1);
    }

    // player bullets vs enemies
    for (let i = state.enemies.length - 1; i >= 0; i--) {
      const e = state.enemies[i];
      const eb = { x: e.x, y: e.y, w: e.w, h: e.h };
      for (let j = state.bullets.length - 1; j >= 0; j--) {
        const b = state.bullets[j];
        const bb = { x: b.x, y: b.y, w: 8, h: 12 };
        if (aabbHit(eb, bb)) {
          const armor = state.multipliers.enemyArmor ?? 0;
          let effDmg = b.dmg * (1 - armor);
          if (e.type === "shield" && e.shieldActive) {
            spawnExplosion(e.x, e.y, "#9cf05b");
            effDmg = 0;
          }
          if (effDmg > 0) e.hp -= effDmg;
          if (e.hp <= 0) {
            spawnExplosion(e.x, e.y, e.color);
            state.score +=
              e.type === "boss_arc" || e.type === "boss_chrono"
                ? 900
                : e.type === "shooter"
                ? 35
                : e.type === "dasher"
                ? 32
                : e.type === "shield"
                ? 38
                : e.type === "splitter"
                ? 34
                : 12;
            state.enemiesKilled++;
            if (e.type === "boss_arc" || e.type === "boss_chrono")
              state.bossKills++;
            if (e.type === "splitter" && e.generation > 0) {
              for (let k = 0; k < 2; k++) {
                state.enemies.push({
                  type: "basic",
                  x: e.x + (k ? 10 : -10),
                  y: e.y,
                  w: 22,
                  h: 22,
                  hp: 14 * state.multipliers.enemyHP * (1 + state.level * 0.05),
                  speed: e.speed * 1.2,
                  fireCd: 0,
                  t: 0,
                  color: "#caa0ff",
                  _vx: 0,
                  _vy: 0,
                  _px: e.x,
                  _py: e.y,
                });
              }
            }
            state.enemies.splice(i, 1);
          }
          if (b.pierce > 0) b.pierce--;
          else state.bullets.splice(j, 1);
          break;
        }
      }
    }

    // enemy bullets vs player
    if (player.invuln > 0) player.invuln -= dt;
    for (let i = state.enemyBullets.length - 1; i >= 0; i--) {
      const b = state.enemyBullets[i];
      const bb = { x: b.x, y: b.y, w: b.w, h: b.h };
      const pb = { x: player.x, y: player.y, w: player.w, h: player.h };
      if (aabbHit(pb, bb)) {
        if (player.invuln <= 0) {
          player.hp -= b.dmg;
          const baseOnHit = enableOnHitInvuln ? 0.4 : 0;
          player.invuln =
            baseOnHit + (enableOnHitInvuln ? bonusOnHitInvuln ?? 0 : 0);
          state.regen.sinceHit = 0;
          spawnExplosion(player.x, player.y, "#58dbff");
          if (player.hp <= 0) gameOver();
        }
        state.enemyBullets.splice(i, 1);
      }
    }

    // enemies touch
    for (let i = state.enemies.length - 1; i >= 0; i--) {
      const e = state.enemies[i];
      const eb = { x: e.x, y: e.y, w: e.w, h: e.h };
      const pb = { x: player.x, y: player.y, w: player.w, h: player.h };
      if (aabbHit(pb, eb)) {
        if (player.invuln <= 0) {
          player.hp -= 16 * state.multipliers.enemyDamage;
          const baseOnHitTouch = enableOnHitInvuln ? 0.5 : 0;
          player.invuln =
            baseOnHitTouch + (enableOnHitInvuln ? bonusOnHitInvuln ?? 0 : 0);
          state.regen.sinceHit = 0;
          spawnExplosion(player.x, player.y, "#58dbff");
          if (player.hp <= 0) gameOver();
        }
        e.y -= 20;
        e.x += (e.x < player.x ? -1 : 1) * 12;
      }
    }

    // particles
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 40 * dt;
      if (p.t > p.life) state.particles.splice(i, 1);
    }

    if (state.enemies.length === 0 && state.running && !state.inDraft)
      nextLevel();

    /* ===== Render ===== */
    if (state.running) {
      drawInvulnAura(player.x, player.y, state.time, player.invuln);

      ctx.save();
      ctx.translate(player.x, player.y);
      ctx.fillStyle = "rgba(88,219,255,0.6)";
      ctx.shadowBlur = 16;
      ctx.shadowColor = "#58dbff";
      ctx.beginPath();
      ctx.moveTo(-6, player.h / 2);
      ctx.lineTo(6, player.h / 2);
      ctx.lineTo(0, player.h / 2 + 14 + Math.sin(state.time * 30));
      ctx.closePath();
      ctx.fill();

      ctx.shadowBlur = 18;
      ctx.shadowColor = "#58dbff";
      ctx.fillStyle = player.invuln > 0 ? "#7ee6ff" : "#58dbff";
      ctx.beginPath();
      ctx.moveTo(0, -player.h / 2);
      ctx.lineTo(player.w / 2, player.h / 2);
      ctx.lineTo(-player.w / 2, player.h / 2);
      ctx.closePath();
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    for (const d of state.drones) {
      ctx.save();
      ctx.shadowBlur = 10;
      ctx.shadowColor = d.color;
      ctx.fillStyle = d.color;
      ctx.beginPath();
      ctx.arc(d.x, d.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    for (const b of state.bullets) {
      ctx.save();
      ctx.shadowBlur = 12;
      ctx.shadowColor = b.color;
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x - 2, b.y - 8, 4, 12);
      ctx.restore();
    }

    for (const e of state.enemies) {
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.shadowBlur = 12;
      ctx.shadowColor = e.color;
      ctx.fillStyle = e.color;
      if (e.type === "boss_arc" || e.type === "boss_chrono") {
        if (e.type === "boss_arc") {
          ctx.beginPath();
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            const rx = (Math.cos(a) * e.w) / 2,
              ry = (Math.sin(a) * e.h) / 2;
            if (i === 0) ctx.moveTo(rx, ry);
            else ctx.lineTo(rx, ry);
          }
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.beginPath();
          for (let i = 0; i < 7; i++) {
            const a = (i / 7) * Math.PI * 2;
            const rx = (Math.cos(a) * e.w) / 2,
              ry = (Math.sin(a) * e.h) / 2;
            if (i === 0) ctx.moveTo(rx, ry);
            else ctx.lineTo(rx, ry);
          }
          ctx.closePath();
          ctx.fill();
        }
      } else {
        if (e.type === "basic" || e.type === "splitter") {
          ctx.beginPath();
          ctx.moveTo(0, -e.h / 2);
          ctx.lineTo(e.w / 2, 0);
          ctx.lineTo(0, e.h / 2);
          ctx.lineTo(-e.w / 2, 0);
          ctx.closePath();
          ctx.fill();
        } else if (e.type === "shooter") {
          ctx.beginPath();
          ctx.arc(0, 0, e.w / 2, 0, Math.PI * 2);
          ctx.fill();
        } else if (e.type === "dasher") {
          ctx.beginPath();
          ctx.moveTo(-e.w / 2, -e.h / 2);
          ctx.lineTo(e.w / 2, -e.h / 2);
          ctx.lineTo(0, e.h / 2);
          ctx.closePath();
          ctx.fill();
        } else if (e.type === "shield") {
          ctx.beginPath();
          ctx.moveTo(0, -e.h / 2);
          ctx.lineTo(e.w / 2, 0);
          ctx.lineTo(0, e.h / 2);
          ctx.lineTo(-e.w / 2, 0);
          ctx.closePath();
          ctx.fill();
          if (e.shieldActive) {
            ctx.shadowBlur = 18;
            ctx.shadowColor = "#9cf05b";
            ctx.strokeStyle = "rgba(156,240,91,0.9)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, e.w * 0.62, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      }
      ctx.restore();
      if (e.type === "boss_arc") drawBossLaser(e);
    }

    for (const lk of locksToDraw) drawLockIcon(lk.x, lk.y);

    for (const b of state.enemyBullets) {
      ctx.save();
      ctx.shadowBlur = 10;
      ctx.shadowColor = b.color;
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);
      ctx.restore();
    }

    for (const p of state.particles) {
      ctx.save();
      ctx.shadowBlur = 8;
      ctx.shadowColor = p.color;
      ctx.fillStyle = p.color;
      ctx.globalAlpha = 1 - p.t / p.life;
      ctx.fillRect(p.x, p.y, 3, 3);
      ctx.restore();
    }

    if (state.inDraft && state.running) {
      ctx.save();
      ctx.fillStyle = "rgba(0,8,24,0.65)";
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
      drawHeading(
        "Pilih / Upgrade Kartu (maks Lv 3)",
        "Buff disertai debuff untuk musuh"
      );
      for (const dc of state.draftCards) drawCard(dc);
      if (state.skipBtn) drawButton(state.skipBtn);
    }

    drawBanner(dt);
    scoreEl.textContent = state.score;
    hpFill.style.width = clamp(100 * (player.hp / player.maxHp), 0, 100) + "%";
    hpText.textContent =
      "HP " + Math.max(0, Math.floor(player.hp)) + "/" + player.maxHp;
    levelEl.textContent = state.level;

    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  /* ===== Menu / Index / Shop Events ===== */
  function goMenu() {
    renderShop();
    updateCoinUI();
    showOverlay(menuOverlay);
  }
  playBtn.addEventListener("click", () => {
    startGame();
  });
  indexBtn.addEventListener("click", () => {
    cancelDraft();
    renderIndexBook();
    showOverlay(indexOverlay);
  });
  indexClose.addEventListener("click", () => {
    cancelDraft();
    showOverlay(menuOverlay);
  });
  shopBtn.addEventListener("click", () => {
    cancelDraft();
    renderShop();
    showOverlay(shopOverlay);
  });
  shopClose.addEventListener("click", () => {
    cancelDraft();
    showOverlay(menuOverlay);
  });
  retryBtn.addEventListener("click", () => {
    startGame();
  });
  goShopBtn.addEventListener("click", () => {
    cancelDraft();
    renderShop();
    showOverlay(shopOverlay);
  });
  goMenuBtn.addEventListener("click", () => {
    cancelDraft();
    goMenu();
  });

  // Init UI
  renderShop();
  updateCoinUI();
})();
