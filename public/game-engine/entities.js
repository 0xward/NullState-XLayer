/* ============================================================
   NULL_STATE :: ENTITIES  (sprite animator + Player + Enemy)
   World coords: (x,y) = entity CENTER. y grows downward.
   ============================================================ */
const imgGet = window.NS_ASSETS.img;

// One-time-per-key console warning helper (Issue 5 diagnostic, session v49).
// Prevents the weapon-render diagnostics below from spamming the console
// every single frame (draw() runs ~60x/sec) — each distinct problem logs
// exactly once per page load.
const _warnedKeys = new Set();
function _warnOnce(key, msg){
  if(_warnedKeys.has(key)) return;
  _warnedKeys.add(key);
  console.warn(msg);
}

// Shared scratch canvas for masked tint overlays (e.g. Frost Spear's slow
// tint on Enemy). A plain `ctx.globalCompositeOperation='source-atop'`
// fillRect drawn straight onto the main game canvas would composite against
// WHATEVER is already painted there this frame (floor tiles, decor, other
// enemies) — not just this sprite's own silhouette — because the main
// canvas has no per-entity alpha boundary. Drawing the sprite frame into
// this small offscreen canvas first, tinting THAT with source-atop, then
// stamping the result back onto the main canvas keeps the tint confined to
// the sprite's actual drawn pixels. Reused across all enemies/frames (one
// draw call is synchronous, so no cross-entity clobbering).
let _tintCanvas=null, _tintCtx=null;
function _getTintCtx(w, h){
  if(!_tintCanvas){ _tintCanvas=document.createElement('canvas'); _tintCtx=_tintCanvas.getContext('2d'); }
  const iw=Math.max(1,Math.ceil(w)), ih=Math.max(1,Math.ceil(h));
  if(_tintCanvas.width!==iw || _tintCanvas.height!==ih){ _tintCanvas.width=iw; _tintCanvas.height=ih; }
  else _tintCtx.clearRect(0,0,iw,ih);
  return _tintCtx;
}
// v77: separate scratch canvas for the armor tint/glow pass, so it never
// stomps the _tintCanvas the corrupted-enemy silhouette tint is using in the
// same frame.
let _armorCanvas=null, _armorCtx=null;
function _getArmorCtx(w, h){
  if(!_armorCanvas){ _armorCanvas=document.createElement('canvas'); _armorCtx=_armorCanvas.getContext('2d'); }
  const iw=Math.max(1,Math.ceil(w)), ih=Math.max(1,Math.ceil(h));
  if(_armorCanvas.width!==iw || _armorCanvas.height!==ih){ _armorCanvas.width=iw; _armorCanvas.height=ih; }
  else _armorCtx.clearRect(0,0,iw,ih);
  return _armorCtx;
}

// generic frame-sheet animator
class Anim {
  constructor(){ this.cfg=null; this.frame=0; this.t=0; this.done=false; this.key=null; }
  set(cfg, key){
    if(this.key===key) return;
    this.key=key; this.cfg=cfg; this.frame=0; this.t=0; this.done=false;
  }
  update(dt){
    if(!this.cfg) return;
    const fps=this.cfg.fps||9;
    this.t+=dt;
    if(this.t >= 1/fps){
      this.t=0; this.frame++;
      if(this.frame>=this.cfg.frames){
        if(this.loop===false){ this.frame=this.cfg.frames-1; this.done=true; }
        else this.frame=0;
      }
    }
  }
  draw(ctx, cx, cy, scale, flip, footY=0.92, alpha=1){
    if(!this.cfg){
      // No animation config set at all (should only ever happen for a
      // single frame right after construction) — never silently render
      // nothing, since that previously made entities (including the
      // player) vanish with zero visible trace and no error.
      ctx.save();
      ctx.globalAlpha=alpha*0.6;
      ctx.fillStyle='#5c8a78';
      ctx.beginPath(); ctx.ellipse(cx, cy-14, 12, 18, 0, 0, Math.PI*2); ctx.fill();
      ctx.restore();
      return;
    }
    const im=imgGet(this.cfg.src);
    if(!im){
      // Sprite not loaded yet (or failed to load) — draw a simple visible
      // placeholder instead of nothing. Silently skipping the draw here
      // used to mean an entity (including the player) could vanish
      // completely off-screen with no error and no indication why; a
      // rough silhouette at least keeps them visible/trackable and makes
      // a real asset-loading problem obvious instead of invisible.
      ctx.save();
      ctx.globalAlpha=alpha*0.6;
      ctx.fillStyle='#5c8a78';
      ctx.beginPath(); ctx.ellipse(cx, cy-14, 12, 18, 0, 0, Math.PI*2); ctx.fill();
      ctx.restore();
      return;
    }
    const {fw,fh}=this.cfg;
    const dw=fw*scale, dh=fh*scale;
    const dx=cx-dw/2;
    const dy=cy-dh*footY;          // feet anchored near cy
    ctx.save();
    ctx.globalAlpha=alpha;
    if(flip){ ctx.translate(cx,0); ctx.scale(-1,1); ctx.translate(-cx,0); }
    ctx.imageSmoothingEnabled=false;
    ctx.drawImage(im, this.frame*fw,0,fw,fh, dx,dy,dw,dh);
    ctx.restore();
  }
}

// Chunky pixel-art arc: stamps square "pixels" along an arc so attack
// slashes read as hand-drawn pixel animation frames rather than smooth
// vector strokes. Works for either sweep direction (a0 > a1 is fine).
// v67 T11: tiny hex mixer for weapon-colored attack FX. _fxWhite(c, t)
// returns c blended toward white by t (0..1) — used for the bright leading
// edge of a slash so a purple weapon reads as purple slash + pale-purple
// highlight instead of one flat blob. Non-#rrggbb input falls through as-is.
function _hexMix(a, b, t){
  const pa=/^#([0-9a-f]{6})$/i.exec(a), pb=/^#([0-9a-f]{6})$/i.exec(b);
  if(!pa || !pb) return a;
  const ai=parseInt(pa[1],16), bi=parseInt(pb[1],16);
  const ch=(sh)=>Math.round(((ai>>sh)&255)+(((bi>>sh)&255)-((ai>>sh)&255))*t);
  return '#'+((1<<24)|(ch(16)<<16)|(ch(8)<<8)|ch(0)).toString(16).slice(1);
}
function _fxWhite(c, t){ return _hexMix(c, '#ffffff', t); }

function pixelArc(ctx,cx,cy,r,a0,a1,px,color,alpha){
  ctx.fillStyle=color;
  const steps=Math.max(5, (Math.abs(a1-a0)*r/px)|0);
  for(let i=0;i<=steps;i++){
    const a=a0+(a1-a0)*i/steps;
    ctx.globalAlpha=alpha*(0.45+0.55*Math.sin(Math.PI*i/steps));
    ctx.fillRect(Math.round(cx+Math.cos(a)*r-px/2), Math.round(cy+Math.sin(a)*r-px/2), px, px);
  }
  ctx.globalAlpha=1;
}

// ============================================================
// LPC compositing engine (Phase 5.3 Task 5). Draws body + armor +
// weapon as direct-stacked layers at a given (cx,cy). Used by BOTH the
// animated in-dungeon Player.draw() (see useLPCHero below) and the
// static outdoor title-screen preview (drawPreview() in game.js) so
// the two can never drift out of sync.
// Verified this session: armor parts AND weapon overlays are
// pre-aligned to the body's own grid in every LPC animation folder, so
// this is pure direct-stack — no anchor/rotation math needed anywhere
// (that was the original plan; corrected after a real composite test).
// ------------------------------------------------------------
function lpcDirFromVec(x, y){
  // LPC_DIRS order: 0=up 1=left 2=down 3=right
  if(Math.abs(x) >= Math.abs(y)) return x<0 ? 1 : 3;
  return y<0 ? 0 : 2;
}
// ---------------------------------------------------------------------------
// WEAPON_MOTION — v76 Task #7. Procedural per-weapon attack animation.
// ---------------------------------------------------------------------------
// Each entry maps attack progress p (0..1 across the 0.42s swing) to how the
// weapon is posed THIS frame, relative to the aim direction:
//   ang   radians offset from "tip pointing straight at the target".
//         negative = wound up behind the hero, positive = followed through past.
//   push  how far along the aim the grip slides, in body-frame units.
//   lift  perpendicular grip slide (screen-space, + = toward the hero's right).
// The hit lands at p≈0.24-0.71 (hitZone() window 0.10-0.30s of 0.42s), so every
// motion is tuned to have the blade crossing the target inside that window
// rather than looking like it connects on the wind-up.
// `sweep` = ease curve; slow wind-up + fast strike reads heavier than linear.
function _easeStrike(p){ return p<0.42 ? (p/0.42)*(p/0.42)*0.34 : 0.34+0.66*(1-Math.pow(1-(p-0.42)/0.58,2)); }
function _easeSnap(p){ return 1-Math.pow(1-p,3); }
// v76 T#7 (calibrated). Each fn returns {ang,push,lift}. The renderer sets the
// weapon's screen angle to  aimAng + PI/2 + ang, and the sprite art points UP,
// so `ang` is the lean of the TIP away from the aim direction:
//   ang = 0     -> tip points exactly at the target
//   ang < 0     -> tip leans clockwise of the aim (wind-up / trailing)
//   ang > 0     -> tip leans counter-clockwise
// Verified numerically (see build notes): every motion now passes through
// ang~=0 inside the strike window (p 0.35-0.65) so the business end is on the
// enemy when the hit lands, then follows through past it. `push` slides the
// grip along the aim (+ = toward the enemy), `lift` perpendicular to it.
const WEAPON_MOTION = {
  // light sword: ~150 deg arc that sweeps THROUGH the aim at mid-strike
  slash:    p => ({ ang:  1.30 - 2.70*_easeStrike(p), push: 2 + 6*Math.sin(Math.PI*p), lift: 0 }),
  // katana iaido: near-instant draw-cut snapping onto the aim, holds follow-through
  iai:      p => ({ ang:  1.55 - 2.05*_easeSnap(Math.min(1, p*1.9)), push: 3 + 10*Math.sin(Math.PI*Math.min(1,p*1.6)), lift: 0 }),
  // axe / maul: heavy overhead — reared back behind the head, then chops down onto aim
  chop:     p => ({ ang:  1.75 - 2.65*_easeStrike(p), push: 1 + 8*_easeStrike(p), lift: -2 + 4*_easeStrike(p) }),
  // scythe: very wide reap that carries well past the aim on both sides
  reap:     p => ({ ang:  2.30 - 4.40*_easeStrike(p), push: 3 + 7*Math.sin(Math.PI*p), lift: 0 }),
  // spear: no arc — the point stays locked on the aim, the shaft drives forward
  thrust:   p => ({ ang:  0.0, push: -4 + 22*Math.sin(Math.PI*Math.min(1, p*1.15)), lift: 0 }),
  // longbow: held on aim, string-release recoil kicks the bow back a touch
  bow:      p => ({ ang: 0, push: (p<0.30 ? -1.5*p/0.30 : -1.5 + 5.5*_easeSnap((p-0.30)/0.70)), lift: 0 }),
  // crossbow: braced, sharper and shorter kick than the bow
  crossbow: p => ({ ang: 0, push: (p<0.24 ? 0 : -3.2*Math.exp(-((p-0.24)*7))+3.2), lift: 0 }),
};

