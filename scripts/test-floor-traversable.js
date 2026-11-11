#!/usr/bin/env node
/**
 * test-floor-traversable.js — a floor must always be walkable end to end.
 *
 * OWNER BUG, from MiniPay: entered Bunker 1 floor 1 and could not move out of
 * the spawn area. This is what found it and what proves it stays fixed.
 *
 * It flood-fills from the spawn point across many generated floors, using the
 * engine's OWN wall test and its own solid-decor footprint (NS_solidDecorAt),
 * and asks whether the lift can be reached. Measured before the fix:
 *
 *   crate 44x44 (as shipped) .... 5 sealed in 60
 *   crate 34x34 (before #197) ... 2 sealed in 60
 *   no decor at all ............. 0 in 100   <- walls are never the problem
 *
 * So widening the crate for the art made a LATENT bug common. Shrinking it
 * again would only have hidden it: a corridor is one tile (40) and the player's
 * radius is 14, so anything with a solid footprint over 12px seals one, which
 * is every prop in the game. The fix is therefore a guarantee in ensureFloor
 * (_ensureFloorTraversable), not a size.
 *
 *   (cd public && python3 -m http.server 3180) &
 *   node scripts/test-floor-traversable.js
 *
 * Env: REPS (default 100), CRATE (override crate w/h), STRIP=1 (drop all decor,
 * to re-confirm the walls alone are sound).
 *
 * Requires playwright-core and a Chromium at CHROME_PATH.
 */
