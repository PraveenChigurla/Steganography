/**
 * @fileoverview Application-wide constants for the Universal Steganography Toolkit.
 * All magic bytes, version numbers, format identifiers, and configuration values
 * are centralized here to allow easy future updates.
 */

'use strict';

// ─── Magic Signature ──────────────────────────────────────────────────────────

/** 4-byte magic signature embedded at the start of every stego payload header */
export const MAGIC_SIGNATURE = new Uint8Array([0x53, 0x54, 0x45, 0x47]); // "STEG"

/** String version of magic for comparison */
export const MAGIC_SIGNATURE_STR = 'STEG';

// ─── Version ──────────────────────────────────────────────────────────────────

/** Application version encoded in the header (major.minor as two bytes) */
export const APP_VERSION_MAJOR = 1;
export const APP_VERSION_MINOR = 0;

/** Human-readable version string */
export const APP_VERSION_STR = '1.0.0';

// ─── Carrier Types ────────────────────────────────────────────────────────────

export const CARRIER_TYPE = Object.freeze({
  IMAGE: 0x01,
  VIDEO: 0x02,
  AUDIO: 0x03, 
  DOCUMENT: 0x04,
});

// ─── Payload Types ────────────────────────────────────────────────────────────

export const PAYLOAD_TYPE = Object.freeze({
  TEXT:       0x01,
  IMAGE:      0x02,
  VIDEO:      0x03,
  AUDIO:      0x04,
  PDF:        0x05,
  ZIP:        0x06,
  DOCUMENT:   0x07,
  ARCHIVE:    0x08,
  EXECUTABLE: 0x09,
  SOURCE:     0x0A,
  DATABASE:   0x0B,
  BINARY:     0xFF,
});

// ─── Encryption Algorithms ────────────────────────────────────────────────────

export const ENCRYPTION_ALGO = Object.freeze({
  AES_256_GCM: 0x01,
});

// ─── Compression Algorithms ───────────────────────────────────────────────────

export const COMPRESSION_ALGO = Object.freeze({
  NONE:    0x00,
  DEFLATE: 0x01,
});

// ─── Supported Formats ────────────────────────────────────────────────────────

export const SUPPORTED_IMAGE_EXTENSIONS = Object.freeze(['png', 'bmp', 'webp']);
export const SUPPORTED_VIDEO_EXTENSIONS = Object.freeze(['mp4', 'avi', 'mkv', 'mov', 'webm']);
export const SUPPORTED_AUDIO_EXTENSIONS = Object.freeze(['mp3', 'wav', 'ogg', 'flac', 'm4a']);
export const SUPPORTED_DOCUMENT_EXTENSIONS = Object.freeze(['pdf', 'docx', 'xlsx', 'pptx', 'zip', 'txt', 'py', 'js', 'java', 'html', 'css', 'json', 'csv']);

export const SUPPORTED_IMAGE_MIME = Object.freeze([
  'image/png',
  'image/bmp',
  'image/webp',
]);

export const SUPPORTED_VIDEO_MIME = Object.freeze([
  'video/mp4',
  'video/x-msvideo',
  'video/x-matroska',
  'video/quicktime',
  'video/webm',
  'video/avi',
]);

export const SUPPORTED_AUDIO_MIME = Object.freeze([
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/flac',
  'audio/mp4',
  'audio/x-m4a',
]);

/** Maps extension to MIME type */
export const EXTENSION_TO_MIME = Object.freeze({
  png:  'image/png',
  bmp:  'image/bmp',
  webp: 'image/webp',
  mp4:  'video/mp4',
  avi:  'video/x-msvideo',
  mkv:  'video/x-matroska',
  mov:  'video/quicktime',
  webm: 'video/webm',
  mp3:  'audio/mpeg',
  wav:  'audio/wav',
  ogg:  'audio/ogg',
  flac: 'audio/flac',
  m4a:  'audio/mp4',
});

// ─── File Signature Bytes (Magic Numbers) ─────────────────────────────────────

