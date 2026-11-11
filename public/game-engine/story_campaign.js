/* ============================================================
   NULL_STATE :: CAMPAIGN  (outdoor narrative beats, Act I)
   ------------------------------------------------------------
   Each entry is one "Act": one outdoor background, one bunker.
   To add a new bunker later, append a new object to CAMPAIGN —
   nothing else needs to change (the outdoor-scene engine and the
   bunker-transition code both just read this array by index).

   Lines come in three beats per act:
     arrival   — short speech-bubble lines, shown above the
                 player's head right after the loading-transition
                 into this act's outdoor scene. Quiet, internal,
                 first-person. Read automatically, one at a time,
                 with a short pause between each.
     preBunker — dialog-box lines (bottom of screen, full-width,
                 typewriter), triggered once the player walks far
                 enough right to reach the bunker entrance. Heavier
                 exposition / plot beats live here.
     postBunker — dialog-box lines shown immediately after the
                 player clears the bunker and steps back outside.
                 This is where the layered mystery escalates
                 (corrupted villagers, the Old Warden, the
                 infection) — each act peels back a little more.
     onWeaponEvolve — (Phase 7) 1-2 arrival-style speech-bubble
                 lines, appended to this act's arrival beat the first
                 time the player enters an act carrying a weapon that
                 has reached a NEW evolution tier. Reframes evolved
                 weapons as partial "decryption tools" that thread the
                 EXISTING Golden Key / corruption arc — NOT a separate
                 mythology. Fired via window.NS_takeEvolveBark (game.js),
                 which marks each tier acknowledged so a line shows once.

   The overall arc (Act I, 5 bunkers):
     1. Surface story: monsters took the villagers, hero is the
        lone survivor of their own village, here to save who's left.
     2. Cracks start showing: the monsters carry villagers' belongings.
        Something is wrong with what "corrupted" actually means.
     3. The Golden Keys are confirmed to be fragments of something
        old and cryptographic, not ordinary keys.
     4. First contact with the Old Warden (unnamed, unseen — only a
        message). They warn the hero to stop collecting fragments.
     5. The hero's own condition is named for the first time (not
        resolved). Act I ends on that open question, deliberately
        unresolved for Act II (future bunkers) to pick up.
   ============================================================ */
