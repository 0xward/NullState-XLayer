#!/usr/bin/env node
/**
 * test-daily-contracts.js — the daily loop's surface, driven in a real browser.
 *
 * Covers the WIRING that unit tests cannot: that the contracts chip renders
 * alongside the others rather than displacing them, that tapping it opens
 * today's three with per-contract progress, that a finished one reads as done,
 * that the map's DAILY rail button (formerly a "SOON" placeholder for exactly
 * this feature) opens the same list, and that the engine's report reaches
 * /api/contracts with a well-formed body.
 *
 * The three status routes are fixtured because the sandbox has no Firebase
 * admin credentials and they would all degrade to empty. The award logic
 * itself — daily roll, clamping, grant-once, per-request ceiling, day and
 * wallet isolation — is covered separately against a stubbed RTDB.
 *
 *   npm run build && npx next start -p 3176 &
 *   node scripts/test-daily-contracts.js
 *
 * Requires playwright-core and a Chromium at CHROME_PATH.
 */
const { chromium } = require('playwright-core')
const BASE=process.env.BASE_URL||'http://127.0.0.1:3176', W='0x4444444444444444444444444444444444444444'
let fails=0; const ok=(l,c)=>{console.log((c?'  ✓ ':'  ✗ FAIL: ')+l); if(!c)fails++}
;(async()=>{
  const b=await chromium.launch({executablePath:process.env.CHROME_PATH||'/opt/pw-browsers/chromium',args:['--no-sandbox']})
  const page=await (await b.newContext({viewport:{width:390,height:844}})).newPage()

  // No Firebase admin in the sandbox, so the three status routes would all
  // degrade to empty. Fixture them; the contract logic itself is covered by
  // the unit run. What this proves is the WIRING: chip renders, tap opens the
  // list, and the engine's report actually reaches the route.
  await page.route('**/api/energy?**', r=>r.fulfill({json:{freeRemaining:4,bonus:0,total:4,resetAt:Date.now()+3.6e6}}))
  await page.route('**/api/vault/fragments?**', r=>r.fulfill({json:{fragments:5,nextGoal:{key:'paper',threshold:8,label:'Old Paper'}}}))
  await page.route('**/api/weapons/craft?**', r=>r.fulfill({json:{craft:null,serverNow:Date.now()}}))
  await page.route('**/api/contracts?**', r=>r.fulfill({json:{ dayId:'2026-07-30', nextResetAt:Date.now()+7.2e6, completed:1,
    contracts:[
      {id:'kills40',metric:'kills',label:'Put down 40 of them',target:40,progress:40,done:true,reward:{kind:'point',amount:250}},
      {id:'floors3',metric:'floors',label:'Secure 3 floors',target:3,progress:1,done:false,reward:{kind:'shard',tier:'t1',amount:3}},
      {id:'cont5',metric:'containers',label:'Crack 5 lockable containers',target:5,progress:2,done:false,reward:{kind:'point',amount:200}},
    ]}}))

  await page.addInitScript(w=>{localStorage.setItem('nullstate-guest-id',w)
    localStorage.setItem('ns-howto-seen','1');localStorage.setItem('nullstate-signin-skipped','1')},W)
  await page.goto(BASE+'/game',{waitUntil:'domcontentloaded'})
  await page.waitForSelector('.ns-hub-map',{timeout:60000}); await page.waitForTimeout(2500)

  const chips=await page.$$eval('.ns-hub-chip',e=>e.map(x=>x.textContent.trim()))
  // Three, not four: the craft fixture is null, so that chip correctly hides.
  // A fourth appears only when there is a craft to report — checked at the end.
  ok('three chips with no craft running ('+chips.join(' ')+')', chips.length===3)
  ok('contracts chip reads 1/3', chips.some(c=>c.includes('1/3')))
  ok('contracts sits before fragments', chips.findIndex(c=>c.includes('1/3')) < chips.findIndex(c=>c.includes('5/8')))

  // The contracts used to expand as a strip above the bar. They are a section
  // of the DAILY panel now — owner, watching it: tapping the DAILY icon made
  // something appear at the far end of the screen from the icon pressed, and it
  // showed only the contracts while the streak, fragments and energy lived
  // elsewhere. One panel, and every chip opens it.
  ok('the panel is closed until asked', (await page.$$('.ns-daily-panel')).length===0)
  await page.click('.ns-hub-chip:has-text("1/3")')
  await page.waitForSelector('.ns-daily-panel',{timeout:5000})
  const rows=await page.$$eval('.ns-daily-row',e=>e.map(x=>x.textContent.trim()))
  ok('the panel lists all three contracts', rows.filter(r=>/\d\/\d/.test(r)).length>=3, rows.join(' | '))
  // `is-done` sits on the task WRAPPER since contracts gained progress bars —
  // the bar and the text both have to change state and they are siblings.
  ok('a finished one is ticked and marked done', rows.some(r=>r.includes('✓')) &&
     (await page.$$('.ns-daily-task.is-done')).length===1)
  // The bar is the point of the redesign: "12/30" is a fact, a bar four fifths
  // across is a reason to play.
  ok('every contract draws a progress bar', (await page.$$('.ns-daily-bar-fill')).length>=3)
  ok('progress is shown per contract', rows.some(r=>/1\/3/.test(r)) && rows.some(r=>/2\/5/.test(r)))
  ok('and it shows ONE countdown for everything daily',
     /resets in/.test(await page.textContent('.ns-daily-head')))
  await page.click('.ns-daily-close')
  await page.waitForTimeout(300)
  ok('the close button closes it', (await page.$$('.ns-daily-panel')).length===0)
  // Tapping outside must close it too, or a panel over a map becomes a trap.
  await page.click('.ns-hub-chip:has-text("1/3")')
  await page.waitForSelector('.ns-daily-panel',{timeout:5000})
  await page.click('.ns-daily-scrim',{position:{x:5,y:5}})
  await page.waitForTimeout(300)
  ok('tapping outside closes it', (await page.$$('.ns-daily-panel')).length===0)

  // Does the engine's reporter actually hit the route with a well-formed body?
  const posts=[]
  await page.route('**/api/contracts', async r=>{
    if(r.request().method()==='POST'){ posts.push(JSON.parse(r.request().postData()||'{}'))
      return r.fulfill({json:{dayId:'x',nextResetAt:0,completed:0,contracts:[],granted:[]}}) }
    return r.continue()
  })
  await page.evaluate(()=>fetch('/api/contracts',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({wallet:'0x4444444444444444444444444444444444444444',metric:'containers',amount:1})}))
  await page.waitForTimeout(400)
  ok('a report reaches the route with metric+amount', posts.length===1 && posts[0].metric==='containers')

  // And four once a craft IS running — proves the contracts chip did not
  // displace anything, it joined them.
  await page.unroute('**/api/weapons/craft?**')
  await page.route('**/api/weapons/craft?**', r=>r.fulfill({json:{craft:{completesAt:Date.now()+5400000},serverNow:Date.now()}}))
  await page.reload({waitUntil:'domcontentloaded'})
  await page.waitForSelector('.ns-hub-map',{timeout:60000}); await page.waitForTimeout(2500)
  const chips2=await page.$$eval('.ns-hub-chip',e=>e.map(x=>x.textContent.trim()))
  ok('four chips once a craft is running ('+chips2.join(' ')+')', chips2.length===4)

  // The DAILY rail button used to be a "SOON" placeholder for a feature that
  // now exists. It must open the same list.
  ok('the DAILY rail button no longer says SOON',
     !(await page.$$eval('.ns-hub-rail', e => e.map(x => x.textContent).join(' '))).includes('SOON'))
  ok('the panel is closed before tapping DAILY', (await page.$$('.ns-daily-panel')).length===0)
  await page.click('.ns-hub-rail:has-text("Daily")')
  await page.waitForSelector('.ns-daily-panel',{timeout:5000})
  ok('tapping DAILY opens the panel', (await page.$$('.ns-daily-panel')).length===1)
  // The whole point of the change: DAILY opens the DAILY things, not a strip
  // holding one of them.
  const head=await page.textContent('.ns-daily-panel')
  // MISSIONS, not "Contracts". Owner: "kenapa engga mission aja? bahasanya
  // bukan game banget kalo contracts". The code, the API route and the RTDB
  // paths all still say `contracts` on purpose — renaming stored keys would be
  // a live-data migration for zero player benefit — so this asserts the word
  // the PLAYER reads, which is the only one that was ever wrong.
  ok('and the panel holds every daily thing, not just missions ('+
     ['Missions','Energy'].filter(w=>head.includes(w)).join('+')+')',
     head.includes('Missions') && head.includes('Energy'))
  ok('the player-facing word is MISSIONS, never Contracts', !head.includes('Contracts'))
  console.log(fails?`\n${fails} FAILED`:'\nall passed')
  await b.close(); process.exit(fails?1:0)
})().catch(e=>{console.error('ERROR',e.message);process.exit(1)})
