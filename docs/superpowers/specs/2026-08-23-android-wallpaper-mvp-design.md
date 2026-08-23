# Motivana Android MVP Design

**Date:** 2026-08-23
**Status:** Awaiting written-spec review
**Product name:** Motivana
**Android application ID and Kotlin namespace:** `org.haina2410.motivana`

## 1. Objective

Build a polished Android MVP that lets people browse motivational quotes, turn them into high-resolution wallpapers, save or apply them, and schedule automatic wallpaper rotation. The app works without an account or network connection.

This design narrows `MVP_BUILD_SPEC.md` to Android. iOS is a likely post-MVP platform, so shared product logic and UI remain in React Native while Android operating-system integrations stay behind narrow native interfaces.

## 2. Definition of done

The development run is complete when the Android MVP:

- builds, installs, and runs on the configured Android emulator;
- satisfies every Android and shared requirement in this design;
- passes automated tests, linting, formatting checks, TypeScript checks, and native build verification;
- demonstrates direct wallpaper application and WorkManager execution on the emulator; and
- documents physical-device-only validation as the remaining release gate.

Physical-device QA is not required to complete this development run. It remains mandatory before a public release because emulators cannot establish OEM-specific lock-screen behavior, battery optimization behavior, or multi-hour scheduling reliability after process termination.

## 3. Scope

### Included

- At least 100 bundled English motivational quotes.
- Categories: motivation, discipline, focus, confidence, growth, and success.
- Quote browsing, previous/next navigation, randomization, and favorites.
- At least eight curated wallpaper presets.
- Scaled live preview and full-resolution export.
- Save to the Android media library with contextual permission handling.
- Direct application to the home screen, lock screen, or both where supported.
- Automatic rotation every 6, 12, or 24 hours with WorkManager.
- Preferred or randomized presets and optional favorites-only rotation.
- Local persistence and offline operation.
- Actionable error states, accessibility labels, documentation, and tests.

### Excluded

- iOS code and Shortcuts integration.
- Backend services, accounts, cloud sync, analytics, and remote content.
- Payments, subscriptions, advertisements, and AI features.
- User-uploaded pictures.
- Freeform text dragging, arbitrary font sizing, color pickers, photo cropping, filters, or a general-purpose canvas editor.
- Social features, notifications, localization beyond localization-ready code, and live wallpapers.

## 4. User experience

No configuration is required on first launch. Motivana immediately displays a complete quote-and-preset composition that the user can browse, save, or apply.

### Home

The wallpaper preview is the dominant visual element. Controls provide previous/next quote navigation, favorite/unfavorite, randomize, customize, save, and set-wallpaper actions. The first launch uses a bundled default preset and quote; subsequent launches restore the last viewed state.

### Customize

The user selects from at least eight preset thumbnails. A preset owns its background, font, colors, alignment, text position, overlay, author treatment, and text-size rules. Users can keep a preferred preset or enable random presets. Preset selection updates the preview without exposing granular design controls.

Backgrounds use gradients, solids, and small generated textures. They do not rely on copyrighted stock photography.

### Favorites

The favorites screen lists locally saved quotes. Selecting one returns to the main preview with that quote active. An empty state explains how to add favorites.

### Automation

The automation screen lets the user:

- enable or disable scheduled rotation;
- select 6-hour, 12-hour, or 24-hour intervals;
- select home, lock, or both when the emulator/device reports support;
- use the preferred preset or randomize presets;
- restrict quote selection to favorites; and
- see current schedule status, last application time, and an actionable error if the last run failed.

If favorites-only rotation is enabled with no favorites, configuration is rejected with an explanation rather than silently falling back.

### Settings

Settings contains the preferred preset, random-preset toggle, favorites-only rotation toggle, app version, and links to local help/about information. Automation-specific frequency and target controls remain on the Automation screen.

## 5. Architecture

### Shared application layer

- React Native with TypeScript.
- Expo development workflow with prebuild and committed native Android customization; the project is not limited to Expo Go.
- Expo Router for route organization.
- Zustand for application state.
- React Native MMKV for user-facing local state and migrations.
- React Native Skia for previews and foreground full-resolution exports.
- React Native Testing Library and the test runner selected during bootstrap for TypeScript and component tests.

