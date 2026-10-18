#!/bin/sh
# Canvas Grades auto-updater for macOS and Linux (Chrome, Edge, Brave, Opera, Vivaldi, Chromium).
#   First time on a computer:  sh update.sh --install
# --install copies the extension to a local folder and adds an hourly cron job. Each run installs a
# newer release from the Discord release message, but only if it is signed by the release key;
# the extension reloads itself within the hour.
set -eu
if [ "$(uname)" = Darwin ]; then BASE="$HOME/Library/Application Support/CanvasGrades"; else BASE="${XDG_DATA_HOME:-$HOME/.local/share}/canvas-grades"; fi
DIR="$BASE/extension"; LOG="$BASE/update.log"
PUBKEY='-----BEGIN PUBLIC KEY-----
MIIBojANBgkqhkiG9w0BAQEFAAOCAY8AMIIBigKCAYEAxLZDsjKzNUxL0GcqLCUF
jZoJUyg7o6YmC60imLwAir+4CDtxZNOieIF95/19jps/UfHt6CUr2qd8RGtJfqWc
O3hMVQEQl7VVPkQF3fKagRhlSp3cKqJbUAzxgCCmu8C/NHs14shqltNY4Twd6KGs
LhZ1reyyzztUrY943IWFa1wnqWG2fPqM53RWcxwPjoDV19oK3wXO1qKREDPRdXm4
OQdcB+f207i4w9Ag46XiOy3OltyeM5LZgv2IwyG+fgumnog7h/U3GQH2MamKcqb2
UmZWpvQQ5NuBFl1iA3fCG7m1SrrcvlaEgjnJaRbEju9Pjsu9JxX/jENEK0JD5mCA
7WWxrT6wZPN2ZhBpElJiemO9MTsKNiWuAeXFXXbp89FWvl/4i1PKgOlyOWZQN2Da
2TqNgC0Rm2ahXsfRYWQhPBoMJUH1tIgXU5B9CqsWpKO5tSMcUVbFKWcgvgXh90g+
GP+34tZXOpKRfr4WAJpCWixE42u70BZTggE82blNuCdvAgMBAAE=
-----END PUBLIC KEY-----'
mkdir -p "$DIR"
log() { echo "$(date '+%Y-%m-%dT%H:%M:%S') $*" | tee -a "$LOG"; }
version() { grep -o '"version": *"[^"]*"' "$1" | head -1 | sed 's/.*"\([^"]*\)"$/\1/'; }
newer() { [ "$1" != "$2" ] && [ "$(printf '%s\n%s\n' "$1" "$2" | sort -t. -k1,1n -k2,2n -k3,3n | tail -1)" = "$1" ]; }

if [ "${1:-}" = --install ]; then
  SRC=$(cd "$(dirname "$0")" && pwd)
  [ "$SRC" = "$DIR" ] || cp -R "$SRC/." "$DIR/"
  (crontab -l 2>/dev/null | grep -v canvas-grades-update || true; echo "17 * * * * /bin/sh \"$DIR/update.sh\" # canvas-grades-update") | crontab -
  printf '%s' "$DIR" | pbcopy 2>/dev/null && COPIED=' (this path is now copied)' || COPIED=''
  echo
  echo "Installed to $DIR$COPIED"
  echo
  echo "Now in your browser:"
  echo "  1. Go to the Extensions page (chrome://extensions, edge://extensions, brave://extensions ...)"
  echo "  2. Turn on Developer mode, then click Load unpacked"
  echo "  3. In the folder window press Cmd+Shift+G (Mac) or Ctrl+L (Linux), paste the path, press Enter, then Select"
  echo "Remove any older copy of the extension that was loaded from a different folder."
  exit 0
fi

URL="${CANVAS_GRADES_RELEASE_URL:-$(tr -d ' \r\n' < "$DIR/release-url.txt" 2>/dev/null || true)}"
[ -n "$URL" ] || exit 0
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
fail() { log "Update failed: $*"; exit 1; }
curl -fsS --max-time 30 "$URL" -o "$TMP/msg.json" || fail "could not read the release message"
URLS=$(grep -o '"url": *"[^"]*"' "$TMP/msg.json" | sed 's/^"url": *"//; s/"$//; s/\\u0026/\&/g; s/\\\//\//g')
ZIP_URL=$(printf '%s\n' "$URLS" | grep -E '/canvas-grades-[0-9]+\.[0-9]+\.[0-9]+\.zip(\?|$)' | head -1)
SIG_URL=$(printf '%s\n' "$URLS" | grep -E '/canvas-grades-[0-9]+\.[0-9]+\.[0-9]+\.zip\.sig(\?|$)' | head -1)
[ -n "$ZIP_URL" ] && [ -n "$SIG_URL" ] || exit 0
INSTALLED=$(version "$DIR/manifest.json")
LATEST=$(printf '%s' "$ZIP_URL" | sed -E 's/.*canvas-grades-([0-9]+\.[0-9]+\.[0-9]+)\.zip.*/\1/')
newer "$LATEST" "$INSTALLED" || exit 0

curl -fsS --max-time 120 -o "$TMP/release.zip" "$ZIP_URL" || fail "download failed"
curl -fsS --max-time 30 -o "$TMP/release.sig.b64" "$SIG_URL" || fail "signature download failed"
printf '%s\n' "$PUBKEY" > "$TMP/key.pem"
tr -d ' \r\n' < "$TMP/release.sig.b64" | openssl base64 -d -A -out "$TMP/release.sig"
openssl dgst -sha256 -verify "$TMP/key.pem" -signature "$TMP/release.sig" "$TMP/release.zip" >/dev/null 2>&1 || fail "signature check failed for $LATEST; update rejected"
mkdir "$TMP/x"
unzip -q "$TMP/release.zip" -d "$TMP/x" 2>/dev/null || python3 -m zipfile -e "$TMP/release.zip" "$TMP/x" || fail "could not unzip"
# The version check uses the signed manifest, so an old signed release can't be replayed as a downgrade.
NEW=$(version "$TMP/x/manifest.json")
newer "$NEW" "$INSTALLED" || fail "release $NEW is not newer than $INSTALLED"
find "$DIR" -mindepth 1 -maxdepth 1 ! -name manifest.json -exec rm -rf {} +
mv "$TMP/x/manifest.json" "$TMP/manifest.json"
cp -R "$TMP/x/." "$DIR/"
# manifest.json goes last: the extension reloads when it sees a new version, so every other file must already be in place.
cp "$TMP/manifest.json" "$DIR/manifest.json"
log "Updated $INSTALLED -> $NEW"
