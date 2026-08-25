import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTranslate } from '../features/i18n/useTranslate';
import type { StringKey } from '../features/i18n/t';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { Icon, type IconName } from './Icon';

export type DeckTab = 'deck' | 'presets' | 'saved' | 'rotate';

interface TabDefinition {
  key: DeckTab;
  icon: IconName;
  route: '/' | '/customize' | '/favorites' | '/automation';
  labelKey: StringKey;
  hintKey: StringKey;
}

const tabs: readonly TabDefinition[] = [
  {
    key: 'deck',
    icon: 'layer-group',
    route: '/',
    labelKey: 'tab.deck',
    hintKey: 'tab.deck.hint',
  },
  {
    key: 'presets',
    icon: 'swatchbook',
    route: '/customize',
    labelKey: 'tab.presets',
    hintKey: 'tab.presets.hint',
  },
  {
    key: 'saved',
    icon: 'heart',
    route: '/favorites',
    labelKey: 'tab.saved',
    hintKey: 'tab.saved.hint',
  },
  {
    key: 'rotate',
    icon: 'clock-rotate-left',
    route: '/automation',
    labelKey: 'tab.rotate',
    hintKey: 'tab.rotate.hint',
  },
];

/**
 * Keeps the other screens one reach away, as the board's home direction asks.
 * `navigate` rather than `push`, so moving between tabs cannot grow the back
 * stack into a chain the reader has to unwind.
 */
export function DeckTabBar({ active }: { active: DeckTab }) {
  const translate = useTranslate();
  return (
    <View style={styles.bar}>
      {tabs.map((tab) => {
        const selected = tab.key === active;
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityLabel={translate(tab.labelKey)}
            accessibilityHint={translate(tab.hintKey)}
            accessibilityState={{ selected }}
            key={tab.key}
            onPress={() => {
              if (!selected) router.navigate(tab.route);
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
    </View>
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
