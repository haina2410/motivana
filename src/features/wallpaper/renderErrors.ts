export const renderErrorCodes = [
  'INVALID_DIMENSIONS',
  'SURFACE_CREATION_FAILED',
  'DRAW_FAILED',
  'ENCODE_FAILED',
  'FILE_WRITE_FAILED',
] as const;

export type RenderErrorCode = (typeof renderErrorCodes)[number];

export class RenderError extends Error {
  readonly code: RenderErrorCode;

  constructor(code: RenderErrorCode) {
    super(code);
    this.name = 'RenderError';
    this.code = code;
  }
}
