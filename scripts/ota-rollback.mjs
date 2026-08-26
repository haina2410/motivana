import { randomUUID } from 'node:crypto';
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

// A rollback cannot replay the archived record verbatim.
//
// expo-updates orders updates by commitTime and refuses anything that is not
// strictly newer: LoaderSelectionPolicyFilterAware returns
// `newUpdate.commitTime.after(launchedUpdate.commitTime)`. An archived record
// keeps its original createdAt, so re-serving it would leave every device
// already on the newer broken update exactly where it is, with no error.
//
// So the archived manifest is minted into a fresh record: createdAt is now,
// and the id is a fresh UUID. The new id matters as much as the new time -- a
// device that once ran this update still holds the old id in its local update
// database, so the same id with a different commitTime risks being
// deduplicated or conflicting. A new id is unambiguously a new update.
//
// This parses a stored manifest, which is correct here: this is the publish
// side, holding the private key. The Worker still parses nothing and signs
// nothing.
//
// The `update:<updateId>` archive is left untouched. Archives are immutable;
// only the pointer changes.
function mintRollforwardRecord({ archived, appJsonPath, createdAt, updateId }) {
  let manifest;
  try {
    manifest = JSON.parse(archived.body);
  } catch {
    throw new Error(
      `The archived record for ${archived.updateId} holds no readable manifest. Nothing was changed.`,
    );
  }
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new Error(
      `The archived record for ${archived.updateId} holds no manifest object. Nothing was changed.`,
    );
  }

  const fresh = {
    ...manifest,
    id: updateId ?? randomUUID(),
    createdAt: createdAt ?? new Date().toISOString(),
  };
  // Stringified once, signed, and stored: the signature must cover the exact
  // bytes the Worker will hand to the client.
  const body = JSON.stringify(fresh);

  return {
    kind: 'update',
    updateId: fresh.id,
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
  const value = mintRollforwardRecord({
    archived,
    appJsonPath: options.appJsonPath,
    createdAt: options.createdAt,
    updateId: options.updateId,
  });
  await putPointer({ ...options, key, value, fetchImpl });
  log(
    `Rolled ${options.platform} ${runtimeVersion} back to update ${options.to}, served as new update ${value.updateId}`,
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
