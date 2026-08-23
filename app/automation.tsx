import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionMessage } from '../src/components/ActionMessage';
import { AppIconButton } from '../src/components/AppIconButton';
import { SettingRow } from '../src/components/SettingRow';
import { useAppStore } from '../src/store/useAppStore';
import { colors } from '../src/theme/colors';
import { spacing } from '../src/theme/spacing';
import { typography } from '../src/theme/typography';
import { router } from 'expo-router';
import type {
  RotationIntervalHours,
  WallpaperTarget,
} from '../src/store/schema';

function Choice({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.choice, selected && styles.selected]}
    >
      <Text allowFontScaling style={styles.choiceText}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function AutomationScreen() {
  const state = useAppStore();
  const [interval, setInterval] = useState<RotationIntervalHours>(
    state.rotationIntervalHours,
  );
  const [target, setTarget] = useState<WallpaperTarget>(state.wallpaperTarget);
  const [favoritesOnly, setFavoritesOnly] = useState(state.favoriteQuotesOnly);
  const [message, setMessage] = useState<string>();
  const save = () => {
    if (favoritesOnly && state.favoriteQuoteIds.length === 0) {
      setMessage('Add a favorite before using favorites-only rotation.');
      return;
    }
    state.setRotationConfiguration({
      enabled: false,
      intervalHours: interval,
      target,
    });
    if (favoritesOnly !== state.favoriteQuotesOnly)
      state.setFavoriteQuotesOnly(favoritesOnly);
    setMessage(
      'Preferences saved. Scheduling remains unavailable until the Android wallpaper service arrives.',
    );
  };
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text allowFontScaling style={typography.eyebrow}>
            AUTOMATION
          </Text>
          <Text allowFontScaling style={typography.screenTitle}>
            Rotation
          </Text>
        </View>
        <AppIconButton
          label="Back to Home"
          hint="Returns to the wallpaper preview."
          onPress={() => router.back()}
          symbol="‹"
        />
      </View>
      <ActionMessage
        title="Wallpaper service unavailable"
        message="Scheduling will activate only after the Android wallpaper service is installed."
      />
      <View
        accessible
        accessibilityLabel="Service status unavailable"
        style={styles.status}
      >
        <Text allowFontScaling style={styles.statusText}>
          Capability: unavailable
        </Text>
        <Text allowFontScaling style={styles.statusText}>
          Status: unavailable
        </Text>
      </View>
      <View style={styles.section}>
        <Text allowFontScaling style={styles.label}>
          Every
        </Text>
        <View style={styles.choices}>
          {([6, 12, 24] as const).map((hours) => (
            <Choice
              key={hours}
              label={`Every ${hours} hours`}
              selected={interval === hours}
              onPress={() => setInterval(hours)}
            />
          ))}
        </View>
      </View>
      <View style={styles.section}>
        <Text allowFontScaling style={styles.label}>
          Apply to
        </Text>
        <View style={styles.choices}>
          {(
            [
              ['home', 'Apply to Home screen'],
              ['lock', 'Apply to Lock screen'],
              ['both', 'Apply to both screens'],
            ] as const
          ).map(([value, label]) => (
            <Choice
              key={value}
              label={label}
              selected={target === value}
              onPress={() => setTarget(value)}
            />
          ))}
        </View>
      </View>
      <SettingRow
        label="Use favorite quotes only"
        description="Rotation will use only your saved quotes."
        value={favoritesOnly}
        onValueChange={setFavoritesOnly}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Save automation preferences"
        onPress={save}
        style={styles.save}
      >
        <Text allowFontScaling style={typography.button}>
          Save automation preferences
        </Text>
      </Pressable>
      {message ? (
        <ActionMessage
          tone={message.startsWith('Add') ? 'error' : 'default'}
          message={message}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
    flex: 1,
    gap: spacing.x2,
    paddingHorizontal: spacing.x2,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  status: { flexDirection: 'row', gap: spacing.x2 },
  statusText: { color: colors.mutedText, fontSize: 13 },
  section: { gap: spacing.x1 },
  label: { color: colors.text, fontSize: 16, fontWeight: '700' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.x1 },
  choice: {
    borderColor: colors.border,
    borderRadius: spacing.radius,
    borderWidth: 1,
    minHeight: spacing.control,
    paddingHorizontal: spacing.x2,
    justifyContent: 'center',
  },
  selected: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.accent,
  },
  choiceText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  save: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: spacing.radius,
    justifyContent: 'center',
    minHeight: spacing.control,
    paddingHorizontal: spacing.x2,
  },
});
