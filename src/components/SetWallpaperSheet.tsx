import type { SkTypefaceFontProvider } from '@shopify/react-native-skia';
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
import { typography } from '../theme/typography';
import { AppButton } from './AppButton';
import { AppIconButton } from './AppIconButton';
import { Icon, type IconName } from './Icon';
import { Toast } from './Toast';
import { useTranslate } from '../features/i18n/useTranslate';
import type { StringKey } from '../features/i18n/t';

interface SetWallpaperSheetProps {
  visible: boolean;
  onClose: () => void;
  composition: WallpaperComposition;
  fontProvider: SkTypefaceFontProvider;
}

type Translate = (
  key: StringKey,
  params?: Record<string, string | number>,
) => string;

const targets: readonly {
  value: WallpaperTarget;
  icon: IconName;
  labelKey: StringKey;
}[] = [
  { value: 'home', icon: 'house', labelKey: 'sheet.target.home' },
  { value: 'lock', icon: 'lock', labelKey: 'sheet.target.lock' },
  { value: 'both', icon: 'clone', labelKey: 'sheet.target.both' },
];

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

function successMessage(target: WallpaperTarget, translate: Translate): string {
  if (target === 'home') return translate('actions.success.home');
  if (target === 'lock') return translate('actions.success.lock');
  return translate('actions.success.both');
}

/**
 * Screen 1h of the board. The reader picks a target and applies; the copy of
 * the image in the photo library is a Settings preference, not a second button,
 * so applying stays a single decision.
 */
