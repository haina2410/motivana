import { requireNativeModule } from 'expo-modules-core';

import type { MotivanaWallpaperNativeContract } from './MotivanaWallpaper.types';

export default requireNativeModule<MotivanaWallpaperNativeContract>(
  'MotivanaWallpaper',
);
