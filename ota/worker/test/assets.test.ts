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
