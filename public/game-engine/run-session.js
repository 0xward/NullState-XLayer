/* ============================================================
   NULL_STATE :: RUN SESSION  (Genius blueprint Phase 1, §2.1)
   ------------------------------------------------------------
   "One run = one bunker visit." Before this module there was no
   run boundary at all — no timer, no per-run death count, nothing
   to hang a reward multiplier (or an energy cost) on. This is the
   single source of truth for that unit.

   States: Entering -> InProgress -> Cleared | Abandoned
           (a death does NOT end the run — onRevive() keeps the
           existing forgiving in-place revive; deaths are counted
           here and degrade the future material payout instead,
           per the blueprint's "tension without punishing
           latency" rule.)

   Owned by game.js:
     start(actIndex, resumed)  fresh bunker entry (resumed=true when
                               loading a saved session — costs no energy,
                               keeps the "one energy per fresh entry" rule
                               honest)
     tick(dt)                  advance elapsedMs (game.js update loop;
                               pauses/cutscenes simply don't tick)
     onFloorCleared()          floor-secured banner moment
     onDeath()                 onRevive() hook
     close(state)              'Cleared' (act boss down) | 'Abandoned'
                               (exit to surface/menu/unmount)
     active()                  current session or null
     rewardMultiplier()        1.0 with <=1 death, then -0.2 per extra
                               death, floored at 0.4 — consumed by the
                               Phase 2 material payout when that ships.
   ============================================================ */
(function(){
  let cur = null;
  let last = null; // most recently closed session (for end-of-run summaries)

  function start(actIndex, resumed){
    cur = {
      state: 'InProgress',
      actIndex: actIndex|0,
      resumed: !!resumed,
      startedAt: Date.now(),
      elapsedMs: 0,
      floorsCleared: 0,
      deathsThisRun: 0,
    };
    return cur;
  }
  function tick(dt){
    if(cur && cur.state === 'InProgress') cur.elapsedMs += dt*1000;
  }
  function onFloorCleared(){ if(cur) cur.floorsCleared++; }
  function onDeath(){ if(cur) cur.deathsThisRun++; }
  function rewardMultiplier(){
    if(!cur) return 1;
    const extra = Math.max(0, cur.deathsThisRun - 1); // first death is free
    return Math.max(0.4, 1 - 0.2*extra);
  }
  function close(state){
    if(!cur) return null;
    cur.state = state || 'Abandoned';
    cur.endedAt = Date.now();
    last = cur;
    cur = null;
    return last;
  }
  function active(){ return cur; }
  function lastClosed(){ return last; }

  window.NS_RUN = { start, tick, onFloorCleared, onDeath, rewardMultiplier, close, active, lastClosed };
})();
