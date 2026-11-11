#!/bin/bash
# ─── SessionStart hook ───────────────────────────────────────────────────────
# Runs once when a Claude Code session opens on this repository.
#
# WHY IT EXISTS: commits made from a Claude Code session are authored by
# whatever git identity the container happens to have, which defaults to
# "Claude <noreply@anthropic.com>". The work is the owner's, so the commits
# should say so — Claude stays on the Co-Authored-By trailer, where it belongs.
#
# The identity is set with `git config` (repository-local), NOT --global: it
# applies to this checkout only and cannot leak into any other repository in the
# container. The container is recreated for every session, which is exactly why
# this has to be a hook rather than a one-off command — the setting does not
# survive on its own.
#
# Safe to run repeatedly: every step below either sets a value to a known
# constant or is skipped when already satisfied.
set -euo pipefail

cd "${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}"

# ── 1. Commit identity ───────────────────────────────────────────────────────
git config user.name  "0xward"
git config user.email "0xward.dev@gmail.com"
echo "git identity: $(git config user.name) <$(git config user.email)>"

# ── 2. Dependencies ──────────────────────────────────────────────────────────
# node_modules is not committed, so a cold container has nothing to typecheck,
# build or run scripts with. Guarded rather than unconditional: when the
# environment has already installed them (as this one does today) the hook
# should cost nothing.
#
# `npm install`, not `npm ci`: ci deletes node_modules and reinstalls from
# scratch every time, which throws away the container-state caching this hook
# is meant to take advantage of.
if [ ! -d node_modules ]; then
  echo "node_modules missing — installing"
  npm install --no-audit --no-fund
else
  echo "node_modules present — skipping install"
fi

# ── 3. Generated assets ──────────────────────────────────────────────────────
# public/game-engine/min/ is build output and gitignored, so a fresh clone does
# not have it. `npm run build` regenerates it, but anything that serves the app
# without a full build (next dev, a quick script) would otherwise fall back to
# the unminified sources and quietly measure the wrong thing.
if [ ! -d public/game-engine/min ] && [ -f scripts/minify-game-engine.js ]; then
  node scripts/minify-game-engine.js || echo "engine minify skipped (not fatal)"
fi
