import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type WithSpringConfig,
} from 'react-native-reanimated';

import { commitDirection, resistDrag } from './deckGesture';

interface DeckPagerProps {
  children: ReactNode;
  previous?: ReactNode;
  next?: ReactNode;
  /**
   * Identity of the card on screen. It changing is how the pager learns the
   * commit landed, so it can re-anchor the stack in the same React commit
   * that swaps the content.
   */
  contentKey: string;
  /** Resolves false when the deck refused to move, so the card comes back. */
  onNext: () => Promise<boolean>;
  onPrevious: () => Promise<boolean>;
  nextLabel: string;
  nextHint: string;
  previousLabel: string;
  previousHint: string;
}

/**
 * A card settles on its neighbour rather than bouncing off it, so the spring
 * is clamped: an overshoot past the target would show a sliver of the card
 * beyond the one the reader asked for.
 */
const SETTLE: WithSpringConfig = {
  damping: 26,
  mass: 0.85,
  overshootClamping: true,
  stiffness: 280,
};

/**
 * The deck moves like a short-video feed: the neighbouring wallpaper is on
 * screen during the drag, not swapped in on release. Both neighbours stay
 * mounted, which is affordable only because a wallpaper is a recorded picture
 * rather than an encoded bitmap.
 *
 * A commit travels a full viewport before the content changes. Springing back
 * to 0 and swapping at the same instant -- which is what this did -- teleports
 * the card under the finger by a whole screen before the animation even
 * starts, and no amount of easing hides that.
 */
export function DeckPager({
  children,
  previous,
  next,
  contentKey,
  onNext,
  onPrevious,
  nextLabel,
  nextHint,
  previousLabel,
  previousHint,
}: DeckPagerProps) {
  const offset = useSharedValue(0);
  const height = useSharedValue(0);
  const start = useSharedValue(0);
  // Raised while a committed card travels to the middle. The deck is between
  // two states then -- the stack has moved but the content has not -- and a
  // second gesture landing in that window would drag from a false origin.
  const settling = useSharedValue(false);
  // A missing neighbour means there is nothing recorded to swipe to: the very
  // start of the trail, or (briefly, before a pending pair has been rolled)
  // the very first swipe of a session.
  const hasNext = next !== undefined;
  const hasPrevious = previous !== undefined;
  // The card that just landed, and the content it landed on top of. Re-anchoring
  // the stack and swapping the trail cannot be made to happen in the same frame
  // -- one is a UI-thread write, the other a React commit -- so instead the
  // landed card is drawn in the middle slot as well, and both steps become
  // changes that move no pixels whenever they land.
  const [hold, setHold] = useState<{
    direction: 'next' | 'previous';
    key: string;
  }>();
  // Derived, never cleared by an effect: the hold has to end in the very render
  // that brings the new content, or that render draws the card past the one the
  // reader swiped to -- which is the flick this exists to remove.
  const holding = hold?.key === contentKey ? hold.direction : undefined;
  const committing = useRef(false);
  useLayoutEffect(() => {
    if (!holding || committing.current) return;
    committing.current = true;
    // Both slots draw the landed card now, so the stack can re-anchor without
    // changing a pixel. Only then is it safe to let the trail move.
    offset.value = 0;
    const move = holding === 'next' ? onNext : onPrevious;
    void move().then((moved) => {
      committing.current = false;
      // Refused. There is nothing to swap to, so the deck goes back to the
      // card it started on -- a jump, but it comes with an error of its own.
      if (!moved) {
        setHold(undefined);
        settling.value = false;
      }
    });
  }, [holding, offset, onNext, onPrevious, settling]);
  useLayoutEffect(() => {
    // The trail moved, so the hold is over and the deck takes gestures again.
    // Reanimated shared values are mutable by design; the React Compiler lint
    // rule does not know that convention.
    // eslint-disable-next-line react-hooks/immutability
    offset.value = 0;
    // eslint-disable-next-line react-hooks/immutability
    settling.value = false;
  }, [contentKey, offset, settling]);
  const pan = Gesture.Pan()
    // The deck is a vertical pager over a photograph. Without these it claims
    // the touch on the first pixel, so a tap wobble nudges the stack and a
    // horizontal drag fights whatever else wanted it.
    .activeOffsetY([-10, 10])
    .failOffsetX([-24, 24])
    .onBegin(() => {
      if (settling.value) return;
      start.value = offset.value;
    })
    .onUpdate((event) => {
      if (settling.value) return;
      // Read from the gesture's own translation rather than accumulated
      // per-frame deltas, so the resistance curve applies to the real travel
      // instead of compounding on itself.
      // Reanimated shared values are mutable by design; the React Compiler
      // lint rule does not know that convention.
      // eslint-disable-next-line react-hooks/immutability
      offset.value = resistDrag(
        start.value + event.translationY,
        hasNext,
        hasPrevious,
      );
    })
    .onEnd((event) => {
      if (settling.value) return;
      const direction = commitDirection(
        offset.value,
        event.velocityY,
        height.value,
        hasNext,
        hasPrevious,
      );
      if (direction === 'stay') {
        // eslint-disable-next-line react-hooks/immutability
        offset.value = withSpring(0, SETTLE);
        return;
      }
      // eslint-disable-next-line react-hooks/immutability
      settling.value = true;
      const target = direction === 'next' ? -height.value : height.value;
      offset.value = withSpring(target, SETTLE, (finished) => {
        // An interrupted spring never reached the neighbour, so nothing is
        // committed and the deck goes back to taking gestures.
        if (finished) runOnJS(setHold)({ direction, key: contentKey });
        else settling.value = false;
      });
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
          if (event.nativeEvent.actionName === 'previous') void onPrevious();
          else if (event.nativeEvent.actionName === 'activate') void onNext();
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
          <View style={styles.card}>
            {holding === 'next'
              ? next
              : holding === 'previous'
                ? previous
                : children}
          </View>
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