// Cache of tinted weapon sprites, keyed src+colour. Same masked-tint trick as
// _maskSprite() in props.js (v75): tint only the sprite's own pixels via
// source-atop so a premium weapon's glow never squares off into a coloured box.
const _wpnTintCache = {};
function _tintedWeapon(im, src, col, amt){
  const key = src + '|' + col + '|' + amt;
  let c = _wpnTintCache[key];
  if(c) return c;
  try{
    c = document.createElement('canvas');
    c.width = im.width; c.height = im.height;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(im, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    g.globalAlpha = amt;
    g.fillStyle = col;
    g.fillRect(0, 0, c.width, c.height);
  }catch(e){ c = im; }
  _wpnTintCache[key] = c;
  return c;
}

// ---------------------------------------------------------------------------
// v79 — ULPC weapon ANIMATION overlays (owner decision, option A).
// ---------------------------------------------------------------------------
// The pinned-icon model (drawWeaponLayer below) never read as "held": a static
// sprite rotated at an anchor point always looks glued on, because no single
// anchor matches where the artist drew the hands frame by frame. The ULPC
// generator ships per-weapon sheets drawn AGAINST THIS EXACT BODY RIG — walk
// carry and attack swing, split into a foreground layer (in front of the body)
// and a background layer (occluded by the body). Stacking bg -> body/armor ->
// fg, frame-matched, puts the weapon in the hero's grip in every frame of
// every direction (per-frame union verified via PIL for all 9 weapons).
// The icon path below is kept ONLY as a decode-race fallback.
//
// Draw one overlay layer. Sheets: 4 direction rows (LPC order), cell =
// height/4 — 64 regular, 128/192 oversize with the 64px body cell centered
// inside (LPC oversize convention), columns = frames of the matching body anim.
// Returns false if the sheet image hasn't decoded yet.
function _drawWpnOvlLayer(dctx, src, f, dirIndex, dx, dy, dw, dh, wDef, attacking, p, tintCol, glowOv, evo){
  const A = window.NS_ASSETS;
  const im = A.img(src);
  if(!im) return false;
  const cell = Math.floor(im.height/4);
  const cols = Math.floor(im.width/cell) || 1;
  if(f >= cols) return true;         // canvas wider than this anim: blank column
  const u = dw/64, pad = (cell-64)/2;
  const ddx = dx - pad*u, ddy = dy - pad*u, dds = cell*u;
  const sx = f*cell, sy = dirIndex*cell;
  dctx.save();
  dctx.imageSmoothingEnabled = false;
  // Premium aura — an additive halo of the glow colour under the sprite,
  // breathing while carried, flaring on strike. Phase 6 (weapon evolution): an
  // evolved weapon supplies glowOv (its tier's glowOverride) so even a base
  // weapon with no NS_WEAPON.glow lights up once leveled, and the halo burns
  // brighter + blooms a wider ring per evolution tier (evo 1..3).
  const _glowCol = glowOv || (wDef && wDef.glow) || null;
  if(_glowCol){
    const t = (window.NS_now ? window.NS_now() : (performance.now()/1000));
    const pulse = 0.7 + 0.3*Math.sin(t*2.4);
    const flare = attacking ? (0.6 + 0.8*Math.sin(Math.PI*Math.min(1, p||0))) : 0;
    const _evo = Math.max(1, evo || 1);
    const _evoBoost = 1 + (_evo - 1) * 0.5;            // 1, 1.5, 2
    const glowA = Math.min(1, (0.42*pulse + flare*0.6) * _evoBoost);
    const halo = _tintedWeapon(im, src, _glowCol, 1.0);
    // Higher evolution tiers add wider, fainter outer offsets — a neon bloom.
    const ring = (_evo >= 3)
      ? [[0,0,1],[-1,0,0.75],[1,0,0.75],[0,-1,0.75],[0,1,0.75],[-2,0,0.5],[2,0,0.5],[0,-2,0.5],[0,2,0.5],[-3,0,0.28],[3,0,0.28],[0,-3,0.28],[0,3,0.28]]
      : (_evo >= 2)
      ? [[0,0,1],[-1,0,0.72],[1,0,0.72],[0,-1,0.72],[0,1,0.72],[-2,0,0.45],[2,0,0.45],[0,-2,0.45],[0,2,0.45]]
      : [[0,0,1],[-1,0,0.7],[1,0,0.7],[0,-1,0.7],[0,1,0.7],[-2,0,0.4],[2,0,0.4],[0,-2,0.4],[0,2,0.4]];
    dctx.save();
    dctx.globalCompositeOperation = 'lighter';
    for(const [ox,oy,a] of ring){
      dctx.globalAlpha = glowA*a;
      dctx.drawImage(halo, sx, sy, cell, cell, ddx+ox, ddy+oy, dds, dds);
    }
    dctx.restore();
  }
  // v80: masked colour wash so the in-hand weapon matches the marketplace
  // icon's palette (ovlTint per weapon in assets.js). An explicit tintCol
  // (e.g. the frost slow-tell) still wins over the cosmetic icon tint.
  const eTint = tintCol || (wDef && wDef.ovlTint) || null;
  const eAmt  = tintCol ? 0.55 : ((wDef && wDef.ovlTintA != null) ? wDef.ovlTintA : 0.3);
  const srcIm = eTint ? _tintedWeapon(im, src, eTint, eAmt) : im;
  // v80 swing polish: motion-trail afterimages — the two previous overlay
  // frames ghosted under the live one read as motion blur, no new art needed.
  if(attacking){
    const baseA = dctx.globalAlpha;
    for(const [back, ga] of [[2,0.14],[1,0.32]]){
      const pf = f - back;
      if(pf >= 0 && pf < cols){
        dctx.globalAlpha = baseA * ga;
        dctx.drawImage(srcIm, pf*cell, sy, cell, cell, ddx, ddy, dds, dds);
      }
    }
    dctx.globalAlpha = baseA;
  }
  dctx.drawImage(srcIm, sx, sy, cell, cell, ddx, ddy, dds, dds);
  dctx.restore();
  return true;
}
// Which overlay pair should render for this composite state?
//   {fg,bg}      draw these sheets (bg before body, fg after armor)
//   {hide:true}  weapon intentionally not rendered (hurt = the LPC collapse
//                anim — reads as the weapon dropping; ULPC hurt sheets don't
//                match this pack's single-row hurt strip anyway)
//   null         no overlay usable -> pinned-icon fallback path
function _wpnOvlFor(A, opts, wDef, animKey){
  const ovl = wDef && opts && opts.weaponId && A.LPC_WPN_OVL && A.LPC_WPN_OVL[opts.weaponId];
  if(!ovl) return null;
  let fg, bg;
  if(opts.attacking && animKey === wDef.anim){ fg = ovl.atkFg; bg = ovl.atkBg; }
  else if(animKey === 'walk' || animKey === 'idle'){ fg = ovl.walkFg; bg = ovl.walkBg; }
  else return { hide:true };
  if(!A.img(fg) && !A.img(bg)) return null;   // not decoded yet
  return { fg, bg };
}

// v78: is the equipped weapon drawn in FRONT of the body for this facing?
// EVERY weapon now slings on the back while idle/walking (owner spec), so when
// not attacking the depth comes from LPC_BACK; during the attack the weapon is
// in the hands and uses LPC_HAND depth (always front).
function _weaponIsFront(A, wDef, dirIndex, attacking){
  if(!attacking){
    const b = A.LPC_BACK[dirIndex] || A.LPC_BACK[2];
    return !!b.front;
  }
  const h = A.LPC_HAND[dirIndex] || A.LPC_HAND[2];
  return !!h.front;
}
// Draw the equipped weapon for one frame.
//  dctx        target context (may be the tint scratch canvas)
//  wDef        NS_WEAPON entry
//  dirIndex    0=up 1=left 2=down 3=right
//  frame       body animation frame (drives the carry hand-bob)
//  attacking   true during the 0.42s swing
//  p           attack progress 0..1 (ignored unless attacking)
//  aimAng      radians, direction of the swing (atan2 of the aim vector)
//  dx,dy,dw,dh the body sprite's on-screen rect
// Returns nothing; silently no-ops until the sprite decodes.
function drawWeaponLayer(dctx, wDef, dirIndex, frame, attacking, p, aimAng, dx, dy, dw, dh, tintCol){
  const A = window.NS_ASSETS;
  const im = A.img(wDef.src);
  if(!im) return;
  const u = dw / 64;                       // body-frame unit -> screen px
  const bob = attacking ? 0 : (A.LPC_HAND_BOB[frame % A.LPC_HAND_BOB.length] || 0);

  // v78: EVERY weapon slings on the back while idle/walking, and only comes to
  // the hands during the attack swing. This is the LPC quiver convention and
  // reads far cleaner than any in-hand carry (which kept floating in front of
  // the chest). The grip anchor while slung is the LPC quiver back-point.
  const slung = !attacking;
  const anchor = slung ? (A.LPC_BACK[dirIndex] || A.LPC_BACK[2])
                       : (A.LPC_HAND[dirIndex] || A.LPC_HAND[2]);

  let ang, push = 0, lift = 0;
  if(attacking){
    const m = (WEAPON_MOTION[wDef.motion] || WEAPON_MOTION.slash)(Math.max(0, Math.min(1, p)));
    // sprite art points UP (-PI/2), so aiming it along aimAng needs +PI/2
    ang = aimAng + Math.PI/2 + m.ang;
    push = m.push; lift = m.lift;
  } else {
    // slung diagonally across the back (~135deg screen), lean baked per facing
    ang = anchor.ang || 0;
  }

  // back/hand position on screen, then slide along/perpendicular to the aim
  let hx = dx + anchor.x*u;
  let hy = dy + (anchor.y + bob)*u;
  if(attacking){
    hx += (Math.cos(aimAng)*push - Math.sin(aimAng)*lift) * u;
    hy += (Math.sin(aimAng)*push + Math.cos(aimAng)*lift) * u;
  }

  // While slung the weapon is drawn shorter (a back-carry reads as a smaller
  // silhouette than a swung blade) and anchored near its middle, not its grip,
  // so it sits diagonally across the shoulders rather than hanging off one point.
  const slungScale = slung ? 0.82 : 1;
  const sh = wDef.ln * u * slungScale;
  const sw = sh * (im.width / im.height);
  const gx = sw * 0.5;
  const gy = sh * (slung ? 0.5 : (wDef.gy != null ? wDef.gy : 0.9));

  const src = (tintCol ? _tintedWeapon(im, wDef.src, tintCol, 0.55) : im);
  dctx.save();
  dctx.imageSmoothingEnabled = false;
  dctx.translate(hx, hy);
  dctx.rotate(ang);
  // Premium aura (owner spec: "efek yang ada cahaya delay, glow"). A soft
  // additive halo of the weapon's glow colour, pulsing slowly while carried and
  // flaring during the strike. Drawn UNDER the sprite so the blade stays crisp.
  if(wDef.glow){
    const t = (window.NS_now ? window.NS_now() : (performance.now()/1000));
    const pulse = 0.7 + 0.3*Math.sin(t*2.4);            // slow breathe, never near 0
    const flare = attacking ? (0.6 + 0.8*Math.sin(Math.PI*Math.min(1,p))) : 0;
    const glowA = Math.min(1, 0.42*pulse + flare*0.6);  // stronger baseline (owner: efek terlalu miskin)
    dctx.save();
    dctx.globalCompositeOperation = 'lighter';
    dctx.globalAlpha = glowA;
    // a wider stacked, offset bloom reads as real light without a blur filter
    const halo = _tintedWeapon(im, wDef.src, wDef.glow, 1.0);
    for(const [ox,oy,a] of [[0,0,1],[-1,0,0.7],[1,0,0.7],[0,-1,0.7],[0,1,0.7],[-2,0,0.4],[2,0,0.4],[0,-2,0.4],[0,2,0.4]]){
      dctx.globalAlpha = glowA*a;
      dctx.drawImage(halo, -gx+ox, -gy+oy, sw, sh);
    }
    dctx.restore();
  }
  dctx.drawImage(src, -gx, -gy, sw, sh);
  dctx.restore();
}

function drawLPCComposite(ctx, cx, cy, scale, dirIndex, frame, opts){
  const A = window.NS_ASSETS;
  if(!A || !A.LPC_HERO) return false;
  const hero = A.LPC_HERO;
  const animKey = (opts && opts.attacking && opts.weaponAnim) ? opts.weaponAnim : (opts && opts.animKey) || 'walk';
  const animCfg = hero[animKey] || hero.walk;
  // v80: LPC monsters — pre-baked body+head composites reuse this whole
  // pipeline with only the BODY source swapped (geometry is the standard LPC
  // rig, identical to the hero sheets). File names inside monBase mirror the
  // anim keys; idle reads walk.png frame 0 exactly like the hero does.
  let bodySrc = animCfg.src;
  if(opts && opts.monBase){
    const mf = (animKey==='idle' || animKey==='walk') ? 'walk' : animKey;
    bodySrc = opts.monBase + '/' + mf + '.png';
  }
  const bodyIm = A.img(bodySrc);
  if(!bodyIm) return false; // not loaded yet — caller falls back to placeholder
  const {fw, fh} = animCfg;
  const rows = animCfg.rows || 1;
  const row = rows > 1 ? dirIndex : 0;
  const f = Math.max(0, Math.min(frame, animCfg.frames - 1));
  const dw = fw*scale, dh = fh*scale;
  const dx = cx - dw/2;
  const dy = cy - dh*(opts && opts.foot != null ? opts.foot : hero.foot);
  const alpha = (opts && opts.alpha != null) ? opts.alpha : 1;
  // "Corrupted" tint path (e.g. the Corrupted Knight enemy, Phase 3a): draw
  // the whole LPC stack onto the shared offscreen scratch canvas first, tint
  // ONLY the drawn pixels with source-atop, then blit back — the same masked-
  // tint technique as the Frost Spear slow-tell below, so the tint follows the
  // character silhouette and never bleeds onto the floor or other sprites.
  // When no tint is requested this is a zero-cost passthrough: dctx === ctx and
  // every layer draws straight to the main canvas exactly as before.
  const tint = opts && opts.tint;
  // v76: the weapon is now a rotated sprite pinned to the hand, so it can reach
  // well outside the body rect (a scythe mid-reap especially). Pad the tint
  // scratch canvas by the weapon's full length so a tinted carrier (Corrupted
  // Knight) never gets its blade clipped at the rect edge.
  const _wsDef = (opts && opts.weaponId && A.NS_WEAPON[opts.weaponId]) || null;
  // v79: overlay pair for this state (null -> pinned-icon fallback).
  const _ovl = _wpnOvlFor(A, opts, _wsDef, animKey);
  // Pad covers the icon path's rotated reach (ln) AND the 192px oversize
  // overlay cells, which extend up to 64 body-units past the frame edge.
  const _tpad = tint && _wsDef ? Math.ceil(Math.max(_wsDef.ln + 8, 72) * (dw / 64)) : 0;
  const dctx = tint ? _getTintCtx(dw + _tpad*2, dh + _tpad*2) : ctx;
  dctx.save();
  dctx.imageSmoothingEnabled = false;
  if(tint){ dctx.translate(-(dx - _tpad), -(dy - _tpad)); dctx.globalAlpha = 1; }
  else { dctx.globalAlpha = alpha; }
  // weapon BEHIND the body. Two cases put the weapon behind the torso:
  //  (a) a held weapon whose hand is the FAR hand for this facing (LPC_HAND.front=false)
  //  (b) a slung back-carry weapon (bow/crossbow) whose back anchor is behind
  //      the body for this facing (LPC_BACK.front=false, e.g. facing down)
  // v77: compute the effective depth via _weaponIsFront so a slung bow correctly
  // rides behind the torso when the hero faces the camera.
  // v79: overlay model — the ULPC background layer (the part of the weapon the
  // body occludes) always draws before the body; the fg layer draws after the
  // armor stack below. The anchor path only runs when no overlay is usable.
  if(_wsDef && _ovl && !_ovl.hide){
    _drawWpnOvlLayer(dctx, _ovl.bg, f, dirIndex, dx, dy, dw, dh, _wsDef,
                     !!opts.attacking, opts.atkProg || 0, opts.weaponTint || null,
                     opts.weaponGlow || null, opts.weaponEvo || 1);
  } else if(_wsDef && !_ovl
     && !_weaponIsFront(A, _wsDef, dirIndex, !!opts.attacking)){
    drawWeaponLayer(dctx, _wsDef, dirIndex, f, !!opts.attacking,
                    opts.atkProg || 0, (opts.aimAng != null) ? opts.aimAng : -Math.PI/2,
                    dx, dy, dw, dh, opts.weaponTint || null);
  }
  // body
  dctx.drawImage(bodyIm, f*fw, row*fh, fw, fh, dx, dy, dw, dh);
  // armor: torso/legs/feet[/head], same anim folder as body, direct stack.
  // Falls back to LPC_ARMOR.base (plain shirt/pants/shoes) whenever no
  // marketplace armor is equipped — the raw body sheet underneath is the
  // stock LPC "skin" layer (underwear only), so without this fallback the
  // char-select preview and every dungeon run before buying armor would
  // render the character effectively undressed (punch list #9, MiniPay
  // compliance blocker). LPC_ARMOR.base is render-only, never sold.
  // v80: LPC monsters skip the armor stack entirely — their look is fully
  // baked into the body sheet (head included), and the LPC_ARMOR.base
  // fallback would dress an orc in the hero's shirt and pants.
  // Phase 9 (Cosmetic Skins): an equipped outfit is a real LPC layer set
  // (A.LPC_OUTFIT, same shape as LPC_ARMOR). When present it VISUALLY OVERRIDES
  // the body-clothing layer — it wins over the equipped armor's look AND the
  // base outfit — so the paid skin is always the thing you see (a flex). It's
  // fed into the exact SAME armor-stack loop below (tint/glow included), so
  // there's no separate render path. It changes ONLY visuals: the armor's HP
  // bonus is applied in game.js applyEquipment(), independent of what renders.
  // With no outfit equipped, opts.outfitId is unset and this resolves exactly
  // as before (byte-identical base/armor render).
  const skinDef = (opts && opts.outfitId && A.LPC_OUTFIT && A.LPC_OUTFIT[opts.outfitId]) || null;
  // TASK B — the FREE DEFAULT SKIN (A.LPC_OUTFIT.default_skin) replaces the old
  // plain-clothes LPC_ARMOR.base as the render-only fallback: it is the LOWEST
  // priority layer, drawn only when the player has no paid skin AND no armor, so
  // a fresh player/guest looks like a lightly-armoured knight instead of "naked".
  // Priority stays: paid skin (a flex, overrides everything) > equipped armor >
  // default skin > (legacy) base. Monsters and any noArmor caller are unaffected.
  const armorDef = (opts && (opts.noArmor || opts.monBase)) ? null
    : (skinDef || (opts && opts.armorId && A.LPC_ARMOR[opts.armorId])
       || (A.LPC_OUTFIT && A.LPC_OUTFIT.default_skin) || A.LPC_ARMOR.base);
  if(armorDef){
    // animKey -> actual LPC asset folder name. Most anims share their name
    // with the folder (hurt/slash/thrust); walk+idle both read from
    // 'walkcycle'; shoot (hunters_bow, wired this session) reads from
    // 'bow' — the LPC source tree names that folder after the weapon, not
    // the animation, unlike the others.
    const animFolder = (animKey === 'idle' || animKey === 'walk') ? 'walkcycle'
                      : animKey === 'shoot' ? 'bow'
                      : animKey;
    // 'arms' (POLISH 3a): optional plate arms/shoulders layer — drawn AFTER
    // torso so the shoulder pads overlap the chest plate, BEFORE head so the
    // helmet still sits on top. Key is optional: armor sets without an 'arms'
    // entry (base outfit, all marketplace sets) skip it via the !fn guard, so
    // the hero render path is byte-identical to before.
    // Collect the armor layers onto a scratch canvas first so a tint/glow can
    // be applied to the ARMOR SILHOUETTE only (not the bare skin/face below it),
    // then blit back. v77: makes equipped colour match the shop icon. When the
    // set has no tint/glow (iron_plate, base) this is a zero-cost straight stack
    // to the main context, byte-identical to before.
    const _atint = armorDef.tint || null;
    const _aglow = armorDef.glow || null;
    const _actx = (_atint || _aglow) ? _getArmorCtx(dw, dh) : dctx;
    const _aox = (_atint || _aglow) ? dx : 0;
    const _aoy = (_atint || _aglow) ? dy : 0;
    if(_atint || _aglow){ _actx.save(); _actx.imageSmoothingEnabled=false; _actx.translate(-_aox,-_aoy); }
    ['legs','torso','arms','feet','head'].forEach(part=>{
      const fn = armorDef[part];
      if(!fn) return;
      const im = A.img(`${A.LPC_BASE}/${animFolder}/${fn}`);
      if(im) _actx.drawImage(im, f*fw, row*fh, fw, fh, dx, dy, dw, dh);
    });
    if(_atint || _aglow){
      // tint: multiply-ish colour over the armor pixels only
      if(_atint){
        _actx.setTransform(1,0,0,1,0,0);
        _actx.globalCompositeOperation='source-atop';
        _actx.globalAlpha = armorDef.tintA != null ? armorDef.tintA : 0.25;
        _actx.fillStyle=_atint; _actx.fillRect(0,0,Math.ceil(dw),Math.ceil(dh));
      }
      _actx.restore();
      // glow: soft additive halo of the armor colour, gently pulsing
      if(_aglow){
        const tg = performance.now()/1000;
        const gpA = 0.18 + 0.12*Math.sin(tg*2.2);
        dctx.save(); dctx.imageSmoothingEnabled=false;
        dctx.globalCompositeOperation='lighter'; dctx.globalAlpha=gpA;
        for(const [ox,oy] of [[-1,0],[1,0],[0,-1],[0,1]])
          dctx.drawImage(_armorCanvas, 0,0,Math.ceil(dw),Math.ceil(dh), dx+ox,dy+oy,Math.ceil(dw),Math.ceil(dh));
        dctx.restore();
      }
      dctx.save(); dctx.imageSmoothingEnabled=false; dctx.globalAlpha = (opts&&opts.alpha!=null)?opts.alpha:1;
      dctx.drawImage(_armorCanvas, 0,0,Math.ceil(dw),Math.ceil(dh), dx,dy,Math.ceil(dw),Math.ceil(dh));
      dctx.restore();
    }
  }
  // weapon (v76 Task #7): one canonical sprite rotated around its grip and
  // pinned to the hero's RIGHT hand — see NS_WEAPON/LPC_HAND in assets.js and
  // drawWeaponLayer/WEAPON_MOTION above. Replaces the old overlay-sheet stack,
  // which could not show a weapon at all in directions the shipped sheet left
  // blank (measured: 5 of 6 carry sheets only had the down row).
  //
  // DEPTH: facing west the hero's right hand is the FAR hand, so the weapon is
  // occluded by the body and must be drawn BEFORE the body layers. Every other
  // facing draws it on top. `front` is per-direction data in LPC_HAND.
  if(opts && opts.weaponId){
    const wDef = A.NS_WEAPON[opts.weaponId];
    if(!wDef){
      _warnOnce('ns-weapon-unknown-'+opts.weaponId,
        '[NullState] Equipped weapon id "'+opts.weaponId+'" has no NS_WEAPON entry — marketplace id and assets.js key are out of sync.');
    } else if(_ovl && !_ovl.hide){
      // v79: ULPC foreground layer — the in-grip weapon art, frame-matched to
      // the body pose that just drew (walk carry or slash/thrust attack).
      _drawWpnOvlLayer(dctx, _ovl.fg, f, dirIndex, dx, dy, dw, dh, wDef,
                       !!opts.attacking, opts.atkProg || 0, opts.weaponTint || null,
                       opts.weaponGlow || null, opts.weaponEvo || 1);
    } else if(_ovl && _ovl.hide){
      // hurt/death collapse — weapon intentionally not rendered (it "drops").
    } else if(!A.img(wDef.src)){
      _warnOnce('ns-weapon-notcached-'+wDef.src,
        '[NullState] Weapon sprite "'+wDef.src+'" was never preloaded (A.img() returned null) — check preloadLPCHero()/preloadAll() coverage or a stale cached /game-engine/*.js bundle (see BUILD_TAG cache-busting in DungeonGame.tsx).');
    } else if(_weaponIsFront(A, wDef, dirIndex, !!(opts && opts.attacking))){
      drawWeaponLayer(dctx, wDef, dirIndex, f, !!(opts && opts.attacking),
                      (opts && opts.atkProg) || 0, (opts && opts.aimAng != null) ? opts.aimAng : -Math.PI/2,
                      dx, dy, dw, dh, (opts && opts.weaponTint) || null);
    }
  }
  if(tint){
    // tint only the silhouette we just drew, then stamp it onto the main canvas
    dctx.setTransform(1,0,0,1,0,0);
    dctx.globalCompositeOperation = 'source-atop';
    dctx.globalAlpha = (opts.tintAlpha != null ? opts.tintAlpha : 0.35);
    dctx.fillStyle = tint;
    dctx.fillRect(0, 0, Math.ceil(dw) + _tpad*2, Math.ceil(dh) + _tpad*2);
    dctx.restore();
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = alpha;
    ctx.drawImage(_tintCanvas, 0, 0, Math.ceil(dw) + _tpad*2, Math.ceil(dh) + _tpad*2,
                  dx - _tpad, dy - _tpad, Math.ceil(dw) + _tpad*2, Math.ceil(dh) + _tpad*2);
    ctx.restore();
  } else {
    dctx.restore();
  }
  return true;
}

class Player {
  constructor(charKey, cfg){
    this.char=charKey; this.cfg=cfg;
    this.x=0; this.y=0; this.r=14;
    this.speed=141; this.vx=0; this.vy=0; // v65 T1: 188 -> 141 (-25%, user request). Keep in sync with applyLevelStats() in game.js.
    this.facing=1; this.dirY=0; this.state='idle';
    this.anim=new Anim();
    this.maxHp=100; this.hp=100; // flat base — only equipped Armor raises this (see applyEquipment() in game.js)
    this.xp=0; this.level=1; this.kills=0;
    this.critChance=0;   // grows with level (updateCrit) — level 1 = no crit
    this.atkDmg=22;
    this.attacking=false; this.atkTime=0; this.atkCd=0; this.hitDone=false;
    this.swingFlash=0; this._lastMove={x:1,y:0};
    this.iframe=0; this.flash=0;
    this.depth=1;
    // ---- LPC hero rendering state (Phase 5.3 Task 5) ----
    // Gated by useLPCHero so the old Pixel Crawler sprite path stays
    // available/switchable until this is verified in a real browser
    // against live gameplay (a standalone Playwright harness confirmed
    // the compositing math this session, but NOT the full game loop —
    // manual QA of that path is still owed).
    this.useLPCHero = (charKey === 'knight');
    this.equippedArmorId = null;   // set by applyEquipment() in game.js
    this.equippedWeaponId = null;  // set by applyEquipment() in game.js
    this._lpcDir = 2;              // 0=up 1=left 2=down 3=right
    this._lpcFrame = 0;
    this._lpcT = 0;
  }
  xpForNext(){ return this.level*200; }
  // LEVEL = CRIT (owner/Celo-team decision). Level deliberately does NOT raise
  // Max HP (that's Armor's job) or base attack (that's Weapons' job) — instead
  // every level grows your Critical Hit chance, which multiplies whatever your
  // weapon already deals (crit = x2 damage, see applyHitToEnemy in game.js).
  // So leveling makes your equipped weapon hit HARDER rather than replacing it.
  // +0.4%/level, capped at 25%. MIRRORED in game.js applyLevelStats() — keep
  // the two formulas in sync.
  updateCrit(){ this.critChance = Math.min(0.25, 0.004*(this.level-1)); }
  gainXp(n){
    this.xp+=n;
    let ups=0;
    while(this.xp>=this.xpForNext() && this.level<50){
      this.xp-=this.xpForNext(); this.level++; ups++;
      // maxHp no longer grows on level-up — HP cap is flat 100, only
      // equipped Armor raises it (see applyLevelStats()/applyEquipment()
      // in game.js). Level-up still fully heals the player, same as before.
      this.hp=this.maxHp; this.atkDmg+=3; this.speed+=1.5;
    }
    if(ups>0) this.updateCrit();  // refresh crit chance for the new level
    return ups;
  }
  startAttack(){
    if(this.atkCd>0 || this.attacking) return false;
    this.attacking=true; this.atkTime=0; this.hitDone=false;
    // v77: owner asked for a slower, more readable swing. Bumped the swing
    // duration 0.42 -> 0.62s and stored it on the instance so every consumer
    // (timeline, LPC frame map, hitZone window, atkProg for drawWeaponLayer)
    // reads ONE value and can never drift out of sync again.
    this.atkDur = 0.62;
    this.swingFlash=0.58; // class-flavored attack visual duration (see draw())
    this.atkCd=0.58;
    this._wantSwingFx=true;
    return true;
  }
  takeSwingFx(){ const v=this._wantSwingFx; this._wantSwingFx=false; return v; }
  hurt(dmg){
    if(this.iframe>0) return false;
    this.hp=Math.max(0,this.hp-dmg); this.iframe=0.7; this.flash=0.4;
    return true;
  }
  update(dt, input, dun){
    if(this.atkCd>0) this.atkCd-=dt;
    if(this.iframe>0) this.iframe-=dt;
    if(this.flash>0) this.flash-=dt;
    if(this.swingFlash>0) this.swingFlash-=dt;

    // movement (locked briefly mid-attack swing)
    const lock = this.attacking && this.atkTime<0.26;
    let mx=0,my=0;
    if(!lock){
      mx=(input.right?1:0)-(input.left?1:0);
      my=(input.down?1:0)-(input.up?1:0);
    }
    const mag=Math.hypot(mx,my)||1;
    mx/=mag; my/=mag;
    const moving = (mx||my) && !lock;
    if(moving){ this._lastMove={x:mx,y:my}; this.dirY=my; }
    const sp=this.speed*(this.attacking?0.55:1);
    // collide per-axis — walls (tile grid) AND solid decor footprints
    // (window.NS_solidDecorAt, set by game.js) so props like cabinets/barrels
    // can't be walked through. Tested at the leading edge (±r) like the wall
    // check; per-axis so the player still slides along a prop instead of
    // sticking, and can always back out if knocked into one.
    const _decorSolid = (typeof window!=='undefined' && window.NS_solidDecorAt) ? window.NS_solidDecorAt : null;
    const nx=this.x+mx*sp*dt;
    if(!dun.isWall(nx,this.y) && !dun.isWall(nx+Math.sign(mx)*this.r,this.y)
       && !(_decorSolid && _decorSolid(nx+Math.sign(mx)*this.r, this.y))) this.x=nx;
    const ny=this.y+my*sp*dt;
    if(!dun.isWall(this.x,ny) && !dun.isWall(this.x,ny+Math.sign(my)*this.r)
       && !(_decorSolid && _decorSolid(this.x, ny+Math.sign(my)*this.r))) this.y=ny;
    if(mx!==0) this.facing=mx>0?1:-1;

    // attack timeline (pose stays idle throughout — see startAttack note)
    if(this.attacking){
      this.atkTime+=dt;
      if(this.atkTime>=(this.atkDur||0.62)){ this.attacking=false; this._atkAim=null; }
    }
    // anim state — only idle/walk exist now, attacking no longer swaps sprite
    if(moving && !this.attacking){ this.anim.loop=true; this.anim.set(this.cfg.walk,'walk'); this.state='walk'; }
    else { this.anim.loop=true; this.anim.set(this.cfg.idle,'idle'); this.state='idle'; }
    this.anim.update(dt);

    // ---- LPC hero animation state (additive, only used when
    // useLPCHero is true — see drawLPCComposite/lpcDirFromVec above) ----
    if(this.useLPCHero){
      // BUGFIX (verified via standalone Playwright harness this session):
      // previously fell back to `this.facing` (a left/right-only flag that
      // defaults to 1 and is never set to 0) whenever |_lastMove.x|<=0.2.
      // That meant pure vertical movement (mx=0, my=±1) always substituted
      // facing=1 for lx, and lpcDirFromVec's `>=` tie-break then always
      // picked horizontal — the player could NEVER visually face up/down
      // while walking straight vertically. _lastMove already holds the
      // correct, fully-normalized last-movement vector (set only when
      // actually moving, so it correctly persists through idle frames too)
      // — no facing-based fallback is needed at all.
      // While attacking, aim at the locked target (_atkAim, set by the
      // auto-attack in game.js) so the swing visually faces the monster for
      // the whole swing even if the analog keeps the player walking a
      // different way. Falls back to _lastMove when not attacking / no aim.
      const _aim = (this.attacking && this._atkAim) ? this._atkAim : this._lastMove;
      const lx=_aim ? _aim.x : 1;
      const ly=_aim ? _aim.y : 0;
      this._lpcDir = lpcDirFromVec(lx, ly);
      const A = window.NS_ASSETS;
      if(this.attacking && A){
        const wDef = this.equippedWeaponId && A.NS_WEAPON[this.equippedWeaponId];
        const animKey = (wDef && wDef.anim) || 'slash';
        const animCfg = A.LPC_HERO[animKey] || A.LPC_HERO.slash;
        // atkTime runs 0..0.42 (see startAttack/update above) — map the
        // strike window (0.10-0.30, see hitZone()) onto the sheet's frames
        // so the visible swing frame lines up with when the hit actually
        // lands, rather than just looping the sheet on its own clock.
        const prog = Math.max(0, Math.min(1, this.atkTime/(this.atkDur||0.62)));
        this._lpcFrame = Math.min(animCfg.frames-1, Math.floor(prog*animCfg.frames));
        this._lpcAnimKey = animKey;
      } else if(moving){
        const walkCfg = A ? A.LPC_HERO.walk : null;
        const fps = (walkCfg&&walkCfg.fps) || 12;
        this._lpcT += dt;
        if(this._lpcT >= 1/fps){
          this._lpcT = 0;
          this._lpcFrame = (this._lpcFrame+1) % ((walkCfg&&walkCfg.frames)||9);
        }
        this._lpcAnimKey = 'walk';
      } else {
        this._lpcFrame = 0; this._lpcT = 0; this._lpcAnimKey = 'idle';
      }
    }
  }
  // returns hit zone center & radius when in the strike window
  hitZone(){
    if(!this.attacking || this.hitDone) return null;
    if(this.atkTime<0.15 || this.atkTime>0.44) return null;
    this.hitDone=true;
    // Same facing-fallback bug as the LPC dir calc in update() (see the
    // BUGFIX comment above) — fixed the same way this session: attacking
    // while walking straight up/down was registering the hit zone to the
    // side instead of up/down, because `this.facing` (left/right-only,
    // defaults to 1, never 0) was substituted in whenever |_lastMove.x|
    // was small. _lastMove already holds the correct persisted vector.
    // Prefer the locked attack aim (_atkAim) so the hit lands toward the
    // targeted monster for the whole swing, matching the visual (see update()).
    const _aim = this._atkAim || this._lastMove;
    const lx=_aim ? _aim.x : 1;
    const ly=_aim ? _aim.y : 0;
    const m=Math.hypot(lx,ly)||1;
    return { x:this.x+lx/m*38, y:this.y+ly/m*30, r:50, dmg:this.atkDmg };
  }
  draw(ctx){
    const a=this.iframe>0 && (Math.floor(this.iframe*20)%2===0)?0.4:1;
    // shadow
    ctx.save(); ctx.globalAlpha=0.35*a; ctx.fillStyle='#000';
    // Shadow anchor: with LPC_HERO.foot=1.0, drawLPCComposite() places the
    // sprite's feet EXACTLY at this.y (dy+dh===cy — see drawLPCComposite
    // below). The old +8 offset was tuned for the legacy Pixel Crawler
    // sprite's different foot anchor and left a visible gap under the LPC
    // hero's feet (user-reported "floating" bug). +2 keeps a hint of
    // separation without the gap; nudge this if a screenshot shows it's
    // still off.
    ctx.beginPath(); ctx.ellipse(this.x,this.y+2,this.r*1.3,7,0,0,7); ctx.fill(); ctx.restore();
    let drewLPC = false;
    if(this.useLPCHero){
      const A = window.NS_ASSETS;
      const heroCfg = A && A.LPC_HERO;
      // v76 T#7: atkProg/aimAng drive the procedural weapon swing. aimAng is
      // the LOCKED attack aim (_atkAim, pinned when the auto-attack starts) so
      // the blade tracks the monster for the whole swing even if the analog
      // keeps walking elsewhere — same vector hitZone() scores against, so the
      // visual and the hit can't disagree. Idle/walk falls back to _lastMove.
      const _wa = (this.attacking && this._atkAim) ? this._atkAim : this._lastMove;
      const _waAng = _wa ? Math.atan2(_wa.y, _wa.x) : -Math.PI/2;
      drewLPC = heroCfg && drawLPCComposite(ctx, this.x, this.y, heroCfg.scale, this._lpcDir, this._lpcFrame, {
        animKey: this._lpcAnimKey || 'walk',
        attacking: this.attacking,
        weaponAnim: this.equippedWeaponId && A.NS_WEAPON[this.equippedWeaponId] && A.NS_WEAPON[this.equippedWeaponId].anim,
        armorId: this.equippedArmorId,
        // Phase 9: cosmetic skin layer (overrides the body-clothing look; set by
        // applyEquipment in game.js). null when no skin is equipped -> unchanged.
        outfitId: this.equippedOutfitId,
        weaponId: this.equippedWeaponId,
        // Phase 4: an evolved weapon washes its carried sprite in the tier's
        // hotter tint (set by applyEquipment in game.js). null at base tier ->
        // _drawWpnOvlLayer falls back to NS_WEAPON.ovlTint, unchanged.
        weaponTint: this._wpnOvlTint || null,
        // Phase 6: the evolution glow override + tier drive the carried-weapon
        // aura in _drawWpnOvlLayer (brighter, wider bloom per tier). Both are
        // null/1 at base tier so the pre-evolution look is untouched.
        weaponGlow: this._weaponGlow || null,
        weaponEvo: this._wpnTier || 1,
        atkProg: this.attacking ? (this.atkTime/(this.atkDur||0.62)) : 0,
        aimAng: _waAng,
        alpha: a,
      });
    }
    if(!drewLPC){
      // Either useLPCHero is off, or the LPC sheets aren't loaded yet —
      // fall back to the old Pixel Crawler sprite so the player is never
      // invisible (same defensive principle as Anim.draw's own fallback).
      this.anim.draw(ctx,this.x,this.y, this.cfg.scale, this.facing<0, this.cfg.foot, a);
    }
    if(this.flash>0 && !drewLPC){
      this.anim.draw(ctx,this.x,this.y,this.cfg.scale,this.facing<0,this.cfg.foot,this.flash*0.7);
    }
    // Class-flavored attack visual — stands in for a dedicated attack
    // sprite (none of the 3 classes have one, only Idle/Run/Death).
    // Phase 5.3 Task 4: weapon identity is layered ON TOP of the class shape
    // below via `beh` (this._weaponBehavior) + `tier` (this._fxTier, 1-3
    // from the equipped item's price tier — see marketplace-items.js). The
    // class branch still decides the base silhouette (fire/daggers/sword);
    // tierScale/tierAlpha make higher-tier weapons of the SAME class read as
    // bigger/brighter, and the accent layer after it adds a small
    // behavior-specific flourish so all 7 behaviors stay distinguishable
    // even when two weapons share a class look.
    if(this.swingFlash>0){
      const dur=0.34;
      const sa=Math.max(0,this.swingFlash/dur);
      const prog=1-sa;                       // 0 -> 1 over the swing
      // 360° aim: orient the swing toward the actual move/analog vector
      // (not just left/right) so melee reads correctly in every direction.
      const _mv=(this._lastMove && (Math.abs(this._lastMove.x)+Math.abs(this._lastMove.y)>0.1))?this._lastMove:{x:this.facing,y:0};
      const aimAng=Math.atan2(_mv.y,_mv.x);
      const dir=1;
      const base=aimAng;
      const beh = this._weaponBehavior || 'slash';
      const tier = this._fxTier || 1;
      // v67 T11: equipped weapon's fxColor (marketplace.ts/-items.js, set by
      // applyEquipment() in game.js). null = no weapon equipped -> every
      // branch below falls back to its original hardcoded palette, so the
      // bare-fist / pre-purchase look is byte-identical to before.
      const wc = this._fxColor || null;
      // Phase 6 (weapon evolution): fold the evolution tier (1..3, set by
      // applyEquipment) into the swing FX so a leveled weapon visibly swings
      // bigger + brighter. evo 1 = byte-identical to the pre-evolution look.
      const evo = Math.max(1, this._wpnTier || 1);
      // Owner: tier 2 and 3 have to be obviously different from tier 1 and from
      // each other. They were 1.00 / 1.18 / 1.36 — an 18% step, which is under
      // the threshold anyone notices mid-fight on a 393px phone, so two paid
      // upgrades landed as "did that do anything?". Now 1.00 / 1.30 / 1.65,
      // a table rather than a formula so the steps are read, not derived.
      const evoBoost = [1, 1, 1.30, 1.65][Math.min(3, evo)];
      const tierScale = (0.8 + tier*0.3) * evoBoost;      // base * evolution
      const tierAlpha = Math.min(1, 0.65 + tier*0.15 + (evo-1)*0.10);
      const fx = this.x+Math.cos(aimAng)*30, fy = this.y-6+Math.sin(aimAng)*30;

      // Ranged weapons (Ironbolt Crossbow 'ranged', Sunfire Longbow 'volley'):
      // the arrow/bolt itself (drawn in game.js) is the main visual, so a full
      // melee slash arc here would look wrong for a weapon that never swings.
      // Instead: a quick release glint — a short string-snap arc at the draw
      // hand plus 3 small "twang" flecks — that pops hard at release and fades
      // fast, then we skip the class-branch slash arc entirely.
      if(beh==='ranged' || beh==='volley'){
        ctx.save();
        ctx.globalCompositeOperation='lighter';
        const pop=Math.min(1, prog*5);       // fast pop-and-fade at release
        ctx.globalAlpha=sa*pop*tierAlpha;
        ctx.strokeStyle=wc?_fxWhite(wc,0.45):'#eafff5'; ctx.lineWidth=2*tierScale;
        ctx.beginPath();
        ctx.arc(fx,fy, (9+prog*5)*tierScale, aimAng-1.0, aimAng+1.0);
        ctx.stroke();
        ctx.fillStyle=wc?_fxWhite(wc,0.65):'#fff3c4';
        for(let i=0;i<3;i++){
          const ang=aimAng+(i-1)*0.4;
          const rr=13*tierScale;
          ctx.globalAlpha=sa*pop*tierAlpha*0.85;
          ctx.fillRect(Math.round(fx+Math.cos(ang)*rr)-1, Math.round(fy+Math.sin(ang)*rr)-1, 2, 2);
        }
        ctx.restore();
        return; // no melee slash arc for a bow — nothing further to draw
      }

      ctx.save();
      ctx.globalCompositeOperation='lighter';
      if(this.char==='wizzard'){
        // fire burst: core glow + chunky pixel embers thrown forward
        const rad=30*tierScale;
        const g = ctx.createRadialGradient(fx,fy,0, fx,fy,rad);
        g.addColorStop(0, `rgba(255,236,170,${0.9*sa*tierAlpha})`);
        g.addColorStop(0.45, `rgba(255,140,40,${0.7*sa*tierAlpha})`);
        g.addColorStop(1, `rgba(255,60,20,0)`);
        ctx.fillStyle=g;
        ctx.beginPath(); ctx.arc(fx,fy,rad,0,7); ctx.fill();
        const emberCount=6+tier*2;
        for(let i=0;i<emberCount;i++){
          const ang=base + dir*((i-emberCount/2)*(0.78/emberCount)) + Math.sin(prog*20+i)*0.06;
          const rr=(8+prog*26+(i%3)*4)*tierScale;
          const s=((i%2)?4:3)*Math.min(1.3,tierScale);
          ctx.globalAlpha=sa*tierAlpha*(0.45+0.4*(((i*7)%3)/2));
          ctx.fillStyle=(i%3===0)?'#fff0b8':(i%3===1?'#ffb14a':'#ff7028');
          ctx.fillRect(Math.round(fx+Math.cos(ang)*rr)-2, Math.round(fy+Math.sin(ang)*rr)-2, s, s);
        }
      } else if(this.char==='rogue'){
        // twin dagger slashes: two crossing pixel arcs sweeping fast
        const lead1=base+dir*(-1.0+2.0*prog);
        const lead2=base+dir*( 1.0-2.0*prog);
        pixelArc(ctx, fx-dir*6, fy,   19*tierScale, lead1-dir*0.7, lead1, 2, wc?_fxWhite(wc,0.55):'#fff3c4', sa*0.95*tierAlpha);
        pixelArc(ctx, fx+dir*4, fy-4, 16*tierScale, lead2-dir*0.5, lead2, 2, wc||'#ffd9a0', sa*0.8*tierAlpha);
      } else {
        // knight: one wide steel slash — thick pixel arc + trailing
        // afterimage + a hot leading-edge pixel, like a drawn sword frame
        const cx=this.x+Math.cos(aimAng)*14, cy=this.y-6+Math.sin(aimAng)*14;
        const lead=base+dir*(-1.15+2.3*prog);
        pixelArc(ctx, cx, cy, 30*tierScale, lead-dir*0.85, lead, 3, wc?_fxWhite(wc,0.5):'#eafff5', sa*tierAlpha);
        pixelArc(ctx, cx, cy, 24*tierScale, lead-dir*0.6,  lead, 2, wc||'#9df5cf', sa*0.65*tierAlpha);
        ctx.globalAlpha=sa*tierAlpha; ctx.fillStyle='#ffffff';
        ctx.fillRect(Math.round(cx+Math.cos(lead)*30*tierScale)-2, Math.round(cy+Math.sin(lead)*30*tierScale)-2, 5, 5);
      }
      // Phase 6: evolved weapons throw an extra spark spray along the arc — the
      // "particle spike" payoff. Count + reach scale with the evolution tier;
      // skipped entirely at base tier so the plain look is unchanged.
      if(evo>1){
        const gcol = this._weaponGlow || wc || '#ffffff';
        // Was 2 + evo*2 → 6 at T2, 8 at T3. Two sparks apart is not a visible
        // difference; the spray just looked the same either way. 10 and 18
        // read as "more" and "a lot more" without filling the screen — the
        // spray is still confined to the swing arc, so it never hides the
        // enemy the player is aiming at.
        const n = evo >= 3 ? 18 : 10;
        for(let i=0;i<n;i++){
          const ang=base+dir*((i-n/2)*(1.7/n));
          const rr=(20+prog*24)*tierScale;
          ctx.globalAlpha=sa*tierAlpha*0.7;
          ctx.fillStyle=(i%2)?'#ffffff':gcol;
          const s=(i%3===0)?3:2;
          ctx.fillRect(Math.round(fx+Math.cos(ang)*rr)-1, Math.round(fy+Math.sin(ang)*rr)-1, s, s);
        }
      }
      ctx.restore();

      // Behavior accent layer — a small extra flourish stacked on top of the
      // class shape above, so weapons that share a class silhouette but have
      // different mechanical behavior (e.g. Rusty Blade's plain 'slash' vs
      // Ancient Blade's 'triple_slash', both rendered by the same knight
      // branch) still read as visually distinct. Kept intentionally light —
      // this is a polish accent, not a second full effect.
      if(beh==='double_hit'){
        // faint echo arc, slightly time-offset — reads as "hits twice"
        ctx.save(); ctx.globalCompositeOperation='lighter';
        pixelArc(ctx, fx, fy, 22*tierScale, base-dir*0.35, base+dir*0.35, 2, wc||'#9ff0ff', sa*0.5*tierAlpha);
        ctx.restore();
      } else if(beh==='knockback'){
        // heavy impact ring pushed outward — telegraphs the shove
        ctx.save(); ctx.globalCompositeOperation='lighter';
        ctx.globalAlpha=sa*0.55*tierAlpha; ctx.strokeStyle=wc||'#ff8a3d'; ctx.lineWidth=3*tierScale;
        ctx.beginPath(); ctx.arc(fx,fy,(14+prog*22)*tierScale,0,Math.PI*2); ctx.stroke();
        ctx.restore();
      } else if(beh==='triple_slash'){
        // third, wider gold arc layered over the base slash — "3 hits" read
        ctx.save(); ctx.globalCompositeOperation='lighter';
        pixelArc(ctx, fx, fy, 36*tierScale, base-dir*1.5, base+dir*0.35, 3, wc||'#ffd24a', sa*0.7*tierAlpha);
        ctx.restore();
      } else if(beh==='aoe'){
        // void ring pulsing outward in ALL directions (not just the aim
        // cone) — signals the hit isn't confined to a narrow swing
        ctx.save(); ctx.globalCompositeOperation='lighter';
        ctx.globalAlpha=sa*0.5*tierAlpha; ctx.strokeStyle=wc||'#b46bff'; ctx.lineWidth=3*tierScale;
        ctx.beginPath(); ctx.arc(this.x,this.y-6,(20+prog*40)*tierScale,0,Math.PI*2); ctx.stroke();
        ctx.restore();
      } else if(beh==='slow'){
        // icy shard flecks trailing the swing — matches Enemy's frost tint
        ctx.save(); ctx.globalCompositeOperation='lighter'; ctx.fillStyle=wc||'#bdeeff';
        for(let i=0;i<4;i++){
          const ang=base+dir*((i-1.5)*0.3);
          const rr=(18+prog*20)*tierScale;
          ctx.globalAlpha=sa*0.6*tierAlpha;
          ctx.fillRect(Math.round(fx+Math.cos(ang)*rr)-1, Math.round(fy+Math.sin(ang)*rr)-1, 2, 2);
        }
        ctx.restore();
      }
      // 'slash' (Rusty Blade, the plain starter weapon) gets no extra accent
      // beyond tier scaling — it's meant to read as the plain baseline that
      // everything else escalates from.
    }
  }
}

class Enemy {
  constructor(arch, x, y, depth, isBoss=false, elite=false){
    this.arch=arch; this.isBoss=isBoss; this.elite=elite;
    let scale = 1 + (depth-1)*0.14;
    let hpMul=1, dmgMul=1, xpMul=1, rMul=1, scMul=1;
    if(elite){ hpMul=2.3; dmgMul=1.45; xpMul=2.6; rMul=1.28; scMul=1.26; }
    // Boss visual + hitbox reduced ~40% (owner: "ukuran Boss terlalu besar").
    // scMul is render scale (this._scaleMul), rMul the collision/target radius
    // (this.r) — both dropped together so the smaller sprite still matches its
    // hitbox. HP/DMG (stats) are untouched; only the size changed.
    if(arch.isBossScale){ hpMul*=2.0; dmgMul*=1.4; rMul*=1.1; scMul*=1.1; }
    // Data-driven per-floor scaling (monster-config.js): Boss Floors 5/10/15/20
    // get fixed hp/dmg/xp multipliers, every other floor gets a compounding
    // +8%/floor. This STACKS on top of the elite/boss multipliers above, it
    // does not replace them. Defensive guard matches the window.NS_X||{}
    // style already used elsewhere in this codebase (see game.js hitTest()),
    // in case monster-config.js hasn't loaded yet.
    const _floorScale = (window.NS_FLOOR_SCALE ? window.NS_FLOOR_SCALE(depth) : null) || { hpMul:1, dmgMul:1, xpMul:1 };
    hpMul  *= _floorScale.hpMul;
    dmgMul *= _floorScale.dmgMul;
    xpMul  *= _floorScale.xpMul;
    // Bunker 5 "THE LAST LIGHT" Hard Mode (Phase 5.5, confirmed by Ward v27):
    // flat HP/DMG multiplier for every enemy while campaignActIndex===4,
    // stacking on top of everything above. window.__NS is assigned at the
    // bottom of game.js as a top-level statement, so it's already set by
    // the time any Enemy is ever constructed (all Enemy() calls happen from
    // inside gameplay functions, which only run after game.js has finished
    // executing top-to-bottom during script load).
    const _actIdx = (window.__NS && typeof window.__NS.campaignActIndex === 'number') ? window.__NS.campaignActIndex : -1;
    const _hardCfg = (window.NS_MONSTER_CONFIG && window.NS_MONSTER_CONFIG.actHardMode) ? window.NS_MONSTER_CONFIG.actHardMode[_actIdx] : null;
    if (_hardCfg) { hpMul *= _hardCfg.hpMul; dmgMul *= _hardCfg.dmgMul; }
    // NULL CYCLES / New Game+ (game.js campaignCycle): +35% HP & DMG per
    // cycle, stacking on everything above. 0 on the first playthrough, so
    // this multiplies by 1 and changes nothing on the normal path.
    const _cyc = (window.__NS && typeof window.__NS.campaignCycle === 'number') ? window.__NS.campaignCycle : 0;
    if (_cyc > 0) { const m = 1 + _cyc * 0.35; hpMul *= m; dmgMul *= m; }
    this.maxHp=Math.round(arch.hp*scale*hpMul);
    this.hp=this.maxHp;
    this.dmg=Math.round(arch.dmg*(1+(depth-1)*0.12)*dmgMul);
    this.spd=arch.spd*(elite?0.92:1);
    this.xp=Math.round(arch.xp*(1+(depth-1)*0.1)*xpMul);
    this.x=x; this.y=y; this.r=arch.r*rMul;
    // Phase 3a — Corrupted Knight: some archetypes render through the same LPC
    // compositing pipeline as the hero (body+armor+helm+weapon, 4 directions)
    // instead of a flat Pixel Crawler MON spritesheet. Those have no MON entry,
    // so we synthesize a minimal cfg (scale/foot) to keep every downstream
    // this.cfg.* read working, and drive a small LPC anim state below.
    this.useLPC = !!arch.useLPC;
    this.lpc = arch.lpc || null;
    this.cfg = this.useLPC
      ? { scale:(arch.lpc && arch.lpc.scale) || 1.3, foot:(arch.lpc && arch.lpc.foot) || 1.0 }
      : window.NS_ASSETS.MON[arch.key];
    this._lpcDir=2; this._lpcFrame=0; this._lpcAnimT=0; this._lpcAnimKey='idle'; this._lpcPrevKey='idle';
    // Phase 3b — directional MON path (Cave Golem, Giant Spider): sheets have a
    // real row per direction + optional attack/death sheets. Distinct from both
    // the flat single-row MON path and the LPC composite path above.
    this.dirMon = !!(this.cfg && this.cfg.dir);
    this._dir=2; this._dframe=0; this._dt=0; this._dkey='idle'; this._dprev='idle';
    this._scaleMul=scMul;
    this.anim=new Anim(); this.facing=-1;
    this.state='idle'; this.attacking=false; this.atkTime=0; this.atkCd=0; this.hitDone=false;
    this.attackFlashT=0; this.windupT=0;
    this.aggro = isBoss?9999:(elite?420:300);
    this.hitFlash=0; this.dead=false; this.deathT=0; this.kb={x:0,y:0};
    this.spawnT=0.45;
    // ─── Anti-clump: three small per-enemy variations ───────────────────────
    // A room's crew shares an archetype, so it shared a speed, an aggro radius
    // and a target point — every enemy in it started on the same frame, moved
    // at the same rate toward the same pixel, and arrived as a single stack.
    // Nothing was wrong with any one of them; they were identical, and
    // identical things converge.
    //
    // Bosses are excluded from all three. A single enemy cannot clump, and a
    // boss with a randomised speed is a boss whose dodge timing changes run to
    // run — that is a fight becoming unreadable, not a fight becoming varied.
    if(!isBoss){
      this.spd  *= 0.88 + Math.random()*0.24;   // ±12% — the group spreads along its own path
      this.aggro*= 0.85 + Math.random()*0.30;   // they notice you at different moments
      // Beat before the chase starts. Turns "the room lunges" into "one of
      // them sees you, then the others do". Cleared instantly by hurt(), so
      // hitting a monster never leaves it standing there taking it.
      this._react = 0.10 + Math.random()*0.45;
      // A personal bearing to approach on, up to ~29 degrees off the straight
      // line, which fans a group out instead of queueing it single file. It
      // decays to zero as they close, so the last stretch and the strike are
      // still aimed dead at the player — the spread is in the approach, not in
      // the attack.
      this._approachOff = (Math.random()*2-1)*0.5;
    } else {
      this._react = 0; this._approachOff = 0;
    }
    this.home=null; // room bounds (set by game.js) — bunker guards never leave their room
    this.ultiOffered=false; // ulti popup shown once per enemy
    this.name = arch.isBossScale ? arch.name : (elite ? (arch.name+' (Elite)') : arch.name);
  }
  hurt(dmg){
    this.hp-=dmg; this.hitFlash=0.18;
    // Being hit ends the reaction beat immediately. A monster that stands
    // still while you swing at it does not read as "hasn't noticed you yet",
    // it reads as broken.
    this._react = 0;
    if(this.hp<=0 && !this.dead){
      this.dead=true;
      if(this.useLPC && this.lpc && this.lpc.monBase){
        // v80: LPC monsters play the 6-frame LPC hurt collapse as their
        // death anim (single-row, faces camera — reads as keeling over).
        this._lpcAnimKey='hurt'; this._lpcPrevKey='hurt';
        this._lpcFrame=0; this._lpcAnimT=0;
        this.deathT=(6/10)+0.4;
      } else if(this.dirMon){
        this._dkey='death'; this._dprev='death'; this._dframe=0; this._dt=0;
        const dc=this.cfg.death||this.cfg.walk; const fps=dc.fps||9;
        this.deathT=(dc.frames/fps)+0.35;
      } else if(this.cfg.death){
        this.anim.loop=false; this.anim.set(this.cfg.death,'death');
        const fps=this.cfg.death.fps||9;
        this.deathT = (this.cfg.death.frames/fps) + 0.35; // play full anim, then a short hold before fade
      } else {
        this.deathT=0.6;
      }
      return true;
    }
    return false;
  }
  // Bunker guards are bound to their home room: they only aggro while the
  // player is inside it (small grace so doorway fights still connect) and
  // their position is clamped so they can never spill out through a door.
  playerInHome(p, grace=34){
    if(!this.home) return true;
    return p.x>this.home.x0-grace && p.x<this.home.x1+grace &&
           p.y>this.home.y0-grace && p.y<this.home.y1+grace;
  }
  clampHome(){
    if(!this.home) return;
    this.x=Math.max(this.home.x0,Math.min(this.home.x1,this.x));
    this.y=Math.max(this.home.y0,Math.min(this.home.y1,this.y));
  }
  // Push out of anyone we are standing inside. Enemies deliberately do not
  // collide (game.js keeps their pathing simple), which is fine — but "does
  // not collide" turned into "occupies the same pixel forever" once a group
  // converged. This is a soft shove, not a collision: overlapping is allowed,
  // it just stops being stable, so a stack unpacks itself over a few frames
  // and reads as a crowd instead of one sprite with several health bars.
  //
  // Runs whatever the enemy is doing, including idle, so a pile left over
  // from a previous fight sorts itself out too. Walls and the home room still
  // win — this can never shove anything through geometry or out of its post.
  _separate(dt, others, dun){
    if(!others || others.length < 2) return;
    let sx=0, sy=0, n=0;
    for(const o of others){
      if(o===this || o.dead) continue;
      const dx=this.x-o.x, dy=this.y-o.y;
      const rr=(this.r+o.r)*1.05;
      const d2=dx*dx+dy*dy;
      if(d2>=rr*rr) continue;
      if(d2<0.0001){
        // Exactly co-located: no direction to push along, so invent one.
        // Without this, two spawns on the same pixel would sit there forever.
        const a=Math.random()*Math.PI*2; sx+=Math.cos(a); sy+=Math.sin(a); n++;
        continue;
      }
      const d=Math.sqrt(d2), w=(rr-d)/rr;   // deeper overlap pushes harder
      sx+=(dx/d)*w; sy+=(dy/d)*w; n++;
    }
    if(!n) return;
    const m=Math.hypot(sx,sy)||1;
    const push=this.spd*0.85*dt;
    const nx=this.x+(sx/m)*push, ny=this.y+(sy/m)*push;
    if(!dun.isWall(nx,this.y)) this.x=nx;
    if(!dun.isWall(this.x,ny)) this.y=ny;
    this.clampHome();
  }
  update(dt, player, dun, others){
    if(this.spawnT>0) this.spawnT-=dt;
    if(this.dead){
      this.deathT-=dt;
      if(this.dirMon) this._advanceDir(dt);
      else if(this.useLPC){
        // v80: advance the LPC hurt collapse, holding on the last frame.
        this._lpcAnimT+=dt;
        if(this._lpcAnimT>=1/10){ this._lpcAnimT=0; this._lpcFrame=Math.min(5,this._lpcFrame+1); }
      }
      else this.anim.update(dt);
      return;
    }
    if(this.hitFlash>0) this.hitFlash-=dt;
    if(this.atkCd>0) this.atkCd-=dt;
    // Frost Spear slow debuff (set by hitTest() in game.js). Ticks down each
    // frame; while active, movement speed is multiplied by _slowMul. Does
    // not stack — a fresh hit just refreshes _slowT back to full duration.
    if(this._slowT>0){ this._slowT-=dt; if(this._slowT<=0){ this._slowT=0; this._slowMul=1; } }

    const dx=player.x-this.x, dy=player.y-this.y;
    const dist=Math.hypot(dx,dy)||1;
    // v68 T14 (bug-fix component of Q3): facing is now decided AFTER movement
    // (see the block above the animation state machine below) so a monster
    // walking back to its post faces where it's GOING, not the player.
    this._mvx=0; this._mvy=0;

    const reach=this.r+player.r+14;
    let chasing=false;
    if(this.attacking){
      this.atkTime+=dt;
      // deal damage mid-swing — wider window + reach grace than before,
      // since nothing freezes the player in place during an enemy's
      // swing; a tight window made attacks whiff constantly if the player
      // moved at all during the wind-up, even though they started in range.
      if(!this.hitDone && this.atkTime>0.16 && this.atkTime<0.5 && dist<reach+26){
        this.hitDone=true; this._wantHit=this.dmg;
      }
      // LUNGE (owner: "monster tidak punya animasi attack"). The swing anim
      // already plays, but a monster striking from a dead standstill reads as
      // "no attack". Step it toward the player through the strike window so the
      // attack is unmistakable — a committed lunge + the slash/thrust/spellcast
      // body anim + the weapon swing together. Clamped to its home + walls.
      if(this.atkTime>0.08 && this.atkTime<0.30){
        const lx=dx/dist, ly=dy/dist, lunge=this.spd*1.7*dt;
        const nx=this.x+lx*lunge, ny=this.y+ly*lunge;
        if(!dun.isWall(nx,this.y)) this.x=nx;
        if(!dun.isWall(this.x,ny)) this.y=ny;
        this.clampHome();
      }
      // attack flash + a forward particle "swing" burst once, right as the
      // swing starts — stands in for a dedicated attack sprite, but only
      // for archetypes that don't have one (Orc/Skeleton Crew); skel_reaper
      // and vampire play their own real attack animation instead.
      if(!this.cfg.attack && this.atkTime<dt+0.001){ this.attackFlashT=0.5; this._wantSwingFx=true; }
      if(this.atkTime>=0.55){ this.attacking=false; this.atkCd=0.6; }
    } else if(dist<this.aggro && this.playerInHome(player)){
      // The reaction beat only burns down once this one has actually noticed
      // the player, so a monster across the floor is not quietly using its
      // head start before you ever walked in.
      if(this._react>0) this._react-=dt;
      if(dist<=reach && this.atkCd<=0){
        this.attacking=true; this.atkTime=0; this.hitDone=false; this.windupT=0.22;
      } else if(dist>reach && this._react<=0){
        // chase — clamped to the home room so guards never spill out the door
        const _slow=this._slowT>0?(this._slowMul||1):1;
        // Approach on this enemy's own bearing rather than straight down the
        // line, so three of them arrive from three angles instead of forming a
        // queue behind whichever one is closest. The offset scales with how
        // far out we still are and reaches zero at ~140px, which puts every
        // strike back on the straight line — the fan-out is travel, not aim.
        const _off = this._approachOff * Math.min(1, Math.max(0, (dist-reach)/140));
        const _a = Math.atan2(dy,dx) + _off;
        let vx=Math.cos(_a)*this.spd*_slow, vy=Math.sin(_a)*this.spd*_slow;
        this._mvx=vx; this._mvy=vy;
        const nx=this.x+vx*dt, ny=this.y+vy*dt;
        if(!dun.isWall(nx,this.y)) this.x=nx;
        if(!dun.isWall(this.x,ny)) this.y=ny;
        this.clampHome();
        this.state='walk';
        chasing=true;
      }
    } else if(this.home){
      // player left (or never entered) this room — walk back to the post
      const hx=this.home.cx-this.x, hy=this.home.cy-this.y;
      const hd=Math.hypot(hx,hy);
      if(hd>26){
        const _slow2=this._slowT>0?(this._slowMul||1):1;
        this._mvx=hx/hd; this._mvy=hy/hd;
        const nx=this.x+hx/hd*this.spd*0.55*_slow2*dt, ny=this.y+hy/hd*this.spd*0.55*_slow2*dt;
        if(!dun.isWall(nx,this.y)) this.x=nx;
        if(!dun.isWall(this.x,ny)) this.y=ny;
        this.state='walk';
        chasing=true;
      }
    }
    // Unstack. After movement so it corrects wherever this frame put us, and
    // before knockback so a shove still reads as a clean shove.
    this._separate(dt, others, dun);
    if(this.attackFlashT>0) this.attackFlashT-=dt;
    if(this.windupT>0) this.windupT-=dt;
    // knockback (also clamped to the home room)
    if(Math.abs(this.kb.x)+Math.abs(this.kb.y)>0.5){
      const nx=this.x+this.kb.x*dt, ny=this.y+this.kb.y*dt;
      if(!dun.isWall(nx,this.y)) this.x=nx;
      if(!dun.isWall(this.x,ny)) this.y=ny;
      this.kb.x*=0.82; this.kb.y*=0.82;
      this.clampHome();
    }
    // v68 T14 (bug-fix): unified facing. While actually MOVING, face the
    // movement direction (chase already moves toward the player, so combat
    // feel is unchanged; walking home now correctly shows the back/side).
    // While attacking or standing inside aggro, face the player as before.
    // Knockback never flips facing (being shoved while staring the player
    // down is correct).
    const _mvMag=Math.abs(this._mvx)+Math.abs(this._mvy);
    const _fx = (this.attacking || _mvMag<=0.001) ? dx : this._mvx;
    const _fy = (this.attacking || _mvMag<=0.001) ? dy : this._mvy;
    if(_fx!==0) this.facing=_fx>0?1:-1;
    // Animation state machine: attacking plays the real attack sheet if
    // this archetype has one (skel_reaper, vampire); otherwise it holds
    // idle/walk and the swing reads via attackFlashT/hitFlash instead
    // (Orc/Skeleton Crew, which only ship Idle/Run/Death).
    if(this.useLPC){
      // LPC enemies always face the player (same feel as the hero's auto-attack
      // aim). Frame is advanced by a tiny local clock per anim: slash holds on
      // its last frame through the swing, walk/idle loop.
      this._lpcDir = lpcDirFromVec(_fx, _fy);   // v68 T14: face movement while walking
      // v80: attack anim key comes from the archetype (lpc.atk) — slash 6f,
      // thrust 8f (spear/polearm monsters) or spellcast 7f (casters).
      const atkKey = (this.lpc && this.lpc.atk) || 'slash';
      const key = this.attacking ? atkKey : (chasing ? 'walk' : 'idle');
      if(key !== this._lpcPrevKey){ this._lpcPrevKey=key; this._lpcFrame=0; this._lpcAnimT=0; }
      this._lpcAnimKey = key;
      const NF = {idle:1, walk:9, slash:6, thrust:8, spellcast:7}[key] || 1;
      const FP = {idle:1, walk:11, slash:14, thrust:16, spellcast:13}[key] || 10;
      this._lpcAnimT += dt;
      if(this._lpcAnimT >= 1/FP){ this._lpcAnimT=0; this._lpcFrame++; }
      if(key!=='idle' && key!=='walk'){ if(this._lpcFrame>=NF) this._lpcFrame=NF-1; }
      else if(this._lpcFrame>=NF) this._lpcFrame=0;
    } else if(this.dirMon){
      // directional beast: face the player, pick attack/walk/idle, advance frames
      this._dir = lpcDirFromVec(_fx, _fy);      // v68 T14: face movement while walking
      const key = (this.attacking && this.cfg.attack) ? 'attack' : (chasing ? 'walk' : 'idle');
      if(key !== this._dprev){ this._dprev=key; this._dframe=0; this._dt=0; }
      this._dkey = key;
      this._advanceDir(dt);
    } else {
      this.anim.loop=true;
      if(this.attacking && this.cfg.attack){ this.anim.set(this.cfg.attack,'attack'); }
      else if(chasing){ this.anim.set(this.cfg.walk||this.cfg.idle,'walk'); }
      else { this.anim.set(this.cfg.idle,'idle'); }
      this.anim.update(dt);
    }
  }
  // Advance the directional-MON frame clock for the current anim (_dkey).
  // attack + death HOLD on their last frame; walk/idle loop.
  _advanceDir(dt){
    const c=this.cfg[this._dkey]||this.cfg.walk; if(!c) return;
    const fps=c.fps||9, nf=c.frames||1;
    this._dt+=dt;
    if(this._dt>=1/fps){ this._dt=0; this._dframe++; }
    if(this._dkey==='attack'||this._dkey==='death'){ if(this._dframe>=nf) this._dframe=nf-1; }
    else if(this._dframe>=nf) this._dframe=0;
  }
  // Draw the current directional-MON frame: row = direction (or fixed row for
  // oneDir anims like death), column = col0 + frame. No horizontal flip (these
  // sheets carry real left/right rows). Returns false if the sheet isn't cached.
  _drawDir(ctx, alpha){
    const c=this.cfg[this._dkey]||this.cfg.walk; if(!c) return false;
    const im=imgGet(c.src); if(!im) return false;
    const fw=c.fw||64, fh=c.fh||64;
    const row = c.oneDir ? (c.row||0) : this._dir;
    const f = Math.max(0, Math.min(this._dframe, (c.frames||1)-1));
    const sx = ((c.col0||0) + f) * fw, sy = row * fh;
    const scale = this.cfg.scale*(this._scaleMul||1);
    const ft = this.cfg.foot||0.9;
    const dw=fw*scale, dh=fh*scale;
    const dx=this.x-dw/2, dy=this.y-dh*ft;
    ctx.save(); ctx.imageSmoothingEnabled=false;
    ctx.globalAlpha=Math.max(0,Math.min(1,alpha));
    ctx.drawImage(im, sx,sy, fw,fh, dx,dy, dw,dh);
    ctx.restore();
    return true;
  }
  // Consumes the one-shot "play a swing particle burst now" flag — game.js
  // checks this each frame after calling enemy.update() and calls spark()
  // at the enemy's position if it's true, then it's cleared.
  takeSwingFx(){ const v=this._wantSwingFx; this._wantSwingFx=false; return v; }
  takeWantHit(){ const d=this._wantHit; this._wantHit=0; return d; }
  draw(ctx){
    const scale=this.cfg.scale*(this._scaleMul||1);
    let a=1;
    if(this.spawnT>0) a=1-this.spawnT/0.45;
    if(this.dead) a=Math.max(0,Math.min(1, this.deathT/0.35));
    // elite aura
    if(this.elite && !this.dead){
      const pulse=0.5+0.5*Math.sin((performance.now()/300));
      ctx.save(); ctx.globalAlpha=0.25*a*(0.6+pulse*0.4);
      const grd=ctx.createRadialGradient(this.x,this.y-this.r*0.6,2,this.x,this.y-this.r*0.6,this.r*2.4);
      grd.addColorStop(0,'#ffae00'); grd.addColorStop(1,'rgba(255,174,0,0)');
      ctx.fillStyle=grd; ctx.beginPath();
      ctx.arc(this.x,this.y-this.r*0.6,this.r*2.4,0,Math.PI*2); ctx.fill(); ctx.restore();
    }
    // shadow
    // Was centre y+6, half-height 6: the whole ellipse sat below the feet
    // line, which is the same detached-puddle look the player's own shadow was
    // fixed for at +2 (see the comment above Player.draw's shadow). Matched to
    // that tuning rather than invented — enemies stand on the same floor.
    ctx.save(); ctx.globalAlpha=0.3*a; ctx.fillStyle='#000';
    ctx.beginPath(); ctx.ellipse(this.x,this.y+2,this.r*1.15,5,0,0,7); ctx.fill(); ctx.restore();
    if(this.windupT>0 && !this.dead){
      const pulse=1-this.windupT/0.22;
      ctx.save(); ctx.globalCompositeOperation='lighter';
      ctx.globalAlpha=0.25+pulse*0.35;
      ctx.strokeStyle=this.elite?'#ffd166':'#ff5d54'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(this.x,this.y,this.r+10+pulse*8,0,Math.PI*2); ctx.stroke();
      ctx.restore();
    }
    const flip=this.facing>0; // monster sheets face left by default → flip for right
    const ft=this.cfg.foot||0.9;
    if(this.useLPC){
      const L=this.lpc||{};
      // v80: LPC monsters pass their baked body base + attack anim key; the
      // weapon overlay animKey must match the archetype's atk pose so the
      // ULPC overlay sheets line up (slash/thrust; casters attack bare-handed).
      const _atk = L.atk || 'slash';
      const drew = drawLPCComposite(ctx, this.x, this.y, scale, this._lpcDir, this._lpcFrame, {
        animKey:this._lpcAnimKey, attacking:this.attacking, weaponAnim:_atk,
        monBase:L.monBase,
        armorId:L.armorId, weaponId:L.weaponId, weaponTint:L.weaponTint||null, tint:L.tint, tintAlpha:L.tintAlpha,
        foot:ft, alpha:a,
      });
      if(!drew){
        // LPC sheets not cached yet — draw a simple silhouette so the enemy is
        // never invisible (mirrors the hero's placeholder fallback).
        ctx.save(); ctx.globalAlpha=a; ctx.fillStyle=this.arch.color||'#7a5a9a';
        ctx.beginPath(); ctx.arc(this.x,this.y-this.r*0.4,this.r,0,Math.PI*2); ctx.fill(); ctx.restore();
      } else if(this.hitFlash>0){
        // white hit-flash via the same masked-tint path (no 'lighter' double-draw
        // — LPC layers would over-brighten and misalign).
        drawLPCComposite(ctx, this.x, this.y, scale, this._lpcDir, this._lpcFrame, {
          animKey:this._lpcAnimKey, attacking:this.attacking, weaponAnim:_atk,
          monBase:L.monBase,
          armorId:L.armorId, weaponId:L.weaponId, weaponTint:L.weaponTint||null,
          tint:'#ffffff', tintAlpha:Math.min(0.85,this.hitFlash*3.5), foot:ft, alpha:a,
        });
      }
    } else if(this.dirMon){
      const drew = this._drawDir(ctx, a);
      if(!drew){
        ctx.save(); ctx.globalAlpha=a; ctx.fillStyle=this.arch.color||'#888';
        ctx.beginPath(); ctx.arc(this.x,this.y-this.r*0.4,this.r,0,Math.PI*2); ctx.fill(); ctx.restore();
      } else if(this.hitFlash>0){
        ctx.save(); ctx.globalCompositeOperation='lighter';
        this._drawDir(ctx, this.hitFlash*3);
        ctx.restore();
      }
    } else {
      this.anim.draw(ctx,this.x,this.y,scale,flip,ft,a);
      if(this.hitFlash>0){
        ctx.save(); ctx.globalCompositeOperation='lighter';
        this.anim.draw(ctx,this.x,this.y,scale,flip,ft,this.hitFlash*3);
        ctx.restore();
      }
    }
    // Frost Spear slow tell: a soft light-blue overlay + faint icy ring
    // while _slowT is active, so the player can see the enemy is chilled.
    // The overlay is composited on an offscreen scratch canvas (see
    // _getTintCtx above) so it only tints this sprite's own drawn pixels,
    // not whatever floor/decor happens to be behind it on the main canvas.
    if(this._slowT>0 && !this.dead){
      const _im=imgGet(this.cfg.src);
      if(_im){
        const _fw=this.cfg.fw||24, _fh=this.cfg.fh||24;
        const _dw=_fw*scale, _dh=_fh*scale;
        const tctx=_getTintCtx(_dw,_dh);
        tctx.save();
        tctx.imageSmoothingEnabled=false;
        if(flip){ tctx.translate(_dw,0); tctx.scale(-1,1); }
        tctx.drawImage(_im, this.anim.frame*_fw,0,_fw,_fh, 0,0,_dw,_dh);
        tctx.globalCompositeOperation='source-atop';
        tctx.globalAlpha=0.35;
        tctx.fillStyle='#8fd8ff';
        tctx.fillRect(0,0,_dw,_dh);
        tctx.restore();
        const _dx=this.x-_dw/2, _dy=this.y-_dh*ft;
        ctx.save();
        ctx.drawImage(_tintCanvas,0,0,_dw,_dh, _dx,_dy,_dw,_dh);
        ctx.restore();
      }
      ctx.save();
      ctx.globalAlpha=0.5+0.2*Math.sin(performance.now()/140);
      ctx.strokeStyle='#bdeeff'; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.arc(this.x,this.y,this.r+4,0,Math.PI*2); ctx.stroke();
      ctx.restore();
    }
    // attack-swing flash: a sweeping pixel-art claw slash standing in for a
    // dedicated attack sprite (the source sheets only have Idle/Run/Death).
    if(this.attackFlashT>0 && !this.dead){
      const sa=Math.min(1,this.attackFlashT/0.5);
      const prog=1-this.attackFlashT/0.5;
      const dir=this.facing>0?1:-1;
      const base=this.facing>0?0:Math.PI;
      const lead=base+dir*(-0.95+1.9*prog);
      const cx=this.x+this.facing*this.r*0.7, cy=this.y-this.r*0.3;
      ctx.save();
      ctx.globalCompositeOperation='lighter';
      pixelArc(ctx, cx, cy, this.r*1.1, lead-dir*0.7, lead, 3, this.elite?'#ffd166':'#ff8a7a', sa*0.9);
      pixelArc(ctx, cx, cy+3, this.r*0.85, lead-dir*0.45, lead, 2, '#ffffff', sa*0.45);
      ctx.restore();
    }
    // hp bar
    if(!this.dead && this.spawnT<=0){
      const w=this.r*2.2, hpw=w*(this.hp/this.maxHp);
      const by=this.y-this.r*2.0;
      ctx.fillStyle='rgba(0,0,0,.6)'; ctx.fillRect(this.x-w/2,by,w,5);
      ctx.fillStyle=this.isBoss?'#ff3b5c':(this.elite?'#ffae00':'#ff5d54'); ctx.fillRect(this.x-w/2,by,Math.max(0,hpw),5);
      if((this.isBoss || this.elite) && window.NS_QUEUE_NAMEPLATE){
        // Nameplate is queued and drawn later in screen-space (after the
        // camera transform is popped) so it can be clamped to stay fully
        // on-screen instead of clipping off the edge of a narrow viewport.
        window.NS_QUEUE_NAMEPLATE(this, by-6);
      }
    }
  }
}
window.NS_ENT={Anim,Player,Enemy,drawLPCComposite,lpcDirFromVec};
