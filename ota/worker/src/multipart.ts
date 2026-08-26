export type MultipartPart = {
  name: string;
  body: string;
  contentType: string;
  headers?: Record<string, string>;
};

// The signature covers a part body, never the envelope, so the boundary is
// free to change on every request.
function generateBoundary(): string {
  return `motivana-${crypto.randomUUID()}`;
}

export function buildMultipartResponse(parts: MultipartPart[]): Response {
  const boundary = generateBoundary();
  const sections = parts.map((part) => {
    const headers = {
      'content-disposition': `form-data; name="${part.name}"`,
      'content-type': part.contentType,
      ...part.headers,
    };
    const headerLines = Object.entries(headers)
      .map(([name, value]) => `${name}: ${value}`)
      .join('\r\n');
    return `--${boundary}\r\n${headerLines}\r\n\r\n${part.body}\r\n`;
  });

  return new Response(`${sections.join('')}--${boundary}--\r\n`, {
    status: 200,
    headers: {
      'content-type': `multipart/mixed; boundary=${boundary}`,
      'expo-protocol-version': '1',
      'expo-sfv-version': '0',
      'cache-control': 'private, max-age=0',
    },
  });
}
