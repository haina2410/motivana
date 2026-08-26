// The wrangler CLI handles Cloudflare authentication, so no S3 signing code
// and no R2 access key are needed. It reads CLOUDFLARE_API_TOKEN, or the
// session from wrangler login.
export function uploadFile({ bucket, hash, absolutePath, contentType, run }) {
  run('npx', [
    'wrangler',
    'r2',
    'object',
    'put',
    `${bucket}/assets/${hash}`,
    '--file',
    absolutePath,
    '--content-type',
    contentType,
    '--remote',
  ]);
}
