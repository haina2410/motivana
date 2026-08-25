import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { configureRotation } from '../src/services/wallpaperNative';
import { setRotationSynchronizer } from '../src/store/automationSynchronization';
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
