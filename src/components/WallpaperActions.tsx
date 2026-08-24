import { type SkTypefaceFontProvider } from '@shopify/react-native-skia';
import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import type {
  WallpaperCapabilities,
  WallpaperTarget,
} from '../../modules/motivana-wallpaper';
import type {
  RenderedWallpaper,
  WallpaperComposition,
} from '../features/wallpaper/composition';
import { exportWallpaper } from '../features/wallpaper/exportWallpaper';
import { saveWallpaper } from '../services/mediaLibrary';
import {
  getWallpaperCapabilities,
  setWallpaper,
} from '../services/wallpaperNative';
import { useAppStore } from '../store/useAppStore';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { ActionMessage } from './ActionMessage';
import { AppIconButton } from './AppIconButton';

type WallpaperAction =
  { kind: 'save' } | { kind: 'set'; target: WallpaperTarget };

interface WallpaperActionsProps {
  composition: WallpaperComposition;
  fontProvider: SkTypefaceFontProvider;
}

function errorMessage(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? (error as { code?: unknown }).code
      : undefined;
  switch (code) {
    case 'INVALID_DIMENSIONS':
    case 'SURFACE_CREATION_FAILED':
    case 'DRAW_FAILED':
    case 'ENCODE_FAILED':
    case 'FILE_WRITE_FAILED':
      return `Export failed: ${code}.`;
    case 'PERMISSION_DENIED':
      return 'Photo permission is needed to save this wallpaper.';
    case 'WALLPAPER_NOT_ALLOWED':
      return 'This device does not allow changing the wallpaper.';
    case 'LOCK_UNSUPPORTED':
      return 'This device does not support setting the lock screen.';
    case 'FILE_NOT_FOUND':
      return 'The exported wallpaper is unavailable. Render it again and retry.';
    case 'DECODE_FAILED':
      return 'The exported wallpaper could not be opened.';
    case 'SAVE_FAILED':
      return 'Could not save the wallpaper.';
    default:
      return 'Could not apply the wallpaper.';
  }
}

function successMessage(action: WallpaperAction): string {
  if (action.kind === 'save') return 'Wallpaper saved to your photos.';
  if (action.target === 'home') return 'Wallpaper applied to your Home screen.';
  if (action.target === 'lock') return 'Wallpaper applied to your Lock screen.';
  return 'Wallpaper applied to your Home and Lock screens.';
}

export function WallpaperActions({
  composition,
  fontProvider,
}: WallpaperActionsProps) {
  const appState = useAppStore();
  const [capabilities, setCapabilities] = useState<WallpaperCapabilities>();
  const [showTargets, setShowTargets] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [retryAction, setRetryAction] = useState<WallpaperAction>();
  const [permissionDeniedPermanently, setPermissionDeniedPermanently] =
    useState(false);
  const retryExport = useRef<
    { cacheKey: string; rendered: RenderedWallpaper } | undefined
  >(undefined);
  const busyRef = useRef(false);

  useEffect(() => {
    let active = true;
    getWallpaperCapabilities()
      .then((value) => active && setCapabilities(value))
      .catch(() => active && setError('Wallpaper controls are unavailable.'));
    return () => {
      active = false;
    };
  }, []);

  const run = async (action: WallpaperAction, retry = false) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setMessage(undefined);
    setError(undefined);
    setRetryAction(undefined);
    setPermissionDeniedPermanently(false);
    let rendered: RenderedWallpaper | undefined;
    try {
      rendered =
        retry && retryExport.current?.cacheKey === composition.cacheKey
          ? retryExport.current.rendered
          : await exportWallpaper(composition, fontProvider);
      if (action.kind === 'save') await saveWallpaper(rendered.uri);
      else {
        await setWallpaper(rendered.uri, action.target);
        appState.recordAppliedQuote(composition.quote.id);
      }
      retryExport.current = undefined;
      setShowTargets(false);
      setMessage(successMessage(action));
    } catch (caught) {
      const code =
        typeof caught === 'object' && caught !== null && 'code' in caught
          ? (caught as { code?: unknown }).code
          : undefined;
      const canAskAgain =
        typeof caught === 'object' && caught !== null && 'canAskAgain' in caught
          ? (caught as { canAskAgain?: unknown }).canAskAgain
          : undefined;
      if (code === 'FILE_NOT_FOUND' || !rendered)
        retryExport.current = undefined;
      else retryExport.current = { cacheKey: composition.cacheKey, rendered };
      setError(errorMessage(caught));
      setRetryAction(action);
      setPermissionDeniedPermanently(
        code === 'PERMISSION_DENIED' && canAskAgain === false,
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const targets: readonly [WallpaperTarget, string][] = [
    ['home', 'Set Home screen'],
    ['lock', 'Set Lock screen'],
    ['both', 'Set both screens'],
  ];
  const supports = (target: WallpaperTarget) =>
    target === 'home'
      ? capabilities?.supportsHome
      : target === 'lock'
        ? capabilities?.supportsLock
        : capabilities?.supportsHome && capabilities?.supportsLock;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <AppIconButton
          disabled={busy}
          hint="Exports the current wallpaper and saves it to your photos."
          label="Save wallpaper"
          onPress={() => void run({ kind: 'save' })}
          symbol="↓"
        />
        <AppIconButton
          disabled={busy || !capabilities?.supportsHome}
          hint="Choose which supported screen receives the current wallpaper."
          label="Set wallpaper"
          onPress={() => setShowTargets((visible) => !visible)}
          symbol="▣"
        />
      </View>
      {showTargets ? (
        <View style={styles.targets}>
          {targets
            .filter(([target]) => supports(target))
            .map(([target, label]) => (
              <Pressable
                accessibilityLabel={label}
                accessibilityRole="button"
                disabled={busy}
                key={target}
                onPress={() => void run({ kind: 'set', target })}
                style={[styles.target, busy && styles.disabled]}
              >
                <Text allowFontScaling style={styles.targetText}>
                  {label}
                </Text>
              </Pressable>
            ))}
        </View>
      ) : null}
      {message ? <ActionMessage message={message} /> : null}
      {error ? <ActionMessage message={error} tone="error" /> : null}
      {retryAction ? (
        <AppIconButton
          disabled={busy}
          hint="Repeats the failed action using the same exported wallpaper."
          label="Retry wallpaper action"
          onPress={() => void run(retryAction, true)}
          symbol="↻"
        />
      ) : null}
      {permissionDeniedPermanently ? (
        <AppIconButton
          hint="Opens this app's Android settings so photo permission can be enabled."
          label="Open app settings"
          onPress={() => void Linking.openSettings()}
          symbol="⚙"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.x1 },
  row: { flexDirection: 'row', gap: spacing.x1 },
  targets: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.x1 },
  target: {
    borderColor: colors.accent,
    borderRadius: spacing.radius,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: spacing.control,
    paddingHorizontal: spacing.x2,
  },
  targetText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  disabled: { opacity: 0.48 },
});
