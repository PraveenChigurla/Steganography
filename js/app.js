/**
 * @fileoverview Main Application Controller — wires up the UI, handles events,
 * and orchestrates the encrypt and decrypt pipelines.
 */

'use strict';

import { logger, LOG_LEVEL } from './logger.js';
import { StegError, handleError } from './error-handler.js';
import * as ui from './ui.js';
import { loadImageCarrier, loadVideoCarrier, loadAudioCarrier, loadDocumentCarrier, releaseCarrier } from './carrier-manager.js';
import { calculateImageCapacity, calculateVideoCapacity, calculateAudioCapacity, calculateDocumentCapacity, getCapacityUsage } from './capacity-calculator.js';
import { prepareTextPayload, prepareTextFilePayload, prepareFilePayload, estimateFilesSize, textByteSize } from './payload-manager.js';
import { validatePasswordInput, validateSizeLimit } from './validation.js';
import { compress } from './compression-engine.js';
import { encrypt, scorePassword } from './encryption-engine.js';
import { createHeader } from './metadata-manager.js';
import { embedInImage } from './image-embedding.js';
import { embedInVideo } from './video-embedding.js';
import { embedInAudio } from './audio-embedding.js';
import { embedInDocument } from './document-embedding.js';
import { extract } from './extraction-engine.js';
import { sha256, uint8ArrayConcat, getFileExtension } from './utils.js';
import { ENCRYPTION_ALGO, COMPRESSION_ALGO } from './constants.js';

// ─── Application State ────────────────────────────────────────────────────────

const state = {
  tab: 'encrypt', // 'encrypt' | 'decrypt'
  
  encrypt: {
    carrierType: 'image', // 'image' | 'video'
    carrierInfo: null,
    capacity: null,
    
    password: '',
    pwdStrength: 0,
    
    payloadMode: 'text', // 'text' | 'files'
    textContent: '',
    payloadFiles: [],
    
    currentPayloadSize: 0,
    isReady: false,
  },
  
  decrypt: {
    carrierInfo: null,
    password: '',
    isReady: false,
  }
};

// ─── Initialization ───────────────────────────────────────────────────────────

function init() {
  logger.setLevel(LOG_LEVEL.DEBUG);
  logger.info('Initializing StegVault Application');

  if (typeof crypto === 'undefined' || !crypto.subtle) {
    ui.showErrorModal(new StegError(
      'ERR_NO_CRYPTO',
      'Web Crypto API is not available. This application requires a secure context (HTTPS) or localhost to function properly.'
    ));
    return;
  }

  bindEvents();
  ui.setTab(state.tab);
  ui.setCarrierTypeUI(state.encrypt.carrierType);
  ui.setPayloadModeUI(state.encrypt.payloadMode);
  
  // Modal close
  ui.els.modal.closeBtn.addEventListener('click', ui.hideErrorModal);
  ui.els.modal.aboutClose.addEventListener('click', ui.hideAboutModal);
  ui.els.modal.aboutCloseIcon.addEventListener('click', ui.hideAboutModal);
}

// ─── Event Binding ────────────────────────────────────────────────────────────

