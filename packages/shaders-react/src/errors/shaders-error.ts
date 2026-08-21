/**
 * Discriminator for a ShadersError. Open union — new codes may be added
 * without a breaking change. Only 'renderer-init' is emitted today.
 */
export type ShadersErrorCode = 'renderer-init';

/**
 * A typed error surfaced by @camp-dev/shaders-react. The original thrown value is
 * always available on `cause`.
 */
export class ShadersError extends Error {
  readonly code: ShadersErrorCode;

  constructor(code: ShadersErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ShadersError';
    this.code = code;
  }
}
