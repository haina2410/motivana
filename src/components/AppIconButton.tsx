import {
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

interface AppIconButtonProps {
  symbol: string;
  label: string;
  hint: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function AppIconButton({
  symbol,
  label,
  hint,
  onPress,
  disabled = false,
  style,
}: AppIconButtonProps) {
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
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      <Text allowFontScaling style={styles.symbol}>
        {symbol}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderRadius: spacing.radius,
    justifyContent: 'center',
    minHeight: spacing.control,
    minWidth: spacing.control,
  },
  disabled: { opacity: 0.48 },
  pressed: { opacity: 0.76 },
  symbol: { color: colors.text, fontSize: 20, fontWeight: '700' },
});
