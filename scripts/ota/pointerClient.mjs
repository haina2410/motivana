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
      `PUT ${workerUrl}/api/pointer returned ${response.status}${await describeBody(response)}. The pointer was not written.`,
    );
  }
}

// A bare status number hides the Worker's own explanation: 401 unauthorized,
// 400 "expected a key and a value", and a 404 from a wrong URL all look the
// same. The body is included, but it comes from the network, so it is capped
// and a read failure is never allowed to mask the status.
const maximumBodyCharacters = 500;

async function describeBody(response) {
  let text;
  try {
    text = await response.text();
  } catch {
    return ' (the response body could not be read)';
  }
  const trimmed = text.trim();
  if (!trimmed) {
    return '';
  }
  const shown =
    trimmed.length > maximumBodyCharacters
      ? `${trimmed.slice(0, maximumBodyCharacters)}...`
      : trimmed;
  return `: ${shown.replace(/\s+/g, ' ')}`;
}
