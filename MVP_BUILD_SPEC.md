# Motivational Wallpaper App — MVP Build Specification

## 1. Mission

Build a production-quality MVP mobile app for **iOS and Android** that lets users browse motivational quotes, preview them as attractive wallpapers, customize the look, save/set wallpapers, and configure automatic wallpaper rotation where the operating system allows it.

The app should share as much code as practical between platforms while using native integrations where required.

The MVP must be usable end-to-end on real iOS and Android devices.

---

## 2. Core product idea

Users should be able to:

1. Open the app and immediately see a motivational quote presented as a wallpaper.
2. Swipe/browse through quotes.
3. Change the background, typography, and basic presentation.
4. Save a generated wallpaper image.
5. Set the wallpaper.
6. Configure automatic wallpaper changes.
7. Favorite quotes.
8. Use the app without creating an account.

The MVP should feel visually polished but deliberately keep the feature set small.

---

## 3. Platform behavior

### Android

Android should support true app-controlled wallpaper changes using native Android APIs.

Use:

- `WallpaperManager`
- `WorkManager` for scheduled/background rotation
- Kotlin native module exposed to React Native

Support at minimum:

- Home screen wallpaper
- Lock screen wallpaper where supported
- Both home + lock screen where supported
- Automatic rotation at user-selected intervals

### iOS 26+

Do **not** assume the React Native app can directly change the system wallpaper through a public app API.

The MVP iOS automation approach should use **Shortcuts / Personal Automation**.

Implement an **App Intent / App Shortcut** that can provide or generate the next wallpaper image. This lets the user construct a Shortcut/Automation that combines the app's action with Apple's wallpaper action.

Expected conceptual automation:

```text
Time of Day automation
    ↓
Run Immediately
    ↓
Get Next Motivational Wallpaper (our App Intent)
    ↓
Set Wallpaper Photo (Apple Shortcuts action)
```

The app must contain onboarding instructions for setting this up.

Important implementation requirement:

> Before finalizing the iOS automation flow, verify the exact action names, available wallpaper inputs, background-execution behavior, and confirmation requirements on a physical device running the current iOS 26 release. Apple can change Shortcuts behavior independently of the app APIs.

Use Apple's modern **App Intents** framework rather than legacy SiriKit unless a specific compatibility reason requires otherwise.

Apple documents App Intents as the mechanism for exposing app actions to Shortcuts, Siri, Spotlight, and other system experiences.

---

## 4. Recommended technology stack

### Shared mobile application

- React Native
- TypeScript
- Expo development workflow with **prebuild / custom native modules**, not Expo Go-only architecture
- Expo Router
- Zustand for lightweight application state
- React Native MMKV for local settings/cache
- React Native Skia for rendering wallpapers
- React Native Reanimated for animations where helpful

### Android native

- Kotlin
- `WallpaperManager`
- Android `WorkManager`

### iOS native

- Swift
- App Intents
- App Shortcuts
- App Groups/shared storage if required to share generated wallpaper data between the React Native app and App Intent extension/runtime

### Backend

The first MVP should avoid a backend unless required.

Store bundled seed quotes and wallpaper presets locally. Architect repositories/data services so a backend can be added later.

If a backend becomes necessary during MVP development, use:

- Supabase
- PostgreSQL
- Supabase Storage

Do not add authentication in MVP unless needed for a concrete feature.

### Quality/tooling

- ESLint
- Prettier
- TypeScript strict mode
- Jest or Vitest-compatible React Native test setup
- React Native Testing Library
- GitHub Actions
- Sentry can be added near release if trivial, but is not a blocker for the first functioning MVP

---

## 5. MVP scope

### P0 — required

The MVP is incomplete until every P0 requirement is implemented.

#### Quote browsing

- Show one quote prominently on screen.
- Swipe or tap to move to another quote.
- At least 100 bundled English motivational quotes.
- Quote fields:
  - `id`
  - `text`
  - `author`
  - `category`

Suggested initial categories:

- Motivation
- Discipline
- Focus
- Confidence
- Growth
- Success

#### Wallpaper presets

Include at least 8 visually distinct presets.

Each preset should define:

