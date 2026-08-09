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
  videoStream: null,
  // Google Drive State
  googleUser: null,
  accessToken: null,
  tokenClient: null,
  clientId: localStorage.getItem('gdrive_client_id') || ''
};

document.addEventListener('DOMContentLoaded', () => {
  initApp();
  checkUrlHashPayload();
  loadHistory();
  initGoogleAuth();
});

// Also run immediately in case DOM is already loaded
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  setTimeout(() => {
    initApp();
    checkUrlHashPayload();
    loadHistory();
    initGoogleAuth();
  }, 100);
}

function initApp() {
  const inputEl = document.getElementById('input-text');
  if (inputEl && !inputEl.value) {
    inputEl.value = state.textPayload;
  }
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

// -------------------------------------------------------------
// GOOGLE DRIVE INTEGRATION & FAIL-SAFE MODAL INJECTION
// -------------------------------------------------------------
function initGoogleAuth() {
  if (!state.clientId) return;

  if (typeof google === 'undefined' || !google.accounts || !google.accounts.oauth2) {
    setTimeout(initGoogleAuth, 500);
    return;
  }

  try {
    state.tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: state.clientId,
      scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile',
      callback: (tokenResponse) => {
        if (tokenResponse && tokenResponse.access_token) {
          state.accessToken = tokenResponse.access_token;
          fetchUserProfile(state.accessToken);
        } else if (tokenResponse && tokenResponse.error) {
          console.warn('Google Auth Error:', tokenResponse.error);
          openGDriveConfigModal();
        }
      },
      error_callback: (err) => {
        console.warn('OAuth Error:', err);
        openGDriveConfigModal();
      }
    });
  } catch (err) {
    console.warn('Google Token Client init error:', err);
  }
}

function handleGoogleDriveSignIn() {
  if (!state.clientId) {
    openGDriveConfigModal();
    return;
  }

  if (!state.tokenClient) {
    initGoogleAuth();
  }

  if (state.tokenClient) {
    try {
      state.tokenClient.requestAccessToken({ prompt: 'consent' });
    } catch (e) {
      openGDriveConfigModal();
    }
  } else {
    openGDriveConfigModal();
  }
}

function openGDriveGuideModal() {
  openGDriveConfigModal();
}

