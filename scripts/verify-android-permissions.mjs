import { readFileSync } from 'node:fs';

const required = ['android.permission.SET_WALLPAPER'];
const forbidden = [
  'android.permission.READ_MEDIA_VIDEO',
  'android.permission.READ_MEDIA_AUDIO',
  'android.permission.READ_MEDIA_VISUAL_USER_SELECTED',
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.WRITE_EXTERNAL_STORAGE',
];
const config = JSON.parse(
  readFileSync(new URL('../app.json', import.meta.url)),
);
const expo = config.expo;
const mediaPlugin = expo.plugins.find(
  (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-media-library',
);
if (
  !mediaPlugin ||
  mediaPlugin[1]?.granularPermissions?.join(',') !== 'photo'
) {
  throw new Error('expo-media-library must request only photo permission.');
}
for (const permission of forbidden) {
  if (!expo.android.blockedPermissions.includes(permission)) {
    throw new Error(`Missing blocked permission: ${permission}`);
  }
}
if (process.argv[2]) {
  const manifest = readFileSync(process.argv[2], 'utf8');
  for (const permission of required) {
    if (!manifest.includes(permission))
      throw new Error(`Missing required permission: ${permission}`);
  }
  for (const permission of forbidden) {
    if (manifest.includes(permission))
      throw new Error(`Forbidden permission present: ${permission}`);
  }
}
console.log('Android permission scope verified.');