/** Magic bytes to detect actual file format regardless of extension */
export const FILE_SIGNATURES = Object.freeze({
  PNG:  [0x89, 0x50, 0x4E, 0x47],
  BMP:  [0x42, 0x4D],
  RIFF: [0x52, 0x49, 0x46, 0x46], // WebP and WAV use RIFF container
  MP4_FTYP: [0x66, 0x74, 0x79, 0x70], // 'ftyp' at offset 4
  WEBM: [0x1A, 0x45, 0xDF, 0xA3],
  ZIP:  [0x50, 0x4B, 0x03, 0x04],
  PDF:  [0x25, 0x50, 0x44, 0x46],
  ID3:  [0x49, 0x44, 0x33], // MP3 ID3v2 tag
  OGG:  [0x4F, 0x67, 0x67, 0x53], // OggS
  FLAC: [0x66, 0x4C, 0x61, 0x43], // fLaC
});

// ─── LSB Configuration ────────────────────────────────────────────────────────

/** Number of least-significant bits used per channel for embedding */
export const LSB_BITS_PER_CHANNEL = 2;

/** Number of channels used (R, G, B — alpha skipped) */
export const LSB_CHANNELS = 3;

/** Total bits embedded per pixel */
export const LSB_BITS_PER_PIXEL = LSB_BITS_PER_CHANNEL * LSB_CHANNELS; // 6

// ─── Header Layout ────────────────────────────────────────────────────────────

/**
 * Fixed-size portion of the binary header (bytes).
 * Layout:
 *  [0-3]   magic signature (4)
 *  [4]     version major (1)
 *  [5]     version minor (1)
 *  [6]     carrier type (1)
 *  [7]     encryption algorithm (1)
 *  [8]     compression flag (1)
 *  [9]     payload type (1)
 *  [10]    zip flag (1)
 *  [11-12] filename length in bytes (2, uint16 LE)
 *  [13-14] extension length in bytes (2, uint16 LE)
 *  [15-18] payload size in bytes (4, uint32 LE)
 *  [19-22] salt length (4, uint32 LE)  -- always 16
 *  [23-26] iv length (4, uint32 LE)    -- always 12
 *  [27-34] timestamp (8, uint64 LE as two uint32)
 *  [35-66] SHA-256 checksum of plaintext payload (32)
 *  [67-98] SHA-256 integrity hash of header fields 0-66 (32)
 *  TOTAL FIXED = 99 bytes
 *  Then: filename bytes (variable)
 *  Then: extension bytes (variable)
 */
export const HEADER_FIXED_SIZE = 99;

// ─── Crypto Parameters ────────────────────────────────────────────────────────

/** PBKDF2 iteration count — OWASP 2023 recommendation for SHA-256 */
export const PBKDF2_ITERATIONS = 600_000;

/** Salt length in bytes */
export const SALT_LENGTH = 16;

/** AES-GCM IV length in bytes */
export const IV_LENGTH = 12;

/** AES key length in bits */
export const AES_KEY_BITS = 256;

// ─── Size Limits ──────────────────────────────────────────────────────────────

/** Maximum carrier file size (500 MB) */
export const MAX_CARRIER_SIZE = 500 * 1024 * 1024;

/** Maximum payload size (200 MB) */
export const MAX_PAYLOAD_SIZE = 200 * 1024 * 1024;

// ─── Video Processing ─────────────────────────────────────────────────────────

/** Maximum frames to extract for embedding (performance limit) */
export const MAX_VIDEO_FRAMES = 3000;

/** Target FPS for frame extraction */
export const VIDEO_EXTRACTION_FPS = 1; // 1 frame per second for manageable processing

/** MediaRecorder output MIME type */
export const VIDEO_OUTPUT_MIME = 'video/webm; codecs=vp8';

/** Fallback MIME if VP8 not supported */
export const VIDEO_OUTPUT_MIME_FALLBACK = 'video/webm';

// ─── Error Codes ──────────────────────────────────────────────────────────────

