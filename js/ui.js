/**
 * @fileoverview UI layer — handles all DOM manipulations, rendering,
 * formatters, and visual state management.
 */

'use strict';

import { $, $$, formatFileSize, formatDuration, getFileExtension } from './utils.js';
import { scorePassword } from './encryption-engine.js';
import { getCapacityUsage } from './capacity-calculator.js';

// ─── Elements Registry ───────────────────────────────────────────────────────

export const els = {
  // Tabs
  tabs: {
    encrypt: $('#tab-encrypt'),
    decrypt: $('#tab-decrypt'),
    indicator: $('.tab-indicator'),
    nav: $('.tab-nav'),
  },
  panels: {
    encrypt: $('#panel-encrypt'),
    decrypt: $('#panel-decrypt'),
  },
  
  // Carrier Selection
  carrier: {
    typeImage: $('#carrier-type-image'),
    typeVideo: $('#carrier-type-video'),
    typeAudio: $('#carrier-type-audio'),
    typeDocument: $('#carrier-type-document'),
    dropZone: $('#carrier-drop-zone'),
    fileInput: $('#carrier-file-input'),
    browseBtn: $('#carrier-browse-btn'),
    formatHint: $('#carrier-format-hint'),
    preview: $('#carrier-preview'),
    dropContent: $('#carrier-drop-content'),
  },

  // Capacity Gauge
  capacity: {
    section: $('#capacity-section'),
  },

  // Password (Encrypt)
  password: {
    input: $('#enc-password'),
    confirm: $('#enc-confirm-password'),
    toggleInp: $('#toggle-enc-password'),
    toggleConf: $('#toggle-enc-confirm'),
    strengthFill: $('#strength-fill'),
    strengthLabel: $('#strength-label'),
    feedback: $('#confirm-password-feedback'),
  },

  // Payload
  payload: {
    modeText: $('#payload-mode-text'),
    modeFiles: $('#payload-mode-files'),
    panelText: $('#payload-text-mode'),
    panelFiles: $('#payload-files-mode'),
    textInput: $('#secret-text'),
    charCount: $('#char-count'),
    wordCount: $('#word-count'),
    textSize: $('#text-size'),
    textFileDrop: $('#text-file-drop'),
    textFileInput: $('#text-file-input'),
    textFileBrowse: $('#text-file-browse'),
    filesDrop: $('#payload-files-drop'),
    filesInput: $('#payload-files-input'),
    filesBrowse: $('#payload-files-browse'),
    fileList: $('#payload-file-list'),
    zipBanner: $('#zip-info-banner'),
    zipText: $('#zip-info-text'),
  },

  // Encrypt Actions
  encrypt: {
    preflight: $('#encrypt-preflight'),
    btn: $('#encrypt-btn'),
    validation: $('#encrypt-validation'),
    progressPanel: $('#encrypt-progress-panel'),
    resultPanel: $('#encrypt-result-panel'),
  },

  // Decrypt
  decrypt: {
    dropZone: $('#decrypt-drop-zone'),
    fileInput: $('#decrypt-file-input'),
    browseBtn: $('#decrypt-browse-btn'),
    preview: $('#decrypt-carrier-preview'),
    dropContent: $('#decrypt-drop-content'),
    password: $('#dec-password'),
    togglePwd: $('#toggle-dec-password'),
    btn: $('#decrypt-btn'),
    validation: $('#decrypt-validation'),
    progressPanel: $('#decrypt-progress-panel'),
    resultPanel: $('#decrypt-result-panel'),
  },

  modal: {
    overlay: $('#error-modal'),
    title: $('#error-modal-title'),
    desc: $('#error-modal-desc'),
    closeBtn: $('#error-modal-close'),
    about: $('#about-modal'),
    aboutBtn: $('#about-btn'),
    aboutClose: $('#about-modal-close'),
    aboutCloseIcon: $('#about-modal-close-icon'),
  },
  toastContainer: $('#toast-container'),
};

// ─── Rendering Methods ────────────────────────────────────────────────────────

/**
 * Updates UI to switch tabs.
 */
