# Motivana Android MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an offline, emulator-validated Android app that creates, saves, applies, and automatically rotates polished motivational wallpapers.

**Architecture:** Expo SDK 57 and React Native own the reusable UI, quote/preset domain, local state, and Skia preview/export path. A local Expo module exposes a narrow Kotlin API for `WallpaperManager`, native automation state, a background bitmap renderer, and WorkManager. JSON under `assets/data` is authoritative for both TypeScript and Kotlin.

**Tech Stack:** Node.js 22.13+, npm, Expo SDK 57, React Native 0.86, React 19.2, TypeScript strict mode, Expo Router, Zustand, React Native MMKV v4, React Native Skia 2.6, Expo FileSystem, Expo MediaLibrary, Kotlin, AndroidX WorkManager, Jest/`jest-expo`, React Native Testing Library, and Android emulator/ADB.

**Spec:** `docs/superpowers/specs/2026-08-23-android-wallpaper-mvp-design.md`

## Global Constraints

- Product name is `Motivana`.
- Android `applicationId` and Kotlin namespace are `org.haina2410.motivana`.
- The development run is Android-only and complete on the configured emulator; physical Android QA remains the release gate.
- Use Expo SDK 57 stable with React Native 0.86, React 19.2.3, Node.js 22.13.x or newer, `compileSdkVersion` 36, and `targetSdkVersion` 36.
- Do not use Expo Go; native development builds and prebuild are required.
- Keep quotes, presets, favorites, settings, rendering, and automation offline with no backend or account.
- Provide at least 100 English quotes and exactly six supported categories: motivation, discipline, focus, confidence, growth, and success.
- Provide at least eight curated presets; users do not upload pictures or edit individual typography properties.
- Foreground export re-renders offscreen at full wallpaper resolution and writes PNG; it never screenshots the visible preview.
- Scheduled rotation supports 6, 12, and 24 hours, avoids immediate quote repetition, and uses WorkManager timing guarantees rather than exact alarms.
- Do not claim home/lock/both behavior or long-duration scheduling is release-validated until physical-device QA is complete.
- Follow TDD for application logic and native logic. End every task with the specified verification and commit.

---

## Planned File Structure

### Application shell

- `app/_layout.tsx` — root stack, font loading, safe-area/status-bar setup.
- `app/index.tsx` — home wallpaper experience.
- `app/customize.tsx` — curated preset selection.
- `app/favorites.tsx` — favorite quote list and empty state.
- `app/automation.tsx` — rotation configuration/status and debug trigger.
- `app/settings.tsx` — preferred preset and minimal app information.
- `app.json` — app identity, Android package, permissions, plugins, and Android-only platform declaration.

### Domain and UI

- `assets/data/quotes.json` — authoritative quote catalog.
- `assets/data/presets.json` — authoritative preset catalog.
- `assets/fonts/` — bundled OFL font files used by both renderers.
- `assets/licenses/` — exact OFL license texts and font attribution.
- `src/features/quotes/types.ts` — quote/category types and runtime parsing.
- `src/features/quotes/quoteRepository.ts` — catalog lookup/navigation/selection.
- `src/features/wallpaper/types.ts` — preset/composition/render result types.
- `src/features/wallpaper/presetRepository.ts` — preset parsing and lookup.
- `src/features/wallpaper/textFit.ts` — pure iterative font fitting.
- `src/features/wallpaper/composition.ts` — deterministic normalized geometry.
- `src/features/wallpaper/WallpaperCanvas.tsx` — Skia preview scene.
- `src/features/wallpaper/exportWallpaper.ts` — full-resolution offscreen Skia PNG export.
- `src/features/wallpaper/useWallpaperFonts.ts` — shared Skia font manager.
- `src/store/storage.ts` — MMKV instance and injectable key/value contract.
- `src/store/schema.ts` — persisted state versioning/migration.
- `src/store/useAppStore.ts` — Zustand state and actions.
- `src/services/mediaLibrary.ts` — permission and `Asset.create` adapter.
- `src/services/wallpaperNative.ts` — typed native module adapter and error normalization.
- `src/components/` — focused controls, cards, preset thumbnails, messages, and status rows.
- `src/theme/` — color, spacing, radius, and typography tokens for app chrome.

### Native Android module

- `modules/motivana-wallpaper/expo-module.config.json` — Expo autolinking declaration.
- `modules/motivana-wallpaper/index.ts` — public module export.
- `modules/motivana-wallpaper/src/MotivanaWallpaperModule.ts` — `requireNativeModule` binding.
- `modules/motivana-wallpaper/src/MotivanaWallpaper.types.ts` — TypeScript native contract.
- `modules/motivana-wallpaper/android/build.gradle` — Kotlin/WorkManager dependencies and shared asset sources.
- `modules/motivana-wallpaper/android/src/main/AndroidManifest.xml` — normal wallpaper permission.
- `modules/motivana-wallpaper/android/src/main/java/org/haina2410/motivana/wallpaper/MotivanaWallpaperModule.kt` — Expo module functions.
- `modules/motivana-wallpaper/android/src/main/java/org/haina2410/motivana/wallpaper/WallpaperTarget.kt` — target parsing and flags.
- `modules/motivana-wallpaper/android/src/main/java/org/haina2410/motivana/wallpaper/WallpaperCapabilities.kt` — capability checks.
- `modules/motivana-wallpaper/android/src/main/java/org/haina2410/motivana/wallpaper/AutomationPreferences.kt` — atomic native settings/status.
- `modules/motivana-wallpaper/android/src/main/java/org/haina2410/motivana/wallpaper/WallpaperRotationScheduler.kt` — unique periodic/immediate work.
- `modules/motivana-wallpaper/android/src/main/java/org/haina2410/motivana/wallpaper/WallpaperRotationWorker.kt` — selection/render/apply/status pipeline.
- `modules/motivana-wallpaper/android/src/main/java/org/haina2410/motivana/wallpaper/NativeCatalog.kt` — JSON parsing.
- `modules/motivana-wallpaper/android/src/main/java/org/haina2410/motivana/wallpaper/NativeWallpaperRenderer.kt` — full-resolution Android bitmap rendering.
- `modules/motivana-wallpaper/android/src/test/` — JVM unit tests for targets, selection, persistence serialization, layout, and scheduling inputs.

