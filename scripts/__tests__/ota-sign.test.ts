import {
  createPublicKey,
  createVerify,
  generateKeyPairSync,
} from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import {
  formatSignatureHeader,
  readKeyId,
  readPrivateKey,
  signBody,
} from '../ota/sign.mjs';

let workingDirectory: string;

// Captured before beforeEach clears it: the real signing key path, if this
// machine has one.
const configuredKeyPath = process.env.OTA_PRIVATE_KEY_PATH;

beforeEach(() => {
  workingDirectory = mkdtempSync(join(tmpdir(), 'ota-sign-'));
  delete process.env.OTA_PRIVATE_KEY_PATH;
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
    const header = formatSignatureHeader({
      signature: 'AbC+/12=',
      keyid: 'main',
    });

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

  it('rejects a keyid containing a double quote', () => {
    const appJsonPath = join(workingDirectory, 'app.json');
    writeFileSync(
      appJsonPath,
      JSON.stringify({
        expo: { updates: { codeSigningMetadata: { keyid: 'main"evil' } } },
      }),
    );

    expect(() => readKeyId(appJsonPath)).toThrow(
      /expo\.updates\.codeSigningMetadata\.keyid/,
    );
  });

  it('rejects a keyid containing a backslash', () => {
    const appJsonPath = join(workingDirectory, 'app.json');
    writeFileSync(
      appJsonPath,
      JSON.stringify({
        expo: { updates: { codeSigningMetadata: { keyid: 'main\\evil' } } },
      }),
    );

    expect(() => readKeyId(appJsonPath)).toThrow(
      /expo\.updates\.codeSigningMetadata\.keyid/,
    );
  });

  it('accepts a keyid using every allowed character class', () => {
    const appJsonPath = join(workingDirectory, 'app.json');
    const keyid = 'Motivana-root_key.v2';
    writeFileSync(
      appJsonPath,
      JSON.stringify({
        expo: { updates: { codeSigningMetadata: { keyid } } },
      }),
    );

    expect(readKeyId(appJsonPath)).toBe(keyid);
  });
});

// Spec section 9 names this test as the guard against key-format drift, the
// most probable silent failure: a key the signer cannot use, or one that does
// not match the certificate the app ships, breaks every update at
// verification time on device and nowhere earlier.
//
// It needs the real private key, which is deliberately kept outside this
// repository, so it skips where OTA_PRIVATE_KEY_PATH is unset. CI and other
// machines are unaffected; the machine that publishes gets the check.
describe('the committed certificate', () => {
  const itWithKey = configuredKeyPath ? it : it.skip;

  itWithKey('verifies a signature made with the configured private key', () => {
    process.env.OTA_PRIVATE_KEY_PATH = configuredKeyPath;
    const certificate = readFileSync(
      resolve(__dirname, '../../certs/certificate.pem'),
      'utf8',
    );
    const publicKey = createPublicKey(certificate);
    const body = JSON.stringify({
      id: '11111111-2222-3333-4444-555555555555',
      runtimeVersion: 'fingerprint-1',
    });

    const signature = signBody(body, readPrivateKey());

    const verifier = createVerify('RSA-SHA256');
    verifier.update(body, 'utf8');
    verifier.end();
    expect(verifier.verify(publicKey, signature, 'base64')).toBe(true);

    // The same certificate must reject a changed body, so the assertion above
    // cannot pass by accident.
    const tampered = createVerify('RSA-SHA256');
    tampered.update(`${body} `, 'utf8');
    tampered.end();
    expect(tampered.verify(publicKey, signature, 'base64')).toBe(false);
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
