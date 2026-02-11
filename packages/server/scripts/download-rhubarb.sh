#!/bin/bash
set -e

VERSION="1.14.0"
OS=$(uname -s)
DEST="$(dirname "$0")/../bin"
mkdir -p "$DEST"

if [ -f "$DEST/rhubarb" ]; then
  echo "rhubarb already exists at $DEST/rhubarb"
  exit 0
fi

case "$OS" in
  Linux)  FILE="Rhubarb-Lip-Sync-${VERSION}-Linux.zip" ;;
  Darwin) FILE="Rhubarb-Lip-Sync-${VERSION}-macOS.zip" ;;
  *)      echo "Unsupported OS: $OS"; exit 1 ;;
esac

URL="https://github.com/DanielSWolf/rhubarb-lip-sync/releases/download/v${VERSION}/${FILE}"
TMP=$(mktemp -d)

echo "Downloading rhubarb-lip-sync v${VERSION} for ${OS}..."
curl -L -o "$TMP/rhubarb.zip" "$URL"
unzip -o "$TMP/rhubarb.zip" -d "$TMP"
cp "$TMP/Rhubarb-Lip-Sync-${VERSION}-${OS}/rhubarb" "$DEST/rhubarb"
chmod +x "$DEST/rhubarb"
rm -rf "$TMP"

echo "rhubarb installed at $DEST/rhubarb"
"$DEST/rhubarb" --version
