/* ============================================================
   NULL_STATE :: OUTDOOR  (side-scroll narrative scenes between bunkers)
   ------------------------------------------------------------
   A lightweight second "mode" alongside the dungeon: a static
   background, the player sprite walking left/right only (no
   up/down, no dungeon collision grid, NO camera scroll — the
   playable area is exactly the screen width), speech-bubble
   lines on arrival, and a glowing right-arrow trail guiding the
   player to the right edge of the screen, which is where the
   scene ends (no in-world door object — reaching the edge itself
   triggers the transition). Reuses the same Anim/Player rendering
   primitives as the dungeon so the character reads identically
   in both modes.
   ============================================================ */
window.NS_OUTDOOR = (function(){
  const { Anim } = window.NS_ENT;
  // drawLPCComposite/lpcDirFromVec aren't exported on window.NS_ENT (they're
  // module-private helpers used internally by Player.draw()), so grab them
  // off the shared entities module the same way the rest of this file reads
  // Anim. If NS_ENT ever adds them to its public surface this still works.
  const drawLPCComposite = window.NS_ENT.drawLPCComposite;
  const lpcDirFromVec = window.NS_ENT.lpcDirFromVec;

  // Player's feet, as a fraction of canvas height. The outdoor backgrounds are
  // cropped so their walkable ground sits at exactly this fraction (see
  // public/backgrounds/*.webp — 941x1210, ground line at 0.80), so the
  // character stands ON the terrain instead of floating in the scenery. Change
  // one and the other has to be re-cropped to match.
  const GROUND_Y_FRAC = 0.80;

  // The hero's base scale (assets.js LPC_HERO.scale = 1.2, ~56px tall) was
  // calibrated for the DUNGEON, which draws through a camera zoom in tight
  // rooms. Out here there is no zoom and the backgrounds put the character
  // beside three-storey bunker doors and full-height pines, so at 1:1 the
  // hero reads as a speck. This multiplier is the outdoor-only correction —
  // raise it if the character still looks lost against the scenery.
  const HERO_SCALE_MUL = 1.5;
  const EDGE_MARGIN = 36; // how close to the literal screen edge the player can walk before being clamped/triggering the exit

  let state = null; // null when not in an outdoor scene

  function enter(actIndex, campaign, opts){
    const act = campaign[actIndex];
    // Phase 7: thread a quiet weapon-evolution bark into this act's arrival
    // beat — only on a FRESH arrival (skipped on a post-bunker resume, where
    // arrival doesn't play), and only once per newly-reached tier (game.js's
    // NS_takeEvolveBark tracks acknowledgement + returns [] when nothing new).
    let _evoBark = [];
    if(!opts.resumeAtDoor){
      try{ _evoBark = (window.NS_takeEvolveBark && window.NS_takeEvolveBark(actIndex)) || []; }catch(e){ _evoBark = []; }
    }
    const arrivalLines = (act.arrival || []).concat(_evoBark);
    state = {
      act, actIndex, campaign, arrivalLines,
      heroCfg: opts.heroCfg, charKey: opts.charKey,
      // x is a SCREEN-space position (0..cw), not world-space — there is
      // no camera to scroll, the screen width IS the walkable strip.
      // #8 FIX (this session): this used to be `opts.resumeAtDoor ? 0.78
      // : 0.12` — i.e. after clearing a bunker (resumeAtDoor:true, see
      // onActBunkerCleared() in game.js) the player popped back onto the
      // surface already standing at 0.78 (near the RIGHT edge/door),
      // barely needing to walk before the door immediately re-triggered.
      // Per the reported bug ("harusnya mulai dari SISI KIRI... sekarang
      // malah muncul di sisi kanan"), spawn side should always be the
      // left, regardless of resumeAtDoor — resumeAtDoor's only remaining
      // job is skipping the arrival speech-bubble beat below (postBunker
      // dialogue is already shown separately via the cutscene panel), not
      // choosing which side of the screen the player appears on.
      xFrac: 0.12, // fraction of screen width, resolved to pixels in render()/update() — always start from the left
      facing: 1, walking: false,
      anim: new Anim(),
      phase: opts.resumeAtDoor ? 'free' : 'arrival', // 'arrival' -> speech bubbles play first
      arrivalIdx: 0, arrivalT: 0,
      bubble: null, bubbleT: 0,
      edgeTriggered: false,
      bunkerCleared: !!opts.bunkerCleared,
      onReachDoor: opts.onReachDoor, // callback into game.js to start the dark transition into the bunker (or to the next act, if bunkerCleared)
      lastCw: opts.canvasWidth || 360, // updated each render call; seeded from the real canvas width so there's no incorrect-width frame before the first render
      // ---- LPC hero rendering state (same gate/fields as Player in
      // entities.js) — fixes the outdoor scene showing the old Pixel
      // Crawler knight sprite while the dungeon shows the LPC hero, which
      // read as two different characters.
      // v80 (owner bug report): outdoor now ALSO wears the equipped gear —
      // game.js passes weaponId/armorId (live G state, else the persisted
      // per-wallet cache via currentEquippedIds()) so what the player
      // equipped before saving/leaving stays on their back outdoors too.
      useLPCHero: opts.charKey === 'knight',
      weaponId: opts.weaponId || null,
      armorId: opts.armorId || null,
      outfitId: opts.outfitId || null, // Phase 9 cosmetic skin — carry it outdoors too

      _lpcDir: 2, _lpcFrame: 0, _lpcT: 0, _lpcAnimKey: 'idle',
    };
    state.anim.set(state.heroCfg.idle, 'idle');
    if(state.phase==='arrival') showNextArrival();
  }
  function exit(){ state = null; }
  function active(){ return !!state; }
  function currentBgKey(){ return state ? state.act.bg : null; }
  function isBlockingInput(){ return state && state.phase==='arrival'; }

  // #7 — arrival speech bubbles used to ONLY advance on their own timer
  // (state.bubbleT counting down in update()), with no way for the player
  // to skip ahead. Called from a tap/click listener in game.js while
  // isBlockingInput() is true, so a tap instantly shows the next line
  // instead of forcing the player to wait out the read-timer for every
  // line. No-op outside the arrival phase (nothing to skip).
  function skipArrival(){
    if(!state || state.phase!=='arrival') return;
    showNextArrival();
  }

  // Phase 1 energy gate: when a bunker entry is DENIED (out of energy), the
  // door trigger must release and the hero steps back from the edge —
  // otherwise edgeTriggered stays latched (and the near-edge failsafe would
  // re-fire forever) and the player could never move again after a refill.
  function retreatFromDoor(){
    if(!state) return;
    state.edgeTriggered = false;
    state.nearEdgeT = 0;
    state.xFrac = Math.min(state.xFrac, 0.62); // step back clear of the trigger band
  }

  function showNextArrival(){
    const lines = state.arrivalLines || state.act.arrival;
    if(state.arrivalIdx >= lines.length){
      state.phase = 'free';
      state.bubble = null;
      return;
    }
    state.bubble = lines[state.arrivalIdx];
    state.bubbleT = 2.6 + Math.min(2.5, lines[state.arrivalIdx].length*0.045);
    state.arrivalIdx++;
  }

  function update(dt, input){
    if(!state) return;
    const s = state;

    if(s.phase==='arrival'){
      s.bubbleT -= dt;
      s.anim.set(s.heroCfg.idle,'idle'); s.anim.update(dt);
      if(s.useLPCHero){ s._lpcDir = lpcDirFromVec(s.facing, 0); s._lpcFrame = 0; s._lpcAnimKey = 'idle'; }
      if(s.bubbleT<=0) showNextArrival();
      return;
    }

    // free walk — left/right only, in literal screen pixels (no camera)
    let mx = (input.right?1:0) - (input.left?1:0);
    s.walking = mx!==0;
    if(mx!==0) s.facing = mx;
    const sp = 150;
    const cw = s.lastCw;
    let px = s.xFrac*cw + mx*sp*dt;
    px = Math.max(EDGE_MARGIN, Math.min(cw-EDGE_MARGIN, px));
    s.xFrac = px/cw;

    if(s.walking){ s.anim.loop=true; s.anim.set(s.heroCfg.walk,'walk'); }
    else { s.anim.loop=true; s.anim.set(s.heroCfg.idle,'idle'); }
    s.anim.update(dt);

    // ---- LPC animation state (mirrors Player.update() in entities.js,
    // minus attack handling — the player can't attack in outdoor scenes)
    if(s.useLPCHero){
      s._lpcDir = lpcDirFromVec(s.facing, 0); // outdoor is left/right-only
      const A = window.NS_ASSETS;
      if(s.walking){
        const walkCfg = A ? A.LPC_HERO.walk : null;
        const fps = (walkCfg&&walkCfg.fps) || 12;
        s._lpcT += dt;
        if(s._lpcT >= 1/fps){
          s._lpcT = 0;
          s._lpcFrame = (s._lpcFrame+1) % ((walkCfg&&walkCfg.frames)||9);
        }
        s._lpcAnimKey = 'walk';
      } else {
        s._lpcFrame = 0; s._lpcT = 0; s._lpcAnimKey = 'idle';
      }
    }

    // Reaching the literal edge triggers the transition immediately (the
    // normal path). As a safety net against any floating-point/timing edge
    // case that could keep px just shy of the exact boundary forever, also
    // track how long the player has been sitting in a wide "near edge"
    // band and force the transition after a couple of seconds there —
    // guarantees the player can never get permanently stuck unable to
    // enter the bunker.
    const nearEdge = px >= cw-EDGE_MARGIN-40;
    if(!s.edgeTriggered && nearEdge){
      s.nearEdgeT = (s.nearEdgeT||0) + dt;
      if(px >= cw-EDGE_MARGIN || s.nearEdgeT >= 2.0){
        s.edgeTriggered = true;
        s.onReachDoor && s.onReachDoor();
      }
    } else {
      s.nearEdgeT = 0;
    }
  }

  function render(ctx, cw, ch, bgImg){
    if(!state) return;
    const s = state;
    s.lastCw = cw;
    const px = s.xFrac*cw, py = ch*GROUND_Y_FRAC;

    // background — scaled to cover the canvas, no panning (static, since
    // there's no camera scroll in this redesign).
    if(bgImg){
      const scale = Math.max(cw/bgImg.width, ch/bgImg.height);
      const dw = bgImg.width*scale, dh = bgImg.height*scale;
      // Anchor the art's OWN ground line (cropped to GROUND_Y_FRAC — see the
      // constant above) to the canvas ground line, instead of centring the
      // image. When the image exactly fills the height (portrait phones) this
      // is identical to centring; when the canvas is wider than the art and
      // cover crops vertically, it keeps the character standing on ground
      // rather than letting the horizon drift off-screen. Clamped so the crop
      // can never expose empty space past either edge.
      let dy = py - GROUND_Y_FRAC*dh;
      dy = Math.min(0, Math.max(ch-dh, dy));
      ctx.drawImage(bgImg, (cw-dw)/2, dy, dw, dh);
    } else {
      ctx.fillStyle = '#0a1410'; ctx.fillRect(0,0,cw,ch);
    }
    // ground shadow strip so the character doesn't look like it's floating
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    ctx.fillRect(0, py+18, cw, ch-py-18);

    // animated glowing right-arrow trail guiding the player toward the
    // right edge of the screen — replaces the old in-world door marker.
    if(!s.edgeTriggered && s.phase==='free'){
      drawArrowTrail(ctx, px, py, cw);
    }

    // player shadow + sprite
    ctx.save(); ctx.globalAlpha=0.35; ctx.fillStyle='#000';
    // Same fix as Player.draw() in entities.js (see comment there): the LPC
    // hero's feet sit exactly at py, so a large fixed offset leaves a gap
    // between the character and its shadow. Matched to +2 for visual
    // consistency between outdoor and dungeon scenes. Shadow scales with the
    // hero so it never detaches from the feet.
    const sc = HERO_SCALE_MUL;
    ctx.beginPath(); ctx.ellipse(px, py+2, 18*sc, 6*sc, 0, 0, 7); ctx.fill(); ctx.restore();
    let drewLPC = false;
    if(s.useLPCHero && drawLPCComposite){
      const A = window.NS_ASSETS;
      const heroCfg = A && A.LPC_HERO;
      drewLPC = !!heroCfg && drawLPCComposite(ctx, px, py, heroCfg.scale*sc, s._lpcDir, s._lpcFrame, {
        animKey: s._lpcAnimKey || 'idle',
        // v80: equipped gear visible outdoors (never attacking out here, so
        // the weapon renders via the ULPC walk/idle carry overlay).
        weaponId: s.weaponId || undefined,
        armorId: s.armorId || undefined,
        outfitId: s.outfitId || undefined,
      });
    }
    if(!drewLPC){
      // Either useLPCHero is off, or the LPC sheets aren't loaded yet —
      // fall back to the old Pixel Crawler sprite so the player is never
      // invisible (same defensive fallback as Player.draw() in entities.js).
      s.anim.draw(ctx, px, py, s.heroCfg.scale*sc, s.facing<0, s.heroCfg.foot, 1);
    }

    // speech bubble above the player's head (arrival beats)
    if(s.bubble){
      drawSpeechBubble(ctx, px, py - 86, s.bubble, cw);
    }
  }

  // A trail of 3 chevron arrows between the player and the right edge of
  // the screen, pulsing/animating in sequence to read as "this way ->".
  function drawArrowTrail(ctx, px, py, cw){
    const rightEdge = cw - EDGE_MARGIN;
    const trailStart = px + 50;
    if(trailStart >= rightEdge - 20) return; // too close to the edge, arrows would overlap the player
    const count = 3;
    const span = rightEdge - trailStart;
    const t = performance.now()/1000;
    ctx.save();
    for(let i=0;i<count;i++){
      const baseX = trailStart + (span/count)*i + (span/count)*0.5;
      const pulse = (Math.sin(t*2.2 - i*0.8)+1)/2; // staggered pulse, travels left->right over time
      const alpha = 0.25 + pulse*0.55;
      const ax = baseX, ay = py;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#00ff88';
      ctx.beginPath();
      ctx.moveTo(ax-9, ay-11);
      ctx.lineTo(ax+5, ay);
      ctx.lineTo(ax-9, ay+11);
      ctx.lineTo(ax-3, ay);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawSpeechBubble(ctx, x, y, text, cw){
    ctx.save();
    ctx.font = '12px "Share Tech Mono"';
    const maxW = Math.min(280, cw*0.7);
    const words = text.split(' ');
    const lines = []; let cur='';
    for(const w of words){
      const test = cur ? cur+' '+w : w;
      if(ctx.measureText(test).width > maxW && cur){ lines.push(cur); cur=w; }
      else cur = test;
    }
    if(cur) lines.push(cur);
    const lineH = 16, padX=12, padY=10;
    const boxW = Math.min(maxW, Math.max(...lines.map(l=>ctx.measureText(l).width))) + padX*2;
    const boxH = lines.length*lineH + padY*2;
    let bx = x - boxW/2; bx = Math.max(8, Math.min(cw-boxW-8, bx));
    const by = y - boxH;
    ctx.fillStyle = 'rgba(6,10,13,.88)';
    ctx.strokeStyle = 'rgba(0,255,136,.35)'; ctx.lineWidth=1;
    ctx.beginPath();
    if(ctx.roundRect) ctx.roundRect(bx, by, boxW, boxH, 6); else ctx.rect(bx,by,boxW,boxH);
    ctx.fill(); ctx.stroke();
    // little pointer tail toward the player
    ctx.beginPath();
    ctx.moveTo(x-6, by+boxH); ctx.lineTo(x+6, by+boxH); ctx.lineTo(x, by+boxH+8); ctx.closePath();
    ctx.fillStyle='rgba(6,10,13,.88)'; ctx.fill();
    ctx.fillStyle = '#cfeede'; ctx.textAlign='left'; ctx.textBaseline='top';
    lines.forEach((l,i)=> ctx.fillText(l, bx+padX, by+padY+i*lineH));
    ctx.restore();
  }

  return { enter, exit, active, isBlockingInput, currentBgKey, update, render, skipArrival, retreatFromDoor };
})();
