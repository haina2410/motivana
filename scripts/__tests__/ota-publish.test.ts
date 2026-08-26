import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { generateKeyPairSync } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { publish } from '../ota-publish.mjs';

type Command = { command: string; args: string[] };

let workingDirectory: string;
let distDirectory: string;
let appJsonPath: string;
let commands: Command[];
let requests: { url: string; init: RequestInit }[];

function writeFixtureExport(directory: string) {
  mkdirSync(join(directory, '_expo/static/js/android'), { recursive: true });
  mkdirSync(join(directory, 'assets'), { recursive: true });
  writeFileSync(join(directory, '_expo/static/js/android/index.hbc'), 'BUNDLE');
  writeFileSync(join(directory, 'assets/abc123'), 'FONTDATA');
  writeFileSync(
    join(directory, 'metadata.json'),
    JSON.stringify({
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
    JSON.stringify({ slug: 'motivana' }),
  );
}

function makeRun(
  overrides: Record<string, { stdout?: string; status?: number }> = {},
) {
  return (command: string, args: string[]) => {
    commands.push({ command, args });
    const key = [command, ...args].join(' ');
    const override = Object.entries(overrides).find(([prefix]) =>
      key.startsWith(prefix),
    );
    if (override?.[1].status && override[1].status !== 0) {
      throw new Error(`${key} exited with ${override[1].status}`);
    }
    if (override) {
      return { stdout: override[1].stdout ?? '' };
    }
    if (key.startsWith('npx expo-updates fingerprint:generate')) {
      return { stdout: JSON.stringify({ hash: 'fingerprint-abc' }) };
    }
    if (key.startsWith('git status')) {
      return { stdout: '' };
    }
    if (key.startsWith('git rev-parse')) {
      return { stdout: 'deadbeef' };
    }
    return { stdout: '' };
  };
}

const fetchImpl = async (url: string, init: RequestInit) => {
  requests.push({ url, init });
  return new Response(null, { status: 204 });
};

function baseOptions() {
  return {
    distDirectory,
    appJsonPath,
    platform: 'android',
    bucket: 'motivana-ota-assets',
    workerUrl: 'https://ota.test',
    token: 'test-token',
    skipExport: true,
  };
}

beforeEach(() => {
  workingDirectory = mkdtempSync(join(tmpdir(), 'ota-publish-'));
  distDirectory = join(workingDirectory, 'dist');
  mkdirSync(distDirectory);
  writeFixtureExport(distDirectory);

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

  commands = [];
  requests = [];
});

afterEach(() => {
  rmSync(workingDirectory, { recursive: true, force: true });
  delete process.env.OTA_PRIVATE_KEY_PATH;
});

describe('publish', () => {
  it('uploads every asset before it writes the pointer', async () => {
    await publish({
      options: baseOptions(),
      run: makeRun(),
      fetchImpl,
      log: () => {},
    });

    const uploadCount = commands.filter((entry) =>
      entry.args.join(' ').startsWith('wrangler r2 object put'),
    ).length;
    expect(uploadCount).toBe(2);
    // The pointer is the last write. Anything else risks a pointer that names
    // a manifest whose assets are absent.
    expect(requests).toHaveLength(1);
  });

  it('never writes the pointer when an upload fails', async () => {
    const run = makeRun({ 'npx wrangler r2 object put': { status: 1 } });

    await expect(
      publish({ options: baseOptions(), run, fetchImpl, log: () => {} }),
    ).rejects.toThrow();
    expect(requests).toHaveLength(0);
  });

  it('writes an update pointer keyed on platform and fingerprint', async () => {
    const result = await publish({
      options: baseOptions(),
      run: makeRun(),
      fetchImpl,
      log: () => {},
    });

    const payload = JSON.parse(String(requests[0]!.init.body));
    expect(payload.key).toBe('pointer:android:fingerprint-abc');
    expect(payload.value.kind).toBe('update');
    expect(payload.value.updateId).toBe(result.updateId);
    expect(result.runtimeVersion).toBe('fingerprint-abc');
  });

  it('signs the exact manifest bytes it stores', async () => {
    await publish({
      options: baseOptions(),
      run: makeRun(),
      fetchImpl,
      log: () => {},
    });

    const payload = JSON.parse(String(requests[0]!.init.body));
    const manifest = JSON.parse(payload.value.body);
    expect(manifest.runtimeVersion).toBe('fingerprint-abc');
    expect(payload.value.signature).toMatch(
      /^sig="[^"]+", keyid="motivana-root", alg="rsa-v1_5-sha256"$/,
    );
  });

  it('points asset urls at the Worker', async () => {
    await publish({
      options: baseOptions(),
      run: makeRun(),
      fetchImpl,
      log: () => {},
    });

    const manifest = JSON.parse(
      JSON.parse(String(requests[0]!.init.body)).value.body,
    );
    expect(manifest.launchAsset.url).toMatch(/^https:\/\/ota\.test\/assets\//);
  });

  it('sends the publish token', async () => {
    await publish({
      options: baseOptions(),
      run: makeRun(),
      fetchImpl,
      log: () => {},
    });

    expect(
      (requests[0]!.init.headers as Record<string, string>).authorization,
    ).toBe('Bearer test-token');
  });

  it('refuses to publish from a dirty worktree', async () => {
    const run = makeRun({ 'git status': { stdout: ' M app/index.tsx\n' } });

    await expect(
      publish({ options: baseOptions(), run, fetchImpl, log: () => {} }),
    ).rejects.toThrow(/uncommitted/i);
    expect(requests).toHaveLength(0);
  });

  it('also stores the update under its id so a rollback can find it', async () => {
    const run = makeRun();
    await publish({
      options: { ...baseOptions(), archive: true },
      run,
      fetchImpl,
      log: () => {},
    });

    // Two pointer writes: the archive record and the live pointer.
    expect(requests).toHaveLength(2);
    const keys = requests.map(
      (entry) => JSON.parse(String(entry.init.body)).key,
    );
    expect(keys[0]).toMatch(/^update:/);
    expect(keys[1]).toBe('pointer:android:fingerprint-abc');
  });
});
