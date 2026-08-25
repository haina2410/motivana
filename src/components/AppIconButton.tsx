import {
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors } from '../theme/colors';
import { Icon, type IconName } from './Icon';

interface AppIconButtonProps {
  icon: IconName;
  label: string;
  hint: string;
  onPress: () => void;
  disabled?: boolean;
  /** `circle` is the header control from the board; `plain` drops the ring. */
  variant?: 'circle' | 'plain';
  tone?: 'default' | 'accent';
  style?: StyleProp<ViewStyle>;
}

export function AppIconButton({
  icon,
  label,
  hint,
  onPress,
  disabled = false,
  variant = 'circle',
  tone = 'default',
  style,
}: AppIconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      // The ring is 36pt, but the touch target stays at the 44pt minimum.
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'circle' && styles.circle,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      <Icon
        name={icon}
        size={15}
        color={tone === 'accent' ? colors.accent : colors.text}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
    minWidth: 36,
  },
  circle: {
    borderColor: colors.border,
    borderRadius: 9999,
    borderWidth: 1,
    height: 36,
    width: 36,
  },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.6 },
});
