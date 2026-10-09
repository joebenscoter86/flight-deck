#!/bin/bash
STATE="$HOME/.flight-deck/state.json"
[ -f "$STATE" ] || STATE="$HOME/.hit-list/state.json"
PORT=$(jq -r .port "$STATE" 2>/dev/null)
if [ -z "$PORT" ] || [ "$PORT" = "null" ]; then
  echo "flight-deck server not running"
  exit 1
fi
open "http://localhost:$PORT"
