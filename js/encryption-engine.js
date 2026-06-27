/**
 * @fileoverview Encryption Engine — AES-256-GCM encryption and decryption
 * with PBKDF2 key derivation. All operations use the Web Crypto API.
 * NEVER stores passwords, keys, salts, or IVs in any persistent storage.
 */

'use strict';

import { logger } from './logger.js';
import { StegError } from './error-handler.js';
import {
  ERROR_CODES, PBKDF2_ITERATIONS, SALT_LENGTH, IV_LENGTH, AES_KEY_BITS,
  ENCRYPTION_ALGO,
} from './constants.js';
import { randomBytes, uint8ArrayConcat } from './utils.js';

// ─── Key Derivation ───────────────────────────────────────────────────────────

/**
 * Derives an AES-256 CryptoKey from a password and salt using PBKDF2.
 * @param {string} password
 * @param {Uint8Array} salt
 * @returns {Promise<CryptoKey>}
 * @throws {StegError}
 */
export async function deriveKey(password, salt) {
  try {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveKey'],
    );

    const key = await crypto.subtle.deriveKey(
      {
        name:       'PBKDF2',
        salt:       salt.buffer,
        iterations: PBKDF2_ITERATIONS,
        hash:       'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: AES_KEY_BITS },
      false,
      ['encrypt', 'decrypt'],
    );

    logger.debug('Key derived successfully via PBKDF2');
    return key;

  } catch (err) {
    logger.error('Key derivation failed', { error: err.message });
    throw new StegError(ERROR_CODES.KEY_DERIVATION_FAILURE, err.message, err);
  }
}

// ─── Encrypt ──────────────────────────────────────────────────────────────────

/**
 * Encrypts data using AES-256-GCM with a password-derived key.
 *
 * Output format (all bytes concatenated):
 *   [salt: 16 bytes][iv: 12 bytes][ciphertext + GCM tag: variable]
 *
 * @param {Uint8Array} data
 * @param {string} password
 * @returns {Promise<Uint8Array>} Encrypted blob (salt + iv + ciphertext)
 * @throws {StegError}
 */
export async function encrypt(data, password) {
  logger.setStage('Encrypt');
  logger.info('Starting AES-256-GCM encryption', { plainSize: data.length });

  let salt, iv;
  try {
    salt = randomBytes(SALT_LENGTH);
    iv   = randomBytes(IV_LENGTH);
  } catch (err) {
    throw new StegError(ERROR_CODES.IV_GENERATION_FAILURE, err.message, err);
  }

  const key = await deriveKey(password, salt);

  try {
    const cipherBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv.buffer },
      key,
      data.buffer instanceof ArrayBuffer ? data.buffer : data,
    );

    const ciphertext = new Uint8Array(cipherBuffer);
    const result = uint8ArrayConcat(salt, iv, ciphertext);

    logger.info('Encryption complete', {
      saltLen:     salt.length,
      ivLen:       iv.length,
      cipherLen:   ciphertext.length,
      totalOut:    result.length,
    });

    return result;

  } catch (err) {
    logger.error('AES-GCM encryption failed', { error: err.message });
    throw new StegError(ERROR_CODES.ENCRYPTION_FAILURE, err.message, err);
  }
}

// ─── Decrypt ──────────────────────────────────────────────────────────────────

/**
 * Decrypts an AES-256-GCM blob produced by `encrypt()`.
 *
 * Input format: [salt: 16 bytes][iv: 12 bytes][ciphertext + GCM tag]
 *
 * @param {Uint8Array} encryptedBlob
 * @param {string} password
 * @returns {Promise<Uint8Array>} Decrypted plaintext
 * @throws {StegError}
 */
export async function decrypt(encryptedBlob, password) {
  logger.setStage('Decrypt');
  logger.info('Starting AES-256-GCM decryption', { inputSize: encryptedBlob.length });

  const minSize = SALT_LENGTH + IV_LENGTH + 16; // 16 = minimum GCM tag
  if (encryptedBlob.length < minSize) {
    throw new StegError(
      ERROR_CODES.DECRYPTION_FAILURE,
      `Encrypted data too short: ${encryptedBlob.length} bytes (minimum ${minSize})`,
    );
  }

  const salt       = encryptedBlob.slice(0, SALT_LENGTH);
  const iv         = encryptedBlob.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const ciphertext = encryptedBlob.slice(SALT_LENGTH + IV_LENGTH);

  const key = await deriveKey(password, salt);

  try {
    const plainBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv.buffer },
      key,
      ciphertext.buffer instanceof ArrayBuffer ? ciphertext.buffer : ciphertext,
    );

    const plaintext = new Uint8Array(plainBuffer);
    logger.info('Decryption complete', { outputSize: plaintext.length });
    return plaintext;

  } catch (err) {
    // AES-GCM auth failure = wrong password or tampered data
    logger.error('AES-GCM decryption failed — likely wrong password');
    throw new StegError(ERROR_CODES.INVALID_PASSWORD, '', err);
  }
}

// ─── Password Strength ────────────────────────────────────────────────────────

/**
 * Scores password strength on a 0-4 scale.
 * 0 = very weak, 4 = very strong.
 *
 * @param {string} password
 * @returns {number} 0-4
 */
export function scorePassword(password) {
  if (!password || password.length === 0) return -1;

  let score = 0;

  if (password.length >= 8)  score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  // Penalize simple patterns
  if (/^(.)\1+$/.test(password)) score = Math.max(0, score - 2); // all same char
  if (/^(012|123|234|345|456|567|678|789|890|abc|bcd|cde)/.test(password.toLowerCase())) score = Math.max(0, score - 1);

  return Math.min(4, score);
}
