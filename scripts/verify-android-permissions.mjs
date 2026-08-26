import { existsSync, readFileSync } from 'node:fs';

// The app only writes one rendered PNG to the gallery. On Android 11+ that write
// goes through a plain MediaStore insert, which needs no runtime permission, so
// the app declares no media permission at all.
const required = ['android.permission.SET_WALLPAPER'];
const forbidden = [
  'android.permission.READ_MEDIA_IMAGES',
  'android.permission.READ_MEDIA_VIDEO',
  'android.permission.READ_MEDIA_AUDIO',
  'android.permission.READ_MEDIA_VISUAL_USER_SELECTED',
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.WRITE_EXTERNAL_STORAGE',
  'android.permission.VIBRATE',
];
// A permission-free gallery write needs the modern MediaStore path, which
// expo-media-library selects only from this API level up.
const minSdkVersion = 30;
const config = JSON.parse(
  readFileSync(
    process.env.MOTIVANA_CONFIG_PATH ?? new URL('../app.json', import.meta.url),
  ),
);
const expo = config.expo;
if (
  expo.plugins.some(
    (plugin) =>
      plugin === 'expo-media-library' ||
      (Array.isArray(plugin) && plugin[0] === 'expo-media-library'),
  )
) {
  throw new Error(
    'The expo-media-library config plugin re-adds the READ_MEDIA_* permissions. Leave it out.',
  );
}
const buildPropertiesPlugin = expo.plugins.find(
  (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-build-properties',
);
if (buildPropertiesPlugin?.[1]?.android?.minSdkVersion !== minSdkVersion) {
  throw new Error(
    `expo-build-properties must pin android.minSdkVersion to ${minSdkVersion}.`,
  );
}
for (const permission of required) {
  if (!expo.android.permissions.includes(permission)) {
    throw new Error(`Missing required config permission: ${permission}`);
  }
}
for (const permission of forbidden) {
  if (!expo.android.blockedPermissions.includes(permission)) {
    throw new Error(`Missing blocked permission: ${permission}`);
  }
}
// Release is what ships, so check it first; debug is the fallback because the
// emulator smoke run builds only that variant.
const generatedManifests = ['release', 'debug'].map(
  (variant) =>
    new URL(
      `../android/app/build/intermediates/merged_manifests/${variant}/process${variant.replace(/^./, (letter) => letter.toUpperCase())}Manifest/AndroidManifest.xml`,
      import.meta.url,
    ),
);
const manifestPath =
  process.argv[2] ?? generatedManifests.find((url) => existsSync(url));
if (manifestPath) {
  const manifest = readFileSync(manifestPath, 'utf8');
  for (const permission of required) {
    if (!manifest.includes(permission))
      throw new Error(`Missing required permission: ${permission}`);
  }
  for (const permission of forbidden) {
    if (manifest.includes(permission))
      throw new Error(`Forbidden permission present: ${permission}`);
  }
  if (!manifest.includes(`android:minSdkVersion="${minSdkVersion}"`)) {
    throw new Error(
      `Merged manifest does not declare minSdkVersion ${minSdkVersion}.`,
    );
  }
}
console.log('Android permission scope verified.');
