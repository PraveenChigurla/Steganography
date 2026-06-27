# StegVault: Universal Steganography Toolkit

<div align="center">
  <img src="assets/favicon.svg" alt="StegVault Logo" width="120" />
</div>

<br/>

**StegVault** is a powerful, modern, 100% local, browser-based steganography toolkit that allows you to hide AES-256-GCM encrypted data (text or multiple files) inside ordinary images, videos, audio files, and documents.

## Features ✨

- **Universal Carrier Support**: Hide data inside Images (`.png`, `.webp`, `.bmp`), Videos (`.mp4`, `.mkv`, `.webm`, etc.), Audio (`.mp3`, `.wav`, etc.), and Documents (`.pdf`, `.docx`, `.zip`, `.py`, etc.).
- **Dual Embedding Engines**:
  - **LSB (Least Significant Bit)**: Used for images to embed data directly into the pixel color values without perceptible visual changes.
  - **EOF (End-Of-File) Injection**: Used for videos, audio, and documents to bypass lossy compression and allow for **virtually unlimited capacity** (up to 2GB per file) with absolutely zero quality degradation.
- **Military-Grade Security**: All payloads are compressed and then encrypted using **AES-256-GCM** (Web Crypto API) with a PBKDF2 derived key (600,000 iterations). 
- **100% Local Processing**: No backends, no servers, no tracking. Everything happens locally within your browser's memory.
- **Dynamic Capacity Gauge**: Real-time visual feedback on how much space your payload requires vs the carrier's maximum capacity.

## Project Architecture

StegVault is built using **Vanilla HTML/CSS/JS**. 
- **No Build Steps**: It does not require Node.js, Webpack, or Vite to run.
- **Dependencies**: Uses `JSZip` (for bundling multiple files) and `pako` (for DEFLATE compression) loaded via CDN.

## 🚀 Setup & Installation

Since StegVault uses modern browser APIs (like Web Workers and Web Crypto), it **must be served over a local web server**. Simply double-clicking `index.html` to open it as a `file://` protocol will not work due to strict browser security policies (CORS and Secure Context requirements).

### Prerequisites
You need a simple local HTTP server. You can use Python, Node.js, or any VS Code extension.

### Method 1: Using Python (Recommended if Python is installed)
1. Clone the repository:
   ```bash
   git clone https://github.com/PraveenChigurla/Steganography.git
   cd Steganography
   ```
2. Start the local server:
   ```bash
   python -m http.server 8000
   ```
3. Open your browser and navigate to: `http://localhost:8000`

### Method 2: Using Node.js (npx)
1. Clone the repository and navigate into it.
2. Run the `http-server` package directly:
   ```bash
   npx http-server . -p 8000
   ```
3. Open your browser and navigate to: `http://localhost:8000`

### Method 3: Using VS Code "Live Server" Extension
1. Open the cloned folder in VS Code.
2. Install the **Live Server** extension by Ritwick Dey.
3. Right-click on `index.html` and select **"Open with Live Server"**.

## Usage Guide

### Encrypting (Hiding Data)
1. Navigate to the **Encrypt** tab.
2. Select your **Cover Media** (Image, Video, Audio, or Document) and drag & drop the carrier file.
3. Choose your **Payload Mode** (Text or Files) and input the secret data you want to hide.
4. Enter a strong **Password**.
5. Click **Encrypt & Hide Data**. 
6. Download the resulting Stego File.

### Decrypting (Extracting Data)
1. Navigate to the **Decrypt** tab.
2. Upload the Stego File (the image, video, audio, or document that contains the hidden data).
3. Enter the exact **Password** used during encryption.
4. Click **Decrypt & Extract**.
5. Your hidden text or files will be revealed and ready to download!

## Limitations & Warnings

- **Social Media Compression**: If you upload your generated stego file to platforms that aggressively recompress media or strip metadata (like WhatsApp, Twitter, or Discord), the hidden data **will be destroyed**. 
- **Safe Transmission**: To safely send stego files to another person, send them via email, upload them to cloud storage (Google Drive, Dropbox), put them on a USB drive, or send them as a raw "Document" file.

## License
MIT License.
