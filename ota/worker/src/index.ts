import { handleAsset } from './assets';
import { handleManifest } from './manifest';

export type Env = {
  UPDATES: KVNamespace;
  ASSETS: R2Bucket;
  OTA_PUBLISH_TOKEN: string;
};

// Constant-time comparison for the bearer token. This is defence in depth,
// not the last line of defence: a token holder can only store records that
// were already signed by the publish-time private key, so the worst a leaked
// token buys is a downgrade to an older signed update, or garbage the client
// rejects on signature verification -- not arbitrary code execution. Code
// signing is what actually protects users; this just avoids leaking the
// token's value through response-time differences.
function isAuthorized(request: Request, env: Env): boolean {
  const header = request.headers.get('authorization');
  if (!header) {
    return false;
  }

  const expected = `Bearer ${env.OTA_PUBLISH_TOKEN}`;
  const encoder = new TextEncoder();
  const headerBytes = encoder.encode(header);
  const expectedBytes = encoder.encode(expected);

  // timingSafeEqual throws on unequal lengths, so check that first.
  if (headerBytes.byteLength !== expectedBytes.byteLength) {
    return false;
  }

  return crypto.subtle.timingSafeEqual(headerBytes, expectedBytes);
}

async function handlePointer(request: Request, env: Env): Promise<Response> {
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