export function SetWallpaperSheet({
  visible,
  onClose,
  composition,
  fontProvider,
}: SetWallpaperSheetProps) {
  const translate = useTranslate();
  const appState = useAppStore();
  const [capabilities, setCapabilities] = useState<WallpaperCapabilities>();
  const [target, setTarget] = useState<WallpaperTarget>(
    appState.wallpaperTarget,
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [canRetry, setCanRetry] = useState(false);
  const retryExport = useRef<
    { cacheKey: string; rendered: RenderedWallpaper } | undefined
  >(undefined);
  const busyRef = useRef(false);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    getWallpaperCapabilities()
      .then((value) => {
        if (!active) return;
        setCapabilities(value);
        // A target the device cannot serve must not stay selected.
        setTarget((current) => (supports(current, value) ? current : 'home'));
      })
      .catch(
        () =>
          active &&
          setError(translate('actions.error.capabilitiesUnavailable')),
      );
    return () => {
      active = false;
    };
    // Re-querying on an interface-language change would needlessly cross the
    // native boundary; the capability answer does not depend on language.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const apply = async (retry = false) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setMessage(undefined);
    setError(undefined);
    setCanRetry(false);
    let rendered: RenderedWallpaper | undefined;
    try {
      rendered =
        retry && retryExport.current?.cacheKey === composition.cacheKey
          ? retryExport.current.rendered
          : await exportWallpaper(composition, fontProvider);
      await setWallpaper(rendered.uri, target);
      appState.recordAppliedQuote(composition.quote.id);
      retryExport.current = undefined;
      setMessage(successMessage(target, translate));
      // The copy in the photo library is a separate promise. The wallpaper is
      // already applied, so a failure here is reported beside the success
      // rather than replacing it.
      if (appState.saveToPhotoLibrary) {
        try {
          await saveWallpaper(rendered.uri);
        } catch (caught) {
          setError(errorMessage(caught, translate));
        }
      }
    } catch (caught) {
      const code =
        typeof caught === 'object' && caught !== null && 'code' in caught
          ? (caught as { code?: unknown }).code
          : undefined;
      if (code === 'FILE_NOT_FOUND' || !rendered)
        retryExport.current = undefined;
      else retryExport.current = { cacheKey: composition.cacheKey, rendered };
      setError(errorMessage(caught, translate));
      setCanRetry(true);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View style={styles.backdrop}>
        <Pressable
          accessibilityLabel={translate('sheet.close.label')}
          accessibilityHint={translate('sheet.close.hint')}
          accessibilityRole="button"
          onPress={onClose}
          style={styles.dismissArea}
        />
        {/* The sheet rises from the bottom edge, so it must clear the system
            navigation bar on its own. */}
        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <View style={styles.grabber} />
          <Text allowFontScaling style={styles.title}>
            {translate('sheet.title')}
          </Text>
          <View style={styles.options}>
            {targets.map((option) => {
              const available = supports(option.value, capabilities);
              const selected = option.value === target;
              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityLabel={translate(option.labelKey)}
                  accessibilityState={{
                    checked: selected,
                    disabled: !available,
                  }}
                  disabled={!available || busy}
                  key={option.value}
                  onPress={() => setTarget(option.value)}
                  style={[
                    styles.option,
                    selected && styles.optionSelected,
                    !available && styles.optionUnavailable,
                  ]}
                >
                  <Icon
                    name={option.icon}
                    size={14}
                    color={selected ? colors.accent : colors.mutedText}
                  />
                  <Text
                    allowFontScaling
                    style={[
                      styles.optionLabel,
                      selected && styles.optionLabelSelected,
                    ]}
                  >
                    {translate(option.labelKey)}
                  </Text>
                  {selected ? (
                    <Icon name="circle-check" size={15} color={colors.accent} />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
          {appState.saveToPhotoLibrary ? (
            <Text allowFontScaling style={styles.noteText}>
              {translate('sheet.saveAlso')}
            </Text>
          ) : null}
          <AppButton
            disabled={busy || !supports(target, capabilities)}
            hint={translate('sheet.apply.hint')}
            label={translate('sheet.apply')}
            onPress={() => void apply()}
            shape="pill"
          />
          {message ? <Toast message={message} onDismiss={onClose} /> : null}
          {error ? <Toast duration={0} message={error} tone="error" /> : null}
          {canRetry ? (
            <AppButton
              disabled={busy}
              hint={translate('actions.retry.hint')}
              label={translate('actions.retry.label')}
              onPress={() => void apply(true)}
              variant="outline"
            />
          ) : null}
          <AppIconButton
            icon="xmark"
            label={translate('sheet.close.label')}
            hint={translate('sheet.close.hint')}
            onPress={onClose}
            style={styles.close}
            variant="plain"
          />
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function supports(
  target: WallpaperTarget,
  capabilities: WallpaperCapabilities | undefined,
): boolean {
  if (!capabilities) return false;
  if (target === 'home') return capabilities.supportsHome;
  if (target === 'lock') return capabilities.supportsLock;
  return capabilities.supportsHome && capabilities.supportsLock;
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: colors.overlay, flex: 1 },
  dismissArea: { flex: 1 },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    gap: spacing.x1 + 2,
    paddingBottom: spacing.x3,
    paddingHorizontal: spacing.x2 + 2,
    paddingTop: spacing.x2,
  },
  grabber: {
    alignSelf: 'center',
    backgroundColor: colors.borderStrong,
    borderRadius: spacing.pill,
    height: 4,
    marginBottom: spacing.x1,
    width: 36,
  },
  title: { ...typography.screenTitle, fontSize: 17 },
  options: { gap: 9, marginTop: 6 },
  option: {
    alignItems: 'center',
    borderColor: 'rgba(255, 255, 255, 0.11)',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.x1 + 4,
    minHeight: spacing.control,
    paddingHorizontal: 14,
  },
  optionSelected: {
    backgroundColor: colors.accentWash,
    borderColor: colors.accent,
  },
  optionUnavailable: { opacity: 0.4 },
  optionLabel: { ...typography.rowLabel, color: colors.mutedText, flex: 1 },
  optionLabelSelected: { color: colors.text },
  noteText: { ...typography.caption, flex: 1, fontSize: 11, lineHeight: 17 },
  close: { alignSelf: 'center' },
});
