import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { md5Hex, sha256Base64Url, sha256HexToUuid } from '../ota/hash.mjs';
import { buildManifest } from '../ota/manifest.mjs';

let distDirectory: string;

// A minimal `expo export` output: one Hermes bundle and one asset, described
// by metadata.json exactly as the real export describes them.
function writeFixtureExport(directory: string) {
  mkdirSync(join(directory, '_expo/static/js/android'), { recursive: true });
  mkdirSync(join(directory, 'assets'), { recursive: true });
  writeFileSync(join(directory, '_expo/static/js/android/index.hbc'), 'BUNDLE');
  writeFileSync(join(directory, 'assets/abc123'), 'FONTDATA');
  writeFileSync(
    join(directory, 'metadata.json'),
    JSON.stringify({
      version: 0,
      bundler: 'metro',
      fileMetadata: {
        android: {
          bundle: '_expo/static/js/android/index.hbc',
          assets: [{ path: 'assets/abc123', ext: 'ttf' }],
        },
      },
    }),
  );
  writeFileSync(
    join(directory, 'expoConfig.json'),
    JSON.stringify({ name: 'Motivana', slug: 'motivana' }),
  );
}

beforeEach(() => {
  distDirectory = mkdtempSync(join(tmpdir(), 'ota-dist-'));
  writeFixtureExport(distDirectory);
});

afterEach(() => {
  rmSync(distDirectory, { recursive: true, force: true });
});

describe('hash', () => {
  it('encodes sha256 as unpadded base64url', () => {
    const hash = sha256Base64Url(Buffer.from('BUNDLE'));
    expect(hash).not.toMatch(/[+/=]/);
    expect(hash).toHaveLength(43);
  });

  it('encodes md5 as hex', () => {
    expect(md5Hex(Buffer.from('BUNDLE'))).toMatch(/^[0-9a-f]{32}$/);
  });

  it('converts a sha256 hex digest into a uuid', () => {
    const uuid = sha256HexToUuid(
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    );
    expect(uuid).toBe('01234567-89ab-cdef-0123-456789abcdef');
  });
});

describe('buildManifest', () => {
  it('describes the launch asset as javascript with a .bundle extension', () => {
    const { manifest } = buildManifest({
      distDirectory,
      platform: 'android',
      runtimeVersion: 'fingerprint-1',
      assetBaseUrl: 'https://ota.test/assets',
    });

    expect(manifest.launchAsset.contentType).toBe('application/javascript');
    expect(manifest.launchAsset.fileExtension).toBe('.bundle');
    expect(manifest.launchAsset.hash).toBe(
      sha256Base64Url(Buffer.from('BUNDLE')),
    );
    expect(manifest.launchAsset.key).toBe(md5Hex(Buffer.from('BUNDLE')));
    expect(manifest.launchAsset.url).toBe(
      `https://ota.test/assets/${sha256Base64Url(Buffer.from('BUNDLE'))}`,
    );
  });

  it('describes each asset with its own extension and mime type', () => {
    const { manifest } = buildManifest({
      distDirectory,
      platform: 'android',
      runtimeVersion: 'fingerprint-1',
      assetBaseUrl: 'https://ota.test/assets',
    });

    expect(manifest.assets).toHaveLength(1);
    expect(manifest.assets[0].fileExtension).toBe('.ttf');
    expect(manifest.assets[0].contentType).toBe('font/ttf');
  });

  it('derives a stable uuid id from metadata.json', () => {
    const first = buildManifest({
      distDirectory,
      platform: 'android',
      runtimeVersion: 'fingerprint-1',
      assetBaseUrl: 'https://ota.test/assets',
    });
    const second = buildManifest({
      distDirectory,
      platform: 'android',
      runtimeVersion: 'fingerprint-1',
      assetBaseUrl: 'https://ota.test/assets',
    });

    expect(first.manifest.id).toBe(second.manifest.id);
    expect(first.manifest.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('carries the expo config so Expo modules can read it', () => {
    const { manifest } = buildManifest({
      distDirectory,
      platform: 'android',
      runtimeVersion: 'fingerprint-1',
      assetBaseUrl: 'https://ota.test/assets',
    });

    expect(manifest.extra.expoClient.slug).toBe('motivana');
  });

  it('lists every file to upload, the bundle included', () => {
    const { files } = buildManifest({
      distDirectory,
      platform: 'android',
      runtimeVersion: 'fingerprint-1',
      assetBaseUrl: 'https://ota.test/assets',
    });

    expect(files).toHaveLength(2);
    expect(files.map((file) => file.contentType).sort()).toEqual([
      'application/javascript',
      'font/ttf',
    ]);
  });

  it('rejects a platform that the export does not contain', () => {
    expect(() =>
      buildManifest({
        distDirectory,
        platform: 'ios',
        runtimeVersion: 'fingerprint-1',
        assetBaseUrl: 'https://ota.test/assets',
      }),
    ).toThrow(/ios/);
  });
});
