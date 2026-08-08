const state = {
  activeTab: 'text',
  textPayload: 'Welcome to QR INSTANT V1 LIGHT - Instant universal QR generator!',
  linkPayload: '',
  fileData: {
    pdf: null,
    audio: null,
    video: null,
    image: null
  },
  currentPayload: '',
  qrInstance: null,
  videoStream: null
};

document.addEventListener('DOMContentLoaded', () => {
  initApp();
  checkUrlHashPayload();
  loadHistory();
});

function initApp() {
  document.getElementById('input-text').value = state.textPayload;
  updateTextCharCount();
  generateInitialQr();

  // Setup Drag & Drop
  ['pdf', 'audio', 'video', 'image'].forEach(type => {
    const dz = document.getElementById(`dropzone-${type}`);
    if (!dz) return;
    ['dragenter', 'dragover'].forEach(eName => {
      dz.addEventListener(eName, (e) => {
        e.preventDefault();
        dz.classList.add('drag-over');
      });
    });
    ['dragleave', 'drop'].forEach(eName => {
      dz.addEventListener(eName, (e) => {
        e.preventDefault();
        dz.classList.remove('drag-over');
      });
    });
  });
}

function switchTab(tabName) {
  state.activeTab = tabName;

  document.querySelectorAll('.tab-btn').forEach((btn, index) => {
    const tabs = ['text', 'link', 'pdf', 'audio', 'video', 'image'];
    btn.classList.toggle('active', tabs[index] === tabName);
  });

  document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
  const activePane = document.getElementById(`pane-${tabName}`);
  if (activePane) activePane.classList.add('active');

  const badge = document.getElementById('current-type-badge');
  const icons = {
    text: 'fa-align-left',
    link: 'fa-link',
    pdf: 'fa-file-pdf',
    audio: 'fa-music',
    video: 'fa-video',
    image: 'fa-image'
  };
  badge.innerHTML = `<i class="fa-solid ${icons[tabName]}"></i> ${tabName.toUpperCase()} MODE`;

  updateQrCode();
}

function handleTextInput() {
  state.textPayload = document.getElementById('input-text').value;
  updateTextCharCount();
  updateQrCode();
}

function updateTextCharCount() {
  const len = (state.textPayload || '').length;
  document.getElementById('text-counter').innerText = `${len} chars`;
}

function handleLinkInput() {
  state.linkPayload = document.getElementById('input-link').value.trim();
  updateQrCode();
}

function addUrlPrefix(prefix) {
  const input = document.getElementById('input-link');
  if (!input.value.startsWith('http')) {
    input.value = prefix + input.value;
  }
  handleLinkInput();
  input.focus();
}

// Universal Cloud File Upload (tmpfiles.org direct HTTPS link for ALL phones/scanners)
async function handleFileUpload(event, type) {
  const file = event.target.files[0];
  if (!file) return;

  const progressBox = document.getElementById(`progress-${type}`);
  const progressBar = document.getElementById(`bar-${type}`);
  const progressPercent = document.getElementById(`percent-${type}`);
  const dz = document.getElementById(`dropzone-${type}`);

  dz.style.display = 'none';
  progressBox.style.display = 'block';
  progressBar.style.width = '20%';
  progressPercent.innerText = '20%';

  // Read local base64 preview first
  const reader = new FileReader();
  reader.onload = async (e) => {
    const localBase64 = e.target.result;
    progressBar.style.width = '55%';
    progressPercent.innerText = '55%';

    try {
      // Upload to Universal Direct File Bridge
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('https://tmpfiles.org/api/v1/upload', {
        method: 'POST',
        body: formData
      });

      const resData = await response.json();
      let directPublicUrl = '';

      if (resData && resData.status === 'success' && resData.data && resData.data.url) {
        // Convert to direct download/stream link: https://tmpfiles.org/dl/...
        directPublicUrl = resData.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
      } else {
        // Fallback to direct data URI / blob viewer
        directPublicUrl = localBase64;
      }

      progressBar.style.width = '100%';
      progressPercent.innerText = '100%';

      setTimeout(() => {
        progressBox.style.display = 'none';

        state.fileData[type] = {
          name: file.name,
          size: formatFileSize(file.size),
          rawSize: file.size,
          mimeType: file.type,
          directUrl: directPublicUrl,
          localData: localBase64
        };

        document.getElementById(`name-${type}`).innerText = file.name;
        document.getElementById(`pill-${type}`).style.display = 'flex';

        saveItemToStorage(type, file.name, directPublicUrl);
        updateQrCode();
        showToast(`${type.toUpperCase()} direct universal QR ready!`);
      }, 400);

    } catch (err) {
      console.warn('Cloud upload fallback to Data URI:', err);
      progressBox.style.display = 'none';

      state.fileData[type] = {
        name: file.name,
        size: formatFileSize(file.size),
        rawSize: file.size,
        mimeType: file.type,
        directUrl: localBase64,
        localData: localBase64
      };

      document.getElementById(`name-${type}`).innerText = file.name;
      document.getElementById(`pill-${type}`).style.display = 'flex';

      saveItemToStorage(type, file.name, localBase64);
      updateQrCode();
      showToast(`${type.toUpperCase()} encoded locally!`);
    }
  };

  reader.readAsDataURL(file);
}

