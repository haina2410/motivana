import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function signBody(body, privateKeyPem) {
  const signer = createSign('RSA-SHA256');
  signer.update(body, 'utf8');
  signer.end();
  return signer.sign(privateKeyPem, 'base64');
}

// A structured field dictionary. Base64 (the `signature` value) contains no
// quote and no backslash, so quoting it needs no escaping. `keyid` is
// validated by readKeyId before it ever reaches here.
export function formatSignatureHeader({ signature, keyid }) {
  return `sig="${signature}", keyid="${keyid}", alg="rsa-v1_5-sha256"`;
}

const SAFE_KEYID = /^[A-Za-z0-9._-]+$/;

export function readKeyId(appJsonPath) {
  const appConfig = JSON.parse(readFileSync(resolve(appJsonPath), 'utf8'));
  const keyid = appConfig.expo?.updates?.codeSigningMetadata?.keyid;
  if (!keyid) {
    throw new Error(
      `No expo.updates.codeSigningMetadata.keyid in ${appJsonPath}. Run npx expo-updates codesigning:configure.`,
    );
  }
  if (!SAFE_KEYID.test(keyid)) {
    throw new Error(
      `Invalid expo.updates.codeSigningMetadata.keyid "${keyid}": only letters, digits, ".", "_", and "-" are allowed.`,
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
