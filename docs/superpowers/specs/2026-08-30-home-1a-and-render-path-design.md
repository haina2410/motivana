# Full-Bleed Home, Deck Shuffle and the Preview Render Path

Date: 2026-08-30
Status: Proposed
Board: `Motivana Redesign.dc.html`, direction `1a`

## Goal

Three strands, one branch.

1. **Home becomes a full-bleed vertical deck**, built on board direction `1a`
   and the reference design that supersedes its bottom row. The wallpaper
   fills the screen, the controls float over it, and the reader swipes up and
   down through wallpapers the way they would through Shorts or Reels.
2. **Advancing the deck re-rolls the template as well as the quote.** One
   swipe gives a new wallpaper, not a new quote in the same clothes.
3. **The Android preview stops encoding a PNG on every render.** Measured at
   47-235 ms of blocking JS per tap; a recorded `SkPicture` replaces it at
   0.3 ms.

Strand 3 is listed last but must be built first: it changes what
`WallpaperCanvas` returns, and strands 1 and 2 both make Home render more
often, which is what makes the current cost intolerable.

## Prior work on this branch

Already landed as `b5e6c20`, do not redo:

- The four deck destinations are a real `Tabs` group at `app/(tabs)/`, so
  moving between them cannot grow the back stack.
- `DeckTabBar` reads `BottomTabBarProps` and jumps by route name.
- `ScreenHeader` draws its back chevron only when passed `back`.
- The style screen, its test, `src/components/Meter.tsx` and the `style.*`
  strings are deleted. Home's Restyle button jumps to the Presets tab.

## 1. The preview render path

### What was measured

On the emulator, five renders through the current Android path:

| stage | cost |
| --- | --- |
| `measure` | 0.4 - 11.3 ms |
| `surface + draw + snapshot` | 8.3 - 45.3 ms |
| `encodeToBase64` | **47.3 - 234.6 ms** |
| `buildDataUri` | 0.0 ms |
| total blocking JS | 65.7 - 266.2 ms |

The encode is 73-88% of a tap. The base64 strings are 41-109 KB, so the
string transfer is not a cost; the encode CPU is.

### Why the encode exists

`WallpaperCanvas` renders through a live Skia `<Canvas>` on iOS and through a
PNG data URI on Android. Neither the code nor commit `1b3cae5` records why.
The probe found the reason: an offscreen surface snapshot
(`Skia.Surface.MakeOffscreen` then `makeImageSnapshot`) renders **blank** in
the on-screen canvas on Android. Pixels cannot cross that GPU-context
boundary, and encoding a PNG was the way around it.

A second, smaller problem sits on top: `<Canvas onLayout={...} />` is
rejected on Android with an on-screen error, so `canvasSize` never resolves
even when the image is valid.

### The fix

Record the scene into an `SkPicture` instead of rasterising it offscreen. A
picture carries draw commands, not pixels, so it replays on the display's own
context.

```tsx
const picture = useMemo(() => {
  const recorder = Skia.PictureRecorder();
  const recording = recorder.beginRecording(
    Skia.XYWHRect(0, 0, measured.width, measured.height),
  );
  drawWallpaperScene(recording, measured, fonts, backgroundImage ?? undefined);
  return recorder.finishRecordingAsPicture();
}, [backgroundImage, fonts, measured]);
```

Rendered inside a scaled group, with the layout measured on a wrapper view
rather than on the canvas:

```tsx
<View onLayout={onCanvasLayout} style={style}>
  <Canvas style={StyleSheet.absoluteFill}>
    {picture && canvasSize ? (
      <Group transform={[{ scale: canvasSize.width / measured.width }]}>
        <Picture picture={picture} />
      </Group>
    ) : null}
  </Canvas>
</View>
```

Verified on the emulator: renders correctly, `recordPicture` costs 0.3 ms.
Per-tap blocking JS drops from 65-266 ms to under 1 ms, and rasterisation
moves to the render thread.

### Fidelity

The picture path and the PNG path produce the same layout and the same line
breaks. A numeric diff of the card region shows 18,033 differing subpixels of
1,846,800 — about 1%, confined to the text band, and caused by scaling the
recording rather than scaling a bitmap. This is glyph antialiasing, not a
layout change. Acceptable: the wallpaper that gets applied is unaffected.

