import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import {
  md5Hex,
  sha256Base64Url,
  sha256Hex,
  sha256HexToUuid,
} from './hash.mjs';

// The export writes no mime types, so the extension decides. Only the types
// that Motivana actually ships are listed. An unknown extension is a signal
// that the asset pipeline changed, so it fails loudly.
const contentTypesByExtension = {
  ttf: 'font/ttf',
  otf: 'font/otf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  json: 'application/json',
};

function contentTypeForExtension(extension) {
  const contentType = contentTypesByExtension[extension.toLowerCase()];
  if (!contentType) {
    throw new Error(
      `Unknown asset extension ".${extension}". Add it to contentTypesByExtension in scripts/ota/manifest.mjs.`,
    );
  }
  return contentType;
}

function describeFile({ distDirectory, filePath, extension, assetBaseUrl }) {
  const absolutePath = resolve(join(distDirectory, filePath));
  const contents = readFileSync(absolutePath);
  const hash = sha256Base64Url(contents);
  const isLaunchAsset = extension === null;

  return {
    asset: {
      hash,
      key: md5Hex(contents),
      fileExtension: isLaunchAsset ? '.bundle' : `.${extension}`,
      contentType: isLaunchAsset
        ? 'application/javascript'
        : contentTypeForExtension(extension),
      url: `${assetBaseUrl}/${hash}`,
    },
    file: {
      hash,
      absolutePath,
      contentType: isLaunchAsset
        ? 'application/javascript'
        : contentTypeForExtension(extension),
    },
  };
}

// `buildManifest` stays a pure function over a directory: it runs no command.
// The public Expo config cannot be read from the export, because
// `npx expo export` writes no expoConfig.json on SDK 57 -- only
// metadata.json, an optional assetmap.json, `_expo/` and `assets/`. The
// caller reads it with `npx expo config --json --type public`, which is what
// `Constants.expoConfig` resolves to after an over-the-air launch, and threads
// it in here.
/**
 * @param {{
 *   distDirectory: string,
 *   platform: string,
 *   runtimeVersion: string,
 *   assetBaseUrl: string,
 *   expoConfig?: any,
 *   createdAt?: string,
 * }} options
 */
export function buildManifest({
  distDirectory,
  platform,
  runtimeVersion,
  assetBaseUrl,
  expoConfig,
  createdAt,
}) {
  if (
    !expoConfig ||
    typeof expoConfig !== 'object' ||
    Array.isArray(expoConfig)
  ) {
    throw new Error(
      'buildManifest needs the public Expo config object. Read it with `npx expo config --json --type public` and pass it as expoConfig.',
    );
  }
  const metadataPath = resolve(join(distDirectory, 'metadata.json'));
  const metadataContents = readFileSync(metadataPath);
  const metadata = JSON.parse(metadataContents.toString('utf8'));

  const platformMetadata = metadata.fileMetadata?.[platform];
  if (!platformMetadata) {
    throw new Error(
      `The export at ${distDirectory} contains no ${platform} bundle. Run expo export for ${platform}.`,
    );
  }

  const launch = describeFile({
    distDirectory,
    filePath: platformMetadata.bundle,
    extension: null,
    assetBaseUrl,
  });
  const assets = platformMetadata.assets.map((asset) =>
    describeFile({
      distDirectory,
      filePath: asset.path,
      extension: asset.ext,
      assetBaseUrl,
    }),
  );

  const manifest = {
    id: sha256HexToUuid(sha256Hex(metadataContents)),
    // Publish wall-clock time, never a file mtime. expo-updates orders
    // updates by commitTime and takes only a strictly newer one, so a stale
    // dist/metadata.json mtime would make every device silently ignore the
    // publish.
    createdAt: createdAt ?? new Date().toISOString(),
    runtimeVersion,
    launchAsset: launch.asset,
    assets: assets.map((entry) => entry.asset),
    metadata: {},
    extra: { expoClient: expoConfig },
  };

  return {
    manifest,
    files: [launch.file, ...assets.map((entry) => entry.file)],
  };
}