export function setTab(tabName) {
  if (tabName === 'encrypt') {
    els.tabs.encrypt.classList.add('tab-btn--active');
    els.tabs.encrypt.setAttribute('aria-selected', 'true');
    els.tabs.decrypt.classList.remove('tab-btn--active');
    els.tabs.decrypt.setAttribute('aria-selected', 'false');
    els.tabs.nav.setAttribute('data-active', 'encrypt');
    
    els.panels.encrypt.classList.remove('hidden');
    els.panels.decrypt.classList.add('hidden');
  } else {
    els.tabs.decrypt.classList.add('tab-btn--active');
    els.tabs.decrypt.setAttribute('aria-selected', 'true');
    els.tabs.encrypt.classList.remove('tab-btn--active');
    els.tabs.encrypt.setAttribute('aria-selected', 'false');
    els.tabs.nav.setAttribute('data-active', 'decrypt');

    els.panels.decrypt.classList.remove('hidden');
    els.panels.encrypt.classList.add('hidden');
  }
}

export function setCarrierTypeUI(type) {
  els.carrier.typeImage.classList.remove('type-btn--active');
  els.carrier.typeVideo.classList.remove('type-btn--active');
  els.carrier.typeAudio.classList.remove('type-btn--active');
  els.carrier.typeDocument.classList.remove('type-btn--active');
  
  if (type === 'image') {
    els.carrier.typeImage.classList.add('type-btn--active');
    els.carrier.fileInput.accept = '.png,.bmp,.webp';
    els.carrier.formatHint.textContent = 'Supports: PNG, BMP, WebP';
  } else if (type === 'video') {
    els.carrier.typeVideo.classList.add('type-btn--active');
    els.carrier.fileInput.accept = '.mp4,.avi,.mkv,.mov,.webm';
    els.carrier.formatHint.textContent = 'Supports: MP4, AVI, MKV, MOV, WebM';
  } else if (type === 'audio') {
    els.carrier.typeAudio.classList.add('type-btn--active');
    els.carrier.fileInput.accept = '.mp3,.wav,.ogg,.flac,.m4a';
    els.carrier.formatHint.textContent = 'Supports: MP3, WAV, OGG, FLAC, M4A';
  } else if (type === 'document') {
    els.carrier.typeDocument.classList.add('type-btn--active');
    els.carrier.fileInput.accept = '.pdf,.docx,.xlsx,.pptx,.zip,.txt,.py,.js,.java,.html,.css,.json,.csv';
    els.carrier.formatHint.textContent = 'Supports: Any generic document or file format';
  }
}

/**
 * Sets the Payload mode UI (text vs files).
 */
export function setPayloadModeUI(mode) {
  if (mode === 'text') {
    els.payload.modeText.classList.add('mode-btn--active');
    els.payload.modeFiles.classList.remove('mode-btn--active');
    els.payload.panelText.classList.remove('hidden');
    els.payload.panelFiles.classList.add('hidden');
  } else {
    els.payload.modeFiles.classList.add('mode-btn--active');
    els.payload.modeText.classList.remove('mode-btn--active');
    els.payload.panelFiles.classList.remove('hidden');
    els.payload.panelText.classList.add('hidden');
  }
}

/**
 * Renders the carrier preview card.
 * @param {import('./carrier-manager.js').CarrierInfo} info 
 */
