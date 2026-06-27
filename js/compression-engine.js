/**
 * @fileoverview Compression Engine — compresses payload data using pako (deflate)
 * before encryption. Skips compression if it would not reduce size.
 */

'use strict';

import { logger } from './logger.js';
import { StegError } from './error-handler.js';
import { ERROR_CODES, COMPRESSION_ALGO } from './constants.js';

/**
 * @typedef {Object} CompressionResult
 * @property {Uint8Array} data          - The (possibly) compressed data
 * @property {boolean}    wasCompressed - Whether compression was applied
 * @property {number}     algo          - COMPRESSION_ALGO constant
 * @property {number}     originalSize
 * @property {number}     compressedSize
 * @property {number}     ratio         - compressedSize / originalSize
 */

// ─── Compress ─────────────────────────────────────────────────────────────────

/**
 * Attempts to compress the payload using pako deflate.
 * If compressed data is not smaller, returns the original.
 *
 * @param {Uint8Array} data
 * @returns {CompressionResult}
 * @throws {StegError}
 */
export function compress(data) {
  logger.setStage('Compress');
  logger.info('Attempting compression', { originalSize: data.length });

  if (typeof pako === 'undefined') {
    logger.warn('pako not loaded — skipping compression');
    return noCompression(data);
  }

  try {
    const compressed = pako.deflate(data, { level: 6 });
    const ratio      = compressed.length / data.length;

    if (ratio >= 0.98) {
      // Compression not beneficial (< 2% savings)
      logger.info('Compression skipped — no meaningful size reduction', { ratio: ratio.toFixed(3) });
      return noCompression(data);
    }

    logger.info('Compression applied', {
      original:   data.length,
      compressed: compressed.length,
      ratio:      ratio.toFixed(3),
      savings:    `${((1 - ratio) * 100).toFixed(1)}%`,
    });

    return {
      data:           compressed,
      wasCompressed:  true,
      algo:           COMPRESSION_ALGO.DEFLATE,
      originalSize:   data.length,
      compressedSize: compressed.length,
      ratio,
    };
  } catch (err) {
    logger.warn('Compression failed — using uncompressed data', { message: err.message });
    // Non-fatal: fall through to no compression
    return noCompression(data);
  }
}

// ─── Decompress ───────────────────────────────────────────────────────────────

/**
 * Decompresses deflate-compressed data using pako.
 * @param {Uint8Array} data
 * @returns {Uint8Array}
 * @throws {StegError}
 */
export function decompress(data) {
  logger.setStage('Decompress');
  logger.info('Decompressing data', { compressedSize: data.length });

  if (typeof pako === 'undefined') {
    throw new StegError(ERROR_CODES.COMPRESSION_FAILURE, 'pako library not loaded');
  }

  try {
    const decompressed = pako.inflate(data);
    logger.info('Decompression successful', { outputSize: decompressed.length });
    return decompressed;
  } catch (err) {
    logger.error('Decompression failed', { message: err.message });
    throw new StegError(ERROR_CODES.PAYLOAD_RECONSTRUCTION, `Decompression failed: ${err.message}`, err);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns a no-compression result.
 * @param {Uint8Array} data
 * @returns {CompressionResult}
 */
function noCompression(data) {
  return {
    data,
    wasCompressed:  false,
    algo:           COMPRESSION_ALGO.NONE,
    originalSize:   data.length,
    compressedSize: data.length,
    ratio:          1.0,
  };
}