function ensureGDriveModalExists() {
  let modal = document.getElementById('gdrive-config-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.id = 'gdrive-config-modal';
    modal.innerHTML = `
      <div class="modal-card" style="max-width: 650px; max-height: 90vh; overflow-y: auto;">
        <div class="modal-header">
          <div class="modal-title-group">
            <div class="brand-icon-box" style="width: 38px; height: 38px; font-size: 18px; background: #4285F4; border-radius: 10px; display: grid; place-items: center; color: white;">
              <i class="fa-brands fa-google-drive"></i>
            </div>
            <div>
              <h3 style="font-family: 'Outfit', sans-serif; font-size: 17px; font-weight: 800;">Google Drive Integration &amp; Setup</h3>
              <span class="modal-badge">Direct OAuth &amp; Video Guide</span>
            </div>
          </div>
          <button class="btn-close-modal" onclick="closeGDriveConfigModal()"><i class="fa-solid fa-xmark"></i></button>
        </div>

        <div style="font-size: 13.5px; line-height: 1.6; color: var(--text-main);">
          <!-- Client ID Input Box -->
          <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 12px; padding: 14px; margin-bottom: 16px;">
            <label style="font-weight: 700; display: block; margin-bottom: 6px;">
              <i class="fa-solid fa-key" style="color: var(--accent-amber);"></i> Enter Google Cloud Client ID:
            </label>
            <div style="display: flex; gap: 8px;">
              <input type="text" class="input-field" id="gdrive-client-id-input" placeholder="e.g. 123456789-xxxx.apps.googleusercontent.com" style="font-family: monospace; font-size: 12px;" />
              <button class="btn-action btn-primary" style="padding: 0 16px; white-space: nowrap;" onclick="saveGDriveClientId()">Save &amp; Connect</button>
            </div>
          </div>

          <!-- Video Tutorial Player -->
          <div style="margin-bottom: 16px;">
            <h4 style="font-size: 14px; font-weight: 800; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between;">
              <span><i class="fa-brands fa-youtube" style="color: #ff0000;"></i> Video Tutorial (Step-by-Step)</span>
              <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" class="btn-icon-pill" style="height: 28px; font-size: 11.5px; background: rgba(66, 133, 244, 0.15); color: #4285F4; border: 1px solid rgba(66, 133, 244, 0.3); text-decoration: none; padding: 0 10px; display: inline-flex; align-items: center; gap: 4px; border-radius: 20px;">
                Open Cloud Console <i class="fa-solid fa-arrow-up-right-from-square"></i>
              </a>
            </h4>
            <div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 12px; border: 1px solid var(--border-color);">
              <iframe style="position: absolute; top:0; left: 0; width: 100%; height: 100%; border: 0;" src="https://www.youtube.com/embed/hz-Kyb18IBw?si=wqEKXX7yvFqqVBv2" title="Google OAuth Client ID Setup Guide" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
            </div>
          </div>

          <!-- Detailed Steps in Hinglish -->
          <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 12px; padding: 14px;">
            <h4 style="font-size: 14px; font-weight: 800; margin-bottom: 10px; color: var(--accent-blue);">
              <i class="fa-solid fa-list-check"></i> Complete Setup Guide (Hindi + English):
            </h4>
            
            <ol style="padding-left: 18px; margin: 0; display: flex; flex-direction: column; gap: 8px; font-size: 12.5px;">
              <li><strong>Step 1 (Open Console):</strong> <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" style="color: var(--accent-blue); text-decoration: underline;">console.cloud.google.com</a> par jayein aur <strong>New Project</strong> banayein.</li>
              <li><strong>Step 2 (Enable API):</strong> <em>APIs &amp; Services -&gt; Library</em> me <strong>"Google Drive API"</strong> search karke <strong>Enable</strong> karein.</li>
              <li><strong>Step 3 (OAuth Consent Screen):</strong> <em>OAuth consent screen</em> me <strong>External</strong> chunein, App Name me <code>QR INSTANT</code> aur apna Gmail daal kar Save karein.</li>
              <li><strong>Step 4 (Create Credentials):</strong> <em>Credentials -&gt; Create Credentials -&gt; OAuth client ID</em> select karein. Application type: <strong>"Web application"</strong>.</li>
              <li><strong>Step 5 (Authorized JavaScript Origins):</strong> <em>"Authorized JavaScript origins"</em> me apni website ka link add karein: <code id="guide-current-origin">${window.location.origin || 'https://undercoverking360-svg.github.io'}</code>.</li>
              <li><strong>Step 6 (Copy &amp; Paste):</strong> Jo <strong>Client ID</strong> milega (ending with <code>.apps.googleusercontent.com</code>), use upar paste karke <strong>Save &amp; Connect</strong> dabayein!</li>
            </ol>

            <div style="margin-top: 12px; padding: 10px; background: rgba(16, 185, 129, 0.1); border-radius: 8px; border: 1px solid rgba(16, 185, 129, 0.25); font-size: 12px;">
              <strong>💡 Zero Setup Direct Method:</strong> Agar aapko Cloud Console setup nahi karna, to aap bina login kare bhi apne Google Drive se share link copy karke direct <strong>"Or Paste Any Google Drive Link"</strong> box me daal sakte hain!
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }
  return modal;
}

function openGDriveConfigModal() {
  const modal = ensureGDriveModalExists();
  const input = document.getElementById('gdrive-client-id-input');
  if (input) input.value = state.clientId || '';

  const originEl = document.getElementById('guide-current-origin');
  if (originEl) {
    originEl.innerText = window.location.origin || 'https://undercoverking360-svg.github.io';
  }

  modal.classList.add('show');
}

function closeGDriveConfigModal() {
  const modal = document.getElementById('gdrive-config-modal');
  if (modal) modal.classList.remove('show');
}

function saveGDriveClientId() {
  const input = document.getElementById('gdrive-client-id-input');
  const val = input ? input.value.trim() : '';
  if (!val) {
    showToast('Please enter a valid Google Client ID');
    return;
  }
  state.clientId = val;
  localStorage.setItem('gdrive_client_id', val);
  initGoogleAuth();
  closeGDriveConfigModal();
  showToast('Google Client ID saved! Click Google Drive again');
}

async function fetchUserProfile(token) {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const profile = await res.json();
    state.googleUser = profile;
    updateGoogleDriveUI();
    showToast(`Connected: ${profile.name || 'Google Drive'}`);
  } catch (e) {
    state.googleUser = { name: 'Google User', picture: '' };
    updateGoogleDriveUI();
    showToast('Connected to Google Drive');
  }
}

function updateGoogleDriveUI() {
  const gdriveBtns = document.querySelectorAll('.gdrive-auth-btn');
  const gdriveStatus = document.querySelectorAll('.gdrive-status-badge');

  if (state.googleUser && state.accessToken) {
    gdriveBtns.forEach(btn => {
      btn.innerHTML = `<img src="${state.googleUser.picture || 'https://www.gstatic.com/images/branding/product/1x/drive_2020q4_48dp.png'}" style="width: 20px; height: 20px; border-radius: 50%;" /> <span>Connected (${escapeHtml(state.googleUser.name.split(' ')[0])})</span>`;
      btn.classList.add('connected');
    });

    gdriveStatus.forEach(el => {
      el.innerHTML = `<i class="fa-solid fa-cloud-check" style="color: var(--accent-emerald);"></i> Saving to Your Google Drive (Lifetime Permanent)`;
    });
  } else {
    gdriveBtns.forEach(btn => {
      btn.innerHTML = `<i class="fa-brands fa-google-drive" style="color: #4285F4;"></i> <span>Google Drive</span>`;
      btn.classList.remove('connected');
    });

    gdriveStatus.forEach(el => {
      el.innerHTML = `<i class="fa-brands fa-google-drive"></i> Sign in with Google Drive for 100% Lifetime Permanent QR`;
    });
  }
}

// -------------------------------------------------------------
// GOOGLE DRIVE DIRECT URL CONVERTER (Instant No-Login Jugad)
// -------------------------------------------------------------
function handleGDriveUrlPaste(type) {
  const input = document.getElementById(`gdrive-input-${type}`);
  if (!input) return;
  const rawUrl = input.value.trim();
  if (!rawUrl) return;

  // Extract Google Drive File ID
  let fileId = '';
  const match = rawUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || 
                rawUrl.match(/id=([a-zA-Z0-9_-]+)/) || 
                rawUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);

  if (match && match[1]) {
    fileId = match[1];
  } else if (rawUrl.length > 20 && !rawUrl.includes('/')) {
    fileId = rawUrl;
  }

  if (!fileId) {
    showToast('Please paste a valid Google Drive share link');
    return;
  }

  let directUrl = '';
  if (type === 'image') {
    directUrl = `https://lh3.googleusercontent.com/d/${fileId}`;
  } else if (type === 'pdf') {
    directUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(`https://drive.google.com/uc?id=${fileId}&export=download`)}`;
  } else {
    directUrl = `https://drive.google.com/file/d/${fileId}/view?usp=sharing`;
  }

  state.fileData[type] = {
    name: `Google Drive File (${fileId.substring(0, 8)}...)`,
    size: 'Google Cloud 15GB',
    rawSize: 0,
    mimeType: type,
    directUrl: directUrl
  };

  const dz = document.getElementById(`dropzone-${type}`);
  if (dz) dz.style.display = 'none';

  const nameEl = document.getElementById(`name-${type}`);
  if (nameEl) nameEl.innerText = `Google Drive File (${fileId.substring(0, 8)}...)`;

  const pillEl = document.getElementById(`pill-${type}`);
  if (pillEl) pillEl.style.display = 'flex';

  saveItemToStorage(type, `Google Drive ${type.toUpperCase()}`, directUrl);
  updateQrCode();
  showToast(`⚡ 100% Lifetime Permanent Google Drive QR Generated!`);
  input.value = '';
}