- background configuration
- text color
- font family
- font size rules
- text alignment
- quote vertical position
- optional overlay
- optional author styling

Do not use copyrighted stock images without a suitable license. For the first MVP prefer gradients, simple generated textures, or explicitly licensed bundled assets.

#### Wallpaper renderer

Generate a static image that matches the target device's screen aspect ratio/resolution closely enough for wallpaper use.

Renderer must handle:

- multiline wrapping
- long quotes
- dynamic font scaling
- quote + author
- safe margins
- high-resolution export

Use React Native Skia unless there is a concrete blocker.

#### Wallpaper preview

Preview the exact composition before export.

User can:

- select another preset
- select another quote
- randomize combination

#### Favorites

Users can favorite/unfavorite quotes.

Persist locally with MMKV.

#### Save/export

Allow user to save the rendered wallpaper image to the device's photo library with proper permission handling.

#### Android wallpaper application

Provide actions:

- Set Home Screen
- Set Lock Screen
- Set Both, when supported

Implement native Kotlin bridge/module.

#### Android automatic wallpaper rotation

Allow user to enable automatic wallpaper changes.

MVP frequencies:

- Every 6 hours
- Every 12 hours
- Daily

Use WorkManager.

Worker behavior:

1. Read user settings.
2. Pick a quote.
3. Pick/use configured preset.
4. Render/generate wallpaper.
5. Apply wallpaper using `WallpaperManager`.
6. Store last applied quote ID/time.
7. Avoid repeating the immediately previous quote where possible.

If rendering a Skia canvas directly from a headless Android worker is impractical, implement a small native/headless-compatible renderer for the worker or persist pre-rendered/generated images. Prefer the simplest reliable solution over architectural purity.

#### iOS Shortcut action

Implement an App Intent tentatively named:

`Get Next Motivational Wallpaper`

It should return a wallpaper image/file usable as input to subsequent Shortcuts actions.

The action should work without opening the main app if iOS permits the required data/rendering path.

If direct background rendering from the App Intent proves unreliable, use this fallback strategy:

1. Main app pre-generates a queue of wallpaper images.
2. Images and metadata are stored in an App Group container.
3. App Intent selects/returns the next pre-generated image.
4. Main app replenishes the queue when launched.

Prefer the more reliable approach on physical devices.

#### iOS automation onboarding

Create a dedicated screen explaining how to configure automatic wallpaper rotation.

It should walk the user through roughly:

1. Open Shortcuts.
2. Create Personal Automation.
3. Choose Time of Day.
4. Configure desired recurrence.
5. Select Run Immediately if available.
6. Add our `Get Next Motivational Wallpaper` action.
7. Add Apple's wallpaper-setting action.
8. Select the desired wallpaper target/options.
9. Save automation.

Do not hardcode wording that has not been verified on the shipping iOS 26 version. Keep instructions easy to update.

#### Settings

At minimum:

- preferred preset
- random preset on/off
- favorite-only rotation on/off
- Android rotation frequency
- wallpaper target where supported
- iOS automation setup entry point

---

## 6. P1 — optional after P0 works

Only start these once all P0 features work on real devices.

- Quote categories/filtering
- Custom user-entered quotes
- Additional fonts
- More wallpaper presets
- Share wallpaper
- Dark/light application theme
- Basic onboarding carousel
- Local notification reminding iOS users if auto-wallpaper setup is incomplete

---

## 7. Explicitly out of scope for MVP

Do not build these before MVP completion:

- User accounts
- Social feed
- AI-generated quotes
- AI-generated images
- Subscription/paywall
- Cloud sync
- Admin dashboard
- Push notification infrastructure
- Remote CMS
- Complex text editor
- Community uploads
- Quote comments/likes
- Android live wallpapers
- iOS widgets unless needed as a fallback
- Localization beyond keeping code localization-ready

---

## 8. Suggested repository structure

