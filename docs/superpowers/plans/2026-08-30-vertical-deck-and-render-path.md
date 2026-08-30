# Vertical Deck and Picture Render Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Home becomes a full-bleed vertical deck the reader swipes through like Shorts or Reels, each swipe giving a new quote and a new template, drawn through a Skia picture instead of an encoded PNG.

**Architecture:** `WallpaperCanvas` records the scene into an `SkPicture` and replays it on the live canvas, which deletes the 47-235 ms PNG encode and makes rendering three wallpapers at once affordable. Home stacks three compositions in a vertical pager driven by `react-native-gesture-handler`, backed by a session history of `(quoteId, presetId)` pairs so a swipe down restores exactly what the reader saw. One store action commits both ids together, through `commitAutomation`, because the preset id is part of the payload the Kotlin rotation worker reads.

**Tech Stack:** TypeScript, React Native 0.86 with Expo 57, expo-router, Zustand, react-native-mmkv, `@shopify/react-native-skia` 2.6.2, `react-native-gesture-handler` 2.32, `react-native-reanimated` 4.5, Jest with jest-expo.

**Spec:** `docs/superpowers/specs/2026-08-30-home-1a-and-render-path-design.md`

## Global Constraints

- Every task ends with `pnpm verify` green (`format:check`, `lint`, `typecheck`, `verify:data`, `verify:android-permissions`, `test`, `test:worker`, `verify:native`).
- `ota/worker` has its own `node_modules`, not covered by the root install. Run `pnpm --dir ota/worker install` once per worktree before the first `pnpm verify`, or `test:worker` fails with `vitest: command not found`.
- Tests carry a `// Mutation caught: ...` comment above them, matching `src/features/wallpaper/__tests__/composition.test.ts`.
- Commit messages are one line, imperative, lowercase after the type prefix.
- No new dependencies. `react-native-gesture-handler`, `react-native-reanimated` and `@shopify/react-native-skia` are already in `package.json`.
- Strings live in both `src/features/i18n/strings/en.ts` and `vi.ts`. `src/features/i18n/__tests__/catalogParity.test.ts` fails if a key exists in one and not the other.
- Icon names must be added to `iconNames` in `src/components/Icon.tsx` before use; the array is `as const` and typed, so an unlisted name is a type error.
- The deck history is session state. Do not add it to `src/store/schema.ts` or to the persisted payload.
- Only the preview stops encoding. `src/features/wallpaper/exportWallpaper.ts` keeps its own surface, draw and encode untouched.

## Already Done

Landed on this branch as `b5e6c20`. Do not redo.

- `app/(tabs)/` is a real `Tabs` group; `DeckTabBar` takes `BottomTabBarProps`.
- `ScreenHeader` draws its back chevron only when passed `back`.
- The style screen, `src/components/Meter.tsx` and the `style.*` strings are deleted.

Note that `AppButton` already supports `shape="pill"` backed by `spacing.pill = 9999`. The spec's "pills rounded to half height" needs the prop passed, not a new token.

---

### Task 1: Record the scene as a picture

Replaces the PNG-encode path with an `SkPicture`. This lands first because Tasks 5 and 6 render three wallpapers at once, which is only affordable once the encode is gone.

**Files:**
- Modify: `src/features/wallpaper/WallpaperCanvas.tsx`
- Test: `src/features/wallpaper/__tests__/WallpaperCanvas.test.tsx` (rewrite)

**Interfaces:**
- Consumes: `drawWallpaperScene`, `measureSkiaComposition` from `./scene`; `WallpaperComposition` from `./composition`.
- Produces: `WallpaperCanvas` unchanged in props. `createPreviewImage` and `createPreviewDataUri` are **removed** — their only consumer is the test being rewritten. `exportWallpaper.ts` does not use them.

- [ ] **Step 1: Rewrite the test to cover the picture path**

Replace the whole of `src/features/wallpaper/__tests__/WallpaperCanvas.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native';

import { createComposition } from '../composition';
import { WallpaperCanvas } from '../WallpaperCanvas';
import { getPresetById } from '../presetRepository';
import type { Quote } from '../../quotes/types';

const recorded: { width: number; height: number }[] = [];

jest.mock('@shopify/react-native-skia', () => ({
  Canvas: ({ children }: { children?: unknown }) => children ?? null,
  Group: ({ children }: { children?: unknown }) => children ?? null,
  Picture: () => null,
  Skia: {
    XYWHRect: (x: number, y: number, width: number, height: number) => ({
      x,
      y,
      width,
      height,
    }),
    PictureRecorder: () => ({
      beginRecording: (rect: { width: number; height: number }) => {
        recorded.push({ width: rect.width, height: rect.height });
        return {};
      },
      finishRecordingAsPicture: () => ({ picture: true }),
    }),
  },
  useFonts: () => null,
}));
jest.mock('../scene', () => ({
  drawWallpaperScene: () => undefined,
  measureSkiaComposition: (composition: unknown) => composition,
}));
jest.mock('../useWallpaperFonts', () => ({
  useWallpaperFonts: () => ({}),
}));
jest.mock('../useBackgroundImage', () => ({
  useBackgroundImage: () => null,
  getBackgroundImage: () => Promise.resolve(undefined),
}));
jest.mock('../exportCache', () => ({ exportedWallpaperUri: () => undefined }));

const quote: Quote = {
  id: 'preview-quote',
  category: 'growth',
  sourceLocale: 'en',
  text: { en: 'Progress is built by making one clear decision at a time.' },
  author: 'Motivana',
};

const composition = () =>
  createComposition({
    quote,
    preset: getPresetById('midnight-focus')!,
    width: 270,
    height: 600,
    locale: 'en',
  });

beforeEach(() => {
  recorded.length = 0;
});

// Mutation caught: rasterising to an offscreen surface renders blank on Android, because a snapshot cannot cross the GPU context boundary.
test('records the scene at composition size rather than encoding a bitmap', () => {
  render(<WallpaperCanvas composition={composition()} />);

  expect(recorded).toEqual([{ width: 270, height: 600 }]);
});

// Mutation caught: dropping the accessibility label leaves the deck unreachable by name for a screen reader.
test('labels the preview for assistive technology', () => {
  render(<WallpaperCanvas composition={composition()} />);

  expect(screen.getByLabelText('Wallpaper preview')).toBeOnTheScreen();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test src/features/wallpaper/__tests__/WallpaperCanvas.test.tsx`
