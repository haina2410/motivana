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
