import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  md5Hex,
  sha256Base64Url,
  sha256Hex,
  sha256HexToUuid,
} from '../ota/hash.mjs';
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
}

// What `npx expo config --json --type public` prints: the public Expo config
// as a single JSON object. `expo export` writes no such file, so the publish
// script reads it from the CLI and threads it in here.
const expoConfig = { name: 'Motivana', slug: 'motivana' };

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
    // Known-digest oracle, independent of the implementation: derived with
    // `printf 'BUNDLE' | openssl dgst -sha256 -binary | base64` and then the
    // trailing `=` padding stripped (this digest has no `+`/`/` to translate).
    expect(hash).toBe('TtmqRvu8myeNrBqjUHdH3N02GDLOmpfwfstBLQpgHFg');
  });

  it('encodes md5 as hex', () => {
    expect(md5Hex(Buffer.from('BUNDLE'))).toMatch(/^[0-9a-f]{32}$/);
    // Known-digest oracle: `printf 'BUNDLE' | openssl dgst -md5`.
    expect(md5Hex(Buffer.from('BUNDLE'))).toBe(
      'd552d087dbb294cf488590937d70d0f6',
    );
  });

  it('encodes sha256 as hex', () => {
    // Known-digest oracle: `printf 'BUNDLE' | openssl dgst -sha256`.
    expect(sha256Hex(Buffer.from('BUNDLE'))).toBe(
      '4ed9aa46fbbc9b278dac1aa3507747dcdd361832ce9a97f07ecb412d0a601c58',
    );
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
      expoConfig,
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
      expoConfig,
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
      expoConfig,
    });
    const second = buildManifest({
      distDirectory,
      platform: 'android',
      runtimeVersion: 'fingerprint-1',
      assetBaseUrl: 'https://ota.test/assets',
      expoConfig,
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
      expoConfig,
    });

    expect(manifest.extra.expoClient.slug).toBe('motivana');
  });

  it('lists every file to upload, the bundle included', () => {
    const { files } = buildManifest({
      distDirectory,
      platform: 'android',
      runtimeVersion: 'fingerprint-1',
      assetBaseUrl: 'https://ota.test/assets',
      expoConfig,
    });

    expect(files).toHaveLength(2);
    expect(files.map((file) => file.contentType).sort()).toEqual([
      'application/javascript',
      'font/ttf',
    ]);
  });

  it('explains what to pass when the expo config is absent', () => {
    expect(() =>
      buildManifest({
        distDirectory,
        platform: 'android',
        runtimeVersion: 'fingerprint-1',
        assetBaseUrl: 'https://ota.test/assets',
      }),
    ).toThrow(/expo config --json --type public/);
  });

  it('rejects an expo config that is not an object', () => {
    for (const bad of ['{"slug":"motivana"}', 42, [{ slug: 'motivana' }]]) {
      expect(() =>
        buildManifest({
          distDirectory,
          platform: 'android',
          runtimeVersion: 'fingerprint-1',
          assetBaseUrl: 'https://ota.test/assets',
          expoConfig: bad,
        }),
      ).toThrow(/expoConfig/);
    }
  });

  it('stamps createdAt with publish time, not the metadata mtime', () => {
    // A stale dist/metadata.json mtime would make expo-updates drop the
    // publish: it takes only a strictly newer commitTime.
    const staleTime = new Date('2001-01-01T00:00:00.000Z');
    utimesSync(join(distDirectory, 'metadata.json'), staleTime, staleTime);
    const before = Date.now();

    const { manifest } = buildManifest({
      distDirectory,
      platform: 'android',
      runtimeVersion: 'fingerprint-1',
      assetBaseUrl: 'https://ota.test/assets',
      expoConfig,
    });

    expect(Date.parse(manifest.createdAt)).toBeGreaterThanOrEqual(
      before - 1000,
    );
    expect(manifest.createdAt).not.toBe(staleTime.toISOString());
  });

  it('honours an injected createdAt so a publish stays reproducible', () => {
    const { manifest } = buildManifest({
      distDirectory,
      platform: 'android',
      runtimeVersion: 'fingerprint-1',
      assetBaseUrl: 'https://ota.test/assets',
      expoConfig,
      createdAt: '2026-08-26T12:00:00.000Z',
    });

    expect(manifest.createdAt).toBe('2026-08-26T12:00:00.000Z');
  });

  it('rejects a platform that the export does not contain', () => {
    expect(() =>
      buildManifest({
        distDirectory,
        platform: 'ios',
        runtimeVersion: 'fingerprint-1',
        assetBaseUrl: 'https://ota.test/assets',
        expoConfig,
      }),
    ).toThrow(/ios/);
  });
});