Expected: FAIL — the mock has no `Surface`, and `WallpaperCanvas` still calls `Skia.Surface.MakeOffscreen`.

- [ ] **Step 3: Replace the render path**

In `src/features/wallpaper/WallpaperCanvas.tsx`, change the Skia import to:

```tsx
import { Canvas, Group, Picture, Skia } from '@shopify/react-native-skia';
```

Delete the `Image as NativeImage` and `type ImageStyle` imports from `react-native` and add `StyleSheet`. Delete the `exported`/`fallbackUri`/`preview` memos, the `useEffect` that disposes the surface, the whole `if (Platform.OS === 'android')` branch, and both `createPreviewImage` and `createPreviewDataUri`. Replace the body's memos and return with:

```tsx
  const measuredComposition = useMemo(
    () => (fonts ? measureSkiaComposition(composition, fonts) : composition),
    [composition, fonts],
  );
  // A recorded picture carries draw commands, not pixels, so it replays on the
  // display's own GPU context. An offscreen snapshot cannot cross that
  // boundary on Android and renders blank.
  const picture = useMemo(() => {
    if (!fonts) return null;
    const recorder = Skia.PictureRecorder();
    const recording = recorder.beginRecording(
      Skia.XYWHRect(0, 0, measuredComposition.width, measuredComposition.height),
    );
    drawWallpaperScene(
      recording,
      measuredComposition,
      fonts,
      backgroundImage ?? undefined,
    );
    return recorder.finishRecordingAsPicture();
  }, [backgroundImage, fonts, measuredComposition]);

  // Skia's <Canvas> rejects onLayout on Android, so a plain view measures.
  return (
    <View
      accessible
      accessibilityLabel="Wallpaper preview"
      onLayout={onCanvasLayout}
      style={style}
    >
      <Canvas style={StyleSheet.absoluteFill}>
        {picture && canvasSize ? (
          <Group
            transform={[
              { scale: canvasSize.width / measuredComposition.width },
            ]}
          >
            <Picture picture={picture} />
          </Group>
        ) : null}
      </Canvas>
    </View>
  );
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test src/features/wallpaper/__tests__/WallpaperCanvas.test.tsx`
Expected: PASS, 2 tests.

- [ ] **Step 5: Verify on the emulator**

The unit test mocks Skia, so it cannot catch a blank canvas. This step is not optional.

```bash
pnpm exec expo prebuild --platform android --no-install
pnpm exec expo run:android
adb exec-out screencap -p > /tmp/task1.png
```

Open `/tmp/task1.png`. Expected: the quote is visible on the deck card. A blank card means the picture is not replaying — check that `canvasSize` resolves and that `onLayout` sits on the `View`, not the `Canvas`.

- [ ] **Step 6: Run the full suite and commit**

```bash
pnpm verify
git add src/features/wallpaper/WallpaperCanvas.tsx src/features/wallpaper/__tests__/WallpaperCanvas.test.tsx
git commit -m "perf: draw the wallpaper preview from a recorded picture"
```

---

### Task 2: Deck history in the store

A random pick is not reconstructible, so backward movement needs a recorded trail of pairs. Session state only.

**Files:**
- Modify: `src/store/useAppStore.ts`
- Test: `src/store/__tests__/deckHistory.test.ts` (create)

**Interfaces:**
- Consumes: `commitAutomation`, `toPersistedState`, `selectRandomQuote`, `getAllTemplates` from `../features/wallpaper/presetRepository`.
- Produces: on `AppState` —
  - `deckHistory: readonly { quoteId: string; presetId: string }[]`
  - `deckCursor: number` — index into `deckHistory` of the pair on screen
  - `advanceDeck(): Promise<boolean>` — forward; replays history when the cursor is not at the end, otherwise appends a new random pair
  - `rewindDeck(): Promise<boolean>` — backward; resolves `false` at the start of history

- [ ] **Step 1: Write the failing test**

Create `src/store/__tests__/deckHistory.test.ts`:

