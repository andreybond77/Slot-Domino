/* ============================================
   🎰 СЛОТ-ДОМИНО — логика + звук + эффекты
   ============================================ */

// ============================================
// КОНФИГУРАЦИЯ
// ============================================
const START_BALANCE   = 100;
const DEFAULT_BET     = 10;

const LOCK_COST       = 5;
const LOCKS_PER_ROUND = 2;
const MAX_LOCKS       = 2;

const MULT_THREE_DIFFERENT_DOUBLES = 5;
const MULT_CENTER_DOUBLE           = 4;
const MULT_EDGE_DOUBLES            = 4;
const MULT_FULL_LINE               = 3;
const MULT_PAIR_LINE               = 2;

const SPIN_TICK_MS    = 80;
const STOP_DELAY_MS   = 400;
const STOP_STAGGER_MS = 300;
const FLIP_ANIM_MS    = 300;
const BALANCE_TICK_MS = 400;

// ============================================
// ЗВУК — Web Audio API
// ============================================
const Sound = (() => {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let mutedFx = false;
  let mutedMusic = false;
  let musicTimer = null;

  function init() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);

    musicGain = ctx.createGain();
    musicGain.gain.value = 0.12;
    musicGain.connect(master);
  }

  function resume() {
    if (ctx && ctx.state === "suspended") ctx.resume();
  }

  function tone({
    freq = 440,
    type = "sine",
    duration = 0.15,
    volume = 1,
    slideTo = null,
    delay = 0,
    attack = 0.005,
    dest = null,
  } = {}) {
    if (mutedFx) return;
    init(); resume();
    if (!ctx) return;

    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo != null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + duration);
    }

    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(volume, t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

    osc.connect(gain).connect(dest || master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  function noise({ duration = 0.15, volume = 0.5, highpass = 1200, delay = 0 } = {}) {
    if (mutedFx) return;
    init(); resume();
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 3);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = highpass;

    const gain = ctx.createGain();
    gain.gain.value = volume;

    src.connect(filter).connect(gain).connect(master);
    src.start(t0);
  }

  function chord(freqs, opts = {}) {
    freqs.forEach((f, i) => {
      tone({ freq: f, delay: (opts.stagger || 0) * i, ...opts });
    });
  }

  function musicNote(freq, delay, dur, type = "triangle", vol = 0.5) {
    if (mutedMusic) return;
    init(); resume();
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(musicGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function musicBar() {
    if (mutedMusic || !ctx) return;
    const step = 0.27;

    const bassNotes = [
      [110, 4],
      [87.31, 4],
      [130.81, 4],
      [98.00, 4],
    ];
    let t = 0;
    bassNotes.forEach(([f, n]) => {
      for (let i = 0; i < n; i++) {
        musicNote(f, t, 0.5, "sine", 0.4);
        t += step * 2;
      }
    });

    const arps = [
      [220, 261.63, 329.63, 440],
      [174.61, 220, 261.63, 349.23],
      [261.63, 329.63, 392, 523.25],
      [196, 246.94, 293.66, 392],
    ];
    let at = 0;
    arps.forEach((notes) => {
      for (let i = 0; i < 8; i++) {
        const n = notes[i % notes.length];
        musicNote(n, at, 0.22, "triangle", 0.35);
        at += step;
      }
    });
  }

  function startMusic() {
    init(); resume();
    if (musicTimer) return;
    musicBar();
    musicTimer = setInterval(() => {
      if (!mutedMusic) musicBar();
    }, 4320);
  }

  function stopMusic() {
    if (musicTimer) {
      clearInterval(musicTimer);
      musicTimer = null;
    }
  }

  const api = {
    unlock() { init(); resume(); },
    startMusic,
    stopMusic,

    toggleFx() {
      mutedFx = !mutedFx;
      return mutedFx;
    },
    toggleMusic() {
      mutedMusic = !mutedMusic;
      if (mutedMusic) stopMusic();
      else startMusic();
      return mutedMusic;
    },
    isFxMuted() { return mutedFx; },
    isMusicMuted() { return mutedMusic; },

    click() {
      tone({ freq: 700, type: "square", duration: 0.05, volume: 0.4 });
    },
    hover() {
      tone({ freq: 1600, type: "sine", duration: 0.03, volume: 0.15 });
    },
    lock() {
      tone({ freq: 320, type: "triangle", duration: 0.12, volume: 0.7 });
      tone({ freq: 180, type: "sine", duration: 0.18, volume: 0.6, delay: 0.05 });
    },
    flip() {
      tone({ freq: 900, type: "sine", duration: 0.18, volume: 0.6, slideTo: 300 });
    },
    recalc() {
      tone({ freq: 1200, type: "sine", duration: 0.1, volume: 0.5, slideTo: 1600 });
      tone({ freq: 800, type: "triangle", duration: 0.15, volume: 0.4, delay: 0.08, slideTo: 1200 });
    },
    spinStart() {
      tone({ freq: 220, type: "sawtooth", duration: 0.25, volume: 0.4, slideTo: 880 });
    },
    reelTick(progress = 0) {
      const f = 1200 + progress * 1400;
      tone({ freq: f, type: "square", duration: 0.03, volume: 0.3 });
      noise({ duration: 0.02, volume: 0.25, highpass: 2000 });
    },
    reelStop() {
      tone({ freq: 180, type: "square", duration: 0.10, volume: 0.7 });
      tone({ freq: 90,  type: "sine",   duration: 0.18, volume: 0.7, delay: 0.03 });
    },
    winPair() {
      chord([523.25, 659.25], { type: "triangle", duration: 0.18, volume: 0.7, stagger: 0.08 });
      voice("wow");
    },
    winLine() {
      chord([523.25, 659.25, 783.99], { type: "triangle", duration: 0.2, volume: 0.7, stagger: 0.08 });
      voice("yeah");
    },
    winCenter() {
      chord([587.33, 739.99, 880.00, 1174.66], { type: "sine", duration: 0.22, volume: 0.7, stagger: 0.07 });
      voice("nice");
    },
    winEdges() {
      chord([493.88, 622.25, 783.99, 987.77], { type: "triangle", duration: 0.22, volume: 0.7, stagger: 0.07 });
      voice("nice");
    },
    jackpot() {
      for (let i = 0; i < 8; i++) {
        noise({
          duration: 0.05,
          volume: 0.15 + i * 0.05,
          highpass: 1500,
          delay: i * 0.05,
        });
      }
      const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98];
      notes.forEach((f, i) => {
        tone({ freq: f, type: "triangle", duration: 0.28, volume: 0.7, delay: 0.4 + i * 0.09 });
      });
      chord([1046.50, 1318.51, 1567.98, 2093.00], {
        type: "sine", duration: 0.9, volume: 0.5, stagger: 0, delay: 0.95,
      });
      for (let i = 0; i < 8; i++) {
        tone({
          freq: 2000 + Math.random() * 2000,
          type: "sine",
          duration: 0.12,
          volume: 0.25,
          delay: 0.95 + i * 0.06,
        });
      }
      voice("jackpot");
    },
    lose() {
      tone({ freq: 220, type: "sawtooth", duration: 0.35, volume: 0.6, slideTo: 80 });
      tone({ freq: 110, type: "sine",     duration: 0.45, volume: 0.5, slideTo: 55, delay: 0.12 });
    },
    gameOver() {
      const notes = [392.00, 329.63, 261.63, 196.00];
      notes.forEach((f, i) => {
        tone({ freq: f, type: "triangle", duration: 0.4, volume: 0.7, delay: i * 0.2 });
      });
    },
    bet() {
      tone({ freq: 880, type: "square", duration: 0.05, volume: 0.35 });
    },
    error() {
      tone({ freq: 180, type: "square", duration: 0.15, volume: 0.5 });
      tone({ freq: 140, type: "square", duration: 0.15, volume: 0.5, delay: 0.08 });
    },
  };

  function voice(kind) {
    if (mutedFx) return;
    init(); resume();
    if (!ctx) return;
    const t0 = ctx.currentTime;

    let f0, formants, dur;
    switch (kind) {
      case "wow":     f0 = 220; formants = [800, 1150, 2900]; dur = 0.5; break;
      case "yeah":    f0 = 240; formants = [660, 1700, 2400]; dur = 0.5; break;
      case "nice":    f0 = 260; formants = [300, 2300, 3000]; dur = 0.45; break;
      case "jackpot": f0 = 300; formants = [700, 1200, 2600]; dur = 0.8; break;
      default:        f0 = 240; formants = [700, 1200, 2600]; dur = 0.4;
    }

    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(f0, t0);
    osc.frequency.linearRampToValueAtTime(f0 * 1.1, t0 + dur * 0.6);
    osc.frequency.linearRampToValueAtTime(f0 * 0.95, t0 + dur);

    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(formants[0], t0);
    bp.frequency.linearRampToValueAtTime(formants[1], t0 + dur * 0.5);
    bp.frequency.linearRampToValueAtTime(formants[0], t0 + dur);
    bp.Q.value = 6;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.35, t0 + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    osc.connect(bp).connect(g).connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  return api;
})();

// ============================================
// ЧАСТИЦЫ (canvas)
// ============================================
const FX = (() => {
  const canvas = document.getElementById("fxCanvas");
  const ctx = canvas.getContext("2d");
  let W = 0, H = 0, DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  let particles = [];
  let raf = null;

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  resize();
  window.addEventListener("resize", resize);

  function spawn(x, y, count, opts = {}) {
    const {
      color = "#ffd700",
      speed = 4,
      spread = Math.PI * 2,
      angle = -Math.PI / 2,
      gravity = 0.15,
      size = 3,
      life = 60,
      shape = "circle",
    } = opts;

    for (let i = 0; i < count; i++) {
      const a = angle + (Math.random() - 0.5) * spread;
      const sp = speed * (0.5 + Math.random());
      particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        g: gravity,
        size: size * (0.6 + Math.random() * 0.8),
        color,
        life: life * (0.6 + Math.random() * 0.6),
        maxLife: life,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.3,
        shape,
      });
    }
    if (!raf) loop();
  }

  function loop() {
    raf = requestAnimationFrame(loop);
    ctx.clearRect(0, 0, W, H);

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.vy += p.g;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      p.life--;

      if (p.life <= 0 || p.y > H + 50) {
        particles.splice(i, 1);
        continue;
      }

      const alpha = Math.min(1, p.life / (p.maxLife * 0.6));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;

      if (p.shape === "confetti") {
        ctx.fillRect(-p.size, -p.size * 0.4, p.size * 2, p.size * 0.8);
      } else if (p.shape === "spark") {
        ctx.fillRect(-p.size * 0.5, -p.size * 1.6, p.size, p.size * 3.2);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    if (particles.length === 0) {
      cancelAnimationFrame(raf);
      raf = null;
    }
  }

  function centerOf(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  return {
    centerOf,
    winPair(els) {
      els.forEach(el => {
        const { x, y } = centerOf(el);
        spawn(x, y, 18, { color: "#4dff88", speed: 3.5, size: 3, gravity: 0.2, life: 60 });
      });
    },
    winLine(els) {
      els.forEach(el => {
        const { x, y } = centerOf(el);
        spawn(x, y, 26, { color: "#ffd700", speed: 4, size: 3.5, gravity: 0.18, life: 70 });
      });
    },
    winCenter(els) {
      els.forEach(el => {
        const { x, y } = centerOf(el);
        spawn(x, y, 26, { color: "#00e5ff", speed: 4.2, size: 3.5, gravity: 0.18, life: 70 });
      });
    },
    winEdges(els) {
      els.forEach(el => {
        const { x, y } = centerOf(el);
        spawn(x, y, 26, { color: "#ff8c00", speed: 4.2, size: 3.5, gravity: 0.18, life: 70 });
      });
    },
    jackpot(els) {
      els.forEach(el => {
        const { x, y } = centerOf(el);
        spawn(x, y, 70, {
          color: Math.random() > 0.5 ? "#ffea00" : "#ffd700",
          speed: 7, size: 4, gravity: 0.22, life: 100, shape: "confetti",
        });
      });
      const mid = centerOf(document.getElementById("reels"));
      spawn(mid.x, mid.y, 120, {
        color: "#ffea00", speed: 9, spread: Math.PI * 2, angle: 0,
        gravity: 0.25, size: 4, life: 110, shape: "confetti",
      });
    },
    sparkAt(x, y) {
      spawn(x, y, 14, { color: "#7dffb0", speed: 4, size: 2.5, gravity: 0.2, life: 45, shape: "spark" });
    },
  };
})();

// ---- Мьют-кнопки ----
(function setupAudioButtons() {
  const fxBtn = document.getElementById("muteFxBtn");
  const musicBtn = document.getElementById("muteMusicBtn");

  fxBtn.addEventListener("click", () => {
    Sound.unlock();
    const m = Sound.toggleFx();
    fxBtn.textContent = m ? "🔇" : "🔊";
    fxBtn.classList.toggle("off", m);
    if (!m) Sound.click();
  });
  musicBtn.addEventListener("click", () => {
    Sound.unlock();
    const m = Sound.toggleMusic();
    musicBtn.classList.toggle("off", m);
    if (!m) Sound.click();
  });
})();

// ---- Разблокировка аудио + запуск музыки ----
["pointerdown", "keydown", "touchstart"].forEach(evt => {
  window.addEventListener(evt, () => {
    Sound.unlock();
    Sound.startMusic();
  }, { once: true });
});

// ---- Блип при наведении ----
document.addEventListener("mouseover", (e) => {
  const t = e.target.closest("button");
  if (!t || t.disabled) return;
  Sound.hover();
});

// ============================================
// ПОЛНЫЙ НАБОР 28 КОСТЯШЕК
// ============================================
function buildDominoSet() {
  const set = [];
  for (let top = 0; top <= 6; top++) {
    for (let bot = top; bot <= 6; bot++) {
      set.push({ top, bot, sum: top + bot });
    }
  }
  return set;
}
const DOMINO_SET = buildDominoSet();

// ============================================
// СОСТОЯНИЕ ИГРЫ
// ============================================
let balance      = START_BALANCE;
let currentBet   = DEFAULT_BET;
let spinning     = false;
let locksLeft    = LOCKS_PER_ROUND;
let paidLine     = null;

let betLocked        = false;
let recalcAvailable  = false;
let currentSpinWin   = 0;

let paidLockedPair = null;

let reels = [
  { domino: null, locked: false },
  { domino: null, locked: false },
  { domino: null, locked: false },
];

// ============================================
// DOM-ЭЛЕМЕНТЫ
// ============================================
const reelEls = [
  document.getElementById("reel0"),
  document.getElementById("reel1"),
  document.getElementById("reel2"),
];
const sparkEls = [
  document.getElementById("spark0"),
  document.getElementById("spark1"),
];
const machineEl    = document.getElementById("machine");
const flashEl      = document.getElementById("flash");
const balanceEl    = document.getElementById("balance");
const betDisplayEl = document.getElementById("betDisplay");
const spinBtn      = document.getElementById("spinBtn");
const recalcBtn    = document.getElementById("recalcBtn");
const resultPanel  = document.getElementById("resultPanel");
const gameOverEl   = document.getElementById("gameOver");
const restartBtn   = document.getElementById("restartBtn");
const locksLeftEl  = document.getElementById("locksLeft");
const quickBetBtns = document.querySelectorAll(".quick-bets button");
const lockBtns     = document.querySelectorAll(".lock-btn");
const flipBtns     = document.querySelectorAll(".flip-btn");

// ============================================
// УТИЛИТЫ
// ============================================
function pickDomino() {
  return { ...DOMINO_SET[Math.floor(Math.random() * DOMINO_SET.length)] };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getLockedIndices() {
  const arr = [];
  reels.forEach((r, i) => { if (r.locked) arr.push(i); });
  return arr;
}

function getLockedAdjacentPair() {
  const locked = getLockedIndices();
  if (locked.length !== 2) return null;
  const [a, b] = locked;
  if (b - a === 1) return [a, b];
  return null;
}

function humanPair(positions) {
  return positions.map(i => i + 1).join(" и ");
}

function sameDominoes(a, b) {
  if (!a || !b) return false;
  return a.top === b.top && a.bot === b.bot;
}

function paidLockedPairStillValid() {
  if (!paidLockedPair) return false;
  const [p0, p1] = paidLockedPair.positions;
  const d0 = reels[p0].domino;
  const d1 = reels[p1].domino;
  return sameDominoes(d0, paidLockedPair.dominoes[0])
      && sameDominoes(d1, paidLockedPair.dominoes[1]);
}

// ============================================
// АНИМИРОВАННЫЙ СЧЁТЧИК БАЛАНСА
// ============================================
let displayedBalance = balance;
let balanceAnimRaf = null;

function animateBalanceTo(target) {
  if (balanceAnimRaf) cancelAnimationFrame(balanceAnimRaf);
  const start = displayedBalance;
  const diff = target - start;
  const t0 = performance.now();

  function step(now) {
    const k = Math.min(1, (now - t0) / BALANCE_TICK_MS);
    const e = 1 - Math.pow(1 - k, 3);
    displayedBalance = Math.round(start + diff * e);
    balanceEl.textContent = displayedBalance;
    if (k < 1) {
      balanceAnimRaf = requestAnimationFrame(step);
    } else {
      displayedBalance = target;
      balanceEl.textContent = target;
      balanceAnimRaf = null;
    }
  }
  balanceAnimRaf = requestAnimationFrame(step);
}

// ============================================
// РЕНДЕР КОСТЯШКИ
// ============================================
function createDominoElement(d) {
  const domino = document.createElement("div");
  domino.className = "domino";

  const halfTop = document.createElement("div");
  halfTop.className = `half pips-${d.top}`;
  for (let i = 0; i < d.top; i++) {
    const pip = document.createElement("div");
    pip.className = "pip";
    halfTop.appendChild(pip);
  }

  const halfBot = document.createElement("div");
  halfBot.className = `half pips-${d.bot}`;
  for (let i = 0; i < d.bot; i++) {
    const pip = document.createElement("div");
    pip.className = "pip";
    halfBot.appendChild(pip);
  }

  domino.appendChild(halfTop);
  domino.appendChild(halfBot);
  return domino;
}

function renderReel(index, d) {
  const reel = reelEls[index];
  reel.innerHTML = "";
  if (d) reel.appendChild(createDominoElement(d));
}

// ============================================
// ПРОВЕРКИ ДОМИНО
// ============================================
function isDouble(d) {
  return d.top === d.bot;
}

// ============================================
// UI
// ============================================
function updateBalanceUI() {
  animateBalanceTo(balance);
}

function updateBetUI() {
  betDisplayEl.textContent = currentBet;
  quickBetBtns.forEach(btn => {
    const val = btn.dataset.bet;
    const isActive = (val === "all" && currentBet === balance)
      || (val !== "all" && Number(val) === currentBet);
    btn.classList.toggle("active", isActive);
  });
}

function updateBonusUI() {
  locksLeftEl.textContent = `${locksLeft}/${LOCKS_PER_ROUND}`;

  const lockedCount = reels.filter(r => r.locked).length;

  lockBtns.forEach(btn => {
    const i = Number(btn.dataset.reel);
    const r = reels[i];
    btn.classList.remove("active", "no-money");

    if (r.locked) {
      // Кнопка активна для снятия блокировки
      btn.textContent = "🔒";
      btn.classList.add("active");
      if (spinning)  { btn.disabled = true; return; }
      if (betLocked) { btn.disabled = true; return; }
      btn.disabled = false;
      return;
    }

    btn.textContent = "🔓";
    if (spinning)                 { btn.disabled = true; return; }
    if (betLocked)                { btn.disabled = true; return; }
    if (locksLeft <= 0)           { btn.disabled = true; return; }
    if (lockedCount >= MAX_LOCKS) { btn.disabled = true; return; }
    if (balance < LOCK_COST) {
      btn.disabled = true;
      btn.classList.add("no-money");
      return;
    }
    btn.disabled = false;
  });

  flipBtns.forEach(btn => {
    const i = Number(btn.dataset.reel);
    const r = reels[i];
    if (spinning)       { btn.disabled = true; return; }
    if (betLocked)      { btn.disabled = true; return; }
    if (!r.domino)      { btn.disabled = true; return; }
    btn.disabled = false;
  });

  const canRecalc = !spinning && !betLocked && recalcAvailable;
  recalcBtn.disabled = !canRecalc;
  recalcBtn.classList.toggle("ready", canRecalc);
}

function showResult(text, type = "info") {
  resultPanel.textContent = text;
  resultPanel.className = "result-panel " + type;
}

// ============================================
// СТАВКА
// ============================================
function setBet(value) {
  if (spinning) return;

  let newBet;
  if (value === "all") {
    newBet = balance;
  } else {
    newBet = Math.min(Number(value), balance);
  }
  if (newBet < 1) newBet = 1;

  if (newBet !== currentBet) {
    currentBet = newBet;
    betLocked = true;
    recalcAvailable = false;
    updateBetUI();
    updateBonusUI();
  }
}

// ============================================
// БЛОКИРОВКА / РАЗБЛОКИРОВКА БАРАБАНА
// ============================================
function toggleLock(index) {
  if (spinning) return;
  if (betLocked) {
    showResult("⚠️ Ставка изменена — допы недоступны до следующего спина", "info");
    Sound.error();
    return;
  }

  // --- Снятие блокировки (бесплатно) ---
  if (reels[index].locked) {
    reels[index].locked = false;
    reelEls[index].classList.remove("locked");

    if (locksLeft < LOCKS_PER_ROUND) locksLeft++;

    if (paidLockedPair && paidLockedPair.positions.includes(index)) {
      paidLockedPair = null;
    }

    // При снятии блокировки «Пересчёт» блокируется
    recalcAvailable = false;

    Sound.click();
    updateBonusUI();
    showResult(`🔓 Барабан ${index + 1} разблокирован (бесплатно)`, "info");
    return;
  }

  // --- Постановка блокировки ---
  if (locksLeft <= 0) {
    showResult("⚠️ Лимит блокировок исчерпан", "info");
    Sound.error();
    return;
  }
  if (balance < LOCK_COST) {
    showResult("💸 Недостаточно кредитов", "lose");
    Sound.error();
    return;
  }
  const lockedCount = reels.filter(r => r.locked).length;
  if (lockedCount >= MAX_LOCKS) {
    showResult("⚠️ Нельзя блокировать больше 2 барабанов", "info");
    Sound.error();
    return;
  }

  balance -= LOCK_COST;
  locksLeft--;
  reels[index].locked = true;
  reelEls[index].classList.add("locked");

  Sound.lock();
  updateBalanceUI();
  updateBonusUI();
  showResult(`🔒 Барабан ${index + 1} заблокирован (-${LOCK_COST} 💰)`, "info");
}

// ============================================
// ПЕРЕВОРОТ КОСТЯШКИ
// ============================================
function flipDomino(index) {
  if (spinning) return;
  if (betLocked) {
    showResult("⚠️ Ставка изменена — перевороты недоступны до следующего спина", "info");
    Sound.error();
    return;
  }
  if (!reels[index].domino) return;

  const d = reels[index].domino;
  const oldTop = d.top, oldBot = d.bot;
  [d.top, d.bot] = [d.bot, d.top];

  if (paidLockedPair && paidLockedPair.positions.includes(index)) {
    paidLockedPair = null;
  }

  const reelEl = reelEls[index];

  Sound.flip();
  reelEl.classList.add("flipping");

  setTimeout(() => {
    reelEl.classList.add("no-transition");
    void reelEl.offsetWidth;
    reelEl.classList.remove("flipping");
    void reelEl.offsetWidth;
    renderReel(index, d);
    requestAnimationFrame(() => {
      reelEl.classList.remove("no-transition");
    });
  }, FLIP_ANIM_MS);

  updateBonusUI();
  showResult(
    `🔄 [${oldTop}|${oldBot}] перевёрнута → [${d.top}|${d.bot}]`,
    "info"
  );
}

// ============================================
// ПОДСЧЁТ ВЫИГРЫША
// ============================================
function calculateWin(ds, bet, ctx = {}) {
  const { hadLock = false } = ctx;
  const [a, b, c] = ds;
  const id = (d) => `${d.top}-${d.bot}`;

  // 1. Три разных дубля → x5
  if (isDouble(a) && isDouble(b) && isDouble(c)
      && a.top !== b.top && b.top !== c.top && a.top !== c.top) {
    const signature = `DDD:${id(a)}|${id(b)}|${id(c)}`;
    if (hadLock && paidLine === signature) {
      return { win: 0, message: `💎 ТРИ РАЗНЫХ ДУБЛЯ — уже оплачено`, type: "info", highlight: [], signature, kind: null };
    }
    return {
      win: bet * MULT_THREE_DIFFERENT_DOUBLES,
      message: `💎 ТРИ РАЗНЫХ ДУБЛЯ: [${a.top}|${a.bot}] [${b.top}|${b.bot}] [${c.top}|${c.bot}] → +${bet * MULT_THREE_DIFFERENT_DOUBLES} (x${MULT_THREE_DIFFERENT_DOUBLES})`,
      type: "win",
      highlight: [0, 1, 2],
      signature,
      kind: "jackpot",
    };
  }

  // 2. Дубль в центре → x4
  if (isDouble(b) && a.bot === b.top && b.bot === c.top) {
    const x = b.top;
    const signature = `CD:${id(a)}|${id(b)}|${id(c)}`;
    if (hadLock && paidLine === signature) {
      return { win: 0, message: `🔷 ДУБЛЬ В ЦЕНТРЕ [${x}|${x}] — уже оплачено`, type: "info", highlight: [], signature, kind: null };
    }
    return {
      win: bet * MULT_CENTER_DOUBLE,
      message: `🔷 ДУБЛЬ В ЦЕНТРЕ [${x}|${x}]: [${a.top}|${a.bot}] → [${b.top}|${b.bot}] → [${c.top}|${c.bot}] → +${bet * MULT_CENTER_DOUBLE} (x${MULT_CENTER_DOUBLE})`,
      type: "win",
      highlight: [0, 1, 2],
      signature,
      kind: "center",
    };
  }

  // 3. Дубли по краям → x4
  if (isDouble(a) && isDouble(c)
      && a.top !== c.top
      && b.top === a.top && b.bot === c.top) {
    const signature = `ED:${id(a)}|${id(b)}|${id(c)}`;
    if (hadLock && paidLine === signature) {
      return { win: 0, message: `🔶 ДУБЛИ ПО КРАЯМ — уже оплачено`, type: "info", highlight: [], signature, kind: null };
    }
    return {
      win: bet * MULT_EDGE_DOUBLES,
      message: `🔶 ДУБЛИ ПО КРАЯМ: [${a.top}|${a.bot}] → [${b.top}|${b.bot}] → [${c.top}|${c.bot}] → +${bet * MULT_EDGE_DOUBLES} (x${MULT_EDGE_DOUBLES})`,
      type: "win",
      highlight: [0, 1, 2],
      signature,
      kind: "edges",
    };
  }

  // 4. Линия из 3 → x3
  const joint1 = (a.bot === b.top);
  const joint2 = (b.bot === c.top);
  if (joint1 && joint2) {
    const signature = `3:${id(a)}|${id(b)}|${id(c)}`;
    if (hadLock && paidLine === signature) {
      return { win: 0, message: `🎉 ЛИНИЯ ИЗ 3 — уже оплачено`, type: "info", highlight: [], signature, kind: null };
    }
    return {
      win: bet * MULT_FULL_LINE,
      message: `🎉 ЛИНИЯ ИЗ 3: [${a.top}|${a.bot}] → [${b.top}|${b.bot}] → [${c.top}|${c.bot}] → +${bet * MULT_FULL_LINE} (x${MULT_FULL_LINE})`,
      type: "win",
      highlight: [0, 1, 2],
      signature,
      kind: "line",
    };
  }

  // 5. Линия из 2 → x2
  if (joint1 || joint2) {
    let indices, text, signature;
    if (joint1) {
      indices = [0, 1];
      text = `[${a.top}|${a.bot}] → [${b.top}|${b.bot}]`;
      signature = `2L:${id(a)}|${id(b)}`;
    } else {
      indices = [1, 2];
      text = `[${b.top}|${b.bot}] → [${c.top}|${c.bot}]`;
      signature = `2R:${id(b)}|${id(c)}`;
    }

    if (paidLockedPair && paidLockedPairStillValid()) {
      if (paidLockedPair.signature === signature) {
        return {
          win: 0,
          message: `✨ ЛИНИЯ ИЗ 2 — уже оплачено`,
          type: "info",
          highlight: [],
          signature,
          kind: null,
        };
      }
    }

    if (hadLock && paidLine === signature) {
      return { win: 0, message: `✨ ЛИНИЯ ИЗ 2 — уже оплачено`, type: "info", highlight: [], signature, kind: null };
    }

    return {
      win: bet * MULT_PAIR_LINE,
      message: `✨ ЛИНИЯ ИЗ 2 (${text}) → +${bet * MULT_PAIR_LINE} монет (x${MULT_PAIR_LINE})`,
      type: "win",
      highlight: indices,
      signature,
      kind: "pair",
    };
  }

  // 6. Проигрыш
  return {
    win: 0,
    message: `😢 Не повезло... -${bet} монет`,
    type: "lose",
    highlight: [],
    signature: null,
    kind: null,
  };
}

// ---- Звук на исход ----
function playOutcomeSound(outcome) {
  if (outcome.win <= 0) {
    if (outcome.type === "lose") Sound.lose();
    return;
  }
  switch (outcome.kind) {
    case "jackpot": Sound.jackpot(); break;
    case "center":  Sound.winCenter(); break;
    case "edges":   Sound.winEdges(); break;
    case "line":    Sound.winLine(); break;
    case "pair":    Sound.winPair(); break;
  }
}

// ---- Визуальные эффекты ----
function clearHighlight() {
  reelEls.forEach(r => r.classList.remove(
    "connected", "pair", "line", "jackpot", "center", "edges"
  ));
}

function applyHighlight(outcome) {
  clearHighlight();
  if (outcome.win <= 0) return;
  outcome.highlight.forEach(i => {
    reelEls[i].classList.add("connected");
    if (outcome.kind) reelEls[i].classList.add(outcome.kind);
  });
}

function playOutcomeFx(outcome) {
  if (outcome.win <= 0) {
    if (outcome.type === "lose") {
      machineEl.classList.remove("sink");
      void machineEl.offsetWidth;
      machineEl.classList.add("sink");
    }
    return;
  }

  const winEls = outcome.highlight.map(i => reelEls[i]);

  switch (outcome.kind) {
    case "pair":    FX.winPair(winEls); break;
    case "line":    FX.winLine(winEls); break;
    case "center":  FX.winCenter(winEls); break;
    case "edges":   FX.winEdges(winEls); break;
    case "jackpot":
      FX.jackpot(winEls);
      flashEl.classList.remove("on");
      void flashEl.offsetWidth;
      flashEl.classList.add("on");
      machineEl.classList.remove("shake");
      void machineEl.offsetWidth;
      machineEl.classList.add("shake");
      break;
  }

  if (outcome.highlight.length === 3) {
    triggerSparks();
  }
}

function triggerSparks() {
  sparkEls.forEach(el => {
    el.classList.remove("on");
    void el.offsetWidth;
    el.classList.add("on");
  });
  const r0 = reelEls[0].getBoundingClientRect();
  const r1 = reelEls[1].getBoundingClientRect();
  const r2 = reelEls[2].getBoundingClientRect();
  FX.sparkAt(r0.right, r0.top + r0.height / 2);
  FX.sparkAt(r1.left,  r1.top + r1.height / 2);
  FX.sparkAt(r1.right, r1.top + r1.height / 2);
  FX.sparkAt(r2.left,  r2.top + r2.height / 2);
}

// ============================================
// ОСНОВНОЙ СПИН
// ============================================
async function spin() {
  if (spinning) return;

  if (currentBet > balance || currentBet <= 0) {
    showResult("❌ Некорректная ставка", "lose");
    Sound.error();
    return;
  }

  spinning = true;
  spinBtn.disabled = true;
  recalcBtn.disabled = true;
  recalcBtn.classList.remove("ready");
  updateBonusUI();

  try {
    balance -= currentBet;
    updateBalanceUI();
    Sound.spinStart();

    betLocked = false;
    recalcAvailable = true;
    currentSpinWin = 0;

    clearHighlight();
    reelEls.forEach(r => r.classList.remove(
      "win", "spinning", "settle", "dim", "neighbor"
    ));

    const spinIndices = [];
    for (let i = 0; i < 3; i++) {
      if (!reels[i].locked) spinIndices.push(i);
    }

    if (spinIndices.length === 0) {
      showResult("⚠️ Все барабаны заблокированы — спин пропущен", "info");
      Sound.error();
      return;
    }

    reelEls.forEach((el, i) => {
      if (reels[i].locked) el.classList.add("neighbor");
      else el.classList.add("dim");
    });

    const usedKeys = new Set();
    reels.forEach(r => {
      if (r.locked && r.domino) {
        usedKeys.add(`${r.domino.top}-${r.domino.bot}`);
      }
    });

    const finalDominoes = {};
    const pool = DOMINO_SET.filter(d => !usedKeys.has(`${d.top}-${d.bot}`));
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    spinIndices.forEach((reelIdx, k) => {
      finalDominoes[reelIdx] = { ...pool[k] };
    });

    spinIndices.forEach(i => reelEls[i].classList.add("spinning"));

    let stillSpinning = [...spinIndices];

    const spinStartTime = performance.now();
    const totalSpinMs = STOP_DELAY_MS + (spinIndices.length - 1) * STOP_STAGGER_MS + 200;

    const spinInterval = setInterval(() => {
      stillSpinning.forEach(i => {
        renderReel(i, pickDomino());
      });
      const elapsed = performance.now() - spinStartTime;
      const progress = Math.min(1, elapsed / totalSpinMs);
      Sound.reelTick(progress);
    }, SPIN_TICK_MS);

    for (let k = 0; k < spinIndices.length; k++) {
      const i = spinIndices[k];
      await sleep(STOP_DELAY_MS + k * STOP_STAGGER_MS);

      const d = finalDominoes[i];
      reels[i].domino = d;
      stillSpinning = stillSpinning.filter(idx => idx !== i);

      renderReel(i, d);
      reelEls[i].classList.remove("spinning", "dim", "neighbor");
      reelEls[i].classList.add("settle");
      Sound.reelStop();

      setTimeout(() => reelEls[i].classList.remove("settle"), 400);
    }

    clearInterval(spinInterval);

    await sleep(200);

    const hadLock = reels.some(r => r.locked);
    const lockedPair = getLockedAdjacentPair();
    const ds = reels.map(r => r.domino);
    const outcome = calculateWin(ds, currentBet, { hadLock });

    if (outcome.win > 0 && outcome.kind === "pair" && lockedPair) {
      paidLockedPair = {
        signature: outcome.signature,
        positions: [...lockedPair],
        dominoes: [
          { ...reels[lockedPair[0]].domino },
          { ...reels[lockedPair[1]].domino },
        ],
      };
    }

    if (paidLockedPair && !paidLockedPairStillValid()) {
      paidLockedPair = null;
    }

    if (outcome.win > 0) {
      paidLine = outcome.signature;
    }

    applyHighlight(outcome);

    setTimeout(() => {
      playOutcomeSound(outcome);
      playOutcomeFx(outcome);
    }, 80);

    balance += outcome.win;
    currentSpinWin = outcome.win;
    updateBalanceUI();

    // Блокировки НЕ снимаются после спина — они живут, пока игрок сам не снимет

    showResult(
      outcome.message +
      `\n🎁 Допы доступны. Можно перевернуть костяшки и нажать «Пересчёт» один раз.`,
      outcome.type
    );

    if (balance <= 0) {
      setTimeout(() => {
        gameOverEl.classList.add("show");
        Sound.gameOver();
      }, 800);
    }
  } catch (err) {
    console.error("Ошибка в spin():", err);
    showResult("⚠️ Что-то пошло не так, попробуйте ещё раз", "info");
  } finally {
    spinning = false;
    spinBtn.disabled = false;
    updateBonusUI();
  }
}

// ============================================
// ПЕРЕСЧЁТ
// ============================================
function recalc() {
  if (spinning) return;
  if (betLocked) {
    showResult("⚠️ Ставка изменена — пересчёт недоступен до следующего спина", "info");
    Sound.error();
    return;
  }
  if (!recalcAvailable) {
    showResult("⚠️ Пересчёт уже использован в этом спине", "info");
    Sound.error();
    return;
  }

  try {
    const lockedPair = getLockedAdjacentPair();

    if (currentSpinWin > 0) {
      balance -= currentSpinWin;
      currentSpinWin = 0;
    }

    let outcome;

    if (lockedPair) {
      outcome = {
        win: 0,
        message: `Бараны ${humanPair(lockedPair)} заблокированы, выигрыш не начислен`,
        type: "info",
        highlight: [],
        signature: null,
        kind: null,
      };
    } else {
      const hadLock = reels.some(r => r.locked);
      const ds = reels.map(r => r.domino);
      outcome = calculateWin(ds, currentBet, { hadLock });

      if (outcome.win > 0) {
        paidLine = outcome.signature;
      }
    }

    applyHighlight(outcome);

    setTimeout(() => {
      if (outcome.win > 0) {
        playOutcomeSound(outcome);
      } else {
        Sound.recalc();
      }
      playOutcomeFx(outcome);
    }, 60);

    balance += outcome.win;
    currentSpinWin = outcome.win;
    updateBalanceUI();

    showResult(outcome.message, outcome.type);
  } catch (err) {
    console.error("Ошибка в recalc():", err);
    showResult("⚠️ Что-то пошло не так, попробуйте ещё раз", "info");
  } finally {
    recalcAvailable = false;
    updateBonusUI();
  }
}

// ============================================
// ПЕРЕЗАПУСК
// ============================================
function restartGame() {
  balance      = START_BALANCE;
  currentBet   = DEFAULT_BET;
  spinning     = false;
  locksLeft    = LOCKS_PER_ROUND;
  paidLine     = null;
  betLocked    = false;
  recalcAvailable = false;
  currentSpinWin  = 0;
  paidLockedPair  = null;

  reels = [
    { domino: null, locked: false },
    { domino: null, locked: false },
    { domino: null, locked: false },
  ];

  reelEls.forEach(r => {
    r.innerHTML = "";
    r.classList.remove(
      "win", "connected", "spinning", "locked", "settle",
      "flipping", "no-transition",
      "pair", "line", "jackpot", "center", "edges", "dim", "neighbor"
    );
  });

  displayedBalance = balance;
  updateBalanceUI();
  updateBetUI();
  updateBonusUI();
  showResult("Новая игра! Нажмите «КРУТИТЬ» 🎲", "info");
}

// ============================================
// СЛУШАТЕЛИ
// ============================================
spinBtn.addEventListener("click", spin);
recalcBtn.addEventListener("click", recalc);

restartBtn.addEventListener("click", () => {
  gameOverEl.classList.remove("show");
  Sound.click();
  restartGame();
});

lockBtns.forEach(btn => {
  btn.addEventListener("click", () => toggleLock(Number(btn.dataset.reel)));
});

flipBtns.forEach(btn => {
  btn.addEventListener("click", () => flipDomino(Number(btn.dataset.reel)));
});

quickBetBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    setBet(btn.dataset.bet);
    Sound.bet();
  });
});

// ============================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================
displayedBalance = balance;
updateBalanceUI();
updateBetUI();
updateBonusUI();
showResult("Нажмите «КРУТИТЬ», чтобы начать! 🎲", "info");