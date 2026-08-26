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
