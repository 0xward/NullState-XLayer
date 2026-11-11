#!/usr/bin/env node
/**
 * test-exit-streak.js — the exit screen must not claim the reward it advertises.
 *
 * `/stats` said **78 players this week, 1 today**, and running out of energy is
 * the single moment the game KNOWS a session is ending. It said "you are done"
 * and offered a $1 refill — a closing, and a bill. The streak ladder goes there
 * now, with TOMORROW lit rather than today.
 *
 * ── WHY THIS IS A SOURCE TEST AND NOT A BROWSER ONE ─────────────────────────
 *
 * The modal opens when `/api/energy/spend` denies a bunker entry, which means
 * the engine has to mount — and the shell cannot hand off to the engine without
 * a live Firestore session read. That is the same limit
 * `scripts/test-playthrough.js` documents, and the reason it drives a harness
 * page instead. Driving this one in the sandbox gets as far as the map
 * unmounting and then stops: no canvas, no modal.
 *
 * So this asserts the one property that could silently HARM a player, and it
 * asserts it where the property lives:
 *
 *   The map registers the daily visit with a POST. If this screen did the same,
 *   opening a modal that says "come back tomorrow" would quietly claim
 *   tomorrow's reward — the player returns to find the day already spent, with
 *   nothing anywhere saying why.
 *
 * Reading source for a guarantee is the technique `test-season-close.js`
 * already uses against `deposit-reward.js`'s flags, for the same reason: the
 * thing being protected is worth more than the elegance of the check.
 *
 *   node scripts/test-exit-streak.js
 */
const fs = require('fs'), path = require('path')
const src = fs.readFileSync(path.join(__dirname, '..', 'components', 'game', 'DungeonGame.tsx'), 'utf8')
let fails = 0
const ok = (l, c, d) => { console.log((c ? '  ✓ ' : '  ✗ FAIL: ') + l + (d !== undefined ? ' (' + d + ')' : '')); if (!c) fails++ }

// The effect that reads the streak for the out-of-energy modal.
const start = src.indexOf('const [streakPeek, setStreakPeek]')
ok('the exit screen reads the streak at all', start > -1)
const end = src.indexOf('}, [energyModal, streakPeek])', start)
const block = start > -1 && end > -1 ? src.slice(start, end + 30) : ''
ok('and the effect is bounded where expected', block.length > 0)

ok('it calls /api/streak', /fetch\(`\/api\/streak\?wallet=/.test(block))
ok('as a GET — no method, no body, nothing that could claim the day',
  !/method\s*:\s*['"]POST['"]/.test(block) && !/\bbody\s*:/.test(block),
  (block.match(/method\s*:\s*['"][A-Z]+['"]/) || ['none'])[0])
ok('gated on the modal being open, not fired on every mount',
  /if \(!energyModal\) return/.test(block))
ok('fetched once, not on every render while the modal sits open',
  /if \(!addr \|\| streakPeek\) return/.test(block))
ok('a failed read is swallowed — the exit screen still works offline',
  /\.catch\(\(\) =>/.test(block))

// The mirror bug: the MAP's registration must stay a POST. That is the call
// that is SUPPOSED to advance the streak.
const bar = fs.readFileSync(path.join(__dirname, '..', 'components', 'game', 'DailyStatusBar.tsx'), 'utf8')
ok('the MAP still registers the visit with a POST — opening the app IS the event',
  /fetch\('\/api\/streak', \{\s*\n?\s*method: 'POST'/.test(bar))

// An empty ladder at someone who has never logged a day is furniture, not a
// reason to come back.
ok('the ladder is only drawn when there is a real streak',
  /streakPeek && streakPeek\.ladder\.length > 0 && streakPeek\.streak > 0/.test(src))
// Lighting today would point at a day that is already spent — which is exactly
// why this screen is on screen.
ok('TOMORROW is the lit rung, not today',
  /streakPeek\.claimedToday \? streakPeek\.day \+ 1 : streakPeek\.day/.test(src))
ok('and it says out loud what tomorrow pays', /Tomorrow pays/.test(src))
ok('while keeping the free path beside the paid one',
  /wait for free energy/.test(src) && /REFILL \+/.test(src))

console.log(fails ? `  ${fails} GAGAL` : '  semua lolos')
process.exit(fails ? 1 : 0)
