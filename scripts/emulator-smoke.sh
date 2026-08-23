#!/usr/bin/env bash
set -euo pipefail

readonly PACKAGE='org.haina2410.motivana'
readonly ACTIVITY="${PACKAGE}/.MainActivity"
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
readonly REPOSITORY_ROOT="$(cd "$SCRIPT_DIR/.." && pwd -P)"
readonly QA_ROOT="$REPOSITORY_ROOT/artifacts/qa"
readonly ADB="${ADB_BIN:-adb}"
readonly WAIT_SECONDS="${MOTIVANA_SMOKE_WAIT_SECONDS:-45}"

METRO_PID=''
METRO_STARTED=0
DIAGNOSTICS=''

fail() {
  printf 'emulator smoke: %s\n' "$*" >&2
  exit 1
}

cleanup() {
  if [[ "$METRO_STARTED" -eq 1 && -n "$METRO_PID" ]]; then
    kill "$METRO_PID" 2>/dev/null || true
    wait "$METRO_PID" 2>/dev/null || true
  fi
  if [[ -n "$DIAGNOSTICS" && -d "$DIAGNOSTICS" ]]; then
    rm -rf -- "$DIAGNOSTICS"
  fi
}
trap cleanup EXIT

resolve_file() {
  local candidate="$1"
  [[ -f "$candidate" ]] || fail "APK does not exist: $candidate"
  local directory
  directory="$(cd "$(dirname "$candidate")" && pwd -P)"
  printf '%s/%s\n' "$directory" "$(basename "$candidate")"
}

