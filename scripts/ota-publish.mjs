import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
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
  const status = run('git', ['status', '--porcelain']).stdout.trim();
  if (status) {
    throw new Error(
      'The worktree has uncommitted changes. Commit them so the fingerprint matches a known build.',
    );
  }
  const gitSha = run('git', ['rev-parse', '--short', 'HEAD']).stdout.trim();

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

  const { manifest, files } = buildManifest({
    distDirectory: options.distDirectory,
    platform: options.platform,
    runtimeVersion: fingerprint,
    assetBaseUrl: `${options.workerUrl}/assets`,
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

  return {
    platform: values.platform,
    distDirectory: resolve(values['dist-directory']),
    appJsonPath: resolve('app.json'),
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
