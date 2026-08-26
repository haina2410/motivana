import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { buildManifest } from './ota/manifest.mjs';
import { putPointer } from './ota/pointerClient.mjs';
import { uploadFile } from './ota/r2.mjs';
import {
  formatSignatureHeader,
  readKeyId,
  readPrivateKey,
  signBody,
} from './ota/sign.mjs';

// This module lives at <repositoryRoot>/scripts/ota-publish.mjs, so the
// repository root is always one directory above it, regardless of the
// caller's process.cwd(). The dirty-worktree guard and every path that must
// not depend on where the command was invoked from are pinned to this.
//
// Real Node ESM has no __dirname, so fileURLToPath(import.meta.url) is the
// normal way to get it. Under the Jest/Babel transform used to test this
// .mjs file, import.meta is not rewritten to a usable URL, but the
// CommonJS wrapper Babel emits does supply a correct __dirname for the
// original file. `typeof __dirname` is a safe check in both worlds: it
// never throws on an unbound identifier. The reference below is only
// reached under that Jest/CJS transform; real ESM never evaluates it.
const moduleDirectory =
  typeof __dirname !== 'undefined'
    ? // eslint-disable-next-line no-undef
      __dirname
    : dirname(fileURLToPath(import.meta.url));
export const repositoryRoot = resolve(moduleDirectory, '..');

export function runCommand(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', stdio: 'pipe' });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} exited with ${result.status}.\n${result.stderr ?? ''}`,
    );
  }
  return { stdout: result.stdout ?? '' };
}

export async function publish({ options, run, fetchImpl, log }) {
  // A dirty worktree makes the fingerprint impossible to match against a
  // released binary, so the update could reach a build it does not fit.
  // `-C repositoryRoot` pins these to the Motivana checkout itself, so the
  // guard cannot be fooled by running the command from inside some other
  // repository.
  const status = run('git', [
    '-C',
    repositoryRoot,
    'status',
    '--porcelain',
  ]).stdout.trim();
  if (status) {
    throw new Error(
      'The worktree has uncommitted changes. Commit them so the fingerprint matches a known build.',
    );
  }
  const gitSha = run('git', [
    '-C',
    repositoryRoot,
    'rev-parse',
    '--short',
    'HEAD',
  ]).stdout.trim();

  if (!options.skipExport) {
    log('Exporting the bundle');
    run('npx', [
      'expo',
      'export',
      '--platform',
      options.platform,
      '--output-dir',
      options.distDirectory,
    ]);
  }

  // The parse must match what the installed expo-updates CLI actually prints.
  // Confirm the shape against the CLI before trusting this line.
  const fingerprint = JSON.parse(
    run('npx', [
      'expo-updates',
      'fingerprint:generate',
      '--platform',
      options.platform,
    ]).stdout,
  ).hash;
  log(`Runtime version ${fingerprint} at commit ${gitSha}`);

  // `npx expo export` writes no expoConfig.json, so the public config comes
  // from the Expo CLI. This is exactly what Constants.expoConfig resolves to
  // after an over-the-air launch, so it is the correct content for
  // manifest.extra.expoClient. buildManifest stays command-free: the parsed
  // object is threaded in.
  const expoConfig = JSON.parse(
    run('npx', ['expo', 'config', '--json', '--type', 'public']).stdout,
  );

  const { manifest, files } = buildManifest({
    distDirectory: options.distDirectory,
    platform: options.platform,
    runtimeVersion: fingerprint,
    assetBaseUrl: `${options.workerUrl}/assets`,
    expoConfig,
  });

  // Upload first. A failure here throws, so the pointer is never written and
  // the live update keeps working.
  for (const file of files) {
    log(`Uploading ${file.hash}`);
    uploadFile({ bucket: options.bucket, ...file, run });
  }

  const body = JSON.stringify(manifest);
  const signature = formatSignatureHeader({
    signature: signBody(body, readPrivateKey()),
    keyid: readKeyId(options.appJsonPath),
  });
  const value = { kind: 'update', updateId: manifest.id, body, signature };

  if (options.archive) {
    await putPointer({
      workerUrl: options.workerUrl,
      token: options.token,
      key: `update:${manifest.id}`,
      value,
      fetchImpl,
    });
  }

  await putPointer({
    workerUrl: options.workerUrl,
    token: options.token,
    key: `pointer:${options.platform}:${fingerprint}`,
    value,
    fetchImpl,
  });

  log(`Published ${manifest.id} for ${options.platform} ${fingerprint}`);
  return { updateId: manifest.id, runtimeVersion: fingerprint };
}