```ts
import { createDefaultPersistedAppState } from '../schema';
import { useAppStore } from '../useAppStore';
import { setRotationSynchronizer } from '../automationSynchronization';

beforeEach(() => {
  useAppStore.setState(createDefaultPersistedAppState());
  setRotationSynchronizer(async () => undefined);
});

// Mutation caught: appending on every forward move would make a rewind then a swipe up generate a new pair instead of replaying the one the reader just left.
test('replays the trail forward before generating a new pair', async () => {
  const store = useAppStore.getState();
  await store.advanceDeck();
  await store.advanceDeck();
  const trail = useAppStore.getState().deckHistory;

  await useAppStore.getState().rewindDeck();
  await useAppStore.getState().advanceDeck();

  expect(useAppStore.getState().deckHistory).toEqual(trail);
  expect(useAppStore.getState().deckCursor).toBe(trail.length - 1);
});

// Mutation caught: restoring only the quote leaves the reader on a wallpaper they never saw, because the template moved on without it.
test('a rewind restores both ids of the pair the reader saw', async () => {
  const store = useAppStore.getState();
  await store.advanceDeck();
  const seen = {
    quoteId: useAppStore.getState().currentQuoteId,
    presetId: useAppStore.getState().selectedPresetId,
  };
  await useAppStore.getState().advanceDeck();

  await useAppStore.getState().rewindDeck();

  expect(useAppStore.getState().currentQuoteId).toBe(seen.quoteId);
  expect(useAppStore.getState().selectedPresetId).toBe(seen.presetId);
});

// Mutation caught: rewinding past the first pair would strand the deck on an undefined entry.
test('refuses to rewind past the start of the trail', async () => {
  expect(await useAppStore.getState().rewindDeck()).toBe(false);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test src/store/__tests__/deckHistory.test.ts`
Expected: FAIL with `store.advanceDeck is not a function`.

- [ ] **Step 3: Implement the actions**

In `src/store/useAppStore.ts`, add to the `AppState` interface:

```ts
  deckHistory: readonly { quoteId: string; presetId: string }[];
  deckCursor: number;
  advanceDeck(): Promise<boolean>;
  rewindDeck(): Promise<boolean>;
```

Import `getAllTemplates` from `../features/wallpaper/presetRepository`, and add to the returned object:

```ts
      // Session state on purpose. The trail exists so a swipe down restores the
      // exact pair the reader saw, which a random pick cannot reconstruct. It
      // has no meaning across launches, so it stays out of the persisted schema.
      deckHistory: [],
      deckCursor: -1,
      advanceDeck: async () => {
        const state = get();
        const replay = state.deckHistory[state.deckCursor + 1];
        if (replay) {
          const applied = await applyDeckPair(replay);
          if (applied) set({ deckCursor: state.deckCursor + 1 });
          return applied;
        }
        const pair = {
          quoteId: selectRandomQuote({
            locale: state.contentLocale,
            previousId: state.currentQuoteId,
            random,
          }).id,
          presetId: randomTemplateId(state.selectedPresetId),
        };
        const applied = await applyDeckPair(pair);
        if (!applied) return false;
        const trail =
          state.deckCursor === -1
            ? [
                {
                  quoteId: state.currentQuoteId,
                  presetId: state.selectedPresetId,
                },
                pair,
              ]
            : [...state.deckHistory.slice(0, state.deckCursor + 1), pair];
        set({ deckHistory: trail, deckCursor: trail.length - 1 });
        return true;
      },
      rewindDeck: async () => {
        const state = get();
        const previous = state.deckHistory[state.deckCursor - 1];
        if (!previous) return false;
        const applied = await applyDeckPair(previous);
        if (applied) set({ deckCursor: state.deckCursor - 1 });
        return applied;
      },
```

Above the returned object, next to `commit`, add the shared helpers. Both ids move in one commit so the wallpaper never renders a half-changed pair, and it goes through `commitAutomation` because `selectedPresetId` is part of the payload the Kotlin worker reads:

```ts
    const randomTemplateId = (currentId: string): string => {
      const pool = getAllTemplates().filter(
        (template) => template.id !== currentId,
      );
      if (pool.length === 0) return currentId;
      return pool[Math.floor(random() * pool.length)]!.id;
    };
    const applyDeckPair = (pair: {
      quoteId: string;
      presetId: string;
    }): Promise<boolean> =>
      commitAutomation((state) => ({
        ...state,
        currentQuoteId: pair.quoteId,
        selectedPresetId: pair.presetId,
      }));
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test src/store/__tests__/deckHistory.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
pnpm verify
git add src/store/useAppStore.ts src/store/__tests__/deckHistory.test.ts
git commit -m "feat: keep a session trail of quote and template pairs"
```

---

### Task 3: Retire the ordered-walk API

`nextQuote`, `previousQuote` and `getAdjacentQuote` have no caller in `app/` or `src/` and never had one. The deck's own trail now supplies backward movement.

**Files:**
- Modify: `src/store/useAppStore.ts`
- Modify: `src/features/quotes/quoteRepository.ts`
- Modify: `src/features/quotes/__tests__/quoteRepository.test.ts`
- Modify: `src/store/__tests__/useAppStore.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `AppState` loses `nextQuote` and `previousQuote`; `quoteRepository` loses `getAdjacentQuote`.

- [ ] **Step 1: Confirm nothing calls them**

Run:
```bash
grep -rn "nextQuote\|previousQuote\|getAdjacentQuote" app src --include='*.ts' --include='*.tsx' | grep -v __tests__
```
Expected: only the definitions in `src/store/useAppStore.ts` and `src/features/quotes/quoteRepository.ts`. If any screen calls them, stop and report — the spec assumed they were dead.

- [ ] **Step 2: Delete them**

Remove `nextQuote` and `previousQuote` from the `AppState` interface and from the returned object in `src/store/useAppStore.ts`. Remove `getAdjacentQuote` from the import list at the top of that file, and remove the function from `src/features/quotes/quoteRepository.ts`. Delete every test naming them in the two test files.

- [ ] **Step 3: Run the suite**

Run: `pnpm verify`
Expected: PASS. A `typecheck` error naming `getAdjacentQuote` means a caller was missed — go back to Step 1.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: drop the unused ordered quote walk"
```

