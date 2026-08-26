import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { rollback } from '../ota-rollback.mjs';

let workingDirectory: string;
let appJsonPath: string;
let requests: { url: string; init: RequestInit }[];

const archivedUpdate = {
  kind: 'update',
  updateId: '11111111-2222-3333-4444-555555555555',
  body: '{"id":"11111111-2222-3333-4444-555555555555"}',
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

describe('rollback to an earlier update', () => {
  it('reuses the archived manifest and its original signature', async () => {
    await rollback({
      options: { ...baseOptions(), to: archivedUpdate.updateId },
      run,
      fetchImpl,
      log: () => {},
    });

    const write = requests.find((entry) => entry.init.method === 'PUT');
    const payload = JSON.parse(String(write!.init.body));
    expect(payload.key).toBe('pointer:android:fingerprint-abc');
    // The signature covers the manifest alone and binds no time, so the
    // original signature stays valid and nothing is signed again.
    expect(payload.value).toEqual(archivedUpdate);
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
