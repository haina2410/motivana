import { Canvas, Group, Picture, Skia } from '@shopify/react-native-skia';
import { useMemo, useState } from 'react';
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import type { WallpaperComposition } from './composition';
import { fitWallpaper, type WallpaperFit } from './fit';
import { drawWallpaperScene, measureSkiaComposition } from './scene';
import {
  useBackgroundImage,
  type BackgroundImageVariant,
} from './useBackgroundImage';
import { useWallpaperFonts } from './useWallpaperFonts';

export interface WallpaperCanvasProps {
  composition: WallpaperComposition;
  style?: StyleProp<ViewStyle>;
  /** Picker cards ask for `thumb`; the full-size card and export do not. */
  backgroundVariant?: BackgroundImageVariant;
  /**
   * `contain` letterboxes and is what every card but the deck wants. The deck
   * asks for `cover`, so the wallpaper reaches all four edges of the screen.
   */
  fit?: WallpaperFit;
}

export function WallpaperCanvas({
  composition,
  style,
  backgroundVariant = 'full',
  fit = 'contain',
}: WallpaperCanvasProps) {
  const { provider: fonts } = useWallpaperFonts();
  const backgroundImage = useBackgroundImage(
    composition.preset.background,
    backgroundVariant,
  );
  const [canvasSize, setCanvasSize] = useState<{
    width: number;
    height: number;
  }>();
  const onCanvasLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setCanvasSize((current) =>
      current?.width === width && current?.height === height
        ? current
        : { width, height },
    );
  };
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
      Skia.XYWHRect(
        0,
        0,
        measuredComposition.width,
        measuredComposition.height,
      ),
    );
    drawWallpaperScene(
      recording,
      measuredComposition,
      fonts,
      backgroundImage ?? undefined,
    );
    return recorder.finishRecordingAsPicture();
  }, [backgroundImage, fonts, measuredComposition]);

  // fitWallpaper is the one place the scale and the origin are decided,
  // because the preset caption is positioned from the same arithmetic and has
  // to land on the quote this draws.
  const placement = canvasSize
    ? fitWallpaper(measuredComposition, canvasSize, fit)
    : undefined;

  // Skia's <Canvas> rejects onLayout on Android, so a plain view measures.
  return (
    <View
      accessible
      accessibilityLabel="Wallpaper preview"
      onLayout={onCanvasLayout}
      style={style}
    >
      <Canvas style={StyleSheet.absoluteFill}>
        {picture && canvasSize && placement ? (
          // Applied in order, so the picture is scaled first and the centring
          // offset moves the scaled result.
          <Group
            transform={[
              { translateX: placement.x },
              { translateY: placement.y },
              { scale: placement.scale },
            ]}
          >
            <Picture picture={picture} />
          </Group>
        ) : null}
      </Canvas>
    </View>
  );
}