configure_artifacts() {
  mkdir -p "$QA_ROOT"
  local qa_root_real
  qa_root_real="$(cd "$QA_ROOT" && pwd -P)"
  local requested="${MOTIVANA_SMOKE_ARTIFACTS:-$QA_ROOT/smoke}"
  mkdir -p "$requested"
  ARTIFACTS="$(cd "$requested" && pwd -P)"
  [[ "$ARTIFACTS" == "$qa_root_real"/* ]] ||
    fail "artifacts must stay under $qa_root_real"
  readonly ARTIFACTS
  DIAGNOSTICS="$(mktemp -d "${TMPDIR:-/tmp}/motivana-smoke.XXXXXX")"
}

ensure_adb_ready() {
  local state
  state="$($ADB get-state 2>&1 || true)"
  [[ "$state" == *$'device'* ]] || fail "ADB device is not ready: ${state//$'\n'/ }"
}

install_apk() {
  local install_log="$DIAGNOSTICS/install.txt"
  if "$ADB" install -r "$APK" >"$install_log" 2>&1; then
    return
  fi
  if rg -q 'INSTALL_FAILED_INSUFFICIENT_STORAGE' "$install_log"; then
    "$ADB" uninstall "$PACKAGE" >>"$install_log" 2>&1 || true
    "$ADB" install -r "$APK" >>"$install_log" 2>&1 ||
      fail "adb install failed after safely uninstalling $PACKAGE"
    return
  fi
  fail 'adb install failed'
}

metro_is_reachable() {
  curl --fail --silent --show-error --max-time 2 \
    'http://127.0.0.1:8081/status' 2>/dev/null | rg -q 'packager-status:running'
}

ensure_metro() {
  [[ "${MOTIVANA_SMOKE_SKIP_METRO:-0}" == '1' ]] && return
  if metro_is_reachable; then
    return
  fi
  (
    cd "$REPOSITORY_ROOT"
    exec pnpm exec expo start --dev-client --lan --port 8081 --non-interactive
  ) >"$DIAGNOSTICS/metro.log" 2>&1 &
  METRO_PID="$!"
  METRO_STARTED=1
  local deadline=$((SECONDS + WAIT_SECONDS))
  while (( SECONDS <= deadline )); do
    if metro_is_reachable; then
      return
    fi
    if ! kill -0 "$METRO_PID" 2>/dev/null; then
      fail 'Metro exited before becoming reachable'
    fi
    sleep 1
  done
  fail 'Metro did not become reachable'
}

wait_for_main_activity() {
  local deadline=$((SECONDS + WAIT_SECONDS))
  local activities=''
  while (( SECONDS <= deadline )); do
    activities="$($ADB shell dumpsys window windows 2>&1 || true)"
    if [[ "$activities" == *"$ACTIVITY"* ]]; then
      return
    fi
    activities="$($ADB shell dumpsys activity activities 2>&1 || true)"
    if [[ "$activities" == *"$ACTIVITY"* ]]; then
      return
    fi
    sleep 1
  done
  fail "MainActivity did not appear for $PACKAGE"
}

capture_accessibility() {
  local device_xml="/sdcard/${PACKAGE}-smoke-window.xml"
  local deadline=$((SECONDS + WAIT_SECONDS))
  local saw_loading=0
  while (( SECONDS <= deadline )); do
    "$ADB" shell uiautomator dump --compressed "$device_xml" >/dev/null
    "$ADB" exec-out cat "$device_xml" >"$DIAGNOSTICS/window.xml"
    "$ADB" shell rm -f "$device_xml" >/dev/null 2>&1 || true
    if rg -qi 'Unable to load script|Could not connect to development server|No bundle URL present|Unable to resolve module|red screen' "$DIAGNOSTICS/window.xml"; then
      fail 'The app displayed a missing-script or red-screen error'
    fi
    if rg -qi 'Preparing your wallpaper' "$DIAGNOSTICS/window.xml"; then
      saw_loading=1
      sleep 1
      continue
    fi
    if rg -q 'content-desc="Wallpaper preview"' "$DIAGNOSTICS/window.xml" &&
      rg -q 'content-desc="Save wallpaper"' "$DIAGNOSTICS/window.xml" &&
      rg -q 'content-desc="Set wallpaper"' "$DIAGNOSTICS/window.xml"; then
      return
    fi
    sleep 1
  done
  if [[ "$saw_loading" -eq 1 ]]; then
    fail 'App remained on loading screen'
  fi
  fail 'Motivana did not become ready'
}

capture_logcat() {
  local pid
  pid="$($ADB shell pidof "$PACKAGE" 2>/dev/null | tr -d '\r')"
  [[ "$pid" =~ ^[0-9]+$ ]] || fail "Unable to resolve a running PID for $PACKAGE"
  "$ADB" logcat -d --pid="$pid" -v brief >"$DIAGNOSTICS/logcat.txt" 2>&1 ||
    fail "Unable to collect filtered logcat for $PACKAGE"
  if rg -q 'FATAL EXCEPTION' "$DIAGNOSTICS/logcat.txt"; then
    fail "FATAL EXCEPTION found for $PACKAGE"
  fi
}

capture_screenshot() {
  "$ADB" exec-out screencap -p >"$ARTIFACTS/home.png"
  [[ -s "$ARTIFACTS/home.png" ]] || fail 'Screenshot capture is empty'
  [[ "$(od -An -tx1 -N4 "$ARTIFACTS/home.png" | tr -d ' \n')" == '89504e47' ]] ||
    fail 'Screenshot capture is not a PNG'
}

[[ $# -le 1 ]] || fail 'usage: scripts/emulator-smoke.sh [debug-apk]'
APK="$(resolve_file "${1:-$REPOSITORY_ROOT/android/app/build/outputs/apk/debug/app-debug.apk}")"
readonly APK
configure_artifacts
ensure_adb_ready
install_apk
"$ADB" shell pm clear "$PACKAGE" >"$DIAGNOSTICS/clear.txt" 2>&1 ||
  fail "Could not clear clean-install state for $PACKAGE"
ensure_metro
"$ADB" reverse tcp:8081 tcp:8081 >"$DIAGNOSTICS/adb-reverse.txt" 2>&1 ||
  fail 'Could not configure adb reverse for Metro'
"$ADB" shell am force-stop "$PACKAGE"
"$ADB" shell am start -n "$ACTIVITY" >"$DIAGNOSTICS/launch.txt" 2>&1 ||
  fail "Could not launch $ACTIVITY"
wait_for_main_activity
capture_accessibility
capture_logcat
capture_screenshot
printf 'package=%s\napk=%s\nready=true\nresult=PASS\n' "$PACKAGE" "$(basename "$APK")" >"$ARTIFACTS/summary.txt"
printf 'emulator smoke: PASS (%s)\n' "$ARTIFACTS"
