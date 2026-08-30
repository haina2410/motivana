import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { resolveAppliedQuoteId } from '../src/features/quotes/appliedQuote';
import { rotationSchedulePlan } from '../src/features/rotation/schedule';
import { useUpdateLog } from '../src/services/updateStatus';
import { configureRotation } from '../src/services/wallpaperNative';
import { setRotationSynchronizer } from '../src/store/automationSynchronization';
import { useAppStore } from '../src/store/useAppStore';
import { colors } from '../src/theme/colors';
import { useAppFonts } from '../src/theme/useAppFonts';

setRotationSynchronizer(async (state) =>
  configureRotation({
    enabled: state.rotationEnabled,
    ...rotationSchedulePlan(state.rotationSchedule),
    target: state.wallpaperTarget,
    selectedPresetId: state.selectedPresetId,
    randomizePreset: state.randomizePreset,
    favoriteQuoteIds: state.favoriteQuoteIds,
    favoriteQuotesOnly: state.favoriteQuotesOnly,
    contentLocale: state.contentLocale,
  }),
);

export default function RootLayout() {
  const fontsReady = useAppFonts();
  // Prints which bundle this launch is running, then each result of the check
  // expo-updates makes against the manifest endpoint. Read it with
  // `adb logcat -s ReactNativeJS`.
  useUpdateLog();
  // One time per launch, so the deck opens on the wallpaper the reader is
  // looking at. Running this on the home screen instead would undo their next
  // choice every time they came back to the deck.
  useEffect(() => {
    let active = true;
    const state = useAppStore.getState();
    resolveAppliedQuoteId({
      contentLocale: state.contentLocale,
      lastAppliedQuoteId: state.lastAppliedQuoteId,
    })
      .then((quoteId) => {
        if (active && quoteId) useAppStore.getState().selectQuote(quoteId);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
  // Rendering the tree before the chrome faces resolve would flash the system
  // font at every label, so the ink background holds for one frame instead.
  if (!fontsReady) return null;
  return (
    // The deck's vertical pan gesture needs a gesture-handler root somewhere
    // above it in the tree; the app root is the one place that's guaranteed.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          // The supporting screens slide in from the side of the deck. On iOS
          // `default` already is that slide, with the edge swipe and the
          // parallax of the screen below; `slide_from_right` would fall back to
          // it anyway, so name it and keep the platform behaviour.
          animation: Platform.select({
            ios: 'default',
            android: 'slide_from_right',
          } as const),
        }}
      />
    </GestureHandlerRootView>
  );
}
