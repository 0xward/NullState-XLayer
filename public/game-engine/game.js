/* ============================================================
   NULL_STATE :: GAME  (main loop, render, input, flow)
   --- React-mountable build ---
   Exposes window.NullStateGame = { mount(opts), unmount() }.
   opts.chain provides the on-chain NULL_STRIKE bridge (wagmi-backed),
   matching the original NS_CHAIN.ultiTx({damage,xp,killed,onStatus}) -> {ok,demo,hash}.
   ============================================================ */
window.NullStateGame = (() => {
const { HERO, MON, ARCHETYPES, BOSS_ARCH, ORC_SHAMAN_ARCH, SKEL_MAGE_ARCH, SKEL_WARRIOR_ARCH, backgrounds, BG_BY_KEY, preloadAll, preloadHeroPreviews, preloadLPCHero, img, DECOR_SPRITES, GOLDEN_KEY_SRC, DUNGEON_THEMES } = window.NS_ASSETS;
const { makeDungeon, TILE } = window.NS_DUNGEON;
const { Player, Enemy } = window.NS_ENT;
const { Decor, DECOR_TYPES, rollLoot } = window.NS_PROPS;
const Story = window.NS_STORY;
const CAMPAIGN = window.NS_CAMPAIGN;
const Outdoor = window.NS_OUTDOOR;
const A = window.Audio2;

// Phase 4 icons — game-icons.net (CC BY 3.0, see ICON-CREDITS.md).
// Inline SVG so engine buttons/labels/logs use themed icons instead of
// mainstream emoji. fill=currentColor -> inherits the surrounding color.
const NS_ICON_PATHS = {
  strike: ["0 0 512 512", "<path d='M292.53 20.5l19 40.594L66.314 28.75 362.03 158.125l-18.967-40.594 149.218 15.282L292.53 20.5zm-252 23.375L318.314 413.97 312.906 348l184.97 146.5L294 186.656l5.406 65.97L40.53 43.875zM20.907 76.22l36.5 316.405L83.03 351.75l68.095 139.344-9.594-241.125-25.624 40.843-95-214.594z'></path>"],
  open: ["0 0 512 512", "<path d='M457.03 213.037L416.514 100.24C425 77.232 433.27 68.075 437.527 64.633c3.162-2.563 5.922-3.534 8.185-2.904 4.134 1.168 8.775 7.7 12.278 17.456 11.266 31.347 10.377 87.094-.96 133.85zm-324.287-17.9l312.804 34.84-43.82-122.1L145.558 79.34c2.593 36.102-1.913 79.913-12.817 115.796zM128.98 77.5l-45.06-5.02 37.03 103.123c7.773-32.06 10.625-68.357 8.03-98.102zM101.46 27.19c-3.793 3.1-10.77 10.666-18.25 28.566L402.23 91.3c5.333-13.695 11.37-24.702 17.88-32.495L108.796 24.13c-2.573-.29-5.415 1.51-7.338 3.06zm280.63 283.338l.61 169.352 66.352-53.63-.61-169.35zM366.163 487.9L46.62 452.306 46 278.396l319.553 35.594zM216.726 337.648a9.777 9.777 0 0 0 5.168-9.405c-.248-6.367-5.364-12.092-11.43-12.857h-.125c-6.14-.693-10.904 3.927-10.646 10.335a13.973 13.973 0 0 0 5.767 10.543l-2.17 25.073 17.57 2.005zm219.28-91.983l-307.46-34.25v59.54l242.712 27.037zM58.31 263.13l54.34 6.058v-49.98z'></path>"],
  vaultOpen: ["0 0 512 512", "<path d='M410.365 101.005c8.21-22.26 16.21-31.12 20.33-34.45 3.06-2.48 5.73-3.42 7.92-2.81 4 1.13 8.49 7.45 11.88 16.89 10.89 30.34 10 84.28-.93 129.51zm-286 72.92c7.52-31 10.28-66.13 7.77-94.92l-43.6-4.86zm289.46-113l-301.2-33.53c-2.5-.28-5.24 1.46-7.11 3-3.67 3-10.42 10.32-17.66 27.64l308.68 34.34c5.16-13.25 11.02-23.89 17.31-31.43zm-228.78 298.71v-70.72l10.76 1.19 42.24 5.18v70.51zm16-40.34a13 13 0 0 0 5.34 10.29l-2.34 24.42 17 1.74-4-25a9.54 9.54 0 0 0 5-9.15 13.64 13.64 0 0 0-11.06-12.59s.17.1.13.1c-5.95-.68-11.07 3.9-10.07 10.1zm53 64.45l-85-9.84v-86.72l-1.05-.09a8.14 8.14 0 0 1-7.27 6.71 8 8 0 0 1 5.23 8.9 8 8 0 0 1-8 6.66c8.453 4.004 4.341 16.778-4.86 15.1a8 8 0 0 1-8 13.8 8.01 8.01 0 0 1-12.28 10.29v.09a8 8 0 0 1-3.86 8.37l9.13 5.35v14.25l-12 7.13-12-7.12v-14.26l8.15-4.82a8.21 8.21 0 0 1-5.07-5.92.418.418 0 0 1 0-.1 8 8 0 0 1-15.18-5c-6.851 7.214-18.094-2.065-12.31-10.16-8.346 4.519-16.217-6.676-9.14-13-9.17 2.661-14.453-10.083-6.09-14.69a8 8 0 0 1-3.21-15.67c-9.294-1.047-9.548-14.463-.3-15.86-.669-.164-1.264-.473-1.83-.76l-17.24-1.86.6 167.11 309.18 34.49-.6-165.83-107-13.05zm140.06-164l4.72 1.91.91.58 38.72 4.31-23.26-64.77-12.82 37c-.16.46-3.41 9.8-8.27 20.99zm-208.54-39.74l5 5.49 12.75-11.15 21.45-2.28 16.61 15.35 10.51 8.73 18.54-9.29 3.44.5c.12-.67.25-1.34.38-2 3.08-16.1 7.35-30.16 7.53-30.75l13.39-43.91 16.88 42.71 8.42 21.42 10.66-12.39 22.14-25.73 5.78 33.45 3.29 19.1 17.1-9.64 35.09-19.79-18.48-51.4-247.86-27.61c2.51 34.94-1.85 77.32-12.39 112h2.32l7-12.86h40.46zm-111.29 97.39c7.6 2.1 7.9 12.766.43 15.29 7.737.867 9.802 11.153 3 14.94 7.653-.548 11.614 8.947 5.84 14 7.313-2.115 13.168 6.216 8.7 12.38 6.288-3.518 13.657 2.417 11.56 9.31 4.53-4.723 12.506-2.304 13.65 4.14 2.057-5.713 9.48-7.141 13.51-2.6-1.285-6.404 5.23-11.566 11.17-8.85-4.564-5.77.425-14.123 7.67-12.84-6.419-4.541-3.122-14.648 4.74-14.53-7.316-3.503-5.375-14.415 2.7-15.18a8 8 0 0 1-5.38-8l-76.43-8.26c-.41.19-.746.15-1.16.2zm367.54 139.08l-.59-163.86-8.67 7-55.51 46.79.58 162zm-26.23-165.2l-24.11-15.27-4.18-1.69c-5.91 11.52-13.39 23-22.66 27.88-5.44 2.88-12.22 4.34-20.16 4.34-11.13 0-24.75-2.91-37.35-8-10-4-23.3-11-30.26-21.34-4.9-7.29-6.64-17.77-5.31-32.92l-21.78 10.93-19-15.8-11.42-10.53-9.16 1-20.45 17.83-11-11.7h-24.21l-17.61 32-5.7-7.2-4.42 4.85-10.76 16.35-12.29 4.91L97.611 256h-12.2l-2.776 6.005 76.9 8.21a8.15 8.15 0 0 1 2-2.9 8 8 0 0 1 10.31-.46 1.657 1.657 0 0 1-.14-.24c-4.955-8.368 6.459-16.62 12.87-9.375 6.412 7.245-3.167 17.571-10.87 11.635a8 8 0 0 1 1.12 2.89l22.62 2.44 168.54 20.57 51.49-43.38zm-28.34-57.73l-36.88 20.79-7.14-41.47-28 32.51-18.13-46.11s-16.65 54.58-7 69c7.69 11.45 35.42 22.25 54.33 22.25 5 0 9.43-.76 12.67-2.48 13.8-7.31 30.15-54.49 30.15-54.49zm-317.08 270.8v-.2c0-3.77-8.21-6.83-18.33-6.83-10.12 0-18.33 3.06-18.33 6.83 0 3.21 6 5.9 14 6.63v.2c0 3.77 8.21 6.83 18.33 6.83 10.12 0 18.33-3.06 18.33-6.83-.01-3.21-5.98-5.9-14-6.63zm350 6.63c-10.13 0-18.33 3.06-18.33 6.83s8.21 6.83 18.33 6.83c10.12 0 18.33-3.06 18.33-6.83s-8.25-6.8-18.38-6.8zm40-16.28c-10.13 0-18.33 3.06-18.33 6.83s8.21 6.83 18.33 6.83c10.12 0 18.33-3.06 18.33-6.83s-8.22-6.83-18.34-6.83z'></path>"],
  grapple: ["0 0 512 512", "<path d='M337.6 24.24l-86 87.96 61.3-21.32c2.2 27.22 4.6 54.42 6.8 81.82l-18.6 1.6c-8.5 8.3-17 16.9-25.5 25.4l25.8 25.8 25.2-25.1 2.4-17.6c29.2 3.8 57.9 7.9 87.1 11.5l-19.7 44.5 94.9-68c-38.3-8-76.6-15.6-114.9-23.3l3.7-18.3 22.9 4.6 16.2-57.25-53.3 19.56 3.3 28.09-18.6 2.2-3.8-32.96c-3-23.07-6.1-46.13-9.2-69.2zm-106 103.96L183.1 211l66-42.7 24.4 7 25.6-25.5-.3-3-67.2-18.6zm117.5 76.1l-19.2 19.2 4.5 11-49.3 73.6 90.3-55.2-17-47.4zM270 220.6c-2.7 43.5-37.2 77.4-79.1 77.3-54.3 0-98.09 45.8-98.08 101.6 0 43.5-31.73 78.7-72.07 82.5v13.1h25.9c37.86-14.2 64.85-51.8 64.85-95.6 0-46.1 35.6-82.9 79.4-82.9 46.9 0 85.9-34.2 95.7-79.5-5.5-5.5-11-11-16.6-16.5z'></path>"],
  melt: ["0 0 512 512", "<path d='M245.05 15.514c34.29 48.815-23.535 320.54-90.302 136.72C106.796 325.11 38.956 332.518 38.876 252.55c-71.6 79.31 43.824 220.767 87.376 243.935h52.127c-45.92-40.016-76.784-78-82.176-135.968 47.312 9.423 71.855 20.96 81.263-62.048 60.736 86.59 100.944-49.376 137.184-107.12-1.647 40.32-3.343 93.456 22.848 129.888 8.736 12.143 33.232 16.11 54.736 15.807-9.92 16.08-44.848 69.376-17.008 89.2 27.84 19.824 33.072-.384 25.856 16.176-13.264 20.88-22.992 39.375-59.072 54.063h56.064c59.44-18.72 111.807-91.663 94.607-135.535-22.015 18.657-43.774 30.897-61.294 29.537 49.12-72.08 37.84-145.903 14.752-221.342-20.224 72.383-33.488 82.495-54.576 99.52 29.104-68.657-85.44-214.448-146.51-253.15z'></path>"],
  lock: ["0 0 512 512", "<path d='M254.28 17.313c-81.048 0-146.624 65.484-146.624 146.406V236h49.594v-69.094c0-53.658 43.47-97.187 97.03-97.187 53.563 0 97.032 44.744 97.032 97.186V236h49.594v-72.28c0-78.856-65.717-146.407-146.625-146.407zM85.157 254.688c-14.61 22.827-22.844 49.148-22.844 76.78 0 88.358 84.97 161.5 191.97 161.5 106.998 0 191.968-73.142 191.968-161.5 0-27.635-8.26-53.95-22.875-76.78H85.155zM254 278.625c22.34 0 40.875 17.94 40.875 40.28 0 16.756-10.6 31.23-25.125 37.376l32.72 98.126h-96.376l32.125-98.125c-14.526-6.145-24.532-20.62-24.532-37.374 0-22.338 17.972-40.28 40.312-40.28z'></path>"],
  scroll: ["0 0 512 512", "<path d='M103.432 17.844c-1.118.005-2.234.032-3.348.08-2.547.11-5.083.334-7.604.678-20.167 2.747-39.158 13.667-52.324 33.67-24.613 37.4 2.194 98.025 56.625 98.025.536 0 1.058-.012 1.583-.022v.704h60.565c-10.758 31.994-30.298 66.596-52.448 101.43-2.162 3.4-4.254 6.878-6.29 10.406l34.878 35.733-56.263 9.423c-32.728 85.966-27.42 182.074 48.277 182.074v-.002l9.31.066c23.83-.57 46.732-4.298 61.325-12.887 4.174-2.458 7.63-5.237 10.467-8.42h-32.446c-20.33 5.95-40.8-6.94-47.396-25.922-8.956-25.77 7.52-52.36 31.867-60.452 5.803-1.93 11.723-2.834 17.565-2.834v-.406h178.33c-.57-44.403 16.35-90.125 49.184-126 23.955-26.176 42.03-60.624 51.3-94.846l-41.225-24.932 38.272-6.906-43.37-25.807h-.005l.002-.002.002.002 52.127-8.85c-5.232-39.134-28.84-68.113-77.37-68.113C341.14 32.26 222.11 35.29 149.34 28.496c-14.888-6.763-30.547-10.723-45.908-10.652zm.464 18.703c13.137.043 27.407 3.804 41.247 10.63l.033-.07c4.667 4.735 8.542 9.737 11.68 14.985H82.92l10.574 14.78c10.608 14.83 19.803 31.99 21.09 42.024.643 5.017-.11 7.167-1.814 8.836-1.705 1.67-6.228 3.875-15.99 3.875-40.587 0-56.878-44.952-41.012-69.06C66.238 46.64 79.582 39.22 95.002 37.12c2.89-.395 5.863-.583 8.894-.573zM118.5 80.78h46.28c4.275 15.734 3.656 33.07-.544 51.51H131.52c1.9-5.027 2.268-10.574 1.6-15.77-1.527-11.913-7.405-24.065-14.62-35.74zm101.553 317.095c6.44 6.84 11.192 15.31 13.37 24.914 3.797 16.736 3.092 31.208-1.767 43.204-4.526 11.175-12.576 19.79-22.29 26h237.19c14.448 0 24.887-5.678 32.2-14.318 7.312-8.64 11.2-20.514 10.705-32.352-.186-4.473-.978-8.913-2.407-13.18l-69.91-8.205 42.017-20.528c-8.32-3.442-18.64-5.537-31.375-5.537H220.053zm-42.668.506c-1.152-.003-2.306.048-3.457.153-2.633.242-5.256.775-7.824 1.63-15.11 5.02-25.338 21.54-20.11 36.583 3.673 10.57 15.347 17.71 25.654 13.938l1.555-.57h43.354c.946-6.36.754-13.882-1.358-23.192-3.71-16.358-20.543-28.483-37.815-28.54z'></path>"],
  key: ["0 0 512 512", "<path d='M356.5 16.375l-174.906 255.22 1.53 1.06 31.97 22.314 175.062-255.5L356.5 16.374zm90.063 62.22c-20.16 29.418-44.122 23.1-68.25 8.905l-48.688 72.875c21.278 16.55 36.46 35.645 18.594 61.72l42.967 29.468 28.907-42.157-14.72-9.156c-3.167 1.844-6.85 2.906-10.78 2.906-11.85 0-21.47-9.62-21.47-21.47 0-11.847 9.62-21.436 21.47-21.436s21.437 9.59 21.437 21.438c0 .195-.025.4-.03.593l15.906 9.907 17.938-26.218-37.688-23.5 11.03-17.72 14.94 9.313 10.093-16.188 24.25 15.094 17.092-24.94-43-29.436zM141.22 268.624c-.31.01-.628.023-.94.063-.827.104-1.652.284-2.53.562-3.51 1.11-7.4 4.066-10.125 7.938-2.724 3.87-4.16 8.487-4 12.125.16 3.637 1.257 6.338 5.25 9.125l76.594 53.468c3.283 2.293 5.727 2.35 9.124 1.156 3.396-1.192 7.323-4.26 10.125-8.218 2.8-3.96 4.352-8.66 4.31-12.188-.04-3.53-.89-5.787-4.374-8.22L148.03 270.97c-2.546-1.78-4.657-2.42-6.81-2.345zM84.28 312.78c-24.354.41-45.504 9.52-57.655 27.25-16.95 24.737-11.868 59.753 9.625 90.283-1.838 4.72-2.875 9.84-2.875 15.187 0 23.243 19.07 42.313 42.313 42.313 8.635 0 16.692-2.625 23.406-7.125 43.208 18.488 88.07 12.714 108.28-16.782 18.695-27.28 10.884-66.912-16.374-99.312l-63.094-44.03c-14.016-5.107-28.07-7.7-41.25-7.783-.792-.004-1.59-.012-2.375 0zm-8.593 109.126c13.143 0 23.594 10.45 23.594 23.594 0 13.143-10.45 23.625-23.593 23.625-13.142 0-23.624-10.482-23.624-23.625s10.482-23.594 23.624-23.594z'></path>"],
  guard: ["0 0 512 512", "<path d='M255.997 16.004c-120 0-239.997 60-239.997 149.998C16 226.002 61 256 61 316c0 45-15 45-15 75 0 14.998 48.01 32.002 89.998 44.998v60h239.997v-60s90.567-27.957 90-45c-.933-27.947-15-30-15-74.998 0-30 45.642-91.42 44.998-149.998 0-90-119.998-149.998-239.996-149.998zm-90 179.997c33.137 0 60 26.864 60 60 0 33.136-26.863 60-60 60C132.863 316 106 289.136 106 256c0-33.136 26.862-60 59.998-60zm179.998 0c33.136 0 60 26.864 60 60 0 33.136-26.864 60-60 60-33.136 0-60-26.864-60-60 0-33.136 26.864-60 60-60zm-89.998 105c15 0 45 60 45 75 0 29.998 0 29.998-15 29.998h-60c-15 0-15 0-15-30 0-15 30-74.998 45-74.998z'></path>"],
  heart: ["0 0 512 512", "<path d='M480.25 156.355c0 161.24-224.25 324.43-224.25 324.43S31.75 317.595 31.75 156.355c0-91.41 70.63-125.13 107.77-125.13 77.65 0 116.48 65.72 116.48 65.72s38.83-65.73 116.48-65.73c37.14.01 107.77 33.72 107.77 125.14z'></path>"],
};
function nsIcon(name, cls){
  const p = NS_ICON_PATHS[name]; if(!p) return '';
  return `<svg class="ns-ico ${cls||''}" viewBox="${p[0]}" fill="currentColor" aria-hidden="true">${p[1]}</svg>`;
}

// ---- mount/teardown state ----
let CHAIN = null;            // injected on mount (wagmi bridge)
let ENERGY = null;           // Phase 1 energy bridge (injected on mount, fail-open default)
let _lastRunSec = -1;        // 1Hz change-guard for the HUD run-timer plate
let MATERIALS = null;        // Phase 2 materials bridge (injected on mount)
// SHAKE_ENABLED: screen-shake on/off — punch list #10 (v38). Runtime-only
// flag, same lightweight pattern as A.sfxEnabled in audio.js (resets to
// the default each fresh page load, no localStorage persistence — matches
// how toggleSfx/toggleSound already behave, so this doesn't need to be
// the one setting that's suddenly "sticky" when the others aren't).
let SHAKE_ENABLED = true;
// WALLET_ADDRESS: current connected wallet, attached to burn-record events
// so /api/burn/record knows whose stash to credit. Kept in sync after
// mount via setWalletAddress() (see DungeonGame.tsx — wagmi's address can
// change after the engine has already mounted).
let WALLET_ADDRESS = null;
// INITIAL_STATS: baseline {xp, level} pulled from the on-chain PlayerProfile,
// applied to a brand-new run so a returning player's career level carries
// over even when there's no exact bunker save (see applyRestoredState()).
let INITIAL_STATS = null;
// SAVED_SESSION: an exact off-chain snapshot (see getSaveSnapshot()) written
// by the Settings > Save Game action. Single-use — consumed the moment
// onStart() restores it, so it can't be replayed (matches "Death is
// permanent" — no save-scumming a dangerous fight).
let SAVED_SESSION = null;
// Which bunker a RAID re-enters (mount({raidActIndex})). Meaningless in every
// other start mode; startRaid() clamps it to a real act regardless.
let RAID_ACT_INDEX = 0;
// START_MODE (owner request): the React Main Menu is now the ONE entry point,
// so its "New Game" / "Continue" / "New Game+" / "The Null Abyss" buttons
// should drop STRAIGHT into play — the canvas title + character preview is
// skipped. Set from mount({ startMode }); boot() auto-starts the matching run.
// null = show the title as before (demo / direct mounts). The title is still
// reachable in-session via returnToTitleScreen() after finishing the campaign.
let START_MODE = null;
// True when the app shell is showing the world-map hub instead of the classic
// menu. Set from mount({ worldMapHub }). With the hub on, clearing a bunker
// surfaces the player back to the map (so they watch the ✓ land and the next
// door unlock) instead of walking straight into the next act's outdoor scene.
let WORLDMAP_HUB = false;
// CARRY_OVER_SNAPSHOT: bridges progress (loot, xp/level/kills/celo/hp, key/
// paper run-caps) across the outdoor walk between two bunkers in the SAME
// run. Captured in onActBunkerCleared() right before that bunker's G is
// torn down, and consumed (then nulled — single-use, same pattern as
// SAVED_SESSION above) the moment the player reaches the next bunker's door
// in onOutdoorReachedDoor(). Without this, newGame() at the next bunker had
// nothing but INITIAL_STATS (the on-chain baseline captured once at mount)
// to fall back on, so loot AND in-run xp/level/kills/celo/hp all silently
// reset to that old baseline every time a bunker was cleared — not just
// loot.
let CARRY_OVER_SNAPSHOT = null;
let mounted = false, destroyed = false, rafId = null;
const _winL = [];            // [type, fn] window listeners to clean up
function winOn(type, fn, opts){ window.addEventListener(type, fn, opts); _winL.push([type, fn]); }

// ---- DOM refs (assigned in mount) ----
let cv = null, ctx = null;
let stick = null, nub = null, atkBtn = null, touchEl = null;
const $ = id => document.getElementById(id);

let cw=0, ch=0, dpr=1, zoom=1.4, zoomFar=1.4, zoomNear=2.0, portrait=false;

function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
function resize(){
  if(!cv) return;
  dpr = Math.min(window.devicePixelRatio||1, 2);
  cw = cv.clientWidth; ch = cv.clientHeight;
  cv.width = cw*dpr; cv.height = ch*dpr;
  portrait = ch > cw;
  // explore (far) zoom + combat (near) zoom — camera animates between them.
  // Lowered floors/multiplier vs. the original (1.15 far / 1.5x near) — those
  // made characters render far too large on typical phone widths (~360-430px).
  zoomFar  = portrait ? clamp(cw/520, 0.78, 1.5) : clamp(Math.min(cw,ch)/680, 0.85, 1.6);
  zoomNear = zoomFar * 1.22; // gentler combat push-in (was 1.5x)
  zoom = clamp(zoom, zoomFar, zoomNear);
}

// ---- input ----
const input = {up:0,down:0,left:0,right:0,attack:0};
function resetInput(){
  input.up=input.down=input.left=input.right=input.attack=0;
  if(nub){ nub.style.left='26px'; nub.style.top='26px'; }
  if(stick) stick.classList.remove('active');
}
const keymap = {
  ArrowUp:'up', KeyW:'up', ArrowDown:'down', KeyS:'down',
  ArrowLeft:'left', KeyA:'left', ArrowRight:'right', KeyD:'right',
};
function onKeyDown(e){
  if(keymap[e.code]){ input[keymap[e.code]]=1; e.preventDefault(); }
  if(e.code==='Space'||e.code==='KeyJ'){ input.attack=1; e.preventDefault(); }
  if(e.code==='KeyE'){ tryInteract(); }
}
function onKeyUp(e){ if(keymap[e.code]) input[keymap[e.code]]=0;
  if(e.code==='Space'||e.code==='KeyJ') input.attack=0; }

// touch controls
const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints>0;
function setupTouch(){
  if(!isTouch || !touchEl) return; touchEl.classList.remove('hidden');
  let sid=null, sc={x:0,y:0};
  stick.addEventListener('touchstart',e=>{const t=e.changedTouches[0];sid=t.identifier;
    stick.classList.add('active');
    const r=stick.getBoundingClientRect(); sc={x:r.left+r.width/2,y:r.top+r.height/2}; e.preventDefault();},{passive:false});
  stick.addEventListener('touchmove',e=>{for(const t of e.changedTouches){if(t.identifier!==sid)continue;
    let dx=t.clientX-sc.x, dy=t.clientY-sc.y; const m=Math.hypot(dx,dy)||1; const cl=Math.min(m,26);
    dx=dx/m*cl; dy=dy/m*cl; nub.style.left=(26+dx)+'px'; nub.style.top=(26+dy)+'px';
    input.left=dx<-8?1:0; input.right=dx>8?1:0; input.up=dy<-8?1:0; input.down=dy>8?1:0;}
    e.preventDefault();},{passive:false});
  const end=e=>{for(const t of e.changedTouches){if(t.identifier===sid){sid=null;
    stick.classList.remove('active');
    nub.style.left='26px';nub.style.top='26px'; input.left=input.right=input.up=input.down=0;}}};
  stick.addEventListener('touchend',end); stick.addEventListener('touchcancel',end);
  atkBtn.addEventListener('touchstart',e=>{input.attack=1;e.preventDefault();},{passive:false});
  atkBtn.addEventListener('touchend',e=>{input.attack=0;e.preventDefault();},{passive:false});
}

// ---- world state ----
let G = null;  // game object

// Bug #3 fix ("Continue Game malah masuk ke Pick Character"): getSaveSnapshot()
// used to return null (nothing to save) any time the player wasn't literally
// standing inside a bunker floor at that exact instant — G is set to null
// while walking the outdoor overworld BETWEEN bunkers (see onActBunkerCleared()
// / Outdoor.enter()). If the player did Save & Exit (or the periodic 15s
// autosave / pagehide fired) during that outdoor walk, nothing got written to
// Firestore, so the NEXT time they hit "Continue" there was no saved session
// to resume — falling all the way back to boot()'s fresh character-select
// screen even though they'd already made real progress. This cache holds the
// last valid in-bunker snapshot so a save taken while outdoors can still
// fall back to "resume at the last bunker floor I was on", instead of losing
// Continue entirely. It's session-only (module scope, reset on page reload),
// which is fine — it only needs to bridge the short outdoor-walk window.
let LAST_BUNKER_SNAPSHOT = null;

// Golden Key weekly cap (Phase 5.5 #9A) — was a flat 2-per-run client-side
// counter; now capped at 1 PER WALLET PER WEEK, enforced server-side (see
// app/api/goldenkey/status + /claim) so it can't be farmed by starting new
// runs. GOLDKEY_WEEK: cached result of the status check made at the start
// of each run (see refreshGoldenKeyWeeklyStatus()). Optimistically defaults
// to "available" so a slow/failed network check never locks a player out
// of ever finding one this week — the actual claim() call is the real
// atomic gate; if it turns out the week was already claimed elsewhere,
// the loot slot has already been generated for this run (rare edge case,
// same tradeoff the burn system makes for its off-chain credit).
let GOLDKEY_WEEK = { loaded:false, canClaim:true, weekId:null };

// Weekly Vault (Phase 5.5 #9C, Bunker 5) — same ISO week scheme (YYYYWW,
// Monday 00:00 UTC boundary) as Golden Key/Paper, reimplemented here in
// plain JS since game.js is a static <script> file with no access to the
// TS module (lib/vault-utils.ts / lib/web3-client.ts). MUST stay in sync
// with getISOWeekId() in lib/web3-client.ts — same algorithm, same output.
function getVaultWeekId(){
  const date = new Date();
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return d.getUTCFullYear() * 100 + week;
}

async function refreshGoldenKeyWeeklyStatus(){
  if(!WALLET_ADDRESS) { GOLDKEY_WEEK = { loaded:false, canClaim:true, weekId:null }; return; }
  try{
    const res = await fetch('/api/goldenkey/status?walletAddress='+encodeURIComponent(WALLET_ADDRESS));
    const data = await res.json();
    if(res.ok){ GOLDKEY_WEEK = { loaded:true, canClaim:!!data.canClaim, weekId:data.weekId||null }; }
  }catch(e){ /* offline — keep optimistic default, claim() below still gates server-side */ }
}

// Golden Keys now only appear as a loot slot inside interactive containers
// (props.js Decor.rollLootSlots(), Rotten Armoire / Lost Cache only), never
// as a standalone floor pickup. props.js can't reach G directly, so it
// checks this small bridge instead when deciding whether to roll one in.
window.NS_GOLDKEY = {
  remaining(){
    if(!G || (G.goldenKeysRemaining||0) <= 0) return 0;
    if(GOLDKEY_WEEK.loaded && !GOLDKEY_WEEK.canClaim) return 0; // already claimed this week
    return G.goldenKeysRemaining;
  },
  take(){
    if(this.remaining() <= 0) return false;
    G.goldenKeysRemaining -= 1;
    // Fire-and-forget: locks the week server-side. Doesn't block the loot
    // slot from being granted this run (see comment on GOLDKEY_WEEK above) —
    // if this comes back alreadyClaimed, there's nothing to undo locally,
    // it's just logged for visibility.
    if(WALLET_ADDRESS){
      fetch('/api/goldenkey/claim', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ wallet: WALLET_ADDRESS })
      }).then(r=>r.json()).then(data=>{
        if(data && data.alreadyClaimed) console.warn('[goldenkey] claim lost a race for this week — already claimed elsewhere');
      }).catch(()=>{ /* offline — local run cap (1) still applies */ });
    }
    return true;
  }
};

// Paper weekly cap (Phase 5.5 #9B) — same server-enforced pattern as
// Golden Key: 1 PER WALLET PER WEEK (app/api/paper/status + /claim), same
// ISO week boundary. PAPER_WEEK: cached result of the status check made at
// the start of each run. Unlike Golden Key, a Paper the player already
// holds never "expires" at the week boundary — it just always shows
// whatever the CURRENT week's shared vault code is when tapped (see
// openItemZoom 'paper-code' mode below), since the code itself is a global
// value, not something tied to the specific Paper copy that was found.
let PAPER_WEEK = { loaded:false, canClaim:true, weekId:null };

async function refreshPaperWeeklyStatus(){
  if(!WALLET_ADDRESS) { PAPER_WEEK = { loaded:false, canClaim:true, weekId:null }; return; }
  try{
    const res = await fetch('/api/paper/status?walletAddress='+encodeURIComponent(WALLET_ADDRESS));
    const data = await res.json();
    if(res.ok){ PAPER_WEEK = { loaded:true, canClaim:!!data.canClaim, weekId:data.weekId||null }; }
  }catch(e){ /* offline — keep optimistic default, claim() below still gates server-side */ }
}

// Paper appears as a loot slot inside the same vault-like interactive
// containers as Golden Key (props.js Decor.rollLootSlots()), never a
// standalone floor pickup. Local run-cap (G.paperRemaining, reset to 1 per
// newGame()) mirrors goldenKeysRemaining's dual-layer design: a small
// client-side cap so a single run can't roll it more than once, PLUS the
// real server-side weekly gate in PAPER_WEEK/claim below.
window.NS_PAPER = {
  remaining(){
    if(!G || (G.paperRemaining||0) <= 0) return 0;
    if(PAPER_WEEK.loaded && !PAPER_WEEK.canClaim) return 0; // already claimed this week
    return G.paperRemaining;
  },
  take(){
    if(this.remaining() <= 0) return false;
    G.paperRemaining -= 1;
    // Fire-and-forget, same tradeoff as NS_GOLDKEY.take() — see comment there.
    if(WALLET_ADDRESS){
      fetch('/api/paper/claim', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ wallet: WALLET_ADDRESS })
      }).then(r=>r.json()).then(data=>{
        if(data && data.alreadyClaimed) console.warn('[paper] claim lost a race for this week — already claimed elsewhere');
      }).catch(()=>{ /* offline — local run cap (1) still applies */ });
    }
    return true;
  }
};

// ---- Vault Fragments (GAME-DESIGN.md §5.1) ----------------------------------
// The effort path to the weekly Vault. Opening an interactive container earns
// one fragment; crossing a threshold GRANTS Old Paper or the Golden Key
// outright, so a week of play can never pay nothing. The 16% loot roll above
// is untouched and still fires on top — luck shortcuts the grind, it just no
// longer gates it.
//
// The server owns every number here (see lib/server/vault-fragments.ts). This
// side only reports "a container was opened" and reacts to what comes back:
// there is deliberately no amount in the request, because a client that could
// name its own reward would not need to play.
let VAULT_FRAG = { loaded:false, fragments:0, nextGoal:null };

// ---- Daily Contracts (GAME-DESIGN.md §5.2) ---------------------------------
// Three objectives a day, reset 00:00 UTC, paying Glitch Shards and NullState
// Point. This side only REPORTS what happened; the server owns which contracts
// are live today, what each is worth, and every ceiling (see
// lib/server/dailyContracts.ts). A finished contract pays out on the spot, so
// there is nothing to claim and nothing to remember.
//
// Kills are batched rather than sent one per corpse: a busy floor would
// otherwise fire a request every second or so for a counter that only needs to
// be roughly live. Flushed on floor clear, on death, and on unmount.
//
// ONLY KILLS AND FLOORS ARE REPORTED FROM HERE, because those are the only two
// the server cannot see for itself. The other two moved server-side after the
// owner burned items on the Rewards screen and watched the contract sit still:
//
//   burns      -> /api/burn/record. Burning happens BOTH in-run and on the
//                 out-of-game Rewards screen, which never runs this file. That
//                 route is the one place both paths pass through, and the count
//                 it credits is the one it has already validated.
//   containers -> /api/vault/fragments, off the same POST that awards the
//                 fragment — one request per container, first open only.
//
// Both are strictly better than a client report: they cannot be inflated from
// outside. What comes back is announced by announceContracts() below, so a
// contract finished on either path still says so in the run log.
let CONTRACT_KILLS = 0;
// One place that turns a contract response into log lines, shared by every
// route that can complete one.
function announceContracts(data){
  const granted = data && Array.isArray(data.granted) ? data.granted : [];
  const list = data && Array.isArray(data.contracts) ? data.contracts : null;
  if(!granted.length || !list) return;
  for(const id of granted){
    const c = list.find(x=>x.id===id); if(!c) continue;
    const r = c.reward || {};
    const paid = r.kind==='point' ? ('+'+r.amount+' NullState Point')
               : r.kind==='shard' ? ('+'+r.amount+' Glitch Shard') : 'reward';
    log('◆ MISSION COMPLETE — '+c.label+'. '+paid+'.', 'reward');
  }
}
function reportContract(metric, amount){
  if(!WALLET_ADDRESS || !(amount > 0)) return;
  fetch('/api/contracts', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ wallet: WALLET_ADDRESS, metric, amount })
  }).then(r=>r.json()).then(announceContracts)
    .catch(()=>{ /* offline — the counter simply does not advance */ });
}
function flushContractKills(){
  if(CONTRACT_KILLS <= 0) return;
  const n = CONTRACT_KILLS; CONTRACT_KILLS = 0;
  reportContract('kills', n);
}

async function refreshVaultFragments(){
  if(!WALLET_ADDRESS){ VAULT_FRAG = { loaded:false, fragments:0, nextGoal:null }; return; }
  try{
    const res = await fetch('/api/vault/fragments?wallet='+encodeURIComponent(WALLET_ADDRESS));
    const data = await res.json();
    if(res.ok && data) VAULT_FRAG = { loaded:true, fragments:data.fragments|0, nextGoal:data.nextGoal||null };
  }catch(e){ /* offline — the bar just shows nothing; credits still land server-side */ }
}

// Called once per interactive container opened. Fire-and-forget: a container's
// loot must never wait on the network, and a dropped credit costs the player
// one fragment out of twelve, not the week.
function creditVaultFragment(decor){
  if(!WALLET_ADDRESS || !G) return;
  fetch('/api/vault/fragments', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ wallet: WALLET_ADDRESS })
  }).then(r=>r.json()).then(data=>{
    if(!data || typeof data.fragments !== 'number') return;
    VAULT_FRAG = { loaded:true, fragments:data.fragments, nextGoal:data.nextGoal||null };
    // This same request credits the 'containers' Daily Contract server-side.
    // `granted` here means FRAGMENT grants, so the contract grants ride along
    // under their own key rather than colliding with it.
    announceContracts({ granted: data.contractsGranted, contracts: data.contracts });
    const granted = Array.isArray(data.granted) ? data.granted : [];
    if(granted.length && G){
      // Drop the granted item where the container stands, through the exact
      // same applyLoot the lucky-roll path uses — same stash write, same
      // floating text, same log line, so the two award routes are
      // indistinguishable to the player.
      const gx = decor ? decor.x : G.player.x;
      const gy = decor ? (decor.y - decor.h*0.8) : G.player.y;
      if(granted.indexOf('paper') >= 0){
        applyLoot('paper', 1, gx, gy);
        // Stop this run's 16% roll from also producing one. The server would
        // reject the duplicate claim anyway, but the client grants the ITEM
        // locally before it hears back — so without this the player could end
        // up holding two Papers against a single weekly claim record.
        G.paperRemaining = 0; PAPER_WEEK = { loaded:true, canClaim:false, weekId:data.weekId||null };
        log('◆ VAULT FRAGMENTS COMPLETE — the Paper is yours.', 'reward', 'scroll');
      }
      if(granted.indexOf('goldenKey') >= 0){
        applyLoot('goldkey', 1, gx, gy);
        G.goldenKeysRemaining = 0; GOLDKEY_WEEK = { loaded:true, canClaim:false, weekId:data.weekId||null };
        log('◆ VAULT FRAGMENTS COMPLETE — the Golden Key is yours.', 'reward', 'key');
      }
      updateInventoryPanel();
    } else if(VAULT_FRAG.nextGoal){
      // Quiet progress. Only every fifth fragment, and only on the way to
      // something still missing — a line per container would bury the run log.
      const n = VAULT_FRAG.fragments, goal = VAULT_FRAG.nextGoal;
      if(n % 5 === 0 && n < goal.threshold){
        log('Vault fragments ' + n + '/' + goal.threshold + ' — ' + goal.label, 'dm');
      }
    }
  }).catch(()=>{ /* offline — see above */ });
}

// Recompute level-derived stats (maxHp/atkDmg/speed) so a restored player
// at level N has exactly the same numbers gainXp()'s level-up loop would
// have produced getting there naturally — see entities.js Player.gainXp().
// maxHp is intentionally FLAT across all levels now — HP no longer grows
// from leveling up. The only thing that raises the HP cap above 100 is
// equipped Armor (see applyEquipment() below, which multiplies this base).
function applyLevelStats(p, level){
  const steps = Math.max(0, level - 1);
  p.level = level;
  p.maxHp = 100;
  p.atkDmg = 22 + 3 * steps;
  p.speed = 141 + 1.125 * steps; // v65 T1: whole curve scaled -25% (was 188 + 1.5*steps) to match Player constructor base.
  // LEVEL = CRIT: restore the crit chance a naturally-levelled player would
  // have (mirrors Player.updateCrit() in entities.js — keep in sync).
  if (typeof p.updateCrit === 'function') p.updateCrit();
  else p.critChance = Math.min(0.25, 0.004 * steps);
}

// Apply a saved/baseline snapshot to a freshly-constructed player + G.
// `snap` shape: { xp, level, kills, hp, depth, maxDepthReached,
//                 inventory:{keys,relics,shards}, key:{depth,taken} }
// (v40 — `celo` removed: dead in-run stat, never wired to any real
// currency/balance.)
function applyRestoredState(G, p, snap){
  applyLevelStats(p, snap.level || 1);
  p.xp = snap.xp || 0;
  p.kills = snap.kills || 0;
  p.hp = Math.min(snap.hp != null ? snap.hp : p.maxHp, p.maxHp);
  if (snap.inventory) {
    G.inventory.keys = snap.inventory.keys || 0;
    G.inventory.relics = snap.inventory.relics || 0;
    G.inventory.shards = snap.inventory.shards || 0;
    G.inventory.gshards = snap.inventory.gshards || { t1:0, t2:0, t3:0 }; // Phase 2
    // Paper (Phase 5.5 #9B) — persists across weeks once found (see
    // NS_PAPER/PAPER_WEEK comment above), so just a plain counter like
    // keys/relics/shards rather than a weekly-reset field.
    G.inventory.paper = snap.inventory.paper || 0;
    G.inventory.items = {};
    if (snap.inventory.items && window.NS_ITEMS) {
      for (const [id, qty] of Object.entries(snap.inventory.items)) {
        const item = window.NS_ITEMS.getItem(Number(id));
        if (item && qty > 0) G.inventory.items[item.id] = { item, qty };
      }
    }
  }
  // Golden Keys are a run-capped container drop (Phase 5.5 #9A: now 1 per
  // wallet per week, server-enforced — see GOLDKEY_WEEK above) rather than
  // a floor pickup — carry over how many are still findable this run so
  // continuing a save doesn't hand out extra keys beyond the run cap.
  // Falls back to "1 minus however many already sit in the inventory" for
  // older saves that predate this field (or predate the 2->1 change).
  G.goldenKeysRemaining = (snap.goldenKeysRemaining != null)
    ? Math.min(1, snap.goldenKeysRemaining)
    : Math.max(0, 1 - (G.inventory.keys || 0));
  // Paper run-cap (Phase 5.5 #9B) — same per-run local-cap pattern as
  // Golden Key above. Resuming a save mid-run shouldn't hand out a second
  // Paper this run if one was already found before saving.
  G.paperRemaining = (snap.paperRemaining != null)
    ? Math.min(1, snap.paperRemaining)
    : Math.max(0, 1 - (G.inventory.paper || 0));
  G.maxDepthReached = Math.max(snap.maxDepthReached || 1, snap.depth || 1);
}

// Reads Marketplace ownership + equipped-slot choices straight out of
// localStorage for the currently-connected wallet. Both keys are just an
// instant-read local cache of data that actually lives in Firebase, keyed
// by wallet — components/game/DungeonGame.tsx refreshes both from the
// server (GET /api/marketplace/owned) right before mounting the engine, so
// this stays correct even after a MiniPay uninstall/reinstall or a switch
// to a different device. `nullstate-owned-<wallet>` is also written
// directly by components/game/MarketplaceScreen.tsx (persist()) the moment
// a purchase is confirmed; `nullstate-equipped-<wallet>` is written by
// window.NS_saveEquipment (below), which also pushes to Firebase via
// POST /api/marketplace/equip. Called once per newGame() so a fresh G
// always starts with whatever the wallet actually owns/has equipped,
// instead of an empty slate. See the long comment in newGame() for the
// race condition this fixes.
// TASK B — FREE DEFAULT gear. rusty_blade is the free default weapon (hidden
// from the shop, see marketplace-items.js) and default_skin is the free default
// outfit (render-only, see assets.js LPC_OUTFIT). Every player/guest starts with
// the default weapon equipped so nobody is ever weaponless, and the default skin
// renders automatically as the composite fallback (see entities.js). The default
// weapon is FREE, so it bypasses the "must be owned" gate: we inject it into the
// owned list and default the empty mainhand slot to it in loadPersistedEquipment.
const DEFAULT_WEAPON_ID = 'rusty_blade';
const DEFAULT_SKIN_ID = 'default_skin';
// TASK #7 — the EXCLUSIVE Season-Pass cosmetic skin (assets.js LPC_OUTFIT +
// marketplace-items.js pass_warden, hidden+passOnly). It is never bought:
// active pass holders get it granted for free by injecting its id into `owned`
// so it can be equipped in the Gear tab. Whether this wallet holds a pass is
// bridged from React two ways — a localStorage flag written BEFORE mount (read
// synchronously by loadPersistedEquipment, mirroring the owned/equipped cache)
// and NS_EQUIP.setPassHolder() for a live update if the pass status resolves
// after the run has already started. Zero stats (it's an outfit).
const PASS_EXCLUSIVE_SKIN_ID = 'pass_warden';
let PASS_HOLDER = false;
// Read the pre-mount holder flag for a (lowercased) wallet address. Missing/'0'
// => not a holder; only an explicit '1' grants the skin.
function isPassHolder(addrLc){
  if(!addrLc || typeof localStorage === 'undefined') return false;
  try{ return localStorage.getItem('nullstate-pass-'+addrLc) === '1'; }catch(e){ return false; }
}
// Fold the free default weapon into a loadout: ensure it's in `owned` (so the
// Gear tab lists it and equipItem() can re-select it) and, if no weapon is
// equipped, equip it. Mutates+returns the {owned, equipped} pair.
function withDefaultGear(le){
  const owned = Array.isArray(le.owned) ? le.owned.slice() : [];
  if(!owned.includes(DEFAULT_WEAPON_ID)) owned.unshift(DEFAULT_WEAPON_ID);
  const equipped = le.equipped || { mainhand:null, body:null, outfit:null };
  if(!equipped.mainhand) equipped.mainhand = DEFAULT_WEAPON_ID;
  return { owned, equipped };
}
function loadPersistedEquipment(){
  // Phase 9: `outfit` is the cosmetic-skin slot (3rd slot). Purely visual.
  const empty = { owned: [], equipped: { mainhand: null, body: null, outfit: null } };
  if(!WALLET_ADDRESS || typeof localStorage === 'undefined') return withDefaultGear(empty);
  const addr = WALLET_ADDRESS.toLowerCase();
  let owned = [];
  let equipped = { mainhand: null, body: null, outfit: null };
  try{
    const raw = localStorage.getItem('nullstate-owned-'+addr);
    if(raw){ const parsed = JSON.parse(raw); if(Array.isArray(parsed)) owned = parsed; }
  }catch(e){ /* corrupt/unavailable cache — fall back to empty, not fatal */ }
  try{
    const raw = localStorage.getItem('nullstate-equipped-'+addr);
    if(raw){
      const parsed = JSON.parse(raw) || {};
      equipped = { mainhand: parsed.mainhand || null, body: parsed.body || null, outfit: parsed.outfit || null };
    }
  }catch(e){ /* corrupt/unavailable cache — fall back to empty, not fatal */ }
  // v76 Task #7: four weapons were re-skinned and given honest ids
  // (war_axe -> argent_waraxe etc). Map any pre-v76 id read out of storage or
  // the server onto its replacement so an existing purchase is never silently
  // lost, and drop ids that no longer exist at all (void_reaper, hunters_bow,
  // ancient_aegis, warden_plate were removed on owner request — there is
  // nothing to map them to). Dedupe, because a wallet could own BOTH the old
  // and the new id after the migration.
  const M = window.NS_MARKET;
  if(M){
    owned = owned.map(id => M.resolveId(id)).filter(id => !!M.getEquipment(id));
    owned = owned.filter((id, i) => owned.indexOf(id) === i);
    if(equipped.mainhand) equipped.mainhand = M.resolveId(equipped.mainhand);
    if(equipped.body) equipped.body = M.resolveId(equipped.body);
    if(equipped.outfit) equipped.outfit = M.resolveId(equipped.outfit);
  }
  // TASK #7 — active pass holders get the exclusive skin for free. Inject it
  // into owned BEFORE the equipped-validation below so a holder who has it
  // equipped keeps it (owned from the server won't list a never-bought item).
  if(isPassHolder(addr) && M && M.getEquipment(PASS_EXCLUSIVE_SKIN_ID) && !owned.includes(PASS_EXCLUSIVE_SKIN_ID)){
    owned.push(PASS_EXCLUSIVE_SKIN_ID);
  }
  // Never trust an equipped id that isn't actually in the owned list (e.g.
  // a stale equipped-cache left over from before a refund/removal).
  if(equipped.mainhand && !owned.includes(equipped.mainhand)) equipped.mainhand = null;
  if(equipped.body && !owned.includes(equipped.body)) equipped.body = null;
  if(equipped.outfit && !owned.includes(equipped.outfit)) equipped.outfit = null;
  // TASK B — inject the free default weapon into owned + default an empty
  // mainhand to it, so the player is never weaponless (real wallets AND guests).
  return withDefaultGear({ owned, equipped });
}

function newGame(charKey, restoreSnapshot){
  // Kick off (non-blocking) — refreshes GOLDKEY_WEEK/PAPER_WEEK before the
  // player has realistically reached the first container. See
  // refreshGoldenKeyWeeklyStatus() above for why this is optimistic rather
  // than awaited.
  refreshGoldenKeyWeeklyStatus();
  refreshPaperWeeklyStatus();
  refreshVaultFragments();
  // The run's dungeon identity (GAME-DESIGN.md §8). Restored with the save so
  // Continue returns to the same floors; fresh otherwise, so a new run — and a
  // raid, which always starts one — gets a map it has not seen.
  // enterSavedSession() sets act/cycle/abyss/raid BEFORE calling us, so the key
  // compared here is the run we are actually about to play.
  const _sameRun = !!(restoreSnapshot && restoreSnapshot.runSeed && restoreSnapshot.floorsKey === _runKey());
  RUN_SEED = _sameRun ? (restoreSnapshot.runSeed >>> 0) : ((Math.random() * 4294967296) >>> 0);
  PENDING_FLOORS = (_sameRun && restoreSnapshot.floors) ? Object.assign({}, restoreSnapshot.floors) : null;
  RESUME_AT = (_sameRun && restoreSnapshot.at && typeof restoreSnapshot.at.x === 'number')
    ? { depth: restoreSnapshot.depth || 1, x: restoreSnapshot.at.x, y: restoreSnapshot.at.y } : null;
  const cfg = HERO[charKey];
  const p = new Player(charKey, cfg);
  G = { player:p, dun:null, enemies:[], decor:[], particles:[], dmgNums:[], projectiles:[], rings:[],
        depth:0, shake:0, time:0, paused:false, bgIndex:0, bossAlive:false, over:false,
        // Unified non-blocking action button state (replaces the old ULTI
        // popup). mode: null | 'ulti' | 'open'. target: the boss Enemy (ulti)
        // or the Decor container (open) currently in range. cd: short
        // cooldown after a NULL_STRIKE so the button can't be double-tapped
        // while the same boss stays in range.
        action:{ mode:null, target:null, cd:0 },
        // Per-floor cache: floors[depth] = {dun, enemies, decor, cleared, bossAlive}
        // so revisiting a floor via the lift shows it exactly as it was left
        // (dead enemies stay dead, unbroken decor stays lootable).
        floors:{}, maxDepthReached:0,
        // Per-run state: Golden Keys are no longer a standalone floor
        // pickup (that system used to crash the renderer — see the removed
        // drawGoldenKey()/placeKeyRandomly() history below). Instead up to
        // this many can be found as loot INSIDE the rarer interactive
        // containers (Rotten Armoire / Lost Cache), same as any other item.
        // Capped at 1 (not 2) since Golden Key is now 1-per-wallet-per-week,
        // server-enforced — see GOLDKEY_WEEK / refreshGoldenKeyWeeklyStatus()
        // above (Phase 5.5 #9A).
        goldenKeysRemaining: 1,
        // Paper run-cap (Phase 5.5 #9B) — same 1-per-run local cap as
        // Golden Key, on top of the real server-side weekly gate (see
        // PAPER_WEEK / window.NS_PAPER above).
        paperRemaining: 1,
        // keys/relics/shards/paper: legacy-style simple counters (still used
        // for lift-key and the relic-power mutation system, plus the new
        // Paper item). items: the new NS_ITEMS-backed stash, keyed by item
        // id -> {item, qty}. burnQueue: Set of item ids the player has
        // marked to send to the weekly burn pool.
        inventory:{ keys:0, relics:0, shards:0, paper:0, items:{},
          // Phase 2 (blueprint §2.2): Glitch Shard crafting materials, keyed
          // by weapon fxTier. Run-scoped here; BANKED to the wallet's server
          // balance (with the RunSession death multiplier applied) only when
          // the act's bunker is cleared — see onActBunkerCleared().
          gshards:{ t1:0, t2:0, t3:0 } },
        burnQueue:new Set(),
        eatQueue:new Set(), // #5 (v41) — Food tab's multi-select queue, separate from burnQueue
        // Marketplace equipment (offchain). owned: list of equipment ids the
        // player has purchased. equipped: currently worn item id per slot.
        // PERMANENT — never consumed. Populated a few lines below from
        // localStorage (see loadPersistedEquipment()) rather than left
        // empty here — see that function for why.
        equipment:{ owned:[], equipped:{ mainhand:null, body:null, outfit:null } }, // outfit = Phase 9 cosmetic slot
        discoveredRooms:new Set(), lastRoomId:null, floorClearShown:{}, combo:{count:0,t:0},
        respawnDepth:1 };

  // BUGFIX: purchases made in the Marketplace used to never show up in the
  // dungeon's Inventory/Gear tab (and so could never be equipped), even
  // though the purchase itself succeeded and was recorded. Root cause: the
  // React Marketplace screen pushed owned items into a LIVE G via
  // window.NS_EQUIP.setOwned(), but the Marketplace and the dungeon are
  // different screens in GameFlowManager — the Marketplace unmounts before
  // the dungeon (re)mounts, and newGame() always builds a brand-new G with
  // equipment.owned starting empty (see literal above), which silently
  // wiped out that earlier push every single time. Reading straight from
  // the same localStorage cache the Marketplace already writes to
  // (`nullstate-owned-<wallet>`) at the exact moment G is built removes
  // that race entirely — whatever's actually owned is applied the instant
  // the run starts, regardless of which screens were visited in between.
  // Equipped-slot choices (which owned item is actually worn) are
  // persisted the same way, in `nullstate-equipped-<wallet>` — see
  // window.NS_saveEquipment below, which used to be referenced by
  // equipItem()/unequipSlot() but was never actually defined anywhere, so
  // equip choices silently failed to survive a session change too.
  const persistedEquip = loadPersistedEquipment();
  G.equipment.owned = persistedEquip.owned;
  // #3 fix: when resuming a saved run, the gear the player had ON at Save &
  // Exit (captured in restoreSnapshot.equipped) wins over the persisted/server
  // copy — so the last-equipped weapon/armor/skin is always re-equipped on
  // Continue, even if marketplaceEquipped or the localStorage cache is stale.
  // Any saved id must still actually be owned (guards a refund/removal); it
  // falls back to the persisted slot otherwise, and a fresh run (no snapshot)
  // keeps using the persisted copy exactly as before.
  {
    const savedEq = restoreSnapshot && restoreSnapshot.equipped;
    if(savedEq){
      const M = window.NS_MARKET;
      const owned = persistedEquip.owned || [];
      const validOwned = (id) => {
        const r = (id && M) ? M.resolveId(id) : id;
        return (r && owned.includes(r)) ? r : null;
      };
      G.equipment.equipped = {
        mainhand: validOwned(savedEq.mainhand) || persistedEquip.equipped.mainhand,
        body:     validOwned(savedEq.body)     || persistedEquip.equipped.body,
        outfit:   validOwned(savedEq.outfit)   || persistedEquip.equipped.outfit,
      };
      // Write the restored loadout back to localStorage + the server so the
      // (possibly stale) marketplaceEquipped copy is corrected for next time.
      if(typeof window.NS_saveEquipment === 'function') window.NS_saveEquipment(G.equipment);
    } else {
      G.equipment.equipped = persistedEquip.equipped;
    }
  }

  // A save (exact bunker resume) takes priority; otherwise fall back to the
  // on-chain career baseline (level/xp carried over, but a fresh floor 1
  // run) so "Continue" never silently starts a level-1 nobody again.
  const snap = restoreSnapshot || (INITIAL_STATS ? {
    xp: INITIAL_STATS.xp, level: INITIAL_STATS.level, kills: 0,
    depth: 1, maxDepthReached: 1,
  } : null);

  let startDepth = 1;
  if (snap) {
    applyRestoredState(G, p, snap);
    startDepth = snap.depth || 1;
  }
  // Reconcile any burns the player made from the OUT-OF-GAME Rewards screen
  // while the engine wasn't running — must run after the stash is restored.
  // Then refresh the mirror so it reflects the reconciled inventory right away
  // (persistStashSnapshot re-runs the reconcile harmlessly — queue is cleared).
  applyExternalBurns();
  persistStashSnapshot();
  applyEquipment(p);   // normalize atk/HP from any equipped gear (safe if none)
  descend(startDepth);
}

// ---- seeded floors: a saved run comes back to the SAME dungeon ------------
//
// GAME-DESIGN.md §8. Save & Exit persisted 14 fields but never `G.floors`, and
// `dungeon.js` generates from bare `Math.random()` — so Continue rebuilt every
// floor from scratch. The player returned to a different map with resurrected
// monsters, refilled containers and whole props they had already smashed. It
// reads as a broken game, and it quietly refunds XP, items and Glitch Shards.
//
// Two halves, and BOTH are needed — either alone fixes nothing:
//
//   1. THE LAYOUT IS A FUNCTION OF A SEED. One run seed, chosen at newGame()
//      and saved with the run, plus the coordinates that identify a floor
//      (cycle, act, abyss, depth). Same seed, same floor, forever — so the map
//      itself costs zero bytes to persist.
//
//   2. WHAT THE PLAYER DID TO IT is a delta against that layout: which enemies
//      died, which props broke, which containers were opened and what is still
//      inside them, which rooms have been lit. Indices into the generated
//      arrays, which is only sound BECAUSE of (1).
//
// WHY Math.random IS SWAPPED RATHER THAN THREADED. Randomness for one floor is
// spread across four files — dungeon.js lays out rooms, game.js picks
// archetypes and elites, props.js places and rolls decor, entities.js jitters
// each enemy. The engine is loaded as plain <script> tags with no module
// system (GAME-DESIGN.md rule 1), so there is no shared rng to import and
// threading one through would mean touching every constructor. Generation is
// synchronous and finishes inside one call, so swapping the global for exactly
// that window is contained and reversible — the `finally` puts it back even if
// generation throws.
let RUN_SEED = 0;
// Floor deltas from a restored save, consumed per depth as each floor is first
// built. Null when this is a fresh run.
let PENDING_FLOORS = null;
// Where the player stood when they saved. Single-use, consumed by descend().
let RESUME_AT = null;
function _hash32(str){
  let h = 2166136261;
  for(let i = 0; i < str.length; i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function _mulberry32(a){
  return function(){
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function _withSeed(seed, fn){
  const real = Math.random;
  Math.random = _mulberry32(seed >>> 0);
  try { return fn(); } finally { Math.random = real; }
}
// WHICH RUN a set of floors belongs to. Saved with them and checked on
// restore, because a snapshot does not always keep describing the run it was
// taken from: the shell rewrites campaignActIndex/depth on it when a bunker is
// cleared (so ENTER points at the NEXT bunker) and again when a raid finishes
// (so the campaign resumes where the raid found it). Without this check, the
// floor-1 delta from the bunker you just beat would replay into the bunker you
// are about to start — monsters already dead, containers already emptied. The
// array-length guard would catch most of those by luck; this catches them by
// construction, for every caller, including ones written later.
function _runKey(){
  return campaignCycle + ':' + campaignActIndex + ':' + (abyssMode ? 'a' : 'c') + ':' + (RAID_MODE ? 'r' : '-');
}
function _floorSeed(depth){
  return _hash32(RUN_SEED + ':' + _runKey() + ':' + depth);
}

// One loot slot, small enough to save. The item's name/rarity/icon/burn value
// are all derivable from its id via NS_ITEMS.getItem(), exactly as the stash
// already does — so only the id travels.
function _serializeSlots(slots){
  return (slots || []).map(s => ({
    s: s.slotId, k: s.kind,
    i: (s.item && s.item.id) || 0,
    q: s.qty || 0, a: s.amt || 0,
    t: !!s.taken,
  }));
}
function _restoreSlots(raw){
  const out = [];
  for(const s of (raw || [])){
    if(s.k === 'item'){
      const it = window.NS_ITEMS && window.NS_ITEMS.getItem(Number(s.i));
      if(!it) continue;                       // item table changed under us
      out.push({ slotId: s.s, kind: 'item', item: it, qty: s.q || 1, taken: !!s.t });
    } else {
      out.push({ slotId: s.s, kind: s.k, amt: s.a || 0, taken: !!s.t });
    }
  }
  return out;
}

// Everything the player changed about the floors they have seen. Called by
// getSaveSnapshot, so the CURRENT floor reads from the live arrays (G.enemies /
// G.decor) rather than the cache, which is only refreshed on descend().
function serializeFloors(){
  if(!G || !G.floors) return null;
  const out = {};
  // A campaign bunker is five floors, so this cap never bites there. The Null
  // Abyss has no bottom, and a deep dive would otherwise grow this payload
  // without limit — the floors furthest from the player are the ones least
  // likely to be revisited, and they simply regenerate if they ever are.
  const keys = Object.keys(G.floors)
    .sort((a, b) => Math.abs(Number(a) - G.depth) - Math.abs(Number(b) - G.depth))
    .slice(0, 12);
  for(const key of keys){
    const f = G.floors[key];
    if(!f) continue;
    const live = Number(key) === G.depth;
    const enemies = (live ? G.enemies : f.enemies) || [];
    const decor = (live ? G.decor : f.decor) || [];
    const dead = [], broken = [], opened = {};
    enemies.forEach((e, i) => { if(e && e.dead) dead.push(i); });
    decor.forEach((o, i) => {
      if(!o) return;
      if(o.broken) broken.push(i);
      if(o.opened) opened[i] = _serializeSlots(o.lootSlots);
    });
    const rooms = [];
    const dr = (f.dun && f.dun.rooms) || [];
    dr.forEach((r, i) => { if(r && r.visited) rooms.push(i); });
    out[key] = {
      // Lengths are the trust check. A delta is a list of INDICES, so it is
      // only meaningful against the array it was taken from. Regeneration can
      // legitimately differ — a Premium Sector cache appears only while that
      // act's blueprint is owned, and ownership lives outside this save — so
      // if the counts do not match on restore the delta is dropped rather than
      // applied to the wrong props.
      el: enemies.length, dl: decor.length,
      c: !!f.cleared, v: !!f.visited, b: !!f.bossAlive,
      dead, broken, opened, rooms,
    };
  }
  return out;
}

// Applied to a freshly generated floor, once, the first time it is built.
function _applyFloorDelta(depth, floor){
  if(!PENDING_FLOORS) return;
  const s = PENDING_FLOORS[depth] || PENDING_FLOORS[String(depth)];
  if(!s) return;
  delete PENDING_FLOORS[depth]; delete PENDING_FLOORS[String(depth)];

  if(s.el !== floor.enemies.length || s.dl !== floor.decor.length){
    // The layout no longer matches what was saved. Regenerating fresh is the
    // old behaviour and is merely disappointing; applying the delta anyway
    // would kill the wrong monsters and empty the wrong crates.
    console.warn('[nullstate] floor ' + depth + ' changed shape since the save ('
      + s.el + '/' + s.dl + ' -> ' + floor.enemies.length + '/' + floor.decor.length + ') — generated fresh');
    return;
  }

  for(const i of (s.dead || [])){ const e = floor.enemies[i]; if(e){ e.dead = true; e.hp = 0; } }
  for(const i of (s.broken || [])){ const o = floor.decor[i]; if(o){ o.broken = true; o.hp = 0; o.brokenT = 0; } }
  for(const k of Object.keys(s.opened || {})){
    const o = floor.decor[k];
    if(!o) continue;
    o.opened = true; o.openT = 0;
    // Restored BEFORE anything can call rollLootSlots(), which memoises on
    // this field — so a reopened container hands back exactly what was left in
    // it and cannot be re-rolled for a second helping.
    o.lootSlots = _restoreSlots(s.opened[k]);
  }
  for(const i of (s.rooms || [])){ const r = floor.dun.rooms[i]; if(r) r.visited = true; }
  floor.cleared = !!s.c;
  floor.visited = !!s.v;
  floor.bossAlive = s.b !== undefined ? !!s.b : floor.bossAlive;
  // A boss floor whose boss is already down must not re-arm the boss gate.
  if(floor.bossAlive && floor.enemies.some(e => e.isBoss && e.dead)) floor.bossAlive = false;
}

function ensureFloor(depth){
  if(G.floors[depth]){
    return G.floors[depth];
  }
  return _withSeed(_floorSeed(depth), () => _buildFloor(depth));
}

function _buildFloor(depth){
  // The act is passed explicitly rather than read off window inside dungeon.js:
  // floor generation runs under a seeded Math.random (see _withSeed) and the
  // seed already includes the act, so the two must agree on which act this is.
  // The Null Abyss has no act — it scales on depth alone — so it generates at
  // act 0 and gets its difficulty from its own depth curve.
  const d = makeDungeon(depth, abyssMode ? 0 : campaignActIndex);
  // v65 T5: build an enemy's `home` (room-guard bounds, px) from whatever
  // room its spawn point sits in. entities.js has always had the full
  // playerInHome()/clampHome() guard mechanism, but NOTHING in game.js ever
  // assigned `.home` — so it was dead code and every monster chased the
  // player across the whole floor. Corridor spawns (roomAt → null) return
  // null and keep free-roam behavior, matching the mechanism's design.
  const homeFor = (wx, wy) => {
    const room = d.roomAt((wx/TILE)|0, (wy/TILE)|0);
    if(!room) return null;
    const pad = 6; // keep the clamp a hair off the wall tiles
    const x0 = room.x*TILE + pad,        y0 = room.y*TILE + pad;
    const x1 = (room.x+room.w)*TILE - pad, y1 = (room.y+room.h)*TILE - pad;
    return { x0, y0, x1, y1, cx:(x0+x1)/2, cy:(y0+y1)/2 };
  };
  const floor = { dun:d, enemies:[], decor:[], cleared:false, bossAlive:false, visited:false };
  const isBoss = depth%5===0;
  if(isBoss){
    // v80: one distinct boss look per act (ACT_BOSSES in assets.js — minotaur
    // warlord, vampire monarch, sutured hulk, horned tyrant, pumpkin king),
    // all with real 4-direction attack anims. Stats are identical across the
    // list, so act difficulty tuning is unchanged.
    const A2 = window.NS_ASSETS;
    const bossArch = (A2.ACT_BOSSES && A2.ACT_BOSSES.length)
      ? A2.ACT_BOSSES[((campaignActIndex%A2.ACT_BOSSES.length)+A2.ACT_BOSSES.length)%A2.ACT_BOSSES.length]
      : BOSS_ARCH;
    const e=new Enemy(bossArch, d.stairsPx.x, d.stairsPx.y-60, depth, true);
    e.home = homeFor(e.x, e.y); // v65 T5: boss is bound to the stairs/boss room too
    floor.enemies.push(e); floor.bossAlive=true;
    // v65 T6: Bunker 5 "THE LAST LIGHT" (campaignActIndex===4) vault door —
    // spawn it NOW, when the floor is built, instead of waiting for the
    // boss to die. It still can't be OPENED until the boss's room is clear
    // (isRoomClear() gate in updateActionButton(), untouched) — only WHEN
    // it becomes visible and WHERE it sits are changing here.
    if(campaignActIndex===4 && !abyssMode){
      const bossRoom = d.roomAt((d.stairsPx.x/TILE)|0, (d.stairsPx.y/TILE)|0);
      const spot = placeVaultDoorSpot(d, bossRoom);
      floor.decor.push(new Decor('vault_door', spot.x, spot.y, spot.facing));
    }
  } else {
    const ELITE_ARCHS = [ORC_SHAMAN_ARCH, SKEL_MAGE_ARCH, SKEL_WARRIOR_ARCH];
    const eliteChance=Math.min(0.30, 0.12 + depth*0.015);
    let eliteCount=0;
    for(const s of d.spawns){
      const elite = (eliteCount<2) && Math.random()<eliteChance;
      let e;
      if(elite){
        eliteCount++;
        const arch = ELITE_ARCHS[(Math.random()*ELITE_ARCHS.length)|0];
        e = new Enemy(arch, s.x, s.y, depth, false, true);
      } else {
        // v80: the roll window scales with BOTH floor depth and campaign act
        // (each bunker opens 4 more roster slots), so every act meets new
        // monster crews from the 24-entry LPC roster instead of the same
        // first six forever. Early floors of act 1 keep the classic mix.
        const _lim = Math.min(ARCHETYPES.length, 1 + depth + campaignActIndex*4);
        const arch=ARCHETYPES[(Math.random()*_lim)|0]||ARCHETYPES[0];
        e = new Enemy(arch, s.x, s.y, depth, false, false);
      }
      e.home = homeFor(s.x, s.y); // v65 T5
      floor.enemies.push(e);
    }
  }
  spawnDecorInto(floor, d);
  _spawnPhase8Caches(floor, d, depth);
  // Last thing before the floor is handed out: guarantee the player can
  // actually walk from the entrance to the lift. See _ensureFloorTraversable —
  // this is the fix for the owner's "stuck at the entrance" report.
  _ensureFloorTraversable(floor, d);
  // Last: replay what the player already did to this floor, if they have been
  // here before. Must run AFTER the traversability pass, which can delete
  // props — the delta's indices are into the array as it is finally handed out.
  _applyFloorDelta(depth, floor);
  G.floors[depth] = floor;
  return floor;
}

// Owner bug: props (cabinets, barrels, crates…) could be walked THROUGH.
// Decor now blocks the PLAYER with a footprint box derived from its art size
// (def.w/h; (x,y) is the base/feet). Flat ground/wall clutter you'd naturally
// step over or that sits inside the wall stays passable so nothing narrows a
// corridor. Enemies are intentionally NOT blocked (keeps their pathing simple;
// decor just becomes cover for the player). Exposed on window for entities.js.
const NS_FLAT_DECOR = new Set(['bones', 'rubble', 'skull_heap', 'plaque_sword', 'plaque_coin']);
// One definition of "this prop is in the way", used by the live collision
// check below AND by the traversability pass that runs at floor generation, so
// the two can never disagree about what blocks a player.
function decorBlocksPoint(o, px, py){
  if(!o || o.broken) return false;
  if(NS_FLAT_DECOR.has(o.type)) return false;
  const def = o.def; if(!def) return false;
  const hw = (def.w || 24) * 0.40;            // horizontal half-footprint
  const top = o.y - (def.h || 24) * 0.28;     // a little up from the base
  const bot = o.y + 5;                         // just past the feet line
  return px >= o.x - hw && px <= o.x + hw && py >= top && py <= bot;
}
function decorSolidAt(px, py){
  if(!G || !G.decor) return false;
  for(const o of G.decor){ if(decorBlocksPoint(o, px, py)) return true; }
  return false;
}

// ---- a floor must always be walkable end to end -----------------------------
//
// OWNER BUG, reported from MiniPay: entered Bunker 1 floor 1 and could not move
// out of the spawn area at all. Reproduced by flood-filling from the start
// point across 60 generated floors — the stairs were unreachable on 5 of them.
//
// The cause is geometric, not a placement mistake. A corridor is one tile
// (TILE=40) and the player's radius is 14, so anything with a solid footprint
// wider than 12px seals it — which is every prop in the game. spawnDecorInto
// keeps props off doorways (TILE*2.2) and hugging room walls, but a room whose
// only exit is narrow, or two props landing either side of a gap, can still
// close the last opening.
//
// It PRE-DATED the crate resize: the same measurement puts the old 34x34 crate
// at 2 in 60. Widening it to 44x44 for the art took that to 5 in 60. So the
// resize made a latent bug common enough to hit on the first real play, and
// shrinking the crate again would only hide it — any prop can do this.
//
// Hence a guarantee rather than a tuning: after decor is placed, walk the floor
// from the spawn. If the stairs cannot be reached, delete whichever props are
// sitting on the frontier of the reachable region and walk it again. That is
// the minimal set that can be responsible, so it converges in a pass or two and
// almost never removes more than one prop.
function _floorReachable(decorList, d, fromX, fromY){
  const R = 14;                 // Player.r — see entities.js
  const S = TILE / 2;           // half-tile lattice: fine enough for a 14px body
  const W = Math.ceil(d.pxW / S), H = Math.ceil(d.pxH / S);
  const blocked = (x, y) => {
    if(d.isWall(x, y) || d.isWall(x+R, y) || d.isWall(x-R, y) || d.isWall(x, y+R) || d.isWall(x, y-R)) return true;
    for(const o of decorList){ if(decorBlocksPoint(o, x, y) || decorBlocksPoint(o, x+R, y) || decorBlocksPoint(o, x-R, y)) return true; }
    return false;
  };
  const seen = new Set(), stack = [[Math.round(fromX/S), Math.round(fromY/S)]];
  seen.add(stack[0][0] + ',' + stack[0][1]);
  const frontier = [];
  while(stack.length){
    const [a, c] = stack.pop();
    for(const [da, dc] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const na = a+da, nc = c+dc;
      if(na < 0 || nc < 0 || na > W || nc > H) continue;
      const k = na + ',' + nc;
      if(seen.has(k)) continue;
      if(blocked(na*S, nc*S)){ frontier.push([na*S, nc*S]); continue; }
      seen.add(k); stack.push([na, nc]);
    }
  }
  return { seen, frontier, S };
}
// Everything in `decorList` that is standing on this region's frontier — the
// candidate set for "what is holding this wall shut".
function _propsOnFrontier(decorList, frontier, only){
  const out = new Set();
  for(const [fx, fy] of frontier){
    for(let i = 0; i < decorList.length; i++){
      const o = decorList[i];
      if(_decorProtected(o)) continue;
      if(only && !only(o)) continue;
      // The SAME three probes _floorReachable used to decide the cell was
      // blocked. Testing only the centre missed props blocking the player's
      // left or right edge.
      if(decorBlocksPoint(o, fx, fy) || decorBlocksPoint(o, fx+14, fy) || decorBlocksPoint(o, fx-14, fy)) out.add(i);
    }
  }
  return out;
}
// "Reached" means standing NEXT to the lift, not on its exact pixel. The stairs
// usually sit against a wall, so the target cell itself reads as blocked for a
// 14px body — demanding it exactly reported walkable floors as sealed.
function _reachesTarget(res, toX, toY){
  const ta = Math.round(toX/res.S), tc = Math.round(toY/res.S);
  for(let da = -2; da <= 2; da++){
    for(let dc = -2; dc <= 2; dc++){ if(res.seen.has((ta+da) + ',' + (tc+dc))) return true; }
  }
  return false;
}
// Props the player can never remove. Owner, after playing: "jangan dekat lorong
// untuk barang yang tidak bisa di pecahkan" — and that is exactly the
// distinction that matters. A barrel in a doorway costs a moment because you
// smash it. A cabinet or a scenery crate in the same doorway is a wall, because
// hit() refuses damage for anything ambient or interactive (props.js).
function _decorUnbreakable(o){ return !!(o && o.def && (o.def.ambient || o.def.interactive)); }
function _decorProtected(o){ return !!(o && o.def && (o.def.isVaultDoor || o.def.isSealedCache || o.def.isPremiumCache)); }
// Which props are SEALING `target` away from the region `r`?
//
// Flood a second region outward from the target, then intersect the two
// regions' frontier props. A prop standing in the doorway between them is on
// both frontiers; a prop minding its own business inside either region is on
// one at most. Intersecting at the PROP level rather than the cell level
// matters: a wide cabinet blocks three lattice cells in a row, and the start
// side may touch only the first while the target side touches only the third.
function _sealingProps(decorList, d, blockers, r, tx, ty, only){
  const rt = _floorReachable(blockers, d, tx, ty);
  const near = _propsOnFrontier(decorList, r.frontier, only);
  const far = _propsOnFrontier(decorList, rt.frontier, only);
  const both = new Set();
  for(const i of near) if(far.has(i)) both.add(i);
  return both;
}

// Two guarantees, in the order that matters.
//
// A. AN UNBREAKABLE PROP MUST NOT CUT ANYTHING OFF. The owner's report: props
//    standing in doorways, and since a cabinet or a scenery crate cannot be
//    destroyed (props.js hit() refuses damage for ambient and interactive)
//    there is nothing to do but walk away — and what is behind them is often
//    the lockable containers the weekly reward is made of. So every room, the
//    lift, and every container the WALLS allow the player to reach must still
//    be reachable once the unbreakables are placed.
//
//    "Cut off", not "cost area". The first version of this check compared the
//    reachable cell COUNT against the walls-only count and deleted whatever sat
//    on the frontier — but a prop standing in an open room always costs a few
//    cells simply by occupying them, so that rule condemned every prop on the
//    floor. Measured: interactive containers per bunker fell from 7.5 to 1.4,
//    which would have quietly emptied the Vault Fragment economy. The test that
//    caught it is scripts/test-floor-traversable.js; the count is from
//    `npm run measure:bunker`.
//
// B. THE LIFT MUST BE REACHABLE with everything in place. Breakables are
//    allowed to narrow a path — you can smash them — but not to seal the run.
function _ensureFloorTraversable(floor, d){
  if(!d || !d.startPx || !d.stairsPx) return;

  // What the walls THEMSELVES allow. Anything the bare floor plan cannot reach
  // is a generator quirk, not a prop's fault, and chasing it would delete props
  // forever without ever satisfying the check.
  const base = _floorReachable([], d, d.startPx.x, d.startPx.y);
  const fixed = [[d.stairsPx.x, d.stairsPx.y]];
  for(const rm of (d.rooms || [])) fixed.push([(rm.cx + 0.5) * TILE, (rm.cy + 0.5) * TILE]);
  const wanted = fixed.filter(([x, y]) => _reachesTarget(base, x, y));

  // A — every room, the lift, and every container must survive the scenery.
  for(let pass = 0; pass < 6; pass++){
    const hard = floor.decor.filter(_decorUnbreakable);
    const r = _floorReachable(hard, d, d.startPx.x, d.startPx.y);
    const targets = wanted.concat(
      floor.decor.filter(o => o.def && o.def.interactive)
        .map(o => [o.x, o.y])
        .filter(([x, y]) => _reachesTarget(base, x, y)));
    const missed = targets.filter(([x, y]) => !_reachesTarget(r, x, y));
    if(!missed.length) break;
    let cut = false;
    for(const [tx, ty] of missed){
      const guilty = _sealingProps(floor.decor, d, hard, r, tx, ty, _decorUnbreakable);
      if(!guilty.size) continue;              // sealed by a protected cache, or by the walls
      floor.decor = floor.decor.filter((_, i) => !guilty.has(i));
      cut = true;
      break;                                   // re-measure; one door may open several
    }
    if(!cut) break;
  }

  // B — and the run must still be completable with the breakables in place.
  for(let pass = 0; pass < 8; pass++){
    const r = _floorReachable(floor.decor, d, d.startPx.x, d.startPx.y);
    if(_reachesTarget(r, d.stairsPx.x, d.stairsPx.y)) return;
    const guilty = _sealingProps(floor.decor, d, floor.decor, r, d.stairsPx.x, d.stairsPx.y, null);
    if(!guilty.size) return;   // the walls themselves are the problem
    floor.decor = floor.decor.filter((_, i) => !guilty.has(i));
  }
}
if(typeof window !== 'undefined'){ window.NS_solidDecorAt = decorSolidAt;
  // Exposed for scripts/test-floor-traversable.js so the test measures with the
  // engine's own footprint rather than a copy that can drift from it.
  window.NS_decorBlocksPoint = decorBlocksPoint; }

// Phase 8 — sealed/premium caches. Placement stays tile-grid safe (never in a
// corridor/doorway), so the player-only footprint block above turns a cache
// into cover, never a trap. Part A: ~30% chance of one utility-gated cache per
// floor. Part B: a guaranteed Premium Sector cache on the act's FIRST floor
// when that act's blueprint is owned — bonus loot, never on the core-act path.
function _spawnPhase8Caches(floor, d, depth){
  const rooms = d.rooms.filter((r,i)=> i>0 && i<d.rooms.length-1);
  const place = (type)=>{
    const room = rooms.length ? rooms[(Math.random()*rooms.length)|0] : d.rooms[0];
    // These caches use cabinet/safe art, so keep them ON THE NORTH WALL facing
    // south like every other cabinet (owner: no "lemari di tengah"). If the
    // room has no usable north-wall spot, SKIP it entirely — the old mid-room
    // fallback could land on a bottom-row/edge cell and float over the wall.
    const pt = northWallSpotInRoom(d, room, d.stairsPx);
    if(!pt) return;
    floor.decor.push(new Decor(type, pt.x, pt.y, 'down'));
  };
  if(Math.random() < 0.30) place(Math.random()<0.5 ? 'cache_grapple' : 'cache_melt');
  if(depth === 1 && OWNED_SECTORS['sector_'+(campaignActIndex+1)]) place('premium_cache');
}

// A floor cell hugging the room's NORTH wall (wall directly above, open below),
// facing 'down' into the room. Used for cabinet-art caches so they read as
// wall furniture, never free-standing mid-room. Keeps clear of the stairs,
// start and doorways. Returns {x,y} or null if the room has no such spot.
function northWallSpotInRoom(d, room, avoid){
  if(!d || !room) return null;
  const isWall=(x,y)=> !(x>=0&&y>=0&&x<d.W&&y<d.H) || d.grid[y][x]===0;
  const nearDoor=(px,py)=>{
    if(!room.doors) return false;
    for(const dr of room.doors){ if(Math.hypot(px-(dr.x+0.5)*TILE, py-(dr.y+0.5)*TILE) < TILE*1.8) return true; }
    return false;
  };
  const cand=[];
  for(let ty=room.y; ty<room.y+room.h; ty++) for(let tx=room.x; tx<room.x+room.w; tx++){
    if(d.grid[ty][tx]===0) continue;
    if(!(isWall(tx,ty-1) && !isWall(tx,ty+1))) continue; // wall above, floor below
    const px=(tx+0.5)*TILE, py=(ty+0.66)*TILE;
    if(avoid && Math.hypot(px-avoid.x,py-avoid.y)<TILE*1.6) continue;
    if(d.startPx && Math.hypot(px-d.startPx.x,py-d.startPx.y)<TILE*2.0) continue;
    if(nearDoor(px,py)) continue;
    cand.push({x:px,y:py});
  }
  if(!cand.length) return null;
  return cand[(Math.random()*cand.length)|0];
}

function safePointInRoom(d, room, avoid){
  if(!d || !room) return null;
  const tiles=[];
  const yFrom = room.shape==='cells' ? room.y+3 : room.y;
  for(let ty=yFrom; ty<room.y+room.h; ty++) for(let tx=room.x; tx<room.x+room.w; tx++){
    if(tx<0||ty<0||tx>=d.W||ty>=d.H) continue;
    if(d.grid[ty][tx]===0) continue;
    const px=(tx+0.5)*TILE, py=(ty+0.5)*TILE;
    if(avoid && Math.hypot(px-avoid.x,py-avoid.y)<TILE*1.2) continue;
    tiles.push({x:px,y:py});
  }
  if(!tiles.length) return null;
  return tiles[(Math.random()*tiles.length)|0];
}

function placePlayerOnFloor(floor, firstVisit){
  const d=floor.dun;
  let pt;
  if(firstVisit){
    pt = {x:d.startPx.x, y:d.startPx.y};
  } else {
    const liftRoom = d.roomAt((d.stairsPx.x/TILE)|0, (d.stairsPx.y/TILE)|0);
    pt = safePointInRoom(d, liftRoom, d.stairsPx) || {x:d.stairsPx.x, y:d.stairsPx.y-TILE*0.6};
  }
  if(d.isWall(pt.x, pt.y)){
    const r = d.rooms.find(room => room.visited) || d.rooms[0];
    pt = safePointInRoom(d, r) || d.startPx;
  }
  G.player.x=pt.x; G.player.y=pt.y;
}

function isFloorClearForAdvance(depth){
  const f = G.floors[depth];
  if(!f) return false;
  // "Clear" = every mummy (regular or elite) AND any boss on the floor is dead.
  return f.enemies.every(e => e.dead || !(e.arch.isUndead || e.isBoss));
}

function descend(toDepth){
  const target = toDepth!==undefined ? toDepth : G.depth+1;
  // snapshot current floor's live state back into the cache before leaving
  if(G.dun && G.floors[G.depth]){
    const cur = G.floors[G.depth];
    cur.enemies = G.enemies; cur.decor = G.decor; cur.bossAlive = G.bossAlive;
    cur.visited = true;
  }
  G.depth = target;
  G.maxDepthReached = Math.max(G.maxDepthReached, target);
  const floor = ensureFloor(target);
  G.dun = floor.dun; G.enemies = floor.enemies; G.decor = floor.decor;
  G.bossAlive = floor.bossAlive;
  G.particles=[]; G.dmgNums=[]; G.projectiles=[]; G.rings=[];
  // Pull the current act's color theme so drawTiles/drawWallFaces render
  // with the right palette for this leg of the campaign.
  const act = CAMPAIGN[campaignActIndex];
  // NULL ABYSS: always the voidstone palette, regardless of campaignActIndex
  // (which is 0 in the abyss to avoid act-4 hard-mode / vault logic).
  G.dungeonTheme = DUNGEON_THEMES[abyssMode ? 'voidstone' : ((act && act.dungeonTheme) || 'bluestone')];
  // Only drop the player at the entrance the FIRST time a floor is visited;
  // revisiting (lift travel) places them at the lift landing instead so
  // backtracking doesn't feel like restarting the floor from its far entrance.
  const firstVisit = !floor.visited;
  placePlayerOnFloor(floor, firstVisit);
  // A restored save resumes where the player actually stood, not at the lift.
  // Only for the depth that was saved, only once, and only if the spot is
  // still walkable — which it always is now that the floor regenerates
  // identically, but checking costs nothing and a stuck player costs the run.
  if(RESUME_AT && RESUME_AT.depth === G.depth){
    const at = RESUME_AT; RESUME_AT = null;
    if(!floor.dun.isWall(at.x, at.y) && !decorSolidAt(at.x, at.y)){ G.player.x = at.x; G.player.y = at.y; }
  }
  if(!firstVisit){
    // Landing spot is near the lift, so avoid reopening the menu immediately
    // after changing floors. Walking away and back will still trigger it.
    G._liftPrompted = true;
  }
  resetInput();
  floor.visited = true;
  G.player.depth=G.depth;
  G.bgIndex=(G.depth-1)%backgrounds.length;
  G.action.mode=null; G.action.target=null;
  setActionButton(null);
  const isBoss = G.depth%5===0;
  const _floorLabel = abyssMode ? `THE NULL ABYSS · DEPTH ${G.depth}`
    : campaignCycle>0 ? `FLOOR ${G.depth} · CYCLE ${toRoman(campaignCycle+1)}` : `FLOOR ${G.depth}`;
  const _floorSub = abyssMode ? (isBoss ? (nsIcon('guard','banner-ico')+' ABYSS GUARDIAN') : 'THE DARK BELOW')
    : isBoss ? (nsIcon('guard','banner-ico')+' GUARDED') : backgrounds[G.bgIndex].split('/').pop().replace(/\.[a-z0-9]+$/i,'').toUpperCase();
  showBanner(_floorLabel, _floorSub);
  if(isBoss && floor.bossAlive){
    cutscene(Story.bossIntro);
  } else {
    log(Story.floorLine(G.depth),'dm');
  }
  A.descend();
}

// v65 T6: find a wall-hugging spot for the Bunker 5 vault door inside the
// boss room, same candidate logic spawnDecorInto() already uses for regular
// decor (hug N/W/E wall only, never S — design rule) — avoids the stairs
// tile and any doorway, then picks the candidate closest to the stairs so
// the door still reads as "part of the boss/vault area." Falls back to the
// old stairs-relative offset only if the room has no valid wall tile at all
// (e.g. a degenerate 1-tile room), which should not happen in practice.
function placeVaultDoorSpot(d, room){
  const fallback = { x: d.stairsPx.x+70, y: d.stairsPx.y-10, facing:'down' };
  if(!room) return fallback;
  const g=d.grid, W=d.W, H=d.H;
  const isWall=(x,y)=> !(x>=0&&y>=0&&x<W&&y<H) || g[y][x]===0;
  const cand=[];
  for(let ty=room.y; ty<room.y+room.h; ty++){
    for(let tx=room.x; tx<room.x+room.w; tx++){
      if(g[ty][tx]===0) continue;
      const wU=isWall(tx,ty-1), wD=isWall(tx,ty+1), wL=isWall(tx-1,ty), wR=isWall(tx+1,ty);
      let facing=null, ox=0.5, oy=0.9;
      if(wU && !wD){ facing='down';  ox=0.5;  oy=0.66; }
      else if(wL && !wR){ facing='right'; ox=0.33; oy=0.92; }
      else if(wR && !wL){ facing='left';  ox=0.67; oy=0.92; }
      if(!facing) continue;
      const px=(tx+ox)*TILE, py=(ty+oy)*TILE;
      if(Math.hypot(px-d.stairsPx.x,py-d.stairsPx.y) < TILE*1.2) continue; // don't overlap the lift
      let nearDoor=false;
      for(const door of (room.doors||[])){
        if(Math.hypot(px-(door.x+0.5)*TILE, py-(door.y+0.5)*TILE) < TILE*1.4){ nearDoor=true; break; }
      }
      if(nearDoor) continue;
      cand.push({px,py,facing});
    }
  }
  if(!cand.length) return fallback;
  cand.sort((a,b)=> Math.hypot(a.px-d.stairsPx.x,a.py-d.stairsPx.y) - Math.hypot(b.px-d.stairsPx.x,b.py-d.stairsPx.y));
  return { x:cand[0].px, y:cand[0].py, facing:cand[0].facing };
}

function spawnDecorInto(floor, d){
  // NOTE: 'monitor' used to be listed here but was never defined in
  // DECOR_TYPES (props.js) — picking it threw "Cannot read properties of
  // undefined (reading 'hp')" inside `new Decor()`, which aborted
  // ensureFloor() -> descend() partway through, before G.dun was ever
  // assigned. That left G.dun permanently null and crashed every
  // subsequent frame in checkRoomDiscovery(), freezing the screen right
  // after the bunker-entry transition. Replaced with real DECOR_TYPES
  // entries ('urn'/'bones') that also fit the ancient-ruin theme better
  // than a sci-fi monitor ever did.
  // v75: table_w + bench join the commons (user sprite decor); safe joins
  // the rare interactive containers alongside wardrobe/chest.
  // v80 (owner: "maps cenderung kosong"): the LPC sprite props join the pool —
  // 12 new breakables + 4 new interactive containers (see props.js). Weights
  // stay flat; the list-length itself is the weighting.
  const common=['vase','pot','barrel','crate','cabinet_s','urn','bones','table_w','bench',
    'oak_barrel','barrel_stack','bucket','bucket_water','boulder','hay_pile','chalice',
    'basin','plaque_sword','plaque_coin','skull_heap','cot'];
  const rare=['wardrobe','chest','safe','footlocker','shelf_stocked','dresser','cabinet_ornate'];
  const g=d.grid, W=d.W, H=d.H;
  const isWall=(x,y)=> !(x>=0&&y>=0&&x<W&&y<H) || g[y][x]===0;
  for(const r of d.rooms){
    // Collect floor cells along the room edge that hug a wall, and the
    // direction the decoration should face (away from that wall, into the room):
    //   wall above  -> face DOWN  (6 o'clock)   wall below -> face UP   (12)
    //   wall left   -> face RIGHT (3 o'clock)   wall right -> face LEFT (9)
    const cand=[];
    for(let ty=r.y; ty<r.y+r.h; ty++){
      for(let tx=r.x; tx<r.x+r.w; tx++){
        if(g[ty][tx]===0) continue; // must stand on a floor tile
        const wU=isWall(tx,ty-1), wD=isWall(tx,ty+1), wL=isWall(tx-1,ty), wR=isWall(tx+1,ty);
        // Owner (recurring): props read as "floating" when the tile directly
        // BELOW their base isn't floor (a room's bottom row, a corner, or a
        // corridor edge — the sprite then hangs over the wall/void). So EVERY
        // placed prop must have floor below it (!wD). That also keeps the SOUTH
        // wall empty for free (a cell hugging the S wall has wall below).
        let facing=null, ox=0.5, oy=0.9;
        if(wD) { continue; } // no ground beneath the base → would float
        if(wU && !wD){ facing='down';  ox=0.5;  oy=0.66; }   // against top (N) wall
        else if(wL && !wR){ facing='right'; ox=0.33; oy=0.92; } // against left (W) wall
        else if(wR && !wL){ facing='left';  ox=0.67; oy=0.92; } // against right (E) wall
        if(!facing) continue;
        const px=(tx+ox)*TILE, py=(ty+oy)*TILE;
        // Wider keep-outs (owner report: props too close to the entrance and to
        // corridor doorways). Was 1.8 (start/stairs) / 1.4 (doors).
        if(Math.hypot(px-d.startPx.x,py-d.startPx.y)<TILE*2.4) continue;
        if(Math.hypot(px-d.stairsPx.x,py-d.stairsPx.y)<TILE*2.4) continue;
        let nearDoor=false;
        for(const door of r.doors){
          if(Math.hypot(px-(door.x+0.5)*TILE, py-(door.y+0.5)*TILE) < TILE*2.2){ nearDoor=true; break; }
        }
        if(nearDoor) continue;
        cand.push({px,py,facing});
      }
    }
    if(!cand.length) continue;
    // shuffle candidates
    for(let i=cand.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; const t=cand[i]; cand[i]=cand[j]; cand[j]=t; }
    const area=r.w*r.h;

    // ---- ambient CORNER dressing (owner) -------------------------------
    // "the stacked crates aren't cornered enough and aren't big enough —
    //  fix it on every map."
    //
    // This runs BEFORE the loot props, because it used to run after them and
    // lose. The wall-hug pass had already taken the corner cell, the
    // 1.15-tile spacing check then rejected the corner, and the crates ended
    // up a tile or two inside the room — which is the "not cornered enough"
    // in the report. Placing them first makes that same spacing check
    // protect the corner instead of stealing it.
    //
    // It also builds its own candidates from the room's north row rather
    // than reusing `cand`. `cand` drops every cell within 2.4 tiles of the
    // entrance and the stairs, so whenever either sat near a corner, the
    // "extreme end" it returned was already well into the room. Scenery in a
    // corner blocks nothing the player needs to reach, so only a doorway
    // keep-out survives here — and it steps inward one cell at a time until
    // it clears, instead of giving up on the corner entirely.
    //
    // Not in the prison block: its top strip is barred cells, and crates
    // stacked against bars read as a bug.
    if(r.shape !== 'cells'){
      const northRow=[];
      for(let tx=r.x; tx<r.x+r.w; tx++){
        let ty=r.y;
        while(ty<r.y+r.h && g[ty][tx]===0) ty++;   // first floor cell down this column
        if(ty>=r.y+r.h) continue;
        if(!isWall(tx,ty-1)) continue;             // must actually hug the north wall
        if(isWall(tx,ty+1)) continue;              // must have floor under its base
        northRow.push({ tx, px:(tx+0.5)*TILE, py:(ty+0.66)*TILE });
      }
      const clear = c => {
        for(const door of r.doors){
          if(Math.hypot(c.px-(door.x+0.5)*TILE, c.py-(door.y+0.5)*TILE) < TILE*2.0) return false;
        }
        return Math.hypot(c.px-d.startPx.x, c.py-d.startPx.y) >= TILE*1.6
            && Math.hypot(c.px-d.stairsPx.x, c.py-d.stairsPx.y) >= TILE*1.6;
      };
      const firstClear = list => { for(const c of list){ if(clear(c)) return c; } return null; };
      if(northRow.length){
        const AMB_CORNER=['amb_crate_stack_a','amb_crate_stack_b'];
        const left  = firstClear(northRow);
        const right = firstClear(northRow.slice().reverse());
        const ends=[];
        if(left) ends.push(left);
        if(right && (!left || right.tx!==left.tx)) ends.push(right);
        for(const e of ends){
          // Still not every corner of every room, or the bunkers start to
          // look stamped out — but far less often skipped than before (0.35),
          // because the report was that they are missing from the corners.
          if(Math.random()<0.18) continue;
          floor.decor.push(new Decor(AMB_CORNER[(Math.random()*AMB_CORNER.length)|0], e.px, e.py, 'down'));
        }
      }
    }

    // v80: denser dressing (owner: "maps cenderung kosong") — cap 3 -> 5 per
    // room, area divisor 20 -> 14, min spacing 1.3 -> 1.15 tiles.
    const n=Math.min(cand.length, Math.min(5, Math.max(1, Math.round(area/14))));
    let placed=0;
    for(const c of cand){
      if(placed>=n) break;
      if(floor.decor.some(o=>Math.hypot(o.x-c.px,o.y-c.py)<TILE*1.15)) continue;
      let t = Math.random()<0.12 ? rare[Math.floor(Math.random()*rare.length)]
                                 : common[Math.floor(Math.random()*common.length)];
      // v80: generalized from the old bench-only special case — any type
      // flagged northOnly in DECOR_TYPES ships front-view-only art, so
      // anywhere but the top wall it falls back to a table.
      // Owner rule: ALL cabinets/safes (lemari & berangkas) hug the NORTH wall
      // facing SOUTH only. `northOnly` types anywhere but the top wall fall
      // back to a low, side-safe table so no boxy furniture ends up on a side
      // wall facing the wrong way.
      if(DECOR_TYPES[t] && DECOR_TYPES[t].northOnly && c.facing!=='down') t='table_w';
      floor.decor.push(new Decor(t,c.px,c.py,c.facing));
      placed++;
    }
    // ---- v80: mid-room dressing pass ----------------------------------
    // The wall-hug pass alone left room interiors bare. Scatter a few
    // free-standing props (cylindrical/pile types that read correctly from
    // any side — no boxy front-view furniture) on interior floor tiles at
    // least one tile away from every wall, with the same keep-outs as the
    // wall pass (start, stairs, doors) plus wider prop spacing so they
    // never form an accidental fence across a room.
    const MID=['oak_barrel','barrel_stack','bucket','bucket_water','boulder',
               'hay_pile','skull_heap','vase','pot','urn','bones','crate','chalice'];
    const midCand=[];
    for(let ty=r.y+1; ty<r.y+r.h-1; ty++){
      for(let tx=r.x+1; tx<r.x+r.w-1; tx++){
        if(g[ty][tx]===0) continue;
        if(isWall(tx,ty-1)||isWall(tx,ty+1)||isWall(tx-1,ty)||isWall(tx+1,ty)) continue;
        const px=(tx+0.5)*TILE, py=(ty+0.7)*TILE;
        if(Math.hypot(px-d.startPx.x,py-d.startPx.y)<TILE*1.8) continue;
        if(Math.hypot(px-d.stairsPx.x,py-d.stairsPx.y)<TILE*1.8) continue;
        let nearDoor=false;
        for(const door of r.doors){
          if(Math.hypot(px-(door.x+0.5)*TILE, py-(door.y+0.5)*TILE) < TILE*1.6){ nearDoor=true; break; }
        }
        if(!nearDoor) midCand.push({px,py});
      }
    }
    for(let i=midCand.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; const t=midCand[i]; midCand[i]=midCand[j]; midCand[j]=t; }
    const nm=Math.min(midCand.length, Math.min(3, Math.round(area/24)));
    let midPlaced=0;
    for(const c of midCand){
      if(midPlaced>=nm) break;
      if(floor.decor.some(o=>Math.hypot(o.x-c.px,o.y-c.py)<TILE*1.6)) continue;
      const t=MID[Math.floor(Math.random()*MID.length)];
      floor.decor.push(new Decor(t,c.px,c.py,'down'));
      midPlaced++;
    }

    // ---- ambient WALL dressing pass (owner rules) ---------------------
    // Scenery that cannot be broken, opened or looted. Every rule below is
    // the owner's, and each one is a constraint on WHERE, because the art
    // itself only works in one place:
    //
    //   N wall only      — one front view per sprite, no S/E/W variant to
    //                      fall back to (unlike tables, which have four)
    //   never mid-floor  — so this pass reuses the wall-hug candidates and
    //                      skips the mid-room list entirely
    //   never at a door  — inherited free: `cand` already dropped anything
    //                      within 2.2 tiles of a doorway
    //   never in the cells — the prison block's top strip is barred cells,
    //                      and stacking crates against bars reads as a bug
    //
    // The stacked crates are NOT placed here — they are the corner pass at
    // the top of this loop, which runs before the loot props so the corner
    // is still free when it gets there.
    if(r.shape !== 'cells'){
      const north = cand.filter(c => c.facing === 'down');
      if(north.length){
        const AMB_WALL   = ['amb_barrel_a','amb_barrel_b','amb_barrel_c',
                            'amb_urn_a','amb_urn_b','amb_urn_c','amb_urn_d','amb_urn_e',
                            'amb_urn_f','amb_urn_g','amb_urn_h','amb_urn_i'];
        const free = (px,py,gap) => !floor.decor.some(o=>Math.hypot(o.x-px,o.y-py)<TILE*gap);
        const rest = north.slice();
        for(let i=rest.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; const t=rest[i]; rest[i]=rest[j]; rest[j]=t; }
        let amb=0;
        const nAmb = Math.min(rest.length, 1 + ((Math.random()*2)|0));
        for(const c of rest){
          if(amb>=nAmb) break;
          if(!free(c.px,c.py,1.15)) continue;
          floor.decor.push(new Decor(AMB_WALL[(Math.random()*AMB_WALL.length)|0], c.px, c.py, 'down'));
          amb++;
        }
      }
    }
  }
}

function applyLoot(kind,amt,x,y){
  const p=G.player;
  if(kind==='hp'){
    if(p.hp>=p.maxHp){
      // Full HP — don't waste the drop, convert it to XP instead.
      const ups=p.gainXp(amt); lootText(x,y,'+'+amt+' XP (HP full)','#4ad7ff');
      if(ups>0){ A.levelup(); log('◆ LEVEL UP → '+p.level,'reward'); spark(p.x,p.y-20,'#00ff88',24,200); }
    } else {
      p.hp=Math.min(p.maxHp,p.hp+amt); lootText(x,y,'+'+amt+' HP','#3dff88');
    }
  }
  else if(kind==='xp'){ const ups=p.gainXp(amt); lootText(x,y,'+'+amt+' XP','#4ad7ff');
    if(ups>0){ A.levelup(); log('◆ LEVEL UP → '+p.level,'reward'); spark(p.x,p.y-20,'#00ff88',24,200); } }
  else if(kind==='relic'){
    // Owner: Relic + Null Shard aren't useful as stashed loot. Auto-consume a
    // relic the moment it's picked up — apply its instant power buff and DON'T
    // store it in the inventory (no clutter, no manual burning).
    applyRelicPower(amt, x, y);
  }
  else if(kind==='goldkey'){
    G.inventory.keys = (G.inventory.keys||0) + amt;
    lootText(x,y,'+'+amt+' Golden Key','#ffd166');
    log('Golden Key found! Stored in your inventory.', 'reward', 'key');
    spark(x, y-10, '#ffd166', 26, 200);
  }
  else if(kind==='paper'){
    G.inventory.paper = (G.inventory.paper||0) + amt;
    lootText(x,y,'+'+amt+' Old Paper','#c9a86a');
    log('A weathered paper, folded shut. Tap it in your inventory to read the code.', 'reward', 'scroll');
    spark(x, y-10, '#c9a86a', 26, 200);
  }
  else if(kind==='item' || kind==='food'){
    // ── THE DROP THAT NEVER ARRIVED ────────────────────────────────────────
    //
    // OWNER: *"Lootingan food ko skrg kaya gaada ya?? ini serius perlu di bahas
    // kenapa di hilangkan."* Nothing was removed. This branch never existed.
    //
    // Nine breakable props roll an `item` outcome — crate, crystal, tablet,
    // statue, oak_barrel, barrel_stack, hay_pile, plaque_sword, cot — and
    // applyLoot() handled hp, xp, relic, goldkey, paper and gshard. An `item`
    // roll fell through every branch, played the pickup sound, and logged
    // "— loot!" because the roll was not 'none'. The player got nothing. His
    // own screenshot says *"Straw Bedding shattered — loot!"* over an empty
    // inventory, which is this line missing.
    //
    // Food was never removed either: food IS items (the edible slice of the
    // same library, ~16% of ids), so a broken item path took food with it.
    //
    // `amt` carries the tier the loot table asked for — ['item',2,30] means a
    // tier-2 roll — which is how a chest yields better icons than a barrel.
    const I = window.NS_ITEMS;
    const it = !I ? null : (kind==='food' ? I.rollFoodDrop() : I.rollItemDrop(amt||1));
    if(it){
      const got = addItemToStash(it, 1);
      if(got.added > 0){
        const edible = !!(window.NS_MARKET && NS_MARKET.isFood(it.id));
        lootText(x, y, '+' + (it.shortName || it.name), it.color || '#eafff5');
        // 'heart' and 'open' because those keys exist in NS_ICON_PATHS —
        // nsIcon() returns an empty string for anything else, so an invented
        // name would silently ship a message with no icon.
        log((edible ? 'Found food: ' : 'Found ') + it.name + (edible ? ' — eat it from the Food tab.' : ''),
          'reward', edible ? 'heart' : 'open');
        spark(x, y-10, it.color || '#eafff5', 22, 190);
      } else {
        // Stack already at its cap. Say so rather than repeating the silent
        // loss this whole branch exists to fix.
        lootText(x, y, it.shortName + ' (stack full)', '#c9a86a');
      }
    }
  }
  else if(kind==='gshard'){
    // Phase 2 (blueprint §2.2): Glitch Shard crafting material. Tier follows
    // the current act (early acts drop t1, mid t2, late t3) so materials
    // naturally map to the weapon fxTier they'll upgrade in Phase 4.
    const tKey = 't' + _shardTierForAct();
    const g = G.inventory.gshards || (G.inventory.gshards = { t1:0, t2:0, t3:0 });
    g[tKey] = (g[tKey]||0) + amt;
    lootText(x,y,'+'+amt+' GLITCH SHARD ▲'+tKey.toUpperCase(),'#b46bff');
    spark(x, y-10, '#b46bff', 22, 190);
  }
  A.pickup(); updateHUD();
}
// Phase 2: which Glitch Shard tier this act drops (1-indexed fxTier).
// Acts 1-2 -> t1, acts 3-4 -> t2, act 5 -> t3.
function _shardTierForAct(){
  // NULL ABYSS: shard tier scales with DEPTH instead of act — the deeper you
  // fall, the higher-tier shards drop (t3 is the deep-farm reward the
  // blueprint promised). campaignActIndex is 0 in the abyss, so this branch
  // must come first.
  if(abyssMode){ const d = (G && G.depth) || 1; return d>=15 ? 3 : d>=8 ? 2 : 1; }
  if(campaignActIndex >= 4) return 3;
  if(campaignActIndex >= 2) return 2;
  return 1;
}
// Add a rolled NS_ITEMS item (with a quantity) straight into the player's
// stash — used by combat/decor loot rolls that draw an 'item' kind directly
// (not via a container window). Stacks per item id, capped at the item's
// rarity stackCap.
//
// BUGFIX (punch list #1, v39): this used to silently clamp at the stack
// cap (`Math.min(stackCap, cur.qty+qty)`) with no way for the caller to
// know anything was lost. On a grind session that's exactly the report we
// got — "loot yang tidak terbawa ke inventory setelah take all": the
// container slot still shows as taken (it WAS removed from the loot grid),
// but if that item id was already sitting at its cap, some or all of the
// picked-up qty just vanished with zero feedback. Now returns how much
// actually got added vs. how much overflowed, so callers (see
// takeContainerSlot below) can tell the player what happened instead of
// the count just quietly not going up.
function addItemToStash(item, qty){
  if(!item) return {added:0, overflow:0};
  const want = qty||1;
  const inv=G.inventory.items;
  const cap = item.stackCap||99;
  const cur=inv[item.id] || { item, qty:0 };
  const before = cur.qty;
  cur.qty = Math.min(cap, before + want);
  inv[item.id] = cur;
  const added = cur.qty - before;
  return {added, overflow: want-added};
}
function applyRelicPower(amt,x,y){
  const p=G.player;
  // Relics are no longer stored, so the roll seed can't use the relic count.
  const roll=(G.depth + p.level + p.kills) % 4;
  if(roll===0){ p.atkDmg += 2*amt; lootText(x,y,'RELIC: +DMG','#ffdf8a'); }
  else if(roll===1){
    // VITALITY used to permanently add +maxHp with no cap — that's exactly
    // the "HP naik terus tanpa batas" behavior we removed (HP is flat 100
    // now, only Armor raises the cap — see applyLevelStats()/applyEquipment()).
    // Keep the relic feeling rewarding by making it an instant heal instead;
    // if already at full HP, convert it to XP just like the 'hp' loot kind does.
    if(p.hp>=p.maxHp){
      const ups=p.gainXp(6*amt); lootText(x,y,'RELIC: VITALITY (full HP → XP)','#7fffce');
      if(ups>0){ A.levelup(); log('◆ LEVEL UP → '+p.level,'reward'); spark(p.x,p.y-20,'#00ff88',24,200); }
    } else {
      p.hp=Math.min(p.maxHp,p.hp+12*amt); lootText(x,y,'RELIC: +VITALITY (heal)','#7fffce');
    }
  }
  else if(roll===2){ p.speed += 2.5*amt; lootText(x,y,'RELIC: +SPEED','#8ad8ff'); }
  else { const ups=p.gainXp(8*amt); lootText(x,y,'RELIC: +BONUS XP','#d88cff');
    if(ups>0){ A.levelup(); log('◆ LEVEL UP → '+p.level,'reward'); spark(p.x,p.y-20,'#00ff88',24,200); } }
  spark(p.x,p.y-18,'#d88cff',24,180);
  log('◆ Relic absorbed — your Walker mutates.', 'reward');
}
function lootText(x,y,txt,color){ G.dmgNums.push({x,y,val:txt,life:1.2,crit:false,vy:-38,color}); }

// ---------- Unified action button (NULL_STRIKE + container OPEN) ----------
// Replaces the old blocking ULTI popup. A single non-blocking button
// (#actionBtn) sits near the attack button; its mode/label/visibility is
// driven every frame by updateActionButton() from the position of the
// nearest boss / nearest openable container.
function applyUltiDamage(t){
  const dmg=Math.max(1, Math.ceil(t.hp*0.92));
  t.hp=Math.max(1, t.hp-dmg);          // leave foe near death
  t.hitFlash=0.25;
  dmgNum(t.x,t.y-t.r,dmg,true);
  spark(t.x,t.y-10,'#ffae00',46,320);
  G.shake=8; G.ultiFlash=0.55; A.ultiBlast(); // was 13 — punch list #10, v38
  return dmg;
}
// A room is "clear" once every enemy that spawned in it is dead (mirrors
// isFloorClearForAdvance, but scoped to a single room so a container in an
// already-cleared room stays openable even mid-floor).
function isRoomClear(room){
  if(!room || !G.dun) return true;
  return G.enemies.every(e => e.dead || (G.dun.roomAt((e.x/TILE)|0,(e.y/TILE)|0) !== room));
}
function setActionButton(mode, label, icon){
  const btn=$('actionBtn'); if(!btn) return;
  if(!mode){ btn.classList.add('hidden'); btn.disabled=false; btn.classList.remove('loading'); return; }
  btn.classList.remove('hidden');
  btn.dataset.mode=mode;
  const txt = label || (mode==='ulti' ? 'NULL_STRIKE' : 'OPEN');
  const ic  = icon  || (mode==='ulti' ? 'strike' : 'open');
  btn.innerHTML = nsIcon(ic, 'action-ico') + '<span class="ns-lbl">'+txt+'</span>';
}
function updateActionButton(nearest, nd){
  const a=G.action;
  if(G.paused || G.over || a.cd>0){ setActionButton(null); return; }
  // Priority 1: a live boss within striking range -> NULL_STRIKE.
  if(nearest && !nearest.dead && nearest.isBoss && nd<180){
    a.mode='ulti'; a.target=nearest;
    setActionButton('ulti', 'NULL_STRIKE', 'strike');
    return;
  }
  // Priority 2: nearest container that still has something to offer, but only
  // once its room is clear. "Still has something" is deliberately not the same
  // as "never opened" — see _canReopenDecor.
  const p=G.player;
  let nearestDecor=null, nnd=1e9;
  for(const o of G.decor){
    if(!o.interactive) continue;
    if(o.opened && !_canReopenDecor(o)) continue;
    const dist=Math.hypot(o.x-p.x, (o.y-o.h*0.35)-p.y);
    if(dist<nnd){ nnd=dist; nearestDecor=o; }
  }
  if(nearestDecor && nnd<TILE*1.1){
    const room=G.dun.roomAt((p.x/TILE)|0,(p.y/TILE)|0);
    if(isRoomClear(room)){
      a.mode='open'; a.target=nearestDecor;
      let _lbl='OPEN', _ic='open';
      const _def=nearestDecor.def;
      if(_def.isVaultDoor){ _lbl='OPEN VAULT'; _ic='vaultOpen'; }
      else if(nearestDecor.opened){ _lbl='REOPEN'; _ic='open'; }
      else if(_def.isSealedCache){
        // Phase 8: label reflects whether the equipped weapon has the utility.
        const u=_def.sealedUtility;
        if(_playerHasUtility(u)){ _lbl = (u==='grapple') ? 'GRAPPLE OPEN' : 'MELT OPEN'; _ic = (u==='grapple') ? 'grapple' : 'melt'; }
        else { _lbl = (u==='grapple') ? 'NEEDS GRAPPLE' : 'NEEDS MELT'; _ic='lock'; }
      } else if(_def.isPremiumCache){ _lbl='OPEN CACHE'; _ic='open'; }
      setActionButton('open', _lbl, _ic);
      return;
    }
  }
  a.mode=null; a.target=null;
  setActionButton(null);
}
function onActionBtnClick(){
  const a=G.action; if(!a || !a.mode) return;
  if(a.mode==='ulti') onUltiButtonTap();
  else if(a.mode==='open') onOpenButtonTap();
}
// NULL_STRIKE is FREE (Phase 0 — owner decision). No on-chain fee, no
// wallet tx. The special is gated purely by a cooldown: its cost is time,
// not money. Apply the damage instantly and start the cooldown.
function onUltiButtonTap(){
  const t=G.action.target; if(!t || t.dead) return;
  const btn=$('actionBtn');
  applyUltiDamage(t);
  log('NULL_STRIKE landed — '+(t.name||'foe')+' reels, near death.', 'reward', 'strike');
  if(btn){ btn.disabled=true; btn.classList.add('loading'); btn.textContent='…'; }
  G.action.cd=8;
  setTimeout(()=>{
    if(btn){ btn.disabled=false; btn.classList.remove('loading'); }
  }, 450);
}
// Can this already-opened thing be walked back up to and used again?
//
// TWO BUGS LIVED IN THE ANSWER BEING "NO, EVER".
//
// The vault door. closeVaultWindow's own comment promised "the vault door
// stays interactive, so you can check your Paper and re-open it to enter the
// code" — and it was not true. open() marks the door `opened`, and the target
// scan above skipped anything opened, so tapping "BACK TO THE BUNKER" to go
// read the code off your Paper locked you out of the vault for good. The only
// remaining control was "leave without opening", which ENDS the campaign. That
// is the real floor under the reported dead end: the invisible exit buttons
// were one layer, this was the one underneath.
//
// Containers. Close the loot window with slots still untaken — a mis-tap on a
// phone is all it takes — and that loot was gone permanently. Nothing warned,
// nothing hinted, the prop just went inert.
//
// Reopening cannot be farmed: rollLootSlots() memoises on this.lootSlots, so a
// reopened container shows the SAME remaining slots, never a fresh roll. And
// the vault fragment is credited on the FIRST open only (see onOpenButtonTap),
// so open/close/reopen cannot mint fragments either.
function _canReopenDecor(o){
  if(!o || !o.opened) return false;
  if(o.def.isVaultDoor) return true;
  // Sealed/premium caches pay out instantly through grantCacheLoot and never
  // build lootSlots, so they correctly never qualify.
  return !!(o.lootSlots && o.lootSlots.some(s => !s.taken));
}
function onOpenButtonTap(){
  const target=G.action.target; if(!target) return;
  // Already open. No open() (it would return false), no break sound, no
  // fragment — just put the panel back on screen.
  if(target.opened){
    if(!_canReopenDecor(target)) return;
    G.action.mode=null; G.action.target=null; setActionButton(null);
    if(target.def.isVaultDoor) openVaultWindow(target);
    else openContainerWindow(target);
    return;
  }
  const btn=$('actionBtn');
  // Phase 8: a sealed cache stays shut until the equipped weapon has unlocked
  // the matching traversal utility. No open, no consume — just a hint.
  if(target.def.isSealedCache && !_playerHasUtility(target.def.sealedUtility)){
    const u=target.def.sealedUtility;
    log('Sealed tight. Evolve a weapon that grants '+(u==='grapple'?'Grapple':'Wall-Melt')+' to open this cache.', 'dm');
    return;
  }
  if(btn){ btn.disabled=true; btn.classList.add('loading'); btn.textContent='…'; }
  setTimeout(()=>{
    if(!target.open()){ if(btn){ btn.disabled=false; btn.classList.remove('loading'); } return; }
    A.breakProp();
    const _cache = target.def.isSealedCache || target.def.isPremiumCache;
    spark(target.x, target.y-target.h*0.45, target.def.isVaultDoor ? '#b46bff' : (_cache ? '#a970ff' : '#ffd166'), _cache?30:22, _cache?220:180);
    log(target.def.label+' opened.', 'dm');
    if(btn){ btn.disabled=false; btn.classList.remove('loading'); }
    G.action.mode=null; G.action.target=null; setActionButton(null);
    if(target.def.isVaultDoor) openVaultWindow(target);
    else if(_cache) grantCacheLoot(target);       // Phase 8 — direct shard haul
    else {
      openContainerWindow(target);
      // One fragment per container, credited HERE rather than inside
      // openContainerWindow: that function is also the reopen path now, and a
      // bar you could fill by tapping the same chest twice is not a bar.
      // Reaching this line at all means open() returned true, i.e. this is the
      // container's first and only open. The vault door and the sealed/premium
      // caches take the two branches above and never earn a fragment.
      // Also ticks the 'containers' Daily Contract — server-side, inside
      // /api/vault/fragments, off this very request. See announceContracts().
      creditVaultFragment(target);
    }
  }, 450);
}
// Phase 8 — does the equipped weapon grant this traversal utility?
function _playerHasUtility(name){
  const u = G && G.player && G.player.unlockedUtilities;
  return !!(u && u.indexOf && u.indexOf(name) >= 0);
}
// Phase 8 — a sealed/premium cache pays out a Glitch-Shard haul directly (no
// container window). Premium Sector caches pay more. Tier follows the act
// (applyLoot('gshard') routes through _shardTierForAct), so the shards match
// what the player can spend on this act's weapons.
function grantCacheLoot(target){
  const premium = !!target.def.isPremiumCache;
  const n = premium ? (5 + ((Math.random()*4)|0)) : (2 + ((Math.random()*3)|0)); // 5-8 / 2-4
  applyLoot('gshard', n, target.x, target.y-target.h*0.7);
  if(premium || Math.random()<0.5) applyLoot('relic', 1, target.x, target.y-target.h*0.7);
  if(premium){ // a rarer bonus item, rolled + stashed the same way container loot is
    const it = (window.NS_ITEMS && window.NS_ITEMS.rollItemDrop(3)) || null;
    if(it){ addItemToStash(it, 1); lootText(target.x, target.y-target.h*0.9, '+'+it.name, '#ffd166'); }
  }
  spark(target.x, target.y-target.h*0.45, '#a970ff', premium?40:22, 240);
  log((premium?'Premium Sector Cache':'Cache')+' cracked open — +'+n+' Glitch Shards.', 'reward');
}

function tryInteract(){
  if(!G||G.over) return;
  const d=G.dun, p=G.player;
  // Lift interaction (stairs)
  const dx=p.x-d.stairsPx.x, dy=p.y-d.stairsPx.y;
  if(Math.hypot(dx,dy)<TILE*0.9){
    openLiftMenu();
    return;
  }
  // 'E' mirrors the on-screen action button for whatever it currently shows —
  // NULL_STRIKE on a boss in range, or OPEN on a container — so desktop
  // players get a full keyboard equivalent (tap the button, or press E).
  if(G.action.mode && G.action.target) onActionBtnClick();
}

// ---- shared grid helpers ----
// All three item grids (#invItems, #containerItems/LOOT, #containerPlayerItems/
// YOUR INVENTORY) are laid out as a fixed 5-column CSS grid (see .inv-items /
// .container-items in globals.css). Padding every grid out to a fixed slot
// count with empty placeholder cells — instead of only rendering rows for
// populated slots — keeps the grid shape constant no matter how many items
// it holds.
// The container window (LOOT + YOUR INVENTORY, opened from a breakable/
// chest prop) is a centered modal with limited vertical room, so it's
// padded to 5x3 (15 slots) — a full 5x5 (25) made the modal taller than the
// viewport and forced the whole page to scroll just to reach TAKE ALL/close.
// The standalone inventory panel (#invItems, opened via the top-right inv
// button) has its own internal scroll area sized for the full screen, so it
// keeps the larger 5x5 (25) grid.
const GRID_SLOT_COUNT = 25;
const CONTAINER_GRID_SLOT_COUNT = 15;
function fillGridPlaceholders(host, count){
  for(let i=0;i<count;i++){
    const cell=document.createElement('div');
    cell.className='inv-item inv-item-empty';
    host.appendChild(cell);
  }
}

// ---- container loot window (dual-panel: container slots + player stash) ----
function openContainerWindow(decor){
  const win=$('containerWindow'); if(!win) return;
  G._openContainer = decor;
  G.paused = true;
  const title=$('containerTitle'); if(title) title.textContent=(decor.def.label||'CONTAINER').toUpperCase();
  // Punch list follow-up (v39c): LOOT box now visually reads as "belongs
  // to this specific container" instead of blending into the player's own
  // (always-brown) YOUR INVENTORY box below/beside it — a wood cabinet's
  // loot box gets a wood tint, an iron-bound chest's gets a steel tint,
  // etc. See containerMaterial on each DECOR_TYPES entry in props.js and
  // the .loot-panel.mat-* rules in styles/globals.css. Falls back to
  // .mat-default for any container type that doesn't set one.
  const lootPanel=$('containerLootPanel');
  if(lootPanel){
    const mat = decor.def.containerMaterial || 'default';
    lootPanel.className = 'container-panel loot-panel mat-'+mat;
  }
  renderContainerSlots();
  renderStashPanel('containerPlayerItems','containerPlayerEmpty',{readonly:true, gridSlots:CONTAINER_GRID_SLOT_COUNT});
  win.classList.remove('hidden');
}
// Non-item loot kinds that DO have a real sprite/icon representation (same
// files used by renderStashPanel's addRow() for the persistent counters).
// hp/xp/celo are instant stat pickups with no persistent icon, so those
// stay text-only — only 'relic' gets an image here.
const CONTAINER_LOOT_ICONS = { relic:'/sprites/items/relic.png', goldkey:'/sprites/items/golden_key.png', paper:'/sprites/items/paper.png' };

function renderContainerSlots(){
  const decor=G._openContainer; if(!decor) return;
  const host=$('containerItems'), empty=$('containerEmpty');
  if(!host) return;
  host.innerHTML='';
  const slots=(decor.lootSlots||[]).filter(s=>!s.taken);
  // As with renderStashPanel(), the grid itself (now always padded to a
  // fixed 5x3) visually communicates "nothing here" via empty placeholder
  // cells, so the old "Empty." text is kept hidden rather than shown
  // alongside/instead of the grid.
  if(empty) empty.style.display='none';
  if(!slots.length){ fillGridPlaceholders(host,CONTAINER_GRID_SLOT_COUNT); return; }
  for(const s of slots){
    const row=document.createElement('div');
    row.className='inv-item container-slot';
    row.dataset.slot=s.slotId;
    if(s.kind==='item'){
      const it=s.item;
      row.style.borderColor=it.color;
      row.innerHTML=`<img class="inv-item-icon" src="${it.icon}" alt="${it.name}" draggable="false">`+
        `<span class="inv-item-name" style="color:${it.color}">${it.shortName||it.name}</span>`+
        `<span class="inv-item-count">×${s.qty}</span>`;
    } else {
      const labelMap={hp:'HP',xp:'XP',relic:'RELIC',goldkey:'GOLDEN KEY',paper:'OLD PAPER'};
      // BUGFIX (v29): hp/xp pickups had no border-color and no icon at
      // all, so next to item cards (which get a rarity-colored border) they
      // rendered as flat, unstyled boxes — reported as "leftover debris that
      // never gets cleared" even though they were actually still perfectly
      // valid, un-taken loot. Give them the same colored-border treatment as
      // items so they visually read as pickups, and a plain emoji glyph
      // stands in for a real icon (no dedicated hp/xp sprite exists yet).
      // (v40 — 'celo' entry removed along with the dead currency itself.)
      const NON_ITEM_STYLE={
        hp:   { color:'#ef4444', glyph:nsIcon('heart') },
        xp:   { color:'#4ade80', glyph:'✦' },
      };
      const styleCfg=NON_ITEM_STYLE[s.kind];
      const iconSrc=CONTAINER_LOOT_ICONS[s.kind];
      // Issue 1 fix: special loot kinds in container panel also get the
      // gold-tinted visual treatment so they look distinctive here too.
      const SPECIAL_KINDS={relic:true,goldkey:true,paper:true};
      if(SPECIAL_KINDS[s.kind]) row.classList.add('inv-item-special');
      else if(styleCfg) row.style.borderColor=styleCfg.color;
      row.innerHTML=(iconSrc?`<img class="inv-item-icon" src="${iconSrc}" alt="${labelMap[s.kind]||s.kind}" draggable="false">`
          :(styleCfg?`<span class="inv-item-icon" style="font-size:20px;line-height:1;display:block;color:${styleCfg.color}">${styleCfg.glyph}</span>`:''))+
        `<span class="inv-item-name"${styleCfg?` style="color:${styleCfg.color}"`:''}>+${s.amt}${typeof s.amt==='number'&&s.amt<1?'':''} ${labelMap[s.kind]||s.kind.toUpperCase()}</span>`;
    }
    // Item slots open the zoom overlay (TAKE button) for a deliberate,
    // one-at-a-time confirmation. Non-item loot (hp/xp/celo/relic) has no
    // icon/name to zoom on, so those keep the old instant-take behavior.
    if(s.kind==='item'){
      row.addEventListener('click', ()=>openItemZoom({mode:'container-loot', slotId:s.slotId, item:s.item, qty:s.qty}));
    } else {
      row.addEventListener('click', ()=>takeContainerSlot(s.slotId));
    }
    host.appendChild(row);
  }
  fillGridPlaceholders(host,Math.max(0,CONTAINER_GRID_SLOT_COUNT-slots.length));
}
function takeContainerSlot(slotId){
  const decor=G._openContainer; if(!decor) return;
  const slot=(decor.lootSlots||[]).find(s=>s.slotId===slotId && !s.taken);
  if(!slot) return;
  slot.taken=true;
  if(slot.kind==='item'){
    const res = addItemToStash(slot.item, slot.qty);
    const dropX = decor.x, dropY = decor.y-decor.h*0.8;
    if(res.overflow>0){
      // Stack already at/near cap — show the dedicated warning toast
      // (see showStashFullWarning above) instead of the item just
      // quietly not showing up in "Your Inventory". Still gets a small
      // in-world number so the player sees exactly how much (if any)
      // actually made it into the stash.
      const label = slot.item.shortName||slot.item.name;
      if(res.added>0) lootText(dropX,dropY,'+'+res.added+' '+label,slot.item.color||'#e5e7eb');
      showStashFullWarning(label, slot.item.stackCap);
    } else {
      lootText(dropX,dropY,'+'+res.added+' '+(slot.item.shortName||slot.item.name),slot.item.color||'#e5e7eb');
    }
  }
  else applyLoot(slot.kind, slot.amt, decor.x, decor.y-decor.h*0.8);
  A.pickup();
  renderContainerSlots();
  renderStashPanel('containerPlayerItems','containerPlayerEmpty',{readonly:true, gridSlots:CONTAINER_GRID_SLOT_COUNT});
  updateInventoryPanel();
}
function takeAllContainerSlots(){
  const decor=G._openContainer; if(!decor) return;
  for(const s of (decor.lootSlots||[])){ if(!s.taken) takeContainerSlot(s.slotId); }
}
function closeContainerWindow(){
  const win=$('containerWindow'); if(win) win.classList.add('hidden');
  const decor=G._openContainer;
  G._openContainer=null;
  G.paused=false;
  // Say so when loot is left behind. It is no longer lost (the container can
  // be walked back up to — see _canReopenDecor), but a player who closed by
  // mis-tap has no other way to know anything is still in there.
  if(decor && decor.lootSlots && decor.lootSlots.some(s=>!s.taken)){
    log(decor.def.label+' still has something in it — walk back and REOPEN.', 'dm');
  }
}

// ---- weekly Vault code-submit window (Bunker 5, Phase 5.5 #9C/#10) ----
// Same fixed-DOM-overlay pattern as #containerWindow (see attach() for the
// listener bindings). Talks directly to /api/vault/submit — that route
// already gates on Paper + Golden Key ownership and the 3-attempts/week
// cap server-side (see app/api/vault/submit/route.ts), so this UI only
// needs to show the result, not re-implement any of that logic client-side.
function openVaultWindow(decor){
  const win=$('vaultWindow'); if(!win) return;
  G._vaultDecor = decor;
  G.paused = true;
  resetInput();
  vaultSetCode('');
  const msg=$('vaultMsg'); if(msg){ msg.textContent=''; msg.className='vault-msg'; }
  const submitBtn=$('vaultSubmitBtn'); if(submitBtn){ submitBtn.disabled=false; submitBtn.textContent='SUBMIT'; }
  win.classList.remove('hidden');
  // NO input.focus() here on purpose — see the keypad note below.
  refreshVaultRequirements();
  prepareVaultOnChain();
}

// Tell the server to put this week's vault code on chain, NOW, while the player
// is still looking at the keypad.
//
// This is the client half of the main vault fix. /api/vault/submit used to
// store the code and pay the winner in the SAME request, and only for the first
// winner of each week — and the second of those two writes is the one Forno
// kept dropping before it reached the mempool, which is how a solved vault paid
// nothing. Storing the code when the DOOR opens instead of when someone WINS
// means the payout is a single write by the time it matters.
//
// Fire-and-forget on purpose: the player must never wait for it, and it must
// never surface an error. Solving the code is not blocked by this — the server
// falls back to storing and paying together (with a shared nonce) if it has to.
// The daily cron does the same errand, so a week nobody opens a door in is
// still covered.
let _vaultPrepared = null;
function prepareVaultOnChain(){
  const week = String(getVaultWeekId());
  if(_vaultPrepared === week) return;   // once per week per session is plenty
  _vaultPrepared = week;
  try{
    fetch('/api/vault/prepare', { method:'POST' }).catch(()=>{});
  }catch(e){ /* offline — the cron still has it */ }
}

// ---- the 4-digit entry (in-game keypad, not the phone's) ----
// The code field used to be a focused <input inputmode="numeric">, which pops
// the OS keyboard open on a phone. That keyboard covers half the screen,
// re-lays out the whole overlay, and on mid-range Android it drops frames hard
// enough to feel like the game hung. The field is now READ-ONLY and driven by
// the pad below, so nothing native ever opens. Desktop still types normally —
// onVaultKeydown (bound on window in attach()) handles digits, Backspace and
// Enter whenever the window is open.
function vaultGetCode(){ const el=$('vaultCodeInput'); return el ? String(el.value||'') : ''; }
function vaultSetCode(v){
  const el=$('vaultCodeInput'); if(!el) return;
  el.value = String(v||'').replace(/\D/g,'').slice(0,4);
}
function vaultPushKey(k){
  if(k==='clear'){ vaultSetCode(''); return; }
  const cur=vaultGetCode();
  if(k==='del'){ vaultSetCode(cur.slice(0,-1)); return; }
  if(!/^[0-9]$/.test(k) || cur.length>=4) return;
  vaultSetCode(cur+k);
}
function onVaultKeydown(e){
  const win=$('vaultWindow'); if(!win || win.classList.contains('hidden')) return;
  if(e.key==='Enter'){ e.preventDefault(); submitVaultCode(); return; }
  if(e.key==='Backspace'){ e.preventDefault(); vaultPushKey('del'); return; }
  if(/^[0-9]$/.test(e.key)){ e.preventDefault(); vaultPushKey(e.key); }
}

// ---- what the player is actually carrying ----
// The door needs BOTH this week's Paper (it carries the code) and the Golden
// Key. Before this, a player holding only one of them saw an empty code box
// and two low-contrast buttons, learned nothing, and — going by the report
// that prompted this — read the whole screen as "no way out but quitting".
// The window now says up front what is missing and what to do about it, and
// both exits below are spelled out rather than implied.
//
// Ownership is read from the same weekly claim records /api/vault/submit
// gates on, so this line can never disagree with the submit result. It is
// display only: SUBMIT stays enabled either way (a missing-items submit is
// rejected server-side WITHOUT spending an attempt), so a slow or unreachable
// status check never locks anyone out of a code they legitimately hold.
let _vaultReqSeq = 0;
async function refreshVaultRequirements(){
  const req=$('vaultReq'); if(!req) return;
  // Close-and-reopen is a normal move here ("go read the Paper, come back"),
  // so an in-flight check from the previous open must not land on top of the
  // new one's result.
  const seq = ++_vaultReqSeq;
  const set=(cls,html)=>{
    if(seq!==_vaultReqSeq) return;
    req.className='vault-req'+(cls?' '+cls:''); req.innerHTML=html;
  };
  if(!WALLET_ADDRESS){ set('warn','Wallet not ready yet — reopen this door in a moment.'); return; }
  set('', 'Checking what you carry…');
  const chip=(label,has)=>'<span class="vault-chip'+(has?' has':'')+'">'+(has?'✓':'✗')+' '+label+'</span>';
  try{
    const [p,k,f] = await Promise.all([
      fetch('/api/paper/status?walletAddress='+encodeURIComponent(WALLET_ADDRESS)).then(r=>r.json()),
      fetch('/api/goldenkey/status?walletAddress='+encodeURIComponent(WALLET_ADDRESS)).then(r=>r.json()),
      fetch('/api/vault/fragments?wallet='+encodeURIComponent(WALLET_ADDRESS)).then(r=>r.json()).catch(()=>null)
    ]);
    const hasPaper = !!(p && p.claimed);
    const hasKey   = !!(k && k.claimed);
    if(f && typeof f.fragments === 'number') VAULT_FRAG = { loaded:true, fragments:f.fragments, nextGoal:f.nextGoal||null };
    const chips = '<span class="vault-chips">'+chip('Paper',hasPaper)+chip('Golden Key',hasKey)+'</span>';
    if(hasPaper && hasKey){
      set('ok', chips+'<span class="vault-req-hint">Tap your Paper in the inventory to read this week\'s code.</span>');
    } else {
      const missing = (!hasPaper && !hasKey) ? 'You need both this week.'
                    : (!hasPaper ? 'The Paper is what carries the code.'
                                 : 'The Key is what turns the door.');
      // With fragments live, "go search" is no longer a shrug — it is a
      // countable distance. Telling the player exactly how many containers
      // stand between them and the item is the whole point of §5.1: a player
      // who can see the number left never concludes the week is a write-off.
      let route;
      const goal = (f && f.nextGoal) ? f.nextGoal : null;
      if(goal){
        const have = Math.min(f.fragments|0, goal.threshold);
        route = 'Open <b>'+Math.max(0, goal.threshold-have)+'</b> more lockable containers and the '
              + goal.label + ' is yours outright — you are at ' + have + '/' + goal.threshold
              + '. It can also drop early by luck.';
      } else {
        route = 'Both drop inside lockable containers — go back and search.';
      }
      set('warn', chips+'<span class="vault-req-hint">'+missing+' '+route+' This door stays open.</span>');
    }
  }catch(e){
    set('warn','Could not check your stash — you can still enter a code if you have one.');
  }
}
// Just close the popup and RESUME the bunker. Bug fix: this used to also
// finish Bunker 5 (onActBunkerCleared), so tapping "close" to go read the
// code off your Paper in the inventory kicked you out of the bunker. Now
// closing simply hides the window — the vault door stays interactive, so
// you can check your Paper and re-open it to enter the code.
function closeVaultWindow(){
  const win=$('vaultWindow'); if(win) win.classList.add('hidden');
  if(G){ G._vaultDecor=null; G.paused=false; }
}
// Finish Bunker 5 and roll into the ending. Called on a SOLVED vault, or
// when the player explicitly chooses "leave the bunker" (they don't have /
// don't want the code). This is the only path that ends the last bunker.
function finishBunkerFromVault(){
  const win=$('vaultWindow'); if(win) win.classList.add('hidden');
  const decor=G ? G._vaultDecor : null;
  if(G){ G._vaultDecor=null; }
  if(decor && decor.def && decor.def.isVaultDoor){
    setTimeout(()=>onActBunkerCleared(),400);
  } else if(G){ G.paused=false; }
}
async function submitVaultCode(){
  if(!G) return;
  const input=$('vaultCodeInput'), msg=$('vaultMsg'), submitBtn=$('vaultSubmitBtn');
  const code=(input ? input.value : '').trim();
  if(!/^\d{4}$/.test(code)){
    if(msg){ msg.textContent='Enter the 4-digit code from your Paper.'; msg.className='vault-msg err'; }
    return;
  }
  if(!WALLET_ADDRESS){
    if(msg){ msg.textContent='Wallet not ready yet — try again in a moment.'; msg.className='vault-msg err'; }
    return;
  }
  if(submitBtn){ submitBtn.disabled=true; submitBtn.textContent='…'; }
  if(msg){ msg.textContent=''; msg.className='vault-msg'; }
  try{
    const res = await fetch('/api/vault/submit', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ walletAddress: WALLET_ADDRESS, weekId: String(getVaultWeekId()), code })
    });
    const data = await res.json();
    if(data && data.error==='missing_items'){
      if(msg){ msg.textContent=data.message||'You need this week\'s Paper and Golden Key first.'; msg.className='vault-msg err'; }
    } else if(data && data.isCorrect){
      const _paid = data.rewardStatus==='paid';
      if(msg){
        // Same rule as the popup note below: do not name a cause the server
        // did not check. "Once the pool is funded" was printed for dropped
        // transactions, an unconfigured signer and an empty pool alike.
        msg.textContent = _paid ? '✓ Correct! Reward sent to your wallet.'
                                : '✓ Correct! Vault unlocked — the reward finishes sending itself.';
        msg.className='vault-msg ok';
      }
      A.levelup(); spark(G.player.x, G.player.y-30, '#b46bff', 40, 260);
      log(_paid ? 'Vault unlocked — reward claimed.'
                : 'Vault unlocked — reward pending' + (data.reason ? ' ('+data.reason+')' : '') + '.', 'reward');
      if(submitBtn){ submitBtn.textContent='DONE'; }
      // THE WIN SCREEN. This used to be the line above and a 1.4s timer, which
      // meant the one moment real money moves went by without naming the
      // amount, the currency, or the fact that it transfers itself. The bunker
      // now finishes when the PLAYER closes the popup, not on a timer.
      openVaultWinPopup(data);
      return;
    } else if(data){
      const remaining = typeof data.attemptsRemaining==='number' ? data.attemptsRemaining : null;
      if(msg){
        msg.textContent = remaining===0
          ? 'Wrong code. No attempts left this week.'
          : `Wrong code.${remaining!=null ? ' '+remaining+' attempt(s) left this week.' : ''}`;
        msg.className='vault-msg err';
      }
    } else {
      if(msg){ msg.textContent='Something went wrong. Try again.'; msg.className='vault-msg err'; }
    }
  }catch(e){
    if(msg){ msg.textContent='Offline — could not reach the vault. Try again later.'; msg.className='vault-msg err'; }
  }
  if(submitBtn){ submitBtn.disabled=false; submitBtn.textContent='SUBMIT'; }
}

// ---- the vault win popup -----------------------------------------------
//
// Owner, after cracking a vault for real: "tidak ada pop up untuk user, pop up
// menang usdt dan jumlahnya, dan penjelasan auto transfer."
//
// Three things it must say, because the player has no other way to learn any of
// them: that they won, HOW MUCH and in WHAT, and that the money is already on
// its way without a claim step. The last one matters most on MiniPay — a player
// who does not know the transfer is automatic goes looking for a claim button
// that does not exist, and concludes the game owes them money.
//
// It does not auto-dismiss. The bunker finishes when the player presses
// CONTINUE, so nothing can pull the number off screen before it is read.
function openVaultWinPopup(data){
  const win = $('vaultWinWindow');
  const paid = data && data.rewardStatus === 'paid';
  const amountEl = $('vwinAmount'), noteEl = $('vwinNote'), txEl = $('vwinTx');

  if(amountEl){
    // The amount comes from the server, which read it off the vault contract
    // right after the transfer. If that read failed it is absent — say "sent"
    // rather than invent a figure, because a wrong number here is worse than
    // no number.
    const amt = (data && typeof data.amount === 'number' && isFinite(data.amount)) ? data.amount : null;
    const tok = (data && typeof data.token === 'string' && data.token) ? data.token : 'USDT';
    amountEl.textContent = paid
      ? (amt !== null ? '+' + (Math.round(amt * 100) / 100) + ' ' + tok : 'Reward sent')
      : 'Reward pending';
  }
  if(noteEl){
    // A PENDING REWARD NOW SAYS WHY IT IS PENDING.
    //
    // This line used to read "the transfer completes as soon as the reward pool
    // is topped up" for EVERY failure, and the server had never once looked at
    // the pool. The week the owner hit it, the pool held 0.85 USDT against a
    // 0.05 reward — seventeen payouts' worth — and the real fault was a
    // transaction Forno dropped before it reached the mempool. That sentence
    // sent him, and then an agent, to the treasury for an hour.
    //
    // The server now checks each cause before naming it (see
    // VAULT_FAILURE_MESSAGE in lib/server/vaultChain.ts) and sends the sentence
    // down with the response. The fallback below claims nothing it has not been
    // told — it says the win is safe and the payout retries, which is true of
    // every pending case.
    const why = (data && typeof data.message === 'string' && data.message) ? data.message : null;
    noteEl.innerHTML = paid
      ? 'Sent straight to your wallet — <b>no claim needed</b>.<br>It may take a few seconds to show in MiniPay.'
      : (why || 'Your code was correct and the win is recorded. The payout retries by itself — nothing is lost.');
  }
  if(txEl){
    const hash = data && typeof data.txHash === 'string' && data.txHash;
    if(hash){
      txEl.href = 'https://celoscan.io/tx/' + hash;
      txEl.classList.remove('hidden');
    } else {
      txEl.classList.add('hidden');
    }
  }
  if(win) win.classList.remove('hidden');
  A.levelup();
}
function closeVaultWinPopup(){
  const win = $('vaultWinWindow');
  if(win) win.classList.add('hidden');
  finishBunkerFromVault();
}

// ---- lift menu ----
function openLiftMenu(){
  if(!G||G.over||G.paused) return;
  resetInput();
  G.paused = true;
  const opts = [];
  for(let f=1; f<=G.maxDepthReached; f++) opts.push({ floor:f, locked:false });
  const nextFloor = G.depth+1;
  // NULL ABYSS: never cap the descent at floor 5 — the abyss goes down forever.
  if((nextFloor<=5 || abyssMode) && !opts.find(o=>o.floor===nextFloor)){
    opts.push({ floor:nextFloor, locked: !isFloorClearForAdvance(G.depth) });
  }
  opts.sort((a,b)=>a.floor-b.floor);
  renderLiftMenu(opts);
  $('liftMenu').classList.remove('hidden');
}
function renderLiftMenu(opts){
  const host = $('liftFloorList'); if(!host) return;
  host.innerHTML = '';
  for(const o of opts){
    const btn = document.createElement('button');
    btn.className = 'big-btn lift-floor-btn' + (o.floor===G.depth ? ' current' : '') + (o.locked ? ' locked' : '');
    btn.disabled = o.locked;
    if(o.locked){ btn.innerHTML = `FLOOR ${o.floor} ` + nsIcon('lock','lift-ico'); }
    else btn.textContent = (o.floor===G.depth ? `FLOOR ${o.floor} (here)` : `FLOOR ${o.floor}`);
    if(!o.locked && o.floor!==G.depth){
      btn.addEventListener('click', () => { closeLiftMenu(); travelToFloor(o.floor); });
    }
    host.appendChild(btn);
  }
}
function closeLiftMenu(){
  $('liftMenu').classList.add('hidden');
  // Do NOT unpause here — if the player chose a floor, travelToFloor()
  // keeps the game paused through the entire dark-transition + descend()
  // sequence and only unpauses once the new floor is fully loaded and
  // visible again. Only unpause immediately for an outright cancel (no
  // floor travel happening at all).
}
function onLiftCancel(){
  $('liftMenu').classList.add('hidden');
  G.paused = false;
}
function travelToFloor(depth){
  if(!G) return;
  // Ignore a floor-change request while a transition is already running —
  // see the guard note in showLoadingTransition() for why this matters on
  // touch devices.
  if(_fadeActive) return;
  resetInput();
  G.paused = true;
  // Stay paused for the whole transition so the update loop can't keep
  // simulating the OLD floor while the screen fades — see closeLiftMenu().
  showLoadingTransition(() => descend(depth), () => { resetInput(); G.paused = false; });
}
// Dark loading transition: fade to black, swap floor data underneath while
// hidden, then fade back in — used for every lift trip so the cached-floor
// swap never happens visibly mid-frame. onDark runs once the screen is
// fully black (safe to swap state); onDone runs once it's fully faded back
// in (safe to resume simulation/input).
//
// Two failure modes used to leave the player stuck staring at a fully
// black screen after changing floors:
//   1) Overlapping calls — on touch devices a single tap can fire both a
//      real 'click' and a synthetic/ghost one, so this could be invoked
//      twice in quick succession. The two calls shared the same element's
//      opacity/timeout state, and once their setTimeout chains interleaved
//      it was possible for the LAST thing to run to be an early step of
//      one chain (opacity back to '1', not yet hidden) with no further
//      timer left pending to ever fade it back — a permanent black screen.
//   2) An exception thrown inside onDark() (the floor-swap callback) would
//      abort the setTimeout callback before it reached the fade-back-in
//      step, again leaving the overlay fully opaque forever.
// Both are fixed below: a single in-flight guard prevents overlap, all
// pending timers are tracked and torn down before a new transition starts,
// and onDark() runs inside try/catch so the fade ALWAYS continues back in
// even if the floor swap itself throws.
let _fadeActive = false;
let _fadeTimers = [];
function _clearFadeTimers(){ _fadeTimers.forEach(id=>clearTimeout(id)); _fadeTimers=[]; }

// ---- scene loader (Continue / first scene render) ----
// A black screen with a retro "LOADING…" bar, shown while the very first scene
// (outdoor or bunker) preloads on Continue / New Game — the reported "Continue
// lama masuk, ngeblank hitam" wait — so it reads as "rendering" rather than a
// frozen/black error. Separate from both the NullState logo splash and the
// floor-transition fade. The bar EASES toward ~90% while loading, then snaps to
// 100% and fades out the instant the scene is ready (hideSceneLoader). A safety
// timer force-completes it so a stalled preload can never strand the player.
let _sceneLoaderTimer = null;
let _sceneRAF = null, _sceneProg = 0, _sceneTarget = 0, _sceneDone = false;
function _sceneTick(){
  // Ease toward the target; fast easing once we're completing so the snap to
  // 100% still looks like motion, slow while loading so it never "finishes"
  // early and then just sits there.
  _sceneProg += (_sceneTarget - _sceneProg) * (_sceneDone ? 0.22 : 0.035);
  const f = document.getElementById('sceneLoaderFill');
  if(f) f.style.width = Math.min(100, _sceneProg).toFixed(1) + '%';
  if(_sceneDone && _sceneProg >= 99.3){
    if(f) f.style.width = '100%';
    const el = document.getElementById('sceneLoader'); if(el) el.classList.add('hidden');
    _sceneRAF = null; return;
  }
  _sceneRAF = requestAnimationFrame(_sceneTick);
}
function showSceneLoader(){
  const el = document.getElementById('sceneLoader');
  if(!el) return;
  el.classList.remove('hidden');
  // The element is rendered visible by React from the first paint, so we key
  // off the animation state (not the class): start the fill loop if it isn't
  // already running and hasn't already completed. Idempotent — a second call
  // (mount() then boot()) won't restart the bar from 0.
  if(_sceneRAF == null && !_sceneDone){
    _sceneProg = 0; _sceneTarget = 90;
    const f = document.getElementById('sceneLoaderFill'); if(f) f.style.width = '0%';
    _sceneRAF = requestAnimationFrame(_sceneTick);
  }
  if(_sceneLoaderTimer) clearTimeout(_sceneLoaderTimer);
  // Belt-and-suspenders: never let the loader outlive the load — force the
  // completion path after a few seconds even if a hide call is somehow missed.
  _sceneLoaderTimer = setTimeout(hideSceneLoader, 12000);
}
// Reset loader state for a fresh game session — module vars persist across
// unmount/remount, so a previous session's "done" flag must not block the
// next Continue/New Game from animating.
function resetSceneLoader(){
  if(_sceneRAF){ cancelAnimationFrame(_sceneRAF); _sceneRAF = null; }
  _sceneProg = 0; _sceneTarget = 90; _sceneDone = false;
  const f = document.getElementById('sceneLoaderFill'); if(f) f.style.width = '0%';
}
function hideSceneLoader(){
  if(_sceneLoaderTimer){ clearTimeout(_sceneLoaderTimer); _sceneLoaderTimer = null; }
  const el = document.getElementById('sceneLoader');
  if(!el || el.classList.contains('hidden')) return;
  // Complete the bar to 100%, then _sceneTick fades/hides it once it lands.
  _sceneTarget = 100; _sceneDone = true;
  if(!_sceneRAF) _sceneRAF = requestAnimationFrame(_sceneTick);
}
// Hide only AFTER the entered scene has painted at least one real frame under
// the loader — two rAFs guarantee a paint — so there's never a black gap
// (canvas blank + HUD peeking) between the loader hiding and the scene showing.
function hideSceneLoaderAfterPaint(){
  requestAnimationFrame(()=>requestAnimationFrame(hideSceneLoader));
}
function showLoadingTransition(onDark, onDone, loadingText){
  const el = $('loadingFade');
  const textEl = $('loadingFadeText');
  if(!el){ try{ onDark(); } finally { if(onDone) onDone(); } return; }

  // If a previous transition is still mid-flight, cancel its pending timers
  // and start clean rather than letting the two interleave.
  if(_fadeActive) _clearFadeTimers();
  _fadeActive = true;

  if(textEl){ textEl.textContent = loadingText||''; textEl.classList.remove('show'); }
  el.classList.remove('hidden');
  el.style.opacity = '0';
  requestAnimationFrame(()=>{
    el.style.opacity = '1';
    // Owner: "masuk ke bungker lama bgt, kaya gelap" — the transition spent
    // ~2.2s (420 fade-out + 1400 dark hold + 420 fade-in), most of it staring
    // at a black screen. Tightened so the swap is still fully hidden but the
    // dark stretch is roughly halved.
    const t1 = setTimeout(()=>{
      try{
        onDark();
      } catch(err){
        console.error('showLoadingTransition: onDark failed, fading back in anyway', err);
      }
      if(textEl && loadingText) textEl.classList.add('show');
      const t2 = setTimeout(()=>{
        if(textEl) textEl.classList.remove('show');
        el.style.opacity = '0';
        const t3 = setTimeout(()=>{
          el.classList.add('hidden');
          _fadeActive = false;
          if(onDone) onDone();
        }, 280);
        _fadeTimers.push(t3);
      }, loadingText ? 650 : 200);
      _fadeTimers.push(t2);
    }, 300);
    _fadeTimers.push(t1);
  });
}

// ---- particles & numbers ----
function spark(x,y,color,n=8,spd=120){
  for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2, s=spd*(0.4+Math.random());
    G.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:0.4+Math.random()*0.3,
      max:0.7,color,r:2+Math.random()*2});}
}
function dmgNum(x,y,val,crit=false){ G.dmgNums.push({x,y,val,life:0.9,crit,vy:-46}); }
function hitSpark(x,y,color){
  G.particles.push({x,y,vx:0,vy:0,life:0.16,max:0.16,color:'rgba(255,255,255,.9)',r:10});
  spark(x,y,color||'#fff',8,210);
}
function roomTitle(room){
  if(!room) return 'FORSAKEN PASSAGE';
  if(room.vibe==='prison') return 'BROKEN CELL BLOCK';
  if(room.vibe==='cave') return 'NULL GROTTO';
  if(room.vibe==='crypt') return 'CRYPT CHAMBER';
  if(room.vibe==='moss') return 'MOSS-CHOKED VAULT';
  if(room.vibe==='earth') return 'EARTHEN RUIN';
  return 'STONE BUNKER ROOM';
}
function checkRoomDiscovery(){
  const d=G.dun, p=G.player;
  const room=d.roomAt((p.x/TILE)|0,(p.y/TILE)|0);
  const id=room ? `${G.depth}:${room.id}` : `corridor:${G.depth}:${(p.x/TILE)|0}:${(p.y/TILE)|0}`;
  if(room && G.lastRoomId!==id){
    G.lastRoomId=id;
    if(!G.discoveredRooms.has(id)){
      G.discoveredRooms.add(id);
      showBanner(roomTitle(room), 'NEW AREA DISCOVERED');
      spark(p.x,p.y-20,'#00ff88',12,90);
    }
  }
}
function checkFloorClearReward(){
  if(G.floorClearShown[G.depth]) return;
  if(!isFloorClearForAdvance(G.depth)) return;
  G.floorClearShown[G.depth]=true;
  G.player.hp=Math.min(G.player.maxHp, G.player.hp+18);
  if(window.NS_RUN) NS_RUN.onFloorCleared(); // Phase 1: per-run stat
  // Daily Contracts: a secured floor, plus whatever kills piled up getting
  // there. Flushing here keeps the kill counter roughly live without a request
  // per corpse (see reportContract).
  reportContract('floors', 1);
  flushContractKills();
  showBanner('FLOOR SECURED', 'LIFT UNLOCKED');
  spark(G.player.x,G.player.y-18,'#00ff88',36,240);
  updateHUD();
}

// Shared "damage + FX" application for a single enemy hit — used by melee
// swings (hitTest() below) AND ranged projectiles (updateProjectiles()), so
// hit-stop/particles/knockback/shake always feel consistent no matter which
// weapon behavior dealt the hit. fromX/fromY is the point knockback should
// push away from (player position for melee, arrow position for ranged).
function applyHitToEnemy(e, dmg, fromX, fromY, beh){
  // LEVEL = CRIT: roll a critical hit off the player's level-derived crit
  // chance. A crit doubles this hit's damage and shows a gold, bigger number
  // (dmgNum's crit flag). Centralised here so it covers melee swings, the
  // double/triple follow-up hits, AND ranged projectiles (all route through
  // this function) with one implementation.
  let crit=false;
  { const _p=G && G.player;
    if(_p && _p.critChance>0 && Math.random()<_p.critChance){ crit=true; dmg=Math.max(1, Math.round(dmg*2)); } }
  const killed=e.hurt(dmg);
  dmgNum(e.x,e.y-e.r, dmg, crit);
  const _fx = window.NS_FX;
  const _kbCfg = (window.NS_MONSTER_CONFIG||{}).knockback || {base:{x:220,y:145}};
  const _shakeCfg = (window.NS_MONSTER_CONFIG||{}).shake || {playerAttack:6};
  const _partCfg = (window.NS_MONSTER_CONFIG||{}).particles || {lightHit:10,heavyHit:14};
  if (_fx) {
    _fx.triggerHitStopForDmg(dmg, e.isBoss);
    const pcount = dmg > 20 ? _partCfg.heavyHit : _partCfg.lightHit;
    _fx.particleBurst(G.particles, e.x, e.y-8, e.arch.color, pcount, 170);
  } else {
    spark(e.x,e.y-8,e.arch.color,10,160);
  }
  const kx=Math.sign(e.x-fromX)||1, ky=Math.sign(e.y-fromY);
  const _kbBase = beh==='knockback' ? (_kbCfg.knockback||{x:420,y:270}) :
                   beh==='aoe'       ? (_kbCfg.aoe||{x:320,y:210}) :
                                       (_kbCfg.base||{x:220,y:145});
  e.kb.x = kx * _kbBase.x * (e.isBoss ? 0.45 : 1);
  e.kb.y = ky * _kbBase.y * (e.isBoss ? 0.45 : 1);
  hitSpark(e.x,e.y-e.r*0.55,e.arch.color);
  // FLICKER FIX (owner: "maps berkedip" on certain weapons): aoe/cleave weapons
  // hit MANY enemies in a SINGLE swing, and this function runs once PER enemy in
  // the same frame. Adding screen-shake + the premium impact ring/shower per
  // enemy pinned G.shake at its max on every swing, so the camera jittered
  // nonstop and the whole screen/map read as flickering — and it spawned 100+
  // particles a swing, dropping the frame rate (which also made the light-rim
  // layer blink). Gate all SCREEN-LEVEL fx (shake + the premium glow ring &
  // shower) to ONCE per swing via a short time window; the per-enemy feedback
  // (damage number, hit spark, basic burst, knockback) still fires for each.
  const _nowS = (typeof performance!=='undefined' ? performance.now() : Date.now())/1000;
  const _swingFx = (_nowS - (G._lastSwingFxT||0)) > 0.08;
  if(_swingFx) G._lastSwingFxT = _nowS;
  // v77: premium weapons paint a coloured impact on the enemy (owner spec:
  // "efek mengenai musuh"). Now once-per-swing so aoe doesn't stack it.
  const _pg = G.player && G.player._weaponGlow;
  if(_pg && _swingFx){
    // The impact burst existed but was one fixed size, so a tier-3 weapon hit
    // exactly as hard as a tier-2 one on screen. It scales now: the moment of
    // contact is where a paid upgrade should be felt, more than the idle glow.
    const _evo = Math.max(1, (G.player && G.player._wpnTier) || 1);
    const _n    = _evo >= 3 ? 30 : 18;
    const _spd  = _evo >= 3 ? 340 : 260;
    const _shwr = _evo >= 3 ? 14 : 8;
    const _fx2 = window.NS_FX;
    if(_fx2){
      _fx2.particleBurst(G.particles, e.x, e.y-e.r*0.5, _pg, _n, _spd);
      _fx2.particleShower && _fx2.particleShower(G.particles, e.x, e.y-e.r*0.5, _fxWhite(_pg,0.5), _shwr, 180);
    } else {
      spark(e.x,e.y-e.r*0.5,_pg,_n,_spd-20);
    }
    // expanding ring flash, drawn by the FX ring list if present. Cap the list
    // so a burst of hits can never pile up an additive brightness spike.
    // Tier 3 throws a second, wider, slower ring behind the first — a shockwave
    // rather than a bigger spark, which is what makes the top tier feel like a
    // different weapon instead of the same one turned up.
    if(G.rings){
      G.rings.push({ x:e.x, y:e.y-e.r*0.5, t:0, dur:0.32, col:_pg, r0:e.r*0.6, r1:e.r*(_evo>=3?2.8:2.2) });
      if(_evo>=3) G.rings.push({ x:e.x, y:e.y-e.r*0.5, t:0, dur:0.5, col:_fxWhite(_pg,0.45), r0:e.r*0.9, r1:e.r*4.2 });
      if(G.rings.length>10) G.rings.splice(0, G.rings.length-10);
    }
  }
  const _shakeAmt = e.isBoss ? (_shakeCfg.bossHit||18) : (_shakeCfg.playerAttack||6);
  if(_swingFx || e.isBoss){ G.shake=Math.min(G.shake+_shakeAmt,14); A.hit(); } // once per swing (bosses always shake/sound)
  if(killed){ onEnemyKilled(e); }
  return killed;
}

// ---- ranged projectiles (Hunter's Bow) ----
// Lightweight arrow: travels in a straight line from where it was fired,
// deals damage to the first enemy it touches, then despawns. Drawn with
// canvas primitives only (no new sprite assets) — a thin rotated shaft plus
// a small pixel arrowhead, matching the chunky pixel-art FX language used
// elsewhere (pixelArc() in entities.js).
function spawnProjectile(owner, dmg, angOff, dmgMul){
  // v69: prefer the LOCKED attack aim (_atkAim, pinned to the target when
  // auto-attack starts) over the live movement vector. The arrow spawns in
  // the strike window ~0.1-0.3s AFTER startAttack(); if the player keeps
  // walking, _lastMove has already flipped back to the movement direction
  // by then and the arrow flew where the player was WALKING, not at the
  // target — same root cause as the old melee swing-aim bug. More visible
  // now that the ranged engage radius is 260.
  const mv = (owner._atkAim && (Math.abs(owner._atkAim.x)+Math.abs(owner._atkAim.y)>0.1))
    ? owner._atkAim
    : (owner._lastMove && (Math.abs(owner._lastMove.x)+Math.abs(owner._lastMove.y)>0.1))
      ? owner._lastMove : { x: owner.facing, y: 0 };
  const m = Math.hypot(mv.x,mv.y)||1;
  // angOff (radians) fans the shot off the aim — used by the Sunfire Longbow's
  // `volley`, which looses three arrows at once. 0/undefined = dead on aim,
  // byte-identical to the pre-v76 single-arrow path.
  const _a = Math.atan2(mv.y, mv.x) + (angOff || 0);
  const dx=Math.cos(_a), dy=Math.sin(_a);
  const speed=640, startDist=28;
  G.projectiles.push({
    x: owner.x+dx*startDist, y: owner.y-8+dy*startDist,
    vx: dx*speed, vy: dy*speed,
    dmg, dmgMul: dmgMul||1, r:7, traveled:0, maxRange:560, dead:false,
    color: owner._fxColor || null,   // v67 T11: arrow tint follows weapon fxColor
    glow: owner._weaponGlow || null, // v77: premium bolt/arrow glow trail
  });
}
// Apply one weapon hit to a breakable decor object: chip FX, and on the
// breaking hit — shatter SFX, loot roll, and a log line. Shared by the melee
// swing sweep in hitTest() AND the arrow path in updateProjectiles() (v65 T3
// — arrows previously only collided with enemies, never decor).
function smashDecor(o){
  const broke=o.hit();
  spark(o.x,o.y-o.h*0.4,'#caa15a',6,120); G.shake=Math.min(G.shake+2,6);
  if(broke){
    A.breakProp(); spark(o.x,o.y-o.h*0.45,'#b98a4a',20,180);
    const loot=rollLoot(o.def.loot);
    if(loot.kind!=='none') applyLoot(loot.kind, loot.amt, o.x, o.y-o.h*0.8);
    log(o.def.label+' shattered'+(loot.kind!=='none'?' — loot!':'.'), 'dm');
  } else { A.hit(); }
}
function updateProjectiles(dt){
  if(!G.projectiles.length) return;
  for(const pr of G.projectiles){
    if(pr.dead) continue;
    const stepX=pr.vx*dt, stepY=pr.vy*dt;
    const nx=pr.x+stepX, ny=pr.y+stepY;
    if(G.dun.isWall(nx,ny)){ pr.dead=true; spark(pr.x,pr.y,pr.color||'#eafff5',5,90); continue; }
    pr.x=nx; pr.y=ny; pr.traveled+=Math.hypot(stepX,stepY);
    if(pr.traveled>=pr.maxRange){ pr.dead=true; continue; }
    for(const e of G.enemies){
      if(e.dead) continue;
      if(Math.hypot(e.x-pr.x,e.y-pr.y) < pr.r+e.r){
        // v77: ranged htk — resolve damage against THIS enemy's max HP so the
        // crossbow/bow also kills a normal enemy in its htk count. pr.dmg is the
        // legacy flat fallback (unarmed/no-htk). Side volley arrows keep their
        // reduced share via pr.dmgMul.
        const _hd = _weaponDmgFor(e, G.player);
        const _pd = _hd != null ? Math.max(1, Math.round(_hd * (pr.dmgMul||1))) : pr.dmg;
        applyHitToEnemy(e, _pd, pr.x, pr.y, 'ranged');
        pr.dead=true;
        break;
      }
    }
    if(pr.dead) continue;
    // v65 T3: arrows now smash breakable decor too, same rules as the melee
    // sweep in hitTest() (interactive containers are skipped — chests/safes
    // still open by walking up, an arrow just flies past them). Same
    // collision anchor as melee: prop center lifted by 0.4*h.
    for(const o of G.decor){
      if(o.broken || o.interactive || o.ambient) continue;  // ambient = scenery, never smashable
      if(Math.hypot(o.x-pr.x, (o.y-o.h*0.4)-pr.y) < pr.r+o.r){
        smashDecor(o);
        pr.dead=true;   // arrow stops in the prop it hits (no piercing)
        break;
      }
    }
  }
  G.projectiles = G.projectiles.filter(pr=>!pr.dead);
}
function drawProjectiles(ctx){
  for(const pr of G.projectiles){
    const ang=Math.atan2(pr.vy,pr.vx);
    ctx.save();
    ctx.translate(pr.x,pr.y); ctx.rotate(ang);
    // v77: premium arrow/bolt glow — a soft additive streak behind the shaft in
    // the weapon's glow colour, so a Sunfire arrow reads as a bright comet.
    if(pr.glow){
      ctx.save();
      ctx.globalCompositeOperation='lighter';
      const gp = 0.55 + 0.45*Math.sin(performance.now()/70);
      ctx.globalAlpha = 0.5*gp;
      ctx.fillStyle = pr.glow;
      ctx.fillRect(-22,-2.5,30,5);
      ctx.globalAlpha = 0.8*gp;
      ctx.fillStyle = _fxWhite(pr.glow,0.5);
      ctx.fillRect(-16,-1.5,24,3);
      ctx.restore();
    }
    // v67 T11: arrow follows the equipped weapon's fxColor (marketplace) —
    // shaft = weapon color darkened toward the old wood tone, head = a
    // near-white of the weapon color. No weapon color -> old static palette.
    ctx.fillStyle=pr.color ? _hexMix(pr.color,'#c98a4a',0.45) : '#c98a4a';
    ctx.fillRect(-12,-1.5,20,3);           // shaft
    ctx.fillStyle=pr.color ? _fxWhite(pr.color,0.4) : '#eafff5';
    ctx.beginPath();                       // arrowhead
    ctx.moveTo(10,0); ctx.lineTo(3,-4); ctx.lineTo(3,4); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#8a6a3a';
    ctx.fillRect(-14,-3,3,2); ctx.fillRect(-14,1,3,2); // fletching
    ctx.restore();
  }
}

// ---- combat resolution ----
// v77: hits-to-kill damage. When a marketplace weapon is equipped, each swing
// deals a FIXED FRACTION of the enemy's max HP so a normal enemy always dies in
// exactly `htk` hits (4 cheap / 3 mid / 2 top), regardless of its raw HP or the
// player's level. Bosses & elites are tankier (they take HTK_BOSS_MUL / _ELITE
// times as many hits). Unarmed keeps the old flat atkDmg. `extraHits` from
// triple/double behaviours still stack on top, so those weapons over-perform
// their base htk on a single target — intended, that's their gimmick.
const HTK_BOSS_MUL = 6;    // a boss eats ~htk*6 swings
const HTK_ELITE_MUL = 2.2; // an elite ~htk*2.2
// Behaviours that land more than one hit per swing. htk counts TOTAL hits to
// kill, so a double/triple weapon's per-hit damage is divided by its hit count
// — otherwise ancient_blade (2 hits) and void_katana (3 hits) would kill in
// half / a third of their intended swings and trivialise everything.
function _hitsPerSwing(p){
  const b = p._weaponBehavior;
  return b==='triple_slash' ? 3 : (b==='double_hit' ? 2 : 1);
}
function _weaponDmgFor(e, p){
  const htk = p._weaponHtk;
  if(!htk) return null;                       // unarmed -> caller uses flat dmg
  const mul = e.isBoss ? HTK_BOSS_MUL : (e.elite ? HTK_ELITE_MUL : 1);
  const hps = _hitsPerSwing(p);
  // total hits to kill = htk*mul; damage each hit = maxHp / (htk*mul).
  // Follow-up hits in hitTest are dealt at 0.7x, so solve for a base b with
  // 1 + 0.7*(hps-1) effective hits per swing, giving htk swings overall.
  const effPerSwing = 1 + 0.7*(hps-1);
  const swings = (htk*mul);
  const perHit = Math.ceil(e.maxHp / (swings*effPerSwing) * 1.0) ;
  // tiny ±8% jitter so the damage numbers don't look robotic
  return Math.max(1, Math.round(perHit * (0.96 + Math.random()*0.16)));
}
function hitTest(){
  const p=G.player;
  const z=p.hitZone();
  if(z){
    // v76 Task #7: each weapon has its own attack sound (NS_WEAPON.sfx, set on
    // the player by applyEquipment). Unarmed -> the original generic whoosh.
    A.attackFor(p._weaponSfx || null, p._wpnTier || 1);
    // Equipped-weapon behavior modifiers (Marketplace items). z.dmg already
    // includes the weapon's flat atkBonus via applyEquipment(); these tune the
    // *feel*: bigger reach (aoe), heavier knockback, and extra rapid hits
    // (double/triple slash).
    const beh = p._weaponBehavior || null;
    if(beh==='ranged' || beh==='volley'){
      // Ranged weapons fire a projectile INSTEAD of a melee hitbox — no phantom
      // melee hit alongside the shot. Decor-smashing happens on the projectile
      // (updateProjectiles(), v65 T3), not via a melee sweep here.
      //   ranged  — Ironbolt Crossbow: one heavy bolt dead on aim.
      //   volley  — Sunfire Longbow ($15, top of the ladder): a three-arrow fan.
      //             Side arrows carry 55% damage so the fan is a coverage perk,
      //             not a flat 3x nuke; a target dead-centre can still eat all
      //             three at close range, which is what a $15 weapon should do.
      // htk damage is resolved per-enemy on projectile impact (updateProjectiles
      // reads p._weaponHtk via _weaponDmgFor), so here we only pass the fallback
      // flat dmg for the unarmed/legacy path.
      if(beh==='volley'){
        spawnProjectile(p, z.dmg+(Math.random()*6|0), 0, 1);
        const side = Math.round(z.dmg*0.55);
        spawnProjectile(p, side, -0.20, 0.55);
        spawnProjectile(p, side,  0.20, 0.55);
      } else {
        spawnProjectile(p, z.dmg+(Math.random()*6|0));
      }
    } else {
      let any=false;
      // cleave (Argent Waraxe): a broad bite — wider than a sword, tighter than
      // a scythe's full reap, and it hits EVERY enemy in the arc rather than
      // stacking extra hits on one.
      const radiusMul = beh==='aoe' ? 1.8 : (beh==='cleave' ? 1.45 : (beh==='knockback' ? 1.15 : 1));
      const extraHits = beh==='triple_slash' ? 2 : (beh==='double_hit' ? 1 : 0);
      const reach = z.r * radiusMul;
      for(const e of G.enemies){
        if(e.dead) continue;
        if(Math.hypot(e.x-z.x,e.y-z.y) < reach+e.r){
          const dmg = _weaponDmgFor(e, p) != null ? _weaponDmgFor(e, p) : (z.dmg+(Math.random()*6|0));
          let killed=applyHitToEnemy(e, dmg, p.x, p.y, beh);
          for(let h=0; h<extraHits && !killed; h++){
            const d2=Math.max(1,Math.round(dmg*0.7));
            killed=applyHitToEnemy(e, d2, p.x, p.y, beh);
            dmgNum(e.x+8*(h+1), e.y-e.r-8*(h+1), d2);
          }
          // Frost Spear: apply/refresh a temporary slow debuff on hit.
          // Enemy.update() (entities.js) reads _slowMul/_slowT and ticks the
          // timer down; refreshing on repeated hits is fine, but the
          // multiplier itself does not stack multiplicatively — it's just
          // reapplied at the same strength each hit.
          if(beh==='slow' && !e.dead){
            const M = window.NS_MARKET;
            const w = (M && G.equipment.equipped.mainhand) ? M.getEquipment(G.equipment.equipped.mainhand) : null;
            const slowPct = (w && w.effect && w.effect.slowPct) || 0.5;
            e._slowMul = 1 - slowPct;
            e._slowT = 3.0;
          }
          any=true;
        }
      }
      if(any===false){ /* swing missed enemies */ }
      // breakable decorations caught in the same swing (skip interactive containers)
      for(const o of G.decor){
        if(o.broken || o.interactive || o.ambient) continue;  // ambient = scenery, never smashable
        if(Math.hypot(o.x-(z.x), (o.y-o.h*0.4)-z.y) < z.r+o.r){
          smashDecor(o);
        }
      }
    }
  }
  // enemies hitting player
  for(const e of G.enemies){
    if(e.dead) continue;
    let wd=e.takeWantHit?e.takeWantHit():0;
    // ANTI-BURST (owner: enemy damage bursts your HP away instead of draining
    // it — no time to run, eat food, or smash props for HP). Cap ANY single
    // hit at 22% of max HP: combined with the ~0.7s i-frame after each hit,
    // that's at least ~5 hits (several seconds) before death, so your health
    // goes down gradually and you always have a window to react. Normal light
    // enemies rarely reach this cap, so it mainly tames the casters + heavy
    // hitters + deep-floor scaling that were doing the bursting.
    if(wd>0){ wd = Math.min(wd, Math.ceil(p.maxHp*0.22)); }
    if(wd>0){
      if(p.hurt(wd)){
        dmgNum(p.x,p.y-30,wd); A.hurt(); G.shake=Math.min(G.shake+4,8); // was +7,12 — punch list #10, v38
        spark(p.x,p.y-10,'#ff3b5c',8,120);
        updateHUD();
        if(p.hp<=0) gameOver();
      }
    }
  }
}

function onEnemyKilled(e){
  A.enemyDeath();
  CONTRACT_KILLS++;   // Daily Contracts §5.2 — batched, see flushContractKills
  // Enhanced death effects (Phase 5)
  const _fxK = window.NS_FX;
  const _shakeCfgK = (window.NS_MONSTER_CONFIG||{}).shake || {};
  const _partCfgK  = (window.NS_MONSTER_CONFIG||{}).particles || {};
  if (_fxK) {
    const count = e.isBoss ? (_partCfgK.bossKill||60) : (_partCfgK.death||28);
    _fxK.particleBurst(G.particles, e.x, e.y-10, e.arch.color, count, 220);
    _fxK.particleShower(G.particles, e.x, e.y-10, '#fffbe0', Math.floor(count*0.4), 150);
  } else {
    spark(e.x,e.y-10,e.arch.color,22,200);
  }
  // Flicker fix (see applyHitToEnemy): an aoe swing can kill several enemies in
  // one frame; adding death-shake per kill re-pinned G.shake and re-jittered the
  // camera. Gate the ordinary death shake to once per ~0.1s window; a BOSS kill
  // always shakes (it's the big moment).
  const _shakeK = e.isBoss ? (_shakeCfgK.bossKill||28) : (_shakeCfgK.enemyDeath||8);
  const _nowK = (typeof performance!=='undefined' ? performance.now() : Date.now())/1000;
  if(e.isBoss || (_nowK - (G._lastKillShakeT||0) > 0.1)){
    G._lastKillShakeT = _nowK;
    G.shake=Math.min(G.shake+_shakeK,18); // cap was 24 — punch list #10, v38
  }
  const p=G.player;
  p.kills++;
  const ups=p.gainXp(e.xp);
  log(`${e.arch.name} purged. +${e.xp} XP`, 'reward');
  if(ups>0){ A.levelup(); log(`◆ LEVEL UP → ${p.level}. Crit chance ${Math.round((p.critChance||0)*100)}% · fully healed.`,'reward');
    spark(p.x,p.y-20,'#00ff88',30,220); applyEquipment(p); }
  G.combo.count = (G.combo.t>0 ? G.combo.count+1 : 1);
  G.combo.t = 3.2;
  if(G.combo.count>=3){
    const bonus=Math.min(25, G.combo.count*3);
    const up2=p.gainXp(bonus);
    lootText(p.x,p.y-36,`COMBO x${G.combo.count} +${bonus} XP`,'#ffd166');
    if(up2>0) A.levelup();
  }
  if(e.elite && Math.random()<0.65) applyLoot('relic',1,e.x,e.y-e.r);
  // Phase 2: Glitch Shard combat drops. Tuned to the blueprint's "a clean
  // run lands at ~60-80% of one tier upgrade" target (assuming a ~10-shard
  // tier cost in Phase 4): normal kills 22%, elites always 1, bosses 4.
  if(e.isBoss) applyLoot('gshard',4,e.x,e.y-e.r);
  else if(e.elite) applyLoot('gshard',1,e.x,e.y-e.r);
  else if(Math.random()<0.22) applyLoot('gshard',1,e.x,e.y-e.r);
  updateHUD();
  checkFloorClearReward();
  if(e.isBoss){
    G.bossAlive=false;
    if(abyssMode){
      // NULL ABYSS: a boss floor is just a gate — clearing it opens the lift
      // to go deeper, forever. No act exit, no vault. The lift (openLift,
      // uncapped for abyss) handles the descent.
      setTimeout(()=>{ log('The Abyss guardian shatters. The floor gives way — descend.', 'reward'); }, 700);
    } else if(G.depth>=5){
      // Bunker 5 "THE LAST LIGHT" (campaignActIndex===4): don't auto-exit to
      // the outdoor scene like every other bunker's boss floor does. Spawn
      // the weekly Vault door instead and wait for the player to open it —
      // onActBunkerCleared() only fires once they close that overlay (see
      // closeVaultWindow()). Confirmed placement by Ward (v27): appears
      // right after the boss dies, on the boss floor itself.
      const _actIdx = campaignActIndex; // v65 T6: read the module var directly — no window.__NS round-trip needed inside game.js itself
      if(_actIdx===4){
        // v65 T6: the vault door was already placed when this floor loaded
        // (ensureFloor()) — it just couldn't be opened while the boss was
        // alive (isRoomClear() gate). No spawn call here anymore; only the
        // flavor beat that it's now unlocked.
        setTimeout(()=>{ log('The sealed door at the far wall hums to life — something reacts to your keys.', 'reward'); }, 700);
      } else {
        setTimeout(()=>onActBunkerCleared(),700);
      }
    } else {
      setTimeout(()=>cutscene(Story.bossDown),700);
    }
  }
}

// Bunker 5 boss-floor Vault door: see placeVaultDoorSpot() + ensureFloor()
// for spawn/placement (v65 T6 — moved from a post-boss-death spawn to
// floor-load time, and from a stairs-relative offset to a proper wall-snap
// placement inside the boss room).

// ---- camera ----
const cam={x:0,y:0};
function updateCam(){
  cam.x=G.player.x; cam.y=G.player.y;
  const halfW=cw/2/zoom, halfH=ch/2/zoom;
  cam.x=Math.max(halfW,Math.min(G.dun.pxW-halfW,cam.x));
  cam.y=Math.max(halfH,Math.min(G.dun.pxH-halfH,cam.y));
}

// ---- nameplates (elite/boss labels) ----
// Drawn in screen-space AFTER the zoom/camera transform is popped, and
// clamped to stay inside the canvas, so they never clip off the edge on
// narrow phone viewports (the old code drew them in world-space, which
// clipped at the screen edge whenever an elite stood near the camera bound).
let _nameplateQ = [];
window.NS_QUEUE_NAMEPLATE = (enemy, worldAboveY) => {
  _nameplateQ.push({ name: enemy.name, isBoss: enemy.isBoss, wx: enemy.x, wy: worldAboveY });
};
function drawNameplates(sx, sy){
  if(!_nameplateQ.length) return;
  ctx.save();
  ctx.font = '11px "Share Tech Mono"';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  for(const n of _nameplateQ){
    const sxp = (n.wx-cam.x)*zoom + cw/2 + sx;
    const syp = (n.wy-cam.y)*zoom + ch/2 + sy;
    const half = ctx.measureText(n.name).width/2 + 6;
    const cx = clamp(sxp, half, cw-half);
    const cy = clamp(syp, 14, ch-6);
    ctx.fillStyle = n.isBoss ? '#ffb347' : '#ffd166';
    ctx.fillText(n.name, cx, cy);
  }
  ctx.restore();
  _nameplateQ = [];
}

// ---- render ----
function render(){
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,cw,ch);
  // Fase 4: in-dungeon the out-of-bounds void must read as PURE BLACK fog
  // (#000) so anything beyond the walls is swallowed completely; the softer
  // navy clear stays for the outdoor scene only.
  ctx.fillStyle=(typeof Outdoor!=='undefined' && Outdoor.active())?'#04060a':'#000000';
  ctx.fillRect(0,0,cw,ch);

  if(Outdoor.active()){
    // #7 FIX (this session): this used to call resetInput() on EVERY
    // render frame (render() runs every rAF tick, right after update()).
    // The touch stick writes input.left/right/up/down CONTINUOUSLY while
    // held (see setupTouch()'s touchmove handler), so zeroing them again a
    // moment later meant the NEXT frame's Outdoor.update() only saw
    // movement input on frames where a touchmove event happened to land
    // in between — otherwise it read 0 and the character stopped, then
    // resumed on the next touchmove. That is exactly the "gerakan ke kanan
    // patah-patah" (choppy movement) symptom. It also snapped the visual
    // nub back to dead-center every single frame while the player was
    // actively dragging it, fighting the touchmove handler's own nub
    // positioning.
    // resetInput() is still correct to call ONCE at the moment Outdoor
    // mode is entered, so no stale dungeon input (e.g. a held attack)
    // leaks in — that now happens at the two Outdoor.enter() call sites
    // instead (enterOutdoorAct() / onActBunkerCleared()), not here on
    // every frame.
    const bgKey = Outdoor.currentBgKey ? Outdoor.currentBgKey() : null;
    const bgImg = bgKey ? img(BG_BY_KEY[bgKey]) : null;
    Outdoor.render(ctx, cw, ch, bgImg);
    return;
  }

  if(!G){ return; }

  // Screen shake — punch list #10 fix (v38). Previously re-randomized the
  // full offset EVERY frame with no interpolation at all, which read as a
  // harsh flicker/jolt rather than a shake (worse the higher G.shake got —
  // see the reduced magnitude caps in monster-config.js, also part of this
  // fix). Now it lerps toward a new random target only every few frames,
  // so it reads as an actual wobble. SHAKE_ENABLED lets a player turn it
  // off entirely from Settings (accessibility — some players are just
  // sensitive to this kind of motion) without touching G.shake itself, so
  // the hit-stop/knockback/particle feedback tied to the same events is
  // untouched either way.
  G._shakeTX = G._shakeTX || 0; G._shakeTY = G._shakeTY || 0;
  G._shakeOX = G._shakeOX || 0; G._shakeOY = G._shakeOY || 0;
  if(G.shake>0){
    if(Math.random()<0.4){
      G._shakeTX = (Math.random()*2-1)*G.shake;
      G._shakeTY = (Math.random()*2-1)*G.shake;
    }
  } else {
    G._shakeTX = 0; G._shakeTY = 0;
  }
  G._shakeOX += (G._shakeTX - G._shakeOX) * 0.4;
  G._shakeOY += (G._shakeTY - G._shakeOY) * 0.4;
  const sx = SHAKE_ENABLED ? G._shakeOX : 0;
  const sy = SHAKE_ENABLED ? G._shakeOY : 0;
  ctx.save();
  ctx.translate(cw/2+sx, ch/2+sy);
  ctx.scale(zoom,zoom);
  ctx.translate(-cam.x,-cam.y);

  drawTiles();
  drawTorchSconces();
  drawObjectiveTrail();
  drawStairs();

  // entities + decor painter-sorted by y — cull anything sitting in a
  // room the player hasn't visited yet, so nothing leaks through the
  // solid-black fog-of-war ahead of actually walking in.
  const d=G.dun;
  const ents=[G.player, ...G.enemies, ...G.decor]
    .filter(e => e===G.player || isTileVisited(d, (e.x/TILE)|0, (e.y/TILE)|0))
    .sort((a,b)=>a.y-b.y);
  for(const e of ents){
    try{ e.draw(ctx); }
    catch(err){
      // A single bad draw call (bad sprite config, NaN position, etc.)
      // must never abort the loop — that used to mean every entity
      // sorted after the failing one, including the player, silently
      // never got drawn for the rest of that frame.
      if(!G._drawErrLogged){ G._drawErrLogged=true; console.error('[NullState] entity draw failed', err); }
    }
  }

  // v77: premium on-hit rings (expanding coloured flash on the enemy)
  if(G.rings && G.rings.length){
    for(const r of G.rings){
      const k = r.t / r.dur;                 // 0..1
      const rad = r.r0 + (r.r1 - r.r0) * k;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = (1 - k) * 0.7;
      ctx.strokeStyle = r.col;
      ctx.lineWidth = Math.max(1, 3 * (1 - k));
      ctx.beginPath(); ctx.arc(r.x, r.y, rad, 0, Math.PI*2); ctx.stroke();
      ctx.restore();
    }
  }
  drawProjectiles(ctx);

  // Second wall pass: the wall block directly south of the player is
  // re-drawn ON TOP of the sprites at low alpha, so walking behind a tall
  // wall softly occludes the hero instead of the sprite floating over it.
  drawWallOcclusion();

  drawParticles();
  drawDmgNums();

  ctx.restore();

  drawNameplates(sx, sy);
  drawDarkness(sx,sy);
  drawVignette();
  drawMinimap();
  if(G.ultiFlash>0){
    const a=Math.min(0.7, G.ultiFlash);
    const g=ctx.createRadialGradient(cw/2,ch/2,0,cw/2,ch/2,Math.max(cw,ch)*0.7);
    g.addColorStop(0,`rgba(255,200,80,${a})`); g.addColorStop(1,`rgba(255,120,0,0)`);
    ctx.fillStyle=g; ctx.fillRect(0,0,cw,ch);
  }
}

// Wall block height (px) — gives walls visual volume instead of a thin line,
// which is also what lets us fade a wall when it would visually cover the
// player standing behind it (see drawWallFaces below).
const WALL_H = 30;

// ---- Fase 4: procedural ancient-stone wall textures (WORLD-ANCHORED) ----
// One small seamless texture canvas per theme+face, generated once and used
// as a repeating ctx pattern. Patterns are filled while the camera transform
// is active, so the masonry is anchored to the WORLD grid, not to each tile:
// every adjacent wall tile continues the exact same stone/brick pattern with
// zero seams ("antar tembok sinkron"), however long the wall run is and
// wherever the camera sits. Texture tile is 120px = 3*TILE, and the slab
// joints are spaced exactly TILE apart, so joints wrap perfectly AND land on
// the tile grid.
const _wallTexCache = {};
function _wtHash(x,y){ let h=(x*374761393 + y*668265263)|0; h=Math.imul(h^(h>>>13),1274126177); return (h^(h>>>16))>>>0; }
function _wtRGB(hx){ const n=parseInt(hx.slice(1),16); return [n>>16&255, n>>8&255, n&255]; }
function wallTex(theme){
  const key = theme.key || 'default';
  if(_wallTexCache[key]) return _wallTexCache[key];
  const rgb = _wtRGB(theme.wallFill);
  // Reference-style masonry (user review, Fase 4): walls must read as
  // clearly visible light-stone brickwork, NOT dark slabs. Theme wallFill
  // colors are intentionally dark (they were flat fills before), so the
  // stone color is LIFTED toward a warm khaki stone while keeping each
  // act's hue: lerp(wallFill -> stone) per face.
  const STONE=[164,156,138];
  const lerp=(t)=>[0,1,2].map(i=> rgb[i]+(STONE[i]-rgb[i])*t );
  const shadeL=(base,f)=>{
    const c=v=>Math.max(0,Math.min(255,(v*f)|0));
    return `rgb(${c(base[0])},${c(base[1])},${c(base[2])})`;
  };
  const S = TILE*3; // 120 — multiple of TILE so courses wrap on the grid
  const MORTAR='rgba(24,20,16,0.9)';

  // Rounded-stone brick courses, seamless: fixed geometry (rows of 20px,
  // bricks of 40px offset half-brick per course — geometry wraps exactly),
  // randomness lives ONLY in per-brick shade (hash-driven, deterministic).
  function masonry(cv, lift, rough){
    const c=cv.getContext('2d');
    const base=lerp(lift);
    c.fillStyle=MORTAR; c.fillRect(0,0,cv.width,cv.height);
    const rowH=20, brickW=TILE;
    for(let ry=0, r=0; ry<cv.height; ry+=rowH, r++){
      const off=(r%2)?brickW/2:0;
      for(let x=-brickW; x<cv.width+brickW; x+=brickW){
        const bx=x+off;
        const h=_wtHash(((bx%S)+S)%S, r*17+key.length);
        const f=0.88 + (h%26)/100;                 // per-stone tonal variance
        c.fillStyle=shadeL(base, f);
        _wtRounded(c, bx+1.5, ry+1.5, brickW-3, rowH-3, 5);
        // top-light / bottom-shade bevel on each stone (reads as rounded);
        // highlight strength follows the face's lift so the dark-grey outer
        // face keeps its deep tone instead of being washed out.
        c.fillStyle='rgba(255,255,255,'+(0.06+lift*0.15).toFixed(3)+')';
        c.fillRect(bx+4, ry+2.5, brickW-8, 2);
        c.fillStyle='rgba(0,0,0,0.20)';
        c.fillRect(bx+4, ry+rowH-4.5, brickW-8, 2);
        // occasional crack / chip
        if(rough && (h%7)===0){
          c.strokeStyle='rgba(0,0,0,0.30)'; c.lineWidth=1;
          c.beginPath(); c.moveTo(bx+8+(h%12), ry+3);
          c.lineTo(bx+12+(h%10), ry+rowH-4); c.stroke();
        }
      }
    }
  }

  // TOP face (sisi luar dinding): abu-abu TUA — sengaja jauh lebih gelap
  // dari front face (user review) supaya bagian luar dinding dan dinding
  // dalam yang kena cahaya obor tidak menyatu warnanya.
  const top = document.createElement('canvas'); top.width = top.height = S;
  masonry(top, 0.16, true);

  // FRONT face: brightest (torch-lit vertical wall), plus a soft top-lit
  // vertical gradient.
  const front = document.createElement('canvas'); front.width = S; front.height = WALL_H;
  masonry(front, 0.58, false);
  {
    const c=front.getContext('2d');
    const gr=c.createLinearGradient(0,0,0,WALL_H);
    gr.addColorStop(0,'rgba(255,255,255,0.10)');
    gr.addColorStop(1,'rgba(0,0,0,0.22)');
    c.fillStyle=gr; c.fillRect(0,0,S,WALL_H);
  }

  // Return RAW canvases + drawImage source-offsets (world-anchored), NOT
  // ctx patterns: CanvasPattern + ctx.translate anchoring differs between
  // canvas implementations (this exact mismatch rendered front faces as a
  // black band). drawImage with an explicit source rect behaves identically
  // everywhere. S is a multiple of TILE, so one face is always ONE blit —
  // a tile-aligned source rect can never straddle the texture wrap.
  const out = { top, front, S };
  _wallTexCache[key] = out;
  return out;
}
function _wtRounded(c,x,y,w,h,r){
  c.beginPath();
  c.moveTo(x+r,y); c.lineTo(x+w-r,y); c.quadraticCurveTo(x+w,y,x+w,y+r);
  c.lineTo(x+w,y+h-r); c.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  c.lineTo(x+r,y+h); c.quadraticCurveTo(x,y+h,x,y+h-r);
  c.lineTo(x,y+r); c.quadraticCurveTo(x,y,x+r,y);
  c.closePath(); c.fill();
}

// Door tile rendering: real sprite (Mystic Woods wooden door, 2 frames —
// closed/open), opens when the player is near it. Falls back to a plain
// outlined tile if the sprite image hasn't finished loading yet.
function drawDoorTile(px,py,tx,ty){
  const p=G.player;
  const distTiles = Math.hypot((tx+0.5)-(p.x/TILE), (ty+0.5)-(p.y/TILE));
  const theme = G.dungeonTheme || DUNGEON_THEMES.bluestone;
  const doorSet = DECOR_SPRITES[theme.door] || DECOR_SPRITES.doorIron;
  // 5-frame closed->open sprite, indexed by proximity so the door visibly
  // swings open as the player approaches and shut again as they leave.
  const frame = Math.max(0, Math.min(4, Math.round((1.5-distTiles)*3)));
  const im = img(`${doorSet.src}/frame_${frame}.png`);
  // The sprite sheet is drawn for a door set into a horizontal (N/S) wall.
  // On an E/W wall the gap runs vertically, so the same art would sit flat
  // against a wall it doesn't belong to — rotate it 90° so it "stands" in
  // the vertical gap instead of always rendering in the N/S orientation.
  // Punch list #2 (v39): drawTiles() now routes E/W door tiles to a plain
  // floor render and never calls this function for them (see drawTiles
  // above) — the vertical/rotate branch below is dead in practice but kept
  // as a defensive fallback in case a future caller passes one in directly.
  // v73 (user finding #4 — "pintu melayang/tergeletak"): the art is TRUE
  // top-down, so it must sit FLAT inside its own tile. The old render (a)
  // shifted it 8px up "for an arch" and (b) painted a solid wallFill square
  // behind it — in bunkers whose wall/floor palette contrasts hard, that
  // combo read as a door sprite hovering off the grid / lying on the floor
  // next to the wall. Now: real floor is drawn beneath (so transparent
  // corners of the frame show floor, not a wall-colored patch), and the
  // sprite is blitted exactly on the tile bounds. The rotate-90° branch for
  // vertical walls is gone entirely — drawTiles() never routes E/W doors
  // here anymore (they render as plain floor, see the t===3 block).
  if(im){
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    drawFloorTile(px,py,tx,ty,theme,G.dun ? G.dun.roomAt(tx,ty) : null);
    ctx.drawImage(im, px, py, TILE, TILE);
    ctx.restore();
    return;
  }
  // fallback: flat lit gap, in case the sprite hasn't loaded yet
  const open = distTiles < 1.3;
  drawFloorTile(px,py,tx,ty,theme,G.dun ? G.dun.roomAt(tx,ty) : null);
  ctx.fillStyle = open ? '#02060a' : '#0e1c24';
  ctx.fillRect(px+4, py+4, TILE-8, TILE-8);
  ctx.fillStyle = open ? 'rgba(0,255,136,.45)' : 'rgba(0,255,136,.25)';
  ctx.fillRect(px+4, py+4, TILE-8, 2);
  ctx.fillRect(px+4, py+TILE-6, TILE-8, 2);
}

function drawTiles(){
  const d=G.dun;
  const x0=Math.max(0,((cam.x-cw/2/zoom)/TILE|0)-1);
  const x1=Math.min(d.W,((cam.x+cw/2/zoom)/TILE|0)+2);
  const y0=Math.max(0,((cam.y-ch/2/zoom)/TILE|0)-2); // extra row above for tall walls
  const y1=Math.min(d.H,((cam.y+ch/2/zoom)/TILE|0)+2);

  // Mark rooms the player is currently standing in (and their connected
  // corridor cells) as visited, so fog-of-war reveals them permanently.
  markVisited(d);

  for(let y=y0;y<y1;y++){
    for(let x=x0;x<x1;x++){
      const t=d.grid[y][x];
      const px=x*TILE, py=y*TILE;
      if(t===0){ continue; } // void = unlit, nothing to draw
      if(!isTileVisited(d,x,y)){
        // Q11 (v72, user decision): unexplored areas are no longer a flat
        // near-black silhouette — the REAL floor texture is rendered, then
        // dimmed ~70% with a cool overlay. The room stays clearly "not yet
        // entered" (dim + desaturated-cold) but is readable, and walking
        // toward it lets the player's carried light (drawDarkness bounce)
        // warm it up before the visited-flag flips it to full brightness.
        // Entities/loot in unvisited rooms still stay hidden (culled in the
        // entity draw pass) so nothing is spoiled.
        const theme = G.dungeonTheme || DUNGEON_THEMES.bluestone;
        drawFloorTile(px,py,x,y,theme,d.roomAt(x,y));
        ctx.fillStyle = 'rgba(4,8,14,0.70)'; ctx.fillRect(px,py,TILE,TILE);
        continue;
      }
      if(t===3){
        // v73 rework (user finding #4, supersedes the v39 side-based check):
        // door tiles are now qualified from the GRID itself, not the stored
        // side tag — the sprite only renders when the tile is a clean
        // single-tile gap in a horizontal wall, which is the one geometry
        // the (true top-down, N/S) door art was drawn for:
        //   • passage must run vertically (floor directly N AND S), and
        //   • both E and W neighbours must still be WALL (a real 1-tile
        //     doorway). If either side neighbour is also floor/door, the
        //     opening is WIDER than one tile — there is no wide-door asset
        //     in the project (all door sets are 32×32 single-tile), so per
        //     user decision wide openings get NO door at all instead of a
        //     lone half-width door floating in the gap.
        // Vertical-wall (E/W) doors keep the v39 behavior: plain floor.
        const _fl=(ax,ay)=> ax>=0&&ay>=0&&ax<d.W&&ay<d.H&&d.grid[ay][ax]!==0;
        const passNS = _fl(x,y-1) && _fl(x,y+1);
        const sideOpen = _fl(x-1,y) || _fl(x+1,y);
        if(passNS && !sideOpen){
          drawDoorTile(px,py,x,y);
        } else {
          const theme = G.dungeonTheme || DUNGEON_THEMES.bluestone;
          drawFloorTile(px,py,x,y,theme,d.roomAt(x,y));
        }
        continue;
      }
      // floor — colored per the current act's dungeon theme
      const theme = G.dungeonTheme || DUNGEON_THEMES.bluestone;
      drawFloorTile(px,py,x,y,theme,d.roomAt(x,y));
    }
  }
  drawRoomLighting(x0,x1,y0,y1);
  drawWallFaces(x0,x1,y0,y1);
}

// v76 #6 (user pick: kandidat B — pebble_brown, Dungeon Crawl 32x32 tiles,
// OpenGameArt, CC0; sumber https://opengameart.org/content/dungeon-crawl-32x32-tiles):
// baked per-theme strips at /sprites/floors/pebble_<theme>.png, 12 tiles
// of 40px each — [0..8] recolored base variants, [9..10] mossy, [11]
// cracked. Recoloring was done OFFLINE (PIL) onto each theme's
// floorA/floorB palette, so at runtime this is a single drawImage per
// tile — no filters, no tinting. Until the strip decodes (or if it ever
// 404s) the old flat-color floor below still renders, so the dungeon is
// never blank.
const _floorStrips={};
function _floorStrip(themeKey){
  let rec=_floorStrips[themeKey];
  if(!rec){
    const im=new Image();
    im.src='/sprites/floors/pebble_'+themeKey+'.png';
    rec=_floorStrips[themeKey]={im,ok:false};
    im.onload=()=>{ rec.ok=true; };
  }
  return rec.ok ? rec.im : null;
}
function drawFloorTile(px,py,x,y,theme,room){
  const h=(x*928371 + y*689287)>>>0;
  const strip=_floorStrip(theme.key);
  if(strip){
    // Variant choice is DETERMINISTIC and spatially coherent: the base
    // variant hashes the 2x2 CLUSTER (x>>1,y>>1) so neighbouring tiles
    // share stonework and the floor reads as one continuous surface
    // (user requirement: variasi tapi SINKRON antar tile, gradasi
    // nyambung), with the per-tile hash only nudging it +0/+1 so
    // clusters still don't tile visibly.
    const ch=(((x>>1)*73856093) ^ ((y>>1)*19349663))>>>0;
    let idx=(ch%9);
    if((h%3)===0) idx=(idx+1)%9;
    if(room && room.vibe==='moss' && (h%4)===0) idx=9+(h%2);   // mossy tiles
    else if((h%17)===0) idx=11;                                 // cracked slab
    ctx.drawImage(strip, idx*40,0,40,40, px,py,TILE,TILE);
    if(room && room.vibe==='cave'){
      ctx.fillStyle=theme.dirtA; ctx.globalAlpha=0.30;
      ctx.beginPath(); ctx.ellipse(px+TILE*0.5,py+TILE*0.55, TILE*(0.25+((h%7)/30)), TILE*0.16, 0, 0, 7); ctx.fill();
      ctx.globalAlpha=1;
    }
    return;
  }
  // ---- fallback: original flat floor (pre-decode / missing asset) ----
  const shade=((x+y)%2===0)?theme.floorA:theme.floorB;
  ctx.fillStyle=shade; ctx.fillRect(px,py,TILE,TILE);
  if(room && room.vibe==='cave'){
    ctx.fillStyle=theme.dirtA; ctx.globalAlpha=0.22;
    ctx.beginPath(); ctx.ellipse(px+TILE*0.5,py+TILE*0.55, TILE*(0.25+((h%7)/30)), TILE*0.16, 0, 0, 7); ctx.fill();
    ctx.globalAlpha=1;
  } else {
    ctx.strokeStyle='rgba(0,0,0,0.16)'; ctx.lineWidth=1;
    ctx.strokeRect(px+0.5,py+0.5,TILE-1,TILE-1);
    if((h%9)===0){ ctx.fillStyle=theme.floorSpeckle; ctx.fillRect(px+TILE/2-1,py+TILE/2-1,2,2); }
    if((h%17)===0){ ctx.fillStyle=theme.crack; ctx.fillRect(px+8,py+20,18,2); ctx.fillRect(px+24,py+22,2,7); }
    if(room && room.vibe==='moss' && (h%5)===0){ ctx.fillStyle=theme.moss; ctx.fillRect(px+2,py+TILE-7,12,3); ctx.fillRect(px+6,py+TILE-11,7,3); }
  }
}

// Soft overhead-lamp glow centered on each visited room (and a gentler
// glow along visited corridor tiles), drawn on top of the flat floor color
// so rooms/corridors read as lit, walkable spaces — distinct from the dark
// solid walls drawn afterward in drawWallFaces.
function drawRoomLighting(x0,x1,y0,y1){
  const d=G.dun;
  const theme = G.dungeonTheme || DUNGEON_THEMES.bluestone;
  ctx.save();
  ctx.globalCompositeOperation='lighter';
  for(const r of d.rooms){
    if(!r.visited) continue;
    if(r.x+r.w<x0-2 || r.x>x1+2 || r.y+r.h<y0-2 || r.y>y1+2) continue; // outside viewport, skip
    const cx=(r.cx+0.5)*TILE, cy=(r.cy+0.5)*TILE;
    const rad=Math.max(r.w,r.h)*TILE*0.62;
    const g=ctx.createRadialGradient(cx,cy,0, cx,cy,rad);
    g.addColorStop(0,theme.roomGlow);
    g.addColorStop(0.6,theme.corridorGlow);
    g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g;
    ctx.fillRect(r.x*TILE-TILE, r.y*TILE-TILE, (r.w+2)*TILE, (r.h+2)*TILE);
  }
  // gentle ambient strip along visited corridor tiles (non-room floor)
  for(let y=y0;y<y1;y++){
    for(let x=x0;x<x1;x++){
      if(d.grid[y][x]===0 || d.grid[y][x]===2) continue;
      if(d.roomAt(x,y)) continue; // rooms already got the glow above
      if(!isTileVisited(d,x,y)) continue;
      ctx.fillStyle=theme.corridorGlow;
      ctx.fillRect(x*TILE, y*TILE, TILE, TILE);
    }
  }
  // warm torch pools only in explored corridor/room edges.
  for(const l of d.lamps||[]){
    if(l.tx<x0-2||l.tx>x1+2||l.ty<y0-2||l.ty>y1+2) continue;
    if(!isTileVisited(d,l.tx,l.ty)) continue;
    const flick=0.78+0.22*Math.sin(G.time*8 + l.tx*0.9 + l.ty*0.4);
    // v73 (user finding #5): pool hugs the floor at the base of the wall the
    // torch is now mounted on, so light visibly falls FROM the sconce.
    let cx=(l.tx+0.5)*TILE, cy=(l.ty+0.5)*TILE;
    if(l.side==='N') cy=(l.ty+0.30)*TILE;
    else if(l.side==='S') cy=(l.ty+0.72)*TILE;
    else if(l.side==='W') cx=(l.tx+0.22)*TILE;
    else if(l.side==='E') cx=(l.tx+0.78)*TILE;
    const g=ctx.createRadialGradient(cx,cy,0,cx,cy,TILE*2.0);
    // v68 Q6 (user decision): floor light pool follows the FLAME color —
    // warm orange in every bunker, matching the always-orange tongues (Q4).
    // theme.torch is no longer used for torch visuals anywhere.
    g.addColorStop(0,`rgba(255,166,66,${0.22*flick})`);
    g.addColorStop(0.45,`rgba(255,140,50,${0.09*flick})`);
    g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g; ctx.fillRect(cx-TILE*2,cy-TILE*2,TILE*4,TILE*4);
  }
  ctx.restore();
}

function drawTorchSconces(){
  const d=G.dun; if(!d||!d.lamps) return;
  const theme=G.dungeonTheme||DUNGEON_THEMES.bluestone;
  const x0=Math.max(0,((cam.x-cw/2/zoom)/TILE|0)-1);
  const x1=Math.min(d.W,((cam.x+cw/2/zoom)/TILE|0)+2);
  const y0=Math.max(0,((cam.y-ch/2/zoom)/TILE|0)-2);
  const y1=Math.min(d.H,((cam.y+ch/2/zoom)/TILE|0)+2);
  for(const l of d.lamps){
    if(l.tx<x0||l.tx>x1||l.ty<y0||l.ty>y1) continue;
    if(!isTileVisited(d,l.tx,l.ty)) continue;
    // v73 rework (user finding #5 — "obor tampil di lantai"): the old code
    // only nudged the sconce 0.36 tile toward the wall, which left the
    // bracket sitting at FLOOR level next to the wall base — it read as a
    // torch standing on the ground. Now each side mounts the bracket onto
    // the wall's actual visible geometry (torches draw AFTER walls, so they
    // layer on top):
    //  • N: the wall above has a real FRONT face spanning
    //    [ty*TILE-WALL_H, ty*TILE] — bracket goes at that face's center.
    //  • S: only the raised TOP face is visible; bracket clamps onto its
    //    upper edge ((ty+1)*TILE - WALL_H) so it hangs off the wall cap.
    //  • E/W: bracket clamps flush to the wall's inner edge and is lifted
    //    ~half a wall-height so it reads as mounted at mid-wall, not
    //    resting on the walkway.
    let x=(l.tx+0.5)*TILE, y;
    if(l.side==='N'){
      y = l.ty*TILE - WALL_H*0.42;
    } else if(l.side==='S'){
      y = (l.ty+1)*TILE - WALL_H*0.30;
    } else {
      const inset = 3;
      x = (l.side==='W') ? l.tx*TILE + inset : (l.tx+1)*TILE - inset;
      y = (l.ty+0.5)*TILE - WALL_H*0.5;
    }
    // v65 T9: two independent, desynced oscillators — a slow lean (the
    // flame body swaying side to side) and a faster flicker (brightness/
    // height jitter) — instead of the old single sine driving one flat
    // ellipse. Per-torch phase offsets (l.tx/l.ty) keep torches across a
    // room from pulsing in lockstep.
    const phase = l.tx*0.9 + l.ty*0.4;
    const lean = Math.sin(G.time*2.1 + phase) * 2.6 + Math.sin(G.time*5.3 + phase*1.7) * 0.9;
    const flick = 0.72 + 0.28*Math.sin(G.time*11 + phase*2.3) + 0.08*Math.sin(G.time*23 + phase);
    const h = 15 + 2*Math.sin(G.time*7 + phase); // subtle height breathing
    ctx.save();
    ctx.translate(x,y);
    // wall bracket (unchanged)
    ctx.fillStyle='#4b3322'; ctx.fillRect(-5,-12,10,9);
    ctx.fillStyle='#7b5632'; ctx.fillRect(-3,-15,6,8);
    ctx.globalCompositeOperation='lighter';
    // Flame tongue: 3 tapered layers (wide soft outer glow -> mid body ->
    // small hot core), each a bit narrower/taller and hotter-colored than
    // the last, all sharing the same lean so they read as one bending
    // flame rather than a stack of unrelated blobs.
    const tongue=(w,hh,ln,style)=>{
      ctx.beginPath();
      ctx.moveTo(-w/2, -3);
      ctx.quadraticCurveTo(-w*0.32+ln*0.5, -hh*0.55, ln, -hh);
      ctx.quadraticCurveTo(w*0.32+ln*0.5, -hh*0.55, w/2, -3);
      ctx.quadraticCurveTo(0, -hh*0.05, -w/2, -3);
      ctx.closePath();
      ctx.fillStyle=style; ctx.fill();
    };
    // v67 Q4 (user decision): flame is ALWAYS natural orange in every bunker,
    // no longer tinted by theme.torch — torches look identical across all 5
    // bunkers. theme.torch is still used for the FLOOR light pool below so
    // each bunker keeps its ambient mood; only the flame itself is fixed.
    tongue(13, h*1.35, lean*1.15, `rgba(255,140,50,${0.32*flick})`);           // outer glow, widest sway
    tongue(9,  h,       lean,      `rgba(255,166,66,${0.75*flick})`);          // mid body
    tongue(4,  h*0.62,  lean*0.6,  `rgba(255,245,180,${0.9*flick})`);          // hot core, leans least (inertia)
    ctx.restore();
  }
}

function drawObjectiveTrail(){
  if(!G||!G.dun||G.paused) return;
  const hostiles = G.enemies.filter(e=>!e.dead && (e.arch.isUndead || e.isBoss));
  let target;
  if(hostiles.length){
    target = hostiles.reduce((best,e)=>{
      const d=Math.hypot(e.x-G.player.x,e.y-G.player.y);
      return !best || d<best.d ? {x:e.x,y:e.y,d,color:e.elite?'#ffd166':'#ff6070'} : best;
    }, null);
  } else {
    target = {x:G.dun.stairsPx.x,y:G.dun.stairsPx.y,color:'#00ff88'};
  }
  const dx=target.x-G.player.x, dy=target.y-G.player.y;
  const dist=Math.hypot(dx,dy);
  if(dist<TILE*3) return;
  const ux=dx/dist, uy=dy/dist;
  ctx.save(); ctx.globalCompositeOperation='lighter';
  for(let i=1;i<=4;i++){
    const pulse=(Math.sin(G.time*4-i*0.8)+1)/2;
    ctx.globalAlpha=0.12+pulse*0.18;
    ctx.fillStyle=target.color;
    const px=G.player.x+ux*TILE*(1.2+i*0.75), py=G.player.y+uy*TILE*(1.2+i*0.75);
    ctx.beginPath(); ctx.arc(px,py,3+i*0.35,0,7); ctx.fill();
  }
  ctx.restore();
}

// A room (or the start room) is visited once the player has stood inside
// it; corridor tiles are considered visited once adjacent to any visited
// room or once the player has physically stood on them.
function markVisited(d){
  const p=G.player;
  const tx=(p.x/TILE)|0, ty=(p.y/TILE)|0;
  const room = d.roomAt(tx,ty);
  if(room && !room.visited) room.visited = true;
  if(!d._visitedTiles) d._visitedTiles = new Set();
  if(!d._visitedCorridors) d._visitedCorridors = new Set();
  // Corridors reveal in one shot: the whole connected hallway the player
  // just stepped into lights up together, matching how rooms already
  // reveal fully on entry, instead of leaving unstepped-on edge tiles dark.
  const cid = (d.corridorId && d.corridorId[ty]) ? d.corridorId[ty][tx] : -1;
  if(cid!==-1) d._visitedCorridors.add(cid);
  d._visitedTiles.add(ty*d.W+tx);
  // also mark the 8 neighbours so standing in a doorway reveals both sides a touch
  for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){
    const nx=tx+dx, ny=ty+dy;
    if(nx>=0&&ny>=0&&nx<d.W&&ny<d.H) d._visitedTiles.add(ny*d.W+nx);
  }
}
function isTileVisited(d,x,y){
  const room = d.roomAt(x,y);
  if(room) return room.visited;
  // corridor / non-room tile: visited once the player has set foot
  // anywhere in that same connected corridor (whole hallway lights up
  // together), falling back to the old per-tile check for edge cases
  // (e.g. the single-room fallback dungeon has no corridor components).
  const cid = (d.corridorId && d.corridorId[y]) ? d.corridorId[y][x] : -1;
  if(cid!==-1 && d._visitedCorridors && d._visitedCorridors.has(cid)) return true;
  return d._visitedTiles && d._visitedTiles.has(y*d.W+x);
}
function isEntityVisibleToPlayer(d,e){
  if(!d || !e) return false;
  const tx=(e.x/TILE)|0, ty=(e.y/TILE)|0;
  if(!isTileVisited(d,tx,ty)) return false;
  const er=d.roomAt(tx,ty);
  const pr=d.roomAt((G.player.x/TILE)|0, (G.player.y/TILE)|0);
  if(er && pr && er!==pr) return false;
  if(er && !pr) return Math.hypot(e.x-G.player.x,e.y-G.player.y)<TILE*2.2;
  return true;
}

// Tall wall blocks (top + front face) with an occlusion fade: a wall segment
// that visually sits between the camera and the player (i.e. the player is
// "behind" it from the top-down view, in the dead zone the tall front face
// would otherwise paint over) fades to a low alpha so the player sprite
// stays visible through it — but only dims a little, not full transparency,
// so the wall is still legible while you're back there.
function drawWallFaces(x0,x1,y0,y1){
  const d=G.dun;
  const theme = G.dungeonTheme || DUNGEON_THEMES.bluestone;
  const isFloor=(x,y)=> x>=0&&y>=0&&x<d.W&&y<d.H&&d.grid[y][x]!==0;
  const isVisitedFloor=(x,y)=> isFloor(x,y) && isTileVisited(d,x,y);
  // Expand the draw window by 1 tile so the extra "thickness" tile (drawn
  // one step outside an actual wall tile) isn't clipped at the viewport edge.
  const ex0=x0-1, ex1=x1+1, ey0=y0-1, ey1=y1+1;

  for(let y=ey0;y<ey1;y++){
    for(let x=ex0;x<ex1;x++){
      if(y<0||y>=d.H||x<0||x>=d.W) continue;
      if(d.grid[y][x]!==0) continue; // only void/wall tiles render here

      // Fase 4 revision (user review): the wall is a SINGLE-tile ring —
      // only wall tiles directly touching a visited floor tile (incl.
      // diagonals, so corners render) get drawn as visible masonry; anything
      // beyond that ring is swallowed by the pure-black void, exactly like
      // the reference art (brick ring around the room, darkness outside).
      let nearVisitedFloor=false, nearAnyFloor=false;
      for(let dy=-1; dy<=1; dy++){
        for(let dx=-1; dx<=1; dx++){
          if(dx===0 && dy===0) continue;
          if(isFloor(x+dx,y+dy)){
            nearAnyFloor=true;
            if(isTileVisited(d,x+dx,y+dy)){ nearVisitedFloor=true; }
          }
        }
      }
      if(!nearAnyFloor) continue; // deep void — nothing to draw

      drawWallBlock(x,y,theme,d);
      if(!nearVisitedFloor){
        // Q11 (v72): walls ringing UNVISITED rooms render as real masonry,
        // then get the same ~70% dim treatment as unvisited floors — so the
        // whole unexplored room reads as one coherent dim space, not floors
        // floating in a black hole. Covers the raised top (shifted up by
        // WALL_H) plus the tile body.
        ctx.fillStyle='rgba(4,8,14,0.70)';
        ctx.fillRect(x*TILE, y*TILE-WALL_H, TILE, TILE+WALL_H);
      }
    }
  }
}

// One extruded 3D wall block — raised TOP face (shifted up by WALL_H so it
// covers what's behind/north of the wall, correct 3/4 top-down perspective)
// plus a lit FRONT face wherever the wall borders floor to the south,
// connecting the top face down to the floor line like a real solid wall.
function drawWallBlock(x,y,theme,d){
  const isFloor=(ax,ay)=> ax>=0&&ay>=0&&ax<d.W&&ay<d.H&&d.grid[ay][ax]!==0;
  const wx=x*TILE, wy=y*TILE;
  const tex = wallTex(theme);
  const fN=isFloor(x,y-1), fS=isFloor(x,y+1), fE=isFloor(x+1,y), fW=isFloor(x-1,y);

  // TOP face (raised by WALL_H) — world-anchored: the SOURCE rect inside the
  // masonry texture comes from the tile's world position, so neighbouring
  // wall tiles sample adjacent texture regions and the courses continue with
  // zero seams however long the wall run is.
  const sxT = ((wx % tex.S) + tex.S) % tex.S;
  const syT = ((wy % tex.S) + tex.S) % tex.S;
  ctx.drawImage(tex.top, sxT, syT, TILE, TILE, wx, wy-WALL_H, TILE, TILE);

  // FRONT face (south) — visible whenever floor lies below this wall.
  if(fS){
    const fy = wy+TILE-WALL_H;
    // X source offset is world-anchored so brick courses run continuously
    // across every neighbouring front face; Y is the full strip.
    ctx.drawImage(tex.front, sxT, 0, TILE, WALL_H, wx, fy, TILE, WALL_H);
    // vertical AO "jamb" ONLY where the neighbouring tile does NOT continue
    // this front face (i.e. at a real wall end / inner corner) — this is
    // what keeps long walls seamless while corners still read as solid ends.
    const contE = !fE && isFloor(x+1,y+1); // east neighbour is wall w/ its own front face
    const contW = !fW && isFloor(x-1,y+1);
    ctx.fillStyle='rgba(0,0,0,0.35)';
    if(!contE) ctx.fillRect(wx+TILE-3, fy, 3, WALL_H);
    if(!contW) ctx.fillRect(wx, fy, 3, WALL_H);
    // lit lip where the raised top meets the face
    ctx.fillStyle = theme.wallEdge;
    ctx.fillRect(wx, fy, TILE, 3);
    // contact shadow on the floor at the base of the wall
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.fillRect(wx, wy+TILE, TILE, 4);
  }

  // SIDE THICKNESS (E/W): a subtle darker band along any raised-top edge
  // that borders open floor sells the block as a 3D slab seen from above —
  // kept light so the masonry stays clearly readable (user review), finished
  // with a thin lit rim (torchlight catching the top corner).
  const band = 5;
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  if(fE) ctx.fillRect(wx+TILE-band, wy-WALL_H, band, TILE);
  if(fW) ctx.fillRect(wx, wy-WALL_H, band, TILE);
  if(fN) ctx.fillRect(wx, wy-WALL_H, TILE, band);
  ctx.fillStyle = theme.wallEdge;
  if(fN) ctx.fillRect(wx, wy-WALL_H, TILE, 3);
  if(fE) ctx.fillRect(wx+TILE-3, wy-WALL_H, 3, TILE);
  if(fW) ctx.fillRect(wx, wy-WALL_H, 3, TILE);
  // outer corner stitches: when two lit rims meet diagonally on neighbouring
  // blocks, fill the 3x3 corner so the rim reads as one continuous outline.
  ctx.fillStyle = theme.wallEdge;
  if(!fN && !fE && isFloor(x+1,y-1)) ctx.fillRect(wx+TILE-3, wy-WALL_H, 3, 3);
  if(!fN && !fW && isFloor(x-1,y-1)) ctx.fillRect(wx, wy-WALL_H, 3, 3);
  if(!fS && !fE && isFloor(x+1,y+1)) ctx.fillRect(wx+TILE-3, wy-WALL_H+TILE-3, 3, 3);
  if(!fS && !fW && isFloor(x-1,y+1)) ctx.fillRect(wx, wy-WALL_H+TILE-3, 3, 3);
}

// Occlusion fade: when the player stands directly behind (north of) a wall,
// that wall's block is re-drawn over the sprites at low alpha so the hero is
// softly hidden by the wall instead of rendering in front of it.
function drawWallOcclusion(){
  if(!G || !G.dun || !G.player) return;
  const d=G.dun, p=G.player;
  const theme=G.dungeonTheme||DUNGEON_THEMES.bluestone;
  const ptx=(p.x/TILE)|0, pty=(p.y/TILE)|0;
  const y=pty+1;
  if(y>=d.H) return;
  ctx.save();
  ctx.globalAlpha=0.55;
  for(let x=ptx-1;x<=ptx+1;x++){
    if(x<0||x>=d.W) continue;
    if(d.grid[y][x]!==0) continue;           // not a wall tile
    if(p.y <= y*TILE - WALL_H - 4) continue; // raised block doesn't reach the sprite
    drawWallBlock(x,y,theme,d);
  }
  ctx.restore();
}

// Golden Key used to be drawn here as a standalone bobbing floor pickup.
// That function ran OUTSIDE the try/catch that wraps every entity's
// draw() call (see the `ents` loop below), so if it ever threw (e.g. an
// out-of-range tile index from isTileVisited() on an edge-of-map key
// position) it silently aborted the rest of that render() call — which
// meant the player sprite (drawn AFTER it, in the ents loop) never got
// painted for that frame. That's the "character disappears when entering
// the Golden Key's room" bug. Golden Keys are now found as loot INSIDE
// interactive containers (Rotten Armoire / Lost Cache — see props.js
// rollLootSlots()) exactly like any other item, so there's no floor
// sprite left to draw and this whole failure mode is gone.

function drawStairs(){
  const s=G.dun.stairsPx;
  if(!isTileVisited(G.dun, (s.x/TILE)|0, (s.y/TILE)|0)) return;
  const pulse=0.5+0.5*Math.sin(G.time*3);
  const bob=Math.sin(G.time*2.4)*5; // arrow bob amplitude, px

  ctx.save();
  ctx.translate(s.x,s.y);

  // ---- ground glow circle (faded red, hugs the floor) ----
  const glowR = 34;
  const g = ctx.createRadialGradient(0,4,0, 0,4,glowR);
  g.addColorStop(0, 'rgba(255,70,90,0.22)');
  g.addColorStop(0.6, 'rgba(255,40,70,0.13)');
  g.addColorStop(1, 'rgba(255,30,60,0)');
  ctx.fillStyle = g;
  ctx.save(); ctx.scale(1,0.42); // flatten into a floor-hugging ellipse
  ctx.beginPath(); ctx.arc(0,9.5,glowR,0,Math.PI*2); ctx.fill();
  ctx.restore();
  // thin ring outline on the glow, breathing with the pulse
  ctx.globalAlpha = 0.25+0.2*pulse;
  ctx.strokeStyle = '#ff4a5e'; ctx.lineWidth = 1.5;
  ctx.save(); ctx.scale(1,0.42);
  ctx.beginPath(); ctx.arc(0,9.5,glowR*0.86,0,Math.PI*2); ctx.stroke();
  ctx.restore();
  ctx.globalAlpha = 1;

  // ---- lift platform (small raised block, top-down) ----
  ctx.fillStyle = '#1a2430';
  ctx.fillRect(-19,-14,38,28);
  ctx.fillStyle = '#26343f';
  ctx.fillRect(-15,-10,30,20);
  ctx.fillStyle = 'rgba(0,255,136,.5)';
  ctx.fillRect(-15,-10,30,2);
  // diagonal hazard ticks along the platform edge (lift/industrial feel)
  ctx.strokeStyle = 'rgba(255,200,80,.35)'; ctx.lineWidth=2;
  for(let i=-12;i<=12;i+=8){ ctx.beginPath(); ctx.moveTo(i,9); ctx.lineTo(i+4,13); ctx.stroke(); }

  // ---- bobbing arrow pointing down at the glow circle ----
  ctx.translate(0, -34 + bob);
  ctx.fillStyle = `rgba(255,90,105,${0.55+0.35*pulse})`;
  ctx.beginPath();
  ctx.moveTo(0, 10); ctx.lineTo(-8, -4); ctx.lineTo(8, -4); ctx.closePath();
  ctx.fill();
  ctx.fillRect(-3, -10, 6, 8);

  ctx.restore();
}

function drawParticles(){
  for(const p of G.particles){
    const a=Math.max(0,p.life/p.max);
    ctx.globalAlpha=a; ctx.fillStyle=p.color;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha=1;
}
function drawDmgNums(){
  ctx.textAlign='center';
  for(const n of G.dmgNums){
    const a=Math.max(0,n.life/0.9);
    ctx.globalAlpha=a;
    ctx.font=`bold ${n.crit?20:15}px "Share Tech Mono"`;
    ctx.fillStyle=n.color||(n.crit?'#ffd166':'#fff');
    ctx.fillText(n.val, n.x, n.y);
  }
  ctx.globalAlpha=1;
}

// D2 (v71, user decision: Approach B — entity-aware): radial "carried
// light" that follows the player, with soft warm reflections cast onto
// nearby monsters/props, and the rest of the scene dimmed but NEVER pitch
// black (user: "area lain tidak harus gelap total"). Sits ON TOP of the
// existing room-lamp glow + torch pools, so lit rooms stay readable.
// All tunables in one place — safe to tweak live from console via
// window.NS_LIGHT without touching code.
const NS_LIGHT = window.NS_LIGHT = {
  // Q11 retune (v72, user feedback): previous defaults read as "everything
  // equally bright" — the far-field dark was too weak (0.42) and the warm
  // reflection too subtle (0.07) to register as a real carried light. New
  // defaults push a CLEAR bright-around-player -> dim-far gradient, plus a
  // stronger warm bounce onto the floor/wall texture around the player.
  radius: 300,      // world-px reach of the player's light
  maxDark: 0.62,    // darkness alpha far from the player (0=off, 1=black)
  midDark: 0.30,    // darkness alpha at the falloff shoulder (~45% radius)
  warmCore: 0.14,   // warm candle tint alpha at the player
  wallBounce: 0.10, // extra tight warm ring = light visibly bouncing off the
                    // floor/wall pixels immediately around the player (Q11)
  entGlow: 0.22,    // peak reflection alpha on a monster/prop right next to the player
  entMax: 12,       // per-frame cap on entity reflections (perf guard)
  flicker: 0.10,    // +/- fraction of candle-style flicker on the warm layers
  _fpsHz: 0,        // internal: smoothed fps estimate (readonly, for perf monitoring)
  _fpsEMA: 0,       // internal: exponential moving average of instantaneous fps
  _rimOff: false,   // internal: latched "entity-rim layer disabled" state (hysteresis)
  _lastT: 0,        // internal: last drawDarkness time
};
function drawDarkness(sx,sy){
  const L=NS_LIGHT;
  const toSX=wx=>(wx-cam.x)*zoom+cw/2+sx, toSY=wy=>(wy-cam.y)*zoom+ch/2+sy;
  const px=toSX(G.player.x), py=toSY(G.player.y);
  const rad=L.radius*zoom;
  // slow candle flicker shared by all warm layers this frame (cheap: one
  // sin pair, same style as the torch tongue oscillator)
  const t=performance.now()/1000;
  const fl=1 + (Math.sin(t*7.3)+Math.sin(t*11.7)*0.5)/1.5*L.flicker;
  // 1) darkness mask — radial hole centered on the player. Falloff shoulders
  // tuned so the edge is soft (no hard circle) and the far field stays a
  // dim-but-readable maxDark, not black.
  // Q11 (v72): inner clear zone tightened (0.22 -> 0.12 of radius) and the
  // shoulder pulled in (0.6 -> 0.45) so the bright->dim gradient is actually
  // VISIBLE while walking — before, most of the screen sat inside the
  // near-transparent zone and everything read equally bright.
  const g=ctx.createRadialGradient(px,py,rad*0.12, px,py,rad);
  g.addColorStop(0,'rgba(0,0,0,0)');
  g.addColorStop(0.45,`rgba(2,5,8,${L.midDark})`);
  g.addColorStop(1,`rgba(1,3,5,${L.maxDark})`);
  ctx.fillStyle=g; ctx.fillRect(0,0,cw,ch);
  // 2) warm carried-light core (candle/torch-in-hand vibe — follows the Q6
  // decision that all flame light in this game is warm orange, replacing
  // the old flat green tint here). 'lighter' so it also warms the wall
  // texture pixels immediately around the player — the cheap "reflection
  // on walls" half of Approach B without per-tile work.
  ctx.save(); ctx.globalCompositeOperation='lighter';
  const g2=ctx.createRadialGradient(px,py,0,px,py,rad*0.55);
  g2.addColorStop(0,`rgba(255,166,66,${(L.warmCore*fl).toFixed(3)})`);
  g2.addColorStop(1,'rgba(255,140,50,0)');
  ctx.fillStyle=g2; ctx.fillRect(0,0,cw,ch);
  // Q11 (v72) wall/floor bounce: a second, TIGHTER warm ring right at the
  // player's feet. Because this is composited 'lighter' over the already-
  // rendered tile/wall pixels, the masonry & floor texture around the player
  // visibly brightens and warms — reading as light reflecting off the
  // surfaces — and it follows every analog-stick move smoothly since px/py
  // are re-sampled from the live player position every frame.
  const g3=ctx.createRadialGradient(px,py,0,px,py,rad*0.30);
  g3.addColorStop(0,`rgba(255,196,110,${(L.wallBounce*fl).toFixed(3)})`);
  g3.addColorStop(0.7,`rgba(255,170,80,${(L.wallBounce*fl*0.45).toFixed(3)})`);
  g3.addColorStop(1,'rgba(255,150,60,0)');
  ctx.fillStyle=g3; ctx.fillRect(0,0,cw,ch);
  // 3) entity-aware reflections: monsters + props inside the light radius
  // catch a soft warm rim, strongest right next to the player, fading with
  // world distance. Capped + culled to fog-visited tiles so nothing glows
  // through unexplored black.
  // v71: FPS guard — if frame rate drops below 20fps (50ms per frame), skip
  // entity reflections to recover headroom on low-end devices. Monitor via
  // window.NS_LIGHT._fpsHz (readonly, updated each call).
  const d=G.dun;
  let drawn=0;
  const now=performance.now();
  if(L._lastT>0){
    const dt=now-L._lastT;
    const inst = dt>0 ? 1000/dt : 60;
    // Smooth the fps estimate (EMA) so a SINGLE slow frame can't flip the
    // rim-light layer. Before this, a heavy-FX weapon (aoe/volley/triple-slash,
    // evolved spark sprays) that parked the frame rate right around the cutoff
    // made `skipEntityRim` toggle EVERY frame — the warm rims around every
    // on-screen monster/prop blinked on and off and the whole scene read as
    // flickering ("layar/maps berkedip" on certain weapons' autoattack).
    L._fpsEMA = L._fpsEMA>0 ? L._fpsEMA + (inst - L._fpsEMA)*0.15 : inst;
    L._fpsHz = Math.round(L._fpsEMA);
  }
  L._lastT=now;
  // Hysteresis on top of the smoothing: only DROP the rim layer once the
  // smoothed fps sinks below 18, and only restore it once it climbs back over
  // 26. The gap between the two thresholds means the state latches instead of
  // chattering at a single boundary — no more frame-to-frame flicker.
  if(L._rimOff){ if(L._fpsHz > 26) L._rimOff = false; }
  else { if(L._fpsHz < 18) L._rimOff = true; }
  const skipEntityRim = L._rimOff;
  const cast=(e,r)=>{
    if(skipEntityRim || drawn>=L.entMax) return;
    const dist=Math.hypot(e.x-G.player.x, e.y-G.player.y);
    if(dist>=L.radius) return;
    if(!isTileVisited(d,(e.x/TILE)|0,(e.y/TILE)|0)) return;
    const k=1-dist/L.radius;                 // 1 at player -> 0 at edge
    const ex=toSX(e.x), ey=toSY(e.y-(e.h?e.h*0.35:r*0.3));
    const rr=Math.max(10,(r*2.2)*zoom);
    const gg=ctx.createRadialGradient(ex,ey,0,ex,ey,rr);
    gg.addColorStop(0,`rgba(255,176,86,${(L.entGlow*k*k*fl).toFixed(3)})`);
    gg.addColorStop(1,'rgba(255,150,60,0)');
    ctx.fillStyle=gg;
    ctx.fillRect(ex-rr,ey-rr,rr*2,rr*2);
    drawn++;
  };
  if(!skipEntityRim){
    for(const e of G.enemies){ if(!e.dead) cast(e, e.r||14); }
    for(const o of G.decor){ if(!o.broken) cast(o, o.r||12); }
  }
  ctx.restore();
}
function drawVignette(){
  const g=ctx.createRadialGradient(cw/2,ch/2,Math.min(cw,ch)*0.4,cw/2,ch/2,Math.max(cw,ch)*0.8);
  g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(1,'rgba(0,0,0,0.28)');
  ctx.fillStyle=g; ctx.fillRect(0,0,cw,ch);
}

// ---- minimap (top-right) ----
// Shows the room/corridor layout, the player's position + facing, the
// nearest visible enemies, and the stairs. When the stairs are far outside
// the minimap's own little view window, a directional arrow at the edge
// points toward them so the player always has a "which way do I go" cue.
// HUD redesign (owner): the LV/FLOOR/KILLS stat boxes that used to sit in the
// top-right are gone (folded into the compact <HudStatLine> under the bars on
// the LEFT), so the minimap can ride right up into the top-right corner.
const MM = { size:108, pad:12, top:14 };
function getMinimapMetrics(){
  // Smaller on narrow/portrait phones — 108px was dominating the screen.
  if(portrait && cw < 480) return { size:78, pad:10, top:12 };
  return MM;
}
// v80 REDESIGN (owner: "minimap jelek dan tidak sesuai maps game"):
//  * the map now shows EVERY visited tile (no more 11-tile radius crop that
//    made it look like random smudges) — what you've explored is what you
//    see, walls and room shapes matching the real dungeon layout;
//  * unexplored floor renders as a faint ghost so the panel always reads as
//    "a map", while the fog still hides where you haven't been;
//  * walls get their own pixel outline so rooms/corridors have real shape;
//  * the layout is centered in the panel (no more off-corner squish);
//  * pixel-RPG panel: chunky notched-corner frame in the wood/gold HUD skin
//    instead of a thin 1px teal box;
//  * player wedge uses the real 4-direction LPC facing.
function drawMinimap(){
  const d = G.dun; if(!d) return;
  const { size, pad, top } = getMinimapMetrics();
  const mx = cw - pad - size, my = top;
  const inset = 6; // inner margin inside the frame
  const cellPx = (size - inset*2) / Math.max(d.W, d.H);
  // center the layout inside the panel
  const ox = mx + inset + ((size - inset*2) - d.W*cellPx)/2;
  const oy = my + inset + ((size - inset*2) - d.H*cellPx)/2;
  const N = 3; // pixel notch size for the frame corners

  ctx.save();
  // ---- pixel frame: notched-corner parchment-dark panel with bronze trim
  ctx.beginPath();
  ctx.moveTo(mx+N,my); ctx.lineTo(mx+size-N,my); ctx.lineTo(mx+size,my+N);
  ctx.lineTo(mx+size,my+size-N); ctx.lineTo(mx+size-N,my+size);
  ctx.lineTo(mx+N,my+size); ctx.lineTo(mx,my+size-N); ctx.lineTo(mx,my+N);
  ctx.closePath();
  ctx.fillStyle = 'rgba(16,12,8,0.82)';
  ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = '#5a4226'; ctx.stroke();   // bronze outer
  ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,209,102,.35)';   // gold inner
  ctx.stroke();
  // corner studs (little gold pixels, pure decoration)
  ctx.fillStyle = 'rgba(255,209,102,.5)';
  ctx.fillRect(mx+2,my+2,2,2); ctx.fillRect(mx+size-4,my+2,2,2);
  ctx.fillRect(mx+2,my+size-4,2,2); ctx.fillRect(mx+size-4,my+size-4,2,2);

  ctx.beginPath(); ctx.rect(mx+2, my+2, size-4, size-4); ctx.clip();

  const c = Math.max(1, cellPx);
  // ---- unexplored floor: faint ghost of the whole layout
  ctx.fillStyle = 'rgba(120,110,90,.10)';
  for(let ty=0; ty<d.H; ty++) for(let tx=0; tx<d.W; tx++){
    if(d.grid[ty][tx]!==0 && !isTileVisited(d,tx,ty))
      ctx.fillRect(ox+tx*cellPx, oy+ty*cellPx, c, c);
  }
  // ---- visited floor: solid parchment-green, the real explored map
  ctx.fillStyle = 'rgba(96,180,130,.55)';
  for(let ty=0; ty<d.H; ty++) for(let tx=0; tx<d.W; tx++){
    if(d.grid[ty][tx]!==0 && isTileVisited(d,tx,ty))
      ctx.fillRect(ox+tx*cellPx, oy+ty*cellPx, c, c);
  }
  // ---- wall edging around visited floor, so rooms have real outlines
  ctx.fillStyle = 'rgba(30,24,16,.9)';
  for(let ty=0; ty<d.H; ty++) for(let tx=0; tx<d.W; tx++){
    if(d.grid[ty][tx]!==0) continue; // walls only
    // draw a wall pixel only when it touches a VISITED floor tile
    let touch=false;
    for(const [ddx2,ddy2] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){
      const nx=tx+ddx2, ny=ty+ddy2;
      if(nx>=0&&ny>=0&&nx<d.W&&ny<d.H && d.grid[ny][nx]!==0 && isTileVisited(d,nx,ny)){ touch=true; break; }
    }
    if(touch) ctx.fillRect(ox+tx*cellPx, oy+ty*cellPx, c, c);
  }

  // lift marker — small gold square (visible once its tile was explored,
  // always visible on boss floors so the objective can't be lost)
  const sTx=(d.stairsPx.x/TILE)|0, sTy=(d.stairsPx.y/TILE)|0;
  if(isTileVisited(d,sTx,sTy) || G.depth%5===0){
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(ox+sTx*cellPx-1, oy+sTy*cellPx-1, Math.max(3,c+1), Math.max(3,c+1));
  }

  // nearby enemy dots (kept radius-limited: it's a threat radar, not wallhack)
  const ptx=(G.player.x/TILE)|0, pty=(G.player.y/TILE)|0;
  ctx.fillStyle = '#ff5d54';
  for(const e of G.enemies){
    if(e.dead) continue;
    if(Math.hypot(e.x/TILE-ptx, e.y/TILE-pty) > 12) continue;
    const ex = ox + (e.x/TILE)*cellPx, ey = oy + (e.y/TILE)*cellPx;
    ctx.fillRect(ex-(e.isBoss?2.5:1.5), ey-(e.isBoss?2.5:1.5), e.isBoss?5:3, e.isBoss?5:3);
  }

  // player wedge — true 4-direction facing (same _lpcDir the sprite uses)
  const px = ox + (G.player.x/TILE)*cellPx, py = oy + (G.player.y/TILE)*cellPx;
  const dirAng = [ -Math.PI/2, Math.PI, Math.PI/2, 0 ][G.player._lpcDir!=null ? G.player._lpcDir : 3];
  ctx.save();
  ctx.translate(px, py); ctx.rotate(dirAng);
  ctx.fillStyle = '#00ff88';
  ctx.beginPath(); ctx.moveTo(5,0); ctx.lineTo(-4,-3.5); ctx.lineTo(-4,3.5); ctx.closePath(); ctx.fill();
  ctx.restore();

  // directional arrow to the lift at the panel edge when it's far away
  const ddx = d.stairsPx.x - G.player.x, ddy = d.stairsPx.y - G.player.y;
  if(Math.hypot(ddx,ddy) > TILE*6){
    const ang2 = Math.atan2(ddy,ddx);
    const ccx = mx+size/2, ccy = my+size/2, r = size/2 - 9;
    ctx.save();
    ctx.translate(ccx + Math.cos(ang2)*r, ccy + Math.sin(ang2)*r); ctx.rotate(ang2);
    ctx.fillStyle = '#ffd166';
    ctx.beginPath(); ctx.moveTo(6,0); ctx.lineTo(-4,-4); ctx.lineTo(-4,4); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  // status line under the panel, on its own little pixel plate.
  // v81: the Phase 1 run timer lives here now (left of the hostiles count)
  // instead of a separate HUD stat that overlapped this very panel.
  const remaining = G.enemies.filter(e=>!e.dead && (e.arch.isUndead || e.isBoss)).length;
  let label = remaining ? `${remaining} HOSTILES` : 'LIFT UNLOCKED';
  const _run = window.NS_RUN && NS_RUN.active();
  if(_run){
    const _s = (_run.elapsedMs/1000)|0;
    label = ((_s/60)|0) + ':' + String(_s%60).padStart(2,'0') + ' · ' + label;
  }
  ctx.save();
  ctx.font = '9px "Share Tech Mono"';
  const tw = ctx.measureText(label).width + 12;
  const lx = mx + size - tw, ly = my + size + 4;
  ctx.fillStyle = 'rgba(16,12,8,0.78)';
  ctx.fillRect(lx, ly, tw, 14);
  ctx.strokeStyle = '#5a4226'; ctx.lineWidth = 1; ctx.strokeRect(lx+0.5, ly+0.5, tw-1, 13);
  ctx.fillStyle = remaining ? 'rgba(255,209,102,.9)' : 'rgba(0,255,136,.9)';
  ctx.textAlign = 'center';
  ctx.fillText(label, lx+tw/2, ly+10.5);
  ctx.restore();
}

// ---- update ----
// Fade the right-hand control buttons (inventory/settings/elixir/mute) while
// the player is moving so they don't block the view, and bring them back the
// moment the character stands still (owner request). Movement = any directional
// input; works in both the bunker and the outdoor walk. Only flips the DOM
// class on an actual state change (move-start / move-stop), not every frame.
let _controlsDimState = false;
function _setControlsDim(on){
  if(on === _controlsDimState) return;
  _controlsDimState = on;
  const root = document.querySelector('.ns-game-root');
  if(root) root.classList.toggle('ns-controls-dim', on);
}
function update(dt){
  _setControlsDim(!!(input.left || input.right || input.up || input.down));
  if(Outdoor.active()){
    // Always keep ticking Outdoor.update() while active (as long as no
    // cutscene is stealing the frame) — outdoor.js already withholds
    // movement input on its own during phase==='arrival' (it returns
    // before ever reading input.left/right). Gating the call itself here
    // used to also freeze the arrival dialogue's own advance timer, since
    // that timer only ticks inside Outdoor.update() — leaving the player
    // stuck on the first speech line forever, unable to move even after.
    if(!csActive) Outdoor.update(dt, input);
    return;
  }
  if(!G||G.paused||G.over) return;
  // ---- Phase 1: run clock. Ticks only while the run is actually playable
  // (paused/cutscene/game-over frames return before this line). Display
  // lives in the minimap's status plate (drawMinimap) — v81: the separate
  // HUD TIME stat overlapped the minimap panel on portrait screens.
  if(window.NS_RUN) NS_RUN.tick(dt);
  G.time+=dt;
  const p=G.player;
  if(G.action.cd>0) G.action.cd-=dt;
  if(G.ultiFlash>0) G.ultiFlash-=dt;
  if(G.combo && G.combo.t>0) G.combo.t-=dt;
  checkRoomDiscovery();
  // nearest VISIBLE alive enemy (drives auto-attack + camera + ulti).
  // "Visible" = standing in a tile the player has actually explored — an
  // elite/boss sitting in an unvisited room behind the fog-of-war should
  // never be able to trigger an ulti offer the player can't even see.
  let nearest=null, nd=1e9;
  for(const e of G.enemies){
    if(e.dead||e.spawnT>0) continue;
    if(!isEntityVisibleToPlayer(G.dun, e)) continue;
    const d=Math.hypot(e.x-p.x,e.y-p.y); if(d<nd){ nd=d; nearest=e; }
  }
  G._nd=nd;
  // nearest unbroken non-interactive decoration (auto-smash targets only)
  let nearDecor=null, ndd=1e9;
  for(const o of G.decor){ if(o.broken||o.interactive||o.ambient) continue;
    const d=Math.hypot(o.x-p.x,o.y-p.y); if(d<ndd){ ndd=d; nearDecor=o; } }
  // v65 T4: auto-attack must not trigger on targets the player hasn't
  // physically reached. isEntityVisibleToPlayer() only means the tile is
  // explored (fog-of-war) — you can see a monster from the doorway without
  // being inside its room. This gate requires the player to be IN the same
  // room as the target; targets standing in corridors (roomAt → null) fall
  // through to the distance gate alone.
  const _sameRoomAsPlayer = (wx, wy) => {
    const d = G.dun;
    const tr = d.roomAt((wx/TILE)|0, (wy/TILE)|0);
    if(!tr) return true; // target in a corridor — distance gate is enough
    const pr = d.roomAt((p.x/TILE)|0, (p.y/TILE)|0);
    return pr === tr;
  };
  // AUTO-ATTACK: enemies first, then nearby breakables.
  // v65 T4 radii: melee triggers only near face-to-face (was 76/54 — fired
  // from visually "not even close"; melee hitZone reach is ~88 so 52 still
  // always lands). Ranged weapons keep a medium engage range — larger than
  // melee, far less than before once combined with the same-room gate above.
  // Decor had NO room/visibility gate at all before.
  // v76 Task #7: 'volley' (Sunfire Longbow) is a ranged behavior too — without
  // it here the $15 bow would walk into melee range before loosing, which is
  // the opposite of what a longbow is for.
  const _isRanged = p._weaponBehavior === 'ranged' || p._weaponBehavior === 'volley';
  // v69: ranged engage 150 -> 260 (user: "auto attack panah bisa agak
  // jauh"). Arrow maxRange is 560 so 260 always lands with margin; the
  // same-room gate above still prevents shooting through doorways at
  // monsters the player hasn't reached.
  const _enemyTrig = _isRanged ? 260 : 52;
  const enemyInRange = nearest && nd < (_enemyTrig+nearest.r)
    && _sameRoomAsPlayer(nearest.x, nearest.y);
  const decorInRange = nearDecor && ndd < (42+nearDecor.r)
    && _sameRoomAsPlayer(nearDecor.x, nearDecor.y);
  if(p.atkCd<=0 && !p.attacking){
    if(enemyInRange){
      const dx=nearest.x-p.x, dy=nearest.y-p.y, m=Math.hypot(dx,dy)||1;
      // Lock the swing aim to the target for the WHOLE attack (see _atkAim in
      // entities.js). Auto-attack + analog-only movement meant that after the
      // 0.18s move-lock the player kept walking and _lastMove flipped back to
      // the movement direction mid-swing, so the visible swing AND the
      // hit-zone pointed away from the monster ("tidak face2face"). _atkAim
      // pins both to the enemy for the full 0.42s swing regardless of input.
      p.facing=dx>=0?1:-1; p._lastMove={x:dx/m,y:dy/m}; p._atkAim={x:dx/m,y:dy/m}; p.startAttack();
    }
    else if(decorInRange){
      const dx=nearDecor.x-p.x, dy=(nearDecor.y-nearDecor.h*0.35)-p.y, m=Math.hypot(dx,dy)||1;
      p.facing=dx>=0?1:-1; p._lastMove={x:dx/m,y:dy/m}; p._atkAim={x:dx/m,y:dy/m}; p.startAttack();
    }
  }
  if(input.attack) p.startAttack();          // manual (desktop)
  if(G.paused) return;
  p.update(dt, input, G.dun);
  if(p.takeSwingFx()){ // v67 T11: swing spark follows weapon fxColor. Phase 6:
    // an evolved weapon (p._wpnTier 2/3) throws more, faster sparks per swing.
    const _evo = Math.max(1, p._wpnTier || 1);
    spark(p.x+p.facing*30, p.y-10, p._fxColor||'#eafff5', 8+(_evo-1)*6, 100+(_evo-1)*45);
  }
  hitTest();
  updateProjectiles(dt);
  // v77: premium impact rings — advance & cull
  if(G.rings && G.rings.length){
    for(const r of G.rings) r.t += dt;
    G.rings = G.rings.filter(r => r.t < r.dur);
  }
  // Action button (NULL_STRIKE / OPEN) — recomputed AFTER hitTest() so a
  // killing blow landed this frame is already reflected (e.dead=true)
  // before we decide whether the button should show NULL_STRIKE; otherwise
  // a boss that's about to die from this frame's hit could still flash the
  // button a frame later than it visually died. Non-blocking — never pauses.
  updateActionButton(nearest, nd);
  for(const e of G.enemies){
    // 4th arg: the rest of the floor's enemies, so each one can push out of
    // whoever it is standing inside (Enemy._separate). This comment used to
    // say "also separation" one line down while nothing separated anything.
    e.update(dt, p, G.dun, G.enemies);
    if(e.takeSwingFx()) spark(e.x+e.facing*e.r, e.y-e.r*0.4, e.elite?'#ffd166':'#ff8a7a', 10, 90);
  }
  // resolve enemy-dealt damage collected in hitTest already
  G.enemies = G.enemies.filter(e=>!(e.dead && e.deathT<=0));
  // decorations
  for(const o of G.decor) o.update(dt);
  G.decor = G.decor.filter(o=>!(o.broken && o.brokenT<=0));
  // particles
  for(const pt of G.particles){ pt.x+=pt.vx*dt; pt.y+=pt.vy*dt; pt.vy+=160*dt; pt.life-=dt; }
  G.particles=G.particles.filter(p=>p.life>0);
  // Safety cap: an aoe swing that hits/kills a crowd can spawn hundreds of
  // particles in one frame; left unbounded the per-frame update+draw cost drops
  // the frame rate (which is what made the light-rim layer blink). Keep only the
  // newest — older ones are already fading — so the scene stays smooth.
  if(G.particles.length>420) G.particles.splice(0, G.particles.length-420);
  for(const n of G.dmgNums){ n.y+=n.vy*dt; n.vy+=40*dt; n.life-=dt; }
  G.dmgNums=G.dmgNums.filter(n=>n.life>0);
  if(G.shake>0) G.shake=Math.max(0,G.shake-dt*22);
  // dynamic camera zoom: far while exploring, closer near monsters
  const nd2 = G._nd!==undefined ? G._nd : 1e9;
  let zt;
  if(nd2 < 210) zt = zoomNear;
  else if(nd2 > 470) zt = zoomFar;
  else zt = zoomNear + (zoomFar - zoomNear) * ((nd2-210)/260);
  zoom += (zt - zoom) * Math.min(1, dt*3.2);
  // lift: standing near it opens the floor-select popup (once per approach,
  // not every frame, so it doesn't re-open while standing still after closing it)
  const distToLift = Math.hypot(p.x-G.dun.stairsPx.x, p.y-G.dun.stairsPx.y);
  if(distToLift < TILE*0.85){
    if(!G._liftPrompted && !G.paused){ G._liftPrompted=true; openLiftMenu(); }
  } else { G._liftPrompted = false; }
  // Golden Keys are picked up via the container loot window now (see
  // props.js rollLootSlots() + takeContainerSlot() in this file), not by
  // walking over a floor sprite — nothing to check here anymore.
  // ambient dust / null motes — light enough for mobile but keeps scenes alive
  const moteChance = portrait ? 0.10 : 0.16;
  if(Math.random()<moteChance){ const a=Math.random()*Math.PI*2,r=60+Math.random()*120;
    const danger = nearest && nd<170;
    G.particles.push({x:p.x+Math.cos(a)*r,y:p.y+Math.sin(a)*r,vx:0,vy:-8,life:1.2,max:1.2,
      color:danger?'rgba(255,80,90,.22)':'rgba(0,255,136,.25)',r:1}); }
  updateCam();
}

// ---- loop ----
let last=0;
function frame(t){
  if(destroyed) return;
  const dt=Math.min(0.05,(t-last)/1000||0); last=t;
  // update()/render() used to run unguarded: if either threw, this
  // function would abort BEFORE reaching requestAnimationFrame(frame)
  // below, and the whole game would freeze on that exact frame forever
  // (the browser just never gets asked to schedule another one). Wrapping
  // them means a one-off bug in game logic or drawing shows up as a
  // console error and, at worst, a skipped/glitched frame — never a full
  // stuck screen.
  try{
    // Hit-stop: skip logic tick while freeze is active (visual still runs)
    const fx = window.NS_FX;
    if (fx && fx.HitStop.tick(dt)) {
      render();
    } else {
      update(dt); render();
    }
  } catch(err){
    console.error('frame() failed, continuing loop', err);
  }
  rafId=requestAnimationFrame(frame);
}

// ---- HUD ----
// #12 — HP bar tiers + low-HP vignette. Tiers are % of CURRENT maxHp (not
// a fixed HP number), so they stay correct as maxHp changes with level-ups
// / gear. Shared by both the main HUD bar and the inventory-panel bar so
// they're always in sync with each other.
function hpTierClass(pct){
  if(pct<=0.2) return 'tier-low';
  if(pct<=0.5) return 'tier-mid';
  return 'tier-high';
}
function applyHpTier(barEl, pct){
  if(!barEl) return;
  barEl.classList.remove('tier-high','tier-mid','tier-low');
  barEl.classList.add(hpTierClass(pct));
}
// Vignette only engages at/below the same 20% threshold as tier-low, then
// ramps in intensity the closer HP gets to 0 (proportional to maxHp, since
// pct is already hp/maxHp) — a player at 20% sees a faint edge, a player
// about to die sees a strong red vignette.
function applyHpVignette(pct){
  const el = $('hpVignette');
  if(!el) return;
  if(pct>0.2){ el.style.opacity='0'; return; }
  const t = 1-(pct/0.2); // 0 at exactly 20%, 1 at 0 HP
  el.style.opacity=String(0.15+t*0.6);
}
function updateHUD(){
  if(!G) return; const p=G.player;
  const hpPct = p.hp/p.maxHp;
  $('hpFill').style.width=(hpPct*100)+'%';
  $('hpText').textContent=`${Math.ceil(p.hp)}/${p.maxHp}`;
  applyHpTier($('hpFill').parentElement, hpPct);
  applyHpVignette(hpPct);
  $('xpFill').style.width=(p.xp/p.xpForNext()*100)+'%';
  $('xpText').textContent=`${p.xp}/${p.xpForNext()}`;
  // LV/FLOOR/KILLS moved out of the vanilla HUD into the React <HudStatLine>
  // (driven by the live-stats bridge emitted just below). These spans no
  // longer exist in the DOM, so guard each write — the compact stat line is
  // now the single source of those three numbers on screen.
  { const _l=$('lvl'); if(_l) _l.textContent=p.level;
    const _f=$('floor'); if(_f) _f.textContent=G.depth;
    const _k=$('kills'); if(_k) _k.textContent=p.kills; }
  updateInventoryPanel();
  // Item #10 fix (Option C): announce the live numbers to React every time
  // this function runs (i.e. after every kill/level-up/floor-change/pickup —
  // updateHUD() is already the single choke point for all of those). Guarded
  // with typeof so this is a no-op if the React bridge hasn't attached yet
  // (e.g. very first frame) or ever — the DOM HUD above already painted
  // regardless of whether anyone is listening. See lib/liveStatsBridge.ts.
  if (typeof window.__nullstateEmitLiveStats === 'function') {
    window.__nullstateEmitLiveStats({
      xp: p.xp,
      level: p.level,
      kills: p.kills,
      floor: G.depth,
      xpForNext: p.xpForNext(),
      // Which story bunker (Act) the player is in, so the HUD can show
      // "Bunker 1/5" — owner: "biar user ga bingung dia lagi di bungker brp".
      // In the endless Abyss there's no bunker, so send 0 (HudStatLine shows
      // "Abyss" instead).
      bunker: abyssMode ? 0 : (campaignActIndex + 1),
      bunkerTotal: (typeof CAMPAIGN !== 'undefined' && CAMPAIGN.length) ? CAMPAIGN.length : 5,
    });
  }
}
function updateInventoryPanel(){
  if(!G) return; const p=G.player;
  // Reconcile out-of-game Rewards-screen burns BEFORE rendering, so an item the
  // player already burned there can't still appear (and be burned again) in the
  // in-game inventory. persistStashSnapshot() at the end reconciles too, but
  // doing it up front keeps the rendered list itself correct.
  applyExternalBurns();
  // Phase 2: Glitch Shard strip — this run's haul + the wallet's banked
  // balance (from the materials bridge cache). Hidden until any exist so
  // the panel looks unchanged for players who haven't met the system yet.
  {
    const matEl=$('invMaterials');
    if(matEl){
      const g=(G.inventory&&G.inventory.gshards)||{t1:0,t2:0,t3:0};
      const b=(MATERIALS&&MATERIALS.banked&&MATERIALS.banked())||null;
      const run=(g.t1||0)+(g.t2||0)+(g.t3||0);
      const bank=b?(b.t1||0)+(b.t2||0)+(b.t3||0):0;
      if(run+bank>0){
        matEl.classList.remove('hidden');
        const cell=(t)=>`T${t} <b>${g['t'+t]||0}</b>${b?`<i>+${b['t'+t]||0}</i>`:''}`;
        matEl.innerHTML=`<span class="mat-k">▲ GLITCH SHARDS</span>`+
          `<span class="mat-v">${cell(1)} · ${cell(2)} · ${cell(3)}</span>`+
          `<span class="mat-note">run <b>·</b> banked</span>`;
      } else {
        matEl.classList.add('hidden');
      }
    }
  }
  const hpFill=$('invHpFill'), hpText=$('invHpText'), xpFill=$('invXpFill'), xpText=$('invXpText');
  if(hpFill){ const hpPct=p.hp/p.maxHp; hpFill.style.width=(hpPct*100)+'%'; applyHpTier(hpFill.parentElement, hpPct); }
  if(hpText){ hpText.textContent=`${Math.ceil(p.hp)}/${p.maxHp}`; }
  if(xpFill){ xpFill.style.width=(p.xp/p.xpForNext()*100)+'%'; }
  if(xpText){ xpText.textContent=`${p.xp}/${p.xpForNext()}`; }
  const tab = G._invTab || 'loot';
  const burnSum=$('burnSummary'), burnBtn=$('burnConfirm');
  if(tab==='equipment'){
    renderEquipmentPanel('invItems');
    if(burnSum) burnSum.style.display='none';
    if(burnBtn) burnBtn.style.display='none';
  } else if(tab==='food'){
    // #5 (v41) — Food tab shows the same bar/button, relabeled "EAT
    // SELECTED" and backed by G.eatQueue instead of G.burnQueue (see
    // renderStashPanel/updateEatBar/confirmEatSelected) so food can be
    // bulk-eaten but never burned.
    renderStashPanel('invItems','invEmpty',{readonly:false, filter:tab});
    if(burnSum) burnSum.style.display='';
    if(burnBtn) burnBtn.style.display='';
  } else {
    renderStashPanel('invItems','invEmpty',{readonly:false, filter:tab});
    if(burnSum) burnSum.style.display='';
    if(burnBtn) burnBtn.style.display='';
  }
  persistStashSnapshot();
}
// Mirror the player's current (unburned) stash into localStorage so the
// out-of-game Rewards screen (components/game/RewardsScreen.tsx) can show
// "items not yet burned" even though it renders outside this live canvas
// session and has no direct access to the G.inventory object. Keyed per
// wallet so it doesn't leak between accounts on a shared device.
function persistStashSnapshot(){
  if(!G || !WALLET_ADDRESS || typeof localStorage==='undefined') return;
  // CRITICAL (owner burn double-count): reconcile any out-of-game Rewards-screen
  // burns into G.inventory BEFORE writing the mirror. Without this, an item the
  // player already burned in the Rewards screen (recorded in the extburn queue)
  // gets re-written into the mirror from the still-stale live inventory here,
  // so it reappears in "Burn for Points" and can be burned again and again —
  // each time crediting server points. Reconciling first makes the mirror and
  // the live inventory agree, so a burned item can never resurrect.
  applyExternalBurns();
  try{
    const itemEntries = Object.values(G.inventory.items||{}).map(e=>({
      id: e.item.id, name: e.item.name, rarity: e.item.rarity, color: e.item.color,
      icon: e.item.icon, qty: e.qty, burnValue: e.item.burnValue,
    }));
    const snapshot = { items: itemEntries, updatedAt: Date.now() };
    localStorage.setItem('nullstate-stash-'+WALLET_ADDRESS.toLowerCase(), JSON.stringify(snapshot));
  }catch(e){ /* localStorage unavailable/full — non-critical, just skip */ }
}
// Reconcile burns the player made from the OUT-OF-GAME Rewards screen
// (components/game/RewardsScreen.tsx). That screen renders as its own phase
// with this engine unmounted, so it can't touch the live G.inventory — it
// credits the NullState Point server-side and records what it burned into a
// localStorage queue (`nullstate-extburn-<wallet>` = { [itemId]: qtyBurned }).
// On the next run load we subtract those quantities from the real stash so
// the same items can never be burned a second time in-game (double-credit).
// Fully guarded — a malformed/absent queue must never abort newGame().
function applyExternalBurns(){
  if(!G || !WALLET_ADDRESS || typeof localStorage==='undefined') return;
  const key='nullstate-extburn-'+WALLET_ADDRESS.toLowerCase();
  let queue=null;
  try{ const raw=localStorage.getItem(key); if(raw) queue=JSON.parse(raw); }catch(e){ queue=null; }
  if(!queue || typeof queue!=='object'){ return; }
  let changed=false;
  try{
    for(const [id,rawQty] of Object.entries(queue)){
      const qty=Math.max(0, Math.floor(Number(rawQty)||0));
      if(!qty) continue;
      const entry=G.inventory.items[id];
      if(!entry) continue;
      entry.qty-=qty;
      if(entry.qty<=0) delete G.inventory.items[id];
      changed=true;
    }
  }catch(e){ /* partial reconcile is fine — still clear the queue below */ }
  try{ localStorage.removeItem(key); }catch(e){ /* ignore */ }
  // NOTE: do NOT persistStashSnapshot() here — persistStashSnapshot() itself
  // calls this function first, so persisting here would recurse. Callers that
  // need the mirror rewritten (persistStashSnapshot / updateInventoryPanel) do
  // it right after. Returns whether anything changed for callers that care.
  return changed;
}
// Generic stash renderer, reused for both the player's own inventory panel
// (#invItems) and the read-only reference panel inside the container window
// (#containerPlayerItems, opts.readonly:true — no selection, no burn bar).
// Non-readonly rows now have TWO independent interactions:
//   - tap the item body (icon/name)  -> openItemZoom() -> instant single BURN
//   - tap the small circle in the corner (.inv-item-select) -> toggleBurnQueue()
//     -> adds/removes from the multi-select queue for "BURN SELECTED" below.
// They're separate hit targets (checkbox uses stopPropagation) so neither
// flow interferes with the other.
function renderStashPanel(targetId, emptyId, opts){
  opts=opts||{};
  const host=$(targetId), empty=emptyId?$(emptyId):null;
  if(!host || !G) return;
  host.classList.remove('equip-mode');
  // OWNER BUG: this panel clears itself by an explicit LIST of classes, not by
  // emptying the host. The vault-fragment bar was added with a class that was
  // not on that list, so nothing ever removed it and every re-render appended
  // another one — sixteen call sites, one bar each, until the player's actual
  // loot was pushed off the bottom of a scrolling panel and burning anything
  // meant scrolling past dozens of identical bars.
  //
  // Anything added to this panel from now on MUST be named here too.
  host.querySelectorAll('.equip-row,.equip-slotline').forEach(n=>n.remove());
  host.querySelectorAll('.inv-item,.inv-frag').forEach(n=>n.remove());
  const keyCount = G.inventory.keys||0;
  const paperCount = G.inventory.paper||0;
  const itemEntries = Object.values(G.inventory.items||{});
  const anything = keyCount+paperCount+itemEntries.length>0;
  // The grid itself is always shown as a fixed 5x5 (25-slot) layout, filled
  // out with empty placeholder cells — see fillGridPlaceholders(). The
  // "nothing here yet" text is redundant with a visibly empty grid, so it
  // only appears now if the grid host itself is missing from the DOM.
  if(empty) empty.style.display='none';
  let rowCount=0;
  // Issue 1 fix: addRow now returns the created element (or null when count
  // is 0) so we can wire click handlers below.  special=true adds
  // .inv-item-special which applies the gold-tinted border/glow styling
  // defined in globals.css, giving these four items instant visual read-
  // ability as non-ordinary loot.
  const addRow=(id,iconSrc,name,count,special=false)=>{
    if(count<=0) return null;
    const row=document.createElement('div');
    row.className='inv-item'+(special?' inv-item-special':'');
    row.dataset.id=id;
    // NO ×N badge — Golden Key / Old Paper are unique vault items (max one),
    // not stackable loot (owner). Distinct .inv-item-special background marks
    // them as special.
    row.innerHTML=`<img class="inv-item-icon" src="${iconSrc}" alt="${name}" draggable="false"><span class="inv-item-name">${name}</span>`;
    host.appendChild(row);
    rowCount++;
    return row;
  };
  // Golden Key + Old Paper are the special vault items — always FIRST in the
  // list, no count badge, distinct background. Relic + Null Shard are no longer
  // stored (auto-consumed on pickup, see applyLoot), so they're gone from here.
  const keyRow   = addRow('goldkey','/sprites/items/golden_key.png','Golden Key', opts.filter==='food'?0:keyCount, true);
  const paperRow = addRow('paper','/sprites/items/paper.png',        'Old Paper',  opts.filter==='food'?0:paperCount, true);
  // Issue 1 fix: ALL FOUR special items open the zoom overlay on tap, not
  // just Old Paper.  Paper keeps its existing 'paper-code' mode (live vault
  // code fetch).  Golden Key / Relic / Null Shard use the new 'special-item'
  // mode defined in openItemZoom() below.  Only wired on the non-readonly
  // panel (#invItems) — the read-only reference panel inside #containerWindow
  // remains interaction-free.
  if(!opts.readonly){
    if(keyRow)   keyRow.addEventListener(  'click',()=>openItemZoom({mode:'special-item',kind:'goldkey', count:keyCount}));
    if(paperRow) paperRow.addEventListener('click',()=>openItemZoom({mode:'paper-code'}));
  }
  // Vault fragment bar (GAME-DESIGN.md §5.1). Sits directly under the two
  // items it buys, because that is the only place it means anything: a bar
  // whose reward is off-screen is just a number. Shown only while something is
  // still missing — once both are held there is nothing left to fill.
  if(!opts.readonly && opts.filter!=='food' && VAULT_FRAG.loaded && VAULT_FRAG.nextGoal){
    const goal = VAULT_FRAG.nextGoal;
    const have = Math.min(VAULT_FRAG.fragments, goal.threshold);
    const pct  = Math.round((have/goal.threshold)*100);
    const row  = document.createElement('div');
    row.className = 'inv-frag';
    // Owner: the first version was too tall for what it says. One line — label,
    // count, and a hairline track underneath — instead of three. The "how do I
    // earn these" sentence moved to the title attribute; the vault door already
    // spells it out in full at the moment it actually matters.
    row.title = 'Open any lockable container to earn a fragment.';
    row.innerHTML =
      '<div class="inv-frag-top"><span class="inv-frag-label">Fragments → '+goal.label+'</span>'
      + '<span class="inv-frag-count">'+have+'/'+goal.threshold+'</span></div>'
      + '<div class="inv-frag-track"><span class="inv-frag-fill" style="width:'+pct+'%"></span></div>';
    host.appendChild(row);
    rowCount++;
  }
  for(const entry of itemEntries){
    const it=entry.item;
    const isFoodItem = !!(window.NS_MARKET && NS_MARKET.isFood(it.id));
    if(opts.filter==='food' && !isFoodItem) continue;
    if(opts.filter==='loot' && isFoodItem) continue;
    const row=document.createElement('div');
    row.className='inv-item'; row.dataset.id=it.id;
    row.style.borderColor=it.color;
    // #5 (v41) — Food rows get their OWN queue (G.eatQueue), completely
    // separate from G.burnQueue, so a food item can never end up in the
    // burn flow. Loot rows keep using burnQueue exactly as before.
    const queued = !opts.readonly && (isFoodItem ? G.eatQueue.has(it.id) : G.burnQueue.has(it.id));
    if(queued) row.classList.add('queued');
    const selectHtml = opts.readonly ? '' : `<span class="inv-item-select${queued?' checked':''}" data-select-id="${it.id}"></span>`;
    row.innerHTML=selectHtml+
      `<img class="inv-item-icon" src="${it.icon}" alt="${it.name}" draggable="false">`+
      `<span class="inv-item-name" style="color:${it.color}">${it.shortName||it.name}</span>`+
      `<span class="inv-item-count">×${entry.qty}</span>`;
    // Non-readonly (#invItems, the player's own stash): tapping the item
    // body (icon/name/count/value) opens the zoom overlay — instant single
    // BURN for loot, single EAT for food (see openItemZoom). The small
    // corner checkbox (.inv-item-select) is a SEPARATE hit target that
    // toggles the item in/out of a multi-select queue — burnQueue for loot
    // ("BURN SELECTED" below), eatQueue for food ("EAT SELECTED" below) —
    // so neither flow can ever cross into the other. The readonly reference
    // panel inside #containerWindow (#containerPlayerItems) intentionally
    // gets no click handler at all — it's just a "what's already in your
    // stash" reference while looting.
    if(!opts.readonly){
      row.addEventListener('click', (ev)=>{
        if(ev.target.closest('.inv-item-select')) return; // handled separately below
        openItemZoom({mode:'stash', itemId:it.id});
      });
      const selectEl=row.querySelector('.inv-item-select');
      if(selectEl){
        selectEl.addEventListener('click', (ev)=>{ ev.stopPropagation();
          if(isFoodItem) toggleEatQueue(it.id); else toggleBurnQueue(it.id); });
      }
    }
    host.appendChild(row);
    rowCount++;
  }
  fillGridPlaceholders(host, Math.max(0, (opts.gridSlots||GRID_SLOT_COUNT)-rowCount));
  // #5 (v41) — Food tab shows an EAT SELECTED summary instead of the BURN
  // SELECTED one; they read from completely separate queues (see below).
  if(!opts.readonly){ if(opts.filter==='food') updateEatBar(); else updateBurnBar(); }
}
function toggleBurnQueue(itemId){
  // Defensive: a food id should never reach here (food rows call
  // toggleEatQueue instead), but guard anyway so it can't enter the burn
  // queue no matter what triggers this function.
  if(window.NS_MARKET && NS_MARKET.isFood(itemId) && !G.burnQueue.has(itemId)) return;
  if(G.burnQueue.has(itemId)) G.burnQueue.delete(itemId);
  else G.burnQueue.add(itemId);
  // BUGFIX (v29): this re-render was missing `filter: G._invTab`, so tapping
  // the corner checkbox on ANY tab silently dropped back to showing every
  // item unfiltered — e.g. a Food-range item would flash into view while the
  // LOOT tab was active. updateInventoryPanel() always re-derives the filter
  // from G._invTab, so route through that instead of calling renderStashPanel
  // directly (which has no memory of which tab is active).
  updateInventoryPanel();
}
// #5 (v41) — Food-tab counterpart to toggleBurnQueue(), using its own
// G.eatQueue so a food selection can never be processed by confirmBurn().
function toggleEatQueue(itemId){
  if(window.NS_MARKET && !NS_MARKET.isFood(itemId)) return; // defensive: loot never enters eatQueue
  if(G.eatQueue.has(itemId)) G.eatQueue.delete(itemId);
  else G.eatQueue.add(itemId);
  updateInventoryPanel();
}
function updateBurnBar(){
  const bar=$('burnSummary'), btn=$('burnConfirm');
  if(!bar || !btn) return;
  btn.textContent='BURN SELECTED';
  const ids=[...G.burnQueue].filter(id=>G.inventory.items[id]);
  if(!ids.length){
    bar.textContent='Burn loot → NullState Points → craft & upgrade gear. Real USDT comes from the Vault & Season.';
    btn.disabled=true;
    return;
  }
  let total=0, count=0;
  for(const id of ids){ const e=G.inventory.items[id]; total+=e.item.burnValue*e.qty; count+=e.qty; }
  bar.textContent=`${count} item(s) selected · ${Math.round(total)} NullState Point`;
  btn.disabled=false;
}
// #5 (v41) — Food-tab counterpart to updateBurnBar(): same bar/button
// elements, repurposed to preview total HP healed by the queued food
// entries instead of a NullState Point payout.
function updateEatBar(){
  const bar=$('burnSummary'), btn=$('burnConfirm');
  if(!bar || !btn) return;
  btn.textContent='EAT SELECTED';
  const ids=[...G.eatQueue].filter(id=>G.inventory.items[id]);
  if(!ids.length){
    bar.textContent='Select food to eat.';
    btn.disabled=true;
    return;
  }
  const p=G.player; let totalHeal=0, count=0;
  for(const id of ids){
    const e=G.inventory.items[id];
    const frac = window.NS_MARKET ? NS_MARKET.foodHealFraction(e.item.rarity) : 0.03;
    totalHeal += Math.max(1, Math.round(p.maxHp*frac))*e.qty;
    count += e.qty;
  }
  bar.textContent=`${count} item(s) selected · ~${totalHeal} HP total`;
  btn.disabled=false;
}
// #5 (v41) — Eats every stack currently queued in G.eatQueue in full (each
// queued stack's whole qty, one eatFoodItem() call per unit — mirrors how
// confirmBurn() consumes a queued stack's whole qty in one go). Bound to
// #burnConfirm's click instead of confirmBurn() while the Food tab is
// active — see onInvConfirmClick() below.
function confirmEatSelected(){
  if(!G || !G.eatQueue.size) return;
  const ids=[...G.eatQueue];
  G.eatQueue.clear();
  for(const id of ids){
    let guard=0; // safety cap in case something keeps the entry alive unexpectedly
    while(G.inventory.items[id] && guard++<99){ eatFoodItem(id); }
  }
}
// #5 (v41) — #burnConfirm now serves both the Loot tab (BURN SELECTED) and
// the Food tab (EAT SELECTED); dispatch to the right handler based on which
// tab is active instead of wiring confirmBurn() directly.
function onInvConfirmClick(){
  if(G && G._invTab==='food') confirmEatSelected();
  else confirmBurn();
}
// Burn the currently-queued items. NullState Point is credited instantly
// (off-chain, Firestore-backed balance — see /api/burn/record) once the
// backend confirms the request; there is no weekly pool/claim step anymore
// (Phase 5.5 #8 — burns used to feed an on-chain USDm pool via
// NullStateReward.sol's recordBurn(), that call has been removed). This
// just clears the items from the local stash (optimistic) and reports the
// burn to the app shell via a CustomEvent that DungeonGameWrapper.tsx
// listens for.
function confirmBurn(){
  if(!G || !G.burnQueue.size) return;
  const items=[]; let totalValue=0;
  for(const id of [...G.burnQueue]){
    const entry=G.inventory.items[id]; if(!entry) continue;
    items.push({ id, name:entry.item.name, rarity:entry.item.rarity, qty:entry.qty, burnValue:entry.item.burnValue,
      icon:entry.item.icon, color:entry.item.color });
    totalValue += entry.item.burnValue*entry.qty;
    delete G.inventory.items[id];
  }
  G.burnQueue.clear();
  if(items.length){
    window.dispatchEvent(new CustomEvent('nullstate-items-burned', {
      detail: { wallet: WALLET_ADDRESS, items, totalValue: Math.round(totalValue), timestamp: Date.now() }
    }));
    log(`◆ ${items.length} item(s) converted · +${Math.round(totalValue)} NullState Point`, 'reward');
  }
  updateInventoryPanel();
}

// ---- item zoom overlay (Task 2: replaces per-slot instant-take / burn-queue
// toggle with a single "tap slot -> zoom -> confirm action" step) ----
// ctx shapes:
//   {mode:'container-loot', slotId, item, qty}  -> shows TAKE
//   {mode:'stash', itemId}                      -> shows BURN
//   {mode:'paper-code'}                         -> shows the live weekly
//                                                   vault code, close-only
//                                                   (Phase 5.5 #9B)
function openItemZoom(ctx){
  const overlay=$('itemZoom'); if(!overlay || !G) return;
  const icon=$('itemZoomIcon'), name=$('itemZoomName'), qtyEl=$('itemZoomQty'),
    codeEl=$('itemZoomCode'), valEl=$('itemZoomValue'), takeBtn=$('itemZoomTake'),
    burnBtn=$('itemZoomBurn'), closeBtn=$('itemZoomClose'), iconWrap=$('itemZoomIconWrap');
  // Issue 1 fix: 'special-item' mode — zoom for Golden Key, Relic, Null Shard.
  // Copy finalized per Yurk's decisions (session v48 follow-up):
  //   Golden Key -> flavor + live weekly claimed/available status
  //   Relic      -> plain explanation of the instant-consume/random-effect mechanic
  //   Null Shard -> flavor + current stack count + honest "no current use" note
  //                 (verified against the actual codebase: shards are tracked
  //                 in G.inventory.shards / gameSessionService.ts but are not
  //                 consumed anywhere yet — no vault/marketplace sink exists,
  //                 so the copy does not invent one)
  if(ctx.mode==='special-item'){
    if(ctx.kind==='goldkey'){
      if(icon)    { icon.src='/sprites/items/golden_key.png'; icon.alt='Golden Key'; }
      if(iconWrap)  iconWrap.classList.remove('paper-code');
      if(name)    { name.textContent='Golden Key'; name.style.color='#ffd166'; }
      if(qtyEl)     qtyEl.textContent='×'+ctx.count+' in your inventory';
      if(codeEl)    codeEl.classList.add('hidden');
      // Live weekly status, same source used by refreshGoldenKeyWeeklyStatus()/
      // NS_GOLDKEY — no separate fetch needed, GOLDKEY_WEEK is already kept
      // fresh at run start.
      const gkStatus = !GOLDKEY_WEEK.loaded
        ? 'Checking this week\u2019s status\u2026'
        : (GOLDKEY_WEEK.canClaim ? 'Available this week \u2014 not yet claimed.' : 'Already claimed this week.');
      if(valEl)     valEl.textContent='1 per wallet per week. Bring this to the Sealed Vault. '+gkStatus;
      if(takeBtn)   takeBtn.classList.add('hidden');
      if(burnBtn)   burnBtn.classList.add('hidden');
      if(closeBtn)  closeBtn.textContent='▾ close';
      G._zoomCtx=ctx;
      overlay.classList.remove('hidden');
      return;
    }
    if(ctx.kind==='relic'){
      if(icon)    { icon.src='/sprites/items/relic.png'; icon.alt='Relic'; }
      if(iconWrap)  iconWrap.classList.remove('paper-code');
      if(name)    { name.textContent='Relic'; name.style.color='#c69aff'; }
      if(qtyEl)     qtyEl.textContent='Absorbed '+ctx.count+' total';
      if(codeEl)    codeEl.classList.add('hidden');
      if(valEl)     valEl.textContent='Consumed instantly on pickup — it is not stored for later use. Each Relic randomly grants one of: +DMG, a heal, +Speed, or a Null Shard.';
      if(takeBtn)   takeBtn.classList.add('hidden');
      if(burnBtn)   burnBtn.classList.add('hidden');
      if(closeBtn)  closeBtn.textContent='▾ close';
      G._zoomCtx=ctx;
      overlay.classList.remove('hidden');
      return;
    }
    if(ctx.kind==='shard'){
      if(icon)    { icon.src='/sprites/items/shard.png'; icon.alt='Null Shard'; }
      if(iconWrap)  iconWrap.classList.remove('paper-code');
      if(name)    { name.textContent='Null Shard'; name.style.color='#88eeff'; }
      if(qtyEl)     qtyEl.textContent='×'+ctx.count+' in your inventory';
      if(codeEl)    codeEl.classList.add('hidden');
      if(valEl)     valEl.textContent='A fragment left behind by an absorbed Relic. It has no use yet — no vault, marketplace, or crafting sink currently accepts it.';
      if(takeBtn)   takeBtn.classList.add('hidden');
      if(burnBtn)   burnBtn.classList.add('hidden');
      if(closeBtn)  closeBtn.textContent='▾ close';
      G._zoomCtx=ctx;
      overlay.classList.remove('hidden');
      return;
    }
    return;
  }
  if(ctx.mode==='paper-code'){
    // Large hand-cleaned parchment art (Phase 5.5 #9B v25) — NOT the same
    // file as the 16x16 pixel-art paper.png used in the inventory grid /
    // container loot window; this one is sized for the big overlay so it
    // doesn't get blurry being upscaled from a tiny sprite.
    if(icon){ icon.src='/sprites/items/paper-scroll-large.png'; icon.alt='Old Paper'; }
    if(iconWrap) iconWrap.classList.add('paper-code');
    if(name){ name.textContent='Old Paper'; name.style.color='#c9a86a'; }
    if(qtyEl) qtyEl.textContent='A weathered scrap, folded shut.';
    if(codeEl){ codeEl.textContent='····'; codeEl.classList.remove('hidden'); }
    if(valEl) valEl.textContent='Take this code to the Vault Room.';
    if(takeBtn) takeBtn.classList.add('hidden');
    if(burnBtn) burnBtn.classList.add('hidden');
    if(closeBtn) closeBtn.textContent='OK';
    G._zoomCtx=ctx;
    overlay.classList.remove('hidden');
    // Issue 3 fix (session v49) — root cause confirmed by tracing the full
    // data flow:
    //   1. G.inventory.paper is ONLY ever incremented (applyLoot 'paper' case)
    //      or restored from a save snapshot. Nothing anywhere decrements,
    //      consumes, or expires it — once a player has Paper, they hold it
    //      forever across saves and across ISO-week boundaries.
    //   2. The server-side claim record this endpoint checks is scoped to
    //      paperClaims/{weekId}/{wallet} for ONE SPECIFIC week (see
    //      /api/paper/status route.ts) — /api/paper/status always evaluates
    //      against the CURRENT week, not whichever week the held Paper copy
    //      was actually found in.
    //   3. NS_PAPER.take() (props.js rollLootSlots()) fires the
    //      /api/paper/claim POST as fire-and-forget the moment a container's
    //      loot table rolls a Paper slot — with no retry and no correlation
    //      back to the specific item instance if that request is slow,
    //      offline, or silently fails.
    // Net effect: a player who legitimately found Paper in a PAST week (kept
    // across a save/resume or simply because the week rolled over before
    // they visited the Vault), OR whose claim POST silently failed at pickup
    // time, sees a PERMANENT '????' with zero way to recover — exactly the
    // reported bug. There was no data corruption and no intentional masking;
    // option (B) from the original issue applies: the code exists (or CAN
    // exist) but the claim linkage the client relies on to unlock it never
    // got (re)established for the current week.
    // Fix: holding the physical Paper item IS the proof of entitlement to
    // view the current week's code, so on a 'claimed:false' response, this
    // now self-heals by calling /api/paper/claim (the existing transaction-
    // safe, idempotent, 1-per-wallet-per-week endpoint — cannot be
    // re-claimed or farmed since it aborts if already committed for the
    // week) and then re-fetching status once. This does NOT change the
    // weekly-cap anti-farm mechanic or the vault-submit reward logic at all
    // — it only repairs the self-recovery path for a wallet that should
    // already be entitled to see the code but never got the claim recorded.
    // NOTE: this does not change item lifecycle (Paper still never expires
    // or gets consumed) — that's a separate game-design question flagged
    // for Yurk in the session's next-steps doc, not something silently
    // decided here.
    const revealCode = (data) => {
      if(!codeEl || overlay.classList.contains('hidden')) return; // closed before it resolved
      codeEl.textContent = (data && data.code) ? data.code : '????';
    };
    if(WALLET_ADDRESS){
      const statusUrl = '/api/paper/status?walletAddress='+encodeURIComponent(WALLET_ADDRESS);
      fetch(statusUrl)
        .then(r=>r.json())
        .then(data=>{
          if(data && data.code){ revealCode(data); return; }
          // Not claimed for the current week per the server, but the player
          // is holding a physical Paper item right now (that's the only way
          // this modal can be open) — self-heal by claiming this week too,
          // then re-check status once. Safe to call unconditionally: the
          // claim endpoint is a no-op (alreadyClaimed:true) if some other
          // path already claimed this week for this wallet.
          if(!WALLET_ADDRESS || overlay.classList.contains('hidden')) { revealCode(data); return; }
          fetch('/api/paper/claim', {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ wallet: WALLET_ADDRESS })
          }).then(()=>fetch(statusUrl)).then(r=>r.json()).then(revealCode).catch(()=>revealCode(null));
        }).catch(()=>revealCode(null));
    } else revealCode(null);
    return;
  }
  let item, qty;
  if(ctx.mode==='container-loot'){
    item=ctx.item; qty=ctx.qty;
  } else if(ctx.mode==='stash'){
    const entry=G.inventory.items[ctx.itemId]; if(!entry) return;
    item=entry.item; qty=entry.qty;
  } else return;
  if(iconWrap) iconWrap.classList.remove('paper-code');
  if(icon){ icon.src=item.icon; icon.alt=item.name; }
  if(name){ name.textContent=item.name; name.style.color=item.color||''; }
  if(qtyEl) qtyEl.textContent=`×${qty}`;
  if(codeEl) codeEl.classList.add('hidden');
  // Food items (loot ids in NS_MARKET.FOOD_RANGES) get an EAT action on the
  // TAKE button instead of hiding it. #5 (v41) — food is EAT-only now: the
  // BURN button below is hidden for food (previously it stayed visible,
  // letting a food item be burned instead of eaten), and the "NullState
  // Point each" burn-value line is blanked out too since it no longer
  // applies to this item.
  const isFoodItem = ctx.mode==='stash' && window.NS_MARKET && NS_MARKET.isFood(item.id);
  if(valEl) valEl.textContent = isFoodItem ? '' : `${Math.round(item.burnValue)} NullState Point each`;
  if(takeBtn){
    if(ctx.mode==='container-loot'){ takeBtn.classList.remove('hidden'); takeBtn.textContent='TAKE'; }
    else if(isFoodItem){ const pct=Math.round(NS_MARKET.foodHealFraction(item.rarity)*100);
      takeBtn.classList.remove('hidden'); takeBtn.textContent='EAT +'+pct+'% HP'; }
    else { takeBtn.classList.add('hidden'); }
  }
  if(burnBtn) burnBtn.classList.toggle('hidden', ctx.mode!=='stash' || isFoodItem);
  if(closeBtn) closeBtn.textContent='▾ close';
  G._zoomCtx=ctx;
  overlay.classList.remove('hidden');
}
function closeItemZoom(){
  const overlay=$('itemZoom'); if(overlay) overlay.classList.add('hidden');
  if(G) G._zoomCtx=null;
}
function onItemZoomTake(){
  if(!G || !G._zoomCtx) return;
  if(G._zoomCtx.mode==='container-loot'){ takeContainerSlot(G._zoomCtx.slotId); closeItemZoom(); return; }
  if(G._zoomCtx.mode==='stash'){ eatFoodItem(G._zoomCtx.itemId); closeItemZoom(); return; }
}
function onItemZoomBurn(){
  if(!G || !G._zoomCtx || G._zoomCtx.mode!=='stash') return;
  burnSingleItem(G._zoomCtx.itemId);
  closeItemZoom();
}
// Burns exactly one stash entry (all of its qty) immediately — no queue,
// no multi-select. Mirrors confirmBurn()'s event shape/dispatch exactly
// (same 'nullstate-items-burned' CustomEvent) so it lands in Rewards
// History the same way a queued burn would, just with a single-item array.
function burnSingleItem(itemId){
  if(!G) return;
  const entry=G.inventory.items[itemId]; if(!entry) return;
  const items=[{ id:itemId, name:entry.item.name, rarity:entry.item.rarity, qty:entry.qty, burnValue:entry.item.burnValue,
    icon:entry.item.icon, color:entry.item.color }];
  const totalValue=entry.item.burnValue*entry.qty;
  delete G.inventory.items[itemId];
  G.burnQueue.delete(itemId);
  window.dispatchEvent(new CustomEvent('nullstate-items-burned', {
    detail: { wallet: WALLET_ADDRESS, items, totalValue: Math.round(totalValue), timestamp: Date.now() }
  }));
  log(`◆ ${entry.item.name} converted · +${Math.round(totalValue)} NullState Point`, 'reward');
  updateInventoryPanel();
}
// ======================================================================
//  MARKETPLACE EQUIPMENT + FOOD  (Phase 2 engine wiring)
// ----------------------------------------------------------------------
//  Equipment is PERMANENT and offchain-owned (see marketplace-items.js /
//  Firebase). applyEquipment() adds/removes the equipped gear's bonuses as a
//  DELTA on top of the player's current stats, so it never clobbers level-up
//  or relic gains. Weapon = flat atk bonus (+ behavior handled in hitTest);
//  armor = % Max HP multiplier.
// ======================================================================
// Phase 4 — per-weapon evolution tier, bridged in from React (GET /api/weapons)
// via NS_EQUIP.setTiers. Keyed by CANONICAL marketplace item id; missing/1 =
// base tier. Read by applyEquipment() above.
let WEAPON_TIERS = {};
// Phase 8 — owned Premium Sector Blueprints, bridged from React
// (GET /api/blueprints) via NS_EQUIP.setBlueprints. Keyed by sectorId
// ('sector_1'..'sector_5'); truthy = owned. Read by ensureFloor() to spawn a
// guaranteed premium cache on that act's first floor. Never gates core acts.
let OWNED_SECTORS = {};
function applyEquipment(p){
  if(!p) return;
  const eq = (G && G.equipment) ? G.equipment.equipped : { mainhand:null, body:null, outfit:null };
  const M  = window.NS_MARKET;
  const w  = (M && eq.mainhand) ? M.getEquipment(eq.mainhand) : null;
  const a  = (M && eq.body)     ? M.getEquipment(eq.body)     : null;
  // Phase 9: the outfit slot is READ ONLY for its render id below — it is never
  // consulted for atk/HP, so a cosmetic skin can never affect combat.

  const prev = p._equipDelta || { atk:0, hpMul:1 };
  // 1) remove the previously-applied equipment delta
  p.atkDmg -= prev.atk;
  const baseMaxNoArmor = Math.round(p.maxHp / (prev.hpMul || 1));
  // Phase 4 — weapon evolution tier. The wallet's per-weapon tier is bridged
  // in from React via NS_EQUIP.setTiers (WEAPON_TIERS, keyed by canonical item
  // id). Each tier ABOVE base adds evolutionTiers[i].atkBonusDelta (ADDITIVE,
  // NEVER HP — the flat-100 cap is untouched) and a hotter tint/glow override
  // for the render path. tier 1 (base) = no delta, byte-identical to pre-Phase-4.
  let _tierDelta = 0, _wTier = 1, _ovlTintOv = null, _glowOv = null, _fxOv = null;
  // Phase 8 — traversal utilities granted by the reached tiers (open sealed
  // caches). Recomputed from scratch each apply so unequipping removes them.
  const _utils = [];
  if(w && Array.isArray(w.evolutionTiers) && w.evolutionTiers.length){
    const _owned = Math.max(1, (WEAPON_TIERS[w.id] | 0) || 1);
    _wTier = Math.min(_owned, w.evolutionTiers.length + 1); // clamp to this weapon's max
    for(let _i = 0; _i < _wTier - 1; _i++){
      const _st = w.evolutionTiers[_i] || {};
      _tierDelta += (_st.atkBonusDelta || 0);
      if(_st.spriteOverrideTint) _ovlTintOv = _st.spriteOverrideTint;
      if(_st.fxColorOverride)    _fxOv      = _st.fxColorOverride;
      if(_st.glowOverride)       _glowOv    = _st.glowOverride;
      if(_st.unlockUtility && _utils.indexOf(_st.unlockUtility) < 0) _utils.push(_st.unlockUtility);
    }
  }
  p.unlockedUtilities = _utils; // Phase 8 — read by sealed-cache interaction
  // 2) compute + apply new delta
  const atkBonus = (w ? (w.effect.atkBonus || 0) : 0) + _tierDelta;
  const hpMul    = a ? (1 + (a.effect.hpBonus || 0)) : 1;
  p.atkDmg += atkBonus;
  const oldMax = p.maxHp;
  const newMax = Math.max(1, Math.round(baseMaxNoArmor * hpMul));
  p.maxHp = newMax;
  if(newMax > oldMax) p.hp = Math.min(newMax, p.hp + (newMax - oldMax)); // armor grants the extra HP
  else p.hp = Math.min(p.hp, newMax);
  p._equipDelta = { atk:atkBonus, hpMul:hpMul };
  // exposed to entities.js draw() for FX flavor / intensity (Phase 5 polish)
  p._fxTier = w ? (w.fxTier || 1) : 1;
  p._weaponBehavior = w ? (w.effect.behavior || null) : null;
  // v67 T11: per-weapon FX color (marketplace fxColor). null when unarmed —
  // entities.js swing arcs + the arrow renderer below fall back to their
  // original hardcoded palettes in that case. Phase 4: an evolved weapon
  // burns hotter — the tier's fxColorOverride wins when present.
  p._fxColor = _fxOv || (w ? (w.fxColor || null) : null);
  // v76 Task #7: which synthesized attack sound this weapon uses. Sourced from
  // the RENDER config (NS_WEAPON in assets.js) rather than the marketplace item
  // so sound, sprite and swing motion can never drift apart — they are all one
  // entry. null -> hitTest falls back to the generic unarmed whoosh.
  {
    const _A = window.NS_ASSETS;
    const _wd = (_A && _A.NS_WEAPON && eq.mainhand) ? _A.NS_WEAPON[eq.mainhand] : null;
    p._weaponSfx = _wd ? (_wd.sfx || null) : null;
    // v77: hits-to-kill a normal enemy for this weapon (4 cheap / 3 mid / 2 top).
    // null when unarmed -> hitTest uses flat atkDmg like before.
    p._weaponHtk = _wd ? (_wd.htk || null) : null;
    // premium glow colour for the on-hit impact FX (matches the carried aura).
    // Phase 4: an evolved weapon gains/upgrades its aura via glowOverride even
    // if the base weapon had no NS_WEAPON.glow.
    p._weaponGlow = _glowOv || (_wd ? (_wd.glow || null) : null);
  }
  // Phase 4 — evolution render overrides consumed by entities.js:
  //   _wpnOvlTint -> drawLPCComposite opts.weaponTint (masked wash on the
  //     carried weapon sprite; overrides NS_WEAPON.ovlTint at a stronger amt).
  //   _wpnTier    -> exposed for HUD/inventory + future FX intensity tuning.
  // Both are null/1 at base tier, so the pre-Phase-4 look is unchanged.
  p._wpnOvlTint = _ovlTintOv;
  p._wpnTier = _wTier;
  // Phase 5.3 Task 5: gear VISUALS (separate from the stat deltas above).
  // eq.mainhand/eq.body are item ids, same ones LPC_ARMOR/NS_WEAPON in
  // assets.js are keyed by — see drawLPCComposite() in entities.js.
  p.equippedArmorId = eq.body || null;
  p.equippedWeaponId = eq.mainhand || null;
  // Phase 9: cosmetic skin id -> drawLPCComposite opts.outfitId (entities.js).
  // Purely a render key; carries no stat. null when no skin equipped.
  p.equippedOutfitId = eq.outfit || null;
}
function equipItem(id){
  if(!G || !window.NS_MARKET) return false;
  const item = NS_MARKET.getEquipment(id); if(!item) return false;
  if(!G.equipment.owned.includes(id)) return false; // must own it first
  G.equipment.equipped[item.slot] = id;
  applyEquipment(G.player);
  if(typeof updateHUD==='function') updateHUD();
  if(typeof updateInventoryPanel==='function') updateInventoryPanel();
  if(typeof window.NS_saveEquipment==='function') window.NS_saveEquipment(G.equipment);
  return true;
}
function unequipSlot(slot){
  if(!G || !G.equipment.equipped[slot]) return;
  // TASK B — the weapon slot can never be emptied: unequipping the mainhand
  // (or the default weapon itself) falls back to the free default weapon so the
  // player is never left weaponless. Armor/skin slots unequip to null as before
  // (the default skin renders automatically via the composite fallback).
  if(slot === 'mainhand' && G.equipment.equipped[slot] !== DEFAULT_WEAPON_ID){
    G.equipment.equipped[slot] = DEFAULT_WEAPON_ID;
  } else if(slot === 'mainhand'){
    return; // already the default weapon — keep it, there is nothing "lower".
  } else {
    G.equipment.equipped[slot] = null;
  }
  applyEquipment(G.player);
  if(typeof updateHUD==='function') updateHUD();
  if(typeof updateInventoryPanel==='function') updateInventoryPanel();
  if(typeof window.NS_saveEquipment==='function') window.NS_saveEquipment(G.equipment);
}
function setOwnedEquipment(list){
  if(!G) return;
  const owned = Array.isArray(list) ? list.slice() : [];
  // Preserve the free grants that never come from the server owned list:
  // the default weapon (TASK B) and, for pass holders, the exclusive skin
  // (TASK #7) — otherwise a live shop push would drop them from the Gear tab.
  if(!owned.includes(DEFAULT_WEAPON_ID)) owned.unshift(DEFAULT_WEAPON_ID);
  if(PASS_HOLDER && !owned.includes(PASS_EXCLUSIVE_SKIN_ID)) owned.push(PASS_EXCLUSIVE_SKIN_ID);
  G.equipment.owned = owned;
  if(typeof updateInventoryPanel==='function') updateInventoryPanel();
}
// TASK #7 — receive active Season-Pass holder status from React (bridged in
// DungeonGame right after the perks fetch resolves). When true, grant the
// exclusive skin for free by folding it into the live owned list so it can be
// equipped immediately, and persist the flag so the next run's synchronous
// loadPersistedEquipment() grants it too. Cosmetic only — never touches stats.
function setPassHolder(v){
  PASS_HOLDER = !!v;
  try{
    if(WALLET_ADDRESS && typeof localStorage !== 'undefined'){
      localStorage.setItem('nullstate-pass-'+WALLET_ADDRESS.toLowerCase(), PASS_HOLDER ? '1' : '0');
    }
  }catch(e){ /* storage unavailable — the live grant below still applies */ }
  if(G && G.equipment){
    const owned = G.equipment.owned || (G.equipment.owned = []);
    if(PASS_HOLDER && window.NS_MARKET && window.NS_MARKET.getEquipment(PASS_EXCLUSIVE_SKIN_ID) && !owned.includes(PASS_EXCLUSIVE_SKIN_ID)){
      owned.push(PASS_EXCLUSIVE_SKIN_ID);
      if(typeof updateInventoryPanel==='function') updateInventoryPanel();
    }
    // If the flag flips false mid-session we intentionally leave an already
    // equipped skin alone (harmless cosmetic) — it re-validates on next load.
  }
}
// Phase 4 — receive the wallet's weapon-tier map from React and re-apply so the
// equipped weapon's atk + tint/glow reflect its evolution level immediately.
function setWeaponTiers(map){
  WEAPON_TIERS = (map && typeof map === 'object') ? map : {};
  if(G && G.player) applyEquipment(G.player);
  if(typeof updateHUD==='function') updateHUD();
  if(typeof updateInventoryPanel==='function') updateInventoryPanel();
}
// Phase 8 — receive owned Premium Sector Blueprints from React. Accepts either
// an array of sectorIds or a { sectorId: true } map.
function setOwnedSectors(list){
  const m = {};
  if(Array.isArray(list)) list.forEach(id => { if(id) m[String(id)] = true; });
  else if(list && typeof list === 'object') Object.keys(list).forEach(id => { if(list[id]) m[id] = true; });
  OWNED_SECTORS = m;
}
// Phase 7 — narrative hook. Called by the outdoor scene (outdoor.js) as an act's
// arrival beat begins. If the equipped weapon has reached an evolution tier the
// player hasn't been "greeted" about yet, returns this act's onWeaponEvolve
// bark (1-2 lines) to append to the arrival bubbles, and marks that tier
// acknowledged (per wallet + weapon, localStorage) so the line shows exactly
// once per new tier. Returns [] when there's nothing new — reframes evolved
// weapons as "decryption tools" threading the existing key/corruption arc.
function takeEvolveBark(actIndex){
  try{
    const camp = window.NS_CAMPAIGN;
    const act = camp && camp[actIndex];
    const lines = act && act.onWeaponEvolve;
    if(!lines || !lines.length) return [];
    const M = window.NS_MARKET;
    const eqId = (G && G.equipment && G.equipment.equipped && G.equipment.equipped.mainhand) || null;
    if(!eqId || !M) return [];
    const item = M.getEquipment(eqId);
    if(!item) return [];
    const canonId = item.id;
    const tier = Math.max(1, (WEAPON_TIERS[canonId] | 0) || 1);
    if(tier < 2) return [];                       // not evolved yet
    const key = 'nullstate-evobark-' + (WALLET_ADDRESS ? WALLET_ADDRESS.toLowerCase() : 'anon') + '-' + canonId;
    let ack = 0;
    try{ ack = parseInt(localStorage.getItem(key) || '0', 10) || 0; }catch(e){ ack = 0; }
    if(tier <= ack) return [];                    // already barked for this tier
    try{ localStorage.setItem(key, String(tier)); }catch(e){ /* storage full — bark once anyway */ }
    return lines.slice(0, 2);
  }catch(e){ return []; }
}
window.NS_takeEvolveBark = takeEvolveBark;
// Eat a food loot item (heal % of Max HP by rarity, consume one).
function eatFoodItem(itemId){
  if(!G) return;
  const entry = G.inventory.items[itemId]; if(!entry) return;
  const p = G.player;
  const frac = window.NS_MARKET ? NS_MARKET.foodHealFraction(entry.item.rarity) : 0.03;
  const heal = Math.max(1, Math.round(p.maxHp * frac));
  const before = p.hp;
  p.hp = Math.min(p.maxHp, p.hp + heal);
  const gained = Math.round(p.hp - before);
  lootText(p.x, p.y-30, '+'+gained+' HP', '#3dff88');
  spark(p.x, p.y-14, '#3dff88', 16, 150);
  const name = entry.item.name;
  entry.qty -= 1;
  if(entry.qty <= 0){ delete G.inventory.items[itemId]; G.burnQueue.delete(itemId); G.eatQueue.delete(itemId); }
  if(A && A.pickup) A.pickup();
  log('Ate '+name+' \u2014 +'+gained+' HP', 'reward');
  if(typeof updateHUD==='function') updateHUD();
  updateInventoryPanel();
}
// Persists which item is worn in each slot, keyed per wallet, so an
// equip/unequip choice survives leaving the dungeon and coming back.
// equipItem()/unequipSlot() above already called `window.NS_saveEquipment`
// on every change, but nothing ever actually defined it (only guarded with
// `typeof ... === 'function'`), so it silently no-op'd — every equip
// choice was lost the moment the run ended. loadPersistedEquipment() near
// newGame() reads the localStorage copy back in on the next run.
//
// Writes to TWO places:
//  - localStorage (instant, synchronous — what loadPersistedEquipment()
//    actually reads, so equip feels instant with zero network wait)
//  - Firebase, via /api/marketplace/equip (fire-and-forget) — this is what
//    makes the choice survive a MiniPay uninstall/reinstall or a switch to
//    a different device, the same way purchased items already do via
//    marketplaceOwned. Without this second write, equip choices would only
//    ever live in this one HP's local storage and reset to "nothing
//    equipped" (while the owned items themselves stayed intact) the moment
//    that storage was cleared.
window.NS_saveEquipment = function(equipment){
  const eq = (equipment && equipment.equipped) || {};
  // Phase 9: persist the cosmetic outfit slot alongside weapon/armor in BOTH
  // localStorage and Firebase (via /api/marketplace/equip), same as the other
  // two slots — otherwise a chosen skin would reset on device/storage change.
  const payload = { mainhand: eq.mainhand || null, body: eq.body || null, outfit: eq.outfit || null };
  if(WALLET_ADDRESS && typeof localStorage !== 'undefined'){
    try{
      localStorage.setItem('nullstate-equipped-'+WALLET_ADDRESS.toLowerCase(), JSON.stringify(payload));
    }catch(e){ /* storage full/unavailable — non-critical, just skip */ }
  }
  if(WALLET_ADDRESS && typeof fetch === 'function'){
    fetch('/api/marketplace/equip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet: WALLET_ADDRESS, mainhand: payload.mainhand, body: payload.body, outfit: payload.outfit }),
    }).catch(()=>{ /* offline — localStorage copy above still applies this session */ });
  }
};
// Public API for the React shell / Marketplace UI (Phase 4) to drive equipment.
window.NS_EQUIP = {
  equip: equipItem,
  unequip: unequipSlot,
  setOwned: setOwnedEquipment,
  setTiers: setWeaponTiers,   // Phase 4 — weapon evolution tier bridge
  setBlueprints: setOwnedSectors, // Phase 8 — Premium Sector ownership bridge
  setPassHolder: setPassHolder, // TASK #7 — Season-Pass exclusive-skin grant
  apply: applyEquipment,
  eat: eatFoodItem,
  get: function(){ return G ? G.equipment : null; },
};

// Equipment tab renderer — owned gear list with Equip/Unequip, plus the
// currently-equipped weapon/armor summary. Renders into #invItems (switched
// to single-column via the .equip-mode class).
function renderEquipmentPanel(targetId){
  const host=$(targetId); if(!host || !G) return;
  host.classList.add('equip-mode');
  host.querySelectorAll('.inv-item,.equip-row,.equip-slotline').forEach(n=>n.remove());
  const M=window.NS_MARKET; const eq=G.equipment;
  const w = (eq.equipped.mainhand && M) ? M.getEquipment(eq.equipped.mainhand) : null;
  const a = (eq.equipped.body && M) ? M.getEquipment(eq.equipped.body) : null;
  const o = (eq.equipped.outfit && M) ? M.getEquipment(eq.equipped.outfit) : null; // Phase 9 skin
  const slotLine=document.createElement('div'); slotLine.className='equip-slotline';
  // TASK B \u2014 the weapon slot is never empty (defaults to the free weapon) and
  // the SKIN slot shows "Default" (the free default skin) when no paid skin is
  // worn, so the loadout never reads as "empty / naked".
  slotLine.innerHTML =
    `<div class="equip-slot"><span class="equip-slot-k">\u2694 WEAPON</span><span class="equip-slot-v">${w?w.name:'\u2014 empty'}</span></div>`+
    `<div class="equip-slot"><span class="equip-slot-k">\u26e8 ARMOR</span><span class="equip-slot-v">${a?a.name:'\u2014 empty'}</span></div>`+
    `<div class="equip-slot"><span class="equip-slot-k">\u2726 SKIN</span><span class="equip-slot-v">${o?o.name:'Default'}</span></div>`;
  host.appendChild(slotLine);
  // Always fold in the free grants so they're listed even after a live
  // NS_EQUIP.setOwned push from the React shop replaced owned: the default
  // weapon (TASK B) for everyone, and the exclusive skin (TASK #7) for holders.
  const owned = (eq.owned||[]).slice();
  if(!owned.includes(DEFAULT_WEAPON_ID)) owned.unshift(DEFAULT_WEAPON_ID);
  if(PASS_HOLDER && M && M.getEquipment(PASS_EXCLUSIVE_SKIN_ID) && !owned.includes(PASS_EXCLUSIVE_SKIN_ID)){
    owned.push(PASS_EXCLUSIVE_SKIN_ID);
  }
  // v72 (user finding #1): the gear list is now split into two sections —
  // EQUIPPED (max 2: the weapon + armor currently worn) pinned at the TOP,
  // a divider line, then everything the wallet owns but is NOT wearing
  // below it — instead of one mixed list where the equipped pieces sat
  // wherever purchase order happened to put them.
  const buildRow = (it, on)=>{
    const stat = it.type==='armor'  ? `+${Math.round((it.effect.hpBonus||0)*100)}% HP`
               : it.type==='outfit' ? 'Cosmetic · no stats'
                                    : `+${it.effect.atkBonus||0} ATK`;
    const row=document.createElement('div'); row.className='equip-row'+(on?' equipped':'');
    row.innerHTML =
      `<img class="equip-icon" src="${it.sprite}" alt="${it.name}" draggable="false" onerror="this.classList.add('missing')">`+
      `<div class="equip-info"><span class="equip-name">${it.name}</span>`+
      `<span class="equip-stat">${stat} \u00b7 ${it.type}</span></div>`+
      `<button class="equip-btn${on?' on':''}" data-equip="${it.id}">${on?'UNEQUIP':'EQUIP'}</button>`;
    return row;
  };
  const items = owned.map(id => M ? M.getEquipment(id) : null).filter(Boolean);
  const equippedItems   = items.filter(it => eq.equipped[it.slot]===it.id);
  const unequippedItems = items.filter(it => eq.equipped[it.slot]!==it.id);
  const sect = (label)=>{
    const h=document.createElement('div'); h.className='equip-row equip-sect';
    h.textContent=label; return h;
  };
  host.appendChild(sect('EQUIPPED \u00b7 '+equippedItems.length+'/3'));
  if(equippedItems.length){
    for(const it of equippedItems) host.appendChild(buildRow(it, true));
  } else {
    const e=document.createElement('div'); e.className='equip-row equip-empty';
    e.textContent='Nothing equipped \u2014 tap EQUIP on your gear below.';
    host.appendChild(e);
  }
  const div=document.createElement('div'); div.className='equip-row equip-divider';
  host.appendChild(div);
  host.appendChild(sect('OWNED \u00b7 NOT EQUIPPED'));
  if(unequippedItems.length){
    // Owner: the owned list mixed weapons, armor and skins together. Group it
    // by slot so each category is its own labelled block instead of one
    // jumble. Order: Weapons -> Armor -> Skins -> anything unknown.
    const KNOWN=['mainhand','body','outfit'];
    const groups=[
      ['\u2694 WEAPONS', unequippedItems.filter(it=>it.slot==='mainhand')],
      ['\u26e8 ARMOR',   unequippedItems.filter(it=>it.slot==='body')],
      ['\u2726 SKINS',   unequippedItems.filter(it=>it.slot==='outfit')],
      ['\u25c6 OTHER',   unequippedItems.filter(it=>!KNOWN.includes(it.slot))],
    ];
    for(const [label,list] of groups){
      if(!list.length) continue;
      const sh=document.createElement('div'); sh.className='equip-row equip-sect equip-subsect';
      sh.textContent=label; host.appendChild(sh);
      for(const it of list) host.appendChild(buildRow(it, false));
    }
  } else {
    const e=document.createElement('div'); e.className='equip-row equip-empty';
    e.textContent='Everything you own is equipped.';
    host.appendChild(e);
  }
  host.querySelectorAll('[data-equip]').forEach(btn=>{
    btn.addEventListener('click',(ev)=>{
      ev.stopPropagation();
      const id=btn.getAttribute('data-equip'); const it=M?M.getEquipment(id):null; if(!it) return;
      if(G.equipment.equipped[it.slot]===id) unequipSlot(it.slot); else equipItem(id);
    });
  });
}
function setInvTab(tab){
  if(!G) return;
  G._invTab = tab;
  document.querySelectorAll('.inv-tab').forEach(b=>b.classList.toggle('active', b.getAttribute('data-tab')===tab));
  updateInventoryPanel();
}

function onInvToggle(){
  const panel=$('invPanel');
  panel.classList.toggle('hidden');
  if(!panel.classList.contains('hidden')) setInvTab(G && G._invTab ? G._invTab : 'loot');
}
// #6 (v41) — laporan asli user: log dulu nge-stack sampai 5 baris
// (while(children.length>5)) dan numpuk nutupin karakter/analog stick.
// Sekarang cuma SATU baris hidup di satu waktu: pesan baru langsung
// gantiin pesan lama (box.innerHTML='' dulu, baru append), dan timer
// fade-out lama (kalau masih jalan) dibatalin biar gak nyoba fade-out
// elemen yang udah kehapus. gantian: tampil -> (5.2s) -> fade 0.6s ->
// hilang -> (pesan berikutnya) tampil lagi, persis kayak yang diminta.
let logLineTO=null;
function log(text,type='dm',icon){
  const box=$('log'); if(!box) return;
  clearTimeout(logLineTO);
  box.innerHTML='';
  const el=document.createElement('div'); el.className='line '+type;
  if(icon){ const i=document.createElement('span'); i.className='log-ico'; i.innerHTML=nsIcon(icon); el.appendChild(i); }
  el.appendChild(document.createTextNode(text));
  box.appendChild(el);
  logLineTO=setTimeout(()=>{ if(el.parentNode){el.style.transition='opacity .6s';el.style.opacity='0';
    setTimeout(()=>{ if(el.parentNode) el.remove(); },600);} }, 5200);
}
let bannerTO=null;
function showBanner(main,sub){
  const b=$('floorBanner'); if(!b) return; b.innerHTML=`${main}<span class="sub">${sub||''}</span>`;
  b.classList.add('show'); clearTimeout(bannerTO);
  bannerTO=setTimeout(()=>b.classList.remove('show'),2200);
}
// Punch list #1 follow-up (v39b): small English warning toast for a
// stack-cap overflow on Take/Take All — see takeContainerSlot below.
// Same show/fade-timeout pattern as showBanner() above (re-triggering
// resets the fade-out clock instead of stacking multiple timers), just a
// smaller/plainer card instead of the big centered lore banner.
let stashWarnTO=null;
function showStashFullWarning(itemLabel, cap){
  const b=$('stashFullWarning'); if(!b) return;
  b.innerHTML = `<span class="warn-title">Inventory full</span>`+
    `<span class="warn-sub">${itemLabel} is at its stack limit (${cap}). `+
    `Burn some in your Inventory to make room.</span>`;
  b.classList.add('show'); clearTimeout(stashWarnTO);
  stashWarnTO=setTimeout(()=>b.classList.remove('show'),2600);
}

// ---- cutscene ----
let csLines=[], csIdx=0, csDone=null, csActive=false;
function cutscene(lines,onDone){
  G&&(G.paused=true);
  csLines=lines; csIdx=0; csDone=onDone||null; csActive=true;
  $('story').classList.remove('hidden');
  renderCS();
}
function renderCS(){ $('storyText').textContent=csLines[csIdx]; }
function onStoryNext(){
  csIdx++;
  if(csIdx>=csLines.length){
    $('story').classList.add('hidden');
    csActive=false;
    if(G) G.paused=false;
    const cb=csDone; csDone=null; if(cb) cb();
  } else renderCS();
}

// ---- tutorial (animated how-to-play, shown once before the first bunker) ----
const TUTORIAL_SLIDES = [
  { key:'move',   text:"Drag the stick to move. NULL_STATE plays itself otherwise — your hero attacks on its own the moment an enemy gets close." },
  { key:'attack', text:"That's it for combat — just stay close. No attack button to mash. Walk into trouble, your blade does the rest." },
  { key:'clear',  text:"Every hostile on a floor has to fall before the lift will take you deeper. Clear the floor — the lift unlocks the moment the last one drops." },
  { key:'ulti',   text:"Run is going badly, or a boss is in your face? A NULL_STRIKE prompt appears — sign it to channel real on-chain force into one devastating hit." },
];
let tutIdx = 0, tutDone = null;
function showTutorial(onDone){
  G&&(G.paused=true);
  tutIdx = 0; tutDone = onDone||null;
  $('tutorial').classList.remove('hidden');
  renderTutorial();
}
function renderTutorial(){
  const slide = TUTORIAL_SLIDES[tutIdx];
  $('tutorialText').textContent = slide.text;
  document.querySelectorAll('.ns-game-root .tut-slide').forEach(el=>{
    el.classList.toggle('hidden', el.dataset.slide!==slide.key);
  });
  document.querySelectorAll('.ns-game-root .tut-dot').forEach(el=>{
    el.classList.toggle('active', Number(el.dataset.i)===tutIdx);
  });
  $('tutorialNext').textContent = tutIdx>=TUTORIAL_SLIDES.length-1 ? '▾ let\'s go' : '▾ next';
}
function onTutorialNext(){
  tutIdx++;
  if(tutIdx>=TUTORIAL_SLIDES.length){
    $('tutorial').classList.add('hidden');
    if(G) G.paused=false;
    const cb=tutDone; tutDone=null; if(cb) cb();
  } else renderTutorial();
}

// ---- death ----
function gameOver(){
  if(G.over) return; G.over=true;
  const p=G.player;
  // NULL ABYSS: relabel the button (no revive — leaving banks your depth) and
  // report the deepest floor as this season's abyss score now, at the moment
  // of death, so the record survives even if the player closes the tab.
  { const rb=$('reviveBtn'); if(rb) rb.textContent = abyssMode ? 'LEAVE THE ABYSS ▾' : 'RISE AGAIN ▾'; }
  if(abyssMode) reportAbyssScore(G.maxDepthReached);
  setTimeout(()=>{
    $('deathSub').textContent = abyssMode ? `The Abyss claims you at depth ${G.depth}.` : Story.deathLine();
    $('deathStats').innerHTML=
      `<div class="ds"><b>${G.depth}</b><span>${abyssMode?'DEPTH REACHED':'FLOOR REACHED'}</span></div>`+
      `<div class="ds"><b>${p.level}</b><span>LEVEL</span></div>`+
      `<div class="ds"><b>${p.kills}</b><span>SOULS PURGED</span></div>`;
    $('death').classList.remove('hidden');
    
    // [v0] Emit custom event with player stats for contract update
    window.dispatchEvent(new CustomEvent('nullstate-player-death', {
      detail: {
        xp: p.xp,
        level: p.level,
        kills: p.kills
      }
    }));
  },650);
}
function onRevive(){
  // NULL ABYSS: no revive — death ends the descent and banks your depth as
  // your season score. The death button is relabelled in gameOver().
  if(abyssMode){ endAbyssRun(); return; }
  $('death').classList.add('hidden');
  // Phase 1 (blueprint §2.1): the in-place revive stays exactly as designed,
  // but each death is now counted against the run — the RunSession reward
  // multiplier (first death free, -20% per extra, floor 40%) will feed the
  // Phase 2 material payout.
  if(window.NS_RUN) NS_RUN.onDeath();
  flushContractKills();   // don't lose a floor's worth of kills to a death
  if(!G){ newGame(selectedChar); updateHUD(); return; }
  const deathDepth = G.depth;
  const p = G.player;
  // Reset vitals only — floor progress, kills already made, decor already
  // broken, and any key already in the inventory are all preserved.
  p.hp = p.maxHp;
  p.iframe = 1.2;
  G.over = false;
  // Golden Keys no longer relocate on death — they aren't a floor position
  // anymore, just a run-capped container drop (G.goldenKeysRemaining),
  // which is untouched by dying/reviving.
  showLoadingTransition(() => {
    descend(deathDepth);
    cutscene(['You claw your way back from the NULL, gasping on the floor where you fell…'], ()=>updateHUD());
    updateHUD();
  }, ()=>{}, 'THE CHAIN PULLS YOU BACK…');
}



// ---- title / char select ----
let selectedChar='knight';
// Campaign progress — survives across dungeon sessions (unlike G, which is
// torn down and rebuilt each time newGame() runs for a fresh bunker).
let campaignActIndex = 0;
// NULL CYCLES / New Game+ (blueprint 3C). 0 = first playthrough. Each cycle
// scales enemy HP/DMG (+35%/cycle, read in entities.js Enemy ctor via
// window.__NS.campaignCycle) and shard drops (+25%/cycle, banked in
// onActBunkerCleared). A normal "New Game" (DESCEND) is always cycle 0; only
// the post-completion NEW GAME+ button advances the cycle. Persisted per
// wallet so a resumed/continued run keeps its difficulty.
let campaignCycle = 0;
function cycleKey(){ return 'nullstate-cycle-'+(WALLET_ADDRESS?WALLET_ADDRESS.toLowerCase():'guest'); }
function loadStoredCycle(){ try{ return Math.max(0, parseInt(localStorage.getItem(cycleKey())||'0',10)||0); }catch(e){ return 0; } }
function storeCycle(n){ try{ localStorage.setItem(cycleKey(), String(n|0)); }catch(e){ /* storage off */ } }
// Has this wallet finished the campaign at least once? (PROTOCOL ZERO flag,
// set in showCampaignEpilogue.) Gates the post-game NEW GAME+ / ABYSS buttons.
function hasCompletedCampaign(){ try{ return localStorage.getItem('nullstate-protocolzero-'+(WALLET_ADDRESS?WALLET_ADDRESS.toLowerCase():'guest'))==='1'; }catch(e){ return false; } }
// NULL ABYSS (blueprint 3B) — endless descent below Bunker 5. false during
// the whole campaign, so every abyss-only branch is a no-op on the normal
// path. Fully wired in a follow-up; declared here so window.__NS is stable.
let abyssMode = false;
let campaignReturningFromBunker = false;
// draw a character preview at a CONSISTENT on-screen height by detecting the
// sprite's alpha bounding box (frame 0) and normalizing — so male & female match.
// v72 fix (user finding #3): both preview paths now RETURN a boolean —
// true = fully drawn, false = an asset wasn't ready yet — so paintPreview()
// can retry instead of leaving the char-select box permanently BLANK. The
// old code called this exactly once from boot(); if the LPC body sheet (or
// the fallback knight_idle) hadn't finished decoding at that instant, every
// early `return` here silently produced an empty box that never repainted.
// v80 (owner request): KNIGHT is the only character — the preview renders
// EXCLUSIVELY through the LPC compositor, identical to the in-dungeon hero.
// The old pixel-crawler stand-in path is gone: it read as "a different
// character slipping into the box" while the LPC sheets decoded. Instead,
// preloadHeroPreviews() now fetches exactly the four small files the LPC
// preview needs first, so the real knight appears within the first second
// and no other look ever flashes in.
function drawPreview(elId){
  return drawLPCPreview(elId);
}
// Knight-only LPC preview path. Mirrors the old function's alpha-bbox
// normalization (so knight/rogue/wizzard thumbnails all land at the same
// visual height in the char-select box) but measures the LPC BODY_male
// down-facing idle frame instead of the old knight sheet, then draws
// through the SAME drawLPCComposite() used by in-dungeon Player.draw() —
// no armor/weapon passed (opts.armorId/weaponId omitted) since no gear is
// equipped yet at char-select, before a run has even started.
// Issue #4: the char-select preview should show the SAME evolved aura the
// dungeon does. Derive the equipped weapon's tier + tint/glow overrides from
// WEAPON_TIERS (bridged per wallet) exactly like applyEquipment() does, so a
// leveled weapon previews brighter — not stuck at base tier.
function _previewWeaponFx(weaponId){
  const out = { evo:1, tint:null, glow:null };
  if(!weaponId || !window.NS_MARKET || typeof NS_MARKET.getEquipment!=='function') return out;
  const w = NS_MARKET.getEquipment(weaponId);
  if(!w || !Array.isArray(w.evolutionTiers) || !w.evolutionTiers.length) return out;
  const owned = Math.max(1, (WEAPON_TIERS[weaponId] | 0) || 1);
  const wTier = Math.min(owned, w.evolutionTiers.length + 1);
  for(let i=0;i<wTier-1;i++){
    const st = w.evolutionTiers[i]||{};
    if(st.spriteOverrideTint) out.tint = st.spriteOverrideTint;
    if(st.glowOverride)       out.glow = st.glowOverride;
  }
  out.evo = wTier;
  return out;
}
function drawLPCPreview(elId){
  const host = $(elId);
  const A = window.NS_ASSETS;
  if(!host || !A || !A.LPC_HERO) return false;
  const hero = A.LPC_HERO;
  const idleCfg = hero.idle;
  const im = A.img(idleCfg.src);
  if(!im) return false;
  const {fw,fh} = idleCfg;
  const rows = idleCfg.rows||1;
  // v72 (user finding #3): preview now faces RIGHT (LPC row 3) instead of
  // straight down — "tampilkan karakter yang menghadap kanan depan" — and
  // wears whatever the connected wallet actually has EQUIPPED (weapon +
  // armor from the same localStorage/Firebase-backed cache newGame() uses
  // via loadPersistedEquipment). A fresh wallet with nothing equipped gets
  // the plain default hero + base armor, exactly as requested.
  const dirIndex = 3; // LPC universal sheet rows: 0=up 1=left 2=down 3=right
  // v80 (owner spec): CONTINUE shows the hero exactly as last equipped in the
  // inventory (persisted per-wallet cache); a NEW GAME preview is the default
  // knight. TASK B — both paths now start from the free default gear: the NEW
  // GAME loadout defaults the weapon to rusty_blade (never weaponless) and the
  // default skin renders via the composite fallback (no armor/outfit -> default
  // skin), so the preview matches what the run actually starts with.
  const eq = SAVED_SESSION ? loadPersistedEquipment().equipped : { mainhand:DEFAULT_WEAPON_ID, body:null, outfit:null };
  const weaponId = eq.mainhand || null;
  const armorId  = eq.body || null;
  const outfitId = eq.outfit || null; // Phase 9: show the equipped cosmetic skin
  // If an equipped overlay sheet hasn't decoded yet, still draw the body now
  // (so the box is never blank) but report not-done so paintPreview() keeps
  // retrying and the gear pops in on a later pass.
  let gearReady = true;
  if(weaponId){
    const wDef = A.NS_WEAPON && A.NS_WEAPON[weaponId];
    if(wDef && wDef.src && !A.img(wDef.src)) gearReady = false;
    // v80: the in-hand render now prefers the ULPC walk-carry overlay —
    // keep retrying until it decodes so the preview shows the same held
    // weapon the dungeon does (icon fallback would show meanwhile).
    const ovl = A.LPC_WPN_OVL && A.LPC_WPN_OVL[weaponId];
    if(ovl && !A.img(ovl.walkFg) && !A.img(ovl.walkBg)) gearReady = false;
  }
  if(armorId){
    const aDef = A.LPC_ARMOR && A.LPC_ARMOR[armorId];
    if(aDef && aDef.src && !A.img(aDef.src)) gearReady = false;
  }
  const row = rows>1 ? dirIndex : 0;
  const off=document.createElement('canvas'); off.width=fw; off.height=fh;
  const oc=off.getContext('2d'); oc.drawImage(im, 0,row*fh,fw,fh, 0,0,fw,fh);
  let data;
  try{ data=oc.getImageData(0,0,fw,fh).data; }catch(e){ return false; }
  let minY=fh,maxY=0,found=false;
  for(let y=0;y<fh;y++)for(let x=0;x<fw;x++){
    if(data[(y*fw+x)*4+3]>24){ found=true; if(y<minY)minY=y; if(y>maxY)maxY=y; }
  }
  if(!found){ minY=0; maxY=fh-1; }
  const cH=maxY-minY+1;
  const BOX=88, TARGET=74, s=TARGET/cH;
  const dh=fh*s;
  const c=document.createElement('canvas'); c.width=BOX; c.height=BOX;
  const g=c.getContext('2d'); g.imageSmoothingEnabled=false;
  // drawLPCComposite already computes the sprite's top edge as cy-dh*foot
  // internally, so cy itself just needs to be the desired FEET baseline —
  // BOX-6, matching the old normalize path's bottom margin.
  const cx=BOX/2, cy=BOX-6;
  const _wfx = _previewWeaponFx(weaponId);
  drawLPCComposite(g, cx, cy, s, dirIndex, 0, { animKey:'idle', attacking:false, foot:hero.foot, alpha:1,
    weaponId: weaponId||undefined, armorId: armorId||undefined, outfitId: outfitId||undefined,
    weaponEvo: _wfx.evo, weaponTint: _wfx.tint||undefined, weaponGlow: _wfx.glow||undefined });
  host.innerHTML=''; host.appendChild(c);
  host.style.cssText=`width:${BOX}px;height:${BOX}px;`;
  _previewPainted = true; // the knight body is now on screen at least once
  return gearReady;
}
// v72 (user finding #3): retry until the preview actually renders with all
// equipped gear visible — caps at ~10s so a genuinely missing asset can't
// spin forever. Each successful body-only pass still paints (never blank),
// the retries just let late-decoding gear overlays pop in.
let _previewTries = 0;
let _previewTimer = null;
let _previewPainted = false; // has the knight body been drawn into the box yet?
function paintPreview(reset){
  // v80: `reset` restarts the retry budget — boot() passes true so a
  // re-mount (exit game -> open again) can never inherit an exhausted
  // counter from the previous session and leave the box permanently blank.
  if(reset === true){ _previewTries = 0; _previewPainted = false; }
  const done = drawPreview('prevKnight');
  // OWNER FIX: the char-select preview kept coming up BLANK. Root cause: the
  // canvas is appended imperatively into the React-rendered #prevKnight, and a
  // DungeonGame re-render (elixir/energy/uiNow ticks) can wipe that canvas —
  // after which the old one-shot retry loop had already stopped, leaving the
  // box empty forever. Fix: keep a self-sustaining repaint alive for as long
  // as the title/char-select is on screen. Fast retries until the first real
  // paint, then a cheap ~1s keep-alive that re-asserts the canvas so no
  // re-render can leave it blank. The loop ends the instant the player
  // descends (title hidden) or the engine is torn down.
  if(_previewTimer){ clearTimeout(_previewTimer); _previewTimer = null; }
  const _t = $('title');
  const titleVisible = _t && !_t.classList.contains('hidden');
  if(!destroyed && titleVisible){
    _previewTries++;
    // The keep-alive NEVER stops while the title/char-select is on screen —
    // this is the fix for the long-standing "box goes blank forever" bug. Root
    // cause: the old loop stopped after ~80 tries when late gear overlays had
    // not decoded (done stayed false), and any later React re-render then wiped
    // the imperatively-appended canvas with no repaint left to restore it.
    // Now: fast 200ms retries only until the body first paints; after that a
    // permanent ~1s keep-alive re-asserts the canvas so a re-render can never
    // leave it blank, whether or not the equipped gear has finished loading.
    const settled = done || _previewPainted;
    _previewTimer = setTimeout(paintPreview, settled ? 1000 : 200);
  }
}
// (sound toggle now lives in the React Settings modal — see toggleSound() in the public API)
async function onStart(){
  A.start();
  $('startBtn').textContent='ENTERING…'; $('startBtn').disabled=true;
  // By the time the player has picked a character the full asset preload
  // kicked off at the very start of boot() has almost always finished
  // already; this only actually waits on a slow connection, and shows
  // "ENTERING…" instead of an unexplained pause. Falls back to calling
  // preloadAll() directly (loadImg caches by src, so this is cheap/no-op
  // for anything already loaded) on the off chance boot() hasn't reached
  // that line yet — belt-and-suspenders so gameplay can never start before
  // monster/decor art is ready.
  try{ await (_fullPreloadPromise || preloadAll()); }catch(e){}
  if(destroyed){ hideSceneLoader(); return; }
  $('title').classList.add('hidden');
  $('hud').classList.remove('hidden');

  if (SAVED_SESSION) {
    enterSavedSession();
    hideSceneLoaderAfterPaint(); // Continue: reveal once the bunker has painted
    return;
  }

  campaignActIndex = 0;
  campaignCycle = 0;                 // a normal DESCEND is always cycle 0
  abyssMode = false;
  campaignReturningFromBunker = false;
  enterOutdoorAct(campaignActIndex, false);
  hideSceneLoaderAfterPaint(); // New Game: reveal once the outdoor has painted
}

// NEW GAME+ (Null Cycles). Post-completion only. Replays the campaign from
// Act 1 at the next cycle: enemies +35% HP/DMG per cycle, shard drops +25%,
// carrying career level (INITIAL_STATS) + owned/equipped gear exactly like a
// normal fresh run. Reuses the ordinary campaign flow entirely — the ONLY
// difference from DESCEND is the raised campaignCycle.
function startCycle(){
  if(!hasCompletedCampaign()) return; // guard: button only shows post-PROTOCOL ZERO
  campaignCycle = loadStoredCycle() + 1;
  storeCycle(campaignCycle);
  abyssMode = false;
  SAVED_SESSION = null; CARRY_OVER_SNAPSHOT = null;
  const t=$('title'); if(t) t.classList.add('hidden');
  $('hud').classList.remove('hidden');
  if(atkBtn) atkBtn.classList.remove('hidden');
  campaignActIndex = 0;
  campaignReturningFromBunker = false;
  if(window.NS_RUN) NS_RUN.start(0, false);
  enterOutdoorAct(0, false);
  log('◆ NULL CYCLE '+toRoman(campaignCycle+1)+' — the depths remember you. Enemies hit harder; shards flow richer.', 'reward');
}
function toRoman(n){ const r=['','I','II','III','IV','V','VI','VII','VIII','IX','X']; return r[n]||('x'+n); }

// ============ THE NULL ABYSS (blueprint 3B) ============
// Endless descent below Bunker 5, unlocked after campaign completion. It
// reuses the whole floor/lift/boss engine; the only differences from a
// normal run are gated on `abyssMode`:
//   • the lift never caps at floor 5 (openLift)
//   • boss floors don't end the run — they just clear and let you descend
//     (onEnemyKilled)
//   • no vault door (ensureFloor), voidstone theme throughout (descend)
//   • shard tier scales with depth (_shardTierForAct)
//   • death ENDS the run and reports your deepest floor as your season score
//     (onRevive -> endAbyssRun -> POST /api/abyss/score)
// campaignActIndex is set to 0 so no act-4 hard-mode / vault logic fires;
// the void look comes from the abyssMode theme override in descend().
// ---- RAID: re-enter a bunker you have already cleared (GAME-DESIGN.md §7) ----
// The campaign is the tutorial; the map is the game. A raid is that promise
// made real — pick any beaten bunker and descend it again for loot, shards and
// vault fragments.
//
// It goes through the OUTDOOR strip rather than dropping straight into the
// bunker, and that is deliberate: onOutdoorReachedDoor already owns the energy
// gate, the retreat-from-the-door animation when a wallet is out of runs, and
// the refill modal. Reusing it means a raid costs one energy with no second
// copy of that logic to keep in sync. resumeAtDoor skips the arrival speech —
// this act was greeted the first time through and does not need greeting again.
//
// RAID_MODE is what keeps a raid from being mistaken for campaign progress: it
// suppresses the pre-bunker cutscene and the first-bunker tutorial (see
// _enterBunkerFromDoor), and it stops onActBunkerCleared from advancing the
// act or rolling the ending. The map's own progress record is separate and
// monotonic (lib/campaignProgress.ts), so a raid can never walk it backwards.
let RAID_MODE = false;
function startRaid(actIndex){
  const idx = Math.max(0, Math.min(CAMPAIGN.length-1, actIndex|0));
  RAID_MODE = true;
  abyssMode = false;
  campaignCycle = loadStoredCycle();   // a raid keeps whatever NG+ tier they are on
  SAVED_SESSION = null; CARRY_OVER_SNAPSHOT = null;
  campaignActIndex = idx;
  campaignReturningFromBunker = false;
  const t=$('title'); if(t) t.classList.add('hidden');
  $('hud').classList.remove('hidden');
  if(atkBtn) atkBtn.classList.remove('hidden');
  enterOutdoorAct(idx, true);
  log('◆ RAID — '+(CAMPAIGN[idx].title||('BUNKER '+(idx+1)))+'. Loot, shards and vault fragments all count. Your campaign progress is untouched.', 'reward');
}
function startAbyss(){
  if(!hasCompletedCampaign()) return; // button only shows post-PROTOCOL ZERO
  abyssMode = true;
  campaignCycle = 0;
  campaignActIndex = 0;
  SAVED_SESSION = null; CARRY_OVER_SNAPSHOT = null;
  const t=$('title'); if(t) t.classList.add('hidden');
  $('hud').classList.remove('hidden');
  if(atkBtn) atkBtn.classList.remove('hidden');
  if(window.NS_RUN) NS_RUN.start(0, false);
  const snap = INITIAL_STATS
    ? { xp:INITIAL_STATS.xp, level:INITIAL_STATS.level, kills:0, depth:1, maxDepthReached:1 }
    : null;
  newGame(selectedChar, snap); // builds G + descend(1)
  log('◆ THE NULL ABYSS opens. There is no bottom — your deepest fall is your rank this season. Death ends the descent.', 'reward');
}
// Post the deepest floor reached as this wallet's abyss score for the
// current season. Best-effort; the server keeps only the max.
function reportAbyssScore(depth){
  if(!WALLET_ADDRESS || !depth || depth<1) return;
  try{
    fetch('/api/abyss/score', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ wallet: WALLET_ADDRESS, depth: depth|0 })
    }).catch(()=>{});
  }catch(e){ /* offline — score just isn't recorded */ }
}
// Tear the abyss run down and return to the in-game title screen (the same
// resting state as a fresh mount before DESCEND). Reports the final depth.
function endAbyssRun(){
  reportAbyssScore(G ? G.maxDepthReached : 0);
  abyssMode = false;
  const d=$('death'); if(d) d.classList.add('hidden');
  const lm=$('liftMenu'); if(lm) lm.classList.add('hidden');
  G = null; resetInput();
  $('hud').classList.add('hidden');
  if(atkBtn) atkBtn.classList.add('hidden');
  const t=$('title'); if(t) t.classList.remove('hidden');
  // re-reveal the post-completion buttons (title was rebuilt on this return)
  const cb=$('cycleBtn'); if(cb && hasCompletedCampaign()){ cb.textContent='NEW GAME+ ('+toRoman(loadStoredCycle()+2)+') ▾'; cb.style.display=''; }
  const ab=$('abyssBtn'); if(ab && hasCompletedCampaign()){ ab.style.display=''; }
}

// Exact resume: skip the outdoor walk entirely, drop the player back into
// the bunker floor they saved on. Single-use — clear it now so a page
// reload without saving again can't replay this snapshot. Shared by the
// manual DESCEND flow (onStart) and the auto-resume "Continue" flow (boot).
function enterSavedSession(){
  selectedChar = SAVED_SESSION.charKey || selectedChar;
  campaignActIndex = SAVED_SESSION.campaignActIndex || 0;
  campaignCycle = SAVED_SESSION.campaignCycle || 0; // Null Cycles — restore NG+ difficulty
  abyssMode = !!SAVED_SESSION.abyssMode;            // Null Abyss — restore dive state
  RAID_MODE = !!SAVED_SESSION.raid;                 // a resumed raid is still a raid
  // Phase 1: resuming a saved run re-opens the SAME RunSession unit —
  // resumed=true, and it costs no energy (the fresh entry already paid).
  if(window.NS_RUN) NS_RUN.start(campaignActIndex, true);
  const snap = SAVED_SESSION;
  SAVED_SESSION = null;
  if (atkBtn) atkBtn.classList.remove('hidden');
  newGame(selectedChar, snap);
  cutscene(['You pick up right where you left off…'], () => updateHUD());
}

// ---- campaign / outdoor flow ----
// v80 (owner bug report): the outdoor hero rendered with NO equipped
// armor/weapon — Outdoor.enter() was never given the equipment ids, so the
// character contradicted what the player had equipped before saving/leaving.
// One source of truth, in priority order: the live in-run state (G) when a
// session exists, else the persisted per-wallet cache — the exact same cache
// newGame()/the char-select preview read, so all three always agree.
function currentEquippedIds(){
  const eq = (G && G.equipment && G.equipment.equipped)
    ? G.equipment.equipped
    : loadPersistedEquipment().equipped;
  return { weaponId: eq.mainhand || null, armorId: eq.body || null, outfitId: eq.outfit || null };
}
function enterOutdoorAct(actIndex, resumeAtDoor){
  const heroCfg = HERO[selectedChar];
  resetInput(); // #7 fix — one-time clear on entry, see render()'s Outdoor branch for why this moved here
  const _eq = currentEquippedIds();
  Outdoor.enter(actIndex, CAMPAIGN, {
    heroCfg, charKey: selectedChar, resumeAtDoor, canvasWidth: cw,
    weaponId: _eq.weaponId, armorId: _eq.armorId, outfitId: _eq.outfitId,
    onReachDoor: onOutdoorReachedDoor,
  });
  if(atkBtn) atkBtn.classList.add('hidden');
}
function onOutdoorReachedDoor(){
  const act = CAMPAIGN[campaignActIndex];
  const isFirstBunker = campaignActIndex===0;
  // ---- Phase 1 ENERGY GATE (blueprint §2.6): one energy per FRESH bunker
  // entry. The check is server-authoritative via the React bridge (ENERGY
  // .try -> POST /api/energy/spend). Fail-open on network/no-wallet (the
  // bridge returns ok:true in those cases) — energy must never brick the
  // game for connectivity reasons. On ok:false the door un-triggers, the
  // hero steps back, and React shows the refill/countdown modal.
  if(_energyGateBusy) return;
  _energyGateBusy = true;
  Promise.resolve(ENERGY.trySpend ? ENERGY.trySpend() : { ok:true }).then((res)=>{
    _energyGateBusy = false;
    if(res && res.ok === false){
      Outdoor.retreatFromDoor();
      if(ENERGY.onExhausted) ENERGY.onExhausted(res);
      return;
    }
    if(window.NS_RUN) NS_RUN.start(campaignActIndex, false);
    _enterBunkerFromDoor(act, isFirstBunker);
  }).catch(()=>{
    _energyGateBusy = false;
    if(window.NS_RUN) NS_RUN.start(campaignActIndex, false);
    _enterBunkerFromDoor(act, isFirstBunker);
  });
}
let _energyGateBusy = false;
function _enterBunkerFromDoor(act, isFirstBunker){
  showLoadingTransition(() => {
    Outdoor.exit();
    // Carry loot + xp/level/kills/celo/hp/run-caps over from the bunker
    // just cleared (see CARRY_OVER_SNAPSHOT above). depth/maxDepthReached
    // are force-overridden to 1 — every new bunker always starts on its
    // own floor 1 regardless of how deep the previous bunker went.
    // Single-use: null it out immediately after reading so a later bunker
    // transition can't accidentally replay a stale snapshot.
    let restoreSnapshot;
    if (CARRY_OVER_SNAPSHOT) {
      restoreSnapshot = { ...CARRY_OVER_SNAPSHOT, depth: 1, maxDepthReached: 1 };
      CARRY_OVER_SNAPSHOT = null;
    }
    newGame(selectedChar, restoreSnapshot);
    if(atkBtn) atkBtn.classList.remove('hidden');
    // A raid skips the story beat and the tutorial. Both are first-visit
    // material, and a farming run that opens with a cutscene every time is a
    // farming run nobody repeats.
    if(RAID_MODE){ updateHUD(); return; }
    cutscene(act.preBunker, ()=>{
      updateHUD();
      if(isFirstBunker) showTutorial(()=>updateHUD());
    });
  }, ()=>{ if(G) G.paused=false; updateHUD(); }, `DESCENDING INTO ${act.title}…`);
}
// Called when the final boss (floor 5) of the current act's bunker falls —
// see onEnemyKilled(). Returns the player to THIS SAME act's outdoor scene
// (near the bunker door, not from the start of the strip) and plays the
// post-bunker dialog there. From that point the player is free to walk
// right again — which now advances to the NEXT act instead of re-entering
// this bunker (see enterOutdoorAct's resumeAtDoor + the "already cleared"
// door-trigger branch below).
function onActBunkerCleared(){
  const act = CAMPAIGN[campaignActIndex];
  // ---- Phase 2: bank this run's Glitch Shards, degraded by the RunSession
  // death multiplier (first death free, -20% per extra, floor 40% — §2.1).
  // Banked BEFORE the run closes (the multiplier needs the live session) and
  // BEFORE getSaveSnapshot() builds the carry-over, then zeroed so the next
  // bunker starts a fresh count and nothing double-banks.
  if(G && G.inventory && G.inventory.gshards){
    const g = G.inventory.gshards;
    // Null Cycles: +25% shard yield per NG+ cycle, stacking on the death
    // multiplier. cycle 0 => x1, unchanged on the first playthrough.
    const mult = (window.NS_RUN ? NS_RUN.rewardMultiplier() : 1) * (1 + campaignCycle*0.25);
    const payout = {
      t1: Math.ceil((g.t1||0)*mult),
      t2: Math.ceil((g.t2||0)*mult),
      t3: Math.ceil((g.t3||0)*mult),
    };
    if(payout.t1+payout.t2+payout.t3 > 0){
      const pct = Math.round(mult*100);
      log(`▲ RUN REWARD: +${payout.t1+payout.t2+payout.t3} Glitch Shard${pct<100?` (${pct}% — the NULL taxes the fallen)`:''}`, 'reward');
      Promise.resolve(MATERIALS.credit ? MATERIALS.credit(payout) : null).catch(()=>{});
    }
    G.inventory.gshards = { t1:0, t2:0, t3:0 };
  }
  if(window.NS_RUN) NS_RUN.close('Cleared'); // Phase 1: run unit ends here
  // A RAID ends here and nowhere else: back to the map, no act advanced, no
  // ending rolled, no story beat. The shards banked above still count — that is
  // the point of raiding — but the campaign is exactly where it was. The shell
  // listens for its own event (not nullstate-bunker-cleared) precisely because
  // that handler persists campaignActIndex, and a raid's act index must never
  // become the player's resume point.
  if(RAID_MODE){
    const raidAct = campaignActIndex;
    // The cached snapshot the shell is about to persist was taken DURING the
    // raid (G is torn down below, so getSaveSnapshot falls back to this copy),
    // and it still says raid:true.
    //
    // BUG THIS FIXES: enterSavedSession() restores RAID_MODE from that flag, so
    // the next Continue resumed as a raid even though the raid was over — and
    // clearing that bunker took this very branch again, firing raid-cleared and
    // advancing nothing. The campaign silently stopped progressing.
    //
    // Same reasoning as the campaign fixup further down: the moment a snapshot
    // stops describing the run it was taken from, the fields that only make
    // sense inside that run have to go with it.
    if(LAST_BUNKER_SNAPSHOT){
      LAST_BUNKER_SNAPSHOT.raid = false;
      LAST_BUNKER_SNAPSHOT.floors = null;
      LAST_BUNKER_SNAPSHOT.at = null;
    }
    showLoadingTransition(() => {
      G = null; resetInput();
      RAID_MODE = false;
    }, () => {
      try{
        window.dispatchEvent(new CustomEvent('nullstate-raid-cleared', { detail:{ actIndex: raidAct } }));
      }catch(e){ returnToTitleScreen(); }
    }, 'RETURNING TO THE SURFACE…');
    return;
  }
  // v84 (owner bug): the FINAL act must NOT walk back out onto the overworld.
  // onOutdoorAdvanceToNextAct() clamps campaignActIndex back to the last act,
  // so surfacing after Bunker 5 sent the player straight back INTO Bunker 5 —
  // re-spawning the vault door ("found the vault twice") and never returning
  // them to the title screen where THE NULL ABYSS / NEW GAME+ unlock (so the
  // Abyss "never appeared"). For the finale: surface → postBunker → PROTOCOL
  // ZERO epilogue → title screen, with the endgame buttons now revealed.
  const isFinale = campaignActIndex >= CAMPAIGN.length-1;
  if(isFinale){
    showLoadingTransition(() => {
      G = null; resetInput();
    }, () => {
      const act2 = CAMPAIGN[campaignActIndex];
      cutscene(act2.postBunker, () => { showCampaignEpilogue(act2, finishCampaign); });
    }, 'RETURNING TO THE SURFACE…');
    return;
  }
  // ARMORY TRIAL unlock (growth blueprint 1B): clearing Act 1 unlocks the
  // one-time pick-2-premium-weapons trial in the Marketplace. The flag is
  // per-wallet; the server separately enforces one grant per wallet ever.
  if(campaignActIndex===0){
    try{
      const k='nullstate-act1clear-'+(WALLET_ADDRESS?WALLET_ADDRESS.toLowerCase():'guest');
      if(localStorage.getItem(k)!=='1'){
        localStorage.setItem(k,'1');
        log('◆ ARMORY TRIAL unlocked — pick 2 premium weapons to try FREE for 48h in the Marketplace.', 'reward');
        // Referral credit (blueprint 2A): clearing Act 1 is the moment an
        // invited player COUNTS for their referrer. Fire-and-forget — the
        // server no-ops if this wallet was never referred (or already
        // counted), so there's nothing to gate here.
        if(WALLET_ADDRESS){
          fetch('/api/referrals', {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ action:'credit', wallet: WALLET_ADDRESS })
          }).catch(()=>{ /* offline — credit retries next time via the same one-time flag? no: acceptable loss, server-side idempotent */ });
        }
      }
    }catch(e){ /* storage off — the marketplace banner just won't show */ }
  }
  showLoadingTransition(() => {
    // Snapshot everything (loot, xp/level/kills/celo/hp, run-caps) BEFORE
    // this bunker's G is discarded, so onOutdoorReachedDoor() can carry it
    // into the next bunker instead of starting that newGame() call from
    // scratch. Reuses getSaveSnapshot() — the exact same function "Save &
    // Exit" already relies on — so the shape is guaranteed compatible with
    // applyRestoredState() with zero new plumbing.
    CARRY_OVER_SNAPSHOT = getSaveSnapshot();
    // v80: capture equipment while G is still alive (currentEquippedIds
    // prefers the live session state), THEN tear G down.
    const _eq = currentEquippedIds();
    G = null;
    resetInput(); // #7 fix — one-time clear on entry, see render()'s Outdoor branch for why this moved here
    Outdoor.enter(campaignActIndex, CAMPAIGN, {
      heroCfg: HERO[selectedChar], charKey: selectedChar, canvasWidth: cw,
      weaponId: _eq.weaponId, armorId: _eq.armorId, outfitId: _eq.outfitId,
      resumeAtDoor: true, // skip arrival speech bubbles, this act was already greeted
      bunkerCleared: true, // door now advances to the next act instead of re-entering
      onReachDoor: onOutdoorAdvanceToNextAct,
    });
  }, () => {
    // Non-finale acts end with their postBunker beat + NEXT → signpost line
    // (story_campaign.js). The finale is handled separately above and returns
    // early, so this path never needs the epilogue.
    cutscene(act.postBunker, ()=>{});
  }, 'RETURNING TO THE SURFACE…');
}
// Campaign-completion epilogue (v83, blueprint 3A). Shows the act's
// `epilogue` beat and, ONCE per wallet, grants the PROTOCOL ZERO completion
// bundle (5× T3 Glitch Shards via the existing materials bridge — the same
// server-credited path onActBunkerCleared() banks run shards through).
// One-time gate is a per-wallet localStorage flag: the reward is a modest
// convenience bundle, not an economy faucet, so a client-side gate is
// proportionate. Replays of Bunker 5 just replay postBunker, no epilogue.
function showCampaignEpilogue(act, onDone){
  const done = typeof onDone === 'function' ? onDone : function(){};
  const lines = act.epilogue;
  if(!lines || !lines.length){ done(); return; }
  const flagKey = 'nullstate-protocolzero-' + (WALLET_ADDRESS ? WALLET_ADDRESS.toLowerCase() : 'guest');
  let alreadyDone = false;
  try{ alreadyDone = localStorage.getItem(flagKey) === '1'; }catch(e){ /* storage off — treat as first time */ }
  // A replay of Bunker 5 skips the one-time epilogue, but STILL hands control
  // back to the caller (returnToTitleScreen) so the run always ends at the
  // title where THE NULL ABYSS / NEW GAME+ live — never dumped back onto the
  // overworld to re-enter the bunker.
  if(alreadyDone){ done(); return; }
  cutscene(lines, ()=>{
    try{ localStorage.setItem(flagKey, '1'); }catch(e){ /* non-critical */ }
    log('◆ PROTOCOL ZERO — campaign complete. +5 T3 Glitch Shards.', 'reward');
    Promise.resolve(MATERIALS.credit ? MATERIALS.credit({ t1:0, t2:0, t3:5 }) : null).catch(()=>{});
    done();
  });
}
// Everything a finished run has to put away, with nothing said about where the
// player goes next. Split out of returnToTitleScreen so the map path and the
// title path cannot drift on what "the run is over" means.
function _teardownRun(){
  const d=$('death'); if(d) d.classList.add('hidden');
  const lm=$('liftMenu'); if(lm) lm.classList.add('hidden');
  const vw=$('vaultWindow'); if(vw) vw.classList.add('hidden');
  const vwin=$('vaultWinWindow'); if(vwin) vwin.classList.add('hidden');
  G = null; resetInput();
  $('hud').classList.add('hidden');
  if(atkBtn) atkBtn.classList.add('hidden');
}
// Tear the current run down and return to the in-game title screen with the
// post-completion buttons revealed. Mirrors the tail of endAbyssRun.
//
// This is the CLASSIC-MENU ending now. With the world-map hub on (the default),
// finishCampaign below surfaces to the map instead — see that function for why.
function returnToTitleScreen(){
  _teardownRun();
  const t=$('title'); if(t) t.classList.remove('hidden');
  const cb=$('cycleBtn'); if(cb && hasCompletedCampaign()){ cb.textContent='NEW GAME+ ('+toRoman(loadStoredCycle()+2)+') ▾'; cb.style.display=''; }
  const ab=$('abyssBtn'); if(ab && hasCompletedCampaign()){ ab.style.display=''; }
}
// THE END OF THE CAMPAIGN, with the world map on.
//
// OWNER, having just cracked the vault for real: "setelah buka vault itu aku
// masuk menu abbys, menurut km itu hilangkan atau jangan?"
//
// He landed on the title screen above, because the finale called it
// unconditionally — DESCEND, NEW GAME+, THE NULL ABYSS, and no way back. That
// screen was the game's home before the map existed. With the map on it is a
// DEAD END: _teardownRun hides the HUD, so there is no Save & Exit, and nothing
// on it returns to the map. Winning the game put the player somewhere they
// could not leave, holding a reward they had just been paid.
//
// The Abyss is not the problem and is not removed — it is the completion
// reward, and with the map as the home screen it is one of the two modes that
// only unlock here. The problem is WHERE the player is standing when they are
// offered it. So the finale surfaces to the map like every other cleared
// bunker, and the map is what holds the endgame from now on (see
// lib/campaignComplete.ts and the ENDGAME entries in WorldMapHub).
//
// The snapshot fixup mirrors the ordinary clear exactly: the run is over, so
// the floors it describes are gone and its depth must not become a resume
// point. Bunker 5 stays the act index — there is no act 6 — and the map reads
// it as CLEARED off the completion flag rather than off this number.
function finishCampaign(){
  if(!WORLDMAP_HUB){ returnToTitleScreen(); return; }
  if(LAST_BUNKER_SNAPSHOT){
    LAST_BUNKER_SNAPSHOT.depth = 1;
    LAST_BUNKER_SNAPSHOT.maxDepthReached = 1;
    LAST_BUNKER_SNAPSHOT.floors = null;
    LAST_BUNKER_SNAPSHOT.at = null;
    LAST_BUNKER_SNAPSHOT.raid = false;
  }
  _teardownRun();
  try{
    window.dispatchEvent(new CustomEvent('nullstate-campaign-complete', {
      detail:{ clearedActIndex: campaignActIndex }
    }));
  }catch(e){
    // No CustomEvent, or no listener attached: the title screen is still a
    // real ending, and stranding the player on a blank canvas is not.
    returnToTitleScreen();
  }
}
function onOutdoorAdvanceToNextAct(){
  const finishedAct = CAMPAIGN[campaignActIndex];
  showLoadingTransition(() => {
    Outdoor.exit();
    campaignActIndex++;
    if(campaignActIndex >= CAMPAIGN.length){
      // Act I complete — no further acts authored yet. Hold here; the
      // campaign continues simply by appending new entries to CAMPAIGN
      // later, with no other code changes required.
      campaignActIndex = CAMPAIGN.length-1;
      enterOutdoorAct(campaignActIndex, true);
      return;
    }
    // World-map hub: surface to the map rather than walking straight into the
    // next bunker, so the run's progress actually lands somewhere the player
    // can see — the cleared bunker gets its ✓ and the next one loses its fog.
    // The app shell handles it from here (it swaps back to the menu phase,
    // which unmounts this engine along with the fade overlay).
    // A cleared bunker means the NEXT descent is a fresh bunker, so the cached
    // snapshot has to say floor 1. getSaveSnapshot() falls back to
    // LAST_BUNKER_SNAPSHOT the moment we leave the dungeon, and that copy still
    // holds the floor the vault was on — 5.
    //
    // BUG THIS FIXES: with the world-map hub on, clearing a bunker persisted
    // that snapshot as the saved session, so pressing ENTER on the map resumed
    // at `startDepth = snap.depth` and dropped the player into the new bunker
    // ON FLOOR 5, skipping four floors of the act they had just unlocked.
    // The classic flow never hit this because _enterBunkerFromDoor() rebuilds
    // its restore snapshot with `depth: 1, maxDepthReached: 1` — the hub path
    // returns before ever reaching that line, so it needs the same override
    // here, for the same reason.
    //
    // Applied for BOTH flows, not just the hub: in the classic flow an autosave
    // during the outdoor walk had the same problem, and it also left the act
    // index pointing at the bunker just finished, so Continue would drop the
    // player back into a bunker they had already cleared.
    if(LAST_BUNKER_SNAPSHOT){
      LAST_BUNKER_SNAPSHOT.campaignActIndex = campaignActIndex;
      LAST_BUNKER_SNAPSHOT.depth = 1;
      LAST_BUNKER_SNAPSHOT.maxDepthReached = 1;
      // And the floors it describes belong to the bunker just finished, not the
      // one this snapshot now points at. floorsKey would reject them on restore
      // anyway; clearing them here keeps the payload small and says why.
      LAST_BUNKER_SNAPSHOT.floors = null;
      LAST_BUNKER_SNAPSHOT.at = null;
    }
    if(WORLDMAP_HUB){
      try{
        window.dispatchEvent(new CustomEvent('nullstate-bunker-cleared', {
          detail:{ nextActIndex: campaignActIndex, clearedActIndex: campaignActIndex-1 }
        }));
      }catch(e){ /* no CustomEvent — fall through to the classic flow below */
        enterOutdoorAct(campaignActIndex, false);
      }
      return;
    }
    enterOutdoorAct(campaignActIndex, false);
  }, ()=>{}, `LEAVING ${finishedAct.title}…`);
}


// ---- attach DOM listeners (called in mount) ----
function attach(){
  winOn('resize', resize);
  winOn('keydown', onKeyDown);
  winOn('keyup', onKeyUp);
  // Safety net for the auto-resumed "Continue" flow (see boot()): that path
  // starts the run without the player ever clicking a DESCEND button, so
  // there's no guaranteed user-gesture for A.start() to ride on and the
  // browser's autoplay policy may leave the AudioContext suspended. Resume
  // it on the player's very first touch/click/keypress instead, same as any
  // other "tap to unmute" pattern.
  winOn('pointerdown', () => A.start(), { once: true });
  winOn('keydown', () => A.start(), { once: true });
  // Preview reliability: a tab that was backgrounded during the first load
  // (or a throttled first paint) can leave the char-select box blank. Whenever
  // the window regains focus while the title is STILL showing (i.e. we haven't
  // descended yet, and this isn't the Continue auto-resume path), re-arm the
  // paintPreview retry loop so the knight reliably appears.
  winOn('focus', () => {
    if(destroyed || SAVED_SESSION) return;
    const t = $('title');
    if(t && !t.classList.contains('hidden')) paintPreview(true);
  });
  cv.addEventListener('mousedown', ()=>{ input.attack=1; });
  cv.addEventListener('mouseup', ()=>{ input.attack=0; });
  // #7 — tap-to-skip for the outdoor arrival speech bubbles. These used to
  // ONLY advance on their own read-timer with no way to speed through them.
  // Canvas taps have no other purpose while isBlockingInput() is true (the
  // player can't move or attack during the arrival phase anyway), so this
  // can't collide with movement/attack input. Bound on both mousedown
  // (desktop) and touchstart (mobile — the primary target here) since the
  // canvas itself isn't otherwise part of the touch-stick/attack-button
  // control surface.
  const skipArrivalTap = (e)=>{ if(Outdoor.isBlockingInput && Outdoor.isBlockingInput()){ Outdoor.skipArrival(); e.preventDefault(); } };
  cv.addEventListener('touchstart', skipArrivalTap, {passive:false});
  cv.addEventListener('mousedown', skipArrivalTap);
  $('storyNext').addEventListener('click', onStoryNext);
  $('tutorialNext').addEventListener('click', onTutorialNext);
  $('reviveBtn').addEventListener('click', onRevive);
  $('actionBtn').addEventListener('click', onActionBtnClick);
  $('containerClose').addEventListener('click', closeContainerWindow);
  $('containerTakeAll').addEventListener('click', takeAllContainerSlots);
  $('vaultClose').addEventListener('click', closeVaultWindow);
  { const vl=$('vaultLeave'); if(vl) vl.addEventListener('click', finishBunkerFromVault); }
  $('vaultSubmitBtn').addEventListener('click', submitVaultCode);
  // CONTINUE on the win popup is what ends the bunker now — deliberately the
  // only way out, so the amount cannot leave the screen before it is read.
  { const vw=$('vwinClose'); if(vw) vw.addEventListener('click', closeVaultWinPopup); }
  // One delegated listener on the pad rather than twelve — the keys are static
  // markup in DungeonGame.tsx, so data-key is the only thing that varies.
  { const pad=$('vaultPad'); if(pad) pad.addEventListener('click', (e)=>{
      const btn = e.target && e.target.closest ? e.target.closest('[data-key]') : null;
      if(btn) vaultPushKey(btn.getAttribute('data-key'));
    }); }
  // Physical keyboards still work (desktop): the field itself is readonly and
  // never focused, so this has to be caught at the window. See vaultPushKey.
  winOn('keydown', onVaultKeydown);
  $('burnConfirm').addEventListener('click', onInvConfirmClick); // #5 (v41) — dispatches to confirmBurn (Loot) or confirmEatSelected (Food)
  $('itemZoomTake').addEventListener('click', onItemZoomTake);
  $('itemZoomBurn').addEventListener('click', onItemZoomBurn);
  $('itemZoomClose').addEventListener('click', closeItemZoom);
  $('startBtn').addEventListener('click', onStart);
  { const cb=$('cycleBtn'); if(cb) cb.addEventListener('click', startCycle); }
  { const ab=$('abyssBtn'); if(ab) ab.addEventListener('click', startAbyss); }
  $('invBtn').addEventListener('click', onInvToggle);
  $('invClose').addEventListener('click', onInvToggle);
  document.querySelectorAll('.inv-tab').forEach(b=>b.addEventListener('click', ()=>setInvTab(b.getAttribute('data-tab'))));
  $('liftCancel').addEventListener('click', onLiftCancel);
}

// debug hook (harmless; used for automated testing)
window.__NS = { get G(){ return G; },
  spawnNear(){ if(!G) return; const a=ARCHETYPES[0];
    G.enemies.push(new Enemy(a, G.player.x+50, G.player.y, G.depth, false)); },
  spawnElite(){ if(!G) return; const a=ARCHETYPES[0];
    G.enemies.push(new Enemy(a, G.player.x+120, G.player.y, G.depth, false, true)); },
  addDecor(t){ if(!G) return; G.decor.push(new Decor(t||'vase', G.player.x+40, G.player.y)); },
  // Debug-only, alongside addDecor above and for the same reason: driving a
  // real swing into a prop from a test is all timing and hitboxes, and none of
  // that is what the loot path is being asked about. Smashes prop `i` through
  // the SAME smashDecor() a weapon calls, so what the test exercises is the
  // production path — see scripts/test-prop-loot.js, which exists because
  // applyLoot() shipped with no `item` branch and nine props dropped nothing.
  smashDecorAt(i){ if(!G || !G.decor[i]) return false;
    const o = G.decor[i]; o.hp = 1; smashDecor(o); return !!o.broken; },
  onEnemyKilled, // debug-only: lets tests exercise act-completion without a full attack simulation
  get campaignActIndex(){ return campaignActIndex; },
  get campaignCycle(){ return campaignCycle; },      // Null Cycles — enemy scaling
  get abyssMode(){ return abyssMode; },              // Null Abyss — see below
  // Test seams for scripts/test-inventory-render.js, which drives the REAL
  // stash panel rather than a copy that could drift from it. The setter only
  // touches the local fragment cache; the next /api/vault/fragments read
  // overwrites it, so it can never desync the server's count.
  renderStashPanel,
  openVaultWinPopup,                  // scripts/test-vault-win.js
  // scripts/test-campaign-end.js — the finale must surface to the MAP with the
  // hub on, and only fall back to the title screen without it. Exposed because
  // reaching it for real means playing five bunkers.
  finishCampaign,
  setWorldMapHub(on){ WORLDMAP_HUB = !!on; },
  get RUN_SEED(){ return RUN_SEED; },   // scripts/test-seeded-floors.js
  get VAULT_FRAG(){ return VAULT_FRAG; },
  setVaultFrag(v){ VAULT_FRAG = Object.assign({}, VAULT_FRAG, v); } };

// ---- boot ----
// Full-game asset load (every monster/decor/background sprite) kept as a
// module-level promise so onStart() can await it directly if the player
// hits DESCEND before it's finished — see below.
//
// IMPORTANT: this is kicked off synchronously, as the very first thing
// boot() does, BEFORE the `await preloadHeroPreviews()` below. If it were
// assigned only after that await (as a prior version of this code did),
// there'd be a window — however small — where a player who hits DESCEND
// before boot() finishes preloading hero previews would find
// _fullPreloadPromise still null, skip the wait in onStart() entirely, and
// enter the dungeon before monster/decor art has loaded. Since a missing
// sprite draws as nothing rather than an error (see Anim.draw in
// entities.js), that showed up as the character (or other entities)
// silently vanishing from screen rather than any visible loading state.
let _fullPreloadPromise = null;
async function boot(){
  resize();
  $('titleLore').textContent=Story.title;
  setupTouch();
  // NOTE: the heavy full preload (monsters/decor/backgrounds, several MB) is
  // deliberately NOT kicked off here anymore. On a slow mobile connection its
  // dozens of parallel requests starved the 4 tiny files the character-select
  // preview needs, so the box sat blank for a long time ("selalu lama loading
  // disitu"). It's now started AFTER the preview has painted (see below), and
  // onStart() already falls back to preloadAll() if the player descends before
  // that line runs — so gameplay can still never start before art is ready.

  // "Continue" from the React Main Menu passes a saved bunker snapshot in
  // via mount({ savedSession }) — see DungeonGame.tsx.
  // OWNER FIX (this session): Continue used to SKIP the title/character-select
  // screen entirely and auto-drop the player straight into the bunker. That
  // read as two bugs: (a) "tiba-tiba masuk ke game padahal belum klik DESCEND"
  // and (b) no character preview ever showed on Continue. So we no longer
  // auto-enter — Continue now shows the exact same title + live character
  // preview as a fresh run (the preview reflects the saved/equipped gear via
  // loadPersistedEquipment). onStart() already resumes SAVED_SESSION through
  // enterSavedSession() when DESCEND is pressed, so we just relabel the button
  // and fall through to the shared preview + rAF path below.
  if (SAVED_SESSION) {
    const _b = $('startBtn'); if(_b) _b.textContent = 'CONTINUE ▾';
  }
  // NEW GAME+ (Null Cycles): reveal the post-completion button on the title
  // screen once this wallet has finished the campaign at least once. Label it
  // with the cycle they'd START (stored cycle + 1). Hidden otherwise, so
  // first-time players never see it.
  { const cb=$('cycleBtn');
    if(cb){
      if(hasCompletedCampaign()){ cb.textContent = 'NEW GAME+ ('+toRoman(loadStoredCycle()+2)+') ▾'; cb.style.display=''; }
      else cb.style.display='none';
    } }
  { const ab=$('abyssBtn'); if(ab) ab.style.display = hasCompletedCampaign() ? '' : 'none'; }

  // AUTO-START (owner request): the React Main Menu already asked what the
  // player wants, so skip the canvas title + character preview and drop
  // straight into that mode. The frame loop must be running first (title,
  // outdoor and dungeon all render through frame()); we hide the title before
  // anything paints so it never flashes.
  if(START_MODE){
    const t=$('title'); if(t) t.classList.add('hidden');
    $('hud').classList.remove('hidden');
    // Show the dots loader immediately: from here until the first scene is
    // ready the canvas is effectively blank while several MB of art decode —
    // this is the "Continue lama masuk, kaya error" window.
    showSceneLoader();
    _fullPreloadPromise = preloadAll();
    rafId=requestAnimationFrame(frame);
    if(START_MODE==='new' || START_MODE==='continue'){
      // onStart() awaits the preload itself, then enters a fresh run or
      // resumes SAVED_SESSION (Continue). SAVED_SESSION already came in via
      // mount(), so the same branch handles both. It hides the loader once the
      // scene is entered.
      onStart();
    } else {
      // New Game+ / Abyss build a run synchronously (no internal preload
      // await), so gate them on the full preload here first.
      const _go = ()=>{ if(destroyed){ hideSceneLoader(); return; }
        if(START_MODE==='cycle') startCycle();
        else if(START_MODE==='raid') startRaid(RAID_ACT_INDEX);
        else startAbyss();
        hideSceneLoaderAfterPaint(); };
      _fullPreloadPromise.then(_go).catch(_go);
    }
    return;
  }

  // Reaching here means NO startMode (a demo / direct mount) — this is the
  // only path that actually wants the canvas title, so reveal it (it's
  // hidden-by-default in the JSX now). Main Menu entries returned above.
  // The loader renders visible-by-default, so on this path (which never loads
  // a scene up front) hide it instantly — no fill animation — or it would
  // cover the title.
  if(_sceneLoaderTimer){ clearTimeout(_sceneLoaderTimer); _sceneLoaderTimer=null; }
  if(_sceneRAF){ cancelAnimationFrame(_sceneRAF); _sceneRAF=null; }
  { const _sl=document.getElementById('sceneLoader'); if(_sl) _sl.classList.add('hidden'); }
  { const _t=$('title'); if(_t) _t.classList.remove('hidden'); }

  // Load ONLY the 3 hero idle sprites first so the character-select
  // previews appear almost immediately, instead of waiting on the full
  // preload above (all monsters, dungeon décor, backgrounds — several MB)
  // before the player even sees a hero. loadImg() caches by src, so this
  // doesn't re-fetch anything preloadAll() is already fetching.
  // Defensive: a rejection here (should never happen — loadImg resolves null
  // on error and Promise.all can't reject) must NOT skip the paintPreview +
  // rAF start below, or the title would show a permanently blank preview box
  // AND the frame loop would never start.
  try { await preloadHeroPreviews(); } catch(e) { /* non-fatal */ }
  if(destroyed) return;
  // Belt-and-suspenders: if the LPC body sheet the preview needs somehow
  // isn't cached yet (a slow/aborted first fetch), force it now so the very
  // first paintPreview() below can draw the knight instead of an empty box.
  // NOTE: `A` at this scope is the AUDIO engine (window.Audio2, see top of
  // file); the sprite assets live on window.NS_ASSETS — use that here.
  { const AS = window.NS_ASSETS;
    if(AS && AS.LPC_HERO && AS.LPC_HERO.idle && !img(AS.LPC_HERO.idle.src)){
      try { await AS.loadImg(AS.LPC_HERO.idle.src); } catch(e) { /* non-fatal */ }
      if(destroyed) return;
    } }
  // v80 (owner: preview "harus muncul detik pertama"): paint NOW with the
  // tiny knight_idle stand-in — do NOT await the big preloadLPCHero()
  // sweep (LPC body + every armor anim folder + weapon overlays, easily
  // several seconds on mobile). It runs in the background instead; the
  // paintPreview retry loop (and the explicit repaint below, in case the
  // retry budget ran out on a very slow connection) upgrade the box to the
  // full LPC composite with equipped gear the moment those sheets decode.
  paintPreview(true);
  // Now that the preview has its first paint, start the heavy full preload
  // (monsters/decor/backgrounds) + the targeted LPC gear sweep in the
  // background. Deferring to here means they never compete with the 4 tiny
  // preview files above on a slow connection.
  _fullPreloadPromise = preloadAll();
  preloadLPCHero().then(()=>{ if(!destroyed) paintPreview(true); }).catch(()=>{});
  rafId=requestAnimationFrame(frame);
}

// ---- public API ----
function mount(opts){
  opts = opts || {};
  if(mounted) return;
  mounted = true; destroyed = false; last = 0; G = null;
  _controlsDimState = false; // reset per session so a fresh root always re-toggles
  CHAIN = opts.chain || { ultiTx: async ()=>({ ok:true, demo:true, hash:null }) };
  // Phase 1 energy bridge (DungeonGame.tsx). Defaults are fail-open no-ops
  // so demo/wallet-less mounts play exactly as before.
  ENERGY = opts.energy || { trySpend: async ()=>({ ok:true }), onExhausted: ()=>{} };
  // Phase 2 materials bridge — credit() posts the end-of-run shard payout to
  // the wallet's server balance; banked() returns the last-known totals for
  // the inventory display. Fail-open no-ops when absent (demo mounts).
  MATERIALS = opts.materials || { credit: async ()=>null, banked: ()=>null };
  WALLET_ADDRESS = opts.walletAddress || null;
  INITIAL_STATS = opts.initialStats || null;
  SAVED_SESSION = opts.savedSession || null;
  START_MODE = opts.startMode || null;
  RAID_ACT_INDEX = (typeof opts.raidActIndex === 'number') ? opts.raidActIndex : 0;
  // Module state outlives unmount (see the note in unmount()), so clear this
  // explicitly: a raid left over from the previous session would otherwise
  // suppress the story beats of a genuine campaign descent. startRaid() and
  // enterSavedSession() both set it back on, after this line.
  RAID_MODE = false;
  WORLDMAP_HUB = !!opts.worldMapHub;
  // Belt-and-suspenders for the "preview still shows" bug: the moment we know
  // this is a Main Menu entry (startMode set), hide the canvas title
  // SYNCHRONOUSLY — before any async boot()/preload work — so it can never
  // flash even for a frame. #title is also hidden-by-default in the JSX now.
  if(START_MODE){
    const _t=document.getElementById('title'); if(_t) _t.classList.add('hidden');
    // The loader is rendered visible from React's first paint (see
    // DungeonGame.tsx) so it already covers the HUD before this runs. Reset any
    // stale state from a previous session and kick off the fill animation so
    // Continue/New Game go click → LOADING instantly, never "HUD first".
    resetSceneLoader();
    showSceneLoader();
  }
  cv = document.getElementById('game');
  ctx = cv ? cv.getContext('2d') : null;
  stick = document.getElementById('stick');
  nub = document.getElementById('stickNub');
  atkBtn = document.getElementById('atkBtn');
  touchEl = document.getElementById('touchControls');
  if(!cv){ mounted=false; console.warn('NullStateGame: #game canvas not found'); return; }
  attach();
  boot();
}
function unmount(){
  // Last chance to bank kills that never reached a floor-clear — exit to the
  // map, Save & Exit, or the tab closing all land here.
  try{ flushContractKills(); }catch(e){}
  destroyed = true; mounted = false;
  // Phase 1: leaving the game screen (exit/save&exit/back to menu) closes
  // any run still open as Abandoned — a saved session re-opens it later.
  if(window.NS_RUN && NS_RUN.active()) NS_RUN.close('Abandoned');
  if(rafId){ cancelAnimationFrame(rafId); rafId=null; }
  if(_previewTimer){ clearTimeout(_previewTimer); _previewTimer=null; }
  // The world-map hub made this matter: clearing a bunker unmounts the engine
  // from INSIDE a showLoadingTransition (the dispatch that returns the player
  // to the map happens in the transition's dark phase), so the fade's t2/t3
  // timers were still pending and _fadeActive was left true. Module state
  // outlives unmount, so those flags carried into the next mount. It
  // self-corrected — the next transition clears stale timers on entry — but
  // leaving timers armed against DOM React has already thrown away is the kind
  // of thing that only stays harmless by luck. Tear it down here instead.
  _clearFadeTimers(); _fadeActive = false;
  _winL.forEach(([t,f])=>window.removeEventListener(t,f)); _winL.length=0;
  G = null; last = 0;
  cv = ctx = stick = nub = atkBtn = touchEl = null;
}

// True once the player is actually inside a bunker run (not on the title
// screen or walking the outdoor overworld) — used by the React Settings
// modal to decide whether "Save Game" has anything to save.
function isInDungeon(){
  return !!(G && !G.over);
}

// Exact off-chain snapshot of the current bunker run. See applyRestoredState()
// for the matching restore path. Deliberately does NOT include the floor's
// generated layout/enemy positions (dungeon gen isn't seeded) — only the
// player's logical progress, so a resumed floor is regenerated fresh but the
// character, level, and inventory carry over exactly.
function getSaveSnapshot(){
  if(!isInDungeon()){
    // Not literally inside a bunker right now (walking outdoors between
    // acts, or on the title screen) — fall back to the last valid in-bunker
    // snapshot we cached, if any, so Save & Exit / autosave still has
    // something to persist. See LAST_BUNKER_SNAPSHOT comment above.
    return LAST_BUNKER_SNAPSHOT;
  }
  const p = G.player;
  const _eq = (G.equipment && G.equipment.equipped) || {};
  const snap = {
    charKey: selectedChar,
    campaignActIndex,
    campaignCycle,           // Null Cycles — keep NG+ difficulty across Continue
    abyssMode,               // Null Abyss — a resumed dive stays a dive
    depth: G.depth,
    maxDepthReached: G.maxDepthReached,
    xp: p.xp, level: p.level, kills: p.kills,
    hp: p.hp,
    // #3 fix: persist the WORN gear (weapon/armor/skin) with the save so a
    // resumed run always comes back with exactly what the player had equipped
    // at Save & Exit — independent of the server's marketplaceEquipped copy or
    // the localStorage cache (either of which can be stale after a device
    // change). newGame() prefers this over the persisted copy on restore.
    equipped: { mainhand: _eq.mainhand || null, body: _eq.body || null, outfit: _eq.outfit || null },
    inventory: {
      keys: G.inventory.keys, relics: G.inventory.relics, shards: G.inventory.shards,
      gshards: G.inventory.gshards || { t1:0, t2:0, t3:0 },
      paper: G.inventory.paper,
      // Serialize the item stash as {id: qty} — the item's full definition
      // (name/rarity/icon/burnValue) is deterministic from its id via
      // NS_ITEMS.getItem(), so only id+qty need to survive a save/restore.
      items: Object.fromEntries(Object.entries(G.inventory.items||{}).map(([id,e])=>[id,e.qty])),
    },
    goldenKeysRemaining: G.goldenKeysRemaining,
    paperRemaining: G.paperRemaining,
    // A raid saved mid-run must RESUME as a raid. Without this the resumed run
    // would clear as a campaign bunker and advance the act off the raid's
    // index — quietly moving the player's resume point to a bunker they had
    // already beaten.
    raid: !!RAID_MODE,
    // GAME-DESIGN.md §8: the dungeon itself. `runSeed` regenerates every floor
    // byte-identically; `floors` is what the player did to them. Without both,
    // Continue rebuilt a different map with the monsters alive again.
    runSeed: RUN_SEED,
    floorsKey: _runKey(),
    floors: serializeFloors(),
    at: { x: Math.round(p.x), y: Math.round(p.y) },
    savedAt: Date.now(),
  };
  LAST_BUNKER_SNAPSHOT = snap;
  return snap;
}

function toggleSound(){ return A.toggleMute(); }
function isSoundMuted(){ return A.muted; }
function setMusicVolume(v){ return A.setMusicVolume(v); }
function getMusicVolume(){ return A.musicVolume; }
function toggleSfx(){ return A.toggleSfx(); }
function isSfxEnabled(){ return A.sfxEnabled; }
function toggleScreenShake(){ SHAKE_ENABLED = !SHAKE_ENABLED; return SHAKE_ENABLED; }
function isScreenShakeEnabled(){ return SHAKE_ENABLED; }
// Called from DungeonGame.tsx whenever wagmi's wallet address changes
// (connect/disconnect/account switch) after the engine has already mounted,
// so nullstate-items-burned events always carry the CURRENT address.
function setWalletAddress(addr){ WALLET_ADDRESS = addr || null; }

return { mount, unmount, isInDungeon, getSaveSnapshot, toggleSound, isSoundMuted,
         setMusicVolume, getMusicVolume, toggleSfx, isSfxEnabled,
         toggleScreenShake, isScreenShakeEnabled, setWalletAddress };
})();
