#!/usr/bin/env bash
set -euo pipefail

cat \
  src/core.js \
  src/modules/pz.js \
  src/modules/xray.js \
  src/modules/panic.js \
  src/modules/rune.js \
  src/modules/heal.js \
  src/modules/auto-eat.js \
  src/ui/panel.js \
  src/main.js \
  > pz-bot.js
