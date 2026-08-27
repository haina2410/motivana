import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { resolveAppliedQuoteId } from '../src/features/quotes/appliedQuote';
import { useUpdateLog } from '../src/services/updateStatus';
import { configureRotation } from '../src/services/wallpaperNative';
import { setRotationSynchronizer } from '../src/store/automationSynchronization';
import { useAppStore } from '../src/store/useAppStore';
import { colors } from '../src/theme/colors';
import { useAppFonts } from '../src/theme/useAppFonts';

setRotationSynchronizer(async (state) =>
  configureRotation({
    enabled: state.rotationEnabled,
    intervalHours: state.rotationIntervalHours,
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
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          // The board's supporting screens rise over the deck.
          animation: 'fade',
        }}
      />
    </>
  );
}