---

### Task 4: Chrome pieces for the deck

The three floating controls, before the pager that positions them.

**Files:**
- Modify: `src/components/Icon.tsx`
- Modify: `src/components/AppIconButton.tsx`
- Test: `src/components/__tests__/AppIconButton.test.tsx` (create)
- Modify: `src/features/i18n/strings/en.ts`
- Modify: `src/features/i18n/strings/vi.ts`

**Interfaces:**
- Consumes: `colors`, `spacing` from `../theme`.
- Produces: `AppIconButton` accepts `variant="glass"` — a 46pt translucent circle. `iconNames` gains `sliders`, `palette`, `mobile-screen`, `chevron-up`, `download`.

- [ ] **Step 1: Write the failing test**

Create `src/components/__tests__/AppIconButton.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { AppIconButton } from '../AppIconButton';

// Mutation caught: a rail circle at the 36pt header size falls under the 44pt minimum touch target.
test('the glass variant is a 46pt circle', () => {
  render(
    <AppIconButton
      icon="heart"
      label="Save"
      hint="Saves this quote."
      onPress={() => undefined}
      variant="glass"
    />,
  );

  const style = StyleSheet.flatten(
    screen.getByLabelText('Save').props.style,
  ) as { height?: number; width?: number };
  expect(style.height).toBe(46);
  expect(style.width).toBe(46);
});

// Mutation caught: firing onPress while disabled would apply a wallpaper the deck has not finished rendering.
test('a disabled button does not fire', () => {
  const onPress = jest.fn();
  render(
    <AppIconButton
      disabled
      icon="heart"
      label="Save"
      hint="Saves this quote."
      onPress={onPress}
      variant="glass"
    />,
  );

  fireEvent.press(screen.getByLabelText('Save'));

  expect(onPress).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test src/components/__tests__/AppIconButton.test.tsx`
Expected: FAIL — `variant="glass"` is not assignable, height is 36.

- [ ] **Step 3: Add the icons**

In `src/components/Icon.tsx`, add to `iconNames`, keeping alphabetical order: `'chevron-up'`, `'download'`, `'mobile-screen'`, `'palette'`, `'sliders'`.

- [ ] **Step 4: Add the glass variant**

In `src/components/AppIconButton.tsx`, widen the prop and pass the style:

```tsx
  /** `circle` is the header control; `glass` is the deck rail; `plain` drops the ring. */
  variant?: 'circle' | 'glass' | 'plain';
```

```tsx
        variant === 'circle' && styles.circle,
        variant === 'glass' && styles.glass,
```

and add the style, with a larger glyph for the rail:

```tsx
  glass: {
    backgroundColor: 'rgba(255, 255, 255, 0.13)',
    borderColor: colors.border,
    borderRadius: spacing.pill,
    borderWidth: 1,
    height: 46,
    width: 46,
  },
```

Import `spacing` from `../theme/spacing`, and size the glyph from the variant:

```tsx
      <Icon
        name={icon}
        size={variant === 'glass' ? 17 : 15}
        color={tone === 'accent' ? colors.accent : colors.text}
      />
```

- [ ] **Step 5: Add the strings**

Add to `src/features/i18n/strings/en.ts`, beside the other `home.*` keys:

```ts
  'home.save.hint': 'Saves this wallpaper to your photo library.',
  'home.deck.next.label': 'Next wallpaper',
  'home.deck.next.hint': 'Swipe up for a new quote and style.',
  'home.deck.previous.label': 'Previous wallpaper',
  'home.deck.previous.hint': 'Swipe down to go back.',
  'home.saved.confirmation': 'Saved to your photo library.',
  'home.saved.error': 'Could not save to your photo library.',
```

and the matching keys in `vi.ts`:

```ts
  'home.save.hint': 'Lưu hình nền này vào thư viện ảnh.',
  'home.deck.next.label': 'Hình nền tiếp theo',
  'home.deck.next.hint': 'Vuốt lên để lấy câu và kiểu mới.',
  'home.deck.previous.label': 'Hình nền trước',
  'home.deck.previous.hint': 'Vuốt xuống để trở lại.',
  'home.saved.confirmation': 'Đã lưu vào thư viện ảnh.',
  'home.saved.error': 'Không lưu được vào thư viện ảnh.',
```

- [ ] **Step 6: Run the tests and commit**

Run: `pnpm test src/components/__tests__/AppIconButton.test.tsx src/features/i18n`
Expected: PASS, including `catalogParity`.

```bash
pnpm verify
git add -A
git commit -m "feat: add the deck rail icon button and its strings"
```

---

### Task 5: The vertical pager

The gesture, isolated from Home so it can be tested without the wallpaper pipeline.

**Files:**
- Create: `src/components/DeckPager.tsx`
- Test: `src/components/__tests__/DeckPager.test.tsx`
- Modify: `app/_layout.tsx`

