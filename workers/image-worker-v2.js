/**
 * @fileoverview Image Web Worker — performs LSB bit manipulation on raw
 * pixel data in a background thread to prevent UI freezing.
 *
 * Supports two operations:
 *   embed:   writes payload bits into pixel LSBs
 *   extract: reads payload bits from pixel LSBs
 *
 * Message protocol:
 *   INPUT  { op: 'embed',   pixels: Uint8ClampedArray, payload: Uint8Array, width, height }
 *   INPUT  { op: 'extract', pixels: Uint8ClampedArray, numBytes: number, width, height }
 *   OUTPUT { type: 'progress', percent: number }
 *   OUTPUT { type: 'result',   pixels?: Uint8ClampedArray, data?: Uint8Array }
 *   OUTPUT { type: 'error',    message: string }
 */

'use strict';

// LSB configuration (must match constants.js)
const LSB_BITS_PER_CHANNEL = 2;
const LSB_CHANNELS = 3;          // R, G, B only (skip alpha at index 3)
const CHANNEL_MASK = (1 << LSB_BITS_PER_CHANNEL) - 1; // 0b11

self.onmessage = function (e) {
  const { op, pixels, payload, numBytes, width, height } = e.data;

  try {
    if (op === 'embed') {
      const result = embedLSB(pixels, payload, width, height);
      self.postMessage({ type: 'result', pixels: result }, [result.buffer]);
    } else if (op === 'extract') {
      const data = extractLSB(pixels, numBytes, width, height);
      self.postMessage({ type: 'result', data }, [data.buffer]);
    } else {
      self.postMessage({ type: 'error', message: `Unknown operation: ${op}` });
    }
  } catch (err) {
    self.postMessage({ type: 'error', message: err.message });
  }
};

// ─── Embed ────────────────────────────────────────────────────────────────────

/**
 * Embeds payload bytes into the LSBs of RGB channels.
 * Format: 2 bits per channel, channels R=0, G=1, B=2 of each pixel, alpha skipped.
 *
 * @param {Uint8ClampedArray} pixels - RGBA flat array
 * @param {Uint8Array} payload
 * @param {number} width
 * @param {number} height
 * @returns {Uint8ClampedArray} Modified pixels
 */
function embedLSB(pixels, payload, width, height) {
  const totalPixels  = width * height;
  const bitsNeeded   = payload.length * 8;
  const bitsCapacity = totalPixels * LSB_BITS_PER_CHANNEL * LSB_CHANNELS;

  if (bitsNeeded > bitsCapacity) {
    throw new Error(`Payload too large: need ${bitsNeeded} bits, have ${bitsCapacity}`);
  }

  const output = new Uint8ClampedArray(pixels);

  let bitIndex   = 0; // current bit position in payload stream
  let pixelIndex = 0; // current pixel (0-based)
  const totalBits = payload.length * 8;
  let lastReported = 0;

  while (bitIndex < totalBits) {
    const pixelBase = pixelIndex * 4; // RGBA stride = 4

    // Embed into R, G, B channels (skip alpha at +3)
    for (let ch = 0; ch < LSB_CHANNELS && bitIndex < totalBits; ch++) {
      // Read LSB_BITS_PER_CHANNEL bits from payload
      let bits = 0;
      let bitsRead = 0;
      for (let b = 0; b < LSB_BITS_PER_CHANNEL && bitIndex < totalBits; b++) {
        const bytePos = Math.floor(bitIndex / 8);
        const bitPos  = 7 - (bitIndex % 8); // MSB first
        const bit     = (payload[bytePos] >> bitPos) & 1;
        bits = (bits << 1) | bit;
        bitIndex++;
        bitsRead++;
      }
      
      // Pad remaining bits with 0 if we ran out of payload bits mid-channel
      if (bitsRead > 0 && bitsRead < LSB_BITS_PER_CHANNEL) {
        bits <<= (LSB_BITS_PER_CHANNEL - bitsRead);
      }

      // Clear LSBs and write new bits
      output[pixelBase + ch] = (output[pixelBase + ch] & ~CHANNEL_MASK) | (bits & CHANNEL_MASK);
    }

    pixelIndex++;

    // Report progress every 5%
    const pct = Math.floor((bitIndex / totalBits) * 100);
    if (pct - lastReported >= 5) {
      self.postMessage({ type: 'progress', percent: pct });
      lastReported = pct;
    }
  }

  return output;
}

// ─── Extract ──────────────────────────────────────────────────────────────────

/**
 * Extracts payload bytes from the LSBs of RGB channels.
 * @param {Uint8ClampedArray} pixels
 * @param {number} numBytes - How many bytes to extract
 * @param {number} width
 * @param {number} height
 * @returns {Uint8Array}
 */
function extractLSB(pixels, numBytes, width, height) {
  const output    = new Uint8Array(numBytes);
  const totalBits = numBytes * 8;

  let bitIndex   = 0;
  let pixelIndex = 0;
  let lastReported = 0;

  while (bitIndex < totalBits) {
    const pixelBase = pixelIndex * 4;

    for (let ch = 0; ch < LSB_CHANNELS && bitIndex < totalBits; ch++) {
      const channelByte = pixels[pixelBase + ch];

      for (let b = LSB_BITS_PER_CHANNEL - 1; b >= 0 && bitIndex < totalBits; b--) {
        const bit      = (channelByte >> b) & 1;
        const bytePos  = Math.floor(bitIndex / 8);
        const bitPos   = 7 - (bitIndex % 8);
        output[bytePos] |= (bit << bitPos);
        bitIndex++;
      }
    }

    pixelIndex++;

    const pct = Math.floor((bitIndex / totalBits) * 100);
    if (pct - lastReported >= 5) {
      self.postMessage({ type: 'progress', percent: pct });
      lastReported = pct;
    }
  }

  return output;
}
