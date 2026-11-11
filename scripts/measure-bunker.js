#!/usr/bin/env node
/**
 * measure-bunker.js — what one full bunker actually contains.
 *
 * WHY THIS EXISTS. The Vault Fragment thresholds (lib/server/vault-fragments.ts)
 * are a balance decision resting on one number: how many interactive containers
 * a player can actually open in a bunker. That number was first ESTIMATED by
 * reading spawnDecorInto (max 5 props per room, 12% rare, northOnly types
 * falling back to tables on side walls) and put at 8-15. Measured, it is ~6.3 —
 * between 1.3x and 2.4x lower, which made the Golden Key threshold unreachable
 * for anyone not playing daily. See the decision log in docs/GAME-DESIGN.md.
 *
 * Re-run this whenever props.js gains or loses an interactive container type,
 * or spawnDecorInto's density changes. Both silently move the reward curve.
 *
 * HOW IT MEASURES RATHER THAN REIMPLEMENTS. It builds a throwaway page carrying
 * every DOM id DungeonGame.tsx renders (read out of that file, so it cannot
 * drift), loads the 14 real engine scripts into it, and mounts the engine with
 * a saved session pinned to each depth. newGame() -> descend(depth) ->
 * ensureFloor() is the same path a player takes; nothing here copies the
 * generator's logic.
 *
 *   (cd public && python3 -m http.server 3180) &
 *   node scripts/measure-containers.js
 *
 * Requires playwright-core and a Chromium at CHROME_PATH.
 */
const fs=require('fs'), path=require('path')
const { chromium } = require('playwright-core')
const BASE=process.env.BASE_URL||'http://127.0.0.1:3180'
const HARNESS='__measure-tmp'

// Build the harness from DungeonGame.tsx's own ids so it can never drift from
// the markup the engine actually queries.
function writeHarness(){
  const tsx = fs.readFileSync(path.join(__dirname,'..','components','game','DungeonGame.tsx'),'utf8')
  const ids = [...new Set([...tsx.matchAll(/id="([A-Za-z0-9_]+)"/g)].map(m=>m[1]))].sort()
  const special = { game:'<canvas id="game"></canvas>', vaultCodeInput:'<input id="vaultCodeInput" />' }
  const scripts = ['audio.js','assets.js','story.js','story_campaign.js','dungeon.js','items.js',
    'marketplace-items.js','props.js','monster-config.js','effects.js','entities.js','outdoor.js',
    'run-session.js','game.js']
  const dir = path.join(__dirname,'..','public',HARNESS)
  fs.mkdirSync(dir,{recursive:true})
  fs.writeFileSync(path.join(dir,'index.html'),
    '<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#000}.hidden{display:none}</style>'
    + '<div class="ns-game-root">' + ids.map(i=>special[i]||`<div id="${i}"></div>`).join('') + '</div>'
    + scripts.map(s=>`<script src="/game-engine/${s}"></script>`).join(''))
  return ids.length
}
function cleanHarness(){
  try{ fs.rmSync(path.join(__dirname,'..','public',HARNESS),{recursive:true,force:true}) }catch{}
}