export function renderCarrierPreview(info, container = els.carrier.preview, dropContent = els.carrier.dropContent) {
  dropContent.classList.add('hidden');
  container.classList.remove('hidden');
  
  let mediaHtml = '';
  let metaRows = '';

  if (info.type === 'image') {
    mediaHtml = `<img class="preview-thumb" src="${info.objectUrl}" alt="Carrier preview" />`;
    metaRows = `
      <div class="meta-row">
        <div class="meta-item"><span class="meta-label">Resolution</span><span class="meta-value">${info.width} × ${info.height}</span></div>
        <div class="meta-item"><span class="meta-label">Size</span><span class="meta-value">${formatFileSize(info.size)}</span></div>
        <div class="meta-item"><span class="meta-label">Pixels</span><span class="meta-value">${(info.width * info.height).toLocaleString()}</span></div>
      </div>
    `;
  } else if (info.type === 'video') {
    mediaHtml = `<video class="preview-video" src="${info.objectUrl}" controls preload="metadata"></video>`;
    metaRows = `
      <div class="meta-row">
        <div class="meta-item"><span class="meta-label">Resolution</span><span class="meta-value">${info.width} × ${info.height}</span></div>
        <div class="meta-item"><span class="meta-label">Duration</span><span class="meta-value">${formatDuration(info.duration * 1000)}</span></div>
        <div class="meta-item"><span class="meta-label">Size</span><span class="meta-value">${formatFileSize(info.size)}</span></div>
      </div>
    `;
  } else if (info.type === 'audio') {
    mediaHtml = `<audio class="preview-audio" src="${info.objectUrl}" controls preload="metadata"></audio>`;
    metaRows = `
      <div class="meta-row">
        <div class="meta-item"><span class="meta-label">Duration</span><span class="meta-value">${formatDuration(info.duration * 1000)}</span></div>
        <div class="meta-item"><span class="meta-label">Size</span><span class="meta-value">${formatFileSize(info.size)}</span></div>
      </div>
    `;
  } else if (info.type === 'document') {
    mediaHtml = `
      <div class="preview-document-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width: 48px; height: 48px; color: var(--clr-text-secondary);"><path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
      </div>
    `;
    metaRows = `
      <div class="meta-row">
        <div class="meta-item"><span class="meta-label">Type</span><span class="meta-value">${info.extension.toUpperCase()} Document</span></div>
        <div class="meta-item"><span class="meta-label">Size</span><span class="meta-value">${formatFileSize(info.size)}</span></div>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="preview-header">
      <span class="preview-filename">${info.name}</span>
      <button class="preview-remove-btn" type="button" aria-label="Remove file" id="btn-remove-carrier-${container.id}">
        <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
      </button>
    </div>
    <div class="preview-media-container ${info.type === 'video' ? 'preview-media-video' : ''}">
      ${mediaHtml}
      <div class="preview-meta">
        ${metaRows}
      </div>
    </div>
  `;
}

/**
 * Clears the carrier preview.
 */
export function clearCarrierPreview(container = els.carrier.preview, dropContent = els.carrier.dropContent) {
  container.innerHTML = '';
  container.classList.add('hidden');
  dropContent.classList.remove('hidden');
}

/**
 * Updates the capacity gauge UI.
 * @param {import('./capacity-calculator.js').CapacityResult} capacity 
 * @param {number} payloadSize 
 */
export function updateCapacityGauge(capacity, payloadSize) {
  els.capacity.section.classList.remove('hidden');
  const usage = getCapacityUsage(payloadSize, capacity.usableBytes);
  
  let fillClass = '';
  let textClass = '';
  if (usage.status === 'warn') { fillClass = 'capacity-gauge-fill--warn'; textClass = 'capacity-pct--warn'; }
  if (usage.status === 'danger') { fillClass = 'capacity-gauge-fill--danger'; textClass = 'capacity-pct--danger'; }

  const remainingStr = usage.status === 'danger' ? '0 Bytes' : formatFileSize(usage.remaining);

  els.capacity.section.innerHTML = `
    <div class="capacity-header">
      <span class="capacity-title">Payload Capacity</span>
      <span class="capacity-pct ${textClass}">${usage.percent.toFixed(1)}% Used</span>
    </div>
    <div class="capacity-gauge-track">
      <div class="capacity-gauge-fill ${fillClass}" style="width: ${usage.percent}%"></div>
    </div>
    <div class="capacity-stats">
      <div class="capacity-stat"><span class="meta-label">Est. Capacity</span><span class="meta-value">${formatFileSize(capacity.usableBytes)}</span></div>
      <div class="capacity-stat"><span class="meta-label">Current Payload</span><span class="meta-value">${formatFileSize(payloadSize)}</span></div>
      <div class="capacity-stat"><span class="meta-label">Remaining</span><span class="meta-value">${remainingStr}</span></div>
    </div>
    ${usage.status === 'danger' ? `<div class="capacity-alert">Payload exceeds available capacity. Please choose a larger cover media or reduce payload size.</div>` : ''}
  `;
}

/**
 * Hides capacity gauge.
 */
export function hideCapacityGauge() {
  els.capacity.section.classList.add('hidden');
  els.capacity.section.innerHTML = '';
}

/**
 * Renders payload files list.
 * @param {File[]} files 
 */
export function renderPayloadFileList(files) {
  if (files.length === 0) {
    els.payload.fileList.classList.add('hidden');
    els.payload.zipBanner.classList.add('hidden');
    return;
  }
  
  els.payload.fileList.classList.remove('hidden');
  
  let html = `<div class="file-list-header"><span>Name</span><span>Ext</span><span>Type</span><span>Size</span><span></span></div>`;
  
  let totalSize = 0;
  files.forEach((f, idx) => {
    totalSize += f.size;
    html += `
      <div class="file-list-item">
        <span class="file-item-name" title="${f.name}">${f.name}</span>
        <span class="file-item-ext">${getFileExtension(f.name).toUpperCase() || 'FILE'}</span>
        <span class="file-item-type">${f.type || 'Unknown'}</span>
        <span class="file-item-size">${formatFileSize(f.size)}</span>
        <button class="file-remove-btn" type="button" aria-label="Remove ${f.name}" data-idx="${idx}">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
        </button>
      </div>
    `;
  });

  html += `<div class="file-list-footer"><span>Total</span><span></span><span></span><span>${formatFileSize(totalSize)}</span><span></span></div>`;
  els.payload.fileList.innerHTML = html;

  if (files.length > 1) {
    els.payload.zipBanner.classList.remove('hidden');
    els.payload.zipText.textContent = `${files.length} files will be automatically bundled into payload.zip`;
  } else {
    els.payload.zipBanner.classList.add('hidden');
  }
}

/**
 * Updates text counters.
 * @param {string} text 
 * @param {number} bytes 
 */
export function updateTextCounters(text, bytes) {
  const chars = text.length;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  
  els.payload.charCount.textContent = `${chars} characters`;
  els.payload.wordCount.textContent = `${words} words`;
  els.payload.textSize.textContent = formatFileSize(bytes);
}

/**
 * Toggles password visibility icon.
 */
export function togglePasswordVisibility(inputEl, btnEl) {
  const isPwd = inputEl.type === 'password';
  inputEl.type = isPwd ? 'text' : 'password';
  btnEl.querySelector('.eye-open').classList.toggle('hidden', isPwd);
  btnEl.querySelector('.eye-closed').classList.toggle('hidden', !isPwd);
}

/**
 * Shows toast message.
 */
export function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  let iconSvg = '';
  
  if (type === 'success') {
    iconSvg = `<svg class="toast-icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>`;
  } else if (type === 'error') {
    iconSvg = `<svg class="toast-icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/></svg>`;
  } else {
    iconSvg = `<svg class="toast-icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>`;
  }

  const title = type === 'success' ? 'Success' : type === 'error' ? 'Error' : 'Info';

  toast.innerHTML = `
    ${iconSvg}
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
    </div>
  `;

  els.toastContainer.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('toast-out');
    toast.addEventListener('animationend', () => toast.remove());
  }, 4000);
}

