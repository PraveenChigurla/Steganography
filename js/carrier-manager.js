/**
 * @fileoverview Carrier Manager — handles loading, validating and previewing
 * image and video carrier files. Reads pixel data for image carriers and
 * extracts video metadata for video carriers.
 */

'use strict';

import { logger } from './logger.js';
import { StegError, handleError } from './error-handler.js';
import { ERROR_CODES, SUPPORTED_IMAGE_EXTENSIONS, SUPPORTED_VIDEO_EXTENSIONS, SUPPORTED_AUDIO_EXTENSIONS, SUPPORTED_DOCUMENT_EXTENSIONS,
         FILE_SIGNATURES, MAX_CARRIER_SIZE } from './constants.js';
import { getFileExtension, readFileAsArrayBuffer } from './utils.js';

// ─── Carrier Info Object ──────────────────────────────────────────────────────

/**
 * @typedef {Object} CarrierInfo
 * @property {'image'|'video'} type
 * @property {File} file
 * @property {string} name
 * @property {string} extension
 * @property {number} size
 * @property {number} width
 * @property {number} height
 * @property {number} [duration]   - Video only
 * @property {number} [fps]        - Video only
 * @property {number} [frameCount] - Video only
 * @property {HTMLCanvasElement|null} [canvas] - Image only (pixel data source)
 * @property {string} objectUrl
 */

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Loads and validates an image carrier file.
 * @param {File} file
 * @returns {Promise<CarrierInfo>}
 * @throws {StegError}
 */
export async function loadImageCarrier(file) {
  logger.setStage('LoadImageCarrier');
  logger.info('Loading image carrier', { name: file.name, size: file.size });

  validateFileSizeLimit(file);
  await validateFileSignatureImage(file);

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  const objectUrl = URL.createObjectURL(file);

  const img = await new Promise((resolve, reject) => {
    const image = new Image();
    image.onload  = () => resolve(image);
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new StegError(ERROR_CODES.CORRUPTED_IMAGE, file.name));
    };
    image.src = objectUrl;
  });

  canvas.width  = img.naturalWidth;
  canvas.height = img.naturalHeight;

  try {
    ctx.drawImage(img, 0, 0);
    // Test pixel read to detect tainted canvas (cross-origin issues)
    ctx.getImageData(0, 0, 1, 1);
  } catch {
    URL.revokeObjectURL(objectUrl);
    throw new StegError(ERROR_CODES.CORRUPTED_IMAGE, `Could not read pixel data from ${file.name}`);
  }

  const info = {
    type:      'image',
    file,
    name:      file.name,
    extension: getFileExtension(file.name),
    size:      file.size,
    width:     img.naturalWidth,
    height:    img.naturalHeight,
    canvas,
    objectUrl,
  };

  logger.info('Image carrier loaded', { width: info.width, height: info.height });
  return info;
}

/**
 * Loads and validates a video carrier file.
 * @param {File} file
 * @returns {Promise<CarrierInfo>}
 * @throws {StegError}
 */
export async function loadVideoCarrier(file) {
  logger.setStage('LoadVideoCarrier');
  logger.info('Loading video carrier', { name: file.name, size: file.size });

  validateFileSizeLimit(file);

  const objectUrl = URL.createObjectURL(file);

  const videoEl = await new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.preload  = 'metadata';
    v.muted    = true;
    v.playsInline = true;
    v.onloadedmetadata = () => resolve(v);
    v.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new StegError(ERROR_CODES.CORRUPTED_VIDEO, file.name));
    };
    v.src = objectUrl;
  });

  const { videoWidth, videoHeight, duration } = videoEl;

  if (!videoWidth || !videoHeight || !duration) {
    URL.revokeObjectURL(objectUrl);
    throw new StegError(ERROR_CODES.CORRUPTED_VIDEO, `Unable to read dimensions/duration from ${file.name}`);
  }

  // Estimate FPS from media track info (not always available)
  let fps = 30; // default fallback
  try {
    if (videoEl.getVideoPlaybackQuality) {
      // Can't reliably get FPS without playing; use 30 as safe default
    }
    // Try to detect from file extension-based typical FPS
    const ext = getFileExtension(file.name);
    if (['webm', 'mp4'].includes(ext)) fps = 30;
  } catch { /* ignore */ }

  const frameCount = Math.floor(duration * fps);

  const info = {
    type:       'video',
    file,
    name:       file.name,
    extension:  getFileExtension(file.name),
    size:       file.size,
    width:      videoWidth,
    height:     videoHeight,
    duration,
    fps,
    frameCount,
    videoEl,
    objectUrl,
  };

  logger.info('Video carrier loaded', { width: info.width, height: info.height, duration, fps, frameCount });
  return info;
}