```text
motivational-wallpaper/
├── app/
│   ├── _layout.tsx
│   ├── index.tsx
│   ├── favorites.tsx
│   ├── customize.tsx
│   ├── automation.tsx
│   └── settings.tsx
│
├── src/
│   ├── components/
│   │   ├── QuoteCard.tsx
│   │   ├── WallpaperPreview.tsx
│   │   ├── PresetPicker.tsx
│   │   └── PermissionPrompt.tsx
│   │
│   ├── features/
│   │   ├── quotes/
│   │   ├── wallpaper/
│   │   ├── favorites/
│   │   ├── automation/
│   │   └── settings/
│   │
│   ├── data/
│   │   ├── quotes.json
│   │   └── presets.ts
│   │
│   ├── services/
│   │   ├── quoteRepository.ts
│   │   ├── wallpaperRenderer.ts
│   │   ├── mediaLibrary.ts
│   │   └── wallpaperNative.ts
│   │
│   ├── store/
│   │   └── useAppStore.ts
│   │
│   ├── types/
│   └── utils/
│
├── modules/
│   └── wallpaper-manager/
│       ├── android/
│       ├── ios/
│       └── src/
│
├── ios/
│   └── App Intent / App Shortcut implementation
│
├── android/
│   └── WorkManager/native wallpaper implementation
│
├── assets/
│   ├── fonts/
│   └── backgrounds/
│
├── tests/
├── docs/
│   ├── IOS_SHORTCUT_SETUP.md
│   ├── ANDROID_AUTOMATION.md
│   └── QA_CHECKLIST.md
│
└── README.md
```

Exact directories may differ after Expo prebuild. Keep feature boundaries conceptually similar.

---

## 9. Core data models

```ts
export type QuoteCategory =
  | 'motivation'
  | 'discipline'
  | 'focus'
  | 'confidence'
  | 'growth'
  | 'success';

export interface Quote {
  id: string;
  text: string;
  author?: string;
  category: QuoteCategory;
}

export interface WallpaperPreset {
  id: string;
  name: string;
  fontFamily: string;
  textAlign: 'left' | 'center' | 'right';
  quotePositionY: number;
  textColor: string;
  authorColor?: string;
  background: WallpaperBackground;
  overlayOpacity?: number;
}

export type WallpaperBackground =
  | {
      type: 'gradient';
      colors: string[];
    }
  | {
      type: 'image';
      asset: string;
    }
  | {
      type: 'solid';
      color: string;
    };

export interface UserSettings {
  selectedPresetId: string;
  randomizePreset: boolean;
  favoriteQuotesOnly: boolean;
  androidAutomationEnabled: boolean;
  androidRotationIntervalHours: 6 | 12 | 24;
  androidWallpaperTarget: 'home' | 'lock' | 'both';
}
```

---

## 10. Rendering requirements

The wallpaper renderer is one of the most important parts of the app.

Create a deterministic function/service conceptually similar to:

```ts
renderWallpaper({
  quote,
  preset,
  width,
  height,
}): Promise<RenderedWallpaper>
```

Expected output should include:

```ts
interface RenderedWallpaper {
  uri: string;
  width: number;
  height: number;
}
```

### Typography rules

Implement automatic text fitting.

Suggested algorithm:

1. Determine usable text bounding box.
2. Start with preset's preferred font size.
3. Layout/wrap quote.
4. If it exceeds maximum height, reduce font size.
5. Continue until it fits or minimum font size reached.
6. If minimum size still doesn't fit, use a controlled truncation/fallback rather than drawing outside the safe region.

Test quotes around:

- 30 characters
- 80 characters
- 150 characters
- 250+ characters

Wallpaper output must not contain clipping.

---

## 11. State/storage

Use Zustand + MMKV.

Persist:

- favorites
- last shown quote ID
- last applied quote ID
- selected preset
- automation settings
- onboarding completion
- generated wallpaper queue metadata if needed for iOS

Do not persist unnecessary transient UI state.

---

## 12. Permissions

Handle permissions gracefully.

### iOS

Potential permissions depend on final export approach:

- Photo Library Add permission for saving generated images

Do not request permissions until needed.

### Android

Handle any OS/version-specific media permission needed for saving images.

WallpaperManager itself should be implemented according to current Android SDK behavior.

Always test current target SDK requirements rather than relying on outdated permission examples.

---

## 13. Android native module API

Expose a narrow TypeScript interface.

Example:

