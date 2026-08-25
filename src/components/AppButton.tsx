import {
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { Icon, type IconName } from './Icon';

interface AppButtonProps {
  label: string;
  onPress: () => void;
  /** `primary` is the amber bar; `outline` is the paired Save / Restyle row. */
  variant?: 'primary' | 'outline';
  shape?: 'rounded' | 'pill';
  icon?: IconName;
  iconColor?: string;
  hint?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function AppButton({
  label,
  onPress,
  variant = 'primary',
  shape = 'rounded',
  icon,
  iconColor,
  hint,
  disabled = false,
  style,
}: AppButtonProps) {
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        primary ? styles.primary : styles.outline,
        shape === 'pill' && styles.pill,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      {icon ? (
        <Icon
          name={icon}
          size={13}
          color={iconColor ?? (primary ? colors.onAccent : colors.text)}
        />
      ) : null}
      <Text
        allowFontScaling
        style={primary ? typography.primaryButton : typography.button}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: 10,
    flexDirection: 'row',
    gap: spacing.x1,
    justifyContent: 'center',
    minHeight: spacing.control,
    paddingHorizontal: spacing.x2,
  },
  primary: { backgroundColor: colors.accent },
  outline: { borderColor: colors.borderStrong, borderWidth: 1 },
  pill: { borderRadius: spacing.pill },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.76 },
});