/**
 * Loads and validates an audio carrier file.
 * @param {File} file
 * @returns {Promise<CarrierInfo>}
 * @throws {StegError}
 */
export async function loadAudioCarrier(file) {
  logger.setStage('LoadAudioCarrier');
  logger.info('Loading audio carrier', { name: file.name, size: file.size });

  validateFileSizeLimit(file);
  await validateFileSignatureAudio(file);

  const objectUrl = URL.createObjectURL(file);

  const audioEl = await new Promise((resolve, reject) => {
    const a = document.createElement('audio');
    a.preload = 'metadata';
    a.onloadedmetadata = () => resolve(a);
    a.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new StegError(ERROR_CODES.CARRIER_READ_FAILURE, `Failed to read audio metadata for ${file.name}`));
    };
    a.src = objectUrl;
  });

  const duration = audioEl.duration;

  if (!duration) {
    URL.revokeObjectURL(objectUrl);
    throw new StegError(ERROR_CODES.CARRIER_READ_FAILURE, `Unable to read duration from ${file.name}`);
  }

  const info = {
    type:       'audio',
    file,
    name:       file.name,
    extension:  getFileExtension(file.name),
    size:       file.size,
    duration,
    audioEl,
    objectUrl,
  };

  logger.info('Audio carrier loaded', { duration });
  return info;
}

/**
 * Loads and validates a document/generic file carrier.
 * @param {File} file
 * @returns {Promise<CarrierInfo>}
 * @throws {StegError}
 */
export async function loadDocumentCarrier(file) {
  logger.setStage('LoadDocumentCarrier');
  logger.info('Loading document carrier', { name: file.name, size: file.size });

  validateFileSizeLimit(file);
  await validateFileSignatureDocument(file);

  const info = {
    type:       'document',
    file,
    name:       file.name,
    extension:  getFileExtension(file.name),
    size:       file.size,
  };

  logger.info('Document carrier loaded');
  return info;
}

/**
 * Extracts ImageData from an image carrier's canvas.
 * @param {CarrierInfo} carrier
 * @returns {ImageData}
 */
export function getImageData(carrier) {
  if (carrier.type !== 'image' || !carrier.canvas) {
    throw new StegError(ERROR_CODES.PIXEL_PROCESSING, 'Invalid image carrier');
  }
  const ctx = carrier.canvas.getContext('2d');
  return ctx.getImageData(0, 0, carrier.width, carrier.height);
}

/**
 * Writes modified ImageData back to the carrier's canvas.
 * @param {CarrierInfo} carrier
 * @param {ImageData} imageData
 */
export function putImageData(carrier, imageData) {
  if (carrier.type !== 'image' || !carrier.canvas) {
    throw new StegError(ERROR_CODES.IMAGE_RECONSTRUCTION, 'Invalid image carrier');
  }
  const ctx = carrier.canvas.getContext('2d');
  ctx.putImageData(imageData, 0, 0);
}

/**
 * Exports the modified image carrier canvas as a PNG Blob.
 * @param {CarrierInfo} carrier
 * @returns {Promise<Blob>}
 */
export function exportImageAsBlob(carrier) {
  return new Promise((resolve, reject) => {
    if (!carrier.canvas) {
      reject(new StegError(ERROR_CODES.IMAGE_RECONSTRUCTION));
      return;
    }
    carrier.canvas.toBlob(blob => {
      if (!blob) { reject(new StegError(ERROR_CODES.IMAGE_RECONSTRUCTION, 'Canvas.toBlob returned null')); return; }
      resolve(blob);
    }, 'image/png');
  });
}

/**
 * Releases an object URL to free memory.
 * @param {CarrierInfo} carrier
 */
export function releaseCarrier(carrier) {
  if (carrier.objectUrl) {
    URL.revokeObjectURL(carrier.objectUrl);
    logger.debug('Released carrier object URL');
  }
}

// ─── Validation Helpers ───────────────────────────────────────────────────────