export const ERROR_CODES = Object.freeze({
  // Carrier
  NO_CARRIER:                'ERR_NO_CARRIER',
  UNSUPPORTED_IMAGE_FORMAT:  'ERR_UNSUPPORTED_IMAGE_FORMAT',
  UNSUPPORTED_VIDEO_FORMAT:  'ERR_UNSUPPORTED_VIDEO_FORMAT',
  CORRUPTED_IMAGE:           'ERR_CORRUPTED_IMAGE',
  CORRUPTED_VIDEO:           'ERR_CORRUPTED_VIDEO',
  EMPTY_FILE:                'ERR_EMPTY_FILE',
  INVALID_FILE_SIGNATURE:    'ERR_INVALID_FILE_SIGNATURE',
  CARRIER_READ_FAILURE:      'ERR_CARRIER_READ_FAILURE',
  FILE_TOO_LARGE:            'ERR_FILE_TOO_LARGE',

  // Payload
  NO_PAYLOAD:                'ERR_NO_PAYLOAD',
  EMPTY_TEXT:                'ERR_EMPTY_TEXT',
  EMPTY_FILE_PAYLOAD:        'ERR_EMPTY_FILE_PAYLOAD',
  PAYLOAD_TOO_LARGE:         'ERR_PAYLOAD_TOO_LARGE',
  ZIP_CREATION_FAILURE:      'ERR_ZIP_CREATION_FAILURE',
  COMPRESSION_FAILURE:       'ERR_COMPRESSION_FAILURE',

  // Password
  EMPTY_PASSWORD:            'ERR_EMPTY_PASSWORD',
  PASSWORD_MISMATCH:         'ERR_PASSWORD_MISMATCH',
  INVALID_PASSWORD:          'ERR_INVALID_PASSWORD',

  // Encryption
  ENCRYPTION_FAILURE:        'ERR_ENCRYPTION_FAILURE',
  KEY_DERIVATION_FAILURE:    'ERR_KEY_DERIVATION_FAILURE',
  IV_GENERATION_FAILURE:     'ERR_IV_GENERATION_FAILURE',
  METADATA_GENERATION:       'ERR_METADATA_GENERATION',

  // Embedding
  CAPACITY_EXCEEDED:         'ERR_CAPACITY_EXCEEDED',
  PIXEL_PROCESSING:          'ERR_PIXEL_PROCESSING',
  FRAME_PROCESSING:          'ERR_FRAME_PROCESSING',
  IMAGE_RECONSTRUCTION:      'ERR_IMAGE_RECONSTRUCTION',
  VIDEO_RECONSTRUCTION:      'ERR_VIDEO_RECONSTRUCTION',
  EMBEDDING_INTERRUPTED:     'ERR_EMBEDDING_INTERRUPTED',

  // Extraction
  NO_HIDDEN_DATA:            'ERR_NO_HIDDEN_DATA',
  INVALID_MAGIC:             'ERR_INVALID_MAGIC',
  METADATA_CORRUPTION:       'ERR_METADATA_CORRUPTION',
  CHECKSUM_MISMATCH:         'ERR_CHECKSUM_MISMATCH',
  INTEGRITY_FAILURE:         'ERR_INTEGRITY_FAILURE',
  UNSUPPORTED_VERSION:       'ERR_UNSUPPORTED_VERSION',
  UNSUPPORTED_ALGORITHM:     'ERR_UNSUPPORTED_ALGORITHM',
  DECRYPTION_FAILURE:        'ERR_DECRYPTION_FAILURE',
  PAYLOAD_RECONSTRUCTION:    'ERR_PAYLOAD_RECONSTRUCTION',

  // Download
  DOWNLOAD_FAILURE:          'ERR_DOWNLOAD_FAILURE',
  BLOB_CREATION:             'ERR_BLOB_CREATION',
  DOWNLOAD_NOT_SUPPORTED:    'ERR_DOWNLOAD_NOT_SUPPORTED',

  // General
  UNKNOWN:                   'ERR_UNKNOWN',
});

// ─── Password Strength Thresholds ─────────────────────────────────────────────

export const PASSWORD_STRENGTH = Object.freeze({
  VERY_WEAK: 0,
  WEAK:      1,
  FAIR:      2,
  STRONG:    3,
  VERY_STRONG: 4,
});

export const PASSWORD_STRENGTH_LABELS = Object.freeze({
  0: 'Very Weak',
  1: 'Weak',
  2: 'Fair',
  3: 'Strong',
  4: 'Very Strong',
});

// ─── Progress Steps ───────────────────────────────────────────────────────────

export const ENCRYPT_STEPS = Object.freeze([
  'Preparing Files',
  'Creating ZIP',
  'Compressing',
  'Encrypting',
  'Embedding',
  'Generating Output',
  'Finishing',
  'Complete',
]);

export const DECRYPT_STEPS = Object.freeze([
  'Validating Carrier',
  'Locating Header',
  'Verifying Signature',
  'Extracting Payload',
  'Verifying Checksum',
  'Deriving Key',
  'Decrypting',
  'Restoring Payload',
  'Complete',
]);
