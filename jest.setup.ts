// react-native-gesture-handler and react-native-reanimated both drive native
// code the JS test runner does not have; each ships its own Jest shims for
// exactly this reason.
import 'react-native-gesture-handler/jestSetup';

// jest-expo resolves `.native.ts` files ahead of plain `.ts` (it tests the
// native behaviour of the app), but react-native-worklets only guards its
// jest fallback in the plain file. That makes reanimated's own mock reach the
// real native module and crash on `loadUnpackers`, so mock worklets directly.
jest.mock('react-native-worklets', () =>
  require('react-native-worklets/src/mock'),
);
jest.mock('react-native-reanimated', () =>
  require('react-native-reanimated/mock'),
);

const mockMmkvValues = new Map<string, string>();

jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getString: (key: string) => mockMmkvValues.get(key),
    set: (key: string, value: string) => mockMmkvValues.set(key, value),
    remove: (key: string) => mockMmkvValues.delete(key),
    clearAll: () => mockMmkvValues.clear(),
  }),
}));
jest.mock('react-native-nitro-modules', () => ({ NitroModules: {} }));
jest.mock('expo-file-system', () => ({
  Paths: { cache: { uri: 'file:///data/user/0/org.haina2410.motivana/cache' } },
}));
jest.mock('expo-media-library', () => ({
  requestPermissionsAsync: jest.fn(),
  Asset: { create: jest.fn() },
}));
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn(), navigate: jest.fn() },
}));
// The icon set ships its own font, which Jest cannot resolve as a binary asset.
jest.mock('@expo/vector-icons/FontAwesome6', () => 'FontAwesome6');
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
// jest-expo leaves expoConfig null, so a screen reading it cannot be told from
// one reading nothing at all. On a device this object is the manifest the app
// launched with, which is app.json for a store build and the update's own copy
// after an over-the-air update.
jest.mock('expo-constants', () => ({
  // Without this flag Babel's interop hands back the module object itself, so
  // `Constants.expoConfig` reads undefined and the mock looks like it works.
  __esModule: true,
  default: { expoConfig: require('./app.json').expo },
}));
// The full-bleed Home reads the insets directly, and the hook throws without a
// provider. The library ships this mock for exactly that: fixed insets and a
// pass-through provider.
jest.mock('react-native-safe-area-context', () => {
  const mock: unknown = require('react-native-safe-area-context/jest/mock');
  return (mock as { default: unknown }).default;
});