Feature boundaries are `quotes`, `wallpaper`, `favorites`, `automation`, and `settings`. Screen components consume feature services and do not call native APIs directly.

### Android native layer

A narrow Kotlin module exposes:

```ts
type WallpaperTarget = 'home' | 'lock' | 'both';

interface NativeWallpaperManager {
  getCapabilities(): Promise<{
    supportsHome: boolean;
    supportsLock: boolean;
  }>;
  setWallpaper(imageUri: string, target: WallpaperTarget): Promise<void>;
  configureRotation(options: {
    enabled: boolean;
    intervalHours: 6 | 12 | 24;
    target: WallpaperTarget;
    selectedPresetId: string;
    randomizePreset: boolean;
    favoriteQuoteIds: string[];
    favoriteQuotesOnly: boolean;
  }): Promise<void>;
  getRotationStatus(): Promise<RotationStatus>;
}
```

Kotlin owns `WallpaperManager`, WorkManager scheduling, worker-readable settings, last-run status, and the background-compatible renderer. Native implementation details do not leak into React components.

### Future iOS boundary

Quotes, preset definitions, selection rules, state shapes, screen components, and Skia preview/export logic avoid Android imports. A future iOS implementation can reuse them and replace only the native wallpaper/automation adapter.

## 6. Data and persistence

Bundled JSON stores quotes with stable IDs, text, optional author, and category. Typed preset definitions store stable IDs and deterministic presentation values.

MMKV persists:

- favorite quote IDs;
- current and last-applied quote IDs;
- current and preferred preset IDs;
- random-preset and favorites-only choices;
- onboarding/help acknowledgements; and
- schema version for migrations.

The native module persists a minimal automation snapshot in Android-native storage so WorkManager can run without starting React Native. It includes schedule configuration, eligible favorite IDs, last applied quote/preset, last success time, and last failure details. `configureRotation` updates this snapshot atomically before enqueuing work.

Quotes and preset definitions are made available to both rendering paths from versioned bundled resources generated from the same source data during the build. The repository contains one authoritative source for each dataset.

## 7. Rendering

### Composition model

A deterministic composition contains a quote, preset, output width, and output height. Layout uses normalized margins and vertical positions so the same design scales across screen ratios. Text fitting reduces font size within preset limits until wrapped quote and author content fit the safe region. A final controlled truncation is allowed only when the configured minimum size still cannot fit an extreme input.

### Preview and manual export

The UI renders a scaled Skia preview from the composition model. Export does not capture the visible React Native view. It re-renders onto an offscreen Skia surface at the selected device wallpaper dimensions and encodes the result directly as PNG. Therefore preview size and display pixel density do not limit export quality.

The app determines a sensible full-resolution portrait output from current display metrics, subject to tested upper memory bounds. Export tests include approximately 30-, 80-, 150-, and 250-character quotes, multiple aspect ratios, and every preset.

### Background rendering

WorkManager cannot depend on a mounted React Native or Skia UI. A Kotlin bitmap renderer consumes the same versioned quote/preset data and layout contract, renders at full wallpaper resolution, and returns a bitmap to `WallpaperManager`.

Shared golden fixtures define wrapping, font-size choice, text box, alignment, and author placement for representative compositions. TypeScript and Kotlin tests assert against those fixtures. Small rasterization differences are acceptable; clipping, changed hierarchy, or materially different placement is not.

Bundled font files used by presets are also available as Android resources so foreground and background renderers use the same font faces.

## 8. Wallpaper application and automation

Manual application exports a full-resolution image, passes its URI and requested target to Kotlin, validates target capability, decodes within memory bounds, and applies it with `WallpaperManager`.

Automation uses uniquely named WorkManager periodic work. Enabling or changing automation replaces the existing schedule; disabling cancels it. The worker:

1. reads and validates the native automation snapshot;
2. builds the eligible quote set;
3. selects a quote while avoiding the immediately previous quote when alternatives exist;
4. selects the preferred or a random preset;
5. renders a full-resolution bitmap with the Kotlin renderer;
6. applies it to supported requested targets;
7. atomically records the selected IDs, completion time, and success; and
8. records a structured failure and returns the appropriate WorkManager result when unsuccessful.

Debug builds include a developer-only way to trigger the worker immediately. This validates worker behavior on the emulator without waiting six hours and is absent from release UI.

## 9. Permissions and errors

Permissions are requested only when the corresponding action needs them. Denial keeps browsing and wallpaper application usable where Android allows it, explains the unavailable save action, and offers a path to system settings when appropriate.

User-visible errors distinguish:

- wallpaper rendering failure;
- media-library permission denial;
- save failure;
- unsupported lock-screen target;
- direct wallpaper application failure;
- automation configuration failure;
- scheduled-worker failure; and
- empty favorites selection.

Errors preserve the current composition and offer retry or corrective action. Native errors cross the bridge as stable codes plus safe human-readable context. Logs do not contain user-sensitive information.

## 10. Testing and verification

### Automated tests

- Quote parsing, navigation, random selection, and no-immediate-repeat behavior.
- Favorites operations and empty favorites-only validation.
- Settings defaults, serialization, and migrations.
- Preset validation and deterministic composition selection.
- Text-fit calculations and shared layout fixtures.
- Screen interaction, accessibility labels, and important error states.
- Kotlin target capability handling, rendering fixtures, settings persistence, selection logic, and worker result handling.
- Native module contract tests where practical.

### Emulator verification

- Clean install and cold launch.
- Persistence after process restart.
- Every preset with short and long quotes.
- PNG export dimensions and visual inspection.
- Save permission granted and denied flows.
- Home wallpaper application.
- Lock/both behavior as supported by the emulator.
- Immediate debug worker execution while the app is foregrounded, backgrounded, and force-stopped where Android permits scheduled work to resume.
- Schedule replacement, cancellation, and no-immediate-repeat state.

The main configured emulator targets API 37. Additional stable Android emulator coverage may be installed and used if compatible system images are available during implementation.

### Physical-device release gate

Before public release, test on at least one modern Android phone:

- home, lock, and both target behavior;
- save behavior under the shipping Android version;
- 6-, 12-, and 24-hour real-time rotation;
- app backgrounded and process removed from recents;
- screen locked;
- reboot and app update behavior; and
- OEM battery optimization behavior.

Results and limitations are recorded in `docs/QA_CHECKLIST.md`.

## 11. Delivery milestones

1. Bootstrap Expo/React Native, strict TypeScript, routing, linting, formatting, tests, prebuild, and an emulator launch.
2. Add typed quote/preset data, browsing, favorites, persistence, and the primary screen flow.
3. Implement eight curated previews, text fitting, full-resolution offscreen export, and visual tests.
4. Implement media-library saving and permission/error flows.
5. Implement the Kotlin native module and direct wallpaper targets.
6. Implement native automation state, Kotlin background rendering, and WorkManager rotation.
7. Polish accessibility, empty/error states, performance, documentation, and complete emulator QA.

Each milestone keeps the project buildable and runs the checks relevant to its changes.

## 12. Operational requirements

No application server is required. Builds run locally using the installed Android SDK and emulator. A Git remote, CI provider, EAS Build, Sentry, Google Play Console, and Play signing are optional for this MVP development run and can be introduced for distribution later.

Development setup must establish a supported Node version, a resolvable JDK 17 environment, Android SDK environment variables, and all project dependencies. The README records exact commands and versions used.

## 13. Final deliverables

- Working React Native/Expo Android application.
- Kotlin wallpaper and WorkManager module.
- Bundled quote dataset and at least eight preset definitions.
- Automated tests and emulator verification evidence.
- `README.md` with setup, build, run, and verification commands.
- `docs/ANDROID_AUTOMATION.md`.
- `docs/QA_CHECKLIST.md` with emulator results and the physical-device release gate.
- Final implementation summary covering completed features, architecture, Android versions/emulators tested, known limitations, and post-MVP recommendations.