### Tests, scripts, and docs

- `src/**/__tests__/` and `app/__tests__/` — Jest and component tests adjacent to features.
- `scripts/verify-data.mjs` — quote/preset/font integrity validation.
- `scripts/android-env.sh` — repository-local SDK/JDK defaults without mutating the user's shell profile.
- `scripts/emulator-smoke.sh` — install/launch/screenshot/log smoke verification.
- `README.md` — exact setup/build/test/run instructions.
- `docs/ANDROID_AUTOMATION.md` — user and engineering automation behavior.
- `docs/QA_CHECKLIST.md` — completed emulator evidence and unchecked physical-device gates.

---

### Task 1: Bootstrap a Reproducible Native Expo Android App

**Files:**
- Create: `.nvmrc`
- Create: `.prettierignore`
- Create: `.prettierrc.json`
- Create: `scripts/android-env.sh`
- Create/modify from Expo scaffold: `package.json`, `package-lock.json`, `app.json`, `tsconfig.json`, `eslint.config.js`, `jest.config.js`, `jest.setup.ts`, `app/_layout.tsx`, `app/index.tsx`
- Test: `app/__tests__/bootstrap.test.tsx`

**Interfaces:**
- Consumes: configured emulator `Medium_Phone`, JDK at `/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home`, SDK at `/Users/nam/Library/Android/sdk`.
- Produces: `npm run lint`, `npm run typecheck`, `npm test`, `npm run format:check`, `npm run android`, and a launchable `org.haina2410.motivana` debug app.

- [ ] **Step 1: Generate the SDK 57 scaffold without touching Git history**

Use a temporary directory because the repository already contains specifications:

```bash
bootstrap_dir=$(mktemp -d /tmp/motivana-expo.XXXXXX)
npx create-expo-app@latest "$bootstrap_dir/app" --template default@sdk-57 --yes
rsync -a --exclude .git "$bootstrap_dir/app/" ./
```

Preserve `MVP_BUILD_SPEC.md` and `docs/`. Do not delete the temporary directory recursively during this task; the operating system may clean `/tmp` later.

- [ ] **Step 2: Pin identity, platform, and scripts**

Set `.nvmrc` to `22.13.1`. Configure `app.json` with:

```json
{
  "expo": {
    "name": "Motivana",
    "slug": "motivana",
    "scheme": "motivana",
    "version": "0.1.0",
    "orientation": "portrait",
    "platforms": ["android"],
    "newArchEnabled": true,
    "android": {
      "package": "org.haina2410.motivana",
      "permissions": ["android.permission.SET_WALLPAPER"]
    },
    "plugins": ["expo-router", "expo-media-library"]
  }
}
```

Use this formatting configuration:

```json
{
  "singleQuote": true,
  "trailingComma": "all"
}
```

Set `.prettierignore` to `android/`, `artifacts/`, `coverage/`, `.expo/`, and `node_modules/` so generated and evidence files are not mechanically rewritten.

Add these `package.json` scripts:

```json
{
  "scripts": {
    "android": "expo run:android",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "lint": "expo lint",
    "typecheck": "tsc --noEmit",
    "test": "jest --runInBand",
    "test:watch": "jest --watch",
    "verify:data": "node scripts/verify-data.mjs",
    "verify": "npm run format:check && npm run lint && npm run typecheck && npm run verify:data && npm test"
  }
}
```

- [ ] **Step 3: Install only the approved runtime and test dependencies**

```bash
npx expo install @shopify/react-native-skia expo-file-system expo-font expo-media-library jest-expo react-native-mmkv react-native-nitro-modules
npm install zustand
npm install --save-dev @testing-library/react-native prettier eslint-config-prettier
```

Use the versions selected by Expo SDK 57 compatibility checks. Run `npx expo install --check` and resolve every mismatch with `npx expo install --fix`; do not install canary packages.

- [ ] **Step 4: Configure strict TypeScript, Jest, and formatting**

Ensure `tsconfig.json` contains `"strict": true`, `"noUncheckedIndexedAccess": true`, and the `@/* -> ./*` alias. Configure Jest as:

```js
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  collectCoverageFrom: ['app/**/*.{ts,tsx}', 'src/**/*.{ts,tsx}'],
  testPathIgnorePatterns: ['/node_modules/', '/android/'],
};
```

Use RNTL 13's built-in matchers and provide only the native storage mocks required by Node-based tests:

```ts
const mockMmkvValues = new Map<string, string>();

jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getString: (key: string) => mockMmkvValues.get(key),
    set: (key: string, value: string) => mockMmkvValues.set(key, value),
    remove: (key: string) => mockMmkvValues.delete(key),
    clearAll: () => mockMmkvValues.clear(),
  }),
}));
jest.mock('react-native-nitro-modules', () => ({ NitroModules: {} }));
```

- [ ] **Step 5: Write the failing bootstrap component test**

```tsx
import { render, screen } from '@testing-library/react-native';
import HomeScreen from '../index';

test('renders the product name and loading preview state', () => {
  render(<HomeScreen />);
  expect(screen.getByText('Motivana')).toBeOnTheScreen();
  expect(screen.getByLabelText('Wallpaper preview')).toBeOnTheScreen();
});
```

- [ ] **Step 6: Run the test to verify the intentional failure**

Run: `npm test -- app/__tests__/bootstrap.test.tsx`

Expected: FAIL because the generated template does not render the required product title and accessible preview container.

- [ ] **Step 7: Replace generated demo routes with the minimal app shell**

Make `app/_layout.tsx` render a `Stack` with hidden default headers and make `app/index.tsx` render only a safe-area screen containing `Motivana` and an accessible temporary preview surface labeled `Wallpaper preview`. Remove sample tabs and demo assets that are not used.