**Interfaces:**
- Consumes: `Gesture`, `GestureDetector` from `react-native-gesture-handler`.
- Produces:
  ```tsx
  interface DeckPagerProps {
    children: ReactNode;          // the current wallpaper, filling the pager
    previous?: ReactNode;         // rendered above, revealed on a downward drag
    next?: ReactNode;             // rendered below, revealed on an upward drag
    onNext: () => void;
    onPrevious: () => void;
    nextLabel: string;
    nextHint: string;
    previousLabel: string;
    previousHint: string;
  }
  export function DeckPager(props: DeckPagerProps): JSX.Element;
  ```

- [ ] **Step 1: Write the failing test**

Create `src/components/__tests__/DeckPager.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { DeckPager } from '../DeckPager';

function renderPager(overrides: Partial<Parameters<typeof DeckPager>[0]> = {}) {
  const onNext = jest.fn();
  const onPrevious = jest.fn();
  render(
    <DeckPager
      onNext={onNext}
      onPrevious={onPrevious}
      nextLabel="Next wallpaper"
      nextHint="Swipe up for a new quote and style."
      previousLabel="Previous wallpaper"
      previousHint="Swipe down to go back."
      next={<Text>next card</Text>}
      previous={<Text>previous card</Text>}
      {...overrides}
    >
      <Text>current card</Text>
    </DeckPager>,
  );
  return { onNext, onPrevious };
}

// Mutation caught: rendering only the current card makes the drag reveal empty space, so the swipe reads as a state swap rather than a deck.
test('keeps the neighbouring cards mounted so a drag reveals them', () => {
  renderPager();

  expect(screen.getByText('current card')).toBeOnTheScreen();
  expect(screen.getByText('next card')).toBeOnTheScreen();
  expect(screen.getByText('previous card')).toBeOnTheScreen();
});

// Mutation caught: a swipe is invisible to a screen reader, so without explicit actions the deck cannot be advanced at all.
test('exposes both directions as accessibility actions', () => {
  const { onNext, onPrevious } = renderPager();

  const deck = screen.getByLabelText('Next wallpaper');
  fireEvent(deck, 'accessibilityAction', {
    nativeEvent: { actionName: 'activate' },
  });
  expect(onNext).toHaveBeenCalledTimes(1);

  fireEvent(deck, 'accessibilityAction', {
    nativeEvent: { actionName: 'previous' },
  });
  expect(onPrevious).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test src/components/__tests__/DeckPager.test.tsx`
Expected: FAIL — cannot resolve `../DeckPager`.

- [ ] **Step 3: Implement the pager**

Create `src/components/DeckPager.tsx`:

```tsx
import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

interface DeckPagerProps {
  children: ReactNode;
  previous?: ReactNode;
  next?: ReactNode;
  onNext: () => void;
  onPrevious: () => void;
  nextLabel: string;
  nextHint: string;
  previousLabel: string;
  previousHint: string;
}

/** A drag past this fraction of the height commits to the neighbour. */
const COMMIT_RATIO = 0.22;

/**
 * The deck moves like a short-video feed: the neighbouring wallpaper is on
 * screen during the drag, not swapped in on release. Both neighbours stay
 * mounted, which is affordable only because a wallpaper is a recorded picture
 * rather than an encoded bitmap.
 */
export function DeckPager({
  children,
  previous,
  next,
  onNext,
  onPrevious,
  nextLabel,
  nextHint,
  previousLabel,
  previousHint,
}: DeckPagerProps) {
  const offset = useSharedValue(0);
  const height = useSharedValue(0);
  const pan = Gesture.Pan()
    .onChange((event) => {
      offset.value += event.changeY;
    })
    .onEnd(() => {
      const threshold = height.value * COMMIT_RATIO;
      if (offset.value < -threshold) runOnJS(onNext)();
      else if (offset.value > threshold) runOnJS(onPrevious)();
      offset.value = withTiming(0, { duration: 180 });
    });
  const stack = useAnimatedStyle(() => ({
    transform: [{ translateY: offset.value }],
  }));
  // The neighbours sit exactly one viewport away, so the drag offset maps
  // one-to-one onto the card being pulled into view.
  const above = useAnimatedStyle(() => ({ top: -height.value }));
  const below = useAnimatedStyle(() => ({ top: height.value }));
  return (
    <GestureDetector gesture={pan}>
      <View
        accessible
        accessibilityLabel={nextLabel}
        accessibilityHint={nextHint}
        accessibilityActions={[
          { name: 'activate', label: nextLabel },
          { name: 'previous', label: previousLabel },
        ]}
        accessibilityValue={{ text: previousHint }}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'previous') onPrevious();
          else onNext();
        }}
        onLayout={(event) => {
          height.value = event.nativeEvent.layout.height;
        }}
        style={styles.viewport}
      >
        <Animated.View style={[styles.stack, stack]}>
          <Animated.View style={[styles.neighbour, above]}>
            {previous}
          </Animated.View>
          <View style={styles.card}>{children}</View>
          <Animated.View style={[styles.neighbour, below]}>
            {next}
          </Animated.View>
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  viewport: { flex: 1, overflow: 'hidden' },
  stack: { flex: 1 },
  card: { ...StyleSheet.absoluteFillObject },
  neighbour: { ...StyleSheet.absoluteFillObject },
});
```

- [ ] **Step 4: Register the gesture root**

`react-native-gesture-handler` needs a root wrapper. In `app/_layout.tsx`, import it and wrap the returned tree:

```tsx
import { GestureHandlerRootView } from 'react-native-gesture-handler';
```