```ts
export interface NativeWallpaperManager {
  setWallpaper(
    imageUri: string,
    target: 'home' | 'lock' | 'both'
  ): Promise<void>;

  configureRotation(options: {
    enabled: boolean;
    intervalHours: 6 | 12 | 24;
    target: 'home' | 'lock' | 'both';
  }): Promise<void>;
}
```

Keep OS-specific implementation details out of UI components.

---

## 14. iOS App Intent design

Start with something conceptually similar to:

```swift
struct GetNextMotivationalWallpaperIntent: AppIntent {
    static var title: LocalizedStringResource = "Get Next Motivational Wallpaper"

    func perform() async throws -> some IntentResult {
        // Select next wallpaper
        // Return image/file usable by Shortcuts
    }
}
```

The exact result type must be selected based on what integrates most reliably with the current Shortcuts wallpaper action.

Also create an `AppShortcutsProvider` so the action is easily discoverable in Shortcuts.

Verify on a physical iPhone:

- action appears in Shortcuts
- action returns expected image/file
- output connects to Apple's wallpaper-setting action
- shortcut can execute while main app is closed
- personal automation can execute without interaction where configured
- repeated runs continue selecting new content

Do not consider iOS automation complete based only on Simulator behavior.

---

## 15. iOS image queue fallback

If App Intents cannot reliably run the full React Native/Skia rendering pipeline while the app is closed, implement an App Group queue.

Suggested structure:

```text
App Group container
├── wallpapers/
│   ├── wallpaper-001.jpg
│   ├── wallpaper-002.jpg
│   └── ...
└── queue.json
```

Example queue metadata:

```json
{
  "nextIndex": 2,
  "items": [
    {
      "id": "wallpaper-001",
      "quoteId": "q-018",
      "file": "wallpapers/wallpaper-001.jpg"
    }
  ]
}
```

Generate at least 10 upcoming wallpapers whenever the app launches if the queue is low.

The App Intent should safely rotate through the queue.

This fallback is preferred over depending on unsupported background execution tricks.

---

## 16. UX/screens

### Home

Primary wallpaper preview.

Actions:

- next quote
- favorite
- customize
- set wallpaper

### Customize

- preset selection
- random preset
- live preview
- save
- set wallpaper

### Favorites

Simple grid/list of saved quotes.

Selecting one opens it in the wallpaper preview.

### Automation

Platform-specific UI.

Android:

- enable automatic wallpaper
- frequency
- target
- current status

Apple:

- explain Shortcut requirement
- setup guide
- show whether the App Shortcut is available if this can be detected reliably
- test/generate next wallpaper button

### Settings

Keep minimal.

---

## 17. Design direction

Aim for a clean premium feel similar to modern motivation/wellness apps without directly copying any existing product.

Guidelines:

- wallpaper preview dominates the UI
- minimal chrome
- large typography
- generous spacing
- subtle transitions
- avoid cluttered settings
- backgrounds should look good behind lock-screen UI

The MVP needs visual polish because the generated image is the product.

---

## 18. Development milestones

Complete milestones in order. Do not jump ahead to backend or monetization.

### Milestone 0 — project bootstrap

- Initialize React Native/Expo TypeScript project.
- Configure Expo Router.
- Configure linting/formatting.
- Enable strict TypeScript.
- Add basic tests.
- Confirm Android and iOS native builds work after prebuild.

**Exit criteria:** blank/basic application launches on one real Android device/emulator and iOS Simulator; native projects build successfully.

### Milestone 1 — quote experience

- Add bundled quote dataset.
- Implement quote repository.
- Build home screen.
- Implement next/previous/random quote.
- Add favorites with persistence.

**Exit criteria:** quote browsing and favorites survive app restart.

### Milestone 2 — wallpaper renderer

- Add fonts.
- Create 8 presets.
- Implement Skia wallpaper renderer.
- Implement text fitting.
- Implement high-resolution image export.
- Build customization UI.

**Exit criteria:** exported wallpaper image is visually correct for short and long quotes on multiple device sizes.

### Milestone 3 — saving/shareable image

- Add media/photo-library permission handling.
- Save generated image to device.
- Handle denial/errors cleanly.

**Exit criteria:** user can save a generated wallpaper on real Android and iPhone hardware.

### Milestone 4 — Android direct wallpaper

