# Cloudflare OTA Updates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send JavaScript and asset updates to installed Motivana builds from a self-hosted Cloudflare Worker, with rollback and code signing.

**Architecture:** A local `pnpm ota:publish` script exports the bundle, hashes every file, builds the manifest JSON string, signs it with a private key that never leaves the developer machine, uploads assets to R2, then writes the signed bytes into KV. The Worker reads one KV key and returns those exact bytes inside a `multipart/mixed` envelope. The Worker performs no crypto and never parses a manifest.

**Tech Stack:** `expo-updates` (SDK 57), Cloudflare Workers, R2, KV, `wrangler`, `vitest` with `@cloudflare/vitest-pool-workers` for Worker tests, Jest for script tests, Node 24 ESM.

**Spec:** `docs/superpowers/specs/2026-08-26-cloudflare-ota-updates-design.md`

## Global Constraints

- Platform is Android only. `app.json` has `"platforms": ["android"]`. Keep every platform value read from the `expo-platform` header, never hardcoded, so iOS costs nothing later.
- An update carries JavaScript and assets only, never native code. `runtimeVersion` uses `{ "policy": "fingerprint" }` to enforce this.
- The private signing key is never committed and never uploaded to Cloudflare. Scripts read its path from `OTA_PRIVATE_KEY_PATH`.
- `certs/certificate.pem` is public, committed, and embedded in the build.
- Fail open. A Worker error, a KV error, or a missing asset must leave the app running its current bundle.
- The publish order is always: upload assets, confirm success, then write the KV pointer. Never the reverse.
- Signature algorithm is `rsa-v1_5-sha256`. The `keyid` is read from `app.json` at `expo.updates.codeSigningMetadata.keyid`. Never hardcode it.
- Asset `hash` is unpadded base64url of the SHA-256 digest. Asset `key` is the MD5 digest in hex. These come from Expo's reference server and the client depends on both.
- Manifest `id` is a UUID built from the SHA-256 hex digest of `dist/metadata.json`.
- Script files are `.mjs` under `scripts/`, matching `verify-data.mjs`. Script tests are TypeScript under `scripts/__tests__/`.
- Run `pnpm verify` before every commit that touches app or script code.

---

## File Structure

**App configuration**
- Modify `app.json` — add `expo.updates`, `expo.runtimeVersion`, `expo.plugins` entry as needed
- Modify `package.json` — add `expo-updates` dep, `ota:*` scripts, extend `verify`
- Modify `tsconfig.json` — exclude `ota` so the Worker is not compiled by the app's tsconfig
- Modify `jest.config.js` — ignore `/ota/` so Jest never runs Worker tests
- Create `certs/certificate.pem` — public certificate
- Modify `.gitignore` — ignore `dist/`, `certs/private-key.pem`

**Publish tooling** (pure functions, separately testable)
- Create `scripts/ota/hash.mjs` — digests and UUID conversion
- Create `scripts/ota/manifest.mjs` — build the manifest object from a `dist/` directory
- Create `scripts/ota/sign.mjs` — RSA-SHA256 signing and `expo-signature` header formatting
- Create `scripts/ota/r2.mjs` — asset upload through the `wrangler` CLI
- Create `scripts/ota/pointerClient.mjs` — authenticated `PUT /api/pointer`
- Create `scripts/ota-publish.mjs` — the command that orchestrates the above
- Create `scripts/ota-rollback.mjs` — the rollback command

**Worker** (independent package, not a pnpm workspace member)
- Create `ota/worker/package.json`, `wrangler.jsonc`, `tsconfig.json`, `vitest.config.ts`
- Create `ota/worker/src/index.ts` — routing only
- Create `ota/worker/src/multipart.ts` — `multipart/mixed` body builder
- Create `ota/worker/src/pointer.ts` — KV record types and reads
- Create `ota/worker/src/manifest.ts` — the `GET /api/manifest` handler
- Create `ota/worker/src/assets.ts` — the `GET /assets/:hash` handler

`ota/worker` keeps its own `package.json` because Worker code needs Cloudflare types and `vitest`, which conflict with the app's `jest-expo` preset and Expo tsconfig. `pnpm-workspace.yaml` declares no `packages:` key, so a nested `package.json` is ignored by the root install and no resolution conflict arises.

---

## Task 1: Install and configure `expo-updates`

No server exists yet. This task ends with an app that still starts and that carries a signing certificate.

**Files:**
- Modify: `package.json`
- Modify: `app.json`
- Modify: `.gitignore`
- Create: `certs/certificate.pem`
- Test: `scripts/__tests__/ota-config.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `app.json` fields `expo.updates.url`, `expo.updates.codeSigningCertificate`, `expo.updates.codeSigningMetadata.keyid`, `expo.updates.codeSigningMetadata.alg`, `expo.runtimeVersion.policy`. Task 3 and Task 6 read `keyid` from here.

- [ ] **Step 1: Write the failing config test**

Create `scripts/__tests__/ota-config.test.ts`:

```ts
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repositoryRoot = resolve(__dirname, '../..');

function readAppConfig() {
  return JSON.parse(
    readFileSync(resolve(repositoryRoot, 'app.json'), 'utf8'),
  ).expo;
}