// A trailing slash on OTA_WORKER_URL yields `//assets/<hash>` asset urls, and
// the Worker's `^/assets/([A-Za-z0-9_-]+)$` route 404s those. The client then
// abandons the update and the app silently stays on the old bundle.
//
// The origin check is a throw, not a warning. Devices ask exactly the origin
// in app.json's expo.updates.url. Publishing to any other origin uploads the
// assets and writes the pointer somewhere no device will ever look, so the
// command reports success and changes nothing -- the same silent no-op class
// this whole guard exists to remove. There is no workflow where a mismatch is
// wanted: reaching a device requires editing app.json and shipping a build
// anyway.
export function validateWorkerUrl({ workerUrl, appJsonPath }) {
  if (workerUrl.endsWith('/')) {
    throw new Error(
      `OTA_WORKER_URL must have no trailing slash: "${workerUrl}" would build "${workerUrl}/assets/<hash>" urls that the Worker rejects.`,
    );
  }

  let workerOrigin;
  try {
    workerOrigin = new URL(workerUrl).origin;
  } catch {
    throw new Error(`OTA_WORKER_URL "${workerUrl}" is not a valid url.`);
  }

  const updatesUrl = JSON.parse(readFileSync(appJsonPath, 'utf8')).expo?.updates
    ?.url;
  let updatesOrigin;
  try {
    updatesOrigin = new URL(updatesUrl).origin;
  } catch {
    throw new Error(
      `expo.updates.url in ${appJsonPath} is "${updatesUrl}", which is not a valid url. Set it to the deployed Worker before publishing, because that is the only address a device asks.`,
    );
  }

  if (workerOrigin !== updatesOrigin) {
    throw new Error(
      `OTA_WORKER_URL origin ${workerOrigin} differs from expo.updates.url origin ${updatesOrigin} in ${appJsonPath}. A device asks only ${updatesOrigin}, so this publish would reach nobody.`,
    );
  }

  return workerUrl;
}

function readOptionsFromArgv() {
  const { values } = parseArgs({
    options: {
      platform: { type: 'string', default: 'android' },
      'dist-directory': { type: 'string', default: 'dist' },
      'skip-export': { type: 'boolean', default: false },
    },
  });

  const workerUrl = process.env.OTA_WORKER_URL;
  const token = process.env.OTA_PUBLISH_TOKEN;
  const bucket = process.env.OTA_BUCKET ?? 'motivana-ota-assets';
  if (!workerUrl || !token) {
    throw new Error(
      'Set OTA_WORKER_URL and OTA_PUBLISH_TOKEN before publishing.',
    );
  }

  const appJsonPath = resolve(repositoryRoot, 'app.json');
  validateWorkerUrl({ workerUrl, appJsonPath });

  return {
    platform: values.platform,
    // A relative --dist-directory is resolved against the repository root,
    // not process.cwd(), for the same reason the git commands are pinned
    // above. An absolute path the caller gave is honoured as given.
    distDirectory: resolve(repositoryRoot, values['dist-directory']),
    appJsonPath,
    skipExport: values['skip-export'],
    archive: true,
    workerUrl,
    token,
    bucket,
  };
}

const isCliEntryPoint = process.argv[1]?.endsWith('ota-publish.mjs');
if (isCliEntryPoint) {
  publish({
    options: readOptionsFromArgv(),
    run: runCommand,
    fetchImpl: fetch,
    log: (message) => console.log(message),
  }).catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
