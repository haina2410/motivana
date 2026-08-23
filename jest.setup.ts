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
  router: { back: jest.fn(), push: jest.fn() },
}));
