/**
 * @fileoverview Metadata Manager — creates and parses the binary header
 * embedded before the encrypted payload in every stego carrier.
 *
 * Header Layout (fixed portion = 99 bytes):
 *  [0-3]   magic signature "STEG" (4)
 *  [4]     version major (1)
 *  [5]     version minor (1)
 *  [6]     carrier type (1)
 *  [7]     encryption algorithm (1)
 *  [8]     compression flag (1)
 *  [9]     payload type (1)
 *  [10]    zip flag (1)
 *  [11-12] filename length uint16 LE (2)
 *  [13-14] extension length uint16 LE (2)
 *  [15-18] payload size uint32 LE (4)
 *  [19-22] salt length uint32 LE (4)
 *  [23-26] iv length uint32 LE (4)
 *  [27-34] timestamp uint64 as two uint32 LE (8)
 *  [35-66] SHA-256 checksum of plaintext payload (32)
 *  [67-98] SHA-256 integrity hash of bytes 0-66 (32)
 *  --- variable section ---
 *  [99 .. 99+fnLen-1]           filename bytes (UTF-8)
 *  [99+fnLen .. 99+fnLen+extLen-1] extension bytes (UTF-8)
 */

'use strict';

import { logger } from './logger.js';
import { StegError } from './error-handler.js';
import {
  ERROR_CODES,
  MAGIC_SIGNATURE, APP_VERSION_MAJOR, APP_VERSION_MINOR,
  HEADER_FIXED_SIZE, SALT_LENGTH, IV_LENGTH, ENCRYPTION_ALGO,
} from './constants.js';
import { sha256, encodeText, decodeText, uint8ArrayConcat, constantTimeEqual } from './utils.js';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} HeaderOptions
 * @property {number}  carrierType
 * @property {number}  encryptionAlgo
 * @property {number}  compressionFlag
 * @property {number}  payloadType
 * @property {boolean} isZip
 * @property {string}  filename
 * @property {string}  extension
 * @property {number}  payloadSize       - Encrypted payload byte length
 * @property {Uint8Array} plaintextChecksum - SHA-256 of unencrypted payload (32 bytes)
 */

/**
 * @typedef {Object} ParsedHeader
 * @property {number}  versionMajor
 * @property {number}  versionMinor
 * @property {number}  carrierType
 * @property {number}  encryptionAlgo
 * @property {number}  compressionFlag
 * @property {number}  payloadType
 * @property {boolean} isZip
 * @property {string}  filename
 * @property {string}  extension
 * @property {number}  payloadSize
 * @property {number}  saltLength
 * @property {number}  ivLength
 * @property {number}  timestamp
 * @property {Uint8Array} plaintextChecksum
 * @property {number}  headerTotalSize    - Fixed + variable bytes
 */

// ─── Create Header ────────────────────────────────────────────────────────────

/**
 * Creates the binary metadata header for embedding.
 * @param {HeaderOptions} opts
 * @returns {Promise<Uint8Array>}
 */
export async function createHeader(opts) {
  logger.setStage('CreateHeader');

  const filenameBytes  = encodeText(opts.filename  || '');
  const extensionBytes = encodeText(opts.extension || '');

  const fixed = new Uint8Array(HEADER_FIXED_SIZE);
  const view  = new DataView(fixed.buffer);

  let offset = 0;

  // [0-3] Magic "STEG"
  fixed.set(MAGIC_SIGNATURE, offset); offset += 4;

  // [4] version major
  fixed[offset++] = APP_VERSION_MAJOR;
  // [5] version minor
  fixed[offset++] = APP_VERSION_MINOR;

  // [6] carrier type
  fixed[offset++] = opts.carrierType;
  // [7] encryption algo
  fixed[offset++] = opts.encryptionAlgo;
  // [8] compression flag
  fixed[offset++] = opts.compressionFlag;
  // [9] payload type
  fixed[offset++] = opts.payloadType;
  // [10] zip flag
  fixed[offset++] = opts.isZip ? 1 : 0;

  // [11-12] filename length (uint16 LE)
  view.setUint16(offset, filenameBytes.length, true); offset += 2;
  // [13-14] extension length (uint16 LE)
  view.setUint16(offset, extensionBytes.length, true); offset += 2;

  // [15-18] payload size (uint32 LE)
  view.setUint32(offset, opts.payloadSize, true); offset += 4;

  // [19-22] salt length (uint32 LE)
  view.setUint32(offset, SALT_LENGTH, true); offset += 4;

  // [23-26] iv length (uint32 LE)
  view.setUint32(offset, IV_LENGTH, true); offset += 4;

  // [27-34] timestamp (ms since epoch as two uint32: low, high)
  const now = Date.now();
  view.setUint32(offset,     now >>> 0,            true); offset += 4;
  view.setUint32(offset,     Math.floor(now / 2**32), true); offset += 4;

  // [35-66] plaintext payload checksum (SHA-256, 32 bytes)
  if (!opts.plaintextChecksum || opts.plaintextChecksum.length !== 32) {
    throw new StegError(ERROR_CODES.METADATA_GENERATION, 'Invalid plaintext checksum length');
  }
  fixed.set(opts.plaintextChecksum, offset); offset += 32;

  // [67-98] integrity hash of bytes 0-66 (SHA-256 of the fixed header so far)
  const partialFixed = fixed.slice(0, 67);
  const integrityHash = await sha256(partialFixed);
  fixed.set(integrityHash, offset); offset += 32;

  // Concatenate: fixed + filename + extension
  const header = uint8ArrayConcat(fixed, filenameBytes, extensionBytes);

  logger.info('Header created', {
    headerSize:    header.length,
    filenameLen:   filenameBytes.length,
    extensionLen:  extensionBytes.length,
    payloadSize:   opts.payloadSize,
  });

  return header;
}