```tsx
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <Stack ... />
    </GestureHandlerRootView>
  );
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm test src/components/__tests__/DeckPager.test.tsx`
Expected: PASS, 2 tests. If reanimated complains under Jest, add `jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));` to `jest.setup.ts`.

- [ ] **Step 6: Commit**

```bash
pnpm verify
git add -A
git commit -m "feat: add the vertical deck pager"
```

---

### Task 6: Home as the full-bleed vertical deck

**Files:**
- Modify: `app/(tabs)/index.tsx`
- Modify: `app/__tests__/home.test.tsx`
- Modify: `app/__tests__/bootstrap.test.tsx`
- Delete: `src/features/wallpaper/deckLayers.ts`
- Delete: `src/features/wallpaper/__tests__/deckLayers.test.ts`

**Interfaces:**
- Consumes: `DeckPager` from Task 5, `advanceDeck`/`rewindDeck` from Task 2, `AppIconButton` `variant="glass"` from Task 4, `WallpaperCanvas` from Task 1.
- Produces: nothing other tasks depend on.

- [ ] **Step 1: Update the Home test**

In `app/__tests__/home.test.tsx`, replace the navigation test with:

```tsx
// Mutation caught: pointing Restyle back at a deleted style route would dead-end the only path to the templates.
test('Home reaches settings and the presets, and opens the wallpaper target sheet', () => {
  render(<HomeScreen />);

  fireEvent.press(screen.getByLabelText(t('en', 'home.settings.label')));
  expect(router.push).toHaveBeenCalledWith('/settings');
  fireEvent.press(screen.getByLabelText(t('en', 'home.restyle.label')));
  expect(router.navigate).toHaveBeenCalledWith('/customize');

  expect(screen.queryByText('target sheet')).toBeNull();
  fireEvent.press(screen.getByLabelText(t('en', 'home.set.label')));
  expect(screen.getByText('target sheet')).toBeOnTheScreen();
});

// Mutation caught: leaving the deck on tap-to-advance strands the reader, because the full-bleed card has no visible tap target and no way back.
test('the deck advances and rewinds through the pager', () => {
  const advanceDeck = jest.fn().mockResolvedValue(true);
  const rewindDeck = jest.fn().mockResolvedValue(true);
  useAppStore.setState({ advanceDeck, rewindDeck });
  render(<HomeScreen />);

  const deck = screen.getByLabelText(t('en', 'home.deck.next.label'));
  fireEvent(deck, 'accessibilityAction', {
    nativeEvent: { actionName: 'activate' },
  });
  expect(advanceDeck).toHaveBeenCalledTimes(1);

  fireEvent(deck, 'accessibilityAction', {
    nativeEvent: { actionName: 'previous' },
  });
  expect(rewindDeck).toHaveBeenCalledTimes(1);
});
```

In `app/__tests__/bootstrap.test.tsx`, the first test asserts on `home.today`, which is deleted. Change that assertion to the wordmark:

```tsx
  expect(screen.getByText('MOTIVANA')).toBeOnTheScreen();
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test app/__tests__/home.test.tsx app/__tests__/bootstrap.test.tsx`
Expected: FAIL — no element labelled `Next wallpaper`, no `MOTIVANA` text.

- [ ] **Step 3: Rewrite the Home render**

In `app/(tabs)/index.tsx`, delete `PeekDeck`, `formatToday`, the `Chip` import and the `deckLayers` import. Replace the returned tree with the full-bleed deck. The wallpaper fills the screen; the chrome floats with insets applied to itself:

```tsx
  const insets = useSafeAreaInsets();
  const previousPair = state.deckHistory[state.deckCursor - 1];
  const nextPair = state.deckHistory[state.deckCursor + 1];
  return (
    <View style={styles.screen}>
      <DeckPager
        onNext={() => void state.advanceDeck()}
        onPrevious={() => void state.rewindDeck()}
        nextLabel={translate('home.deck.next.label')}
        nextHint={translate('home.deck.next.hint')}
        previousLabel={translate('home.deck.previous.label')}
        previousHint={translate('home.deck.previous.hint')}
        previous={<DeckFace pair={previousPair} size={dimensions} locale={state.contentLocale} />}
        next={<DeckFace pair={nextPair} size={dimensions} locale={state.contentLocale} />}
      >
        {!previewReady ? (
          <View accessibilityRole="progressbar" style={styles.loading}>
            <ActivityIndicator color={colors.accent} />
            <Text allowFontScaling style={styles.loadingText}>
              {translate('home.loading')}
            </Text>
          </View>
        ) : (
          <PreviewErrorBoundary>
            <WallpaperCanvas
              composition={composition!}
              style={StyleSheet.absoluteFill}
            />
            {state.showSafeGuides ? <SafeAreaGuides /> : null}
          </PreviewErrorBoundary>
        )}
      </DeckPager>
      <View pointerEvents="box-none" style={[styles.chrome, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text allowFontScaling style={styles.wordmark}>
            MOTIVANA
          </Text>
          <AppIconButton
            icon="sliders"
            label={translate('home.settings.label')}
            hint={translate('home.settings.hint')}
            onPress={() => router.push('/settings')}
          />
        </View>
      </View>
      <View pointerEvents="box-none" style={styles.footer}>
        <View style={styles.rail}>
          <AppIconButton
            disabled={favoriteBusy}
            icon="heart"
            tone={isFavorite ? 'accent' : 'default'}
            label={translate('home.favorite.add.label')}
            hint={translate('home.favorite.hint')}
            onPress={() => void updateFavorite(state.currentQuoteId)}
            variant="glass"
          />
          <AppIconButton
            icon="palette"
            label={translate('home.restyle.label')}
            hint={translate('home.restyle.hint')}
            onPress={() => router.navigate('/customize')}
            variant="glass"
          />
          <AppIconButton
            icon="download"
            label={translate('home.save.label')}
            hint={translate('home.save.hint')}
            onPress={() => void saveToLibrary()}
            variant="glass"
          />
        </View>
        <View style={styles.hint}>
          <Icon name="chevron-up" size={12} color={colors.dimText} />
        </View>
        <AppButton
          disabled={!fonts || !composition}
          hint={translate('home.set.hint')}
          icon="mobile-screen"
          label={translate('home.set.label')}
          onPress={() => setTargetSheetOpen(true)}
          shape="pill"
        />
      </View>
      {fonts && composition ? (
        <SetWallpaperSheet
          composition={composition}
          fontProvider={fonts}
          onClose={() => setTargetSheetOpen(false)}
          visible={targetSheetOpen}
        />
      ) : null}
    </View>
  );
```