const CAMPAIGN = [
  // ── Act 1 — Forest ──────────────────────────────────────────
  {
    id: 1,
    bg: 'forest',
    dungeonTheme: 'bluestone',
    title: 'THE TREELINE BUNKER',
    arrival: [
      "...This used to be the road home.",
      "Three days since the village went dark. Three days since I was the only one who walked out.",
      "They're in there. Somewhere under the roots. I can feel it.",
    ],
    preBunker: [
      "The bunker door is half-swallowed by the forest floor, like the ground tried to forget it existed.",
      "Whatever took them came up through here. I don't need a reason to go back down. I need them back.",
      "Wallet signed. Blade ready. Let's go.",
    ],
    postBunker: [
      "It's quieter now. Not safer — quieter.",
      "I didn't find anyone alive down there. But I found a key. Gold, warm to the touch, humming faintly like it remembers being something else.",
      "And the things I fought... one of them was wearing my neighbor's scarf.",
      "I told myself it didn't mean anything.",
      "NEXT → THE SUNKEN FIELD. The road keeps going east.",
    ],
    onWeaponEvolve: [
      "The blade's humming now — the same note as the key in my pack.",
      "Like it's learning to read something I'm not meant to.",
    ],
  },

  // ── Act 2 — Sunken Field ────────────────────────────────────
  {
    id: 2,
    bg: 'desert',
    dungeonTheme: 'catacombs',
    title: 'THE SUNKEN FIELD',
    arrival: [
      "The road keeps going. So do I.",
      "Another bunker, half-buried in a field that used to grow something other than silence.",
      "I keep thinking about the scarf.",
    ],
    preBunker: [
      "There's a second key resonance coming from below — fainter, like it's been down there longer.",
      "If the villagers are spread across all of these... how long have they been disappearing? This can't be the first bunker the NULL_STATE ever touched.",
      "Down again. Same promise. Same blade.",
    ],
    postBunker: [
      "Two keys now. They hum together when they're close — like they're calling to a third.",
      "I found a logbook in the lower chamber. Most of it was corrupted past reading. One line wasn't:",
      "\"Subjects do not become monsters. Subjects are overwritten by what already lived in the chain. We only gave it a door.\"",
      "I don't know who wrote that. I don't know if I want to.",
      "NEXT → THE FROSTLINE BUNKER. The third fragment is somewhere under the ice.",
    ],
    onWeaponEvolve: [
      "Sharper — and not just the edge.",
      "It's started reading what the NULL_STATE overwrites into things. One line at a time.",
    ],
  },

  // ── Act 3 — Frostline ───────────────────────────────────────
  {
    id: 3,
    bg: 'snow',
    dungeonTheme: 'icestone',
    title: 'THE FROSTLINE BUNKER',
    arrival: [
      "Cold enough out here that even the NULL_STATE seems to move slower.",
      "Small mercy. I'll take it.",
      "Three keys' worth of road behind me now. I'm not turning back to count what it cost.",
    ],
    preBunker: [
      "The entrance here isn't broken — it's open. Like something walked out, not in.",
      "These keys aren't shaped like any key I've ever held. More like... pieces. Of something that was whole, once, and cut itself apart on purpose.",
      "Fragments of a lock too big for any door I've seen. Fine. I'll find the door.",
    ],
    postBunker: [
      "Third key. It's warmer than the other two combined, like it's the closest to finishing something.",
      "Down in the frost chamber, the walls weren't stone under the ice. They were screens — dead ones, but screens. Old machines that this whole bunker was built around, not in.",
      "Whatever NULL_STATE actually is, it didn't choose these places. We built the doors for it a long time ago. We just forgot we did.",
      "NEXT → THE HOLLOW MARKET. Two fragments left. Keep walking.",
    ],
    onWeaponEvolve: [
      "The keys are fragments of a lock. This is starting to feel like the other half —",
      "a tool for reading what they were built to seal.",
    ],
  },

  // ── Act 4 — The Hollow Market ───────────────────────────────
  {
    id: 4,
    bg: 'field',
    dungeonTheme: 'bluestone',
    title: 'THE HOLLOW MARKET',
    arrival: [
      "Stalls still standing. Fruit still in the crates, gone to dust years before I got here.",
      "Whoever lived here didn't get a warning either.",
      "Four keys' distance from home now. I don't think there's a road back at this point, only forward.",
    ],
    preBunker: [
      "A door behind the old market — newer than the buildings around it, like it was added after everyone left.",
      "Before I go down: something spoke to me last night. Not a dream. A voice, clean and old, like it had said these words a thousand times to a thousand other people standing exactly where I'm standing.",
      "\"Stop collecting what isn't yours to hold. Every fragment you carry weakens the seal the rest of us are dying to keep closed.\"",
      "I didn't ask who 'the rest of us' was. I'm not sure I want the answer before I have a sword in my hand.",
    ],
    postBunker: [
      "Fourth key. It's lighter than it should be — or I'm getting used to carrying things that shouldn't exist.",
      "The voice didn't come back down there. But something did watch me. I felt it the way you feel a held breath in a quiet room.",
      "Whoever — whatever — is trying to keep this sealed, they're not the enemy I came here for. But I don't think they're on my side either.",
      "One more bunker. One more key, maybe. And then I find out what door four fragments actually opens.",
      "NEXT → THE LAST LIGHT. The final bunker — bring this week's Paper and Golden Key for the vault below.",
    ],
    onWeaponEvolve: [
      "The voice told me to stop collecting fragments.",
      "It said nothing about forging one of my own. Good.",
    ],
  },

  // ── Act 5 — The Last Light ──────────────────────────────────
  {
    id: 5,
    bg: 'back',
    dungeonTheme: 'voidstone',
    title: 'THE LAST LIGHT',
    arrival: [
      "The sky out here isn't a sky. It's a wound, stitched shut with light that doesn't reach the ground.",
      "This is the source. I knew it the second I saw it, the way you know a wound is yours before you look down.",
      "Every key I'm carrying is humming now. All at once. Like they know they're home.",
    ],
    preBunker: [
      "This bunker doesn't have one door. It has dozens — sealed, dark, waiting on something I'm apparently in the middle of collecting.",
      "If the keys power a generator, light up the whole structure, open every cell at once... I either find everyone who's still alive in there, or I find out exactly what 'overwritten' really means.",
      "My hand's been shaking since the field. I told myself it was the cold.",
      "It isn't the cold.",
      "One more thing I know for sure: the deepest vault down there only answers to this week's Paper and Golden Key. If I'm missing either, the containers on the way down still hold them.",
    ],
    postBunker: [
      "The lights came on. All of them, for the first time since whatever happened to this place happened.",
      "I found cells back there. Empty — all of them. Not rescued-empty. Empty like they'd been that way since before I was born.",
      "Whatever the villagers became, whatever I'm becoming — the people in this bunker were never coming home, no matter how many keys I found.",
      "Something is still down at the very bottom of this place, behind a door my keys don't open. Not yet.",
      "I keep flexing my hand, watching for the moment it stops feeling like mine.",
      "End of what I know. Whatever's next, I'm not walking into it blind again.",
    ],
    onWeaponEvolve: [
      "It answers before I swing now — like it already knows the shape of this place.",
      "My hand and the blade, agreeing on something I never said out loud.",
    ],
    // Campaign-completion epilogue (v83, blueprint 3A): shown ONCE, right
    // after this act's postBunker beat, chained by onActBunkerCleared()'s
    // finale branch in game.js. Closes Act I's story on a real note and
    // hands the player their next goal instead of a dead end.
    epilogue: [
      "SYSTEM REBOOT — PROTOCOL ZERO.",
      "Five bunkers. Five fragments. The Last Light burning behind me like a second sunrise.",
      "I didn't save the villagers. I couldn't — they were gone before I ever picked up a blade. But every light I turned on is one the NULL_STATE can't use again.",
      "My hand still shakes. Whatever's happening to me isn't finished. Neither am I.",
      "The Last Light stays open — I can descend again whenever I choose. The deepest vault resets its code every week. And somewhere below the bottom floor, something is still waiting.",
      "PROTOCOL ZERO complete. The Walker walks on.",
    ],
  },
];

window.NS_CAMPAIGN = CAMPAIGN;