// ─── Parse Header ─────────────────────────────────────────────────────────────

/**
 * Parses and validates the metadata header from raw extracted bytes.
 * @param {Uint8Array} data - Full extracted byte stream starting at the header
 * @returns {Promise<ParsedHeader>}
 * @throws {StegError}
 */
export async function parseHeader(data) {
  logger.setStage('ParseHeader');

  if (data.length < HEADER_FIXED_SIZE) {
    throw new StegError(ERROR_CODES.METADATA_CORRUPTION,
      `Data too short for header: ${data.length} bytes`);
  }

  // ── Validate magic signature ─────────────────────────────────────────────
  const magic = data.slice(0, 4);
  if (!constantTimeEqual(magic, MAGIC_SIGNATURE)) {
    throw new StegError(ERROR_CODES.INVALID_MAGIC,
      `Got: ${Array.from(magic).map(b => String.fromCharCode(b)).join('')}`);
  }

  const view = new DataView(data.buffer, data.byteOffset);

  let offset = 4;

  const versionMajor   = data[offset++];
  const versionMinor   = data[offset++];
  const carrierType    = data[offset++];
  const encryptionAlgo = data[offset++];
  const compressionFlag= data[offset++];
  const payloadType    = data[offset++];
  const zipFlag        = data[offset++];

  const filenameLen  = view.getUint16(offset, true); offset += 2;
  const extensionLen = view.getUint16(offset, true); offset += 2;
  const payloadSize  = view.getUint32(offset, true); offset += 4;
  const saltLength   = view.getUint32(offset, true); offset += 4;
  const ivLength     = view.getUint32(offset, true); offset += 4;

  const tsLow  = view.getUint32(offset, true); offset += 4;
  const tsHigh = view.getUint32(offset, true); offset += 4;
  const timestamp = tsLow + tsHigh * 2**32;

  const plaintextChecksum = data.slice(offset, offset + 32); offset += 32;

  // ── Validate integrity hash ──────────────────────────────────────────────
  const storedIntegrity = data.slice(offset, offset + 32); offset += 32; // now at HEADER_FIXED_SIZE
  const computedIntegrity = await sha256(data.slice(0, 67));

  if (!constantTimeEqual(storedIntegrity, computedIntegrity)) {
    throw new StegError(ERROR_CODES.INTEGRITY_FAILURE,
      'Header integrity hash does not match — header may be corrupted or tampered');
  }

  // ── Validate version ──────────────────────────────────────────────────────
  if (versionMajor > APP_VERSION_MAJOR) {
    throw new StegError(ERROR_CODES.UNSUPPORTED_VERSION,
      `Header version ${versionMajor}.${versionMinor}, current ${APP_VERSION_MAJOR}.${APP_VERSION_MINOR}`);
  }

  // ── Read variable fields ──────────────────────────────────────────────────
  const totalSize = HEADER_FIXED_SIZE + filenameLen + extensionLen;
  if (data.length < totalSize) {
    throw new StegError(ERROR_CODES.METADATA_CORRUPTION,
      `Header requires ${totalSize} bytes but only ${data.length} available`);
  }

  const filename  = decodeText(data.slice(HEADER_FIXED_SIZE, HEADER_FIXED_SIZE + filenameLen));
  const extension = decodeText(data.slice(HEADER_FIXED_SIZE + filenameLen, HEADER_FIXED_SIZE + filenameLen + extensionLen));

  logger.info('Header parsed successfully', {
    version:       `${versionMajor}.${versionMinor}`,
    carrierType,
    payloadSize,
    filename,
    extension,
    compressionFlag,
    zipFlag: !!zipFlag,
  });

  return {
    versionMajor,
    versionMinor,
    carrierType,
    encryptionAlgo,
    compressionFlag,
    payloadType,
    isZip:           !!zipFlag,
    filename,
    extension,
    payloadSize,
    saltLength,
    ivLength,
    timestamp,
    plaintextChecksum,
    headerTotalSize: totalSize,
  };
}
