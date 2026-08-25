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
  /** Trailing controls; a back chevron is drawn when none are supplied. */
  actions?: ReactNode;
}

export function ScreenHeader({ title, subtitle, actions }: ScreenHeaderProps) {
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
      {actions ?? (
        <AppIconButton
          icon="chevron-left"
          label={translate('common.back.label')}
          hint={translate('common.back.hint')}
          onPress={() => router.back()}
        />
      )}
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
