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

describe('GET /api/pointer', () => {
  it('returns a stored record to an authorized reader', async () => {
    await env.UPDATES.put('update:abc', JSON.stringify(record.value));

    const response = await SELF.fetch(
      'https://ota.test/api/pointer?key=update:abc',
      {
        headers: { authorization: 'Bearer test-token' },
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(record.value);
  });

  it('returns 404 for a record that is absent', async () => {
    const response = await SELF.fetch(
      'https://ota.test/api/pointer?key=update:missing',
      {
        headers: { authorization: 'Bearer test-token' },
      },
    );
    expect(response.status).toBe(404);
  });

  it('rejects an unauthorized reader', async () => {
    const response = await SELF.fetch(
      'https://ota.test/api/pointer?key=update:abc',
    );
    expect(response.status).toBe(401);
  });
});