Add the neighbour renderer below `HomeScreen`, which builds a composition for a trail pair so the drag reveals a real wallpaper:

```tsx
/** A neighbouring wallpaper in the pager. Undefined at either end of the trail. */
function DeckFace({
  pair,
  size,
  locale,
}: {
  pair: { quoteId: string; presetId: string } | undefined;
  size: { width: number; height: number };
  locale: ContentLocale;
}) {
  const composition = useMemo(() => {
    if (!pair) return undefined;
    try {
      return createWallpaperComposition(
        pair.quoteId,
        pair.presetId,
        size.width,
        size.height,
        locale,
      );
    } catch {
      return undefined;
    }
  }, [locale, pair, size.height, size.width]);
  if (!composition) return null;
  return (
    <WallpaperCanvas composition={composition} style={StyleSheet.absoluteFill} />
  );
}
```

Add `saveToLibrary` beside `updateFavorite`, reusing the exporter the sheet uses:

```tsx
  const saveToLibrary = async () => {
    if (!fonts || !composition) return;
    try {
      const uri = await exportWallpaper({ composition, fontProvider: fonts });
      await saveWallpaper(uri);
      setFavoriteFeedback({ message: translate('home.saved.confirmation') });
    } catch {
      setFavoriteFeedback({ message: translate('home.saved.error') });
    }
  };
```

Replace the styles for `screen`, `header` and `footer`, and add the new ones:

```tsx
  screen: { backgroundColor: colors.background, flex: 1 },
  chrome: { left: 0, position: 'absolute', right: 0, top: 0 },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.x2 + 2,
    paddingTop: spacing.x1,
  },
  wordmark: { ...typography.tab, color: colors.dimText, letterSpacing: 2.4 },
  footer: {
    bottom: 0,
    gap: spacing.x2,
    left: 0,
    paddingBottom: spacing.x2,
    paddingHorizontal: spacing.x2 + 2,
    position: 'absolute',
    right: 0,
  },
  rail: { alignItems: 'flex-end', alignSelf: 'flex-end', gap: spacing.x1 + 2 },
  hint: { alignItems: 'flex-start' },
```

Import `useSafeAreaInsets` from `react-native-safe-area-context`, `Icon` from `../../src/components/Icon`, `DeckPager` from `../../src/components/DeckPager`, `exportWallpaper` from `../../src/features/wallpaper/exportWallpaper`, and `saveWallpaper` from `../../src/services/mediaLibrary`.

- [ ] **Step 4: Delete the peek layers**

```bash
git rm src/features/wallpaper/deckLayers.ts src/features/wallpaper/__tests__/deckLayers.test.ts
```

- [ ] **Step 5: Remove the dead strings**

