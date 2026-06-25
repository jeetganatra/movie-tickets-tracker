#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMPLATE_PATH="$ROOT_DIR/launchd/com.movietracker.plist.template"
LABEL="${MOVIETRACKER_LAUNCHD_LABEL:-com.$(whoami).movietracker}"
PLIST_NAME="$LABEL.plist"
PLIST_PATH="$HOME/Library/LaunchAgents/$PLIST_NAME"
DOMAIN="gui/$(id -u)"
ACTION="${1:-install}"

find_npm_bin() {
  if command -v npm >/dev/null 2>&1; then
    command -v npm
    return
  fi

  if [ -x "$HOME/.local/bin/npm" ]; then
    printf '%s\n' "$HOME/.local/bin/npm"
    return
  fi

  if [ -x "/opt/homebrew/bin/npm" ]; then
    printf '%s\n' "/opt/homebrew/bin/npm"
    return
  fi

  if [ -x "/usr/local/bin/npm" ]; then
    printf '%s\n' "/usr/local/bin/npm"
    return
  fi

  echo "npm not found. Install Node.js/npm first." >&2
  exit 1
}

render_plist() {
  local npm_bin npm_dir launchd_path
  npm_bin="$(find_npm_bin)"
  npm_dir="$(dirname "$npm_bin")"
  launchd_path="$npm_dir:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"

  mkdir -p "$HOME/Library/LaunchAgents" "$ROOT_DIR/logs"

  TEMPLATE_PATH="$TEMPLATE_PATH" \
    PLIST_PATH="$PLIST_PATH" \
    MOVIETRACKER_RENDER_LABEL="$LABEL" \
    MOVIETRACKER_RENDER_PROJECT_DIR="$ROOT_DIR" \
    MOVIETRACKER_RENDER_NPM_BIN="$npm_bin" \
    MOVIETRACKER_RENDER_PATH="$launchd_path" \
    node - <<'NODE'
const fs = require("fs");

const replacements = {
  __LABEL__: process.env.MOVIETRACKER_RENDER_LABEL,
  __PROJECT_DIR__: process.env.MOVIETRACKER_RENDER_PROJECT_DIR,
  __NPM_BIN__: process.env.MOVIETRACKER_RENDER_NPM_BIN,
  __PATH__: process.env.MOVIETRACKER_RENDER_PATH,
};

let content = fs.readFileSync(process.env.TEMPLATE_PATH, "utf8");
for (const [token, value] of Object.entries(replacements)) {
  content = content.split(token).join(value || "");
}
fs.writeFileSync(process.env.PLIST_PATH, content);
NODE

  echo "Wrote $PLIST_PATH"
}

stop_service() {
  launchctl bootout "$DOMAIN" "$PLIST_PATH" 2>/dev/null || true
}

start_service() {
  launchctl bootstrap "$DOMAIN" "$PLIST_PATH"
  launchctl kickstart -k "$DOMAIN/$LABEL"
}

case "$ACTION" in
  install|restart)
    render_plist
    stop_service
    npm run build
    start_service
    launchctl print "$DOMAIN/$LABEL" | sed -n '1,80p'
    ;;
  stop)
    stop_service
    echo "Stopped $LABEL"
    ;;
  status)
    launchctl print "$DOMAIN/$LABEL"
    ;;
  *)
    echo "Usage: $0 [install|restart|stop|status]" >&2
    exit 2
    ;;
esac
