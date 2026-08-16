#!/usr/bin/env bash
set -euo pipefail

TARGET="${1:-all}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

node scripts/template-doctor.mjs --require-initialized
PRODUCT="$(node -p "require('./src-tauri/tauri.conf.json').productName")"
IDENTIFIER="$(node -p "require('./src-tauri/tauri.conf.json').identifier")"
ANDROID_ABI="${ANDROID_ABI:-aarch64}"

bold() { printf '\n\033[1m▸ %s\033[0m\n' "$1"; }
warn() { printf '\033[33m!  %s\033[0m\n' "$1"; }
die() { printf '\033[31m✗  %s\033[0m\n' "$1" >&2; exit 1; }

case "$TARGET" in all|mac|macos|android) ;; *) die "expected all, mac, or android" ;; esac

build_icons() { npx tauri icon assets/app-icon.svg >/dev/null; }

deploy_mac() {
  [ "$(uname -s)" = "Darwin" ] || { warn "Skipping macOS deploy on $(uname -s)"; return; }
  build_icons
  bold "Building $PRODUCT for macOS"
  npx tauri build --bundles app
  local built
  built="$(find src-tauri/target/release/bundle/macos -maxdepth 1 -name '*.app' -print -quit)"
  [ -n "$built" ] || die "no .app bundle produced"
  osascript -e "tell application \"$PRODUCT\" to quit" >/dev/null 2>&1 || true
  bold "Installing $PRODUCT to /Applications"
  rm -rf "/Applications/$PRODUCT.app"
  ditto "$built" "/Applications/$PRODUCT.app"
  xattr -dr com.apple.quarantine "/Applications/$PRODUCT.app" 2>/dev/null || true
}

setup_android() {
  if [ -z "${JAVA_HOME:-}" ] || ! "$JAVA_HOME/bin/java" -version 2>&1 | grep -q '"17'; then
    if [ "$(uname -s)" = "Darwin" ] && [ -x /usr/libexec/java_home ]; then
      JAVA_HOME="$(/usr/libexec/java_home -v 17 2>/dev/null)" || die "JDK 17 not found"
      export JAVA_HOME
    elif command -v java >/dev/null && java -version 2>&1 | grep -q '"17'; then
      JAVA_HOME="$(dirname "$(dirname "$(command -v java)")")"
      export JAVA_HOME
    else
      die "JDK 17 is required for the Android Gradle toolchain"
    fi
  fi

  export ANDROID_HOME="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}"
  [ -d "$ANDROID_HOME" ] || die "Android SDK not found; set ANDROID_HOME"

  if [ -z "${NDK_HOME:-}" ]; then
    NDK_HOME="$(find "$ANDROID_HOME/ndk" -mindepth 1 -maxdepth 1 -type d -name '27.*' 2>/dev/null | sort -V | tail -1)"
    [ -n "$NDK_HOME" ] || NDK_HOME="$(find "$ANDROID_HOME/ndk" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | sort -V | tail -1)"
    [ -n "$NDK_HOME" ] || die "Android NDK not found under $ANDROID_HOME/ndk"
    export NDK_HOME
  fi

  export PATH="$ANDROID_HOME/platform-tools:$PATH"
  command -v adb >/dev/null || die "adb not found"
  local tools
  tools="$(find "$ANDROID_HOME/build-tools" -mindepth 1 -maxdepth 1 -type d | sort -V | tail -1)"
  [ -n "$tools" ] || die "Android build-tools not found"
  BUILD_TOOLS="$tools"
}

connected_devices() {
  local seen="" id state serial
  while read -r id state _; do
    [ "$state" = "device" ] || continue
    case "$id" in emulator-*) [ "${INCLUDE_EMULATORS:-0}" = "1" ] || continue ;; esac
    serial="$(adb -s "$id" shell getprop ro.serialno 2>/dev/null | tr -d '\r\n')" || continue
    [ -n "$serial" ] || continue
    case " $seen " in *" $serial "*) continue ;; esac
    seen="$seen $serial"; echo "$id"
  done < <(adb devices | tail -n +2)
}

deploy_android() {
  setup_android
  build_icons
  node scripts/prepare-android.mjs
  bold "Building Android APK ($ANDROID_ABI)"
  npx tauri android build --apk --target "$ANDROID_ABI"
  local unsigned keydir keystore passfile alias aligned signed devices
  unsigned="$(find src-tauri/gen/android/app/build/outputs/apk -name '*-release-unsigned.apk' -print | head -1)"
  [ -n "$unsigned" ] || die "no unsigned APK produced"
  keydir="$HOME/.tauri-vibe/$IDENTIFIER"; keystore="$keydir/release.jks"; passfile="$keydir/release.pass"; alias="local-release"
  mkdir -p "$keydir"; chmod 700 "$keydir"
  if [ -f "$keystore" ] && [ ! -f "$passfile" ]; then
    die "Signing keystore exists but its password file is missing: $passfile"
  fi
  if [ ! -f "$keystore" ]; then
    umask 077
    printf '%s\n' "$(openssl rand -hex 24)" > "$passfile"
    keytool -genkeypair -keystore "$keystore" -storepass:file "$passfile" -keypass:file "$passfile" -alias "$alias" -keyalg RSA -keysize 4096 -validity 10950 -dname "CN=$PRODUCT, OU=Local Build, O=$PRODUCT" >/dev/null
    warn "Created persistent local signing key at $keystore — back it up to preserve update compatibility."
  fi
  aligned="${unsigned%-unsigned.apk}-aligned.apk"; signed="${unsigned%-unsigned.apk}-signed.apk"
  "$BUILD_TOOLS/zipalign" -p -f 4 "$unsigned" "$aligned"
  "$BUILD_TOOLS/apksigner" sign --ks "$keystore" --ks-pass "file:$passfile" --ks-key-alias "$alias" --out "$signed" "$aligned"
  rm -f "$aligned" "$signed.idsig"
  devices="$(connected_devices)"
  [ -n "$devices" ] || { warn "APK built and signed at $signed (no physical device connected)"; return; }
  while read -r id; do bold "Installing on $id"; adb -s "$id" install -r -d "$signed"; done <<< "$devices"
}

case "$TARGET" in mac|macos) deploy_mac ;; android) deploy_android ;; all) deploy_mac; deploy_android ;; esac