/**
 * Shows the error modal.
 * @param {import('./error-handler.js').StegError} error 
 */
export function showErrorModal(error) {
  els.modal.title.textContent = error.title || 'Error';
  els.modal.desc.innerHTML = error.toUserMessage().replace(/\n/g, '<br/>');
  els.modal.overlay.classList.remove('hidden');
}

export function hideErrorModal() {
  els.modal.overlay.classList.add('hidden');
}

export function showAboutModal() {
  els.modal.about.classList.remove('hidden');
}

export function hideAboutModal() {
  els.modal.about.classList.add('hidden');
}

// ─── Progress Rendering ───────────────────────────────────────────────────────

export function showEncryptProgress() {
  els.encrypt.progressPanel.classList.remove('hidden');
  els.encrypt.resultPanel.classList.add('hidden');
  $('#progress-steps-list').innerHTML = ''; // reset steps
  updateEncryptProgress(0, 'Initializing...');
}

export function updateEncryptProgress(percent, label, stepListId = 'progress-steps-list', pctId = 'progress-pct', barId = 'progress-bar-fill', titleId = 'progress-step-title') {
  const p = Math.max(0, Math.min(100, Math.round(percent)));
  $(`#${pctId}`).textContent = `${p}%`;
  $(`#${barId}`).style.width = `${p}%`;
  $(`#${titleId}`).textContent = label;
  
  // Optionally update steps list based on label if needed
  // For simplicity, we just use the label for now
}

export function hideEncryptProgress() {
  els.encrypt.progressPanel.classList.add('hidden');
}

export function showDecryptProgress() {
  els.decrypt.progressPanel.classList.remove('hidden');
  els.decrypt.resultPanel.classList.add('hidden');
  $('#decrypt-steps-list').innerHTML = '';
  updateEncryptProgress(0, 'Initializing...', 'decrypt-steps-list', 'decrypt-pct', 'decrypt-bar-fill', 'decrypt-step-title');
}

export function hideDecryptProgress() {
  els.decrypt.progressPanel.classList.add('hidden');
}

// ─── Results Rendering ────────────────────────────────────────────────────────

