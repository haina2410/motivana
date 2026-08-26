import { describe, expect, it } from 'vitest';

import { buildMultipartResponse } from '../src/multipart';

async function readBody(response: Response) {
  return await response.text();
}

describe('buildMultipartResponse', () => {
  it('always states the protocol version and structured field version', async () => {
    const response = buildMultipartResponse([
      { name: 'manifest', body: '{"id":"a"}', contentType: 'application/json' },
    ]);

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

    expect(await readBody(response)).toContain(
      'expo-signature: sig="abc", keyid="main"',
    );
  });

  it('writes the part body without changing a byte', async () => {
    // The signature covers these exact bytes. Any reserialization breaks it.
    const body = '{"id":"a","extra":{"expoClient":{"name":"Motivana"}}}';
    const response = buildMultipartResponse([
      { name: 'manifest', body, contentType: 'application/json' },
    ]);

    expect(await readBody(response)).toContain(body);
  });

  it('answers no parts with 204, never a zero-part body', async () => {
    // A zero-part body reaches okhttp's MultipartReader, which throws
    // ProtocolException("expected at least 1 part"). The client would log
    // UpdateFailedToLoad on every launch of a build with no pointer.
    const response = buildMultipartResponse([]);

    expect(response.status).toBe(204);
    expect(response.headers.get('content-type')).toBeNull();
    expect(await readBody(response)).toBe('');
  });

  it('keeps the protocol headers on the 204', async () => {
    const response = buildMultipartResponse([]);

    expect(response.headers.get('expo-protocol-version')).toBe('1');
    expect(response.headers.get('expo-sfv-version')).toBe('0');
    expect(response.headers.get('cache-control')).toBe('private, max-age=0');
  });
});