function openGoogleDriveTab() {
  window.open('https://drive.google.com', '_blank');
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
  if (badge) {
    const icons = {
      text: 'fa-align-left',
      link: 'fa-link',
      pdf: 'fa-file-pdf',
      audio: 'fa-music',
      video: 'fa-video',
      image: 'fa-image'
    };
    badge.innerHTML = `<i class="fa-solid ${icons[tabName]}"></i> ${tabName.toUpperCase()} MODE`;
  }

  updateQrCode();
}

function handleTextInput() {
  const el = document.getElementById('input-text');
  if (el) state.textPayload = el.value;
  updateTextCharCount();
  updateQrCode();
}

function updateTextCharCount() {
  const len = (state.textPayload || '').length;
  const counter = document.getElementById('text-counter');
  if (counter) counter.innerText = `${len} chars`;
}

function handleLinkInput() {
  const el = document.getElementById('input-link');
  if (el) state.linkPayload = el.value.trim();
  updateQrCode();
}

function addUrlPrefix(prefix) {
  const input = document.getElementById('input-link');
  if (input) {
    if (!input.value.startsWith('http')) {
      input.value = prefix + input.value;
    }
    handleLinkInput();
    input.focus();
  }
}

// -------------------------------------------------------------
// FILE UPLOAD ENGINE: DIRECT STREAM + GOOGLE DRIVE + GOFILE
// -------------------------------------------------------------
async function handleFileUpload(event, type) {
  const file = event.target.files[0];
  if (!file) return;

  const progressBox = document.getElementById(`progress-${type}`);
  const progressBar = document.getElementById(`bar-${type}`);
  const progressPercent = document.getElementById(`percent-${type}`);
  const dz = document.getElementById(`dropzone-${type}`);

  if (dz) dz.style.display = 'none';
  if (progressBox) progressBox.style.display = 'block';
  if (progressBar) progressBar.style.width = '25%';
  if (progressPercent) progressPercent.innerText = '25%';

  let directPublicUrl = '';

  // 1. If User has Google Drive Token -> Upload to User's Own Google Drive
  if (state.accessToken) {
    try {
      if (progressBar) progressBar.style.width = '50%';
      if (progressPercent) progressPercent.innerText = '50% (Uploading to your Google Drive...)';

      const metadata = {
        name: `QR_INSTANT_${file.name}`,
        mimeType: file.type
      };

      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', file);

      const gRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
        method: 'POST',
        headers: { Authorization: `Bearer ${state.accessToken}` },
        body: form
      });

      const gData = await gRes.json();

      if (gData && gData.id) {
        if (progressBar) progressBar.style.width = '80%';
        if (progressPercent) progressPercent.innerText = '80% (Setting public sharing...)';

        await fetch(`https://www.googleapis.com/drive/v3/files/${gData.id}/permissions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${state.accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ role: 'reader', type: 'anyone' })
        });

        if (type === 'image') {
          directPublicUrl = `https://lh3.googleusercontent.com/d/${gData.id}`;
        } else if (type === 'pdf') {
          directPublicUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(`https://drive.google.com/uc?id=${gData.id}&export=download`)}`;
        } else {
          directPublicUrl = `https://drive.google.com/file/d/${gData.id}/view?usp=sharing`;
        }
      }
    } catch (gErr) {
      console.warn('Google Drive direct upload error, using fast direct cloud:', gErr);
    }
  }

  // 2. Direct Cloud Fast Stream Bridge (TmpFiles)
  if (!directPublicUrl) {
    try {
      if (progressBar) progressBar.style.width = '65%';
      if (progressPercent) progressPercent.innerText = '65%';

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('https://tmpfiles.org/api/v1/upload', {
        method: 'POST',
        body: formData
      });

      const resData = await response.json();

      if (resData && resData.status === 'success' && resData.data && resData.data.url) {
        const rawDlUrl = resData.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
        if (type === 'pdf') {
          directPublicUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(rawDlUrl)}`;
        } else {
          directPublicUrl = rawDlUrl;
        }
      }
    } catch (fallbackErr) {
      console.warn('TmpFiles upload error, trying Gofile engine:', fallbackErr);
    }
  }

  // 3. Gofile Backup Engine (Multi-cloud fallback)
  if (!directPublicUrl) {
    try {
      if (progressBar) progressBar.style.width = '75%';
      if (progressPercent) progressPercent.innerText = '75% (Connecting Gofile Server...)';

      const srvRes = await fetch('https://api.gofile.io/servers');
      const srvData = await srvRes.json();
      const server = (srvData && srvData.data && srvData.data.servers && srvData.data.servers[0]) ? srvData.data.servers[0].name : 'store1';

      const gFormData = new FormData();
      gFormData.append('file', file);

      const goRes = await fetch(`https://${server}.gofile.io/contents/uploadfile`, {
        method: 'POST',
        body: gFormData
      });
      const goData = await goRes.json();

      if (goData && goData.status === 'ok' && goData.data && goData.data.downloadPage) {
        directPublicUrl = goData.data.downloadPage;
      }
    } catch (gofileErr) {
      console.warn('Gofile backup engine error:', gofileErr);
    }
  }

  if (!directPublicUrl) {
    if (progressBox) progressBox.style.display = 'none';
    if (dz) dz.style.display = 'block';
    showToast('Upload failed, please try pasting Google Drive link');
    return;
  }

  if (progressBar) progressBar.style.width = '100%';
  if (progressPercent) progressPercent.innerText = '100%';

  setTimeout(() => {
    if (progressBox) progressBox.style.display = 'none';

    state.fileData[type] = {
      name: file.name,
      size: formatFileSize(file.size),
      rawSize: file.size,
      mimeType: file.type,
      directUrl: directPublicUrl
    };

    const nameEl = document.getElementById(`name-${type}`);
    if (nameEl) nameEl.innerText = file.name;

    const pillEl = document.getElementById(`pill-${type}`);
    if (pillEl) pillEl.style.display = 'flex';

    saveItemToStorage(type, file.name, directPublicUrl);
    updateQrCode();

    const isGDrive = directPublicUrl.includes('googleusercontent') || directPublicUrl.includes('drive.google.com');
    showToast(isGDrive ? `⚡ Saved to Google Drive (100% Lifetime Permanent QR)!` : `⚡ ${type.toUpperCase()} Direct QR Ready!`);
  }, 300);
}

