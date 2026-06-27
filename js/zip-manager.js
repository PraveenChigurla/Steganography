/**
 * @fileoverview ZIP Manager — creates ZIP archives from multiple files using JSZip.
 * Used when the user selects more than one payload file.
 */

'use strict';

import { logger } from './logger.js';
import { StegError } from './error-handler.js';
import { ERROR_CODES } from './constants.js';

/**
 * Creates a ZIP archive containing all provided files.
 * Preserves original filenames. Directories are NOT created (flat structure).
 *
 * @param {File[]} files
 * @param {function(number):void} [onProgress] - 0-100 progress callback
 * @returns {Promise<Uint8Array>} ZIP archive bytes
 * @throws {StegError}
 */
export async function createZip(files, onProgress) {
  logger.setStage('CreateZIP');
  logger.info(`Creating ZIP for ${files.length} files`);

  if (typeof JSZip === 'undefined') {
    throw new StegError(ERROR_CODES.ZIP_CREATION_FAILURE, 'JSZip library not loaded');
  }

  try {
    const zip = new JSZip();

    for (const file of files) {
      logger.debug(`Adding to ZIP: ${file.name}`);
      zip.file(file.name, file, { binary: true });
    }

    onProgress?.(10);

    const blob = await zip.generateAsync({
      type:             'uint8array',
      compression:      'DEFLATE',
      compressionOptions: { level: 6 },
    }, (metadata) => {
      // Map JSZip's 0-100 progress to 10-95
      const pct = 10 + Math.round(metadata.percent * 0.85);
      onProgress?.(pct);
    });

    onProgress?.(100);
    logger.info(`ZIP created: ${blob.length} bytes`);
    return blob;

  } catch (err) {
    logger.error('ZIP creation failed', { message: err.message });
    throw new StegError(ERROR_CODES.ZIP_CREATION_FAILURE, err.message, err);
  }
}

/**
 * Checks whether a Uint8Array represents a ZIP archive (magic bytes PK\x03\x04).
 * @param {Uint8Array} data
 * @returns {boolean}
 */
export function isZipData(data) {
  return data.length >= 4 &&
    data[0] === 0x50 && data[1] === 0x4B &&
    data[2] === 0x03 && data[3] === 0x04;
}
