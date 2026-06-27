/**
 * @fileoverview Internal logger for the Universal Steganography Toolkit.
 * Provides structured, level-filtered logging with security sanitization.
 * NEVER logs passwords, encryption keys, salts, IVs, or decrypted content.
 */

'use strict';

// ─── Log Levels ───────────────────────────────────────────────────────────────

export const LOG_LEVEL = Object.freeze({
  DEBUG: 0,
  INFO:  1,
  WARN:  2,
  ERROR: 3,
  NONE:  4,
});

// ─── Sensitive Key Patterns (scrubbed from all log output) ────────────────────

const SENSITIVE_KEYS = Object.freeze([
  'password', 'pass', 'pwd', 'key', 'secret', 'salt', 'iv',
  'nonce', 'token', 'credential', 'plaintext', 'decrypted',
]);

// ─── Logger Class ─────────────────────────────────────────────────────────────

class Logger {
  constructor() {
    /** @type {Array<{timestamp: string, level: string, stage: string, message: string, data?: any}>} */
    this._logs = [];

    /** @type {number} Current minimum log level */
    this._level = LOG_LEVEL.DEBUG;

    /** @type {string} Current pipeline stage */
    this._stage = 'Idle';

    /** @type {number} Maximum number of stored log entries */
    this._maxEntries = 1000;
  }

  // ─── Configuration ─────────────────────────────────────────────────────────

  /**
   * Sets the minimum log level.
   * @param {number} level - LOG_LEVEL constant
   */
  setLevel(level) {
    this._level = level;
  }

  /**
   * Sets the current pipeline stage name (shown in all subsequent logs).
   * @param {string} stage
   */
  setStage(stage) {
    this._stage = stage;
    this.info(`Stage: ${stage}`);
  }

  // ─── Logging Methods ───────────────────────────────────────────────────────

  /**
   * Logs a debug message.
   * @param {string} message
   * @param {any} [data]
   */
  debug(message, data) {
    this._log(LOG_LEVEL.DEBUG, 'DEBUG', message, data);
  }

  /**
   * Logs an informational message.
   * @param {string} message
   * @param {any} [data]
   */
  info(message, data) {
    this._log(LOG_LEVEL.INFO, 'INFO', message, data);
  }

  /**
   * Logs a warning message.
   * @param {string} message
   * @param {any} [data]
   */
  warn(message, data) {
    this._log(LOG_LEVEL.WARN, 'WARN', message, data);
  }

  /**
   * Logs an error message.
   * @param {string} message
   * @param {any} [data]
   */
  error(message, data) {
    this._log(LOG_LEVEL.ERROR, 'ERROR', message, data);
  }

  // ─── Log Retrieval ─────────────────────────────────────────────────────────

  /**
   * Returns all stored log entries.
   * @returns {Array<Object>}
   */
  getAll() {
    return [...this._logs];
  }

  /**
   * Returns logs for a specific stage.
   * @param {string} stage
   * @returns {Array<Object>}
   */
  getByStage(stage) {
    return this._logs.filter(entry => entry.stage === stage);
  }

  /**
   * Clears all stored log entries.
   */
  clear() {
    this._logs = [];
    this._stage = 'Idle';
  }

  /**
   * Exports logs as a formatted string for debugging.
   * @returns {string}
   */
  export() {
    return this._logs.map(entry => {
      const data = entry.data ? ` | ${JSON.stringify(entry.data)}` : '';
      return `[${entry.timestamp}] [${entry.level}] [${entry.stage}] ${entry.message}${data}`;
    }).join('\n');
  }

  // ─── Internal ──────────────────────────────────────────────────────────────

  /**
   * Core logging implementation with sanitization.
   * @param {number} level
   * @param {string} levelStr
   * @param {string} message
   * @param {any} [data]
   */
  _log(level, levelStr, message, data) {
    if (level < this._level) return;

    const timestamp = new Date().toISOString();
    const sanitizedData = data !== undefined ? this._sanitize(data) : undefined;

    const entry = {
      timestamp,
      level: levelStr,
      stage: this._stage,
      message: this._sanitizeString(message),
      ...(sanitizedData !== undefined && { data: sanitizedData }),
    };

    // Store in ring buffer
    this._logs.push(entry);
    if (this._logs.length > this._maxEntries) {
      this._logs.shift();
    }

    // Output to console
    const prefix = `[STEG] [${levelStr}] [${this._stage}]`;
    switch (level) {
      case LOG_LEVEL.DEBUG: console.debug(prefix, message, sanitizedData ?? ''); break;
      case LOG_LEVEL.INFO:  console.info(prefix, message, sanitizedData ?? '');  break;
      case LOG_LEVEL.WARN:  console.warn(prefix, message, sanitizedData ?? '');  break;
      case LOG_LEVEL.ERROR: console.error(prefix, message, sanitizedData ?? ''); break;
    }
  }

  /**
   * Recursively sanitizes an object to remove sensitive fields.
   * @param {any} data
   * @returns {any}
   */
  _sanitize(data) {
    if (data === null || data === undefined) return data;
    if (typeof data === 'string') return this._sanitizeString(data);
    if (typeof data !== 'object') return data;
    if (data instanceof ArrayBuffer || data instanceof Uint8Array) {
      return `[Binary: ${data.byteLength || data.length} bytes]`;
    }
    if (Array.isArray(data)) {
      return data.map(item => this._sanitize(item));
    }

    const sanitized = {};
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = SENSITIVE_KEYS.some(k => lowerKey.includes(k));
      sanitized[key] = isSensitive ? '[REDACTED]' : this._sanitize(value);
    }
    return sanitized;
  }

  /**
   * Sanitizes a string to remove any sensitive-looking values.
   * @param {string} str
   * @returns {string}
   */
  _sanitizeString(str) {
    if (typeof str !== 'string') return String(str);
    // Don't log anything that looks like a hex key (32+ hex chars)
    return str.replace(/[0-9a-fA-F]{32,}/g, '[HEX_REDACTED]');
  }
}

// ─── Singleton Export ─────────────────────────────────────────────────────────

export const logger = new Logger();