function removeFile(type) {
  state.fileData[type] = null;
  document.getElementById(`file-${type}`).value = '';
  document.getElementById(`pill-${type}`).style.display = 'none';
  document.getElementById(`dropzone-${type}`).style.display = 'block';
  updateQrCode();
  showToast('File removed');
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Get Active Payload - Always returns a universal string or direct public URL
function getActivePayload() {
  const tab = state.activeTab;
  let payload = '';

  if (tab === 'text') {
    payload = state.textPayload || 'QR INSTANT';
  } else if (tab === 'link') {
    payload = state.linkPayload || 'https://example.com';
  } else {
    const fileObj = state.fileData[tab];
    if (fileObj && fileObj.directUrl) {
      payload = fileObj.directUrl;
    } else {
      payload = `[Please upload a ${tab.toUpperCase()} file to generate QR]`;
    }
  }
  return payload;
}

function generateInitialQr() {
  const container = document.getElementById('qrcode-container');
  container.innerHTML = '';
  state.currentPayload = getActivePayload();
  renderPayloadChip(state.currentPayload);

  state.qrInstance = new QRCode(container, {
    text: state.currentPayload,
    width: 240,
    height: 240,
    colorDark: document.getElementById('qr-color-dark').value,
    colorLight: document.getElementById('qr-color-light').value,
    correctLevel: QRCode.CorrectLevel.M
  });
}

function renderPayloadChip(payload) {
  const chip = document.getElementById('qr-payload-chip');
  if (!chip) return;
  if (payload.startsWith('http')) {
    chip.innerHTML = `<i class="fa-solid fa-link" style="color: var(--accent-emerald);"></i> ${escapeHtml(payload)}`;
  } else if (payload.startsWith('data:')) {
    chip.innerHTML = `<i class="fa-solid fa-code" style="color: var(--accent-blue);"></i> [Direct Embedded Data URI]`;
  } else {
    chip.innerHTML = `<i class="fa-solid fa-align-left"></i> ${escapeHtml(payload.substring(0, 45))}${payload.length > 45 ? '...' : ''}`;
  }
}

function updateQrCode() {
  const payload = getActivePayload();
  state.currentPayload = payload;
  renderPayloadChip(payload);

  const darkColor = document.getElementById('qr-color-dark').value;
  const lightColor = document.getElementById('qr-color-light').value;
  const eccMap = {
    'L': QRCode.CorrectLevel.L,
    'M': QRCode.CorrectLevel.M,
    'Q': QRCode.CorrectLevel.Q,
    'H': QRCode.CorrectLevel.H
  };
  const ecc = eccMap[document.getElementById('qr-ecc').value] || QRCode.CorrectLevel.M;
  const size = parseInt(document.getElementById('qr-size').value, 10) || 240;

  document.getElementById('label-dark').innerText = darkColor.toUpperCase();
  document.getElementById('label-light').innerText = lightColor.toUpperCase();

  const container = document.getElementById('qrcode-container');
  container.innerHTML = '';

  state.qrInstance = new QRCode(container, {
    text: payload,
    width: size > 300 ? 240 : size,
    height: size > 300 ? 240 : size,
    colorDark: darkColor,
    colorLight: lightColor,
    correctLevel: ecc
  });

  const wrapper = document.getElementById('qr-wrapper');
  wrapper.classList.remove('glow-pulse');
  void wrapper.offsetWidth;
  wrapper.classList.add('glow-pulse');
}

function triggerDownload(event) {
  createRipple(event);

  const qrCanvas = document.querySelector('#qrcode-container canvas');
  const qrImg = document.querySelector('#qrcode-container img');
  let dataUrl = '';

  if (qrCanvas) {
    dataUrl = qrCanvas.toDataURL('image/png');
  } else if (qrImg) {
    dataUrl = qrImg.src;
  }

  if (!dataUrl) {
    showToast('Please wait for QR generation');
    return;
  }

  const downloadLink = document.createElement('a');
  downloadLink.href = dataUrl;
  downloadLink.download = `QR_INSTANT_${state.activeTab.toUpperCase()}_${Date.now()}.png`;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);

  showToast('QR Code PNG downloaded!');
}

