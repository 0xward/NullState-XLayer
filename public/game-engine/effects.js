/* ============================================================
   NULL_STATE :: EFFECTS  (Phase 5)
   Hit-stop, enhanced screen shake, floating damage numbers
   (extended), particle bursts, and visual polish helpers.
   ============================================================ */

// ---- Hit-Stop -----------------------------------------------
// Pauses all game-logic updates for a brief moment on impact,
// giving hits that satisfying 'weight'. Does NOT pause rendering.
const HitStop = (() => {
  let _remaining = 0; // seconds left to freeze

  return {
    /** Trigger a freeze of `duration` seconds (clamped to running max). */
    trigger(duration) {
      _remaining = Math.max(_remaining, duration || 0);
    },
    /** Call every frame BEFORE the game-logic tick.
     *  Returns true if the frame should be skipped (frozen). */
    tick(dt) {
      if (_remaining <= 0) return false;
      _remaining -= dt;
      if (_remaining < 0) _remaining = 0;
      return _remaining > 0;
    },
    /** How many seconds are left (0 = not frozen). */
    get remaining() { return _remaining; },
    reset() { _remaining = 0; },
  };
})();

// ---- Damage-scaled hit-stop helper --------------------------
/**
 * Compute and trigger a hit-stop based on damage dealt.
 * Uses MONSTER_FLOOR_CONFIG.hitStop thresholds if available.
 */
function triggerHitStopForDmg(dmg, isBoss = false) {
  const cfg = (window.NS_MONSTER_CONFIG || {}).hitStop || {
    minDmg: 5, maxDmg: 80, minDur: 0.04, maxDur: 0.16, bossMul: 1.5,
  };
  if (dmg < cfg.minDmg) return;
  const t = Math.min(1, (dmg - cfg.minDmg) / (cfg.maxDmg - cfg.minDmg));
  let dur = cfg.minDur + t * (cfg.maxDur - cfg.minDur);
  if (isBoss) dur *= cfg.bossMul;
  HitStop.trigger(dur);
}

// ---- Enhanced Floating Damage Numbers -----------------------
/**
 * Extended damage-number renderer. Call instead of the inline
 * dmgNums array push when you want richer visuals.
 *
 * Params: (dmgNums[], x, y, val, opts)
 *   opts.crit    — boolean, makes the number larger + gold
 *   opts.heal    — boolean, green color scheme
 *   opts.boss    — boolean, extra large + red
 *   opts.color   — override CSS color string
 */
function pushDmgNum(dmgNums, x, y, val, opts = {}) {
  let color = opts.color || null;
  let scale = 1;
  let vy    = -52;

  if (opts.crit)  { color = '#ffe04b'; scale = 1.55; vy = -72; }
  if (opts.heal)  { color = '#5dde7a'; scale = 1.2; }
  if (opts.boss)  { color = '#ff3b5c'; scale = 1.8; vy = -80; }

  // Slight random horizontal spread so stacked hits don't overlap.
  const vx = (Math.random() - 0.5) * 28;

  dmgNums.push({ x, y, val, life: 1.1, crit: opts.crit || false,
                 vy, vx: vx || 0, scale, color });
}

// ---- Particle Presets ---------------------------------------
/**
 * Burst of `count` particles from (x, y) in a ring.
 * Appends to the game's G.particles array.
 */
function particleBurst(particles, x, y, color, count = 10, speed = 160) {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const s = speed * (0.7 + Math.random() * 0.6);
    particles.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - 40,
      life: 0.4 + Math.random() * 0.4,
      max:  0.8,
      color,
      r: 3 + Math.random() * 3,
    });
  }
}

/**
 * Upward spark shower (e.g. on landing or heavy stomp).
 */
function particleShower(particles, x, y, color, count = 16, speed = 130) {
  for (let i = 0; i < count; i++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.4;
    const s = speed * (0.6 + Math.random() * 0.8);
    particles.push({
      x: x + (Math.random() - 0.5) * 20,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: 0.5 + Math.random() * 0.5,
      max:  1.0,
      color,
      r: 2 + Math.random() * 2.5,
    });
  }
}

// ---- Render extension: draw enhanced dmgNums ----------------
/**
 * Drop-in replacement for the dmgNums render loop in game.js.
 * Handles vx, scale, and color fields added by pushDmgNum().
 * Falls back gracefully if those fields are absent (legacy entries).
 */
function renderDmgNums(ctx, dmgNums, cam, zoom) {
  for (const n of dmgNums) {
    const alpha = Math.min(1, n.life * 2.2);
    const sc    = n.scale || 1;
    const sz    = (n.crit ? 22 : 15) * sc;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font         = `bold ${sz}px 'Press Start 2P', monospace`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    // Shadow for readability.
    ctx.shadowColor  = 'rgba(0,0,0,0.75)';
    ctx.shadowBlur   = 4;
    // Color priority: explicit > crit gold > white.
    ctx.fillStyle    = n.color || (n.crit ? '#ffe04b' : '#ffffff');
    ctx.fillText(String(n.val), n.x, n.y);
    ctx.restore();
  }
}

// ---- Particle render (tick + draw, replaces inline loop) ----
/**
 * Advance and draw all particles in G.particles.
 * Call each frame with the raw canvas context (already translated
 * to world space, before the ctx.save/translate in game.js).
 */
function tickAndRenderParticles(ctx, particles, dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x  += p.vx * dt;
    p.y  += p.vy * dt;
    p.vy += 200 * dt; // gravity
    p.life -= dt;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    const alpha = Math.min(1, p.life / (p.max || 0.8));
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle   = p.color || '#ffffff';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r || 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ---- Expose globally ----------------------------------------
if (typeof window !== 'undefined') {
  window.NS_FX = {
    HitStop,
    triggerHitStopForDmg,
    pushDmgNum,
    particleBurst,
    particleShower,
    renderDmgNums,
    tickAndRenderParticles,
  };
}
