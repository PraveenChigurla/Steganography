/**
 * @fileoverview Image Embedding Engine — orchestrates LSB steganography for
 * image carriers. Delegates heavy pixel manipulation to the image Web Worker.
 */

'use strict';

import { logger } from './logger.js';
import { StegError } from './error-handler.js';
import { ERROR_CODES } from './constants.js';
import { getImageData, putImageData } from './carrier-manager.js';
import { uint8ArrayConcat } from './utils.js';

// ─── Embed ────────────────────────────────────────────────────────────────────

/**
 * Embeds an encrypted payload (with header prepended) into an image carrier
 * using LSB steganography via a Web Worker.
 *
 * @param {import('./carrier-manager.js').CarrierInfo} carrier
 * @param {Uint8Array} fullPayload  - header bytes + encrypted bytes concatenated
 * @param {function(number):void} [onProgress] - 0-100 progress callback
 * @returns {Promise<void>} Resolves when embedding is complete (carrier canvas updated)
 * @throws {StegError}
 */
export async function embedInImage(carrier, fullPayload, onProgress) {
  logger.setStage('ImageEmbed');
  logger.info('Starting LSB image embedding', { payloadBytes: fullPayload.length });

  let imageData;
  try {
    imageData = getImageData(carrier);
  } catch (err) {
    throw new StegError(ERROR_CODES.PIXEL_PROCESSING, err.message, err);
  }

  const modifiedPixels = await runWorker(
    imageData.data,
    fullPayload,
    carrier.width,
    carrier.height,
    'embed',
    onProgress,
  );

  const modifiedImageData = new ImageData(modifiedPixels, carrier.width, carrier.height);

  try {
    putImageData(carrier, modifiedImageData);
  } catch (err) {
    throw new StegError(ERROR_CODES.IMAGE_RECONSTRUCTION, err.message, err);
  }

  logger.info('LSB image embedding complete');
}

// ─── Extract ──────────────────────────────────────────────────────────────────

/**
 * Extracts raw bytes from an image carrier using LSB steganography.
 * Reads exactly `numBytes` bytes starting from pixel 0.
 *
 * @param {import('./carrier-manager.js').CarrierInfo} carrier
 * @param {number} numBytes - Total bytes to extract (header size + payload size)
 * @param {function(number):void} [onProgress]
 * @returns {Promise<Uint8Array>}
 * @throws {StegError}
 */
export async function extractFromImage(carrier, numBytes, onProgress) {
  logger.setStage('ImageExtract');
  logger.info('Starting LSB image extraction', { numBytes });

  let imageData;
  try {
    imageData = getImageData(carrier);
  } catch (err) {
    throw new StegError(ERROR_CODES.PIXEL_PROCESSING, err.message, err);
  }

  const extracted = await runWorker(
    imageData.data,
    null,
    carrier.width,
    carrier.height,
    'extract',
    onProgress,
    numBytes,
  );

  logger.info('LSB image extraction complete', { extractedBytes: extracted.length });
  return extracted;
}

// ─── Worker Bridge ────────────────────────────────────────────────────────────

/**
 * Runs the image Web Worker for embed or extract operations.
 * @param {Uint8ClampedArray} pixels
 * @param {Uint8Array|null}   payload  - Required for embed, null for extract
 * @param {number}            width
 * @param {number}            height
 * @param {'embed'|'extract'} op
 * @param {function}          onProgress
 * @param {number}            [numBytes] - Required for extract
 * @returns {Promise<Uint8ClampedArray|Uint8Array>}
 */
function runWorker(pixels, payload, width, height, op, onProgress, numBytes) {
  return new Promise((resolve, reject) => {
    const workerUrl = new URL('../workers/image-worker-v2.js', import.meta.url);
    let worker;

    try {
      worker = new Worker(workerUrl, { type: 'module' });
    } catch {
      // Fallback: try classic worker (for browsers that don't support module workers)
      try {
        worker = new Worker(workerUrl);
      } catch (err2) {
        reject(new StegError(ERROR_CODES.PIXEL_PROCESSING, 'Failed to create image worker: ' + err2.message, err2));
        return;
      }
    }

    worker.onmessage = (e) => {
      const { type, percent, pixels: resultPixels, data, message } = e.data;
      if (type === 'progress') {
        onProgress?.(percent);
      } else if (type === 'result') {
        worker.terminate();
        resolve(resultPixels ?? data);
      } else if (type === 'error') {
        worker.terminate();
        reject(new StegError(
          op === 'embed' ? ERROR_CODES.PIXEL_PROCESSING : ERROR_CODES.PIXEL_PROCESSING,
          message,
        ));
      }
    };

    worker.onerror = (err) => {
      worker.terminate();
      reject(new StegError(ERROR_CODES.PIXEL_PROCESSING, err.message, err));
    };

    const message = op === 'embed'
      ? { op, pixels, payload, width, height }
      : { op, pixels, numBytes, width, height };

    const transferable = op === 'embed'
      ? [pixels.buffer, payload.buffer]
      : [pixels.buffer];

    worker.postMessage(message, transferable);
  });
}