function removeFile(type) {
  state.fileData[type] = null;
  const fileInput = document.getElementById(`file-${type}`);
  if (fileInput) fileInput.value = '';

  const pillEl = document.getElementById(`pill-${type}`);
  if (pillEl) pillEl.style.display = 'none';

  const dz = document.getElementById(`dropzone-${type}`);
  if (dz) dz.style.display = 'block';

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

// Get Active Payload
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
      payload = `[Please upload a ${tab.toUpperCase()} file or paste Google Drive link]`;
    }
  }
  return payload;
}

function generateInitialQr() {
  const container = document.getElementById('qrcode-container');
  if (!container) return;
  container.innerHTML = '';
  state.currentPayload = getActivePayload();
  renderPayloadChip(state.currentPayload);

  state.qrInstance = new QRCode(container, {
    text: state.currentPayload,
    width: 240,
    height: 240,
    colorDark: document.getElementById('qr-color-dark') ? document.getElementById('qr-color-dark').value : '#0f172a',
    colorLight: document.getElementById('qr-color-light') ? document.getElementById('qr-color-light').value : '#ffffff',
    correctLevel: QRCode.CorrectLevel.M
  });
}

function renderPayloadChip(payload) {
  const chip = document.getElementById('qr-payload-chip');
  if (!chip) return;
  if (payload.startsWith('http')) {
    const isGDrive = payload.includes('googleusercontent') || payload.includes('drive.google.com');
    chip.innerHTML = `<i class="${isGDrive ? 'fa-brands fa-google-drive' : 'fa-solid fa-link'}" style="color: var(--accent-emerald);"></i> ${escapeHtml(payload)}`;
  } else {
    chip.innerHTML = `<i class="fa-solid fa-align-left"></i> ${escapeHtml(payload.substring(0, 45))}${payload.length > 45 ? '...' : ''}`;
  }
}

