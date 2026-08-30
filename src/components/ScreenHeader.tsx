import { router } from 'expo-router';
import { type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTranslate } from '../features/i18n/useTranslate';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { AppIconButton } from './AppIconButton';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  /** Trailing controls. */
  actions?: ReactNode;
  /**
   * Draws the back chevron. A tab root leaves this off: it has nothing behind
   * it to go back to, and the board draws no arrow on any of the four.
   */
  back?: boolean;
}

export function ScreenHeader({
  title,
  subtitle,
  actions,
  back,
}: ScreenHeaderProps) {
  const translate = useTranslate();
  return (
    <View style={styles.header}>
      <View style={styles.copy}>
        <Text allowFontScaling style={typography.screenTitle}>
          {title}
        </Text>
        {subtitle ? (
          <Text allowFontScaling style={styles.subtitle}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {actions}
      {back ? (
        <AppIconButton
          icon="chevron-left"
          label={translate('common.back.label')}
          hint={translate('common.back.hint')}
          onPress={() => router.back()}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.x2,
    justifyContent: 'space-between',
  },
  copy: { flex: 1, gap: 4 },
  subtitle: { ...typography.caption, fontSize: 12 },
});
