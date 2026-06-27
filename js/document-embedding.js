/**
 * @fileoverview Document Embedding Engine — hides encrypted payload across document
 * files (PDF, DOCX, TXT, etc.) using End-Of-File (EOF) injection.
 * The encrypted data is losslessly appended to the end of the original file.
 */

'use strict';

import { logger } from './logger.js';
import { StegError } from './error-handler.js';
import { ERROR_CODES } from './constants.js';

// ─── Embed in Document (EOF) ──────────────────────────────────────────────────

/**
 * Embeds fullPayload into the document by appending it to the End-Of-File (EOF).
 * Appends an 8-byte footer to locate the payload during extraction.
 *
 * @param {import('./carrier-manager.js').CarrierInfo} carrier
 * @param {Uint8Array} fullPayload - header + encrypted payload concatenated
 * @param {function(number, string):void} [onProgress] - (percent, stepLabel)
 * @returns {Promise<Blob>} Document blob with EOF payload
 * @throws {StegError}
 */
export async function embedInDocument(carrier, fullPayload, onProgress) {
  logger.setStage('DocumentEmbed');
  logger.info('Starting document EOF embedding', {
    payloadBytes: fullPayload.length,
    originalSize: carrier.file.size
  });

  onProgress?.(10, 'Preparing EOF payload');

  // Create 8-byte footer: [4 bytes payload length] [4 bytes 'STEG' magic]
  const footer = new Uint8Array(8);
  const view = new DataView(footer.buffer);
  view.setUint32(0, fullPayload.length, true);
  footer.set([0x53, 0x54, 0x45, 0x47], 4);

  onProgress?.(50, 'Injecting data into document');

  // Combine original file, payload, and footer losslessly
  const blob = new Blob([carrier.file, fullPayload, footer], { type: carrier.file.type });

  onProgress?.(100, 'Document complete');
  logger.info('Document embedding complete', { outputSize: blob.size });
  return blob;
}

// ─── Extract from Document (EOF) ──────────────────────────────────────────────

/**
 * Extracts bytes from a document file by reading the EOF payload.
 *
 * @param {import('./carrier-manager.js').CarrierInfo} carrier
 * @param {number} numBytes - Bytes to read from the start of the payload
 * @param {function(number, string):void} [onProgress]
 * @returns {Promise<Uint8Array>}
 */
export async function extractFromDocument(carrier, numBytes, onProgress) {
  logger.setStage('DocumentExtract');
  logger.info('Starting document EOF extraction', { requestedBytes: numBytes });

  const file = carrier.file;

  if (file.size < 8) {
    throw new StegError(ERROR_CODES.PAYLOAD_RECONSTRUCTION, 'File too small to contain EOF payload');
  }

  // 1. Read the 8-byte footer
  const footerSlice = file.slice(file.size - 8);
  const footerBuffer = await footerSlice.arrayBuffer();
  const footerBytes = new Uint8Array(footerBuffer);

  // 2. Verify 'STEG' magic in footer
  if (footerBytes[4] !== 0x53 || footerBytes[5] !== 0x54 || footerBytes[6] !== 0x45 || footerBytes[7] !== 0x47) {
    throw new StegError(ERROR_CODES.INVALID_MAGIC, 'EOF signature not found. This document does not contain a valid stego payload.');
  }

  const view = new DataView(footerBuffer);
  const payloadSize = view.getUint32(0, true);

  // 3. Locate the start of the payload
  const payloadStart = file.size - 8 - payloadSize;
  if (payloadStart < 0) {
    throw new StegError(ERROR_CODES.PAYLOAD_RECONSTRUCTION, 'Invalid EOF payload size metadata');
  }

  onProgress?.(50, 'Extracting EOF payload');

  // 4. Read the requested number of bytes from the payload
  const bytesToRead = Math.min(numBytes, payloadSize);
  const payloadSlice = file.slice(payloadStart, payloadStart + bytesToRead);
  const payloadBuffer = await payloadSlice.arrayBuffer();

  onProgress?.(100, 'Extraction complete');
  logger.info('Document extraction complete', { outputBytes: payloadBuffer.byteLength });
  return new Uint8Array(payloadBuffer);
}