### What does not change

Only the **preview** stops encoding. Applying a wallpaper still needs real
PNG bytes, and `exportWallpaper.ts` already carries its own surface, draw and
encode through an injectable `createSurface` seam — it does not call into
`WallpaperCanvas` at all. So the export path is untouched, and
`createPreviewImage` and `createPreviewDataUri` are deleted outright: after
this change their only remaining consumer is their own test.

`exportedWallpaperUri` keeps its place as the first-choice source. A finished
PNG on disk still beats re-recording, and it is what lets the deck show an
already-applied wallpaper before the typefaces resolve.

One platform path replaces two. iOS already renders a live canvas; after this
both platforms render a picture, and the `Platform.OS === 'android'` branch in
`WallpaperCanvas` is deleted.

### Rejected alternatives

- **Pre-render the next pair as a performance measure.** Rejected: it was
  worth deferring ~65 ms of work, and the picture path deletes that work
  instead. Note that the vertical pager in section 2 renders three wallpapers
  anyway — but as a *correctness* requirement of the gesture, not an
  optimisation. At 0.3 ms per record it is affordable; under the PNG path
  three simultaneous wallpapers would have cost 200-800 ms and been
  impossible. The probe is what makes that UX buildable.
- **Render the preview as React Native `<Text>` over an image.** Faster than
  the PNG path but not than a picture, and it costs the WYSIWYG guarantee
  direction `1a` is built on: RN's text layout and Skia's paragraph shaper do
  not always break a line at the same word, and Vietnamese stacked tone marks
  are where two shapers most often disagree. It would also need
  `expo-linear-gradient` for the gradient and scrim backgrounds, and would put
  a third renderer alongside Skia and the Kotlin worker.

Both were reasonable before the measurement. Neither survives it.

## 2. Home, direction `1a`

The wallpaper canvas fills the screen. Insets apply to the floating chrome,
not to a `SafeAreaView` wrapper.

`PeekDeck`, its peek layers and `src/features/wallpaper/deckLayers.ts` are
direction `1b`'s device and are deleted with their test.

The reference design supersedes `1a` wherever the two disagree: `1a`'s
horizontal action row and bottom scrim are replaced by the vertical rail and
the full-width pill. `1a`'s right-edge segment indicator is dropped outright
and nothing takes its place.

### Movement: a vertical pager

The deck behaves like Shorts, Reels or TikTok. **Swipe up** moves forward to a
new pair; **swipe down** moves back through the session history. Tap is no
longer a deck gesture — on a full-bleed screen it has no visible target, and
the floating controls are the only things worth tapping.

The pager reveals the neighbouring wallpaper *during* the drag rather than
swapping state on release. That continuous reveal is most of what makes the
gesture read as a deck rather than a button; a swipe that only commits on
release feels like an imitation of one.

So the deck holds three live compositions — previous, current, next — and
records a picture for each. This is why the render path has to land first: at
0.3 ms per record it is free, and under the PNG path it would have cost
200-800 ms per swipe and been unbuildable.

`react-native-gesture-handler` is already a dependency and is currently unused
anywhere in the application. This is what it is for.

### History

Swipe-down must restore the exact pair the reader saw. Ordered traversal
cannot do this: `getAdjacentQuote` walks catalogue order, not the order the
reader travelled, and knows nothing about templates. So the deck keeps a
session history of `(quoteId, presetId)` pairs.

Forward from a point inside the history replays what was already seen before
generating anything new, which is how any browsable deck behaves. The history
is session state, not persisted: it never needs to survive a restart, and
`schema.ts` should not grow a field for it.

Without this an accidental swipe destroys a pair that nothing in the
application can reconstruct, because the pick is random. That is acceptable
today, when a swipe costs only a quote; it stops being acceptable in section 3,
where a swipe re-rolls the template too.

### Chrome

- **Top:** the `MOTIVANA` wordmark in letterspaced caps, and one circular
  `sliders` button to Settings. The date line and `home.today` go, taking
  `formatToday` with them.
- **Under the quote:** a hairline rule, then the preset name in caps. Placed
  from `composition.quoteBounds`, which already carries the fitted text block's
  `x`, `y`, `width` and `height`, scaled to the screen — so the chrome sits
  under the real text rather than at a guessed offset.
