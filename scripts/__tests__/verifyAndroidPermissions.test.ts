import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const script = join(process.cwd(), 'scripts/verify-android-permissions.mjs');

test('fails when the required image permission is missing from a merged manifest', () => {
  const directory = mkdtempSync(join(tmpdir(), 'motivana-permission-test-'));
  const manifest = join(directory, 'AndroidManifest.xml');
  writeFileSync(
    manifest,
    '<manifest><uses-permission android:name="android.permission.SET_WALLPAPER" /></manifest>',
  );
  try {
    expect(() => execFileSync('node', [script, manifest])).toThrow(
      'Missing required permission: android.permission.READ_MEDIA_IMAGES',
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
