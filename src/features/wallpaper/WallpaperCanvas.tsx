import { Canvas, Image as SkiaImage, Skia } from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
import {
  Image as NativeImage,
  Platform,
  View,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import type { WallpaperComposition } from './composition';
import { drawWallpaperScene, measureSkiaComposition } from './scene';
import { useWallpaperFonts } from './useWallpaperFonts';

export interface WallpaperCanvasProps {
  composition: WallpaperComposition;
  style?: StyleProp<ViewStyle>;
}

export function WallpaperCanvas({ composition, style }: WallpaperCanvasProps) {
  const fonts = useWallpaperFonts();
  const measuredComposition = useMemo(
    () => (fonts ? measureSkiaComposition(composition, fonts) : composition),
    [composition, fonts],
  );
  const fallbackUri = useMemo(
    () =>
      fonts && Platform.OS === 'android'
        ? createPreviewDataUri(measuredComposition, fonts)
        : null,
    [fonts, measuredComposition],
  );
  const preview = useMemo(
    () =>
      fonts && Platform.OS !== 'android'
        ? createPreviewImage(measuredComposition, fonts)
        : null,
    [fonts, measuredComposition],
  );
  useEffect(
    () => () => {
      preview?.image.dispose?.();
      preview?.surface.dispose?.();
    },
    [preview],
  );

  if (Platform.OS === 'android') {
    return fallbackUri ? (
      <NativeImage
        accessible
        accessibilityLabel="Wallpaper preview"
        source={{ uri: fallbackUri }}
        resizeMode="stretch"
        style={style as StyleProp<ImageStyle>}
      />
    ) : (
      <View accessible accessibilityLabel="Wallpaper preview" style={style} />
    );
  }

  return (
    <Canvas style={style} accessible accessibilityLabel="Wallpaper preview">
      {preview ? (
        <SkiaImage
          image={preview.image}
          x={0}
          y={0}
          width={measuredComposition.width}
          height={measuredComposition.height}
          fit="fill"
        />
      ) : null}
    </Canvas>
  );
}

export function createPreviewImage(
  composition: WallpaperComposition,
  fonts: NonNullable<ReturnType<typeof useWallpaperFonts>>,
) {
  const surface = Skia.Surface.MakeOffscreen(
    composition.width,
    composition.height,
  );
  if (!surface) return null;
  try {
    drawWallpaperScene(surface.getCanvas(), composition, fonts);
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
): string | null {
  const preview = createPreviewImage(composition, fonts);
  if (!preview) return null;
  try {
    return `data:image/png;base64,${preview.image.encodeToBase64()}`;
  } finally {
    preview.image.dispose?.();
    preview.surface.dispose?.();
  }
}
