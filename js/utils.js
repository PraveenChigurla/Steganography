/**
 * @fileoverview Shared utility functions for the Universal Steganography Toolkit.
 * These are pure, stateless helper functions with no side effects.
 */

'use strict';

// ─── File Size Formatting ─────────────────────────────────────────────────────

/**
 * Converts a byte count to a human-readable string.
 * @param {number} bytes
 * @param {number} [decimals=2]
 * @returns {string} e.g. "4.62 MB"
 */
export function formatFileSize(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  if (bytes < 0) return 'Unknown';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const idx = Math.min(i, sizes.length - 1);
  return parseFloat((bytes / Math.pow(k, idx)).toFixed(dm)) + ' ' + sizes[idx];
}

// ─── File Extension & Type ────────────────────────────────────────────────────

/**
 * Extracts the file extension from a filename (lowercase, no dot).
 * @param {string} filename
 * @returns {string} e.g. "png"
 */
export function getFileExtension(filename) {
  if (!filename || typeof filename !== 'string') return '';
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase().trim() : '';
}

/**
 * Returns the base name without extension.
 * @param {string} filename
 * @returns {string}
 */
export function getBaseName(filename) {
  if (!filename || typeof filename !== 'string') return '';
  const parts = filename.split('.');
  if (parts.length <= 1) return filename;
  return parts.slice(0, -1).join('.');
}

/**
 * Determines payload type from file extension.
 * @param {string} ext
 * @returns {number} PAYLOAD_TYPE constant
 */
export function payloadTypeFromExtension(ext) {
  const imageExts  = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg', 'ico', 'tiff'];
  const videoExts  = ['mp4', 'avi', 'mkv', 'mov', 'webm', 'flv', 'm4v'];
  const audioExts  = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'opus'];
  const pdfExts    = ['pdf'];
  const zipExts    = ['zip', 'tar', 'gz', 'bz2', '7z', 'rar', 'xz', 'tar.gz'];
  const docExts    = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp'];
  const archiveExts = ['iso', 'img', 'dmg'];
  const execExts   = ['exe', 'dll', 'so', 'app', 'apk', 'deb', 'rpm', 'msi'];
  const sourceExts = ['js', 'ts', 'py', 'java', 'c', 'cpp', 'h', 'cs', 'go', 'rs', 'rb', 'php', 'swift', 'kt', 'html', 'css', 'json', 'xml', 'yaml', 'yml', 'toml', 'sh', 'bash', 'sql'];
  const dbExts     = ['db', 'sqlite', 'sqlite3', 'mdb', 'accdb', 'csv'];

  // PAYLOAD_TYPE values (must match constants.js)
  if (imageExts.includes(ext))   return 0x02;
  if (videoExts.includes(ext))   return 0x03;
  if (audioExts.includes(ext))   return 0x04;
  if (pdfExts.includes(ext))     return 0x05;
  if (zipExts.includes(ext))     return 0x06;
  if (docExts.includes(ext))     return 0x07;
  if (archiveExts.includes(ext)) return 0x08;
  if (execExts.includes(ext))    return 0x09;
  if (sourceExts.includes(ext))  return 0x0A;
  if (dbExts.includes(ext))      return 0x0B;
  return 0xFF; // BINARY
}

/**
 * Returns a friendly type label from a payload type code.
 * @param {number} typeCode
 * @returns {string}
 */
export function payloadTypeLabel(typeCode) {
  const labels = {
    0x01: 'Text',
    0x02: 'Image',
    0x03: 'Video',
    0x04: 'Audio',
    0x05: 'PDF',
    0x06: 'ZIP Archive',
    0x07: 'Document',
    0x08: 'Archive',
    0x09: 'Executable',
    0x0A: 'Source Code',
    0x0B: 'Database',
    0xFF: 'Binary File',
  };
  return labels[typeCode] || 'Unknown';
}

// ─── Buffer Utilities ─────────────────────────────────────────────────────────

/**
 * Converts an ArrayBuffer or Uint8Array to a hex string.
 * @param {ArrayBuffer|Uint8Array} buffer
 * @returns {string}
 */
