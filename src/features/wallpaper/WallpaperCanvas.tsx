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
}

export function WallpaperCanvas({
  composition,
  style,
  backgroundVariant = 'full',
}: WallpaperCanvasProps) {
  const fonts = useWallpaperFonts();
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
}
