/* ============================================================
   NULL_STATE :: STORY  (hybrid narrative — fixed beats + flavor)
   ============================================================ */
const Story = {
  title: "The chain remembers every soul it has consumed.\nYou descend into NULL_STATE — the abyss between blocks — where the deleted, the orphaned, and the forgotten still hunger. Reach the core. Or be overwritten.",

  // shown as cutscene at start
  intro: [
    "There was a transaction that should never have confirmed.",
    "It tore a hole in the chain. From that wound spilled the NULL_STATE — a dungeon of dead data and lost souls.",
    "You are a Walker. Your wallet is your weapon. Your memory, your only map.",
    "Descend. Survive. Find the GATEKEEPER at the depths… and the truth it guards.",
  ],

  // per-floor flavor lines (cycled / depth-aware)
  floors: [
    "The walls breathe with forgotten code.",
    "Cold light. Something dragged itself through here recently.",
    "You hear whispers in hex. They know your address.",
    "The deeper you go, the heavier the silence.",
    "Bones of failed validators line the corridor.",
    "The air tastes of burnt gas and old regret.",
    "Reality flickers — a rollback that never finished.",
    "Echoes of every Walker who came before. None returned.",
    "The Gatekeeper's heartbeat thrums through the stone.",
  ],

  bossIntro: [
    "The corridor opens into a vast, pulsing chamber.",
    "It rises — vast, glitching, ancient. THE GATEKEEPER.",
    "\"You are not the first to reach me, Walker. You will not be the last to fall.\"",
  ],
  bossDown: [
    "The Gatekeeper shatters into a cascade of light.",
    "The wound in the chain begins to close. For now.",
    "You ascend with what you've reclaimed — and a question that will not rest.",
  ],

  deaths: [
    "Your signature fades from the ledger.",
    "Overwritten. As if you never confirmed.",
    "The depths keep what they take.",
    "Another address, lost to the NULL.",
  ],

  floorLine(depth){
    if(depth % 5 === 0) return "A boss stirs in the dark…";
    return this.floors[(depth-1) % this.floors.length];
  },
  deathLine(){ return this.deaths[Math.floor(Math.random()*this.deaths.length)]; },
};
window.NS_STORY = Story;