function createRipple(event) {
  const button = event.currentTarget;
  const circle = document.createElement('span');
  const diameter = Math.max(button.clientWidth, button.clientHeight);
  const radius = diameter / 2;

  circle.style.width = circle.style.height = `${diameter}px`;
  circle.style.left = `${event.clientX - button.getBoundingClientRect().left - radius}px`;
  circle.style.top = `${event.clientY - button.getBoundingClientRect().top - radius}px`;
  circle.classList.add('ripple-effect');

  const ripple = button.getElementsByClassName('ripple-effect')[0];
  if (ripple) ripple.remove();

  button.appendChild(circle);
}

function copyDirectLink() {
  const payload = state.currentPayload;
  navigator.clipboard.writeText(payload).then(() => {
    showToast('Direct link copied to clipboard!');
  }).catch(() => {
    showToast('Failed to copy');
  });
}

function previewCurrentPayload() {
  const payload = state.currentPayload;
  if (payload.startsWith('http')) {
    window.open(payload, '_blank');
  } else {
    openContentModal(state.activeTab, payload);
  }
}

function openContentModal(type, contentData) {
  const modal = document.getElementById('content-modal');
  const viewer = document.getElementById('modal-viewer-body');
  const title = document.getElementById('modal-title');
  const badge = document.getElementById('modal-badge-label');
  const icon = document.getElementById('modal-type-icon');

  title.innerText = `${type.toUpperCase()} Viewer`;
  badge.innerText = type.toUpperCase();
  viewer.innerHTML = '';

  const iconClassMap = {
    text: 'fa-align-left',
    link: 'fa-link',
    pdf: 'fa-file-pdf',
    audio: 'fa-music',
    video: 'fa-video',
    image: 'fa-image'
  };
  icon.className = `fa-solid ${iconClassMap[type] || 'fa-folder-open'}`;

  if (type === 'text') {
    viewer.innerHTML = `
      <div style="width: 100%; text-align: left; background: var(--bg-surface); padding: 18px; border-radius: 12px; font-size: 14.5px; line-height: 1.6; max-height: 320px; overflow-y: auto; white-space: pre-wrap; font-family: 'JetBrains Mono', monospace;">${escapeHtml(contentData)}</div>
    `;
  } else if (type === 'link') {
    viewer.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 20px;">
        <i class="fa-solid fa-arrow-up-right-from-square" style="font-size: 38px; color: var(--accent-blue);"></i>
        <a href="${encodeURI(contentData)}" target="_blank" rel="noopener noreferrer" style="font-size: 16px; font-weight: 700; color: var(--accent-blue); word-break: break-all; text-decoration: underline;">
          ${escapeHtml(contentData)}
        </a>
      </div>
    `;
  } else if (type === 'pdf') {
    viewer.innerHTML = `
      <iframe src="${contentData}" class="pdf-preview-box"></iframe>
    `;
  } else if (type === 'audio') {
    viewer.innerHTML = `
      <div class="audio-player-card">
        <div class="soundwave-visualizer">
          <div class="wave-bar"></div>
          <div class="wave-bar"></div>
          <div class="wave-bar"></div>
          <div class="wave-bar"></div>
          <div class="wave-bar"></div>
          <div class="wave-bar"></div>
          <div class="wave-bar"></div>
          <div class="wave-bar"></div>
        </div>
        <audio controls="controls" autoplay="autoplay" src="${contentData}"></audio>
      </div>
    `;
  } else if (type === 'video') {
    viewer.innerHTML = `
      <video controls="controls" autoplay="autoplay" src="${contentData}"></video>
    `;
  } else if (type === 'image') {
    viewer.innerHTML = `
      <img src="${contentData}" class="image-preview-full" alt="Decoded Image Preview" />
    `;
  }

  modal.classList.add('show');
}

function closeContentModal() {
  const modal = document.getElementById('content-modal');
  modal.classList.remove('show');
  const viewer = document.getElementById('modal-viewer-body');
  viewer.innerHTML = '';
}

function performModalAction() {
  const payload = state.currentPayload;
  if (payload.startsWith('http')) {
    window.open(payload, '_blank');
  } else {
    copyModalContent();
  }
}

function copyModalContent() {
  navigator.clipboard.writeText(state.currentPayload).then(() => {
    showToast('Copied content to clipboard!');
  });
}

// Camera & Image QR Scanner
function openScannerModal() {
  document.getElementById('scanner-modal').classList.add('show');
  startCamera();
}

function closeScannerModal() {
  stopCamera();
  document.getElementById('scanner-modal').classList.remove('show');
}

function startCamera() {
  const video = document.getElementById('scanner-video');
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then(stream => {
        state.videoStream = stream;
        video.srcObject = stream;
        video.setAttribute('playsinline', true);
        video.play();
        requestAnimationFrame(tickScanner);
      })
      .catch(err => {
        console.warn('Camera access error:', err);
        showToast('Camera not available, please use file upload scan');
      });
  }
}

function stopCamera() {
  if (state.videoStream) {
    state.videoStream.getTracks().forEach(track => track.stop());
    state.videoStream = null;
  }
}

function tickScanner() {
  const video = document.getElementById('scanner-video');
  if (video.readyState === video.HAVE_ENOUGH_DATA) {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    if (window.jsQR) {
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert'
      });
      if (code) {
        closeScannerModal();
        handleScannedResult(code.data);
        return;
      }
    }
  }
  if (state.videoStream) {
    requestAnimationFrame(tickScanner);
  }
}

function scanFromImageFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      if (window.jsQR) {
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code) {
          closeScannerModal();
          handleScannedResult(code.data);
        } else {
          showToast('No readable QR code found in image');
        }
      }
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function handleScannedResult(rawString) {
  showToast('QR Code Decoded Successfully!');
  if (rawString.startsWith('http://') || rawString.startsWith('https://')) {
    const lower = rawString.toLowerCase();
    if (lower.endsWith('.pdf') || lower.includes('/pdf')) {
      openContentModal('pdf', rawString);
    } else if (lower.endsWith('.mp3') || lower.endsWith('.wav') || lower.endsWith('.ogg') || lower.includes('/audio')) {
      openContentModal('audio', rawString);
    } else if (lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.mov') || lower.includes('/video')) {
      openContentModal('video', rawString);
    } else if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.webp') || lower.endsWith('.gif')) {
      openContentModal('image', rawString);
    } else {
      openContentModal('link', rawString);
    }
  } else if (rawString.startsWith('data:image/')) {
    openContentModal('image', rawString);
  } else if (rawString.startsWith('data:audio/')) {
    openContentModal('audio', rawString);
  } else if (rawString.startsWith('data:video/')) {
    openContentModal('video', rawString);
  } else if (rawString.startsWith('data:application/pdf')) {
    openContentModal('pdf', rawString);
  } else {
    openContentModal('text', rawString);
  }
}

function checkUrlHashPayload() {
  const hash = window.location.hash;
  if (hash.startsWith('#url=')) {
    const targetUrl = decodeURIComponent(hash.replace('#url=', ''));
    setTimeout(() => {
      handleScannedResult(targetUrl);
    }, 300);
  }
}

function saveItemToStorage(type, title, payload) {
  const history = JSON.parse(localStorage.getItem('qr_history') || '[]');
  history.unshift({
    id: Date.now(),
    type: type,
    title: title,
    payload: payload,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  });
  if (history.length > 20) history.pop();
  localStorage.setItem('qr_history', JSON.stringify(history));
  loadHistory();
}

function loadHistory() {
  const list = document.getElementById('history-list-box');
  const history = JSON.parse(localStorage.getItem('qr_history') || '[]');

  if (history.length === 0) {
    list.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 18px; font-size: 13px;">
        <i class="fa-solid fa-inbox" style="font-size: 24px; margin-bottom: 6px; display: block;"></i> No saved QR items yet. Generate a QR code to see it stored locally!
      </div>
    `;
    return;
  }

  list.innerHTML = history.map(item => `
    <div class="history-item" onclick="handleScannedResult('${escapeHtml(item.payload)}')">
      <div class="history-meta">
        <i class="fa-solid ${item.type === 'pdf' ? 'fa-file-pdf' : item.type === 'audio' ? 'fa-music' : item.type === 'video' ? 'fa-video' : item.type === 'image' ? 'fa-image' : item.type === 'link' ? 'fa-link' : 'fa-align-left'}"></i>
        <div class="history-meta-text">
          <div class="history-text">${escapeHtml(item.title)}</div>
          <div class="history-time">${item.time} &#8226; ${item.type.toUpperCase()}</div>
        </div>
      </div>
      <i class="fa-solid fa-chevron-right" style="font-size: 12px; color: var(--text-muted);"></i>
    </div>
  `).join('');
}

function clearHistory() {
  localStorage.removeItem('qr_history');
  loadHistory();
  showToast('Local history cleared');
}

function toggleTheme() {
  const isDark = document.body.getAttribute('data-theme') === 'dark';
  document.body.setAttribute('data-theme', isDark ? 'light' : 'dark');
  const btn = document.getElementById('btn-theme-toggle');
  btn.innerHTML = `<i class="fa-solid ${isDark ? 'fa-moon' : 'fa-sun'}"></i>`;
  showToast(`Switched to ${isDark ? 'Light' : 'Dark'} theme`);
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  document.getElementById('toast-msg').innerText = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.innerText = text;
  return div.innerHTML;
}
