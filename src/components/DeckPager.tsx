import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

interface DeckPagerProps {
  children: ReactNode;
  previous?: ReactNode;
  next?: ReactNode;
  onNext: () => void;
  onPrevious: () => void;
  nextLabel: string;
  nextHint: string;
  previousLabel: string;
  previousHint: string;
}

/** A drag past this fraction of the height commits to the neighbour. */
const COMMIT_RATIO = 0.22;

/**
 * The deck moves like a short-video feed: the neighbouring wallpaper is on
 * screen during the drag, not swapped in on release. Both neighbours stay
 * mounted, which is affordable only because a wallpaper is a recorded picture
 * rather than an encoded bitmap.
 */
export function DeckPager({
  children,
  previous,
  next,
  onNext,
  onPrevious,
  nextLabel,
  nextHint,
  previousLabel,
  previousHint,
}: DeckPagerProps) {
  const offset = useSharedValue(0);
  const height = useSharedValue(0);
  const pan = Gesture.Pan()
    .onChange((event) => {
      offset.value += event.changeY;
    })
    .onEnd(() => {
      const threshold = height.value * COMMIT_RATIO;
      if (offset.value < -threshold) runOnJS(onNext)();
      else if (offset.value > threshold) runOnJS(onPrevious)();
      offset.value = withTiming(0, { duration: 180 });
    });
  const stack = useAnimatedStyle(() => ({
    transform: [{ translateY: offset.value }],
  }));
  // The neighbours sit exactly one viewport away, so the drag offset maps
  // one-to-one onto the card being pulled into view.
  const above = useAnimatedStyle(() => ({ top: -height.value }));
  const below = useAnimatedStyle(() => ({ top: height.value }));
  return (
    <GestureDetector gesture={pan}>
      <View
        accessible
        accessibilityLabel={nextLabel}
        // One accessible element carries both directions, so it gets one
        // hint slot for the two sentences. accessibilityValue is for
        // adjustable ranges and would announce the second hint oddly.
        accessibilityHint={`${nextHint} ${previousHint}`}
        accessibilityActions={[
          { name: 'activate', label: nextLabel },
          { name: 'previous', label: previousLabel },
        ]}
        onAccessibilityAction={(event) => {
          // Named explicitly, both of them: VoiceOver sends escape and
          // magic-tap through this same handler, and a catch-all else would
          // move the reader forward on either one.
          if (event.nativeEvent.actionName === 'previous') onPrevious();
          else if (event.nativeEvent.actionName === 'activate') onNext();
        }}
        onLayout={(event) => {
          // Reanimated shared values are mutable by design; the React
          // Compiler lint rule does not know that convention.
          // eslint-disable-next-line react-hooks/immutability
          height.value = event.nativeEvent.layout.height;
        }}
        style={styles.viewport}
      >
        <Animated.View style={[styles.stack, stack]}>
          <Animated.View style={[styles.neighbour, above]}>
            {previous}
          </Animated.View>
          <View style={styles.card}>{children}</View>
          <Animated.View style={[styles.neighbour, below]}>
            {next}
          </Animated.View>
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  viewport: { flex: 1, overflow: 'hidden' },
  stack: { flex: 1 },
  card: StyleSheet.absoluteFill,
  // One viewport tall, stated as a height rather than left to absoluteFill's
  // bottom: 0. Yoga stretches an absolutely-positioned box between its defined
  // edges, so `bottom: 0` under the animated `top: -height` would make the box
  // two viewports tall; the card inside it would then fit on the width ratio
  // where the live card fits on the height ratio, and render about 9% larger.
  neighbour: { height: '100%', left: 0, position: 'absolute', right: 0 },
});
