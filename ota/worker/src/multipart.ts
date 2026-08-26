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

const protocolHeaders = {
  'expo-protocol-version': '1',
  'expo-sfv-version': '0',
  'cache-control': 'private, max-age=0',
};

// "Nothing available" is a 204, never a zero-part multipart body.
//
// A body of just `--<boundary>--\r\n` is not zero bytes, so the client's
// FileDownloader.parseMultipartRemoteUpdateResponse zero-byte guard does not
// catch it. It reaches okhttp's MultipartReader, which throws
// ProtocolException("expected at least 1 part") at partCount == 0. The catch
// turns that into an IOException and logs UpdateFailedToLoad. The client
// accepts a 204 whenever expo-protocol-version > 0.
//
// The branch lives inside buildMultipartResponse rather than in its callers
// deliberately: the zero-part wire form is never a correct answer, so no
// future caller can reintroduce it by forgetting to check.
export function buildMultipartResponse(parts: MultipartPart[]): Response {
  if (parts.length === 0) {
    return new Response(null, { status: 204, headers: protocolHeaders });
  }

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
      ...protocolHeaders,
    },
  });
}