export function showEncryptResult(resultBlob, originalSize, carrierInfo) {
  els.encrypt.resultPanel.classList.remove('hidden');
  els.encrypt.progressPanel.classList.add('hidden');
  
  const blobUrl = URL.createObjectURL(resultBlob);
  const dlName = `stego_${carrierInfo.name.split('.')[0]}.${resultBlob.type.includes('webm') ? 'webm' : carrierInfo.extension}`;
  
  let mediaHtml = '';
  if (resultBlob.type.startsWith('image')) {
    mediaHtml = `<img class="result-preview-img" src="${blobUrl}" alt="Stego Image" />`;
  } else if (resultBlob.type.startsWith('video')) {
    mediaHtml = `<video class="result-preview-img" src="${blobUrl}" controls></video>`;
  } else if (resultBlob.type.startsWith('audio')) {
    mediaHtml = `<audio class="preview-audio" src="${blobUrl}" controls></audio>`;
  }

  els.encrypt.resultPanel.innerHTML = `
    <div class="result-success-header">
      <div class="result-success-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
      </div>
      <div>
        <h3 class="result-success-title">Encryption Successful</h3>
        <p class="result-success-sub">Data has been securely embedded into the carrier.</p>
      </div>
    </div>
    
    <div class="result-previews">
      <div class="result-preview-card">
        <div class="result-preview-label">Original Carrier</div>
        <img class="result-preview-img" src="${carrierInfo.objectUrl}" />
      </div>
      <div class="result-preview-card">
        <div class="result-preview-label">Stego Carrier</div>
        ${mediaHtml}
      </div>
    </div>

    <div class="result-stats">
      <div class="result-stat"><span class="result-stat-label">Original Size</span><span class="result-stat-value">${formatFileSize(originalSize)}</span></div>
      <div class="result-stat"><span class="result-stat-label">Stego Size</span><span class="result-stat-value result-stat-value--success">${formatFileSize(resultBlob.size)}</span></div>
    </div>
    
    <div class="result-actions">
      <a href="${blobUrl}" download="${dlName}" class="btn btn--success btn--large">
        <svg class="btn-icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
        Download Stego ${carrierInfo.type === 'image' ? 'Image' : 'Video'}
      </a>
      <button class="btn btn--secondary" onclick="location.reload()">Start Over</button>
    </div>
  `;
}

export function showDecryptResult(data, metadata) {
  els.decrypt.resultPanel.classList.remove('hidden');
  els.decrypt.progressPanel.classList.add('hidden');
  
  let contentHtml = '';
  let dlUrl = null;
  
  if (metadata.payloadType === 0x01) { // TEXT
    const text = new TextDecoder().decode(data);
    contentHtml = `
      <div class="result-preview-label">Decrypted Message</div>
      <div class="decrypt-payload-preview">${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
    `;
  } else {
    const blob = new Blob([data], { type: 'application/octet-stream' }); // Can use guessMimeType
    dlUrl = URL.createObjectURL(blob);
    contentHtml = `
      <div class="result-preview-label">Decrypted File</div>
      <div style="padding: 20px; background: var(--clr-bg-surface); text-align: center; border-radius: var(--radius-md); margin-bottom: 20px;">
        <svg viewBox="0 0 24 24" fill="none" stroke="var(--clr-primary)" stroke-width="2" style="width: 48px; height: 48px; margin-bottom: 10px;">
          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline>
        </svg>
        <div style="font-family: var(--font-mono); font-weight: bold;">${metadata.filename}</div>
        <div style="font-size: 0.8rem; color: var(--clr-text-secondary);">${formatFileSize(data.length)}</div>
      </div>
    `;
  }

  els.decrypt.resultPanel.innerHTML = `
    <div class="result-success-header">
      <div class="result-success-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
      </div>
      <div>
        <h3 class="result-success-title">Decryption Successful</h3>
        <p class="result-success-sub">Payload extracted and verified.</p>
      </div>
    </div>
    
    ${contentHtml}

    <div class="result-stats">
      <div class="result-stat"><span class="result-stat-label">Integrity</span><span class="integrity-badge integrity-badge--ok">Verified</span></div>
      <div class="result-stat"><span class="result-stat-label">Algorithm</span><span class="result-stat-value">AES-256-GCM</span></div>
      <div class="result-stat"><span class="result-stat-label">Original Size</span><span class="result-stat-value">${formatFileSize(data.length)}</span></div>
    </div>
    
    <div class="result-actions">
      ${dlUrl ? `
      <a href="${dlUrl}" download="${metadata.filename}" class="btn btn--success btn--large">
        <svg class="btn-icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
        Download ${metadata.filename}
      </a>
      ` : ''}
      <button class="btn btn--secondary" onclick="location.reload()">Start Over</button>
    </div>
  `;
}
