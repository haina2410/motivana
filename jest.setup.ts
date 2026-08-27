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