function bindEvents() {
  // Tabs
  ui.els.tabs.encrypt.addEventListener('click', () => switchTab('encrypt'));
  ui.els.tabs.decrypt.addEventListener('click', () => switchTab('decrypt'));
  
  // Header Buttons
  ui.els.modal.aboutBtn.addEventListener('click', ui.showAboutModal);

  // Encrypt Carrier Type
  ui.els.carrier.typeImage.addEventListener('click', () => setCarrierType('image'));
  ui.els.carrier.typeVideo.addEventListener('click', () => setCarrierType('video'));
  ui.els.carrier.typeAudio.addEventListener('click', () => setCarrierType('audio'));
  ui.els.carrier.typeDocument.addEventListener('click', () => setCarrierType('document'));

  // Encrypt Carrier Upload
  bindDropZone(ui.els.carrier.dropZone, ui.els.carrier.fileInput, ui.els.carrier.browseBtn, handleEncryptCarrierSelected);

  // Payload Mode
  ui.els.payload.modeText.addEventListener('click', () => setPayloadMode('text'));
  ui.els.payload.modeFiles.addEventListener('click', () => setPayloadMode('files'));

  // Text Payload
  ui.els.payload.textInput.addEventListener('input', (e) => {
    state.encrypt.textContent = e.target.value;
    state.encrypt.currentPayloadSize = textByteSize(state.encrypt.textContent);
    ui.updateTextCounters(state.encrypt.textContent, state.encrypt.currentPayloadSize);
    updateEncryptState();
  });
  
  bindDropZone(ui.els.payload.textFileDrop, ui.els.payload.textFileInput, ui.els.payload.textFileBrowse, handleTextFileSelected);

  // Files Payload
  bindDropZone(ui.els.payload.filesDrop, ui.els.payload.filesInput, ui.els.payload.filesBrowse, handlePayloadFilesSelected, true);

  // Passwords
  ui.els.password.input.addEventListener('input', (e) => {
    state.encrypt.password = e.target.value;
    const score = scorePassword(state.encrypt.password);
    state.encrypt.pwdStrength = score;
    ui.els.password.strengthFill.setAttribute('data-strength', score >= 0 ? score : 0);
    ui.els.password.strengthLabel.textContent = score >= 0 ? ['Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'][score] : 'Enter a password';
    checkPasswords();
    updateEncryptState();
  });
  
  ui.els.password.confirm.addEventListener('input', () => {
    checkPasswords();
    updateEncryptState();
  });
  
  ui.els.password.toggleInp.addEventListener('click', () => ui.togglePasswordVisibility(ui.els.password.input, ui.els.password.toggleInp));
  ui.els.password.toggleConf.addEventListener('click', () => ui.togglePasswordVisibility(ui.els.password.confirm, ui.els.password.toggleConf));

  // Encrypt Action
  ui.els.encrypt.btn.addEventListener('click', runEncryptPipeline);

  // Decrypt Section
  bindDropZone(ui.els.decrypt.dropZone, ui.els.decrypt.fileInput, ui.els.decrypt.browseBtn, handleDecryptCarrierSelected);
  ui.els.decrypt.togglePwd.addEventListener('click', () => ui.togglePasswordVisibility(ui.els.decrypt.password, ui.els.decrypt.togglePwd));
  ui.els.decrypt.password.addEventListener('input', (e) => {
    state.decrypt.password = e.target.value;
    updateDecryptState();
  });
  
  ui.els.decrypt.btn.addEventListener('click', runDecryptPipeline);
}

// ─── Helpers for Binding ──────────────────────────────────────────────────────

function bindDropZone(zoneEl, inputEl, browseBtnEl, callback, multiple = false) {
  browseBtnEl.addEventListener('click', (e) => { e.stopPropagation(); inputEl.click(); });
  zoneEl.addEventListener('click', () => inputEl.click());
  
  zoneEl.addEventListener('dragover', (e) => { e.preventDefault(); zoneEl.classList.add('drop-zone--dragover'); });
  zoneEl.addEventListener('dragleave', () => zoneEl.classList.remove('drop-zone--dragover'));
  zoneEl.addEventListener('drop', (e) => {
    e.preventDefault();
    zoneEl.classList.remove('drop-zone--dragover');
    if (e.dataTransfer.files.length) callback(multiple ? Array.from(e.dataTransfer.files) : e.dataTransfer.files[0]);
  });
  
  inputEl.addEventListener('change', () => {
    if (inputEl.files.length) callback(multiple ? Array.from(inputEl.files) : inputEl.files[0]);
    inputEl.value = ''; // Reset
  });
}

// ─── State Management ─────────────────────────────────────────────────────────

function switchTab(tab) {
  state.tab = tab;
  ui.setTab(tab);
}

