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
    expect(body).toContain(
      'expo-signature: sig="abc", keyid="main", alg="rsa-v1_5-sha256"',
    );
    expect(body).toContain('content-disposition: form-data; name="manifest"');
  });

  it('serves a body with no parts when the runtime version has no update', async () => {
    const response = await manifestRequest({
      'expo-runtime-version': 'fingerprint-unknown',
    });
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

  it('rejects a rollback pointer with no expo-embedded-update-id header', async () => {
    await env.UPDATES.put(
      pointerKey('android', runtimeVersion),
      JSON.stringify({
        kind: 'rollback',
        body: '{"type":"rollBackToEmbedded","parameters":{"commitTime":"2026-08-26T00:00:00.000Z"}}',
        signature: 'sig="rb", keyid="main", alg="rsa-v1_5-sha256"',
      }),
    );

    const response = await manifestRequest({
      'expo-current-update-id': '11111111-2222-3333-4444-555555555555',
    });

    expect(response.status).toBe(400);
  });

  it('falls back to a body with no parts when noUpdateAvailable has no signed directive', async () => {
    await putUpdatePointer();
    // noUpdateAvailableKey is deliberately absent here.

    const response = await manifestRequest({
      'expo-current-update-id': '11111111-2222-3333-4444-555555555555',
    });
    const boundary =
      response.headers.get('content-type')?.match(/boundary=(\S+)/)?.[1] ?? '';
    const body = await response.text();

    expect(body).toBe(`--${boundary}--\r\n`);
    expect(body).not.toContain(manifestBody);
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
    const response = await SELF.fetch('https://ota.test/api/manifest', {
      method: 'POST',
    });
    expect(response.status).toBe(405);
  });
});
