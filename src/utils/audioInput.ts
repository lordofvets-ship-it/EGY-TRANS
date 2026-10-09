export const MAX_AUDIO_UPLOAD_BYTES = 50 * 1024 * 1024;

export type AudioDecodeResult =
  | { ok: true; buffer: Buffer }
  | { ok: false; reason: 'missing' | 'invalid-base64' | 'too-large' | 'empty' };

/** Strictly decode the raw base64 payload used by the browser audio uploader. */
export function decodeAudioBase64(value: unknown, maxBytes = MAX_AUDIO_UPLOAD_BYTES): AudioDecodeResult {
  if (typeof value !== 'string' || value.length === 0) return { ok: false, reason: 'missing' };
  // Reject oversized strings before allocating a decoded Buffer (base64 expands by ~4/3).
  if (!Number.isFinite(maxBytes) || maxBytes <= 0) return { ok: false, reason: 'too-large' };
  const maxEncodedLength = 4 * Math.ceil(maxBytes / 3);
  if (value.length > maxEncodedLength) return { ok: false, reason: 'too-large' };
  // Browser uploader sends the payload portion of a data URL, without whitespace.
  if (value.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    return { ok: false, reason: 'invalid-base64' };
  }
  const buffer = Buffer.from(value, 'base64');
  if (buffer.length === 0) return { ok: false, reason: 'empty' };
  if (buffer.length > maxBytes) return { ok: false, reason: 'too-large' };
  return { ok: true, buffer };
}
