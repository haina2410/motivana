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