/**
 * @param {File} file
 */
function validateFileSizeLimit(file) {
  if (file.size === 0) throw new StegError(ERROR_CODES.EMPTY_FILE, file.name);
  if (file.size > MAX_CARRIER_SIZE) {
    throw new StegError(ERROR_CODES.FILE_TOO_LARGE, `${file.name} (${(file.size / 1048576).toFixed(1)} MB)`);
  }
}

/**
 * Validates image file signature (magic bytes) against known formats.
 * @param {File} file
 */
async function validateFileSignatureImage(file) {
  const ext = getFileExtension(file.name);
  if (!SUPPORTED_IMAGE_EXTENSIONS.includes(ext)) {
    throw new StegError(ERROR_CODES.UNSUPPORTED_IMAGE_FORMAT, `Extension: .${ext}`);
  }

  try {
    const header = await readFileHeader(file, 12);
    const isPNG  = matchesSignature(header, FILE_SIGNATURES.PNG);
    const isBMP  = matchesSignature(header, FILE_SIGNATURES.BMP);
    const isRIFF = matchesSignature(header, FILE_SIGNATURES.RIFF); // WebP

    if (!isPNG && !isBMP && !isRIFF) {
      throw new StegError(ERROR_CODES.INVALID_FILE_SIGNATURE,
        `${file.name} does not match PNG, BMP, or WebP signatures`);
    }
  } catch (err) {
    if (err instanceof StegError) throw err;
    throw new StegError(ERROR_CODES.CARRIER_READ_FAILURE, file.name, err);
  }
}

/**
 * Validates audio file signature (magic bytes) against known formats.
 * @param {File} file
 */
async function validateFileSignatureAudio(file) {
  const ext = getFileExtension(file.name);
  if (!SUPPORTED_AUDIO_EXTENSIONS.includes(ext)) {
    throw new StegError(ERROR_CODES.INVALID_FILE_SIGNATURE, `Extension: .${ext}`);
  }

  try {
    const header = await readFileHeader(file, 12);
    // Note: Audio file signatures can be tricky (e.g. ID3 tags for MP3s can vary in structure or be missing).
    // We do a soft validation here.
    const isID3 = matchesSignature(header, FILE_SIGNATURES.ID3) || (header[0] === 0xFF && (header[1] & 0xE0) === 0xE0); // MP3 frame sync
    const isRIFF = matchesSignature(header, FILE_SIGNATURES.RIFF); // WAV
    const isOGG = matchesSignature(header, FILE_SIGNATURES.OGG); // OGG
    const isFLAC = matchesSignature(header, FILE_SIGNATURES.FLAC); // FLAC
    const isM4A = matchesSignature(header.slice(4), FILE_SIGNATURES.MP4_FTYP); // MP4/M4A

    if (!isID3 && !isRIFF && !isOGG && !isFLAC && !isM4A) {
      throw new StegError(ERROR_CODES.INVALID_FILE_SIGNATURE,
        `${file.name} does not have a recognized audio signature`);
    }
  } catch (err) {
    if (err instanceof StegError) throw err;
    throw new StegError(ERROR_CODES.CARRIER_READ_FAILURE, file.name, err);
  }
}

/**
 * Validates document file signature (magic bytes) against known formats.
 * Because document formats are so varied (txt, py, docx, etc.), this is mostly
 * an extension check.
 * @param {File} file
 */
async function validateFileSignatureDocument(file) {
  const ext = getFileExtension(file.name);
  if (!SUPPORTED_DOCUMENT_EXTENSIONS.includes(ext)) {
    throw new StegError(ERROR_CODES.INVALID_FILE_SIGNATURE, `Extension: .${ext}`);
  }
}

/**
 * Reads the first N bytes of a file as a Uint8Array.
 * @param {File} file
 * @param {number} bytes
 * @returns {Promise<Uint8Array>}
 */
async function readFileHeader(file, bytes) {
  const slice = file.slice(0, bytes);
  const buffer = await readFileAsArrayBuffer(slice);
  return new Uint8Array(buffer);
}

/**
 * Checks if a buffer starts with the given signature bytes.
 * @param {Uint8Array} buffer
 * @param {number[]} signature
 * @returns {boolean}
 */
function matchesSignature(buffer, signature) {
  return signature.every((byte, i) => buffer[i] === byte);
}
