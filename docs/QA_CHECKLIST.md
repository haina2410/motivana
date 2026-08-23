# Android MVP QA checklist

**Validation date:** 2026-08-24

**Emulator:** `Medium_Phone` (`sdk_gphone16k_arm64`), Android 17 / API 37,
arm64-v8a, 1080×2400, font scale restored to 1.0
**Toolchain:** JDK 17.0.19, Gradle 9.3.1, Android build-tools 36.0.0,
Expo SDK 57, arm64 debug APK (98 MiB)

## Current emulator evidence

- [x] Clean install and cold launch: `scripts/emulator-smoke.sh` installed
  only the app package, cleared only its data, loaded Metro through ADB reverse,
  required the rendered `Wallpaper preview`, `Save wallpaper`, and `Set
  wallpaper` actions, rejected a persistent loading screen, found no package
  fatal exception, and created [smoke evidence](../artifacts/qa/smoke/summary.txt)
  plus a [ready 1080×2400 capture](../artifacts/qa/smoke/home.png).
- [x] Accessibility: Home includes Motivana, wallpaper preview, quote controls,
  save/set, and route labels. Automation exposes status, interval/target,
  enable/save, and debug-run labels.
- [x] Quotes: the validated catalog has 120 quotes in six categories; previous,
  next, and no-immediate-repeat random selection are covered by repository/store
  tests. Short, long, 274-character, and minimum-size 1,750-character cases are
  covered by shared renderer fixtures.
- [x] Favorites/select persistence: a fresh favorite survived force-stop and
  relaunch; [Favorites](../artifacts/qa/screens/favorites.png) and
  [persisted Home](../artifacts/qa/screens/home-persisted-favorite.png) are
  captured.
- [x] Eight presets: Customize exposed all eight in its two-column scrolling
  grid; [top](../artifacts/qa/screens/customize-top.png) and
  [lower](../artifacts/qa/screens/customize-bottom.png) captures were inspected.
- [x] Renderer dimensions: foreground export and native renderer fixtures use
  1080×2400 on this device. The earlier matching Task 7 arm64 instrumentation
  run passed all four production `StaticLayout` golden cases; its raw scratch
  output is intentionally not committed. Source commit `933c5a2` retains the
  same fixture/renderer code; this is provenance reuse, not a fresh claim.
- [x] Save success: MediaStore save was observed in the Task 6 scoped emulator
  run with a 1080×2400 PNG. API 37 write-only media access may succeed without a
  user prompt; denied and permanent-denial/Open Settings branches are exercised
  by `src/services/__tests__/mediaLibrary.test.ts` rather than fabricated from
  unrelated emulator permissions.
- [x] Wallpaper targets: capabilities exposed Home, Lock, and Both. The scoped
  emulator assertions record fresh static target state for Home (`mWhich=1`),
  Lock (`mWhich=2`), and Both (`mWhich=3`) in
  [the sanitized dumpsys summary](../artifacts/qa/wallpaper-targets.txt). See
  [Lock UI](../artifacts/qa/screens/lock-apply.png),
  [Both UI](../artifacts/qa/screens/both-apply.png), and the required
  [launcher-after-Home capture](../artifacts/qa/screens/launcher-after-home.png).
  Home is included by Both.
- [x] Automation: enabled 6h Home, invoked debug rotation in foreground,
  updated to 12h, and cancelled; UI reported a last apply and the schedule
  status transitions. Evidence: [enabled](../artifacts/qa/screens/automation-enabled-6h.png),
  [run](../artifacts/qa/screens/automation-run-now.png), and
  [disabled](../artifacts/qa/screens/automation-disabled.png). Task 7 matching
  evidence additionally covers three no-repeat runs, background, and
  force-stop/relaunch; it is summarized here without committing its raw app
  data/logs.
- [x] Retry: save/set retry preservation and permanent denial Settings link are
  covered by focused component/service tests; no user data was injected to
  manufacture an error state on the shared emulator.
- [x] Font scale: Automation was inspected at 1.3× and the device was restored
  to 1.0; see [1.3× capture](../artifacts/qa/screens/automation-font-scale-130.png).

## Fresh command summary

`pnpm install --frozen-lockfile` completed. `pnpm verify` passed 24 suites / 139
tests, and the smoke unit suite passed 6/6 after its delayed-React-tree
regression. After a clean Android prebuild, the arm64 `:app:assembleDebug`, app
lint, module lint, and native JVM suite passed with the local external-analyzer
isolation described in the README.

The fresh `:motivana-wallpaper:connectedDebugAndroidTest` invocation built its
test APK but could not install it: `INSTALL_FAILED_INSUFFICIENT_STORAGE` with
about 630 MiB free. No unrelated package/data was deleted; even uninstalling
the target package was unavailable because it was absent at that point. The
prior Task 7 final instrumentation evidence above is retained only with that
explicit provenance. The universal debug APK is also too large for reliable
emulator staging; the 98 MiB arm64 APK is the acceptance artifact.

Aggregate third-party dependency lint is intentionally not claimed: the
generated Gradle configuration skips `lintAnalyze*` for external projects only
because React Native Worklets/Reanimated analyzers crash under this toolchain.
App and local module lint remain enabled and are the reported gates.

## Physical-device release gate (unchecked)

- [ ] Home, Lock, and Both behavior on a shipping Android phone/OEM
- [ ] Real elapsed 6/12/24-hour rotation timing
- [ ] Backgrounded, removed-from-recents, and locked-screen behavior
- [ ] Reboot and app-update behavior
- [ ] Shipping-version media permission behavior
- [ ] OEM battery optimization/Doze behavior
