import {
  Canvas,
  Image as SkiaImage,
  Skia,
  type SkImage,
} from '@shopify/react-native-skia';
import { useEffect, useMemo, useState } from 'react';
import {
  Image as NativeImage,
  Platform,
  View,
  type ImageStyle,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import type { WallpaperComposition } from './composition';
import { exportedWallpaperUri } from './exportCache';
import { drawWallpaperScene, measureSkiaComposition } from './scene';
import { useBackgroundImage } from './useBackgroundImage';
import { useWallpaperFonts } from './useWallpaperFonts';

export interface WallpaperCanvasProps {
  composition: WallpaperComposition;
  style?: StyleProp<ViewStyle>;
}

export function WallpaperCanvas({ composition, style }: WallpaperCanvasProps) {
  const fonts = useWallpaperFonts();
  const backgroundImage = useBackgroundImage(composition.preset.background);
  // The wallpaper the reader already applied is on disk as a finished PNG. Using
  // it skips both the typeface load and the draw, so the card fills the first
  // frame instead of holding a spinner for the whole font load.
  const exported = useMemo(
    () => exportedWallpaperUri(composition.cacheKey),
    [composition.cacheKey],
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
  const fallbackUri = useMemo(
    () =>
      fonts && Platform.OS === 'android' && exported === undefined
        ? createPreviewDataUri(measuredComposition, fonts, backgroundImage)
        : null,
    [backgroundImage, exported, fonts, measuredComposition],
  );
  const preview = useMemo(
    () =>
      fonts && Platform.OS !== 'android'
        ? createPreviewImage(measuredComposition, fonts, backgroundImage)
        : null,
    [backgroundImage, fonts, measuredComposition],
  );
  useEffect(
    () => () => {
      preview?.image.dispose?.();
      preview?.surface.dispose?.();
    },
    [preview],
  );

  if (Platform.OS === 'android') {
    const source = exported ?? fallbackUri;
    return source ? (
      <NativeImage
        accessible
        accessibilityLabel="Wallpaper preview"
        source={{ uri: source }}
        resizeMode="contain"
        style={style as StyleProp<ImageStyle>}
      />
    ) : (
      <View accessible accessibilityLabel="Wallpaper preview" style={style} />
    );
  }

  return (
    <Canvas
      style={style}
      accessible
      accessibilityLabel="Wallpaper preview"
      onLayout={onCanvasLayout}
    >
      {preview && canvasSize ? (
        <SkiaImage
          image={preview.image}
          x={0}
          y={0}
          width={canvasSize.width}
          height={canvasSize.height}
          fit="contain"
        />
      ) : null}
    </Canvas>
  );
}

export function createPreviewImage(
  composition: WallpaperComposition,
  fonts: NonNullable<ReturnType<typeof useWallpaperFonts>>,
  backgroundImage?: SkImage | null,
) {
  const surface = Skia.Surface.MakeOffscreen(
    composition.width,
    composition.height,
  );
  if (!surface) return null;
  try {
    drawWallpaperScene(
      surface.getCanvas(),
      composition,
      fonts,
      backgroundImage ?? undefined,
    );
    surface.flush();
    return { image: surface.makeImageSnapshot(), surface };
  } catch (error) {
    surface.dispose?.();
    throw error;
  }
}

export function createPreviewDataUri(
  composition: WallpaperComposition,
  fonts: NonNullable<ReturnType<typeof useWallpaperFonts>>,
  backgroundImage?: SkImage | null,
): string | null {
  const preview = createPreviewImage(composition, fonts, backgroundImage);
  if (!preview) return null;
  try {
    return `data:image/png;base64,${preview.image.encodeToBase64()}`;
  } finally {
    preview.image.dispose?.();
    preview.surface.dispose?.();
  }
}