- Build Kotlin WallpaperManager integration.
- Expose bridge/module.
- Implement home/lock/both actions.
- Test OS/version behavior.

**Exit criteria:** user can set a generated wallpaper directly from the Android app.

### Milestone 5 — Android automation

- Implement WorkManager scheduling.
- Persist schedule settings.
- Implement reliable headless wallpaper selection/render/application path.
- Handle device restart/update behavior if required by chosen WorkManager setup.

**Exit criteria:** Android wallpaper changes automatically according to configured interval without requiring the app to be open.

### Milestone 6 — iOS App Intent

- Add App Intent.
- Add App Shortcut provider.
- Make next wallpaper available as Shortcut output.
- Implement App Group queue if necessary.

**Exit criteria:** on a physical iPhone running iOS 26, Shortcuts can run the app action while the main app is closed and receive an image usable by the next Shortcut action.

### Milestone 7 — iOS automatic wallpaper onboarding

- Verify Apple's current wallpaper action on physical iOS 26 hardware.
- Build and test complete Personal Automation flow.
- Add accurate in-app setup instructions.
- Test unattended repeated execution.

**Exit criteria:** a tester can follow the app's instructions and configure an iOS automation that changes to newly generated motivational wallpapers at the selected system schedule.

### Milestone 8 — MVP hardening

- Error states.
- Empty states.
- Permission denial flows.
- Long quote rendering tests.
- Crash testing.
- Cold start.
- Background automation validation.
- Basic accessibility labels.
- README/setup docs.
- QA checklist.

**Exit criteria:** all acceptance criteria below pass.

---

## 19. MVP acceptance criteria

### Shared

- [ ] App installs and launches on current supported Android and iOS versions.
- [ ] User can browse at least 100 quotes.
- [ ] User can favorite quotes.
- [ ] Favorites persist after restart.
- [ ] At least 8 wallpaper presets exist.
- [ ] User can preview a quote/preset combination.
- [ ] Long quotes render without clipping.
- [ ] User can export/save the wallpaper.
- [ ] App works without an account or backend.

### Android

- [ ] User can set home wallpaper directly.
- [ ] User can set lock wallpaper on supported versions/devices.
- [ ] Automatic rotation can be enabled.
- [ ] 6-hour, 12-hour, and 24-hour schedules are supported.
- [ ] Automation works with app backgrounded/closed according to Android scheduling guarantees.
- [ ] Last wallpaper is not immediately repeated when alternatives exist.

### iOS

- [ ] App Intent appears in Shortcuts.
- [ ] App Intent produces/returns a wallpaper image.
- [ ] Output can feed into Apple's current wallpaper-setting Shortcut action.
- [ ] Main app does not need to be foregrounded for normal scheduled runs, using pre-generated queue if necessary.
- [ ] In-app guide correctly reflects the shipping iOS 26 Shortcuts UI.
- [ ] Personal Automation has been validated on a physical iPhone.

---

## 20. Testing requirements

### Unit tests

At minimum test:

- quote selection
- no immediate-repeat selection
- favorites storage logic
- preset serialization
- settings defaults/migrations
- text-fit calculation where separated from rendering
- queue rotation logic

### Device matrix

Minimum manual test matrix:

- one modern iPhone on current iOS 26
- iOS Simulator for general UI
- one modern Android phone
- one Android emulator

If possible also test one older/smaller Android device size.

### Important automation tests

Android:

- app open
- app backgrounded
- app killed/swiped away
- screen locked
- after several hours

Apple:

- Shortcut invoked manually
- Personal Automation invoked at scheduled time
- main app closed
- screen locked if permitted by the system automation
- several sequential rotations

Record actual OS limitations in `docs/QA_CHECKLIST.md` rather than hiding them.

---

## 21. Error handling

Never silently fail.

Show actionable messages for:

- image generation failure
- photo-library permission denied
- save failure
- Android wallpaper API failure
- unsupported lock wallpaper behavior
- Android automation scheduling failure
- iOS Shortcut setup incomplete
- iOS queue empty

For an empty iOS pre-generated queue, return the last valid wallpaper if possible rather than crashing.

---

## 22. Performance constraints

Targets, not hard guarantees:

- Home screen usable within ~2 seconds on a normal modern device.
- Quote switching feels immediate.
- Preview changes should generally render in under 200 ms after cached resources load.
- Full-resolution export should usually finish within ~2 seconds.
- Keep bundled application size reasonable; prefer generated gradients over large image packs.

Do not prematurely optimize before functionality works.

---

## 23. Security/privacy

MVP should collect no sensitive user information.

- No account required.
- No analytics required for first development build.
- No quote/background generation sent to a server.
- Store preferences locally.
- Request minimum OS permissions.

If Sentry/analytics is added, document exactly what is collected.

---

## 24. Agent implementation rules

The implementation agent should operate autonomously until the MVP is complete.

### Do

- Make reasonable engineering decisions without repeatedly asking for approval.
- Keep commits/milestones small and testable.
- Prefer boring/reliable solutions over clever abstractions.
- Run lint/typecheck/tests frequently.
- Run native builds after native-module changes.
- Verify OS-specific assumptions using official current documentation when possible.
- Test iOS wallpaper automation on physical iOS 26 hardware before declaring it complete.
- Document limitations discovered during implementation.
- Keep the app buildable after each milestone.

### Do not

- Add a backend just because it may be useful later.
- Add authentication.
- Add payments.
- Add AI features.
- Build an elaborate design system.
- Over-generalize the renderer.
- Assume Expo Go is sufficient for native wallpaper/App Intent functionality.
- Claim iOS automation works solely because code compiles.
- Use private iOS APIs to directly set wallpapers.

### When blocked

If a feature is blocked by OS restrictions:

1. Confirm the restriction using current official documentation and device testing.
2. Implement the safest supported fallback.
3. Document the limitation.
4. Continue building the rest of the MVP.

Do not stop the entire build for a noncritical feature.

---

## 25. Definition of done

The MVP is done only when:

1. Shared quote browsing/customization works.
2. Wallpaper image generation/export works on both platforms.
3. Android direct wallpaper setting works.
4. Android scheduled rotation works.
5. iOS App Intent is visible and usable in Shortcuts.
6. iOS Shortcuts wallpaper automation has been validated on physical iOS 26 hardware.
7. User-facing iOS setup instructions match the tested flow.
8. Core persistence works after restart.
9. Lint/typecheck/tests pass.
10. README contains exact development/build/run instructions.
11. Known limitations are documented.

---

## 26. Final deliverables

At MVP completion, repository should contain:

- working React Native source
- Android native wallpaper module
- Android WorkManager rotation implementation
- iOS App Intent/App Shortcut implementation
- bundled quote dataset
- at least 8 wallpaper presets
- tests
- `README.md`
- `docs/IOS_SHORTCUT_SETUP.md`
- `docs/ANDROID_AUTOMATION.md`
- `docs/QA_CHECKLIST.md`

Also provide a final implementation summary containing:

- features completed
- architecture choices
- exact iOS automation flow that was verified
- Android versions tested
- iOS version/build tested
- unresolved limitations
- recommended post-MVP work

---

## 27. Initial assumptions

Proceed using these assumptions unless implementation evidence requires changing them:

- App name can temporarily be `Motivate Wallpaper`.
- English only for MVP.
- No login.
- No backend.
- No monetization.
- User can choose from curated bundled quotes/presets.
- React Native + TypeScript is the primary application layer.
- Expo prebuild/native projects are acceptable.
- Minimum iOS target can be chosen based on App Intents/React Native requirements, but iOS 26 is the primary automation test target.
- Android min SDK should be selected based on current React Native/Expo support rather than artificially supporting very old Android releases.

---

## 28. First actions for the build agent

Start immediately with the following:

1. Create the React Native + Expo TypeScript project.
2. Set up Expo Router, linting, formatting, strict TypeScript, and tests.
3. Add 100+ seed quotes and typed data models.
4. Implement the Home quote browser and favorites.
5. Add React Native Skia and build one high-quality wallpaper preset end-to-end.
6. Export that wallpaper successfully on both platforms.
7. Expand to 8 presets.
8. Then continue through Milestones 3–8 in order.

Do not begin Supabase, accounts, RevenueCat, AI generation, or other post-MVP work until all MVP acceptance criteria are met.
