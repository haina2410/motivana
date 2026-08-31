import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const script = join(process.cwd(), 'scripts/verify-android-permissions.mjs');

function withManifest(body: string, assert: (path: string) => void) {
  const directory = mkdtempSync(join(tmpdir(), 'motivana-permission-test-'));
  const manifest = join(directory, 'AndroidManifest.xml');
  writeFileSync(manifest, `<manifest>${body}</manifest>`);
  try {
    assert(manifest);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

const wallpaper =
  '<uses-permission android:name="android.permission.SET_WALLPAPER" />';
const minSdk = '<uses-sdk android:minSdkVersion="24" />';

test('accepts a merged manifest with only the wallpaper permission', () => {
  withManifest(`${minSdk}${wallpaper}`, (manifest) => {
    expect(() => execFileSync('node', [script, manifest])).not.toThrow();
  });
});

// Below API 30 expo-media-library's legacy factory demands this permission to
// save the exported PNG, so it is allowed to appear. It is a write permission
// and Android caps it at API 32, unlike READ_MEDIA_IMAGES below.
test('accepts the write-storage permission the legacy save path needs', () => {
  const write =
    '<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="32" />';
  withManifest(`${minSdk}${wallpaper}${write}`, (manifest) => {
    expect(() => execFileSync('node', [script, manifest])).not.toThrow();
  });
});

test('fails when the merged manifest still reads the image library', () => {
  const readImages =
    '<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />';
  withManifest(`${minSdk}${wallpaper}${readImages}`, (manifest) => {
    expect(() => execFileSync('node', [script, manifest])).toThrow(
      'Forbidden permission present: android.permission.READ_MEDIA_IMAGES',
    );
  });
});

test('fails when the wallpaper permission is missing from a merged manifest', () => {
  withManifest(minSdk, (manifest) => {
    expect(() => execFileSync('node', [script, manifest])).toThrow(
      'Missing required permission: android.permission.SET_WALLPAPER',
    );
  });
});

test('fails when the merged manifest does not pin the minimum SDK', () => {
  withManifest(
    `<uses-sdk android:minSdkVersion="21" />${wallpaper}`,
    (manifest) => {
      expect(() => execFileSync('node', [script, manifest])).toThrow(
        'Merged manifest does not declare minSdkVersion 24',
      );
    },
  );
});