- **Right rail:** three circular glass icons stacked bottom-right — favorite,
  restyle, save to library. The reference draws a fourth, share, which is out
  of scope for this branch.
- **Bottom left:** an up chevron hinting the swipe. No counter — see below.
- **Bottom:** the full-width accent `Set wallpaper` pill with a
  `mobile-screen` icon, above the tab bar.

Every pill is rounded to half its height, not the current `spacing.radius`.
This applies to the primary button, the rail circles and the chips.

### One new action

The rail's third icon does not exist in the application today. **Save to
library** wires to `saveWallpaper` in `src/services/mediaLibrary.ts`, which
already exists and is used by `SetWallpaperSheet`. It needs the exported PNG,
so it runs the export path rather than the preview path, and it carries the
same permission failure states the sheet already handles.

The reference also draws a share icon. Share is **out of scope** for this
branch: no share service exists, and it would be a new feature rather than
part of the redesign. The rail is built so a fourth icon can be added later
without relayout.

### No position counter

The reference draws `6 / 120`. It is dropped. The deck is random and
effectively endless, so a total is a number the reader cannot act on, and a
position within a random walk tells them nothing about where they are.

The up chevron stays as the swipe affordance. It is the part that was doing
work — the gesture has no other visible hint, and a vertical swipe is not
discoverable on a screen that looks like a still image.

### One deviation from the board

**The tab bar stays.** `1a` draws none, but it predates the tabs landed in
`b5e6c20` and the other three destinations must stay reachable. A full-bleed
vertical feed above a tab bar is what Instagram and TikTok both do, so the two
sit together without argument.

## 3. Advancing the deck re-rolls the template

`randomQuote` becomes one deck action that picks a new quote and a new
template, each avoiding the one on screen, in a single commit so the wallpaper
never renders a half-changed pair.

It must become async. Quote selection goes through the plain `commit`, but
`selectedPresetId` is part of the payload the Kotlin rotation worker reads, so
changing it has to go through `commitAutomation` as `selectPreset` does.
Otherwise the scheduled wallpaper keeps rendering the template the reader
tapped past. `onNext` awaits it; nothing else calls `randomQuote`.

The pool is `getAllTemplates()` — everything the Presets tab offers, so the
deck can reach the photographic backgrounds and not only the eight plain
presets.

### Consequences

- **The Presets tab stops being sticky.** A template chosen there survives
  only until the next tap on the deck. This is intended, and it is a real
  behaviour change to another tab.
- **Prefetch the next background.** A random template can be a photograph, and
  `useBackgroundImage` decodes those lazily at about 13.8 MB. Without a
  prefetch the first tap onto an undecoded photo shows the fallback band colour
  until the decode lands. Calling `getBackgroundImage` for the next pick warms
  a cache that already lives for the application's lifetime.

This is unrelated to the Rotation tab's own `randomizePreset` switch, which
governs the background worker and is untouched.

## Testing

- `WallpaperCanvas`: the picture path is exercised on both platforms. The
  Android-only branch goes, and `src/features/wallpaper/__tests__/WallpaperCanvas.test.tsx`
  is rewritten — it currently tests `createPreviewDataUri` and
  `createPreviewImage`, both of which are deleted.
- `randomQuote`: one commit changes both ids; neither repeats the current
  value; the automation payload reaches the synchroniser.
- Deck history: swipe-down restores the exact previous pair; forward from
  inside the history replays before generating; the history survives a tab
  change and does not survive a restart.
- Home: the rail actions and the pill keep their accessibility labels, so they
  stay reachable by name as icons. The pager exposes the swipe as an
  accessibility action, since a swipe alone is unreachable for a screen reader.
- `deckLayers` and its test are deleted.
- Every task ends with `pnpm verify` green.

Note that `ota/worker` has its own `node_modules` and is not covered by the
root install; `pnpm --dir ota/worker install` is needed once per worktree
before `pnpm verify` can pass.

## Open questions

None. The probe closed the one that gated the design, and dropping the counter
closed the one about what it counted.

`nextQuote`, `previousQuote` and `getAdjacentQuote` are now dead: nothing in
the application walks the catalogue in order, and the deck's own history
supplies backward movement. They are deleted with the rest.
