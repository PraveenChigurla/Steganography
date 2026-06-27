/**
 * @fileoverview Validation Module — validates user inputs, passwords,
 * payload sizes against capacities, etc.
 */

'use strict';

import { StegError } from './error-handler.js';
import { ERROR_CODES, MAX_CARRIER_SIZE, MAX_PAYLOAD_SIZE, SUPPORTED_IMAGE_EXTENSIONS, SUPPORTED_VIDEO_EXTENSIONS } from './constants.js';
import { getFileExtension } from './utils.js';

/**
 * Validates a password pair and returns its strength.
 * @param {string} password
 * @param {string} confirmPassword
 * @returns {number} 0-4 strength (or throws)
 * @throws {StegError}
 */
export function validatePasswordInput(password, confirmPassword) {
  if (!password) {
    throw new StegError(ERROR_CODES.EMPTY_PASSWORD);
  }
  if (password !== confirmPassword) {
    throw new StegError(ERROR_CODES.PASSWORD_MISMATCH);
  }
  // Strength is scored elsewhere, just returning valid indication here.
  return true; // Simplified, strength calculation is in encryption-engine.js
}

/**
 * Validates file sizes against max limits.
 * @param {number} size
 * @param {'carrier'|'payload'} type
 * @throws {StegError}
 */
export function validateSizeLimit(size, type) {
  if (type === 'carrier' && size > MAX_CARRIER_SIZE) {
    throw new StegError(ERROR_CODES.FILE_TOO_LARGE, `Carrier size exceeds limit of ${MAX_CARRIER_SIZE/1024/1024}MB`);
  }
  if (type === 'payload' && size > MAX_PAYLOAD_SIZE) {
    throw new StegError(ERROR_CODES.PAYLOAD_TOO_LARGE, `Payload size exceeds limit of ${MAX_PAYLOAD_SIZE/1024/1024}MB`);
  }
}

/**
 * Basic validation for carrier type extension.
 * @param {string} filename 
 * @param {'image'|'video'} expectedType 
 * @throws {StegError}
 */
export function validateCarrierExtension(filename, expectedType) {
    const ext = getFileExtension(filename);
    if (expectedType === 'image') {
        if (!SUPPORTED_IMAGE_EXTENSIONS.includes(ext)) {
            throw new StegError(ERROR_CODES.UNSUPPORTED_IMAGE_FORMAT, `Extension .${ext} is not a supported image format.`);
        }
    } else if (expectedType === 'video') {
        if (!SUPPORTED_VIDEO_EXTENSIONS.includes(ext)) {
            throw new StegError(ERROR_CODES.UNSUPPORTED_VIDEO_FORMAT, `Extension .${ext} is not a supported video format.`);
        }
    }
}