export function arrayBufferToHex(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Converts a hex string to a Uint8Array.
 * @param {string} hex
 * @returns {Uint8Array}
 */
export function hexToUint8Array(hex) {
  if (hex.length % 2 !== 0) throw new Error('Invalid hex string length');
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Concatenates multiple Uint8Arrays into a single Uint8Array.
 * @param {...Uint8Array} arrays
 * @returns {Uint8Array}
 */
export function uint8ArrayConcat(...arrays) {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

/**
 * Converts an ArrayBuffer to Uint8Array.
 * @param {ArrayBuffer} buf
 * @returns {Uint8Array}
 */
export function toUint8Array(buf) {
  return buf instanceof Uint8Array ? buf : new Uint8Array(buf);
}

// ─── Encoding ─────────────────────────────────────────────────────────────────

/**
 * Encodes a string to UTF-8 Uint8Array.
 * @param {string} str
 * @returns {Uint8Array}
 */
export function encodeText(str) {
  return new TextEncoder().encode(str);
}

/**
 * Decodes a UTF-8 Uint8Array to string.
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export function decodeText(bytes) {
  return new TextDecoder('utf-8').decode(bytes);
}

// ─── Cryptographic Utilities ──────────────────────────────────────────────────

/**
 * Computes the SHA-256 hash of data using the Web Crypto API.
 * @param {Uint8Array|ArrayBuffer} data
 * @returns {Promise<Uint8Array>} 32-byte hash
 */
export async function sha256(data) {
  // Accept Uint8Array, ArrayBuffer, or DataView
  let buffer;
  if (data instanceof Uint8Array) {
    // Preserve exact byte range of the view
    buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  } else if (data instanceof ArrayBuffer) {
    buffer = data;
  } else if (ArrayBuffer.isView(data)) {
    // Handles DataView, etc.
    buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  } else {
    throw new TypeError('sha256: Unsupported data type');
  }

  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return new Uint8Array(hashBuffer);
}

/**
 * Generates cryptographically secure random bytes.
 * @param {number} length
 * @returns {Uint8Array}
 */
export function randomBytes(length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

/**
 * Compares two Uint8Arrays in constant time to prevent timing attacks.
 * @param {Uint8Array} a
 * @param {Uint8Array} b
 * @returns {boolean}
 */
export function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

// ─── Time & Performance ───────────────────────────────────────────────────────

/**
 * Returns a promise that resolves after `ms` milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Creates a debounced version of a function.
 * @param {Function} fn
 * @param {number} delay
 * @returns {Function}
 */
export function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Formats a duration in milliseconds to a human-readable string.
 * @param {number} ms
 * @returns {string} e.g. "2.3s" or "1m 23s"
 */
export function formatDuration(ms) {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  if (m === 0) return `${s}s`;
  return `${m}m ${s % 60}s`;
}

/**
 * Estimates remaining time given progress and elapsed time.
 * @param {number} percent 0–100
 * @param {number} elapsedMs
 * @returns {string}
 */
export function estimateTimeRemaining(percent, elapsedMs) {
  if (percent <= 0) return 'Calculating...';
  if (percent >= 100) return 'Done';
  const totalEstimate = (elapsedMs / percent) * 100;
  const remaining = totalEstimate - elapsedMs;
  return formatDuration(remaining);
}

// ─── DOM Utilities ────────────────────────────────────────────────────────────

/**
 * Safely queries a DOM element, throws if not found.
 * @param {string} selector
 * @param {Element} [root=document]
 * @returns {Element}
 */
export function $(selector, root = document) {
  const el = root.querySelector(selector);
  if (!el) throw new Error(`Element not found: ${selector}`);
  return el;
}

/**
 * Queries all matching DOM elements.
 * @param {string} selector
 * @param {Element} [root=document]
 * @returns {NodeList}
 */
export function $$(selector, root = document) {
  return root.querySelectorAll(selector);
}

/**
 * Reads a File as ArrayBuffer.
 * @param {File} file
 * @returns {Promise<ArrayBuffer>}
 */
export function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Reads a File as data URL.
 * @param {File} file
 * @returns {Promise<string>}
 */
export function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
    reader.readAsDataURL(file);
  });
}

/**
 * Loads an image element from a File, resolving when fully loaded.
 * @param {File|string} source - File object or URL
 * @returns {Promise<HTMLImageElement>}
 */
export function loadImageElement(source) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    if (source instanceof File) {
      const url = URL.createObjectURL(source);
      img.src = url;
      img.onload = () => { resolve(img); };
    } else {
      img.src = source;
    }
  });
}

/**
 * Clamps a number between min and max.
 * @param {number} val
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

/**
 * Converts a percentage (0-100) to a progress string.
 * @param {number} pct
 * @returns {string}
 */
export function pctStr(pct) {
  return `${Math.round(clamp(pct, 0, 100))}%`;
}

/**
 * Generates a random string ID.
 * @param {number} [len=8]
 * @returns {string}
 */
export function generateId(len = 8) {
  return Array.from(randomBytes(len)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, len);
}