function updateQrCode() {
  const payload = getActivePayload();
  state.currentPayload = payload;
  renderPayloadChip(payload);

  const darkColor = document.getElementById('qr-color-dark') ? document.getElementById('qr-color-dark').value : '#0f172a';
  const lightColor = document.getElementById('qr-color-light') ? document.getElementById('qr-color-light').value : '#ffffff';
  const eccMap = {
    'L': QRCode.CorrectLevel.L,
    'M': QRCode.CorrectLevel.M,
    'Q': QRCode.CorrectLevel.Q,
    'H': QRCode.CorrectLevel.H
  };
  const eccVal = document.getElementById('qr-ecc') ? document.getElementById('qr-ecc').value : 'M';
  const ecc = eccMap[eccVal] || QRCode.CorrectLevel.M;
  const sizeVal = document.getElementById('qr-size') ? document.getElementById('qr-size').value : '240';
  const size = parseInt(sizeVal, 10) || 240;

  const labelDark = document.getElementById('label-dark');
  if (labelDark) labelDark.innerText = darkColor.toUpperCase();

  const labelLight = document.getElementById('label-light');
  if (labelLight) labelLight.innerText = lightColor.toUpperCase();

  const container = document.getElementById('qrcode-container');
  if (!container) return;
  container.innerHTML = '';

  try {
    state.qrInstance = new QRCode(container, {
      text: payload,
      width: size > 300 ? 240 : size,
      height: size > 300 ? 240 : size,
      colorDark: darkColor,
      colorLight: lightColor,
      correctLevel: ecc
    });
  } catch (err) {
    console.warn('QR render error:', err);
  }

  const wrapper = document.getElementById('qr-wrapper');
  if (wrapper) {
    wrapper.classList.remove('glow-pulse');
    void wrapper.offsetWidth;
    wrapper.classList.add('glow-pulse');
  }
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
  if (!event || !event.currentTarget) return;
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

  if (!modal || !viewer) return;

  if (title) title.innerText = `${type.toUpperCase()} Viewer`;
  if (badge) badge.innerText = type.toUpperCase();
  viewer.innerHTML = '';

  const iconClassMap = {
    text: 'fa-align-left',
    link: 'fa-link',
    pdf: 'fa-file-pdf',
    audio: 'fa-music',
    video: 'fa-video',
    image: 'fa-image'
  };
  if (icon) icon.className = `fa-solid ${iconClassMap[type] || 'fa-folder-open'}`;

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
  if (modal) modal.classList.remove('show');
  const viewer = document.getElementById('modal-viewer-body');
  if (viewer) viewer.innerHTML = '';
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
  const modal = document.getElementById('scanner-modal');
  if (modal) modal.classList.add('show');
  startCamera();
}