- [ ] **Step 8: Add a repository-local Android environment helper**

Create `scripts/android-env.sh`:

```bash
#!/usr/bin/env bash
export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home}"
export ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-/Users/nam/Library/Android/sdk}"
export PATH="$JAVA_HOME/bin:$ANDROID_SDK_ROOT/platform-tools:$ANDROID_SDK_ROOT/emulator:$PATH"
```

The script must be sourced (`source scripts/android-env.sh`) and must not edit `.zshrc`, `.bashrc`, or global machine configuration.

- [ ] **Step 9: Prebuild, compile, install, and launch on the emulator**

```bash
source scripts/android-env.sh
npx expo prebuild --clean --platform android
npx expo run:android --no-bundler
adb shell am force-stop org.haina2410.motivana
adb shell monkey -p org.haina2410.motivana -c android.intent.category.LAUNCHER 1
```

Expected: Gradle builds successfully, the APK installs, and `adb shell pidof org.haina2410.motivana` returns a process ID after launch.

- [ ] **Step 10: Verify and commit the bootstrap**

Run: `npm run format && npm run verify && source scripts/android-env.sh && cd android && ./gradlew assembleDebug testDebugUnitTest`

Expected: all commands exit 0.

```bash
git add .nvmrc .prettierignore .prettierrc.json app app.json assets eslint.config.js jest.config.js jest.setup.ts package.json package-lock.json scripts/android-env.sh tsconfig.json
git commit -m "build: bootstrap Motivana Android app"
```

### Task 2: Add Validated Quote and Preset Catalogs

**Files:**
- Create: `assets/data/quotes.json`
- Create: `assets/data/presets.json`
- Create: `assets/fonts/Inter-Regular.ttf`, `assets/fonts/Inter-SemiBold.ttf`, `assets/fonts/Lora-Regular.ttf`, `assets/fonts/Lora-SemiBold.ttf`, `assets/fonts/Oswald-Medium.ttf`
- Create: `assets/licenses/Inter-OFL.txt`, `assets/licenses/Lora-OFL.txt`, `assets/licenses/Oswald-OFL.txt`
- Create: `src/features/quotes/types.ts`
- Create: `src/features/quotes/quoteRepository.ts`
- Create: `src/features/wallpaper/types.ts`
- Create: `src/features/wallpaper/presetRepository.ts`
- Create: `scripts/verify-data.mjs`
- Test: `src/features/quotes/__tests__/quoteRepository.test.ts`
- Test: `src/features/wallpaper/__tests__/presetRepository.test.ts`

**Interfaces:**
- Consumes: JSON module support from `tsconfig.json` and bundled app assets.
- Produces: `Quote`, `QuoteCategory`, `WallpaperPreset`, `getAllQuotes()`, `getQuoteById(id)`, `getAdjacentQuote(id, direction)`, `selectRandomQuote(options)`, `getAllPresets()`, and `getPresetById(id)`.

- [ ] **Step 1: Define runtime-safe domain types**

```ts
export const quoteCategories = [
  'motivation', 'discipline', 'focus', 'confidence', 'growth', 'success',
] as const;
export type QuoteCategory = (typeof quoteCategories)[number];
export interface Quote {
  id: string;
  text: string;
  author?: string;
  category: QuoteCategory;
}
```

Define presets with `id`, `name`, `fontFamily`, `fontWeight`, `textAlign`, `quotePositionY`, `textColor`, `authorColor`, `preferredFontSizeRatio`, `minimumFontSizeRatio`, `lineHeight`, optional overlay, and a background union of solid or linear gradient. Reject unknown background kinds and invalid ratios at repository load time.

- [ ] **Step 2: Write failing catalog tests**

```ts
test('ships at least 100 unique, non-empty quotes across every category', () => {
  const quotes = getAllQuotes();
  expect(quotes.length).toBeGreaterThanOrEqual(100);
  expect(new Set(quotes.map(q => q.id)).size).toBe(quotes.length);
  expect(new Set(quotes.map(q => q.category))).toEqual(new Set(quoteCategories));
  expect(quotes.every(q => q.text.trim().length >= 12)).toBe(true);
});

test('ships eight valid and visually distinct presets', () => {
  const presets = getAllPresets();
  expect(presets).toHaveLength(8);
  expect(new Set(presets.map(p => JSON.stringify(p.background))).size).toBe(8);
});
```

Also test forward/back wraparound, missing ID behavior, filtered selection, seeded no-immediate-repeat behavior, invalid JSON rejection, ratio bounds, and valid font names.

- [ ] **Step 3: Run tests to verify missing-module failures**

Run: `npm test -- src/features/quotes src/features/wallpaper`

Expected: FAIL because repositories and data do not exist.

- [ ] **Step 4: Create the original quote catalog**

Write 120 concise original motivational maxims, 20 per category, with stable IDs `motivation-001` through `success-020`. Use `"author": "Motivana"` for original app copy rather than attributing modern copyrighted quotations. Vary sentence length so the catalog includes short, medium, long, and at least four 200–280 character rendering stress cases. Do not paraphrase a recognizable quotation and attach another person's name.

- [ ] **Step 5: Create eight curated presets**

Use these stable IDs and design directions:

```text
midnight-focus  — navy-to-black, Inter Semibold, centered at 0.43
sunrise-drive   — coral-to-gold, Inter Semibold, left at 0.40
forest-discipline — pine-to-emerald, Lora Semibold, centered at 0.46
violet-growth   — indigo-to-violet, Lora Regular, centered at 0.42
paper-confidence — warm ivory solid, Oswald Medium, left at 0.39
ocean-success   — deep teal-to-blue, Inter Regular, centered at 0.45
ember-action    — burgundy-to-orange, Oswald Medium, right at 0.41
mono-clarity    — charcoal solid, Inter Regular, left at 0.47
```

