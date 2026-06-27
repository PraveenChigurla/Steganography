/**
 * @fileoverview Error handling module for the Universal Steganography Toolkit.
 * Provides the StegError class and a complete catalog of user-friendly error messages.
 * Every error explains what happened, why, and how to fix it.
 */

'use strict';

import { ERROR_CODES } from './constants.js';
import { logger } from './logger.js';

// ─── StegError Class ──────────────────────────────────────────────────────────

/**
 * Custom error class for all steganography toolkit errors.
 * Contains structured information for user-friendly display.
 */
export class StegError extends Error {
  /**
   * @param {string} code - ERROR_CODES constant
   * @param {string} [details] - Additional context (file sizes, names, etc.)
   * @param {Error} [cause] - Original error for internal logging
   */
  constructor(code, details = '', cause = null) {
    const catalog = ERROR_CATALOG[code] || ERROR_CATALOG[ERROR_CODES.UNKNOWN];
    super(catalog.title);
    this.name = 'StegError';
    this.code = code;
    this.title = catalog.title;
    this.description = catalog.description;
    this.suggestion = catalog.suggestion;
    this.details = details;
    this.cause = cause;
    this.timestamp = new Date().toISOString();
  }

  /**
   * Returns a full user-facing message string.
   * @returns {string}
   */
  toUserMessage() {
    let msg = `${this.description}`;
    if (this.details) msg += `\n\n${this.details}`;
    msg += `\n\n💡 ${this.suggestion}`;
    return msg;
  }
}

// ─── Error Catalog ────────────────────────────────────────────────────────────

/**
 * Complete catalog of all possible errors.
 * Each entry has: title, description, suggestion.
 */