function closeScannerModal() {
  stopCamera();
  const modal = document.getElementById('scanner-modal');
  if (modal) modal.classList.remove('show');
}

function startCamera() {
  const video = document.getElementById('scanner-video');
  if (!video) return;
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
  if (video && video.readyState === video.HAVE_ENOUGH_DATA) {
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
    if (lower.endsWith('.pdf') || lower.includes('/pdf') || lower.includes('docs.google.com/viewer')) {
      openContentModal('pdf', rawString);
    } else if (lower.endsWith('.mp3') || lower.endsWith('.wav') || lower.endsWith('.ogg') || lower.includes('/audio')) {
      openContentModal('audio', rawString);
    } else if (lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.mov') || lower.includes('/video')) {
      openContentModal('video', rawString);
    } else if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.webp') || lower.endsWith('.gif') || lower.includes('googleusercontent')) {
      openContentModal('image', rawString);
    } else {
      openContentModal('link', rawString);
    }
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
  if (!list) return;
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
  if (btn) btn.innerHTML = `<i class="fa-solid ${isDark ? 'fa-moon' : 'fa-sun'}"></i>`;
  showToast(`Switched to ${isDark ? 'Light' : 'Dark'} theme`);
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  const msgEl = document.getElementById('toast-msg');
  if (!toast || !msgEl) return;
  msgEl.innerText = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.innerText = text;
  return div.innerHTML;
}

// Attach all functions explicitly to window for global onclick access in all browsers
window.switchTab = switchTab;
window.handleTextInput = handleTextInput;
window.handleLinkInput = handleLinkInput;
window.addUrlPrefix = addUrlPrefix;
window.handleFileUpload = handleFileUpload;
window.removeFile = removeFile;
window.triggerDownload = triggerDownload;
window.copyDirectLink = copyDirectLink;
window.previewCurrentPayload = previewCurrentPayload;
window.openContentModal = openContentModal;
window.closeContentModal = closeContentModal;
window.performModalAction = performModalAction;
window.copyModalContent = copyModalContent;
window.openScannerModal = openScannerModal;
window.closeScannerModal = closeScannerModal;
window.startCamera = startCamera;
window.stopCamera = stopCamera;
window.scanFromImageFile = scanFromImageFile;
window.handleScannedResult = handleScannedResult;
window.clearHistory = clearHistory;
window.toggleTheme = toggleTheme;
window.handleGoogleDriveSignIn = handleGoogleDriveSignIn;
window.openGDriveConfigModal = openGDriveConfigModal;
window.openGDriveGuideModal = openGDriveGuideModal;
window.closeGDriveConfigModal = closeGDriveConfigModal;
window.saveGDriveClientId = saveGDriveClientId;
window.handleGDriveUrlPaste = handleGDriveUrlPaste;
window.openGoogleDriveTab = openGoogleDriveTab;
window.updateQrCode = updateQrCode;
