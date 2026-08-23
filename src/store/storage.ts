import { createMMKV } from 'react-native-mmkv';

export interface KeyValueStorage {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export const APP_STATE_STORAGE_KEY = 'motivana.app-state';

export const appStorage: KeyValueStorage = createMMKV({
  id: 'motivana.preferences',
});
