/**
 * @fileoverview Extraction Engine — the unified pipeline for decrypting
 * and extracting payloads from stego carriers.
 */

'use strict';

import { logger } from './logger.js';
import { StegError, handleError } from './error-handler.js';
import { ERROR_CODES, HEADER_FIXED_SIZE, COMPRESSION_ALGO } from './constants.js';
import { extractFromImage } from './image-embedding.js';
import { extractFromVideo } from './video-embedding.js';
import { extractFromAudio } from './audio-embedding.js';
import { extractFromDocument } from './document-embedding.js';
import { parseHeader } from './metadata-manager.js';
import { decrypt } from './encryption-engine.js';
import { decompress } from './compression-engine.js';
import { sha256, constantTimeEqual } from './utils.js';

/**
 * Extracts, decrypts, and decompresses the hidden payload from a carrier file.
 *
 * @param {import('./carrier-manager.js').CarrierInfo} carrier
 * @param {string} password
 * @param {function(number, string):void} [onProgress]
 * @returns {Promise<{ data: Uint8Array, metadata: import('./metadata-manager.js').ParsedHeader }>}
 */
export async function extract(carrier, password, onProgress) {
  logger.setStage('ExtractPipeline');
  logger.info('Starting extraction pipeline', { type: carrier.type });

  try {
    // ── 1. Extract Initial Header Bytes ──────────────────────────────────────
    onProgress?.(5, 'Locating embedded header');
    // We need at least HEADER_FIXED_SIZE + reasonable string length for filenames
    const headerScanSize = HEADER_FIXED_SIZE + 512;
    let headerScanBytes;

    if (carrier.type === 'image') {
      headerScanBytes = await extractFromImage(carrier, headerScanSize, (pct) => onProgress?.(5 + pct * 0.1, 'Extracting header'));
    } else if (carrier.type === 'video') {
      headerScanBytes = await extractFromVideo(carrier, headerScanSize, (pct) => onProgress?.(5 + pct * 0.1, 'Extracting header'));
    } else if (carrier.type === 'audio') {
      headerScanBytes = await extractFromAudio(carrier, headerScanSize, (pct) => onProgress?.(5 + pct * 0.1, 'Extracting header'));
    } else if (carrier.type === 'document') {
      headerScanBytes = await extractFromDocument(carrier, headerScanSize, (pct) => onProgress?.(5 + pct * 0.1, 'Extracting header'));
    } else {
      throw new StegError(ERROR_CODES.UNKNOWN, `Unsupported carrier type: ${carrier.type}`);
    }

    // ── 2. Parse and Validate Header ─────────────────────────────────────────
    onProgress?.(15, 'Verifying signature');
    const header = await parseHeader(headerScanBytes);
    
    // Calculate total bytes to extract (header + encrypted payload)
    const totalBytesToExtract = header.headerTotalSize + header.payloadSize;
    logger.info('Header parsed, proceeding to full extraction', { totalBytesToExtract });

    // ── 3. Extract Full Data ─────────────────────────────────────────────────
    onProgress?.(20, 'Extracting encrypted payload');
    let fullExtractedBytes;

    if (carrier.type === 'image') {
      fullExtractedBytes = await extractFromImage(carrier, totalBytesToExtract, (pct) => onProgress?.(20 + pct * 0.4, 'Extracting data'));
    } else if (carrier.type === 'video') {
      fullExtractedBytes = await extractFromVideo(carrier, totalBytesToExtract, (pct) => onProgress?.(20 + pct * 0.4, 'Extracting data'));
    } else if (carrier.type === 'audio') {
      fullExtractedBytes = await extractFromAudio(carrier, totalBytesToExtract, (pct) => onProgress?.(20 + pct * 0.4, 'Extracting data'));
    } else if (carrier.type === 'document') {
      fullExtractedBytes = await extractFromDocument(carrier, totalBytesToExtract, (pct) => onProgress?.(20 + pct * 0.4, 'Extracting data'));
    }

    // ── 4. Separate Header and Payload ───────────────────────────────────────
    onProgress?.(65, 'Verifying integrity');
    const encryptedPayload = fullExtractedBytes.slice(header.headerTotalSize);

    if (encryptedPayload.length !== header.payloadSize) {
      throw new StegError(ERROR_CODES.PAYLOAD_RECONSTRUCTION, 
        `Expected ${header.payloadSize} payload bytes, got ${encryptedPayload.length}`);
    }

    // ── 5. Decrypt ───────────────────────────────────────────────────────────
    onProgress?.(70, 'Deriving key and decrypting');
    const decryptedBytes = await decrypt(encryptedPayload, password);

    // ── 6. Verify Checksum ───────────────────────────────────────────────────
    onProgress?.(90, 'Verifying checksum');
    const computedChecksum = await sha256(decryptedBytes);
    if (!constantTimeEqual(header.plaintextChecksum, computedChecksum)) {
       throw new StegError(ERROR_CODES.CHECKSUM_MISMATCH, 'Decrypted data is corrupted or tampered');
    }

    // ── 7. Decompress (if needed) ────────────────────────────────────────────
    onProgress?.(95, 'Restoring original payload');
    let finalData = decryptedBytes;
    if (header.compressionFlag === COMPRESSION_ALGO.DEFLATE) {
      finalData = decompress(decryptedBytes);
    }

    onProgress?.(100, 'Complete');
    logger.info('Extraction pipeline complete', { finalSize: finalData.length });

    return { data: finalData, metadata: header };

  } catch (err) {
    throw handleError(err, 'Extraction Pipeline');
  }
}