All colors must meet WCAG AA contrast for the quote text. Store exact values in `presets.json`; no UI code duplicates these values.

- [ ] **Step 6: Bundle open-font-license assets and attribution**

Download the named font binaries and their OFL license files from the official Google Fonts repositories. Record upstream family names and source URLs in `assets/licenses/README.md`. Verify each font file is a valid TrueType file with `file assets/fonts/*.ttf`; HTML responses or empty files fail the task.

- [ ] **Step 7: Implement repositories and seeded selection**

Use an injectable random function:

```ts
export interface RandomQuoteOptions {
  eligibleIds?: ReadonlySet<string>;
  previousId?: string;
  random?: () => number;
}

export function selectRandomQuote(options: RandomQuoteOptions = {}): Quote;
```

Clamp the random index, exclude `previousId` when two or more eligible quotes exist, and throw `QuoteSelectionError('NO_ELIGIBLE_QUOTES')` for an empty eligible set. Return defensive readonly arrays from repositories.

- [ ] **Step 8: Add build-time integrity validation**

`scripts/verify-data.mjs` must parse both JSON files, assert the same invariants as the tests, assert that every referenced font file exists, and exit nonzero with a precise path/message. Run it through `npm run verify:data`.

- [ ] **Step 9: Verify and commit catalogs**

Run: `npm run format && npm run verify`

Expected: all tests and data validation pass.

```bash
git add assets src/features/quotes src/features/wallpaper scripts/verify-data.mjs
git commit -m "feat: add quote and wallpaper preset catalogs"
```

### Task 3: Implement Versioned Local State and Selection Rules

**Files:**
- Create: `src/store/storage.ts`
- Create: `src/store/schema.ts`
- Create: `src/store/useAppStore.ts`
- Test: `src/store/__tests__/schema.test.ts`
- Test: `src/store/__tests__/useAppStore.test.ts`

**Interfaces:**
- Consumes: quote/preset IDs from Task 2 and `createMMKV()` from React Native MMKV.
- Produces: `PersistedAppStateV1`, `AppState`, `appStorage`, `hydrateAppState()`, and `useAppStore` actions used by all screens.

- [ ] **Step 1: Define the persisted schema and defaults**

```ts
export interface PersistedAppStateV1 {
  version: 1;
  favoriteQuoteIds: string[];
  currentQuoteId: string;
  lastAppliedQuoteId?: string;
  selectedPresetId: string;
  randomizePreset: boolean;
  favoriteQuotesOnly: boolean;
  rotationEnabled: boolean;
  rotationIntervalHours: 6 | 12 | 24;
  wallpaperTarget: 'home' | 'lock' | 'both';
}
```

Defaults use the first quote, `midnight-focus`, no favorites, randomization off, automation off, 24 hours, and `home` target.

- [ ] **Step 2: Write failing migration and action tests**

Cover corrupt JSON fallback, unknown future versions fallback with a logged safe warning, invalid quote/preset ID repair, deduped favorites, favorite toggling, previous/next wraparound, random selection without immediate repeat, and rejection of favorites-only rotation when favorites are empty.

```ts
test('repairs catalog IDs removed by an app update', () => {
  expect(migratePersistedState({ version: 1, currentQuoteId: 'gone', selectedPresetId: 'gone' }))
    .toMatchObject({ currentQuoteId: getAllQuotes()[0].id, selectedPresetId: 'midnight-focus' });
});
```

- [ ] **Step 3: Run tests to verify missing implementations**

Run: `npm test -- src/store`

Expected: FAIL with unresolved storage/schema/store modules.

- [ ] **Step 4: Implement an injectable storage boundary**

```ts
export interface KeyValueStorage {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export const appStorage: KeyValueStorage = createMMKV({ id: 'motivana.preferences' });
```

Keep JSON parsing/migration pure by accepting `KeyValueStorage` parameters. Tests use an in-memory `Map` adapter and do not require the Nitro native module.

- [ ] **Step 5: Implement focused Zustand actions**

Expose `nextQuote`, `previousQuote`, `randomQuote`, `selectQuote`, `toggleFavorite`, `selectPreset`, `setRandomizePreset`, `setFavoriteQuotesOnly`, `setRotationConfiguration`, `recordAppliedQuote`, and `hydrate`. Each action persists only after it has produced a valid next state. Do not persist transient snackbars, modal state, render progress, or native status polling.

- [ ] **Step 6: Verify persistence in Jest and the development build**

Run: `npm test -- src/store && npm run typecheck`

Then launch the app, mutate a temporary store value through a small development-only invocation, force-stop/relaunch with ADB, and confirm the value rehydrates. Remove the temporary invocation before committing.

- [ ] **Step 7: Commit state and persistence**

```bash
git add src/store
git commit -m "feat: persist wallpaper preferences and favorites"
```

### Task 4: Build the Deterministic Skia Preview and Full-Resolution PNG Export

**Files:**
- Create: `src/features/wallpaper/textFit.ts`
- Create: `src/features/wallpaper/composition.ts`
- Create: `src/features/wallpaper/useWallpaperFonts.ts`
- Create: `src/features/wallpaper/WallpaperCanvas.tsx`
- Create: `src/features/wallpaper/exportWallpaper.ts`
- Create: `src/features/wallpaper/renderErrors.ts`
- Test: `src/features/wallpaper/__tests__/textFit.test.ts`
- Test: `src/features/wallpaper/__tests__/composition.test.ts`
- Test: `src/features/wallpaper/__tests__/exportWallpaper.test.ts`

**Interfaces:**
- Consumes: `Quote`, `WallpaperPreset`, bundled fonts, Expo FileSystem `File`/`Paths`, and Skia.
- Produces: `fitText()`, `createComposition()`, `<WallpaperCanvas composition />`, and `exportWallpaper(composition): Promise<RenderedWallpaper>`.

- [ ] **Step 1: Define renderer contracts and injected measurement**

