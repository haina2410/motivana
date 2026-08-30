import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTranslate } from '../features/i18n/useTranslate';
import type { StringKey } from '../features/i18n/t';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { Icon, type IconName } from './Icon';

interface TabDefinition {
  /** The file name under app/(tabs), which is how the navigator names a route. */
  name: string;
  icon: IconName;
  labelKey: StringKey;
  hintKey: StringKey;
}

const tabs: readonly TabDefinition[] = [
  {
    name: 'index',
    icon: 'layer-group',
    labelKey: 'tab.deck',
    hintKey: 'tab.deck.hint',
  },
  {
    name: 'customize',
    icon: 'swatchbook',
    labelKey: 'tab.presets',
    hintKey: 'tab.presets.hint',
  },
  {
    name: 'favorites',
    icon: 'heart',
    labelKey: 'tab.saved',
    hintKey: 'tab.saved.hint',
  },
];

/**
 * Keeps the other screens one reach away, as the board's home direction asks.
 * The navigator owns which tab is current, so the bar reads it from the
 * navigation state rather than from a prop each screen has to pass correctly.
 */
export function DeckTabBar({ navigation, state }: BottomTabBarProps) {
  const translate = useTranslate();
  const currentName = state.routes[state.index]?.name;
  return (
    // The bar is the last thing on the screen, so it carries the bottom inset
    // itself. Without it the tabs sit under the system navigation bar.
    <SafeAreaView edges={['bottom']} style={styles.bar}>
      {tabs.map((tab) => {
        const selected = tab.name === currentName;
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityLabel={translate(tab.labelKey)}
            accessibilityHint={translate(tab.hintKey)}
            accessibilityState={{ selected }}
            key={tab.name}
            onPress={() => {
              if (!selected) navigation.navigate(tab.name);
            }}
            style={styles.tab}
          >
            <Icon
              name={tab.icon}
              size={16}
              color={selected ? colors.accent : colors.dimText}
            />
            <Text
              allowFontScaling
              style={[styles.label, selected && styles.labelActive]}
            >
              {translate(tab.labelKey)}
            </Text>
          </Pressable>
        );
      })}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bar: {
    alignItems: 'center',
    backgroundColor: colors.overlay,
    borderTopColor: 'rgba(255, 255, 255, 0.07)',
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    minHeight: spacing.tabBar,
  },
  tab: {
    alignItems: 'center',
    flex: 1,
    gap: 5,
    justifyContent: 'center',
    paddingVertical: spacing.x1,
  },
  label: { ...typography.tab, color: colors.dimText },
  labelActive: { color: colors.accent },
});
