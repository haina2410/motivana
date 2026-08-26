import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { putPointer } from './ota/pointerClient.mjs';
import {
  formatSignatureHeader,
  readKeyId,
  readPrivateKey,
  signBody,
} from './ota/sign.mjs';
import { repositoryRoot, runCommand } from './ota-publish.mjs';

async function readArchivedUpdate({ workerUrl, token, updateId, fetchImpl }) {
  const response = await fetchImpl(
    `${workerUrl}/api/pointer?key=update:${updateId}`,
    {
      method: 'GET',
      headers: { authorization: `Bearer ${token}` },
    },
  );
  if (!response.ok) {
    throw new Error(`No archived update ${updateId}. Nothing was changed.`);
  }
  return await response.json();
}

function signDirective({ directive, appJsonPath }) {
  const body = JSON.stringify(directive);
  return {
    body,
    signature: formatSignatureHeader({
      signature: signBody(body, readPrivateKey()),
      keyid: readKeyId(appJsonPath),
    }),
  };
}

export async function rollback({ options, run, fetchImpl, log }) {
  const runtimeVersion =
    options.runtimeVersion ??
    JSON.parse(
      run('npx', [
        'expo-updates',
        'fingerprint:generate',
        '--platform',
        options.platform,
      ]).stdout,
    ).hash;

  // The noUpdateAvailable body never changes, so it is signed once and stored
  // under its own key. The Worker returns it whenever a client already runs
  // the offered update.
  if (options.to === 'no-update-available') {
    await putPointer({
      workerUrl: options.workerUrl,
      token: options.token,
      key: 'directive:no-update-available',
      value: signDirective({
        directive: { type: 'noUpdateAvailable' },
        appJsonPath: options.appJsonPath,
      }),
      fetchImpl,
    });
    log('Stored the signed noUpdateAvailable directive');
    return;
  }

  const key = `pointer:${options.platform}:${runtimeVersion}`;

  if (options.to === 'embedded') {
    const value = {
      kind: 'rollback',
      ...signDirective({
        directive: {
          type: 'rollBackToEmbedded',
          parameters: {
            commitTime: options.commitTime ?? new Date().toISOString(),
          },
        },
        appJsonPath: options.appJsonPath,
      }),
    };
    await putPointer({ ...options, key, value, fetchImpl });
    log(
      `Rolled ${options.platform} ${runtimeVersion} back to the embedded bundle`,
    );
    return;
  }

  const archived = await readArchivedUpdate({
    workerUrl: options.workerUrl,
    token: options.token,
    updateId: options.to,
    fetchImpl,
  });
  await putPointer({ ...options, key, value: archived, fetchImpl });
  log(
    `Rolled ${options.platform} ${runtimeVersion} back to update ${options.to}`,
  );
}

function readOptionsFromArgv() {
  const { values } = parseArgs({
    options: {
      to: { type: 'string' },
      platform: { type: 'string', default: 'android' },
      'runtime-version': { type: 'string' },
    },
  });

  if (!values.to) {
    throw new Error(
      'Pass --to <updateId>, --to embedded, or --to no-update-available.',
    );
  }

  const workerUrl = process.env.OTA_WORKER_URL;
  const token = process.env.OTA_PUBLISH_TOKEN;
  if (!workerUrl || !token) {
    throw new Error(
      'Set OTA_WORKER_URL and OTA_PUBLISH_TOKEN before a rollback.',
    );
  }

  return {
    to: values.to,
    platform: values.platform,
    runtimeVersion: values['runtime-version'],
    // Resolved against the repository root, not process.cwd(), for the same
    // reason ota-publish.mjs pins its paths there.
    appJsonPath: resolve(repositoryRoot, 'app.json'),
    workerUrl,
    token,
  };
}

const isCliEntryPoint = process.argv[1]?.endsWith('ota-rollback.mjs');
if (isCliEntryPoint) {
  rollback({
    options: readOptionsFromArgv(),
    run: runCommand,
    fetchImpl: fetch,
    log: (message) => console.log(message),
  }).catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