const { chromium } = require('playwright-core'); const fs=require('fs'), path=require('path')
;(async()=>{
  // reuse the measure harness
  const tsx=fs.readFileSync('components/game/DungeonGame.tsx','utf8')
  const ids=[...new Set([...tsx.matchAll(/id="([A-Za-z0-9_]+)"/g)].map(m=>m[1]))].sort()
  const sp={game:'<canvas id="game"></canvas>',vaultCodeInput:'<input id="vaultCodeInput" />'}
  const scripts=['audio.js','assets.js','story.js','story_campaign.js','dungeon.js','items.js',
    'marketplace-items.js','props.js','monster-config.js','effects.js','entities.js','outdoor.js','run-session.js','game.js']
  fs.mkdirSync('public/__reach',{recursive:true})
  fs.writeFileSync('public/__reach/index.html',
    '<!doctype html><meta charset="utf-8"><style>.hidden{display:none}</style><div class="ns-game-root">'
    + ids.map(i=>sp[i]||`<div id="${i}"></div>`).join('') + '</div>'
    + scripts.map(s=>`<script src="/game-engine/${s}"></script>`).join(''))

  const b=await chromium.launch({executablePath:process.env.CHROME_PATH||'/opt/pw-browsers/chromium',args:['--no-sandbox']})
  const p=await b.newPage()
  await p.goto((process.env.BASE_URL||'http://127.0.0.1:3180')+'/__reach/index.html',{waitUntil:'load'})

  const REPS=Number(process.env.REPS||100), CRATE=process.env.CRATE?Number(process.env.CRATE):null
  console.log('  crate w/h = ' + (CRATE||'default (44, sekarang)'))
  const res = await p.evaluate(async ({reps, crateW, stripDecor}) => {
    const sleep=ms=>new Promise(r=>setTimeout(r,ms))
    if(crateW) window.NS_PROPS.DECOR_TYPES.crate.w = window.NS_PROPS.DECOR_TYPES.crate.h = crateW
    window.__STRIP_DECOR = !!stripDecor
    const TILE = window.NS_DUNGEON.TILE
    const out=[]
    window.NullStateGame.mount({startMode:null, worldMapHub:true}); await sleep(1200)
    for(let i=0;i<reps;i++){
      window.NullStateGame.unmount(); await sleep(30)
      window.NullStateGame.mount({startMode:'continue', worldMapHub:true, walletAddress:null,
        energy:{trySpend:async()=>({ok:true}),onExhausted(){}},
        savedSession:{charKey:'knight',campaignActIndex:0,depth:(i%5)+1,maxDepthReached:(i%5)+1,xp:0,level:1,kills:0,hp:100,
          inventory:{keys:0,relics:0,shards:0,items:{}},goldenKeysRemaining:1,paperRemaining:1,savedAt:Date.now()}})
      let g=null
      for(let t=0;t<200 && !(g&&g.dun); t++){ await sleep(50); g=window.__NS&&window.__NS.G }
      if(!g||!g.dun){ out.push({err:1}); continue }
      if(window.__STRIP_DECOR) g.decor.length = 0
      const d=g.dun, R=g.player.r||10
      const S=TILE/2, W=Math.ceil(d.pxW/S), H=Math.ceil(d.pxH/S)
      const key=(a,c)=>a+','+c
      // Flood fill with a chosen decor list. Passing [] gives the region the
      // WALLS alone allow, which is the yardstick everything else is measured
      // against.
      const fill=(list)=>{
        const blocked=(x,y)=> d.isWall(x,y)||d.isWall(x+R,y)||d.isWall(x-R,y)||d.isWall(x,y+R)||d.isWall(x,y-R)
          || list.some(o=>window.NS_decorBlocksPoint(o,x,y)||window.NS_decorBlocksPoint(o,x+R,y)||window.NS_decorBlocksPoint(o,x-R,y))
        const seen=new Set([key(Math.round(g.player.x/S),Math.round(g.player.y/S))])
        const q=[[Math.round(g.player.x/S),Math.round(g.player.y/S)]]
        while(q.length){ const [a,c]=q.pop()
          for(const [da,dc] of [[1,0],[-1,0],[0,1],[0,-1]]){
            const na=a+da,nc=c+dc; if(na<0||nc<0||na>W||nc>H) continue
            const k=key(na,nc); if(seen.has(k)) continue
            if(blocked(na*S,nc*S)) continue
            seen.add(k); q.push([na,nc]) } }
        return seen }
      const hard = g.decor.filter(o=>o.def&&(o.def.ambient||o.def.interactive))
      const wallsOnly = fill([]), withHard = fill(hard), seen = fill(g.decor)
      const wallReach = (set,x,y)=>{ const a=Math.round(x/S), c=Math.round(y/S)
        for(let da=-2;da<=2;da++) for(let dc=-2;dc<=2;dc++) if(set.has(key(a+da,c+dc))) return true
        return false }
      // The property that actually matters, and the one the owner reported
      // broken: a prop you CANNOT BREAK must never be what stops you reaching a
      // room or a lockable container. Counting lost cells instead was the wrong
      // question — a prop standing in a room legitimately occupies a few.
      const wantRooms = d.rooms.map(rm=>[(rm.cx+0.5)*TILE,(rm.cy+0.5)*TILE])
        .filter(([x,y])=>wallReach(wallsOnly,x,y))
      const wantBoxes = g.decor.filter(o=>o.def&&o.def.interactive).map(o=>[o.x,o.y])
        .filter(([x,y])=>wallReach(wallsOnly,x,y))
      const sealedRooms = wantRooms.filter(([x,y])=>!wallReach(withHard,x,y)).length
      const sealedBoxes = wantBoxes.filter(([x,y])=>!wallReach(withHard,x,y)).length
      // Same tolerance the engine's own guarantee uses: standing NEXT to the
      // lift counts. Its exact pixel is often wall-adjacent and unreachable for
      // a 14px body even on a perfectly walkable floor.
      const reach=(x,y)=>{ const a=Math.round(x/S), c=Math.round(y/S)
        for(let da=-2;da<=2;da++) for(let dc=-2;dc<=2;dc++) if(seen.has(key(a+da,c+dc))) return true
        return false }
      out.push({ depth:g.depth, cells:seen.size, stairs:reach(d.stairsPx.x,d.stairsPx.y),
                 sealedRooms, sealedBoxes, boxes:wantBoxes.length,
                 stuck: seen.size<=4, rooms:d.rooms.length })
    }
    return out
  }, {reps: REPS, crateW: CRATE, stripDecor: !!process.env.STRIP})

  const bad=res.filter(r=>r.err).length
  const ok=res.filter(r=>!r.err)
  const stuck=ok.filter(r=>r.stuck).length
  const noStairs=ok.filter(r=>!r.stairs).length
  const badRooms=ok.filter(r=>r.sealedRooms>0), badBoxes=ok.filter(r=>r.sealedBoxes>0)
  const totalBoxes=ok.reduce((s,r)=>s+r.boxes,0)
  console.log(`  sampel: ${ok.length}${bad?' (gagal '+bad+')':''}`)
  console.log(`  TERKURUNG total (≤4 sel): ${stuck}`)
  console.log(`  tangga TIDAK tercapai   : ${noStairs}  ← ini bug-nya`)
  console.log(`  ruangan tersegel prop TAK BISA DIPECAH : ${badRooms.length} lantai`)
  console.log(`  peti ber-OPEN tersegel prop tsb        : ${badBoxes.length} lantai`)
  console.log(`  peti ber-OPEN yang selamat             : ${totalBoxes} (rata-rata ${(totalBoxes/ok.length).toFixed(1)}/lantai)`)
  const worst=ok.slice().sort((a,c)=>a.cells-c.cells).slice(0,5).map(r=>r.cells)
  console.log(`  5 sel-terjangkau terkecil: ${worst.join(', ')}`)
  if(noStairs) ok.filter(r=>!r.stairs).forEach(r=>console.log('    buntu di lantai '+r.depth+' ('+r.cells+' sel)'))
  fs.rmSync('public/__reach',{recursive:true,force:true})
  await b.close(); process.exit((noStairs || badRooms.length || badBoxes.length) ? 1 : 0)
})().catch(e=>{try{fs.rmSync('public/__reach',{recursive:true,force:true})}catch{};console.error('ERROR',e.message);process.exit(2)})
