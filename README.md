# Motivana

Motivana is an offline Android wallpaper app. It ships 120 original English
motivational quotes, eight curated presets, local favorites, high-resolution
PNG export, photo-library saving, direct Home/Lock/Both wallpaper application
when Android supports it, and optional WorkManager rotation.

No account, server, analytics SDK, remote catalog, or user-uploaded image is
required. Quotes, presets, fonts, preferences, exported files, and the native
rotation snapshot stay on the device.

## Tested environment

- Node `24.16.0` (used for this validation; `.nvmrc` pins `22.13.1`)
- pnpm `10.33.0`
- JDK `17.0.19`
- Android SDK build-tools `36.0.0`, compile/target SDK `36`
- Expo SDK `57`, React Native `0.86.2`
- `Medium_Phone` / `sdk_gphone16k_arm64`, Android API `37`, 1080×2400,
  arm64-v8a

## Setup and run

### Windows (PowerShell)

For local Android builds, install [Android Studio](https://developer.android.com/studio)
and JDK 17. Android Studio provides the SDK Manager and Device Manager; you can
continue editing this repository in your preferred editor. The SDK command-line
tools can also be installed separately, so the IDE itself is optional.
Expo Go cannot run this app's custom wallpaper module.

1. In Android Studio's SDK Manager, install Android SDK Platform 36,
   Build-Tools 36.0.0, Android SDK Platform-Tools, and Android SDK Command-line
   Tools (latest). For an emulator, also install Android Emulator and an
   appropriate system image, then create and start a device in Device Manager.
   A physical Android phone with USB debugging enabled can replace the emulator.
2. Set `JAVA_HOME` to your JDK 17 installation. The helper below uses the default
   SDK location, `%LOCALAPPDATA%\Android\Sdk`; set `ANDROID_HOME` if yours differs.
   It also detects JDK 17 installations under `%USERPROFILE%\.jdks` when
   `JAVA_HOME` is unset.
3. From this repository, run:

```powershell
# Use Node 22.13.1 when available (.nvmrc); the recorded QA also used Node 24.
pnpm install --frozen-lockfile
pnpm --dir ota/worker install --frozen-lockfile
. .\scripts\android-env.ps1
adb devices
pnpm android
```

`pnpm android` generates the native project on the first run, builds and installs
the debug app, and starts Metro. Keep Metro running while developing. No local
environment file or cloud account is needed for ordinary app development.
`pnpm verify` checks the JavaScript code and Worker; native checks additionally
need the generated Android project and configured SDK.

The repository uses pnpm's hoisted dependency layout (`.npmrc`) to keep native
CMake paths short on Windows. The first Android build can download additional
SDK/NDK packages through Gradle after the SDK licenses have been accepted.

The Bash-based emulator smoke suite requires a POSIX environment; a native
PowerShell test run without `bash` fails that suite. Run those smoke checks in
the macOS/Linux QA environment. Windows Git checkouts using `core.autocrlf=true`
can also trigger Prettier's LF checks; `pnpm exec prettier --check . --end-of-line auto`
can distinguish line-ending warnings from other formatting issues.

### macOS / Bash

Use the pinned Node version, install exactly the lockfile, then load the
repository-local Android paths. The helper changes only the current shell.

```bash
nvm use
pnpm install --frozen-lockfile
# The update Worker is a separate workspace with its own lockfile. `pnpm
# verify` runs its tests, so this install is needed on a fresh clone.
(cd ota/worker && pnpm install --frozen-lockfile)
source scripts/android-env.sh
emulator -avd Medium_Phone
adb wait-for-device
pnpm exec expo prebuild --clean --platform android
pnpm android -- --no-bundler
```

The debug development client intentionally has no embedded JavaScript bundle.
For an already-built APK, start or reuse Metro and connect the emulator through
ADB reverse:

```bash
pnpm exec expo start --dev-client --lan --port 8081
adb reverse tcp:8081 tcp:8081
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n org.haina2410.motivana/.MainActivity
```

On constrained arm64 emulators, make an arm64-only APK instead of trying to
stage the universal debug APK:

```bash
cd android
./gradlew :app:assembleDebug -PreactNativeArchitectures=arm64-v8a
```

## Verification

```bash
pnpm verify
pnpm verify:android-permissions android/app/build/intermediates/merged_manifests/debug/processDebugManifest/AndroidManifest.xml
pnpm test -- scripts/__tests__/emulatorSmoke.test.ts

source scripts/android-env.sh
pnpm exec expo prebuild --clean --platform android
cd android
./gradlew clean testDebugUnitTest :app:lintDebug :motivana-wallpaper:lintDebug :app:assembleDebug -PreactNativeArchitectures=arm64-v8a
./gradlew :motivana-wallpaper:connectedDebugAndroidTest -PreactNativeArchitectures=arm64-v8a
cd ..
scripts/emulator-smoke.sh android/app/build/outputs/apk/debug/app-debug.apk
```

`scripts/emulator-smoke.sh` installs only `org.haina2410.motivana`, clears
only that package for a clean launch, starts or reuses Metro, waits for the
rendered wallpaper preview plus save/set actions, rejects a persistent loading,
package-scoped fatal exception, or missing-script screen, and saves a PNG
screenshot. Raw ADB diagnostics live in a trap-cleaned temporary directory;
its committed output is the concise summary and screenshot in
`artifacts/qa/smoke`.

The app and local wallpaper module lint tasks are run explicitly. The generated
root Gradle configuration deliberately excludes `lintAnalyze*` only from
external dependency projects: current React Native Worklets/Reanimated analyzers
crash under this toolchain. This is not a claim that aggregate dependency lint
is clean. The current `pnpm verify` result is 25 suites / 163 tests. The local
native JVM reports contain 11 XML suites / 48 tests. An earlier
constrained-storage instrumentation install failure was resolved by uninstalling
only `org.haina2410.motivana`; the final fresh arm64 instrumentation run passed
its two test methods: one exercises all six shared renderer golden fixture cases,
and the other checks wide-word/Unicode completeness plus controlled ellipsis.
The universal debug APK is still too large for reliable staging on this emulator,
so the emulator matrix uses the arm64 APK. Details are recorded in
[docs/QA_CHECKLIST.md](docs/QA_CHECKLIST.md).

## Architecture

Expo Router and React Native own the screens and reusable domain logic.
Zustand/MMKV stores local user preferences. React Native Skia renders the
preview and foreground full-resolution PNG export. The autolinked local Kotlin
Expo module owns `WallpaperManager`, a native Canvas renderer, a strict
SharedPreferences automation snapshot/status, and WorkManager scheduling. The
authoritative quotes, presets, and bundled OFL fonts live under `assets/` and
are used by both renderers.

See [docs/ANDROID_AUTOMATION.md](docs/ANDROID_AUTOMATION.md) for scheduling
semantics and stable error handling, and [docs/QA_CHECKLIST.md](docs/QA_CHECKLIST.md)
for emulator evidence.

## Release gate

This is an Android-emulator MVP validation, not a public-release claim. Before
shipping, test on a modern physical Android device: Home, Lock, and Both target
behavior; real 6/12/24-hour timing; app backgrounded/force-stopped; locked
screen; reboot and update behavior; media permission behavior; and OEM battery
optimization. After physical QA, the recommended order is Play signing/listing,
then iOS architecture work.
