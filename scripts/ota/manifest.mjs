import { readFileSync, statSync } from 'node:fs';
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

export function buildManifest({
  distDirectory,
  platform,
  runtimeVersion,
  assetBaseUrl,
}) {
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

  const expoConfig = JSON.parse(
    readFileSync(resolve(join(distDirectory, 'expoConfig.json'))).toString(
      'utf8',
    ),
  );

  const manifest = {
    id: sha256HexToUuid(sha256Hex(metadataContents)),
    createdAt: statSync(metadataPath).mtime.toISOString(),
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
