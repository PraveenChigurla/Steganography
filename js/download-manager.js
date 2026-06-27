/**
 * @fileoverview Download Manager — handles converting data to Blobs
 * and triggering browser downloads.
 */

'use strict';

import { logger } from './logger.js';
import { StegError } from './error-handler.js';
import { ERROR_CODES } from './constants.js';
import { getFileExtension } from './utils.js';

/**
 * Triggers a download of a Blob.
 * @param {Blob} blob
 * @param {string} filename
 * @throws {StegError}
 */
export function downloadBlob(blob, filename) {
  logger.info('Triggering download', { filename, size: blob.size });

  if (!blob || blob.size === 0) {
    throw new StegError(ERROR_CODES.BLOB_CREATION, 'Blob is empty or null');
  }

  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
  } catch (err) {
    throw new StegError(ERROR_CODES.DOWNLOAD_FAILURE, err.message, err);
  }
}

/**
 * Creates a Blob from a Uint8Array.
 * @param {Uint8Array} data
 * @param {string} mimeType
 * @returns {Blob}
 */
export function createBlob(data, mimeType = 'application/octet-stream') {
  try {
    return new Blob([data], { type: mimeType });
  } catch (err) {
    throw new StegError(ERROR_CODES.BLOB_CREATION, err.message, err);
  }
}

/**
 * Maps common file extensions to basic MIME types for blob creation.
 * If not known, returns application/octet-stream.
 * @param {string} filename
 * @returns {string}
 */
export function guessMimeType(filename) {
  const ext = getFileExtension(filename);
  const mimes = {
    'txt': 'text/plain',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'pdf': 'application/pdf',
    'zip': 'application/zip',
    'csv': 'text/csv',
    'json': 'application/json',
  };
  return mimes[ext] || 'application/octet-stream';
}