export const ERROR_CATALOG = Object.freeze({

  // ── Carrier Errors ──────────────────────────────────────────────────────────

  [ERROR_CODES.NO_CARRIER]: {
    title: 'No Carrier Media Selected',
    description: 'You must select a cover image, video, audio, or document file before encrypting.',
    suggestion: 'Click or drag a supported Image, Video, Audio, or Document file into the carrier drop zone.',
  },
  [ERROR_CODES.UNSUPPORTED_IMAGE_FORMAT]: {
    title: 'Unsupported Image Format',
    description: 'The selected image format is not supported. Only lossless formats can be used as carriers to avoid data loss during compression.',
    suggestion: 'Use a PNG, BMP, or lossless WebP image. JPEG and other lossy formats cannot be used because they destroy embedded data.',
  },
  [ERROR_CODES.UNSUPPORTED_VIDEO_FORMAT]: {
    title: 'Unsupported Video Format',
    description: 'The selected video format is not supported for steganographic embedding.',
    suggestion: 'Use an MP4, AVI, MKV, MOV, or WebM video file.',
  },
  [ERROR_CODES.CORRUPTED_IMAGE]: {
    title: 'Corrupted Image File',
    description: 'The selected image file could not be read. The file may be corrupted or incomplete.',
    suggestion: 'Try a different image file. If you downloaded this file, try downloading it again.',
  },
  [ERROR_CODES.CORRUPTED_VIDEO]: {
    title: 'Corrupted Video File',
    description: 'The selected video file could not be loaded. The file may be corrupted, incomplete, or use an unsupported codec.',
    suggestion: 'Try a different video file or re-encode it using a standard codec (H.264 for MP4, VP8/VP9 for WebM).',
  },
  [ERROR_CODES.EMPTY_FILE]: {
    title: 'Empty File',
    description: 'The selected file contains no data (0 bytes).',
    suggestion: 'Select a valid, non-empty file.',
  },
  [ERROR_CODES.INVALID_FILE_SIGNATURE]: {
    title: 'Invalid File Format',
    description: 'The file\'s internal format does not match its extension. The file may be renamed or corrupted.',
    suggestion: 'Ensure the file is a genuine media file. Renaming a file to change its extension does not convert it.',
  },
  [ERROR_CODES.CARRIER_READ_FAILURE]: {
    title: 'Failed to Read Carrier File',
    description: 'An error occurred while reading the carrier file. Your browser may have denied file access.',
    suggestion: 'Try again. If the problem persists, try a different file or refresh the page.',
  },
  [ERROR_CODES.FILE_TOO_LARGE]: {
    title: 'File Too Large',
    description: 'The selected file exceeds the maximum supported size of 500 MB.',
    suggestion: 'Use a smaller file, or split your content across multiple steganographic operations.',
  },

  // ── Payload Errors ──────────────────────────────────────────────────────────

  [ERROR_CODES.NO_PAYLOAD]: {
    title: 'No Secret Data Provided',
    description: 'You must provide something to hide — either type a text message or upload one or more files.',
    suggestion: 'Switch to the Text tab and enter a message, or switch to the Files tab and upload the files you want to hide.',
  },
  [ERROR_CODES.EMPTY_TEXT]: {
    title: 'Empty Text Message',
    description: 'The text message field is empty. There is nothing to encrypt.',
    suggestion: 'Type your secret message in the text editor before encrypting.',
  },
  [ERROR_CODES.EMPTY_FILE_PAYLOAD]: {
    title: 'Empty Payload File',
    description: 'One or more of the selected payload files contains no data.',
    suggestion: 'Remove the empty file(s) and select valid files to hide.',
  },
  [ERROR_CODES.PAYLOAD_TOO_LARGE]: {
    title: 'Payload Exceeds Carrier Capacity',
    description: 'The selected payload is too large to fit in the chosen carrier media.',
    suggestion: 'Choose a larger carrier file, reduce the number or size of files you\'re hiding, or compress your files manually before uploading.',
  },
  [ERROR_CODES.ZIP_CREATION_FAILURE]: {
    title: 'ZIP Creation Failed',
    description: 'Could not create the ZIP archive for multiple files. This may be due to browser memory limitations.',
    suggestion: 'Try with fewer or smaller files. If the problem persists, create a ZIP file manually and upload it as a single file.',
  },
  [ERROR_CODES.COMPRESSION_FAILURE]: {
    title: 'Compression Failed',
    description: 'The payload could not be compressed before encryption.',
    suggestion: 'The application will retry without compression. If the error persists, refresh the page and try again.',
  },

  // ── Password Errors ─────────────────────────────────────────────────────────

  [ERROR_CODES.EMPTY_PASSWORD]: {
    title: 'Password Required',
    description: 'You must set a password to encrypt the hidden data.',
    suggestion: 'Enter a strong password in both the Password and Confirm Password fields.',
  },
  [ERROR_CODES.PASSWORD_MISMATCH]: {
    title: 'Passwords Do Not Match',
    description: 'The password and confirmation password are different.',
    suggestion: 'Make sure both password fields contain exactly the same text.',
  },
  [ERROR_CODES.INVALID_PASSWORD]: {
    title: 'Incorrect Password',
    description: 'The password you entered is incorrect and the hidden data cannot be decrypted.',
    suggestion: 'Check your password carefully — it is case-sensitive. If you have forgotten the password, the data cannot be recovered.',
  },

  // ── Encryption Errors ───────────────────────────────────────────────────────

  [ERROR_CODES.ENCRYPTION_FAILURE]: {
    title: 'Encryption Failed',
    description: 'The AES-256-GCM encryption operation failed unexpectedly.',
    suggestion: 'Refresh the page and try again. If the problem persists, your browser may not fully support the Web Crypto API.',
  },
  [ERROR_CODES.KEY_DERIVATION_FAILURE]: {
    title: 'Key Derivation Failed',
    description: 'Could not derive an encryption key from your password using PBKDF2.',
    suggestion: 'Refresh the page and try again. Ensure your browser is up to date, as older browsers may have limited Web Crypto API support.',
  },
  [ERROR_CODES.IV_GENERATION_FAILURE]: {
    title: 'IV Generation Failed',
    description: 'Could not generate a secure random initialization vector.',
    suggestion: 'Refresh the page and try again. This is a browser API issue.',
  },
  [ERROR_CODES.METADATA_GENERATION]: {
    title: 'Metadata Generation Failed',
    description: 'Could not create the embedded header for the payload.',
    suggestion: 'Refresh the page and try again.',
  },

  // ── Embedding Errors ────────────────────────────────────────────────────────

  [ERROR_CODES.CAPACITY_EXCEEDED]: {
    title: 'Carrier Capacity Exceeded',
    description: 'The total encrypted payload (including header and metadata) is larger than the carrier can hold.',
    suggestion: 'Use a higher-resolution image, a longer video, or reduce the payload size.',
  },
  [ERROR_CODES.PIXEL_PROCESSING]: {
    title: 'Image Pixel Processing Error',
    description: 'An error occurred while modifying the image pixel data for LSB embedding.',
    suggestion: 'Try a different image. Ensure the image is a valid PNG or BMP file.',
  },
  [ERROR_CODES.FRAME_PROCESSING]: {
    title: 'Video Frame Processing Error',
    description: 'An error occurred while processing a video frame for LSB embedding.',
    suggestion: 'Try a different video file. The video codec may be incompatible with browser canvas rendering.',
  },
  [ERROR_CODES.IMAGE_RECONSTRUCTION]: {
    title: 'Image Reconstruction Failed',
    description: 'The modified image could not be reconstructed and saved after embedding.',
    suggestion: 'Try a different image format. PNG is the most reliable format for this operation.',
  },
  [ERROR_CODES.VIDEO_RECONSTRUCTION]: {
    title: 'Video Reconstruction Failed',
    description: 'The modified video frames could not be re-encoded after embedding.',
    suggestion: 'Ensure your browser supports MediaRecorder with WebM/VP8 output. Try using Chrome or Firefox for best compatibility.',
  },
  [ERROR_CODES.EMBEDDING_INTERRUPTED]: {
    title: 'Embedding Interrupted',
    description: 'The embedding process was interrupted unexpectedly.',
    suggestion: 'Refresh the page and try again. Avoid navigating away or closing the browser during processing.',
  },

  // ── Extraction Errors ───────────────────────────────────────────────────────

  [ERROR_CODES.NO_HIDDEN_DATA]: {
    title: 'No Hidden Data Found',
    description: 'This file does not appear to contain any data embedded with this toolkit.',
    suggestion: 'Make sure you are uploading a stego file that was created with this application. Regular image/video files will not contain hidden data.',
  },
  [ERROR_CODES.INVALID_MAGIC]: {
    title: 'Invalid Signature',
    description: 'The embedded header signature does not match. This file was not created with this toolkit, or the embedded data is corrupted.',
    suggestion: 'Verify that you are using the correct stego file — the output file from the Encrypt operation, not the original carrier.',
  },
  [ERROR_CODES.METADATA_CORRUPTION]: {
    title: 'Metadata Corrupted',
    description: 'The embedded metadata header is corrupted and cannot be parsed.',
    suggestion: 'The stego file may have been modified, re-compressed, or corrupted after creation. Lossless formats must be used to preserve embedded data.',
  },
  [ERROR_CODES.CHECKSUM_MISMATCH]: {
    title: 'Data Integrity Check Failed',
    description: 'The extracted payload does not match the checksum stored in the header. The data may have been corrupted.',
    suggestion: 'The stego file may have been modified after creation. Ensure the file was not re-compressed, converted, or edited.',
  },
  [ERROR_CODES.INTEGRITY_FAILURE]: {
    title: 'Header Integrity Verification Failed',
    description: 'The header integrity hash does not match. The header itself has been tampered with or corrupted.',
    suggestion: 'Use the original, unmodified stego file. Do not edit, compress, or re-save the stego file after downloading it.',
  },
  [ERROR_CODES.UNSUPPORTED_VERSION]: {
    title: 'Unsupported Toolkit Version',
    description: 'This stego file was created with a newer version of the toolkit that is not compatible with the current version.',
    suggestion: 'Update your toolkit to the latest version, or use the same version that was used to create this stego file.',
  },
  [ERROR_CODES.UNSUPPORTED_ALGORITHM]: {
    title: 'Unsupported Encryption Algorithm',
    description: 'The embedded data uses an encryption algorithm that is not supported by this version of the toolkit.',
    suggestion: 'Use the same version of the toolkit that was used to create this stego file.',
  },
  [ERROR_CODES.DECRYPTION_FAILURE]: {
    title: 'Decryption Failed',
    description: 'The data could not be decrypted. This is most likely due to an incorrect password.',
    suggestion: 'Double-check your password — it is case-sensitive. If you have forgotten the password, the data cannot be recovered.',
  },
  [ERROR_CODES.PAYLOAD_RECONSTRUCTION]: {
    title: 'Payload Reconstruction Failed',
    description: 'The decrypted data could not be reconstructed into the original file.',
    suggestion: 'The data may be corrupted. Ensure you are using the original stego file and the correct password.',
  },

  // ── Download Errors ─────────────────────────────────────────────────────────

  [ERROR_CODES.DOWNLOAD_FAILURE]: {
    title: 'Download Failed',
    description: 'The file could not be downloaded.',
    suggestion: 'Right-click the download button and select "Save link as..." to try manually. Ensure your browser has permission to download files.',
  },
  [ERROR_CODES.BLOB_CREATION]: {
    title: 'File Creation Failed',
    description: 'Could not create the output file blob in memory.',
    suggestion: 'Your browser may be low on memory. Try closing other tabs and try again.',
  },
  [ERROR_CODES.DOWNLOAD_NOT_SUPPORTED]: {
    title: 'Download Not Supported',
    description: 'Your browser does not support programmatic file downloads.',
    suggestion: 'Use a modern browser such as Chrome, Firefox, Edge, or Safari to download files.',
  },

  // ── General ─────────────────────────────────────────────────────────────────

  [ERROR_CODES.UNKNOWN]: {
    title: 'Unexpected Error',
    description: 'An unexpected error occurred during processing.',
    suggestion: 'Refresh the page and try again. If the problem persists, check the browser console for more information.',
  },
});

