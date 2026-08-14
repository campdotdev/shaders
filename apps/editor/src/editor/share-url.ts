// Turns a Preset into a URL-hash-safe string and back, so "Share" can put a
// whole graph in the address bar with no server round trip. The pipeline is
// serializePreset -> deflate-raw compress -> base64url encode (and the
// mirror image to decode) -- deflate-raw shrinks the indented JSON well
// below what a browser's URL length limits tolerate, and base64url keeps the
// result safe to drop straight after a `#` with no escaping. Built on the
// web-standard CompressionStream/DecompressionStream, which ship in every
// browser this editor targets and in Node 22, so this stays three-free and
// dependency-free even in tests.
import type { Preset } from './preset';
import { parsePreset, PresetError, serializePreset } from './preset';

/** Thrown for any decode failure the codec itself can attribute to corrupt
    bytes -- bad base64url, truncated deflate, or JSON that doesn't even
    parse. A decoded-but-invalid preset is a different failure (the bytes
    were fine, the graph wasn't) and is left to throw `parsePreset`'s own
    message instead of being caught here. */
const DAMAGED_LINK_MESSAGE = 'This share link is damaged or truncated.';

/** Compresses a preset (via `serializePreset`) and encodes it as base64url,
    unpadded, ready to append directly after a `#` in a URL. */
export async function presetToHash(preset: Preset): Promise<string> {
  const json = serializePreset(preset);
  const compressed = await deflate(json);

  return toBase64Url(compressed);
}

/** Reverses `presetToHash`: accepts the hash with or without its leading
    `#` (both `location.hash` and a bare share-link fragment show up in
    practice), decompresses, and validates through `parsePreset`. Any
    failure in the base64url/deflate steps rethrows as a `PresetError` with
    a message meant for a toast; a `parsePreset` failure on the decoded JSON
    passes through unchanged, since that message already describes the
    actual problem (unknown spec, dangling edge, future version). */
export async function presetFromHash(hash: string): Promise<Preset> {
  const trimmed = hash.startsWith('#') ? hash.slice(1) : hash;

  const json = await inflate(trimmed);

  return parsePreset(json);
}

/** Compresses UTF-8 text with `deflate-raw` (no zlib/gzip header -- the
    smallest wrapper the format offers, since every byte here rides in a
    URL) and reads the whole result back into one buffer. */
async function deflate(text: string): Promise<Uint8Array> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('deflate-raw'));

  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * Reverses `deflate`. Wrapped so every way this can fail -- malformed
 * base64url input, a deflate stream that isn't valid raw-deflate bytes, or
 * decoded bytes that aren't valid UTF-8/JSON -- collapses onto the same
 * `PresetError`. A truncated hash (the fragment got clipped by a chat app
 * or a link shortener) hits the deflate step; garbage characters hit the
 * base64url step first. Either way the person clicking the link needs the
 * same "this link is broken" message, not the raw decode exception.
 */
async function inflate(hash: string): Promise<string> {
  try {
    const bytes = fromBase64Url(hash);
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));

    return await new Response(stream).text();
  } catch {
    throw new PresetError(DAMAGED_LINK_MESSAGE);
  }
}

/** Encodes raw bytes as base64url: standard base64 with the two symbols
    that aren't URL-safe swapped (`+`/`/` -> `-`/`_`) and the `=` padding
    dropped, since padding is only there to make fixed-width groups and a
    URL fragment has no need for that. */
function toBase64Url(bytes: Uint8Array): string {
  let binary = '';

  for (const byte of bytes) binary += String.fromCharCode(byte);

  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

/** Reverses `toBase64Url`: swaps the URL-safe symbols back, restores
    padding to a multiple of 4 characters (`atob` requires it even though
    the encoder dropped it), and rejects anything outside the base64url
    alphabet before it ever reaches `atob` -- `atob` silently ignores some
    invalid characters rather than throwing, which would let corrupt input
    decode into wrong bytes instead of a clear error. */
function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  if (value.length === 0 || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error('Invalid base64url input.');
  }

  const padded = value
    .replaceAll('-', '+')
    .replaceAll('_', '/')
    .padEnd(value.length + ((4 - (value.length % 4)) % 4), '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}
