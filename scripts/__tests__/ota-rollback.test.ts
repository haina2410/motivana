import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { rollback } from '../ota-rollback.mjs';

let workingDirectory: string;
let appJsonPath: string;
let requests: { url: string; init: RequestInit }[];

const archivedCreatedAt = '2026-08-01T00:00:00.000Z';
const archivedManifest = {
  id: '11111111-2222-3333-4444-555555555555',
  createdAt: archivedCreatedAt,
  runtimeVersion: 'fingerprint-abc',
  launchAsset: {
    hash: 'launch-hash',
    key: 'launch-key',
    fileExtension: '.bundle',
    contentType: 'application/javascript',
    url: 'https://ota.test/assets/launch-hash',
  },
  assets: [],
  metadata: {},
  extra: { expoClient: { slug: 'motivana' } },
};
const archivedUpdate = {
  kind: 'update',
  updateId: archivedManifest.id,
  body: JSON.stringify(archivedManifest),
  signature: 'sig="original", keyid="motivana-root", alg="rsa-v1_5-sha256"',
};

const fetchImpl = async (url: string, init: RequestInit) => {
  requests.push({ url, init });
  if (init.method === 'GET') {
    return new Response(JSON.stringify(archivedUpdate), { status: 200 });
  }
  return new Response(null, { status: 204 });
};

const run = (command: string, args: string[]) => {
  if (
    [command, ...args]
      .join(' ')
      .startsWith('npx expo-updates fingerprint:generate')
  ) {
    return { stdout: JSON.stringify({ hash: 'fingerprint-abc' }) };
  }
  return { stdout: '' };
};

function baseOptions() {
  return {
    platform: 'android',
    appJsonPath,
    workerUrl: 'https://ota.test',
    token: 'test-token',
    runtimeVersion: 'fingerprint-abc',
  };
}

beforeEach(() => {
  workingDirectory = mkdtempSync(join(tmpdir(), 'ota-rollback-'));
  const { privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  const keyPath = join(workingDirectory, 'private-key.pem');
  writeFileSync(keyPath, privateKey);
  process.env.OTA_PRIVATE_KEY_PATH = keyPath;

  appJsonPath = join(workingDirectory, 'app.json');
  writeFileSync(
    appJsonPath,
    JSON.stringify({
      expo: { updates: { codeSigningMetadata: { keyid: 'motivana-root' } } },
    }),
  );
  requests = [];
});

afterEach(() => {
  rmSync(workingDirectory, { recursive: true, force: true });
  delete process.env.OTA_PRIVATE_KEY_PATH;
});

async function rollbackToArchive(extra: Record<string, unknown> = {}) {
  await rollback({
    options: { ...baseOptions(), to: archivedUpdate.updateId, ...extra },
    run,
    fetchImpl,
    log: () => {},
  });
  const write = requests.find((entry) => entry.init.method === 'PUT');
  const payload = JSON.parse(String(write!.init.body));
  return { payload, manifest: JSON.parse(payload.value.body) };
}

describe('rollback to an earlier update', () => {
  it('keeps the archived bundle and runtime version', async () => {
    const { payload, manifest } = await rollbackToArchive();

    expect(payload.key).toBe('pointer:android:fingerprint-abc');
    expect(payload.value.kind).toBe('update');
    expect(manifest.runtimeVersion).toBe(archivedManifest.runtimeVersion);
    expect(manifest.launchAsset).toEqual(archivedManifest.launchAsset);
    expect(manifest.extra).toEqual(archivedManifest.extra);
  });

  it('mints a fresh id, because a device still holds the archived one', async () => {
    const { payload, manifest } = await rollbackToArchive();

    expect(manifest.id).not.toBe(archivedManifest.id);
    expect(manifest.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(payload.value.updateId).toBe(manifest.id);
  });

  it('stamps a createdAt strictly newer than the archived one', async () => {
    // expo-updates takes an update only when its commitTime is strictly after
    // the launched update's. Replaying the archived createdAt would leave
    // every device on the broken update, silently.
    const { manifest } = await rollbackToArchive();

    expect(Date.parse(manifest.createdAt)).toBeGreaterThan(
      Date.parse(archivedCreatedAt),
    );
  });

  it('signs the new bytes rather than replaying the archived signature', async () => {
    const { payload } = await rollbackToArchive();

    expect(payload.value.signature).not.toBe(archivedUpdate.signature);
    expect(payload.value.signature).toMatch(
      /^sig="[^"]+", keyid="motivana-root", alg="rsa-v1_5-sha256"$/,
    );
  });

  it('writes only the pointer, so the archive stays immutable', async () => {
    await rollbackToArchive();

    const writes = requests.filter((entry) => entry.init.method === 'PUT');
    expect(writes).toHaveLength(1);
    expect(JSON.parse(String(writes[0]!.init.body)).key).toBe(
      'pointer:android:fingerprint-abc',
    );
  });

  it('fails when the update id is not archived', async () => {
    const missingFetch = async (url: string, init: RequestInit) => {
      requests.push({ url, init });
      return new Response('not found', { status: 404 });
    };

    await expect(
      rollback({
        options: { ...baseOptions(), to: 'unknown-id' },
        run,
        fetchImpl: missingFetch,
        log: () => {},
      }),
    ).rejects.toThrow(/unknown-id/);
    expect(requests.some((entry) => entry.init.method === 'PUT')).toBe(false);
  });
});

describe('rollback to embedded', () => {
  it('writes a freshly signed rollBackToEmbedded directive', async () => {
    await rollback({
      options: {
        ...baseOptions(),
        to: 'embedded',
        commitTime: '2026-08-26T00:00:00.000Z',
      },
      run,
      fetchImpl,
      log: () => {},
    });

    const payload = JSON.parse(String(requests[0]!.init.body));
    expect(payload.key).toBe('pointer:android:fingerprint-abc');
    expect(payload.value.kind).toBe('rollback');
    expect(JSON.parse(payload.value.body)).toEqual({
      type: 'rollBackToEmbedded',
      parameters: { commitTime: '2026-08-26T00:00:00.000Z' },
    });
    expect(payload.value.signature).toMatch(
      /^sig="[^"]+", keyid="motivana-root", alg="rsa-v1_5-sha256"$/,
    );
  });
});

describe('the noUpdateAvailable directive', () => {
  it('signs and stores the constant directive body', async () => {
    await rollback({
      options: { ...baseOptions(), to: 'no-update-available' },
      run,
      fetchImpl,
      log: () => {},
    });

    const payload = JSON.parse(String(requests[0]!.init.body));
    expect(payload.key).toBe('directive:no-update-available');
    expect(payload.value.body).toBe('{"type":"noUpdateAvailable"}');
    expect(payload.value.signature).toContain('keyid="motivana-root"');
  });
});