// ─── Error Handler ────────────────────────────────────────────────────────────

/**
 * Handles any error, logging it internally and converting to a StegError if needed.
 * @param {Error|StegError} error
 * @param {string} [context] - Where the error occurred
 * @returns {StegError}
 */
export function handleError(error, context = '') {
  if (error instanceof StegError) {
    logger.error(`[${error.code}] ${error.title}`, {
      context,
      details: error.details,
      cause: error.cause?.message,
    });
    return error;
  }

  // Wrap unknown errors
  logger.error(`Unexpected error in ${context}`, {
    message: error.message,
    type: error.constructor?.name,
  });

  return new StegError(ERROR_CODES.UNKNOWN, error.message, error);
}

/**
 * Creates a StegError with formatted size details for capacity errors.
 * @param {number} payloadBytes
 * @param {number} capacityBytes
 * @returns {StegError}
 */
export function createCapacityError(payloadBytes, capacityBytes) {
  const { formatFileSize } = { formatFileSize: (b) => `${(b / 1048576).toFixed(2)} MB` };
  const details = `Selected payload: ${formatFileSize(payloadBytes)}\nAvailable capacity: ${formatFileSize(capacityBytes)}`;
  return new StegError(ERROR_CODES.PAYLOAD_TOO_LARGE, details);
}
