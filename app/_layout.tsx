import { Stack } from 'expo-router';

import { configureRotation } from '../src/services/wallpaperNative';
import { setRotationSynchronizer } from '../src/store/automationSynchronization';

setRotationSynchronizer(async (state) =>
  configureRotation({
    enabled: state.rotationEnabled,
    intervalHours: state.rotationIntervalHours,
    target: state.wallpaperTarget,
    selectedPresetId: state.selectedPresetId,
    randomizePreset: state.randomizePreset,
    favoriteQuoteIds: state.favoriteQuoteIds,
    favoriteQuotesOnly: state.favoriteQuotesOnly,
  }),
);

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