;(async()=>{
  const nIds = writeHarness()
  console.log('harness: ' + nIds + ' ids dari DungeonGame.tsx')
  try{
  const b=await chromium.launch({executablePath:process.env.CHROME_PATH||'/opt/pw-browsers/chromium',args:['--no-sandbox']})
  const page=await (await b.newContext({viewport:{width:390,height:844}})).newPage()
  const errs=[]; page.on('pageerror',e=>errs.push(e.message.slice(0,140)))
  await page.goto(BASE+'/'+HARNESS+'/index.html',{waitUntil:'load'})
  const ok=await page.evaluate(()=>!!(window.NullStateGame&&window.NS_DUNGEON&&window.NS_PROPS&&window.__NS))
  console.log('engine termuat:', ok, errs.length?('| errors: '+errs.slice(0,2).join(' ; ')):'')
  if(!ok){ await b.close(); process.exit(1) }

  const REPS = 40
  const rows = await page.evaluate(async (reps) => {
    const sleep=ms=>new Promise(r=>setTimeout(r,ms))
    const out=[]
    window.NullStateGame.mount({ startMode:null, worldMapHub:true })
    await sleep(1500)
    for(let depth=1; depth<=5; depth++){
      for(let i=0;i<reps;i++){
        window.NullStateGame.unmount(); await sleep(30)
        window.NullStateGame.mount({
          startMode:'continue', worldMapHub:true, walletAddress:null,
          energy:{ trySpend:async()=>({ok:true}), onExhausted(){} },
          savedSession:{ charKey:'knight', campaignActIndex:0, depth, maxDepthReached:depth,
            xp:0, level:1, kills:0, hp:100,
            inventory:{keys:0,relics:0,shards:0,items:{}},
            goldenKeysRemaining:1, paperRemaining:1, savedAt:Date.now() },
        })
        let g=null
        for(let t=0;t<200 && !(g&&g.decor&&g.decor.length); t++){ await sleep(50); g=window.__NS&&window.__NS.G }
        if(!g||!g.decor){ out.push({depth,err:1}); continue }
        const inter=g.decor.filter(d=>d.interactive && !d.def.isVaultDoor
                      && !d.def.isSealedCache && !d.def.isPremiumCache)
        const breakable=g.decor.filter(d=>!d.interactive && !d.ambient)
        out.push({ depth:g.depth, interactive:inter.length, allDecor:g.decor.length,
                   enemies:g.enemies.length, boss:g.enemies.some(e=>e.isBoss),
                   breakable:breakable.length,
                   rooms:g.dun?g.dun.rooms.length:0 })
      }
    }
    return out
  }, REPS)

  const bad=rows.filter(r=>r.err).length
  if(bad) console.log('gagal:',bad,'dari',rows.length)
  const good=rows.filter(r=>!r.err)
  const by={}; good.forEach(r=>{(by[r.depth]=by[r.depth]||[]).push(r)})
  const avg=(a,k)=>a.reduce((s,x)=>s+x[k],0)/a.length

  console.log('\n  lantai | peti ber-OPEN | musuh | prop pecah | ruangan')
  let C=0,E=0,B=0
  for(const d of Object.keys(by).sort()){
    const v=by[d]
    const c=avg(v,'interactive'), e=avg(v,'enemies'), b=avg(v,'breakable'), rm=avg(v,'rooms')
    C+=c; E+=e; B+=b
    console.log('    '+d+'    |     '+c.toFixed(2).padStart(5)+'     | '+e.toFixed(1).padStart(5)
      +' |   '+b.toFixed(1).padStart(5)+'    |  '+rm.toFixed(1)+(v[0].boss?'   (boss)':''))
  }
  console.log('\n  ── SATU BUNKER PENUH (5 lantai, semua dibuka & dibunuh) ──')
  console.log('     peti ber-OPEN : '+C.toFixed(1))
  console.log('     musuh         : '+E.toFixed(1))
  console.log('     prop pecah    : '+B.toFixed(1))

  console.log('\n  ── APAKAH KONTRAK HARIAN TERCAPAI? ──')
  const pool=[['kills30','musuh',30,E],['kills60','musuh',60,E],['floors3','lantai',3,5],
              ['cont5','peti',5,C],['cont8','peti',8,C],['burn8','item dibakar',8,null]]
  for(const [id,unit,target,per] of pool){
    if(per===null){ console.log('     '+id.padEnd(9)+' butuh '+target+' '+unit+' — tergantung loot, tidak diukur'); continue }
    const n=target/per
    console.log('     '+id.padEnd(9)+' butuh '+String(target).padStart(3)+' '+unit.padEnd(6)
      +' = '+n.toFixed(2)+' bunker'+(n<=1.05?'   ✔ satu bunker':(n<=1.5?'   ~ satu bunker lebih':'   ✗ butuh 2+ bunker')))
  }

  console.log('\n  ── AMBANG VAULT (fragment = peti ber-OPEN) ──')
  for(const [label,t] of [['Old Paper',8],['Golden Key',18]]){
    console.log('     '+label.padEnd(11)+t+' fragment = '+(t/C).toFixed(2)+' bunker penuh'
      +'  |  70% dibuka: '+(t/(C*0.7)).toFixed(2)+' bunker')
  }
  console.log('\n  ── ISI SATU RAID (harga: 1 energy) ──')
  console.log('     '+C.toFixed(1)+' peti ber-OPEN + '+B.toFixed(0)+' prop pecah + '+E.toFixed(0)+' musuh')
  await b.close()
  } finally { cleanHarness() }
})().catch(e=>{cleanHarness();console.error('ERROR',e.message);process.exit(1)})