```ts
export interface WallpaperCompositionInput {
  quote: Quote;
  preset: WallpaperPreset;
  width: number;
  height: number;
}

export interface RenderedWallpaper {
  uri: string;
  width: number;
  height: number;
}

export interface WallpaperComposition extends WallpaperCompositionInput {
  cacheKey: string;
  quoteBounds: { x: number; y: number; width: number; height: number };
  authorY: number;
  quoteFontSize: number;
  authorFontSize: number;
  maxQuoteLines: number;
  truncated: boolean;
}

export interface TextMeasurer {
  measure(text: string, width: number, fontSize: number, lineHeight: number): {
    height: number;
    lineCount: number;
  };
}
```

`fitText` starts at the preferred pixel size, decrements by one logical pixel, stops at the minimum, and returns `{ fontSize, measuredHeight, truncated, maxLines }`. It never returns a box exceeding the supplied maximum height.

- [ ] **Step 2: Write failing fit and geometry tests**

Use injected deterministic measurers to test immediate fit, multiple decrements, exact minimum fit, truncation at minimum, 30/80/150/250-character cases, portrait aspect ratios 9:16 and 9:20, safe margins, and quote/author non-overlap.

```ts
test('uses controlled ellipsis at minimum size instead of clipping', () => {
  const result = fitText({ preferredSize: 72, minimumSize: 40, maxHeight: 200, measure: alwaysTooTall });
  expect(result).toMatchObject({ fontSize: 40, truncated: true });
  expect(result.maxLines).toBeGreaterThan(0);
});
```

- [ ] **Step 3: Run focused tests to verify failures**

Run: `npm test -- src/features/wallpaper/__tests__/textFit.test.ts src/features/wallpaper/__tests__/composition.test.ts`

Expected: FAIL because fitting and composition modules are absent.

- [ ] **Step 4: Implement normalized composition geometry**

Use horizontal safe margins of 8% of width, top/bottom safe margins of 10% of height, preset `quotePositionY` as the quote block center, an author gap of 2.2% of height, and font ratios relative to width. Clamp the combined block into safe bounds after measurement. Store only calculated pixels in the returned composition.

- [ ] **Step 5: Implement one reusable Skia scene**

`WallpaperCanvas` draws background, optional overlay, quote paragraph, author paragraph, and a subtle decorative mark defined by the preset. Use `Skia.ParagraphBuilder` and `useFonts` with the bundled Inter/Lora/Oswald families. The same composition properties drive both preview and export; do not create separate preview layout constants.

- [ ] **Step 6: Write the failing export service test**

Mock the Skia surface and Expo FileSystem boundary. Assert that export requests an offscreen surface at exact requested dimensions, encodes PNG bytes, writes a `.png` under `Paths.cache/motivana-exports`, and returns matching metadata. Assert `RenderError('SURFACE_CREATION_FAILED')`, `RenderError('ENCODE_FAILED')`, and `RenderError('FILE_WRITE_FAILED')` mappings.

- [ ] **Step 7: Implement full-resolution offscreen export**

```ts
const directory = new Directory(Paths.cache, 'motivana-exports');
directory.create({ idempotent: true, intermediates: true });
const output = new File(directory, `${composition.cacheKey}.png`);
output.create({ overwrite: true, intermediates: true });
output.write(pngBytes);
return { uri: output.uri, width: composition.width, height: composition.height };
```

Create a Skia offscreen surface at `width × height`, draw the shared scene into its canvas, flush, snapshot, encode as PNG, and dispose native objects in `finally`. Reject dimensions below 720 pixels wide, non-portrait dimensions, and dimensions whose RGBA allocation exceeds 64 MiB.

- [ ] **Step 8: Integrate and inspect all presets on the emulator**

Temporarily render a preset/quote debug gallery reachable only under `__DEV__`. Capture screenshots for all eight presets and short/long/stress quotes. Fix clipping, contrast, or incorrect font loading; remove the gallery route after visual inspection.

- [ ] **Step 9: Verify and commit rendering**

Run: `npm run verify && source scripts/android-env.sh && cd android && ./gradlew assembleDebug`

Expected: all checks exit 0 and a manually exported PNG reports exact 1080×2400 dimensions with `file` or `identify`.

```bash
git add src/features/wallpaper assets app.json package.json package-lock.json
git commit -m "feat: render full-resolution motivational wallpapers"
```

### Task 5: Build the Polished User Flow

**Files:**
- Modify: `app/_layout.tsx`, `app/index.tsx`
- Create: `app/customize.tsx`, `app/favorites.tsx`, `app/automation.tsx`, `app/settings.tsx`
- Create: `src/theme/colors.ts`, `src/theme/spacing.ts`, `src/theme/typography.ts`
- Create: `src/components/AppIconButton.tsx`, `PresetThumbnail.tsx`, `QuoteListItem.tsx`, `ActionMessage.tsx`, `SettingRow.tsx`, `WallpaperActions.tsx`
- Test: `app/__tests__/home.test.tsx`, `customize.test.tsx`, `favorites.test.tsx`, `automation.test.tsx`, `settings.test.tsx`

**Interfaces:**
- Consumes: store actions/selectors, quote/preset repositories, `WallpaperCanvas`, and route parameters.
- Produces: accessible Home, Customize, Favorites, Automation, and Settings flows; save/set actions remain disabled with explicit explanatory copy until Task 6.

- [ ] **Step 1: Write failing screen behavior tests**

Cover Home next/previous/favorite/randomize, navigation to each screen, preset selection returning to Home, favorite selection returning to Home, empty favorites state, automation form validation, and Settings persistence.