function setCarrierType(type) {
  state.encrypt.carrierType = type;
  ui.setCarrierTypeUI(type);
  if (state.encrypt.carrierInfo) {
    // Clear carrier if type switches
    releaseCarrier(state.encrypt.carrierInfo);
    state.encrypt.carrierInfo = null;
    state.encrypt.capacity = null;
    ui.clearCarrierPreview();
    ui.hideCapacityGauge();
    updateEncryptState();
  }
}

function setPayloadMode(mode) {
  state.encrypt.payloadMode = mode;
  ui.setPayloadModeUI(mode);
  
  if (mode === 'text') {
    state.encrypt.currentPayloadSize = textByteSize(state.encrypt.textContent);
  } else {
    state.encrypt.currentPayloadSize = estimateFilesSize(state.encrypt.payloadFiles);
  }
  updateEncryptState();
}

function checkPasswords() {
  const p1 = ui.els.password.input.value;
  const p2 = ui.els.password.confirm.value;
  
  if (p2 && p1 !== p2) {
    ui.els.password.feedback.textContent = 'Passwords do not match';
    ui.els.password.feedback.className = 'field-feedback field-feedback--error';
  } else if (p2 && p1 === p2) {
    ui.els.password.feedback.textContent = 'Passwords match';
    ui.els.password.feedback.className = 'field-feedback field-feedback--success';
  } else {
    ui.els.password.feedback.textContent = '';
  }
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

async function handleEncryptCarrierSelected(file) {
  try {
    validateSizeLimit(file.size, 'carrier');
    
    let info;
    if (state.encrypt.carrierType === 'image') {
      info = await loadImageCarrier(file);
      state.encrypt.capacity = calculateImageCapacity(info.width, info.height);
    } else if (state.encrypt.carrierType === 'video') {
      info = await loadVideoCarrier(file);
      state.encrypt.capacity = calculateVideoCapacity(info.frameCount, info.width, info.height);
    } else if (state.encrypt.carrierType === 'audio') {
      info = await loadAudioCarrier(file);
      state.encrypt.capacity = calculateAudioCapacity();
    } else if (state.encrypt.carrierType === 'document') {
      info = await loadDocumentCarrier(file);
      state.encrypt.capacity = calculateDocumentCapacity();
    }
    
    if (state.encrypt.carrierInfo) releaseCarrier(state.encrypt.carrierInfo);
    state.encrypt.carrierInfo = info;
    
    ui.renderCarrierPreview(info);
    
    // Bind remove button
    document.getElementById(`btn-remove-carrier-${ui.els.carrier.preview.id}`).addEventListener('click', () => {
      releaseCarrier(state.encrypt.carrierInfo);
      state.encrypt.carrierInfo = null;
      state.encrypt.capacity = null;
      ui.clearCarrierPreview();
      ui.hideCapacityGauge();
      updateEncryptState();
    });
    
    updateEncryptState();
    ui.showToast(`Carrier loaded: ${file.name}`, 'success');
  } catch (err) {
    const stegErr = handleError(err, 'Carrier Selection');
    ui.showErrorModal(stegErr);
  }
}

async function handleTextFileSelected(file) {
  try {
    const result = await prepareTextFilePayload(file);
    const text = new TextDecoder().decode(result.data);
    ui.els.payload.textInput.value = text;
    // Dispatch input event to update state and counters
    ui.els.payload.textInput.dispatchEvent(new Event('input'));
    ui.showToast(`Loaded text from ${file.name}`, 'success');
  } catch (err) {
    const stegErr = handleError(err, 'Text File Selection');
    ui.showErrorModal(stegErr);
  }
}

function handlePayloadFilesSelected(files) {
  try {
    for(const f of files) validateSizeLimit(f.size, 'payload');
    
    // Add to existing, avoid duplicates by name
    const newFiles = files.filter(f => !state.encrypt.payloadFiles.find(ef => ef.name === f.name));
    state.encrypt.payloadFiles = [...state.encrypt.payloadFiles, ...newFiles];
    
    state.encrypt.currentPayloadSize = estimateFilesSize(state.encrypt.payloadFiles);
    
    ui.renderPayloadFileList(state.encrypt.payloadFiles);
    
    // Bind remove buttons
    document.querySelectorAll('.file-remove-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.dataset.idx, 10);
        state.encrypt.payloadFiles.splice(idx, 1);
        state.encrypt.currentPayloadSize = estimateFilesSize(state.encrypt.payloadFiles);
        ui.renderPayloadFileList(state.encrypt.payloadFiles);
        updateEncryptState();
        // rebind is needed but handled recursively or implicitly since we redraw
        handlePayloadFilesSelected([]); // trigger redraw and rebind
      });
    });
    
    updateEncryptState();
  } catch (err) {
    const stegErr = handleError(err, 'Files Selection');
    ui.showErrorModal(stegErr);
  }
}

