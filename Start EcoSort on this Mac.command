#!/bin/bash
# Double-click to run EcoSort AI on this Mac at http://localhost:8080
# (the laptop camera works on localhost; phones need the https deployment in README.md).
cd "$(dirname "$0")/dist" || exit 1
( sleep 1; open "http://localhost:8080" ) &
if command -v python3 >/dev/null 2>&1; then
  python3 -m http.server 8080
elif command -v npx >/dev/null 2>&1; then
  npx --yes serve -l 8080 .
else
  echo "Python 3 or Node.js is needed to run the local server. See README.md."
  read -r -p "Press Return to close."
fi