```tsx
test('selecting a preset updates the preview and returns home', async () => {
  render(<CustomizeScreen />);
  await user.press(screen.getByLabelText('Use Forest Discipline preset'));
  expect(mockStore.selectPreset).toHaveBeenCalledWith('forest-discipline');
  expect(mockRouter.back).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run screen tests to verify failures**

Run: `npm test -- app/__tests__`

Expected: FAIL because final screens and components do not exist.

- [ ] **Step 3: Implement premium but minimal app chrome**

Use near-black chrome, warm off-white primary text, one restrained accent, 8-point spacing, 16/24-pixel radii, minimum 48×48 touch targets, and system-safe insets. The preview occupies most of Home; labels do not overlay the wallpaper except compact translucent action controls. Respect Android font scaling and screen-reader labels.

- [ ] **Step 4: Implement navigation and focused screens**

Use Expo Router `Stack` routes only; do not add a persistent bottom tab bar that reduces preview height. Home actions push Customize/Favorites/Automation/Settings. A selected favorite or preset updates store state and returns. Automation shows typed unavailable capability/status values from the service boundary that Task 6 replaces.

- [ ] **Step 5: Implement loading, empty, and error presentation**

Fonts/catalog hydration shows a branded loading state. Favorites empty state includes “Favorite a quote from Home to use it here.” Render errors keep the current quote/preset and offer Retry. Every icon-only control has an accessibility label and hint.

- [ ] **Step 6: Run component and emulator interaction tests**

Run: `npm test -- app/__tests__ && npm run verify`

Use ADB to launch, tap through every route, change a preset, favorite a quote, force-stop, relaunch, and confirm persistence. Capture Home and Customize screenshots at 1080×2400 and inspect spacing, clipping, and contrast.

- [ ] **Step 7: Commit the shared experience**

```bash
git add app src/components src/theme
git commit -m "feat: build Motivana wallpaper experience"
```

### Task 6: Save Wallpapers and Apply Them Through a Local Kotlin Module

**Files:**
- Create: `src/services/mediaLibrary.ts`, `src/services/wallpaperNative.ts`
- Create: `modules/motivana-wallpaper/expo-module.config.json`, `index.ts`, `src/MotivanaWallpaperModule.ts`, `src/MotivanaWallpaper.types.ts`, `package.json`
- Create: `modules/motivana-wallpaper/android/build.gradle`, `src/main/AndroidManifest.xml`
- Create: `modules/motivana-wallpaper/android/src/main/java/org/haina2410/motivana/wallpaper/MotivanaWallpaperModule.kt`, `WallpaperTarget.kt`, `WallpaperCapabilities.kt`
- Modify: `app/index.tsx`, `src/components/WallpaperActions.tsx`, `package.json`, `app.json`
- Test: `src/services/__tests__/mediaLibrary.test.ts`, `wallpaperNative.test.ts`
- Test: `modules/motivana-wallpaper/android/src/test/java/org/haina2410/motivana/wallpaper/WallpaperTargetTest.kt`

**Interfaces:**
- Consumes: `RenderedWallpaper.uri` and Expo MediaLibrary/FileSystem.
- Produces: `saveWallpaper(uri)`, `getCapabilities()`, `setWallpaper(uri, target)`, and stable `WallpaperServiceError` codes.

- [ ] **Step 1: Define the exact TypeScript/native contract**

```ts
export type WallpaperTarget = 'home' | 'lock' | 'both';
export interface WallpaperCapabilities { supportsHome: boolean; supportsLock: boolean; }
export interface RotationStatus {
  enabled: boolean;
  state: 'disabled' | 'scheduled' | 'running' | 'succeeded' | 'failed';
  lastAppliedAt?: number;
  lastQuoteId?: string;
  errorCode?: string;
}

export interface ConfigureRotationOptions {
  enabled: boolean;
  intervalHours: 6 | 12 | 24;
  target: WallpaperTarget;
  selectedPresetId: string;
  randomizePreset: boolean;
  favoriteQuoteIds: string[];
  favoriteQuotesOnly: boolean;
}

export interface MotivanaWallpaperNativeContract {
  getCapabilities(): Promise<WallpaperCapabilities>;
  setWallpaper(uri: string, target: WallpaperTarget): Promise<void>;
  configureRotation(options: ConfigureRotationOptions): Promise<void>;
  getRotationStatus(): Promise<RotationStatus>;
  runRotationNow(): Promise<void>;
}
```

Expose the five functions in `MotivanaWallpaperNativeContract`. Task 6 implements the first two; Task 7 implements the remaining three without changing signatures. `saveWallpaper(uri)` returns `Promise<{ assetId: string }>` from the TypeScript media adapter.

- [ ] **Step 2: Write failing TypeScript adapter tests**

Test write-only permission granted/denied/can-ask-again states, `Asset.create(uri)`, URI validation, target validation, and native code normalization for `WALLPAPER_NOT_ALLOWED`, `LOCK_UNSUPPORTED`, `FILE_NOT_FOUND`, `DECODE_FAILED`, and `APPLY_FAILED`.

- [ ] **Step 3: Write failing Kotlin target/capability tests**

```kotlin
@Test fun bothMapsToSystemAndLockFlags() {
  assertEquals(WallpaperManager.FLAG_SYSTEM or WallpaperManager.FLAG_LOCK,
    WallpaperTarget.parse("both").flags)
}

