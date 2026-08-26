import { createHash } from 'node:crypto';

export function sha256Base64Url(buffer) {
  return createHash('sha256')
    .update(buffer)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function sha256Hex(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

export function md5Hex(buffer) {
  return createHash('md5').update(buffer).digest('hex');
}

// The manifest id must be a uuid, so the sha256 hex digest of metadata.json is
// reshaped into uuid form. Expo's reference server derives the id the same way.
export function sha256HexToUuid(hex) {
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}
