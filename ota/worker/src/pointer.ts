// The bytes in `body` were signed when the update was published. The Worker
// returns them and never parses them.
export type SignedBody = {
  body: string;
  signature: string;
};

export type Pointer =
  | ({ kind: 'update'; updateId: string } & SignedBody)
  | ({ kind: 'rollback' } & SignedBody);

export const noUpdateAvailableKey = 'directive:no-update-available';

export function pointerKey(platform: string, runtimeVersion: string): string {
  return `pointer:${platform}:${runtimeVersion}`;
}

export async function readPointer(
  kv: KVNamespace,
  platform: string,
  runtimeVersion: string,
): Promise<Pointer | null> {
  return await kv.get<Pointer>(pointerKey(platform, runtimeVersion), 'json');
}

export async function readNoUpdateAvailable(
  kv: KVNamespace,
): Promise<SignedBody | null> {
  return await kv.get<SignedBody>(noUpdateAvailableKey, 'json');
}