@Test(expected = IllegalArgumentException::class)
fun invalidTargetIsRejected() { WallpaperTarget.parse("desk") }
```

Abstract API-level/capability checks so JVM tests can cover API below 24, lock support, and `isSetWallpaperAllowed` without a device.

- [ ] **Step 4: Run tests to verify missing implementations**

Run: `npm test -- src/services`

Expected: FAIL with unresolved adapters. Native tests fail after module scaffolding until target/capability classes exist.

- [ ] **Step 5: Implement modern MediaLibrary saving**

Call `requestPermissionsAsync({ writeOnly: true, granularPermissions: ['photo'] })`, return `PERMISSION_DENIED` with `canAskAgain`, and create the asset with `Asset.create(uri)`. Never request media permission on launch. Preserve the exported cache file if saving fails so Retry uses the same render.

- [ ] **Step 6: Scaffold the local Expo module and manifest**

Autolink `org.haina2410.motivana.wallpaper.MotivanaWallpaperModule`. Add `android.permission.SET_WALLPAPER` to the module manifest. Configure the module Android source set to include the repository `assets/` directory so Task 7 can load the exact shared JSON/fonts. Avoid experimental inline modules.

- [ ] **Step 7: Implement direct wallpaper application**

In Kotlin, validate the file URI and `WallpaperManager.isSetWallpaperAllowed`, decode with bounds first, enforce the 64 MiB RGBA limit, decode the bitmap, and call:

```kotlin
wallpaperManager.setBitmap(bitmap, null, true, target.flags)
```

Use `FLAG_SYSTEM`, `FLAG_LOCK`, or their bitwise combination. On API below 24 report lock unsupported and retain home support. Always recycle decoded bitmaps in `finally`. Reject `content:` or network URIs; the bridge accepts app-owned `file:` URIs only.

- [ ] **Step 8: Connect Home save/set actions and errors**

Home renders once per user action, disables duplicate taps while working, then calls save or native apply. For “Set wallpaper,” present Home/Lock/Both choices filtered by capabilities. Success messages say exactly what happened; failure messages retain the current composition and expose Retry.

- [ ] **Step 9: Prebuild, test, and verify on emulator**

```bash
source scripts/android-env.sh
npx expo prebuild --clean --platform android
npx expo run:android --no-bundler
cd android && ./gradlew testDebugUnitTest assembleDebug
```

Apply a generated wallpaper to Home, capture the launcher before/after with `adb exec-out screencap -p`, and visually confirm the quote/preset changed. Exercise Lock/Both only if `getCapabilities()` reports support.

- [ ] **Step 10: Commit saving and native application**

```bash
git add app src/services src/components modules app.json package.json package-lock.json
git commit -m "feat: save and apply Android wallpapers"
```

### Task 7: Implement Reliable WorkManager Rotation and Native Background Rendering

**Files:**
- Modify: `modules/motivana-wallpaper/android/build.gradle`, `MotivanaWallpaperModule.kt`
- Create: `modules/motivana-wallpaper/android/src/main/java/org/haina2410/motivana/wallpaper/AutomationPreferences.kt`, `WallpaperRotationScheduler.kt`, `WallpaperRotationWorker.kt`, `NativeCatalog.kt`, `NativeWallpaperRenderer.kt`, `NativeQuoteSelector.kt`
- Modify: `app/automation.tsx`, `src/services/wallpaperNative.ts`, `src/store/useAppStore.ts`
- Test: `modules/motivana-wallpaper/android/src/test/java/org/haina2410/motivana/wallpaper/AutomationPreferencesTest.kt`, `NativeCatalogTest.kt`, `NativeQuoteSelectorTest.kt`, `NativeWallpaperRendererTest.kt`, `WallpaperRotationSchedulerTest.kt`
- Test: `app/__tests__/automation.test.tsx`

**Interfaces:**
- Consumes: shared JSON/fonts, `WallpaperTarget`, WorkManager, store settings, and the Task 6 native contract.
- Produces: persistent periodic work named `motivana.wallpaper.rotation`, immediate debug work named `motivana.wallpaper.rotation.debug`, and observable `RotationStatus`.

- [ ] **Step 1: Add WorkManager and test dependencies**

Add stable AndroidX `work-runtime-ktx` and `work-testing` versions compatible with Expo SDK 57's generated Android project. Use the generated version catalog when it already defines WorkManager; otherwise declare one explicit version in the module Gradle file. Do not use alpha or beta AndroidX artifacts.

- [ ] **Step 2: Write failing native selection, settings, layout, and scheduler tests**

Cover:

- atomic encode/decode of all rotation settings;
- invalid interval/target rejection;
- favorites-only empty-set rejection;
- no immediate quote repeat when alternatives exist;
- preferred versus randomized preset behavior;
- 6/12/24-hour `PeriodicWorkRequest` intervals;
- `ExistingPeriodicWorkPolicy.UPDATE` for unique work;
- cancellation when disabled;
- JSON/font resource parsing;
- 30/80/150/250-character layouts that stay in safe bounds; and
- worker success, retryable I/O failure, and permanent configuration failure.

Use injected clock/random/catalog/renderer/applier interfaces so JVM tests do not require an emulator.

- [ ] **Step 3: Run native tests to verify failures**

Run: `source scripts/android-env.sh && cd android && ./gradlew :motivana-wallpaper:testDebugUnitTest`

Expected: FAIL because automation classes are missing.

- [ ] **Step 4: Implement atomic native automation state**

Persist under `motivana.wallpaper.automation` SharedPreferences. Write configuration as one validated JSON string using a single `edit().putString(...).commit()` operation. Persist status separately with state, timestamp, quote ID, preset ID, and stable error code. Never read MMKV from the worker.

- [ ] **Step 5: Implement shared catalog parsing and deterministic selection**

Load `data/quotes.json`, `data/presets.json`, and fonts from packaged assets. Validate the same category/preset invariants as TypeScript. Filter by supplied favorite IDs when requested and return `NO_ELIGIBLE_QUOTES` for an empty set. Use injected `Random`; avoid the immediately previous quote/preset when alternatives exist.

- [ ] **Step 6: Implement the native bitmap renderer**

Use Android `Bitmap`, `Canvas`, `LinearGradient`, `Paint`, `StaticLayout`, and bundled `Typeface` assets. Apply the same 8% horizontal, 10% vertical, `quotePositionY`, 2.2% author gap, font ratios, one-pixel fitting loop, minimum size, max-lines/ellipsis, alignment, overlay, and 64 MiB rules as Task 4. Produce an ARGB_8888 bitmap at current real display wallpaper dimensions.

Native golden fixture tests assert font size, text bounds, alignment, and author position against shared JSON fixtures. Do not compare antialiased pixel hashes across Skia and Android Canvas.

- [ ] **Step 7: Implement unique scheduling and the worker pipeline**

Use:

```kotlin
workManager.enqueueUniquePeriodicWork(
  "motivana.wallpaper.rotation",
  ExistingPeriodicWorkPolicy.UPDATE,
  request
)
```

The worker reads configuration, selects, renders, applies, recycles the bitmap, and records success. Return `Result.failure` for invalid configuration/unsupported target, `Result.retry` for transient decoding or system I/O errors with backoff, and `Result.success` only after `WallpaperManager` returns successfully. WorkManager timings are inexact; UI copy says “approximately every 6/12/24 hours.”

- [ ] **Step 8: Complete native module automation functions**

`configureRotation` validates and atomically persists before scheduling. Disabling cancels unique periodic work and records disabled status. `getRotationStatus` returns stored status plus current WorkInfo state. `runRotationNow` enqueues unique one-time debug work only when `BuildConfig.DEBUG`; release builds reject it with `DEBUG_ONLY`.

- [ ] **Step 9: Connect Automation UI**

Save valid settings to both the Zustand store and native configuration only after the native call succeeds. Display current approximate interval, target, last applied time, last quote, and last error. If favorites-only is selected with no favorites, show the precise correction before calling native code. Show “Run rotation now” only under `__DEV__`.

- [ ] **Step 10: Test WorkManager on emulator**

Run the debug worker while the app is foregrounded, backgrounded, and force-stopped. Query:

```bash
adb shell dumpsys jobscheduler | rg org.haina2410.motivana
adb shell dumpsys activity service WorkManager
adb logcat -d -s MotivanaRotation:V AndroidRuntime:E
```

Capture launcher screenshots across at least three immediate runs and confirm no consecutive quote ID repeats in status/log output. Disable rotation and confirm unique periodic work is cancelled.

- [ ] **Step 11: Verify and commit automation**

Run: `npm run verify && source scripts/android-env.sh && cd android && ./gradlew testDebugUnitTest assembleDebug lintDebug`

Expected: all checks exit 0.

```bash
git add app src modules package.json package-lock.json
git commit -m "feat: rotate wallpapers with WorkManager"
```

### Task 8: Harden, Document, and Complete Emulator Acceptance

**Files:**
- Create: `scripts/emulator-smoke.sh`
- Create: `README.md`
- Create: `docs/ANDROID_AUTOMATION.md`
- Create: `docs/QA_CHECKLIST.md`
- Modify: focused app/native files found by acceptance testing only.
- Test: existing test suites plus emulator smoke evidence under `artifacts/qa/`.

**Interfaces:**
- Consumes: the complete application and native module.
- Produces: reproducible verification commands, screenshots/log summaries, exact known limitations, and a clean build-ready repository.

- [ ] **Step 1: Write the emulator acceptance script before fixing final failures**

`scripts/emulator-smoke.sh` must use `set -euo pipefail`, verify `adb get-state`, install the debug APK with `adb install -r`, clear app data for the clean-install pass, launch the package, wait for the main activity, collect filtered logcat, capture PNG screenshots, verify no `FATAL EXCEPTION`, and exit nonzero on any failed assertion. It must never delete broad directories or mutate emulator data outside this package.

- [ ] **Step 2: Run the complete automated suite and record failures**

```bash
npm run verify
source scripts/android-env.sh
cd android
./gradlew clean testDebugUnitTest lintDebug assembleDebug
cd ..
scripts/emulator-smoke.sh android/app/build/outputs/apk/debug/app-debug.apk
```

Expected before hardening: any failure is concrete and reproducible. Fix only failures required by the spec; do not add P1 features.

- [ ] **Step 3: Complete the manual emulator matrix**

Record pass/fail evidence for clean install, cold launch, 100+ quotes, previous/next/random, favorites persistence, all eight presets, short/long/stress quotes, exact PNG dimensions, media permission granted/denied, Home application, supported Lock/Both behavior, automation enable/update/cancel, immediate rotation foreground/background/force-stop, error retry, screen reader labels, and font scaling.

Save representative Home, Customize, Favorites, Automation, and launcher-after-wallpaper screenshots under `artifacts/qa/`. Store no user data or credentials.

- [ ] **Step 4: Fix acceptance defects with regression tests first**

For every defect, add the narrowest failing Jest or JVM test, run it to see the failure, implement the correction, run the focused test, then run the full suite. Commit related fixes together; do not refactor unrelated code.

- [ ] **Step 5: Write exact project documentation**

`README.md` includes prerequisites, `.nvmrc`, how to source `scripts/android-env.sh`, dependency installation, emulator boot, prebuild, Gradle/Expo run commands, all test commands, project architecture, offline/privacy statement, and the physical-device release gate.

`docs/ANDROID_AUTOMATION.md` explains approximate WorkManager timing, all settings, worker data flow, supported targets, debug trigger, error codes, and OEM limitations.

`docs/QA_CHECKLIST.md` records emulator model/API/resolution, command outputs summarized with dates, each acceptance item, and unchecked physical-device cases for home/lock/both, 6/12/24-hour real timing, battery optimization, reboot, and app update.

- [ ] **Step 6: Run final verification from a clean state**

```bash
npm ci
npm run verify
source scripts/android-env.sh
npx expo prebuild --clean --platform android
cd android
./gradlew clean testDebugUnitTest lintDebug assembleDebug
cd ..
scripts/emulator-smoke.sh android/app/build/outputs/apk/debug/app-debug.apk
git status --short
```

Expected: all automated commands exit 0; smoke screenshots show correct UI/wallpaper; `git status --short` contains only the intended documentation/evidence changes for this task.

- [ ] **Step 7: Commit the completed emulator MVP**

```bash
git add README.md docs scripts artifacts app src modules package.json package-lock.json
git commit -m "docs: complete Android MVP emulator validation"
```

- [ ] **Step 8: Produce the final handoff summary**

Report implemented features, architecture, exact emulator Android/API/build-tools versions, automated verification outputs, screenshots/evidence paths, known emulator limitations, unchecked physical-device release gates, and recommended post-MVP order: physical QA, store signing/listing, then iOS architecture work. Do not describe physical-device behavior as verified.
