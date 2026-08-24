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
import { AppIconButton } from './AppIconButton';
import { Toast } from './Toast';
import { useTranslate } from '../features/i18n/useTranslate';
import type { StringKey } from '../features/i18n/t';

type WallpaperAction =
  { kind: 'save' } | { kind: 'set'; target: WallpaperTarget };

interface WallpaperActionsProps {
  composition: WallpaperComposition;
  fontProvider: SkTypefaceFontProvider;
}

type Translate = (
  key: StringKey,
  params?: Record<string, string | number>,
) => string;

function errorMessage(error: unknown, translate: Translate): string {
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
      return translate('actions.export.failed', { code });
    case 'PERMISSION_DENIED':
      return translate('actions.error.permissionDenied');
    case 'WALLPAPER_NOT_ALLOWED':
      return translate('actions.error.wallpaperNotAllowed');
    case 'LOCK_UNSUPPORTED':
      return translate('actions.error.lockUnsupported');
    case 'FILE_NOT_FOUND':
      return translate('actions.error.fileNotFound');
    case 'DECODE_FAILED':
      return translate('actions.error.decodeFailed');
    case 'SAVE_FAILED':
      return translate('actions.error.saveFailed');
    default:
      return translate('actions.error.default');
  }
}

function successMessage(action: WallpaperAction, translate: Translate): string {
  if (action.kind === 'save') return translate('actions.success.save');
  if (action.target === 'home') return translate('actions.success.home');
  if (action.target === 'lock') return translate('actions.success.lock');
  return translate('actions.success.both');
}

export function WallpaperActions({
  composition,
  fontProvider,
}: WallpaperActionsProps) {
  const appState = useAppStore();
  const translate = useTranslate();
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
      .catch(
        () =>
          active &&
          setError(translate('actions.error.capabilitiesUnavailable')),
      );
    return () => {
      active = false;
    };
    // Checks capability support once on mount; re-running this on every
    // interface-language change would needlessly re-query the native side.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setMessage(successMessage(action, translate));
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
      setError(errorMessage(caught, translate));
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
    ['home', translate('actions.target.home')],
    ['lock', translate('actions.target.lock')],
    ['both', translate('actions.target.both')],
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
          hint={translate('actions.save.hint')}
          label={translate('actions.save.label')}
          onPress={() => void run({ kind: 'save' })}
          symbol="↓"
        />
        <AppIconButton
          disabled={busy || !capabilities?.supportsHome}
          hint={translate('actions.set.hint')}
          label={translate('actions.set.label')}
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
      {message ? (
        <Toast message={message} onDismiss={() => setMessage(undefined)} />
      ) : null}
      {error ? <Toast duration={0} message={error} tone="error" /> : null}
      {retryAction ? (
        <AppIconButton
          disabled={busy}
          hint={translate('actions.retry.hint')}
          label={translate('actions.retry.label')}
          onPress={() => void run(retryAction, true)}
          symbol="↻"
        />
      ) : null}
      {permissionDeniedPermanently ? (
        <AppIconButton
          hint={translate('actions.appSettings.hint')}
          label={translate('actions.appSettings.label')}
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
