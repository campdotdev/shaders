/**
 * Discriminator for a MatterError. Open union — new codes may be added
 * without a breaking change. Only 'renderer-init' is emitted today.
 */
export type MatterErrorCode = 'renderer-init';

/**
 * A typed error surfaced by @mattermix/shaders-react. The original thrown value is
 * always available on `cause`.
 */
export class MatterError extends Error {
  readonly code: MatterErrorCode;

  constructor(code: MatterErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'MatterError';
    this.code = code;
  }
}
