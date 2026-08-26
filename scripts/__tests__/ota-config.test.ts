import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repositoryRoot = resolve(__dirname, '../..');

function readAppConfig() {
  return JSON.parse(readFileSync(resolve(repositoryRoot, 'app.json'), 'utf8'))
    .expo;
}

describe('over-the-air update configuration', () => {
  it('uses the fingerprint runtime version policy', () => {
    // A fixed runtime version string lets a JavaScript-only update reach a
    // build without the matching motivana-wallpaper native code, which
    // crashes the app. The fingerprint changes whenever native code changes.
    expect(readAppConfig().runtimeVersion).toEqual({ policy: 'fingerprint' });
  });

  it('points updates at the Motivana update server', () => {
    expect(readAppConfig().updates.url).toMatch(
      /^https:\/\/.+\/api\/manifest$/,
    );
  });

  it('requires signed updates', () => {
    const { updates } = readAppConfig();
    expect(updates.codeSigningCertificate).toBe('./certs/certificate.pem');
    expect(updates.codeSigningMetadata.alg).toBe('rsa-v1_5-sha256');
    expect(typeof updates.codeSigningMetadata.keyid).toBe('string');
    expect(updates.codeSigningMetadata.keyid.length).toBeGreaterThan(0);
  });

  it('commits the public certificate and not the private key', () => {
    expect(existsSync(resolve(repositoryRoot, 'certs/certificate.pem'))).toBe(
      true,
    );
    expect(existsSync(resolve(repositoryRoot, 'certs/private-key.pem'))).toBe(
      false,
    );
  });
});