Delete `'home.today'` from both `src/features/i18n/strings/en.ts` and `vi.ts`.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm test app/__tests__`
Expected: PASS.

- [ ] **Step 7: Verify on the emulator**

```bash
pnpm exec expo run:android
adb exec-out screencap -p > /tmp/task6.png
```

Check against the reference design: wordmark and sliders button at the top, quote full-bleed, three glass circles bottom-right, chevron bottom-left, rounded amber pill above the tab bar. Then swipe up and down and confirm the neighbouring wallpaper moves with your finger rather than appearing on release.

- [ ] **Step 8: Commit**

```bash
pnpm verify
git add -A
git commit -m "feat: make home a full-bleed vertical deck"
```

---

### Task 7: Warm the next background

A random template can be a photograph, decoded lazily at about 13.8 MB. Without this the first swipe onto an undecoded photo shows the fallback band colour until the decode lands.

**Files:**
- Modify: `app/(tabs)/index.tsx`
- Test: `app/__tests__/home.test.tsx`

**Interfaces:**
- Consumes: `getBackgroundImage` from `src/features/wallpaper/useBackgroundImage.ts`.
- Produces: nothing.

- [ ] **Step 1: Write the failing test**

Add to `app/__tests__/home.test.tsx`:

```tsx
// Mutation caught: without a prefetch the first swipe onto an undecoded photograph shows the fallback band colour instead of the picture.
test('warms the decode for the next photographic background', async () => {
  const photograph = getAllTemplates().find(
    (template) => template.background.kind === 'image',
  )!;
  useAppStore.setState({
    deckHistory: [
      { quoteId: useAppStore.getState().currentQuoteId, presetId: 'midnight-focus' },
      { quoteId: useAppStore.getState().currentQuoteId, presetId: photograph.id },
    ],
    deckCursor: 0,
  });

  render(<HomeScreen />);

  await waitFor(() =>
    expect(mockGetBackgroundImage).toHaveBeenCalledWith(
      (photograph.background as { asset: string }).asset,
      'full',
    ),
  );
});
```

Add the mock beside the other module mocks at the top of that file:

```tsx
const mockGetBackgroundImage = jest.fn().mockResolvedValue(undefined);
jest.mock('../../src/features/wallpaper/useBackgroundImage', () => ({
  useBackgroundImage: () => null,
  getBackgroundImage: (...args: unknown[]) => mockGetBackgroundImage(...args),
}));
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test app/__tests__/home.test.tsx -t "warms the decode"`
Expected: FAIL — `mockGetBackgroundImage` was not called.

- [ ] **Step 3: Add the prefetch**

In `app/(tabs)/index.tsx`, inside `HomeScreen`:

```tsx
  // The decode cache lives for the application's lifetime, so warming the next
  // photograph costs nothing a later swipe would not have paid anyway.
  useEffect(() => {
    const upcoming = state.deckHistory[state.deckCursor + 1];
    const background = upcoming
      ? getPresetById(upcoming.presetId)?.background
      : undefined;
    if (background?.kind === 'image') {
      void getBackgroundImage(background.asset, 'full');
    }
  }, [state.deckCursor, state.deckHistory]);
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test app/__tests__/home.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
pnpm verify
git add -A
git commit -m "perf: warm the decode for the next photographic background"
```

---

### Task 8: Preset name under the quote

The last piece of chrome, split out because it depends on `quoteBounds` scaling and is the one part that can look wrong without failing a test.

**Files:**
- Modify: `app/(tabs)/index.tsx`
- Test: `app/__tests__/home.test.tsx`

**Interfaces:**
- Consumes: `composition.quoteBounds` — `{ x, y, width, height }` in wallpaper pixels.
- Produces: nothing.

- [ ] **Step 1: Write the failing test**

Add to `app/__tests__/home.test.tsx`:

```tsx
// Mutation caught: placing the label at a fixed offset instead of under the measured text overlaps long quotes.
test('places the preset name below the measured quote block', () => {
  render(<HomeScreen />);

  const label = screen.getByText(
    t('en', `preset.${useAppStore.getState().selectedPresetId}.name` as StringKey),
  );
  const style = StyleSheet.flatten(label.props.style) as { top?: number };
  expect(style.top).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test app/__tests__/home.test.tsx -t "preset name"`
Expected: FAIL — no such text on screen.

- [ ] **Step 3: Position it from the composition**

In `app/(tabs)/index.tsx`, inside the chrome overlay, after the header:

```tsx
        {composition && preset ? (
          <View
            pointerEvents="none"
            style={[
              styles.caption,
              // quoteBounds is in wallpaper pixels; the preview is the screen,
              // so one scale factor maps the measured text block onto it.
              {
                left: (composition.quoteBounds.x / composition.width) * width,
                top:
                  ((composition.quoteBounds.y + composition.quoteBounds.height) /
                    composition.height) *
                  height,
              },
            ]}
          >
            <View style={styles.rule} />
            <Text allowFontScaling style={styles.presetName}>
              {translate(`preset.${preset.id}.name` as StringKey)}
            </Text>
          </View>
        ) : null}
```

with the styles:

```tsx
  caption: { position: 'absolute' },
  rule: {
    backgroundColor: colors.border,
    height: 1,
    marginBottom: spacing.x2,
    marginTop: spacing.x3,
    width: 36,
  },
  presetName: {
    ...typography.tab,
    color: colors.dimText,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test app/__tests__/home.test.tsx`
Expected: PASS.

- [ ] **Step 5: Verify on the emulator**

```bash
pnpm exec expo run:android
adb exec-out screencap -p > /tmp/task8.png
```

Check the rule and label sit under the quote with the quote's own left margin, on both a one-line and a six-line quote. Swipe until you find each.

- [ ] **Step 6: Commit**

```bash
pnpm verify
git add -A
git commit -m "feat: place the preset name under the measured quote"
```

---

## Self-Review

**Spec coverage.** Section 1 render path → Task 1. Vertical pager → Task 5, wired in Task 6. History → Task 2. Chrome → Tasks 4, 6, 8. Save to library → Task 4 strings, Task 6 wiring. Share → explicitly out of scope, no task. Counter → dropped, no task. Pill radius → Task 6 passes `shape="pill"`. Deviation "tab bar stays" → no work needed, `(tabs)` already provides it. Dead ordered-walk API → Task 3. Prefetch → Task 7. `deckLayers` deletion → Task 6.

**Type consistency.** `{ quoteId, presetId }` is the pair shape in Tasks 2, 6 and 7. `advanceDeck`/`rewindDeck` keep those names throughout. `variant="glass"` matches between Tasks 4 and 6. `DeckPager` props in Task 5 match the call site in Task 6.

**Known gap.** Task 6 is the largest task and touches one file heavily; it is not split further because the pager, the rail and the footer share one layout and a half-built Home does not render. Its emulator check is the gate.
