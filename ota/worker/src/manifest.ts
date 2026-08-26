import type { Env } from './index';
import { buildMultipartResponse, type MultipartPart } from './multipart';
import { readNoUpdateAvailable, readPointer, type SignedBody } from './pointer';

const supportedPlatforms = new Set(['android', 'ios']);

function signedPart(name: string, signed: SignedBody): MultipartPart {
  return {
    name,
    body: signed.body,
    contentType: 'application/json; charset=utf-8',
    headers: { 'expo-signature': signed.signature },
  };
}

async function noUpdateAvailableResponse(env: Env): Promise<Response> {
  const directive = await readNoUpdateAvailable(env.UPDATES);
  // With no signed directive stored, a body with no parts is the safe answer:
  // the client keeps its current bundle.
  if (!directive) {
    return buildMultipartResponse([]);
  }
  return buildMultipartResponse([signedPart('directive', directive)]);
}

export async function handleManifest(
  request: Request,
  env: Env,
): Promise<Response> {
  if (request.method !== 'GET') {
    return new Response('expected GET', { status: 405 });
  }

  const platform = request.headers.get('expo-platform');
  if (!platform || !supportedPlatforms.has(platform)) {
    return new Response('unsupported expo-platform', { status: 400 });
  }

  const runtimeVersion = request.headers.get('expo-runtime-version');
  if (!runtimeVersion) {
    return new Response('missing expo-runtime-version', { status: 400 });
  }

  const currentUpdateId = request.headers.get('expo-current-update-id');
  const pointer = await readPointer(env.UPDATES, platform, runtimeVersion);

  // No pointer means this build has no update. The protocol reads a body with
  // no parts as "nothing available", which keeps old builds working.
  if (!pointer) {
    return buildMultipartResponse([]);
  }

  if (pointer.kind === 'rollback') {
    const embeddedUpdateId = request.headers.get('expo-embedded-update-id');
    if (!embeddedUpdateId) {
      return new Response('missing expo-embedded-update-id', { status: 400 });
    }
    if (currentUpdateId === embeddedUpdateId) {
      return await noUpdateAvailableResponse(env);
    }
    return buildMultipartResponse([signedPart('directive', pointer)]);
  }

  if (currentUpdateId === pointer.updateId) {
    return await noUpdateAvailableResponse(env);
  }

  return buildMultipartResponse([signedPart('manifest', pointer)]);
}