async function handleDecryptCarrierSelected(file) {
  try {
    // Attempt to load as image first, if fails try video or audio based on extension
    const ext = getFileExtension(file.name);
    let info;
    
    if (['png', 'bmp', 'webp'].includes(ext)) {
      info = await loadImageCarrier(file);
    } else if (['mp4', 'avi', 'mkv', 'mov', 'webm'].includes(ext)) {
      info = await loadVideoCarrier(file);
    } else if (['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(ext)) {
      info = await loadAudioCarrier(file);
    } else {
      // Anything else falls back to document loader
      info = await loadDocumentCarrier(file);
    }

    if (state.decrypt.carrierInfo) releaseCarrier(state.decrypt.carrierInfo);
    state.decrypt.carrierInfo = info;
    
    ui.renderCarrierPreview(info, ui.els.decrypt.preview, ui.els.decrypt.dropContent);
    
    // Bind remove
    document.getElementById(`btn-remove-carrier-${ui.els.decrypt.preview.id}`).addEventListener('click', () => {
      releaseCarrier(state.decrypt.carrierInfo);
      state.decrypt.carrierInfo = null;
      ui.clearCarrierPreview(ui.els.decrypt.preview, ui.els.decrypt.dropContent);
      updateDecryptState();
    });
    
    updateDecryptState();
    ui.showToast(`Stego carrier loaded`, 'success');
  } catch (err) {
    const stegErr = handleError(err, 'Decrypt Carrier Selection');
    ui.showErrorModal(stegErr);
  }
}

// ─── Pipeline Updates ─────────────────────────────────────────────────────────

function updateEncryptState() {
  const enc = state.encrypt;
  
  if (enc.carrierInfo && enc.capacity) {
    ui.updateCapacityGauge(enc.capacity, enc.currentPayloadSize);
  } else {
    ui.hideCapacityGauge();
  }
  
  let isValid = true;
  let validationHtml = '';
  
  if (!enc.carrierInfo) { isValid = false; }
  
  if (!enc.password) { isValid = false; }
  else if (enc.password !== ui.els.password.confirm.value) { isValid = false; }
  
  if (enc.payloadMode === 'text' && !enc.textContent.trim()) { isValid = false; }
  if (enc.payloadMode === 'files' && enc.payloadFiles.length === 0) { isValid = false; }
  
  if (enc.carrierInfo && enc.capacity) {
    const usage = getCapacityUsage(enc.currentPayloadSize, enc.capacity.usableBytes);
    if (usage.status === 'danger') {
      isValid = false;
      validationHtml += `<div class="validation-msg validation-msg--error">Payload size exceeds carrier capacity.</div>`;
    }
  }
  
  if (enc.pwdStrength < 2 && enc.password) {
    validationHtml += `<div class="validation-msg validation-msg--warn">Warning: Password is weak.</div>`;
  }
  
  ui.els.encrypt.validation.innerHTML = validationHtml;
  ui.els.encrypt.btn.disabled = !isValid;
  enc.isReady = isValid;
}

function updateDecryptState() {
  const dec = state.decrypt;
  let isValid = true;
  
  if (!dec.carrierInfo) isValid = false;
  if (!dec.password) isValid = false;
  
  ui.els.decrypt.btn.disabled = !isValid;
  dec.isReady = isValid;
}

// ─── Execution Pipelines ──────────────────────────────────────────────────────

async function runEncryptPipeline() {
  if (!state.encrypt.isReady) return;
  
  const enc = state.encrypt;
  ui.showEncryptProgress();
  
  try {
    // 1. Prepare Payload
    ui.updateEncryptProgress(5, 'Preparing Payload');
    let payloadResult;
    if (enc.payloadMode === 'text') {
      payloadResult = prepareTextPayload(enc.textContent);
    } else {
      payloadResult = await prepareFilePayload(enc.payloadFiles, (pct) => ui.updateEncryptProgress(5 + pct * 0.15, 'Zipping Files'));
    }
    
    // 2. Compress
    ui.updateEncryptProgress(25, 'Compressing Payload');
    const compResult = compress(payloadResult.data);
    
    // 3. Plaintext Checksum
    const plaintextChecksum = await sha256(payloadResult.data);
    
    // 4. Encrypt
    ui.updateEncryptProgress(35, 'Encrypting Data');
    const encryptedPayload = await encrypt(compResult.data, enc.password);
    
    // 5. Create Header
    ui.updateEncryptProgress(50, 'Generating Metadata');
    const headerBytes = await createHeader({
      carrierType: enc.carrierType === 'image' ? 0x01 : (enc.carrierType === 'video' ? 0x02 : (enc.carrierType === 'audio' ? 0x03 : 0x04)),
      encryptionAlgo: ENCRYPTION_ALGO.AES_256_GCM,
      compressionFlag: compResult.algo,
      payloadType: payloadResult.type,
      isZip: payloadResult.isZip,
      filename: payloadResult.filename,
      extension: payloadResult.extension,
      payloadSize: encryptedPayload.length,
      plaintextChecksum
    });
    
    const fullData = uint8ArrayConcat(headerBytes, encryptedPayload);
    
    // 6. Embed
    let resultBlob;
    if (enc.carrierType === 'image') {
      await embedInImage(enc.carrierInfo, fullData, (pct) => ui.updateEncryptProgress(55 + pct * 0.40, 'Embedding into Image'));
      
      ui.updateEncryptProgress(96, 'Exporting Image');
      resultBlob = await new Promise(resolve => enc.carrierInfo.canvas.toBlob(resolve, 'image/png'));
    } else if (enc.carrierType === 'video') {
      resultBlob = await embedInVideo(enc.carrierInfo, fullData, (pct, label) => ui.updateEncryptProgress(55 + pct * 0.40, label));
    } else if (enc.carrierType === 'audio') {
      resultBlob = await embedInAudio(enc.carrierInfo, fullData, (pct, label) => ui.updateEncryptProgress(55 + pct * 0.40, label));
    } else if (enc.carrierType === 'document') {
      resultBlob = await embedInDocument(enc.carrierInfo, fullData, (pct, label) => ui.updateEncryptProgress(55 + pct * 0.40, label));
    }
    
    ui.updateEncryptProgress(100, 'Complete');
    setTimeout(() => {
      ui.showEncryptResult(resultBlob, enc.carrierInfo.size, enc.carrierInfo);
    }, 500);
    
  } catch (err) {
    ui.hideEncryptProgress();
    const stegErr = handleError(err, 'Encrypt Pipeline Execution');
    ui.showErrorModal(stegErr);
  }
}

async function runDecryptPipeline() {
  if (!state.decrypt.isReady) return;
  
  const dec = state.decrypt;
  ui.showDecryptProgress();
  
  try {
    const result = await extract(dec.carrierInfo, dec.password, (pct, label) => ui.updateEncryptProgress(pct, label, 'decrypt-steps-list', 'decrypt-pct', 'decrypt-bar-fill', 'decrypt-step-title'));
    
    setTimeout(() => {
      ui.showDecryptResult(result.data, result.metadata);
    }, 500);
    
  } catch (err) {
    ui.hideDecryptProgress();
    const stegErr = handleError(err, 'Decrypt Pipeline Execution');
    ui.showErrorModal(stegErr);
  }
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', init);
