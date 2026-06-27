/**
 * @fileoverview Payload Manager — prepares and manages user payload data
 * (text or files) before it enters the encryption pipeline.
 */

'use strict';

import { logger } from './logger.js';
import { StegError } from './error-handler.js';
import { ERROR_CODES, PAYLOAD_TYPE } from './constants.js';
import { encodeText, readFileAsArrayBuffer, getFileExtension, payloadTypeFromExtension } from './utils.js';
import { createZip } from './zip-manager.js';

/**
 * @typedef {'text'|'files'} PayloadMode
 */

/**
 * @typedef {Object} PayloadResult
 * @property {Uint8Array} data           - Raw payload bytes (before compression/encryption)
 * @property {number}     type           - PAYLOAD_TYPE constant
 * @property {string}     filename       - Original filename
 * @property {string}     extension      - Original extension
 * @property {boolean}    isZip          - Whether a ZIP was auto-created
 * @property {number}     size           - Byte size of raw payload
 */

// ─── Text Payload ─────────────────────────────────────────────────────────────

/**
 * Prepares a text string as a UTF-8 payload.
 * @param {string} text
 * @returns {PayloadResult}
 * @throws {StegError}
 */
export function prepareTextPayload(text) {
  logger.setStage('PrepareTextPayload');

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    throw new StegError(ERROR_CODES.EMPTY_TEXT);
  }

  const data = encodeText(text);
  logger.info('Text payload prepared', { bytes: data.length });

  return {
    data,
    type:      PAYLOAD_TYPE.TEXT,
    filename:  'message.txt',
    extension: 'txt',
    isZip:     false,
    size:      data.length,
  };
}

/**
 * Prepares a payload from a text file (reads and encodes as UTF-8).
 * @param {File} file
 * @returns {Promise<PayloadResult>}
 */
export async function prepareTextFilePayload(file) {
  logger.setStage('PrepareTextFilePayload');

  if (file.size === 0) throw new StegError(ERROR_CODES.EMPTY_FILE_PAYLOAD, file.name);

  const buffer = await readFileAsArrayBuffer(file);
  const data = new Uint8Array(buffer);

  return {
    data,
    type:      PAYLOAD_TYPE.TEXT,
    filename:  file.name,
    extension: getFileExtension(file.name),
    isZip:     false,
    size:      data.length,
  };
}

// ─── File Payload ─────────────────────────────────────────────────────────────

/**
 * Prepares a payload from one or more files.
 * - Single file: embeds directly.
 * - Multiple files: bundles into a ZIP archive named payload.zip.
 *
 * @param {File[]} files
 * @param {function(number):void} [onProgress] - 0-100 progress callback
 * @returns {Promise<PayloadResult>}
 * @throws {StegError}
 */
export async function prepareFilePayload(files, onProgress) {
  logger.setStage('PrepareFilePayload');

  if (!files || files.length === 0) {
    throw new StegError(ERROR_CODES.NO_PAYLOAD);
  }

  for (const f of files) {
    if (f.size === 0) throw new StegError(ERROR_CODES.EMPTY_FILE_PAYLOAD, f.name);
  }

  if (files.length === 1) {
    // Single file: embed directly
    const file = files[0];
    logger.info('Single file payload', { name: file.name, size: file.size });
    const buffer = await readFileAsArrayBuffer(file);
    const data = new Uint8Array(buffer);
    const ext = getFileExtension(file.name);

    return {
      data,
      type:      payloadTypeFromExtension(ext),
      filename:  file.name,
      extension: ext,
      isZip:     false,
      size:      data.length,
    };
  }

  // Multiple files: create ZIP
  logger.info(`Creating ZIP for ${files.length} files`);
  const zipData = await createZip(files, onProgress);

  return {
    data:      zipData,
    type:      PAYLOAD_TYPE.ZIP,
    filename:  'payload.zip',
    extension: 'zip',
    isZip:     true,
    size:      zipData.length,
  };
}

// ─── Size Calculation ─────────────────────────────────────────────────────────

/**
 * Returns the estimated total byte size of a list of files (before processing).
 * For multiple files this is an estimate since ZIP has overhead.
 * @param {File[]} files
 * @returns {number}
 */
export function estimateFilesSize(files) {
  return files.reduce((sum, f) => sum + f.size, 0);
}

/**
 * Returns the UTF-8 byte size of a text string.
 * @param {string} text
 * @returns {number}
 */
export function textByteSize(text) {
  return new TextEncoder().encode(text).length;
}
