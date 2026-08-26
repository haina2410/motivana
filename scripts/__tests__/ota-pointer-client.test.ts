import { putPointer } from '../ota/pointerClient.mjs';

function callPutPointer(fetchImpl: unknown) {
  return putPointer({
    workerUrl: 'https://ota.test',
    token: 'test-token',
    key: 'pointer:android:fingerprint-abc',
    value: { kind: 'update' },
    fetchImpl,
  });
}

describe('putPointer', () => {
  it('resolves when the Worker accepts the write', async () => {
    await expect(
      callPutPointer(async () => new Response(null, { status: 204 })),
    ).resolves.toBeUndefined();
  });

  it("includes the Worker's explanation, not just the status", async () => {
    // A bare 401 tells the operator nothing on a first real publish. The
    // Worker already says why.
    await expect(
      callPutPointer(async () => new Response('unauthorized', { status: 401 })),
    ).rejects.toThrow(/401: unauthorized/);
  });

  it('reports a 400 body such as the missing key message', async () => {
    await expect(
      callPutPointer(
        async () => new Response('expected a key and a value', { status: 400 }),
      ),
    ).rejects.toThrow(/400: expected a key and a value/);
  });

  it('caps a huge body so the error stays readable', async () => {
    const error = await callPutPointer(
      async () => new Response('x'.repeat(5000), { status: 500 }),
    ).catch((thrown: Error) => thrown);

    expect((error as Error).message).toContain('500: ');
    expect((error as Error).message).toContain('...');
    expect((error as Error).message.length).toBeLessThan(700);
  });

  it('still reports the status when the body cannot be read', async () => {
    const unreadable = {
      ok: false,
      status: 502,
      text: async () => {
        throw new Error('stream broke');
      },
    };

    await expect(callPutPointer(async () => unreadable)).rejects.toThrow(
      /502 \(the response body could not be read\)/,
    );
  });

  it('says the pointer was not written, whatever the failure', async () => {
    await expect(
      callPutPointer(async () => new Response('', { status: 404 })),
    ).rejects.toThrow(/The pointer was not written/);
  });
});
