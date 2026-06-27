/**
 * @fileoverview Capacity — calculates the absolute maximum number of bytes that can be embedded
 * in a given carrier using its respective embedding technique.
 */

'use strict';

import { LSB_BITS_PER_CHANNEL, LSB_CHANNELS, HEADER_FIXED_SIZE, LSB_BITS_PER_PIXEL } from './constants.js';
import { logger } from './logger.js';

/**
 * @typedef {Object} CapacityResult
 * @property {number} totalBits       - Raw LSB bit capacity
 * @property {number} totalBytes      - Raw byte capacity before overhead
 * @property {number} overheadBytes   - Header + metadata overhead
 * @property {number} usableBytes     - Bytes available for user payload
 */

// ─── Image Capacity ───────────────────────────────────────────────────────────

/**
 * Calculates byte capacity for an image carrier.
 * Formula: (width * height * LSB_CHANNELS * LSB_BITS_PER_CHANNEL) / 8 - overhead
 *
 * @param {number} width
 * @param {number} height
 * @param {number} [extraOverhead=0] - Any additional overhead to subtract
 * @returns {CapacityResult}
 */
export function calculateImageCapacity(width, height, extraOverhead = 0) {
  const totalPixels = width * height;
  const totalBits   = totalPixels * LSB_BITS_PER_PIXEL;
  const totalBytes  = Math.floor(totalBits / 8);

  // Overhead: fixed header + max filename (256 bytes) + max extension (16 bytes)
  // + salt (16) + iv (12) + GCM tag (16) = ~420 bytes conservatively
  const overheadBytes = HEADER_FIXED_SIZE + 256 + 16 + 16 + 12 + 16 + extraOverhead;
  const usableBytes   = Math.max(0, totalBytes - overheadBytes);

  logger.debug('Image capacity calculated', { width, height, totalBytes, overheadBytes, usableBytes });

  return { totalBits, totalBytes, overheadBytes, usableBytes };
}

// ─── Video Capacity ───────────────────────────────────────────────────────────

/**
 * Calculates byte capacity for a video carrier.
 * Only a subset of frames is used (every Nth frame) to keep processing feasible.
 *
 * @param {number} frameCount      - Total frame count
 * @param {number} width
 * @param {number} height
 * @param {number} [framesUsed]   - Actual frames used (defaults to frameCount)
 * @returns {CapacityResult}
 */
export function calculateVideoCapacity(frameCount, width, height, framesUsed) {
  // Since we use EOF (End-Of-File) injection for videos, capacity is virtually unlimited.
  // We'll set a reasonable max limit for browser Blob processing (e.g., 2 GB).
  const totalBytes = 2 * 1024 * 1024 * 1024; // 2 GB
  const totalBits  = totalBytes * 8;
  const overheadBytes = 8; // EOF footer overhead
  const usableBytes   = totalBytes - overheadBytes;

  logger.debug('Video capacity calculated (EOF Mode)', { totalBytes, usableBytes });

  return { totalBits, totalBytes, overheadBytes, usableBytes };
}

// ─── Audio Capacity ───────────────────────────────────────────────────────────

/**
 * Calculates byte capacity for an audio carrier.
 * Uses EOF injection, so capacity is effectively unlimited.
 *
 * @returns {CapacityResult}
 */
export function calculateAudioCapacity() {
  const totalBytes = 2 * 1024 * 1024 * 1024; // 2 GB
  const totalBits  = totalBytes * 8;
  const overheadBytes = 8; // EOF footer overhead
  const usableBytes   = totalBytes - overheadBytes;

  logger.debug('Audio capacity calculated (EOF Mode)', { totalBytes, usableBytes });

  return { totalBits, totalBytes, overheadBytes, usableBytes };
}

// ─── Document Capacity ────────────────────────────────────────────────────────

/**
 * Calculates byte capacity for a generic document carrier.
 * Uses EOF injection, so capacity is effectively unlimited.
 *
 * @returns {CapacityResult}
 */
export function calculateDocumentCapacity() {
  const totalBytes = 2 * 1024 * 1024 * 1024; // 2 GB
  const totalBits  = totalBytes * 8;
  const overheadBytes = 8; // EOF footer overhead
  const usableBytes   = totalBytes - overheadBytes;

  logger.debug('Document capacity calculated (EOF Mode)', { totalBytes, usableBytes });

  return { totalBits, totalBytes, overheadBytes, usableBytes };
}

// ─── Usage Calculation ────────────────────────────────────────────────────────

/**
 * Returns the usage percentage and status for a given payload vs capacity.
 * @param {number} payloadBytes
 * @param {number} usableBytes
 * @returns {{ percent: number, status: 'ok'|'warn'|'danger', remaining: number }}
 */
export function getCapacityUsage(payloadBytes, usableBytes) {
  if (usableBytes <= 0) return { percent: 100, status: 'danger', remaining: 0 };

  const percent   = Math.min(100, (payloadBytes / usableBytes) * 100);
  const remaining = Math.max(0, usableBytes - payloadBytes);

  let status = 'ok';
  if (percent >= 100) status = 'danger';
  else if (percent >= 80) status = 'warn';

  return { percent, status, remaining };
}

/**
 * Returns the number of pixels needed to store a given number of bytes.
 * @param {number} bytes
 * @returns {number}
 */
export function bytesToPixels(bytes) {
  const bits = bytes * 8;
  return Math.ceil(bits / LSB_BITS_PER_PIXEL);
}

/**
 * Returns the number of bits needed for a given byte count.
 * @param {number} bytes
 * @returns {number}
 */
export function bytesToBits(bytes) {
  return bytes * 8;
}

/**
 * Returns how many bytes can be stored in a given pixel count.
 * @param {number} pixels
 * @returns {number}
 */
export function pixelsToBytes(pixels) {
  return Math.floor((pixels * LSB_BITS_PER_PIXEL) / 8);
}
