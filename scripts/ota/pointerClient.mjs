export async function putPointer({ workerUrl, token, key, value, fetchImpl }) {
  const response = await fetchImpl(`${workerUrl}/api/pointer`, {
    method: 'PUT',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ key, value }),
  });

  if (!response.ok) {
    throw new Error(
      `PUT ${workerUrl}/api/pointer returned ${response.status}. The pointer was not written.`,
    );
  }
}
