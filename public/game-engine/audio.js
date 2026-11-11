/* ============================================================
   NULL_STATE :: AUDIO ENGINE  (Web Audio synthesized)
   - Calming evolving ambient pad loop (dungeon-ish)
   - SFX: attack (+ per-weapon attackFor), hit, enemy death, levelup, descend, pickup, hurt
   ============================================================ */
const Audio = (() => {
  let ctx = null;
  let master = null, musicGain = null, sfxGain = null;
  let started = false;
  // "muted" here ONLY controls the ambient music bed — it must NEVER touch
  // sfxGain. Previously toggleMute() zeroed both gains, so turning the
  // "Sound" switch off in Settings silently killed SFX too, and there was
  // no way to have music off with SFX still audible (or vice versa).
  let muted = false;
  let padTimer = null;
  let musicVolume = 0.75; // 0..1, master Volume slider — scales BOTH music and SFX together
  let sfxEnabled = true;  // independent on/off for sound effects, untouched by the music mute switch

  // soft reverb via convolver (synthetic impulse)
  let reverb = null;
  function makeReverb(seconds = 2.6, decay = 2.4) {
    const rate = ctx.sampleRate, len = rate * seconds;
    const buf = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++)
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    const c = ctx.createConvolver(); c.buffer = buf; return c;
  }

  function init() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    reverb = makeReverb();
    const revGain = ctx.createGain(); revGain.gain.value = 0.32;
    reverb.connect(revGain); revGain.connect(master);

    musicGain = ctx.createGain(); musicGain.gain.value = 0.0; // fade in
    musicGain.connect(master); musicGain.connect(reverb);
    sfxGain = ctx.createGain(); sfxGain.gain.value = sfxEnabled ? 0.85 * musicVolume : 0;
    sfxGain.connect(master); sfxGain.connect(reverb);
  }

  // ---- ambient music: slow minor pad arpeggio + drone ----
  // A minor-ish calm set
  const SCALE = [220.00, 261.63, 293.66, 329.63, 392.00, 440.00, 523.25]; // A C D E G A C
  function padNote(freq, t, dur, vol) {
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
    const g = ctx.createGain(), f = ctx.createBiquadFilter();
    o1.type = 'triangle'; o2.type = 'sine';
    o1.frequency.value = freq; o2.frequency.value = freq * 2.003; // slight detune shimmer
    f.type = 'lowpass'; f.frequency.value = 900; f.Q.value = 0.6;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + dur * 0.4);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o1.connect(g); o2.connect(g); g.connect(f); f.connect(musicGain);
    o1.start(t); o2.start(t); o1.stop(t + dur + 0.1); o2.stop(t + dur + 0.1);
  }
  function drone(freq, t, dur) {
    const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.value = freq;
    f.type = 'lowpass'; f.frequency.value = 320;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05, t + 2);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(f); f.connect(musicGain);
    o.start(t); o.stop(t + dur + 0.1);
  }

  let step = 0;
  function scheduleBar() {
    if (!ctx) return;
    const t = ctx.currentTime + 0.05;
    // arpeggio of 4 soft notes spread over ~6.4s
    const base = SCALE[step % SCALE.length];
    drone(110, t, 7.0);
    for (let i = 0; i < 4; i++) {
      const n = SCALE[(step + i * 2) % SCALE.length];
      padNote(n, t + i * 1.6, 2.6, 0.12);
    }
    // occasional high shimmer
    if (Math.random() < 0.5) padNote(SCALE[6] * 2, t + 3.2, 3.0, 0.05);
    step++;
  }
  function startMusic() {
    if (padTimer) return;
    scheduleBar();
    padTimer = setInterval(scheduleBar, 6400);
    musicGain.gain.cancelScheduledValues(ctx.currentTime);
    musicGain.gain.setValueAtTime(musicGain.gain.value, ctx.currentTime);
    musicGain.gain.linearRampToValueAtTime(muted ? 0 : 0.5 * musicVolume, ctx.currentTime + 4);
    // sfxGain isn't touched here — SFX availability is controlled solely by
    // toggleSfx(), independent of the music starting up.
  }

  // ---- SFX helpers ----
  function env(g, t, a, d, peak) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  function noise(dur) {
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const s = ctx.createBufferSource(); s.buffer = buf; return s;
  }

  function attack() {
    if (!ctx) return; const t = ctx.currentTime;
    // whoosh
    const n = noise(0.22), g = ctx.createGain(), f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.setValueAtTime(1800, t);
    f.frequency.exponentialRampToValueAtTime(420, t + 0.2);
    env(g, t, 0.01, 0.2, 0.5); n.connect(f); f.connect(g); g.connect(sfxGain); n.start(t); n.stop(t + 0.25);
    // blade ring
    const o = ctx.createOscillator(), g2 = ctx.createGain();
    o.type = 'square'; o.frequency.setValueAtTime(640, t); o.frequency.exponentialRampToValueAtTime(180, t + 0.12);
    env(g2, t, 0.005, 0.13, 0.18); o.connect(g2); g2.connect(sfxGain); o.start(t); o.stop(t + 0.16);
  }
  // ---- per-weapon attack SFX (v76 Task #7) ----------------------------------
  // Every marketplace weapon names a `sfx` kind in NS_WEAPON (assets.js) and
  // hitTest() routes it here via Audio.attackFor(kind). All synthesized — no
  // audio files, so the MiniPay bundle gains zero bytes. Unknown kind (or no
  // weapon equipped) falls through to the original attack() whoosh, so the
  // bare-fist sound is unchanged.
  //
  // Design brief from the owner: arrow = arrow sound, sword = "sing sing sing",
  // axe = axe biting wood, katana = sword-like, club = wooden knock.
  function _whoosh(t, f0, f1, dur, peak){
    const n = noise(dur), g = ctx.createGain(), f = ctx.createBiquadFilter();
    f.type='bandpass'; f.Q.value=0.9;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(f1, t+dur*0.9);
    env(g, t, 0.008, dur, peak);
    n.connect(f); f.connect(g); g.connect(sfxGain); n.start(t); n.stop(t+dur+0.02);
  }
  function _tone(t, type, f0, f1, dur, peak, delay){
    const o = ctx.createOscillator(), g = ctx.createGain();
    const st = t + (delay||0);
    o.type = type;
    o.frequency.setValueAtTime(f0, st);
    o.frequency.exponentialRampToValueAtTime(Math.max(1,f1), st+dur);
    env(g, st, 0.004, dur, peak);
    o.connect(g); g.connect(sfxGain); o.start(st); o.stop(st+dur+0.03);
  }
  function _thud(t, f0, f1, dur, peak){
    const n = noise(dur), g = ctx.createGain(), f = ctx.createBiquadFilter();
    f.type='lowpass';
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(f1, t+dur);
    env(g, t, 0.004, dur, peak);
    n.connect(f); f.connect(g); g.connect(sfxGain); n.start(t); n.stop(t+dur+0.02);
  }
  // resonant woody/metal body — bandpass ring with a Q, the difference between
  // "hitting wood" and "hitting a bell"
  function _body(t, freq, q, dur, peak){
    const n = noise(dur), g = ctx.createGain(), f = ctx.createBiquadFilter();
    f.type='bandpass'; f.frequency.value=freq; f.Q.value=q;
    env(g, t, 0.003, dur, peak);
    n.connect(f); f.connect(g); g.connect(sfxGain); n.start(t); n.stop(t+dur+0.02);
  }

  // v80 "seram" helpers — the menace layer under every weapon voice:
  // _sub = a deep sine drop you feel more than hear (60->30Hz territory);
  // _crackle = sparse random resonant pops (embers, splintering ice, sparks).
  function _sub(t, f0, f1, dur, peak, delay){
    const o = ctx.createOscillator(), g = ctx.createGain();
    const st = t + (delay||0);
    o.type='sine';
    o.frequency.setValueAtTime(f0, st);
    o.frequency.exponentialRampToValueAtTime(Math.max(18,f1), st+dur);
    env(g, st, 0.006, dur, peak);
    o.connect(g); g.connect(sfxGain); o.start(st); o.stop(st+dur+0.03);
  }
  function _crackle(t, count, baseFreq, spread, peak, delay){
    const st = t + (delay||0);
    for(let i=0;i<count;i++){
      const d = Math.random()*spread;
      _body(st+d, baseFreq*(0.7+Math.random()*0.9), 14, 0.03, peak*(0.5+Math.random()*0.5));
    }
  }

  // v80: every weapon gets its OWN voice (owner spec: "suara seram, berbeda-
  // beda setiap senjata"). Shared DNA: a sub-bass menace layer + downward
  // pitch bends; on top each weapon keeps a signature the ear can name.
  const WEAPON_SFX = {
    // RUSTY BLADE: dull gritty steel — a rasping scrape instead of a clean
    // sing (rust doesn't sing), with a low growl under the cut.
    blade(t){
      _whoosh(t, 1900, 380, 0.22, 0.40);
      _body(t+0.02, 950, 3.2, 0.16, 0.26);          // gritty scrape band
      _tone(t+0.02, 'sawtooth', 640, 260, 0.14, 0.09);
      _tone(t, 'triangle', 1450, 700, 0.14, 0.11, 0.03); // dull half-sing
      _sub(t, 95, 42, 0.20, 0.20, 0.04);
    },
    // ANCIENT BLADE: ceremonial and huge — slow heavy cut, a two-tone golden
    // sing (open fifth), and a cathedral-deep sub drop.
    ancient(t){
      _whoosh(t, 2100, 420, 0.26, 0.42);
      _tone(t+0.03, 'triangle', 1560, 820, 0.30, 0.15);
      _tone(t+0.03, 'sine',     2340, 1230, 0.34, 0.10);  // fifth above
      _tone(t+0.07, 'sine',     3120, 1640, 0.30, 0.05);  // octave shimmer
      _sub(t, 110, 34, 0.34, 0.30, 0.05);
      _body(t+0.05, 520, 9.0, 0.20, 0.12);          // bronze bell body
    },
    // VOID KATANA: the iai draw-cut — instant hiss, thin glassy sing, and an
    // unsettling detuned void-growl swallowing the tail.
    katana(t){
      _whoosh(t, 3400, 900, 0.12, 0.42);
      _tone(t+0.01, 'triangle', 2700, 1400, 0.20, 0.16);
      _tone(t+0.02, 'sine',     3900, 2300, 0.24, 0.08);
      _tone(t+0.04, 'sine',     5200, 3600, 0.14, 0.05);  // shimmer
      _tone(t+0.06, 'sawtooth', 150, 46, 0.28, 0.11);     // void growl
      _tone(t+0.06, 'sawtooth', 157, 49, 0.28, 0.11);     // detuned twin (beating)
      _sub(t+0.05, 68, 26, 0.30, 0.26);
    },
    // ARGENT WARAXE: heavy swing, brutal bite, silver ring — the axe you hear
    // coming a room away.
    axe(t){
      _whoosh(t, 1300, 260, 0.20, 0.36);
      _sub(t, 85, 36, 0.22, 0.24, 0.02);             // shoulder-drop menace
      _thud(t+0.12, 900, 80, 0.16, 0.55);            // the bite
      _body(t+0.12, 620, 5.0, 0.13, 0.32);           // timber resonance
      _body(t+0.13, 2400, 12.0, 0.10, 0.18);         // argent ring
      _tone(t+0.12, 'triangle', 190, 58, 0.18, 0.34);
      _body(t+0.17, 1500, 9.0, 0.06, 0.14);          // splinter crack
    },
    // EMBERWOOD MAUL: smouldering timber — dull crushing knock plus a spray
    // of ember crackles and a furnace-deep boom.
    wood(t){
      _whoosh(t, 900, 210, 0.17, 0.28);
      _thud(t+0.11, 620, 60, 0.16, 0.52);
      _body(t+0.11, 330, 6.5, 0.16, 0.38);           // hollow wood body
      _tone(t+0.11, 'triangle', 150, 50, 0.18, 0.28);
      _sub(t+0.11, 100, 32, 0.26, 0.30);             // furnace boom
      _crackle(t, 5, 2600, 0.22, 0.10, 0.13);        // embers spitting
    },
    // SUNFIRE BOW: string creak, fiery release — the arrow leaves burning
    // (flame rumble + sizzling sparks trailing the whistle).
    bow(t){
      _tone(t, 'sawtooth', 230, 140, 0.12, 0.22);    // string release
      _body(t, 700, 7.0, 0.07, 0.22);                // limb snap
      _tone(t+0.05, 'sine', 3000, 1300, 0.26, 0.07); // arrow whistle
      _whoosh(t+0.04, 3000, 1200, 0.18, 0.13);
      _thud(t+0.04, 420, 120, 0.24, 0.16);           // flame rumble
      _crackle(t, 6, 3400, 0.24, 0.08, 0.06);        // sparks sizzling off
      _sub(t+0.03, 80, 36, 0.20, 0.16);
    },
    // IRONBOLT CROSSBOW: all machine — ratchet clacks, a punishing stock
    // thunk you feel in the floor, short bolt hiss.
    crossbow(t){
      _body(t, 2600, 12.0, 0.03, 0.30);              // trigger clack
      _body(t+0.03, 2100, 12.0, 0.025, 0.20);        // ratchet echo clack
      _tone(t+0.01, 'square', 320, 100, 0.09, 0.22); // stock thunk
      _body(t+0.01, 480, 8.0, 0.07, 0.24);
      _sub(t+0.01, 120, 40, 0.18, 0.30);             // the kick in the floor
      _whoosh(t+0.05, 2400, 1100, 0.12, 0.13);       // bolt
    },
    // VERDANT REAPER: the scariest of the lot — a long hungry reap, two
    // dissonant tones a quarter-step apart beating against each other,
    // whispering air, and a grave-deep sub swallowing the tail.
    scythe(t){
      _whoosh(t, 1600, 220, 0.40, 0.40);             // long hungry reap
      _whoosh(t+0.16, 700, 140, 0.30, 0.14);         // second whispering pass
      _tone(t+0.05, 'sine', 622, 300, 0.36, 0.12);   // dissonant pair —
      _tone(t+0.05, 'sine', 660, 318, 0.36, 0.12);   //   beats ~-> unease
      _tone(t+0.10, 'triangle', 1250, 480, 0.28, 0.07);
      _sub(t+0.08, 64, 24, 0.42, 0.30);              // the grave under it
    },
    // FROST SPEAR: tight thrust hiss ending in glassy ice — crystalline tick
    // plus splintering frost crackles.
    spear(t){
      _whoosh(t, 2000, 900, 0.12, 0.30);
      _tone(t+0.08, 'sine', 3200, 2400, 0.09, 0.10); // glassy point
      _body(t+0.08, 2200, 10.0, 0.05, 0.16);
      _crackle(t, 5, 4200, 0.16, 0.09, 0.09);        // ice splintering
      _tone(t+0.10, 'sine', 5100, 3400, 0.14, 0.04); // cold shimmer
      _sub(t+0.02, 90, 40, 0.16, 0.16);
    },
  };
  // kind -> sound. Falls back to the generic whoosh for unknown/no weapon.
  // Phase 4/evolution (issue #4): an evolved weapon should SOUND more powerful
  // each tier. On top of the weapon's own synthesized swing we layer a bright
  // metallic "shine" whose count/brightness/loudness scale with the tier
  // (evo 2 = a two-note shimmer, evo 3 = a fuller, louder three-note chime).
  // Base tier (evo 1) is byte-identical to before — no extra layer.
  function _evoShine(t, evo){
    if (!ctx || evo < 2) return;
    // Owner: tiers 2 and 3 should sound clearly different, from each other and
    // from base. Two triangle notes against three, 0.10 against 0.16, was a
    // difference you could only hear on headphones in a quiet room — and this
    // game is played one-handed on a phone speaker on a bus.
    //
    // Tier 3 now gets a fourth note, a longer tail, and a low sine underneath
    // the chime. The sine is what does most of the work: brightness alone
    // reads as "sharper", weight is what reads as "stronger".
    const hot   = evo >= 3;
    const gain  = hot ? 0.22 : 0.12;
    const freqs = hot ? [1568, 2093, 2637, 3136] : [1319, 1760];
    const tail  = hot ? 0.22 : 0.14;
    freqs.forEach((fr, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'triangle'; o.frequency.value = fr;
      const st = t + 0.01 + i * 0.02;
      env(g, st, 0.004, tail, gain);
      o.connect(g); g.connect(sfxGain); o.start(st); o.stop(st + tail + 0.06);
    });
    if (hot) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(220, t);
      o.frequency.exponentialRampToValueAtTime(96, t + 0.20);
      env(g, t, 0.004, 0.20, 0.16);
      o.connect(g); g.connect(sfxGain); o.start(t); o.stop(t + 0.28);
    }
  }
  function attackFor(kind, evo){
    if (!ctx) return;
    const fn = kind && WEAPON_SFX[kind];
    if (!fn) return attack();
    fn(ctx.currentTime);
    if (evo && evo >= 2) _evoShine(ctx.currentTime, evo);
  }

  function hit() {
    if (!ctx) return; const t = ctx.currentTime;
    const n = noise(0.16), g = ctx.createGain(), f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 1400; env(g, t, 0.005, 0.14, 0.55);
    n.connect(f); f.connect(g); g.connect(sfxGain); n.start(t); n.stop(t + 0.18);
    const o = ctx.createOscillator(), g2 = ctx.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(60, t + 0.14);
    env(g2, t, 0.005, 0.14, 0.4); o.connect(g2); g2.connect(sfxGain); o.start(t); o.stop(t + 0.18);
  }
  function hurt() {
    if (!ctx) return; const t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(300, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.25);
    env(g, t, 0.005, 0.26, 0.3); o.connect(g); g.connect(sfxGain); o.start(t); o.stop(t + 0.3);
  }
  function enemyDeath() {
    if (!ctx) return; const t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(420, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.45);
    f.type = 'lowpass'; f.frequency.setValueAtTime(2000, t); f.frequency.exponentialRampToValueAtTime(200, t + 0.4);
    env(g, t, 0.01, 0.45, 0.3); o.connect(f); f.connect(g); g.connect(sfxGain); o.start(t); o.stop(t + 0.5);
    const n = noise(0.4), gn = ctx.createGain(); env(gn, t, 0.01, 0.4, 0.2);
    n.connect(gn); gn.connect(sfxGain); n.start(t); n.stop(t + 0.42);
  }
  function pickup() {
    if (!ctx) return; const t = ctx.currentTime;
    [880, 1320].forEach((fr, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = fr;
      env(g, t + i * 0.06, 0.005, 0.18, 0.22); o.connect(g); g.connect(sfxGain);
      o.start(t + i * 0.06); o.stop(t + i * 0.06 + 0.2);
    });
  }
  function levelup() {
    if (!ctx) return; const t = ctx.currentTime;
    [523, 659, 784, 1047].forEach((fr, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'triangle'; o.frequency.value = fr;
      env(g, t + i * 0.09, 0.01, 0.3, 0.25); o.connect(g); g.connect(sfxGain);
      o.start(t + i * 0.09); o.stop(t + i * 0.09 + 0.32);
    });
  }
  function descend() {
    if (!ctx) return; const t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(440, t); o.frequency.exponentialRampToValueAtTime(110, t + 1.0);
    env(g, t, 0.02, 1.0, 0.3); o.connect(g); g.connect(sfxGain); o.start(t); o.stop(t + 1.1);
  }

  function breakProp(){
    if(!ctx) return; const t=ctx.currentTime;
    const n=noise(0.22), g=ctx.createGain(), f=ctx.createBiquadFilter();
    f.type='highpass'; f.frequency.value=900; env(g,t,0.005,0.2,0.5);
    n.connect(f); f.connect(g); g.connect(sfxGain); n.start(t); n.stop(t+0.24);
    [520,330].forEach((fr,i)=>{ const o=ctx.createOscillator(),gg=ctx.createGain();
      o.type='triangle'; o.frequency.setValueAtTime(fr,t); o.frequency.exponentialRampToValueAtTime(fr*0.5,t+0.12);
      env(gg,t+i*0.02,0.005,0.12,0.18); o.connect(gg); gg.connect(sfxGain); o.start(t+i*0.02); o.stop(t+0.16);});
  }
  function ultiBlast(){
    if(!ctx) return; const t=ctx.currentTime;
    // charge swell
    const o=ctx.createOscillator(), g=ctx.createGain();
    o.type='sawtooth'; o.frequency.setValueAtTime(110,t); o.frequency.exponentialRampToValueAtTime(880,t+0.35);
    env(g,t,0.2,0.45,0.3); o.connect(g); g.connect(sfxGain); o.start(t); o.stop(t+0.5);
    // impact
    const t2=t+0.36;
    const n=noise(0.5), gn=ctx.createGain(), f=ctx.createBiquadFilter();
    f.type='lowpass'; f.frequency.setValueAtTime(4000,t2); f.frequency.exponentialRampToValueAtTime(200,t2+0.45);
    env(gn,t2,0.005,0.5,0.6); n.connect(f); f.connect(gn); gn.connect(sfxGain); n.start(t2); n.stop(t2+0.52);
    [330,440,550].forEach((fr,i)=>{ const oo=ctx.createOscillator(),gg=ctx.createGain();
      oo.type='square'; oo.frequency.setValueAtTime(fr,t2); oo.frequency.exponentialRampToValueAtTime(fr*0.4,t2+0.4);
      env(gg,t2+i*0.03,0.005,0.4,0.22); oo.connect(gg); gg.connect(sfxGain); oo.start(t2+i*0.03); oo.stop(t2+0.45);});
  }

  function start() { // call on first user gesture
    init();
    if (ctx.state === 'suspended') ctx.resume();
    if (!started) { started = true; startMusic(); }
  }
  // "Sound" switch in Settings — mutes/unmutes ONLY the music bed.
  // FIX: this used to also zero sfxGain, so turning music off silently
  // killed SFX as well. It no longer touches sfxGain at all — SFX on/off
  // is exclusively toggleSfx()'s job.
  function toggleMute() {
    muted = !muted;
    if (musicGain) musicGain.gain.linearRampToValueAtTime(muted ? 0 : 0.5 * musicVolume, ctx.currentTime + 0.3);
    return muted;
  }
  // 0..1 Volume slider from the Settings modal. FIX: this used to scale only
  // the music bed, leaving SFX at a fixed level — so "increase Volume" had
  // no audible effect on SFX. It now scales BOTH music and SFX together
  // (each still respects its own independent on/off toggle).
  function setMusicVolume(v) {
    musicVolume = Math.max(0, Math.min(1, v));
    if (musicGain && !muted) {
      musicGain.gain.cancelScheduledValues(ctx.currentTime);
      musicGain.gain.linearRampToValueAtTime(0.5 * musicVolume, ctx.currentTime + 0.05);
    }
    if (sfxGain) sfxGain.gain.value = sfxEnabled ? 0.85 * musicVolume : 0;
    return musicVolume;
  }
  // Independent SFX on/off (attack/hit/pickup/etc.), separate from the
  // music mute switch — only affected by itself and the shared Volume slider.
  function toggleSfx() {
    sfxEnabled = !sfxEnabled;
    if (sfxGain) sfxGain.gain.value = sfxEnabled ? 0.85 * musicVolume : 0;
    return sfxEnabled;
  }
  return { start, toggleMute, attack, attackFor, hit, hurt, enemyDeath, pickup, levelup, descend,
           breakProp, ultiBlast, setMusicVolume, toggleSfx,
           get muted(){return muted;},
           get musicVolume(){return musicVolume;},
           get sfxEnabled(){return sfxEnabled;} };
})();
window.Audio2 = Audio;