describe('over-the-air update configuration', () => {
  it('uses the fingerprint runtime version policy', () => {
    // A fixed runtime version string lets a JavaScript-only update reach a
    // build without the matching motivana-wallpaper native code, which
    // crashes the app. The fingerprint changes whenever native code changes.
    expect(readAppConfig().runtimeVersion).toEqual({ policy: 'fingerprint' });
  });

  it('points updates at the Motivana update server', () => {
    expect(readAppConfig().updates.url).toMatch(/^https:\/\/.+\/api\/manifest$/);
  });

  it('requires signed updates', () => {
    const { updates } = readAppConfig();
    expect(updates.codeSigningCertificate).toBe('./certs/certificate.pem');
    expect(updates.codeSigningMetadata.alg).toBe('rsa-v1_5-sha256');
    expect(typeof updates.codeSigningMetadata.keyid).toBe('string');
    expect(updates.codeSigningMetadata.keyid.length).toBeGreaterThan(0);
  });

  it('commits the public certificate and not the private key', () => {
    expect(existsSync(resolve(repositoryRoot, 'certs/certificate.pem'))).toBe(true);
    expect(existsSync(resolve(repositoryRoot, 'certs/private-key.pem'))).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test scripts/__tests__/ota-config.test.ts`
Expected: FAIL. `readAppConfig().runtimeVersion` is `undefined` and `updates` is `undefined`.

- [ ] **Step 3: Install `expo-updates`**

Run: `pnpm expo install expo-updates`

- [ ] **Step 4: Generate the signing key pair**

Run: `npx expo-updates codesigning:generate --key-output-directory certs --certificate-output-directory certs --certificate-validity-duration-years 10 --certificate-common-name Motivana`

This writes `certs/private-key.pem`, `certs/public-key.pem`, and `certs/certificate.pem`.

- [ ] **Step 5: Move the private key out of the repository**

```bash
mkdir -p ~/.motivana-ota
mv certs/private-key.pem ~/.motivana-ota/private-key.pem
chmod 600 ~/.motivana-ota/private-key.pem
```

Record for later shell sessions: `export OTA_PRIVATE_KEY_PATH=~/.motivana-ota/private-key.pem`

- [ ] **Step 6: Configure code signing in `app.json`**

Run: `npx expo-updates codesigning:configure --certificate-input-directory certs --key-input-directory ~/.motivana-ota`

Confirm it added `expo.updates.codeSigningCertificate` and `expo.updates.codeSigningMetadata` to `app.json`. Note the `keyid` value it chose.

- [ ] **Step 7: Add the runtime version policy and update URL to `app.json`**

Inside the `expo` object add:

```json
"runtimeVersion": { "policy": "fingerprint" },
```

and set the update URL, using your own Workers subdomain:

```json
"updates": {
  "url": "https://motivana-ota.<your-subdomain>.workers.dev/api/manifest",
  "codeSigningCertificate": "./certs/certificate.pem",
  "codeSigningMetadata": { "keyid": "main", "alg": "rsa-v1_5-sha256" }
}
```

Keep the `keyid` that Step 6 generated. Do not replace it with `main` if it differs.

- [ ] **Step 8: Ignore build output and the private key**

Append to `.gitignore`:

```
# Over-the-air update build output
/dist
/certs/private-key.pem
/certs/public-key.pem
```

- [ ] **Step 9: Run the test to verify it passes**

Run: `pnpm test scripts/__tests__/ota-config.test.ts`
Expected: PASS, four tests.

- [ ] **Step 10: Confirm the app still starts**

```bash
npx expo prebuild --platform android --clean
pnpm android
```

Expected: the app builds and reaches the home screen. `expo-updates` adds native code, so a failure here is a prebuild problem and must be fixed before continuing.

- [ ] **Step 11: Commit**

```bash
git add package.json pnpm-lock.yaml app.json .gitignore certs/certificate.pem scripts/__tests__/ota-config.test.ts
git commit -m "feat: install expo-updates with fingerprint runtime version and code signing"
```

---

## Task 2: Hashing and manifest assembly

Pure functions over a `dist/` directory. No network, no crypto keys.

**Files:**
- Modify: `jest.config.js`
- Create: `scripts/ota/hash.mjs`
- Create: `scripts/ota/manifest.mjs`
- Test: `scripts/__tests__/ota-manifest.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `hash.mjs`: `sha256Base64Url(buffer: Buffer): string`, `md5Hex(buffer: Buffer): string`, `sha256Hex(buffer: Buffer): string`, `sha256HexToUuid(hex: string): string`
  - `manifest.mjs`: `buildManifest({ distDirectory: string, platform: string, runtimeVersion: string, assetBaseUrl: string }): { manifest: object, files: { hash: string, absolutePath: string, contentType: string }[] }`

- [ ] **Step 1: Write the failing test**

Create `scripts/__tests__/ota-manifest.test.ts`:

```ts
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { md5Hex, sha256Base64Url, sha256HexToUuid } from '../ota/hash.mjs';
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
  writeFileSync(
    join(directory, 'expoConfig.json'),
    JSON.stringify({ name: 'Motivana', slug: 'motivana' }),
  );
}

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
  });

  it('encodes md5 as hex', () => {
    expect(md5Hex(Buffer.from('BUNDLE'))).toMatch(/^[0-9a-f]{32}$/);
  });

  it('converts a sha256 hex digest into a uuid', () => {
    const uuid = sha256HexToUuid('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef');
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
    });

    expect(manifest.launchAsset.contentType).toBe('application/javascript');
    expect(manifest.launchAsset.fileExtension).toBe('.bundle');
    expect(manifest.launchAsset.hash).toBe(sha256Base64Url(Buffer.from('BUNDLE')));
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
    });
    const second = buildManifest({
      distDirectory,
      platform: 'android',
      runtimeVersion: 'fingerprint-1',
      assetBaseUrl: 'https://ota.test/assets',
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
    });

    expect(manifest.extra.expoClient.slug).toBe('motivana');
  });

  it('lists every file to upload, the bundle included', () => {
    const { files } = buildManifest({
      distDirectory,
      platform: 'android',
      runtimeVersion: 'fingerprint-1',
      assetBaseUrl: 'https://ota.test/assets',
    });

    expect(files).toHaveLength(2);
    expect(files.map((file) => file.contentType).sort()).toEqual([
      'application/javascript',
      'font/ttf',
    ]);
  });

  it('rejects a platform that the export does not contain', () => {
    expect(() =>
      buildManifest({
        distDirectory,
        platform: 'ios',
        runtimeVersion: 'fingerprint-1',
        assetBaseUrl: 'https://ota.test/assets',
      }),
    ).toThrow(/ios/);
  });
});
```

- [ ] **Step 2: Teach Jest to import a `.mjs` module**

No existing test in `scripts/__tests__/` imports a `.mjs` file. All three spawn
their script as a subprocess instead, so this import path is unproven and must
be made to work before any later task depends on it.

In `jest.config.js`, add `mjs` to the resolved extensions and extend, rather
than replace, the preset's transform:

```js
const expoPreset = require('jest-expo/jest-preset');

module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEach: undefined,
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'mjs', 'json', 'node'],
  // The OTA helpers are .mjs so the publish scripts can import them directly.
  // The jest-expo transform only matches .ts/.tsx/.js/.jsx, so .mjs needs its
  // own entry or the import fails to resolve.
  transform: { ...expoPreset.transform, '^.+\\.mjs$': 'babel-jest' },
  ...
};
```

Keep every existing key (`setupFilesAfterEnv`, `collectCoverageFrom`,
`testPathIgnorePatterns`) exactly as it is. Remove the `setupFilesAfterEach`
line above — it is only there to mark where the new keys go.

- [ ] **Step 3: Run the test to verify it fails for the right reason**

Run: `pnpm test scripts/__tests__/ota-manifest.test.ts`
Expected: FAIL because `scripts/ota/hash.mjs` does not exist yet — not because
Jest cannot parse or resolve a `.mjs` file. If the failure is a transform or
resolution error, fix the Jest configuration before continuing.

Then confirm nothing else broke:

Run: `pnpm test`
Expected: the existing suites still pass.

- [ ] **Step 4: Write `scripts/ota/hash.mjs`**

```js
import { createHash } from 'node:crypto';

export function sha256Base64Url(buffer) {
  return createHash('sha256')
    .update(buffer)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function sha256Hex(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

export function md5Hex(buffer) {
  return createHash('md5').update(buffer).digest('hex');
}

// The manifest id must be a uuid, so the sha256 hex digest of metadata.json is
// reshaped into uuid form. Expo's reference server derives the id the same way.
export function sha256HexToUuid(hex) {
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}
```

- [ ] **Step 5: Write `scripts/ota/manifest.mjs`**

```js
import { readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { md5Hex, sha256Base64Url, sha256Hex, sha256HexToUuid } from './hash.mjs';

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
    readFileSync(resolve(join(distDirectory, 'expoConfig.json'))).toString('utf8'),
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

  return { manifest, files: [launch.file, ...assets.map((entry) => entry.file)] };
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm test scripts/__tests__/ota-manifest.test.ts`
Expected: PASS, nine tests.

- [ ] **Step 7: Commit**

```bash
git add jest.config.js scripts/ota/hash.mjs scripts/ota/manifest.mjs scripts/__tests__/ota-manifest.test.ts
git commit -m "feat: add manifest assembly for over-the-air updates"
```

---

## Task 3: Signing

The only code that touches the private key. A round-trip test against the public certificate is what catches key-format drift, which is the most probable silent failure in the whole system.

**Files:**
- Create: `scripts/ota/sign.mjs`
- Test: `scripts/__tests__/ota-sign.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `signBody(body: string, privateKeyPem: string): string` returns base64
  - `formatSignatureHeader({ signature: string, keyid: string }): string` returns the `expo-signature` value
  - `readKeyId(appJsonPath: string): string`
  - `readPrivateKey(): string` reads `OTA_PRIVATE_KEY_PATH`, throws a usable message when unset

- [ ] **Step 1: Write the failing test**

Create `scripts/__tests__/ota-sign.test.ts`:

```ts
import { generateKeyPairSync, createVerify } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  formatSignatureHeader,
  readKeyId,
  readPrivateKey,
  signBody,
} from '../ota/sign.mjs';

let workingDirectory: string;

beforeEach(() => {
  workingDirectory = mkdtempSync(join(tmpdir(), 'ota-sign-'));
});

afterEach(() => {
  rmSync(workingDirectory, { recursive: true, force: true });
  delete process.env.OTA_PRIVATE_KEY_PATH;
});

function generateKeys() {
  return generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
}

describe('signBody', () => {
  it('produces a signature that the matching public key verifies', () => {
    const { privateKey, publicKey } = generateKeys();
    const body = JSON.stringify({ id: 'abc', runtimeVersion: 'fingerprint-1' });

    const signature = signBody(body, privateKey);

    const verifier = createVerify('RSA-SHA256');
    verifier.update(body, 'utf8');
    verifier.end();
    expect(verifier.verify(publicKey, signature, 'base64')).toBe(true);
  });

  it('produces a signature that a different key rejects', () => {
    const { privateKey } = generateKeys();
    const other = generateKeys();
    const body = '{"id":"abc"}';

    const signature = signBody(body, privateKey);

    const verifier = createVerify('RSA-SHA256');
    verifier.update(body, 'utf8');
    verifier.end();
    expect(verifier.verify(other.publicKey, signature, 'base64')).toBe(false);
  });

  it('signs the exact bytes, so any change invalidates the signature', () => {
    const { privateKey, publicKey } = generateKeys();
    const signature = signBody('{"id":"abc"}', privateKey);

    const verifier = createVerify('RSA-SHA256');
    verifier.update('{"id":"abd"}', 'utf8');
    verifier.end();
    expect(verifier.verify(publicKey, signature, 'base64')).toBe(false);
  });
});

describe('formatSignatureHeader', () => {
  it('writes a structured field dictionary with quoted values', () => {
    const header = formatSignatureHeader({ signature: 'AbC+/12=', keyid: 'main' });

    expect(header).toBe('sig="AbC+/12=", keyid="main", alg="rsa-v1_5-sha256"');
  });
});

describe('readKeyId', () => {
  it('reads the key id that codesigning:configure wrote', () => {
    const appJsonPath = join(workingDirectory, 'app.json');
    writeFileSync(
      appJsonPath,
      JSON.stringify({
        expo: { updates: { codeSigningMetadata: { keyid: 'motivana-root' } } },
      }),
    );

    expect(readKeyId(appJsonPath)).toBe('motivana-root');
  });

  it('fails when code signing is not configured', () => {
    const appJsonPath = join(workingDirectory, 'app.json');
    writeFileSync(appJsonPath, JSON.stringify({ expo: { updates: {} } }));

    expect(() => readKeyId(appJsonPath)).toThrow(/codeSigningMetadata/);
  });
});

describe('readPrivateKey', () => {
  it('explains what to set when the path is missing', () => {
    expect(() => readPrivateKey()).toThrow(/OTA_PRIVATE_KEY_PATH/);
  });

  it('reads the key from the path in the environment', () => {
    const keyPath = join(workingDirectory, 'private-key.pem');
    writeFileSync(keyPath, generateKeys().privateKey);
    process.env.OTA_PRIVATE_KEY_PATH = keyPath;

    expect(readPrivateKey()).toContain('BEGIN PRIVATE KEY');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test scripts/__tests__/ota-sign.test.ts`
Expected: FAIL, cannot resolve `../ota/sign.mjs`.

- [ ] **Step 3: Write `scripts/ota/sign.mjs`**

```js
import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function signBody(body, privateKeyPem) {
  const signer = createSign('RSA-SHA256');
  signer.update(body, 'utf8');
  signer.end();
  return signer.sign(privateKeyPem, 'base64');
}

// A structured field dictionary. Base64 contains no quote and no backslash,
// so quoting the value needs no escaping.
export function formatSignatureHeader({ signature, keyid }) {
  return `sig="${signature}", keyid="${keyid}", alg="rsa-v1_5-sha256"`;
}

export function readKeyId(appJsonPath) {
  const appConfig = JSON.parse(readFileSync(resolve(appJsonPath), 'utf8'));
  const keyid = appConfig.expo?.updates?.codeSigningMetadata?.keyid;
  if (!keyid) {
    throw new Error(
      `No expo.updates.codeSigningMetadata.keyid in ${appJsonPath}. Run npx expo-updates codesigning:configure.`,
    );
  }
  return keyid;
}

export function readPrivateKey() {
  const keyPath = process.env.OTA_PRIVATE_KEY_PATH;
  if (!keyPath) {
    throw new Error(
      'Set OTA_PRIVATE_KEY_PATH to the signing key, which is kept outside this repository.',
    );
  }
  return readFileSync(resolve(keyPath), 'utf8');
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test scripts/__tests__/ota-sign.test.ts`
Expected: PASS, eight tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/ota/sign.mjs scripts/__tests__/ota-sign.test.ts
git commit -m "feat: add manifest signing for over-the-air updates"
```

---

## Task 4: Worker scaffold and the multipart builder

**Files:**
- Create: `ota/worker/package.json`
- Create: `ota/worker/pnpm-workspace.yaml`
- Create: `ota/worker/wrangler.jsonc`
- Create: `ota/worker/tsconfig.json`
- Create: `ota/worker/vitest.config.ts`
- Create: `ota/worker/src/multipart.ts`
- Create: `ota/worker/src/pointer.ts`
- Create: `ota/worker/src/index.ts`
- Modify: `tsconfig.json`
- Modify: `jest.config.js`
- Test: `ota/worker/test/multipart.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `multipart.ts`: `buildMultipartResponse(parts: MultipartPart[]): Response`, and `type MultipartPart = { name: string; body: string; contentType: string; headers?: Record<string, string> }`
  - `pointer.ts`: `type Pointer`, `pointerKey(platform: string, runtimeVersion: string): string`, `readPointer(kv: KVNamespace, platform: string, runtimeVersion: string): Promise<Pointer | null>`
  - `index.ts`: `type Env = { UPDATES: KVNamespace; ASSETS: R2Bucket; OTA_PUBLISH_TOKEN: string }`

- [ ] **Step 1: Create the Worker package**

`ota/worker/package.json`:

```json
{
  "name": "motivana-ota-worker",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "deploy": "wrangler deploy"
  },
  "devDependencies": {
    "@cloudflare/vitest-pool-workers": "^0.8.19",
    "@cloudflare/workers-types": "^4.20250109.0",
    "typescript": "~5.8.3",
    "vitest": "~3.0.9",
    "wrangler": "^4.4.0"
  }
}
```

`ota/worker/wrangler.jsonc`:

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "motivana-ota",
  "main": "src/index.ts",
  "compatibility_date": "2026-08-26",
  "kv_namespaces": [{ "binding": "UPDATES", "id": "REPLACE_WITH_KV_ID" }],
  "r2_buckets": [{ "binding": "ASSETS", "bucket_name": "motivana-ota-assets" }],
  "observability": { "enabled": true }
}
```

`ota/worker/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "es2022",
    "module": "esnext",
    "moduleResolution": "bundler",
    "lib": ["es2022"],
    "types": ["@cloudflare/workers-types", "@cloudflare/vitest-pool-workers"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["src", "test"]
}
```

`ota/worker/vitest.config.ts`:

```ts
import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.jsonc' },
        miniflare: { bindings: { OTA_PUBLISH_TOKEN: 'test-token' } },
      },
    },
  },
});
```

- [ ] **Step 2: Keep the app toolchain away from the Worker**

The root `tsconfig.json` includes `**/*.ts`, and Jest would collect Worker tests. Both must skip `ota`.

In `tsconfig.json`, add alongside `"include"`:

```json
"exclude": ["node_modules", "ota"]
```

In `jest.config.js`, add `'/ota/'` to `testPathIgnorePatterns`, with a comment matching the style of the existing entry:

```js
  // /ota/ is an independent Cloudflare Worker package. It uses vitest with the
  // workers pool, which the jest-expo preset cannot run.
  testPathIgnorePatterns: [
    '/node_modules/',
    '/android/',
    '/.claude/worktrees/',
    '/ota/',
  ],
```

- [ ] **Step 3: Install the Worker dependencies**

The repository root holds a `pnpm-workspace.yaml`. Without its own workspace
root, pnpm walks up from `ota/worker` and can install into the app's
`node_modules`. Create `ota/worker/pnpm-workspace.yaml`:

```yaml
packages: []
```

An install inside the command sandbox destroys this repository's
`node_modules`, so this install must run with the sandbox disabled. Record the
root package count before and after to prove the app tree was untouched:

```bash
ls node_modules | wc -l
cd ota/worker && pnpm install && cd ../..
ls node_modules | wc -l
```

Both counts must match. If the second collapses to a small number, stop: the
root install was damaged and needs an unsandboxed `pnpm install` to restore.

- [ ] **Step 4: Write the failing multipart test**

Create `ota/worker/test/multipart.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { buildMultipartResponse } from '../src/multipart';

async function readBody(response: Response) {
  return await response.text();
}

describe('buildMultipartResponse', () => {
  it('always states the protocol version and structured field version', async () => {
    const response = buildMultipartResponse([]);

    expect(response.status).toBe(200);
    expect(response.headers.get('expo-protocol-version')).toBe('1');
    expect(response.headers.get('expo-sfv-version')).toBe('0');
    expect(response.headers.get('cache-control')).toBe('private, max-age=0');
  });

  it('declares a boundary that appears in the body', async () => {
    const response = buildMultipartResponse([
      { name: 'manifest', body: '{"id":"a"}', contentType: 'application/json' },
    ]);
    const contentType = response.headers.get('content-type') ?? '';
    const boundary = contentType.match(/boundary=(\S+)/)?.[1];

    expect(contentType).toMatch(/^multipart\/mixed; boundary=/);
    expect(boundary).toBeTruthy();
    expect(await readBody(response)).toContain(`--${boundary}`);
  });

  it('names each part with a content-disposition header', async () => {
    const response = buildMultipartResponse([
      { name: 'manifest', body: '{"id":"a"}', contentType: 'application/json' },
    ]);

    expect(await readBody(response)).toContain(
      'content-disposition: form-data; name="manifest"',
    );
  });

  it('copies extra part headers such as the signature', async () => {
    const response = buildMultipartResponse([
      {
        name: 'manifest',
        body: '{"id":"a"}',
        contentType: 'application/json',
        headers: { 'expo-signature': 'sig="abc", keyid="main"' },
      },
    ]);

    expect(await readBody(response)).toContain('expo-signature: sig="abc", keyid="main"');
  });

  it('writes the part body without changing a byte', async () => {
    // The signature covers these exact bytes. Any reserialization breaks it.
    const body = '{"id":"a","extra":{"expoClient":{"name":"Motivana"}}}';
    const response = buildMultipartResponse([
      { name: 'manifest', body, contentType: 'application/json' },
    ]);

    expect(await readBody(response)).toContain(body);
  });

  it('produces a body with no parts when given no parts', async () => {
    const response = buildMultipartResponse([]);
    const boundary =
      response.headers.get('content-type')?.match(/boundary=(\S+)/)?.[1] ?? '';

    expect(await readBody(response)).toBe(`--${boundary}--\r\n`);
  });
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `cd ota/worker && pnpm test`
Expected: FAIL, cannot resolve `../src/multipart`.

- [ ] **Step 6: Write `ota/worker/src/multipart.ts`**

```ts
export type MultipartPart = {
  name: string;
  body: string;
  contentType: string;
  headers?: Record<string, string>;
};

// The signature covers a part body, never the envelope, so the boundary is
// free to change on every request.
function generateBoundary(): string {
  return `motivana-${crypto.randomUUID()}`;
}

export function buildMultipartResponse(parts: MultipartPart[]): Response {
  const boundary = generateBoundary();
  const sections = parts.map((part) => {
    const headers = {
      'content-disposition': `form-data; name="${part.name}"`,
      'content-type': part.contentType,
      ...part.headers,
    };
    const headerLines = Object.entries(headers)
      .map(([name, value]) => `${name}: ${value}`)
      .join('\r\n');
    return `--${boundary}\r\n${headerLines}\r\n\r\n${part.body}\r\n`;
  });

  return new Response(`${sections.join('')}--${boundary}--\r\n`, {
    status: 200,
    headers: {
      'content-type': `multipart/mixed; boundary=${boundary}`,
      'expo-protocol-version': '1',
      'expo-sfv-version': '0',
      'cache-control': 'private, max-age=0',
    },
  });
}
```

- [ ] **Step 7: Write `ota/worker/src/pointer.ts`**

```ts
// The bytes in `body` were signed when the update was published. The Worker
// returns them and never parses them.
export type SignedBody = {
  body: string;
  signature: string;
};

export type Pointer =
  | ({ kind: 'update'; updateId: string } & SignedBody)
  | ({ kind: 'rollback' } & SignedBody);

export const noUpdateAvailableKey = 'directive:no-update-available';

export function pointerKey(platform: string, runtimeVersion: string): string {
  return `pointer:${platform}:${runtimeVersion}`;
}

export async function readPointer(
  kv: KVNamespace,
  platform: string,
  runtimeVersion: string,
): Promise<Pointer | null> {
  return await kv.get<Pointer>(pointerKey(platform, runtimeVersion), 'json');
}

export async function readNoUpdateAvailable(
  kv: KVNamespace,
): Promise<SignedBody | null> {
  return await kv.get<SignedBody>(noUpdateAvailableKey, 'json');
}
```

- [ ] **Step 8: Write a placeholder `ota/worker/src/index.ts`**

Task 5 fills in the routes. This keeps `wrangler` and `tsc` able to run now.

```ts
export type Env = {
  UPDATES: KVNamespace;
  ASSETS: R2Bucket;
  OTA_PUBLISH_TOKEN: string;
};

export default {
  async fetch(): Promise<Response> {
    return new Response('not found', { status: 404 });
  },
};
```

- [ ] **Step 9: Run the tests and typecheck to verify they pass**

Run: `cd ota/worker && pnpm test && pnpm typecheck`
Expected: PASS, six tests, and no type errors.

- [ ] **Step 10: Confirm the app toolchain still ignores the Worker**

Run: `pnpm typecheck && pnpm test`
Expected: PASS. No Worker file appears in either output.

- [ ] **Step 11: Commit**

```bash
git add ota/worker tsconfig.json jest.config.js
git commit -m "feat: scaffold the over-the-air update Worker with a multipart builder"
```

---

## Task 5: Worker routes

**Files:**
- Create: `ota/worker/src/manifest.ts`
- Create: `ota/worker/src/assets.ts`
- Modify: `ota/worker/src/index.ts`
- Test: `ota/worker/test/manifest.test.ts`
- Test: `ota/worker/test/assets.test.ts`
- Test: `ota/worker/test/pointerRoute.test.ts`

**Interfaces:**
- Consumes: `buildMultipartResponse`, `MultipartPart` from `src/multipart`; `Pointer`, `SignedBody`, `pointerKey`, `noUpdateAvailableKey`, `readPointer`, `readNoUpdateAvailable` from `src/pointer`; `Env` from `src/index`
- Produces:
  - `manifest.ts`: `handleManifest(request: Request, env: Env): Promise<Response>`
  - `assets.ts`: `handleAsset(hash: string, env: Env): Promise<Response>`
  - `index.ts`: routes `GET /api/manifest`, `GET /assets/:hash`, `PUT /api/pointer`

- [ ] **Step 1: Write the failing manifest test**

Create `ota/worker/test/manifest.test.ts`:

```ts
import { env, SELF } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

import { noUpdateAvailableKey, pointerKey } from '../src/pointer';

const runtimeVersion = 'fingerprint-1';
const manifestBody = '{"id":"11111111-2222-3333-4444-555555555555"}';

function manifestRequest(headers: Record<string, string> = {}) {
  return SELF.fetch('https://ota.test/api/manifest', {
    headers: {
      'expo-protocol-version': '1',
      'expo-platform': 'android',
      'expo-runtime-version': runtimeVersion,
      'expo-expect-signature': 'sig, keyid="main", alg="rsa-v1_5-sha256"',
      ...headers,
    },
  });
}

async function putUpdatePointer() {
  await env.UPDATES.put(
    pointerKey('android', runtimeVersion),
    JSON.stringify({
      kind: 'update',
      updateId: '11111111-2222-3333-4444-555555555555',
      body: manifestBody,
      signature: 'sig="abc", keyid="main", alg="rsa-v1_5-sha256"',
    }),
  );
}

beforeEach(async () => {
  await env.UPDATES.delete(pointerKey('android', runtimeVersion));
  await env.UPDATES.delete(noUpdateAvailableKey);
});

describe('GET /api/manifest', () => {
  it('serves the stored manifest bytes unchanged, with its signature', async () => {
    await putUpdatePointer();

    const response = await manifestRequest();
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain(manifestBody);
    expect(body).toContain('expo-signature: sig="abc", keyid="main", alg="rsa-v1_5-sha256"');
    expect(body).toContain('content-disposition: form-data; name="manifest"');
  });

  it('serves a body with no parts when the runtime version has no update', async () => {
    const response = await manifestRequest({ 'expo-runtime-version': 'fingerprint-unknown' });
    const boundary =
      response.headers.get('content-type')?.match(/boundary=(\S+)/)?.[1] ?? '';

    // An old build must get a valid "nothing available" answer, not a 404.
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(`--${boundary}--\r\n`);
  });

  it('serves noUpdateAvailable when the client already runs this update', async () => {
    await putUpdatePointer();
    await env.UPDATES.put(
      noUpdateAvailableKey,
      JSON.stringify({
        body: '{"type":"noUpdateAvailable"}',
        signature: 'sig="nua", keyid="main", alg="rsa-v1_5-sha256"',
      }),
    );

    const response = await manifestRequest({
      'expo-current-update-id': '11111111-2222-3333-4444-555555555555',
    });
    const body = await response.text();

    expect(body).toContain('name="directive"');
    expect(body).toContain('{"type":"noUpdateAvailable"}');
    expect(body).not.toContain(manifestBody);
  });

  it('serves the rollback directive when the pointer is a rollback', async () => {
    await env.UPDATES.put(
      pointerKey('android', runtimeVersion),
      JSON.stringify({
        kind: 'rollback',
        body: '{"type":"rollBackToEmbedded","parameters":{"commitTime":"2026-08-26T00:00:00.000Z"}}',
        signature: 'sig="rb", keyid="main", alg="rsa-v1_5-sha256"',
      }),
    );

    const body = await manifestRequest({
      'expo-embedded-update-id': 'embedded-1',
      'expo-current-update-id': '11111111-2222-3333-4444-555555555555',
    }).then((response) => response.text());

    expect(body).toContain('rollBackToEmbedded');
    expect(body).toContain('expo-signature: sig="rb"');
  });

  it('serves noUpdateAvailable when a rollback already took effect', async () => {
    await env.UPDATES.put(
      pointerKey('android', runtimeVersion),
      JSON.stringify({
        kind: 'rollback',
        body: '{"type":"rollBackToEmbedded","parameters":{"commitTime":"2026-08-26T00:00:00.000Z"}}',
        signature: 'sig="rb", keyid="main", alg="rsa-v1_5-sha256"',
      }),
    );
    await env.UPDATES.put(
      noUpdateAvailableKey,
      JSON.stringify({
        body: '{"type":"noUpdateAvailable"}',
        signature: 'sig="nua", keyid="main", alg="rsa-v1_5-sha256"',
      }),
    );

    // The client already runs the embedded update, so there is nothing to do.
    const body = await manifestRequest({
      'expo-embedded-update-id': 'embedded-1',
      'expo-current-update-id': 'embedded-1',
    }).then((response) => response.text());

    expect(body).toContain('{"type":"noUpdateAvailable"}');
    expect(body).not.toContain('rollBackToEmbedded');
  });

  it('rejects an unsupported platform', async () => {
    const response = await manifestRequest({ 'expo-platform': 'windows' });
    expect(response.status).toBe(400);
  });

  it('rejects a request with no runtime version', async () => {
    const response = await SELF.fetch('https://ota.test/api/manifest', {
      headers: { 'expo-platform': 'android' },
    });
    expect(response.status).toBe(400);
  });

  it('rejects a method other than GET', async () => {
    const response = await SELF.fetch('https://ota.test/api/manifest', { method: 'POST' });
    expect(response.status).toBe(405);
  });
});
```

- [ ] **Step 2: Write the failing asset and pointer route tests**

Create `ota/worker/test/assets.test.ts`:

```ts
import { env, SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

describe('GET /assets/:hash', () => {
  it('streams the object and marks it immutable', async () => {
    await env.ASSETS.put('assets/abc123', 'FONTDATA', {
      httpMetadata: { contentType: 'font/ttf' },
    });

    const response = await SELF.fetch('https://ota.test/assets/abc123');

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('FONTDATA');
    expect(response.headers.get('content-type')).toBe('font/ttf');
    expect(response.headers.get('cache-control')).toBe(
      'public, max-age=31536000, immutable',
    );
  });

  it('returns 404 for an object that is absent', async () => {
    const response = await SELF.fetch('https://ota.test/assets/missing');
    expect(response.status).toBe(404);
  });
});
```

Create `ota/worker/test/pointerRoute.test.ts`:

```ts
import { env, SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

import { pointerKey } from '../src/pointer';

const record = {
  key: pointerKey('android', 'fingerprint-2'),
  value: {
    kind: 'update',
    updateId: '11111111-2222-3333-4444-555555555555',
    body: '{"id":"11111111-2222-3333-4444-555555555555"}',
    signature: 'sig="abc", keyid="main", alg="rsa-v1_5-sha256"',
  },
};

function putPointer(token: string | null) {
  return SELF.fetch('https://ota.test/api/pointer', {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(record),
  });
}

describe('PUT /api/pointer', () => {
  it('writes the record when the token is correct', async () => {
    const response = await putPointer('test-token');

    expect(response.status).toBe(204);
    expect(await env.UPDATES.get(record.key, 'json')).toEqual(record.value);
  });

  it('rejects a request with no token', async () => {
    expect((await putPointer(null)).status).toBe(401);
  });

  it('rejects a request with a wrong token', async () => {
    expect((await putPointer('wrong-token')).status).toBe(401);
  });

  it('rejects a body with no key', async () => {
    const response = await SELF.fetch('https://ota.test/api/pointer', {
      method: 'PUT',
      headers: {
        authorization: 'Bearer test-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ value: record.value }),
    });

    expect(response.status).toBe(400);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd ota/worker && pnpm test`
Expected: FAIL. Every manifest, asset, and pointer test returns 404 from the placeholder Worker.

- [ ] **Step 4: Write `ota/worker/src/manifest.ts`**

```ts
import type { Env } from './index';
import { buildMultipartResponse, type MultipartPart } from './multipart';
import { readNoUpdateAvailable, readPointer, type SignedBody } from './pointer';

const supportedPlatforms = new Set(['android', 'ios']);

function signedPart(name: string, signed: SignedBody): MultipartPart {
  return {
    name,
    body: signed.body,
    contentType: 'application/json; charset=utf-8',
    headers: { 'expo-signature': signed.signature },
  };
}

async function noUpdateAvailableResponse(env: Env): Promise<Response> {
  const directive = await readNoUpdateAvailable(env.UPDATES);
  // With no signed directive stored, a body with no parts is the safe answer:
  // the client keeps its current bundle.
  if (!directive) {
    return buildMultipartResponse([]);
  }
  return buildMultipartResponse([signedPart('directive', directive)]);
}

export async function handleManifest(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') {
    return new Response('expected GET', { status: 405 });
  }

  const platform = request.headers.get('expo-platform');
  if (!platform || !supportedPlatforms.has(platform)) {
    return new Response('unsupported expo-platform', { status: 400 });
  }

  const runtimeVersion = request.headers.get('expo-runtime-version');
  if (!runtimeVersion) {
    return new Response('missing expo-runtime-version', { status: 400 });
  }

  const currentUpdateId = request.headers.get('expo-current-update-id');
  const pointer = await readPointer(env.UPDATES, platform, runtimeVersion);

  // No pointer means this build has no update. The protocol reads a body with
  // no parts as "nothing available", which keeps old builds working.
  if (!pointer) {
    return buildMultipartResponse([]);
  }

  if (pointer.kind === 'rollback') {
    const embeddedUpdateId = request.headers.get('expo-embedded-update-id');
    if (!embeddedUpdateId) {
      return new Response('missing expo-embedded-update-id', { status: 400 });
    }
    if (currentUpdateId === embeddedUpdateId) {
      return await noUpdateAvailableResponse(env);
    }
    return buildMultipartResponse([signedPart('directive', pointer)]);
  }

  if (currentUpdateId === pointer.updateId) {
    return await noUpdateAvailableResponse(env);
  }

  return buildMultipartResponse([signedPart('manifest', pointer)]);
}
```

- [ ] **Step 5: Write `ota/worker/src/assets.ts`**

```ts
import type { Env } from './index';

export async function handleAsset(hash: string, env: Env): Promise<Response> {
  const object = await env.ASSETS.get(`assets/${hash}`);
  // The client abandons the update and keeps its current bundle on a 404.
  if (!object) {
    return new Response('not found', { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  // Asset keys are content addressed, so an object never changes.
  headers.set('cache-control', 'public, max-age=31536000, immutable');

  return new Response(object.body, { status: 200, headers });
}
```

- [ ] **Step 6: Write `ota/worker/src/index.ts`**

```ts
import { handleAsset } from './assets';
import { handleManifest } from './manifest';

export type Env = {
  UPDATES: KVNamespace;
  ASSETS: R2Bucket;
  OTA_PUBLISH_TOKEN: string;
};

function isAuthorized(request: Request, env: Env): boolean {
  const header = request.headers.get('authorization');
  return header === `Bearer ${env.OTA_PUBLISH_TOKEN}`;
}

async function handlePointer(request: Request, env: Env): Promise<Response> {
  if (!isAuthorized(request, env)) {
    return new Response('unauthorized', { status: 401 });
  }

  let payload: { key?: unknown; value?: unknown };
  try {
    payload = (await request.json()) as { key?: unknown; value?: unknown };
  } catch {
    return new Response('expected a json body', { status: 400 });
  }

  if (typeof payload.key !== 'string' || !payload.key || !payload.value) {
    return new Response('expected a key and a value', { status: 400 });
  }

  await env.UPDATES.put(payload.key, JSON.stringify(payload.value));
  return new Response(null, { status: 204 });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (pathname === '/api/manifest') {
      return await handleManifest(request, env);
    }

    if (pathname === '/api/pointer') {
      if (request.method !== 'PUT') {
        return new Response('expected PUT', { status: 405 });
      }
      return await handlePointer(request, env);
    }

    const assetMatch = pathname.match(/^\/assets\/([A-Za-z0-9_-]+)$/);
    if (assetMatch?.[1]) {
      if (request.method !== 'GET') {
        return new Response('expected GET', { status: 405 });
      }
      return await handleAsset(assetMatch[1], env);
    }

    return new Response('not found', { status: 404 });
  },
};
```

- [ ] **Step 7: Run the tests and typecheck to verify they pass**

Run: `cd ota/worker && pnpm test && pnpm typecheck`
Expected: PASS, fourteen tests across three files, and no type errors.

- [ ] **Step 8: Commit**

```bash
git add ota/worker
git commit -m "feat: add manifest, asset and pointer routes to the update Worker"
```

---

## Task 6: The publish command

**Files:**
- Create: `scripts/ota/r2.mjs`
- Create: `scripts/ota/pointerClient.mjs`
- Create: `scripts/ota-publish.mjs`
- Modify: `package.json`
- Test: `scripts/__tests__/ota-publish.test.ts`

**Interfaces:**
- Consumes: `buildManifest` from `scripts/ota/manifest.mjs`; `signBody`, `formatSignatureHeader`, `readKeyId`, `readPrivateKey` from `scripts/ota/sign.mjs`
- Produces:
  - `r2.mjs`: `uploadFile({ bucket, hash, absolutePath, contentType, run }): void`
  - `pointerClient.mjs`: `putPointer({ workerUrl, token, key, value, fetchImpl }): Promise<void>`
  - `ota-publish.mjs`: `publish({ options, run, fetchImpl, log }): Promise<{ updateId: string, runtimeVersion: string }>`, plus a CLI entry point

`run` and `fetchImpl` are injected so the test can drive the whole command without touching Cloudflare or running a real export.

- [ ] **Step 1: Write the failing test**

Create `scripts/__tests__/ota-publish.test.ts`:

```ts
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
  writeFileSync(join(directory, 'expoConfig.json'), JSON.stringify({ slug: 'motivana' }));
}

function makeRun(overrides: Record<string, { stdout?: string; status?: number }> = {}) {
  return (command: string, args: string[]) => {
    commands.push({ command, args });
    const key = [command, ...args].join(' ');
    const override = Object.entries(overrides).find(([prefix]) => key.startsWith(prefix));
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
    await publish({ options: baseOptions(), run: makeRun(), fetchImpl, log: () => {} });

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
    await publish({ options: baseOptions(), run: makeRun(), fetchImpl, log: () => {} });

    const payload = JSON.parse(String(requests[0]!.init.body));
    const manifest = JSON.parse(payload.value.body);
    expect(manifest.runtimeVersion).toBe('fingerprint-abc');
    expect(payload.value.signature).toMatch(
      /^sig="[^"]+", keyid="motivana-root", alg="rsa-v1_5-sha256"$/,
    );
  });

  it('points asset urls at the Worker', async () => {
    await publish({ options: baseOptions(), run: makeRun(), fetchImpl, log: () => {} });

    const manifest = JSON.parse(JSON.parse(String(requests[0]!.init.body)).value.body);
    expect(manifest.launchAsset.url).toMatch(/^https:\/\/ota\.test\/assets\//);
  });

  it('sends the publish token', async () => {
    await publish({ options: baseOptions(), run: makeRun(), fetchImpl, log: () => {} });

    expect((requests[0]!.init.headers as Record<string, string>).authorization).toBe(
      'Bearer test-token',
    );
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
    const keys = requests.map((entry) => JSON.parse(String(entry.init.body)).key);
    expect(keys[0]).toMatch(/^update:/);
    expect(keys[1]).toBe('pointer:android:fingerprint-abc');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test scripts/__tests__/ota-publish.test.ts`
Expected: FAIL, cannot resolve `../ota-publish.mjs`.

- [ ] **Step 3: Confirm what the fingerprint command prints**

Run: `npx expo-updates fingerprint:generate --platform android --help`, then
run the command itself and look at stdout.

The implementation below assumes stdout is JSON holding a `hash` field. If the
real output differs, adapt the parse inside `publish()` to match, and keep the
injected `run` contract that the tests depend on. A wrong parse writes the
pointer under a key no build ever requests, so updates silently reach nobody.

- [ ] **Step 4: Write `scripts/ota/r2.mjs`**

```js
// The wrangler CLI handles Cloudflare authentication, so no S3 signing code
// and no R2 access key are needed. It reads CLOUDFLARE_API_TOKEN, or the
// session from wrangler login.
export function uploadFile({ bucket, hash, absolutePath, contentType, run }) {
  run('npx', [
    'wrangler',
    'r2',
    'object',
    'put',
    `${bucket}/assets/${hash}`,
    '--file',
    absolutePath,
    '--content-type',
    contentType,
    '--remote',
  ]);
}
```

- [ ] **Step 5: Write `scripts/ota/pointerClient.mjs`**

```js
export async function putPointer({ workerUrl, token, key, value, fetchImpl }) {
  const response = await fetchImpl(`${workerUrl}/api/pointer`, {
    method: 'PUT',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ key, value }),
  });

  if (!response.ok) {
    throw new Error(
      `PUT ${workerUrl}/api/pointer returned ${response.status}. The pointer was not written.`,
    );
  }
}
```

- [ ] **Step 6: Write `scripts/ota-publish.mjs`**

```js
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
    run('npx', ['expo', 'export', '--platform', options.platform, '--output-dir', options.distDirectory]);
  }

  // The parse must match what the installed expo-updates CLI actually prints.
  // Confirm the shape against the CLI before trusting this line.
  const fingerprint = JSON.parse(
    run('npx', ['expo-updates', 'fingerprint:generate', '--platform', options.platform]).stdout,
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
    throw new Error('Set OTA_WORKER_URL and OTA_PUBLISH_TOKEN before publishing.');
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
```

- [ ] **Step 7: Add the script to `package.json`**

In `scripts`, add:

```json
"ota:publish": "node scripts/ota-publish.mjs",
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `pnpm test scripts/__tests__/ota-publish.test.ts`
Expected: PASS, eight tests.

- [ ] **Step 9: Commit**

```bash
git add scripts/ota/r2.mjs scripts/ota/pointerClient.mjs scripts/ota-publish.mjs scripts/__tests__/ota-publish.test.ts package.json
git commit -m "feat: add the over-the-air update publish command"
```

---

## Task 7: The rollback command

**Files:**
- Create: `scripts/ota-rollback.mjs`
- Modify: `package.json`
- Test: `scripts/__tests__/ota-rollback.test.ts`

**Interfaces:**
- Consumes: `putPointer` from `scripts/ota/pointerClient.mjs`; `signBody`, `formatSignatureHeader`, `readKeyId`, `readPrivateKey` from `scripts/ota/sign.mjs`
- Produces: `rollback({ options, run, fetchImpl, log }): Promise<void>` and a CLI entry point

- [ ] **Step 1: Write the failing test**

Create `scripts/__tests__/ota-rollback.test.ts`:

```ts
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
  if ([command, ...args].join(' ').startsWith('npx expo-updates fingerprint:generate')) {
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
      options: { ...baseOptions(), to: 'embedded', commitTime: '2026-08-26T00:00:00.000Z' },
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test scripts/__tests__/ota-rollback.test.ts`
Expected: FAIL, cannot resolve `../ota-rollback.mjs`.

- [ ] **Step 3: Write `scripts/ota-rollback.mjs`**

```js
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { putPointer } from './ota/pointerClient.mjs';
import {
  formatSignatureHeader,
  readKeyId,
  readPrivateKey,
  signBody,
} from './ota/sign.mjs';
import { runCommand } from './ota-publish.mjs';

async function readArchivedUpdate({ workerUrl, token, updateId, fetchImpl }) {
  const response = await fetchImpl(`${workerUrl}/api/pointer?key=update:${updateId}`, {
    method: 'GET',
    headers: { authorization: `Bearer ${token}` },
  });
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
      run('npx', ['expo-updates', 'fingerprint:generate', '--platform', options.platform])
        .stdout,
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
          parameters: { commitTime: options.commitTime ?? new Date().toISOString() },
        },
        appJsonPath: options.appJsonPath,
      }),
    };
    await putPointer({ ...options, key, value, fetchImpl });
    log(`Rolled ${options.platform} ${runtimeVersion} back to the embedded bundle`);
    return;
  }

  const archived = await readArchivedUpdate({
    workerUrl: options.workerUrl,
    token: options.token,
    updateId: options.to,
    fetchImpl,
  });
  await putPointer({ ...options, key, value: archived, fetchImpl });
  log(`Rolled ${options.platform} ${runtimeVersion} back to update ${options.to}`);
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
    throw new Error('Set OTA_WORKER_URL and OTA_PUBLISH_TOKEN before a rollback.');
  }

  return {
    to: values.to,
    platform: values.platform,
    runtimeVersion: values['runtime-version'],
    appJsonPath: resolve('app.json'),
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
```

- [ ] **Step 4: Add a `GET /api/pointer` route to the Worker**

The rollback command reads an archived update, so the Worker needs an authenticated read. In `ota/worker/src/index.ts`, replace the `/api/pointer` branch with:

```ts
    if (pathname === '/api/pointer') {
      if (!isAuthorized(request, env)) {
        return new Response('unauthorized', { status: 401 });
      }
      if (request.method === 'GET') {
        const key = new URL(request.url).searchParams.get('key');
        if (!key) {
          return new Response('expected a key parameter', { status: 400 });
        }
        const stored = await env.UPDATES.get(key);
        if (!stored) {
          return new Response('not found', { status: 404 });
        }
        return new Response(stored, {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (request.method !== 'PUT') {
        return new Response('expected GET or PUT', { status: 405 });
      }
      return await handlePointer(request, env);
    }
```

Then remove the now-duplicated authorization check from the top of `handlePointer`.

- [ ] **Step 5: Add a Worker test for the read route**

Append to `ota/worker/test/pointerRoute.test.ts`:

```ts
describe('GET /api/pointer', () => {
  it('returns a stored record to an authorized reader', async () => {
    await env.UPDATES.put('update:abc', JSON.stringify(record.value));

    const response = await SELF.fetch('https://ota.test/api/pointer?key=update:abc', {
      headers: { authorization: 'Bearer test-token' },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(record.value);
  });

  it('returns 404 for a record that is absent', async () => {
    const response = await SELF.fetch('https://ota.test/api/pointer?key=update:missing', {
      headers: { authorization: 'Bearer test-token' },
    });
    expect(response.status).toBe(404);
  });

  it('rejects an unauthorized reader', async () => {
    const response = await SELF.fetch('https://ota.test/api/pointer?key=update:abc');
    expect(response.status).toBe(401);
  });
});
```

- [ ] **Step 6: Add the script to `package.json`**

In `scripts`, add:

```json
"ota:rollback": "node scripts/ota-rollback.mjs",
```

- [ ] **Step 7: Run every test to verify they pass**

Run: `pnpm test scripts/__tests__/ota-rollback.test.ts && cd ota/worker && pnpm test && pnpm typecheck`
Expected: PASS, four rollback tests and seventeen Worker tests.

- [ ] **Step 8: Commit**

```bash
git add scripts/ota-rollback.mjs scripts/__tests__/ota-rollback.test.ts ota/worker package.json
git commit -m "feat: add the over-the-air update rollback command"
```

---

## Task 8: Provision Cloudflare, wire the verify chain, and document the runbook

This is the task that makes the system real. It ends with a device applying an update.

**Files:**
- Modify: `ota/worker/wrangler.jsonc`
- Modify: `package.json`
- Create: `ota/README.md`
- Modify: `docs/QA_CHECKLIST.md`

**Interfaces:**
- Consumes: everything from Tasks 1 to 7
- Produces: a deployed Worker, and `pnpm verify` covering the Worker tests

- [ ] **Step 1: Create the Cloudflare resources**

```bash
cd ota/worker
npx wrangler login
npx wrangler kv namespace create UPDATES
npx wrangler r2 bucket create motivana-ota-assets
```

Copy the KV namespace id that the second command prints into `wrangler.jsonc`, replacing `REPLACE_WITH_KV_ID`.

- [ ] **Step 2: Set the publish token**

```bash
export OTA_PUBLISH_TOKEN="$(openssl rand -hex 32)"
npx wrangler secret put OTA_PUBLISH_TOKEN
```

Paste the same value at the prompt. Keep it in your shell profile or password manager. It is the only thing that guards the pointer write path.

- [ ] **Step 3: Deploy the Worker**

Run: `npx wrangler deploy`
Expected: it prints the deployed URL, for example `https://motivana-ota.<subdomain>.workers.dev`.

- [ ] **Step 4: Confirm the deployed Worker answers correctly**

```bash
curl -i "https://motivana-ota.<subdomain>.workers.dev/api/manifest" \
  -H 'expo-protocol-version: 1' \
  -H 'expo-platform: android' \
  -H 'expo-runtime-version: not-a-real-fingerprint'
```

Expected: `200`, `expo-protocol-version: 1`, and a body holding only the closing boundary. A build with no update must never see an error.

- [ ] **Step 5: Set the update URL in `app.json`**

Replace the placeholder host in `expo.updates.url` with the deployed URL from Step 3, keeping the `/api/manifest` path. Then confirm Task 1's test still passes:

Run: `pnpm test scripts/__tests__/ota-config.test.ts`
Expected: PASS.

- [ ] **Step 6: Store the signed `noUpdateAvailable` directive**

```bash
export OTA_WORKER_URL="https://motivana-ota.<subdomain>.workers.dev"
export OTA_PRIVATE_KEY_PATH=~/.motivana-ota/private-key.pem
pnpm ota:rollback --to no-update-available
```

Expected: `Stored the signed noUpdateAvailable directive`. Without this the Worker falls back to a body with no parts, which works but makes every launch re-download the manifest.

- [ ] **Step 7: Add the Worker tests to `pnpm verify`**

In `package.json`, add a script and extend `verify`:

```json
"test:worker": "cd ota/worker && pnpm test",
"verify": "pnpm format:check && pnpm lint && pnpm typecheck && pnpm verify:data && pnpm verify:android-permissions && pnpm test && pnpm test:worker && pnpm verify:native",
```

- [ ] **Step 8: Run the whole verify chain**

Run: `pnpm verify`
Expected: PASS at every stage.

- [ ] **Step 9: Write the runbook**

Create `ota/README.md`:

```markdown
# Over-the-air updates

Motivana serves JavaScript and asset updates from a Cloudflare Worker.
The design is in `docs/superpowers/specs/2026-08-26-cloudflare-ota-updates-design.md`.

## What an update cannot do

An update carries JavaScript and assets only. It can never carry native code.
`runtimeVersion` uses the fingerprint policy, so a build only receives an
update built from the same native project. After any change to
`modules/motivana-wallpaper`, to a native dependency, or to `app.json`
plugins, the fingerprint changes and a store release is required.

## Environment

| Name | Purpose |
| --- | --- |
| `OTA_PRIVATE_KEY_PATH` | The signing key, kept outside this repository. |
| `OTA_PUBLISH_TOKEN` | Bearer token for the pointer routes. Also a Worker secret. |
| `OTA_WORKER_URL` | The deployed Worker origin, with no trailing slash. |
| `CLOUDFLARE_API_TOKEN` | Used by wrangler for asset upload. Optional after `wrangler login`. |

## Publish

    pnpm ota:publish

It refuses to run on a dirty worktree, because a fingerprint that matches no
commit cannot be traced to a released build. It uploads every asset before it
writes the pointer, so an interrupted publish leaves the live update intact.

## Roll back

    pnpm ota:rollback --to <updateId>   # an earlier update, already archived
    pnpm ota:rollback --to embedded     # the bundle inside the installed binary

Use `--to embedded` when no earlier update is good. Clients revert to the
bundle in their installed binary.

## Deploy the Worker

    cd ota/worker && npx wrangler deploy
```

- [ ] **Step 10: Add the update path to the QA checklist**

Append to `docs/QA_CHECKLIST.md`:

```markdown
## Over-the-air updates

- [ ] A fresh install starts with no network, and shows the embedded bundle.
- [ ] After `pnpm ota:publish`, the app applies the update on the second launch.
- [ ] With the Worker unreachable, the app still starts on its current bundle.
- [ ] After `pnpm ota:rollback --to embedded`, the app returns to the bundle in its binary.
- [ ] A build whose fingerprint has no pointer starts normally and stays on its own bundle.
```

- [ ] **Step 11: Commit**

```bash
git add ota package.json app.json docs/QA_CHECKLIST.md
git commit -m "feat: deploy the update Worker and document the publish runbook"
```

- [ ] **Step 12: Release a store build**

```bash
npx expo prebuild --platform android --clean
eas build --platform android --profile production
```

Submit the build. **Updates reach nobody until this build is installed.** The
signing certificate and the update URL live inside the binary, so the current
0.1.0 installs can never receive an update.

- [ ] **Step 13: Confirm an update reaches a device**

1. Install the production build from Step 12 on a device.
2. Make a small visible JavaScript change, for example a label in `app/settings.tsx`.
3. Commit it, then run `pnpm ota:publish`.
4. Start the app. It downloads in the background and shows the old text.
5. Close and start the app again. It shows the new text.

Expected: the change appears on the second launch. If it does not, read the
Worker logs with `cd ota/worker && npx wrangler tail` and check that the
`expo-runtime-version` in the request matches the pointer key that
`pnpm ota:publish` printed.

---

## Self-Review

**Spec coverage**

| Spec section | Task |
| --- | --- |
| 1 Architecture, publish-time signing | 3, 6 |
| 2 Layout | 2, 4, 6, 7 |
| 3 Data model, content-addressed R2, KV pointers, update archive | 4, 5, 6 |
| 4 runtimeVersion fingerprint, dirty worktree guard | 1, 6 |
| 5 Worker endpoints, manifest, assets, pointer | 5 |
| 6 Rollback to an update and to embedded | 7 |
| 7 Error handling, fail open, publish ordering | 5, 6 |
| 8 Update behavior in the app | 1, 8 (`expo-updates` defaults: check on launch, apply on next launch) |
| 9 Testing, signature round trip | 3, 4, 5, 6, 7, 8 |
| 10 Secrets | 1, 8 |
| 11 Phases | 1 to 8 in order |
| 12 Details to confirm | resolved before this plan: `hash` is unpadded base64url sha256, `key` is md5 hex, and a self-signed certificate needs no `certificate_chain` part because the certificate is embedded in the build |

**Changes this plan makes to the spec**

1. **R2 upload uses the `wrangler` CLI, not the S3 API.** This removes the SigV4 code and the R2 access key and secret from spec section 10. `CLOUDFLARE_API_TOKEN` replaces them.
2. **Two protocol cases the spec did not cover.** A client that already runs the offered update must receive a `noUpdateAvailable` directive, and the rollback path must compare `expo-embedded-update-id`. Both bodies are signed, so `pnpm ota:rollback --to no-update-available` signs the constant body once at setup.
3. **The Worker gained `GET /api/pointer`.** The rollback command reads an archived update through it. It uses the same bearer token.

Update the spec's sections 5, 6, 7 and 10 to match, or accept the plan as the newer record.
