// src/utils/driveExport.js
// Export CSV either locally or to Google Drive
// Google Drive uses OAuth2 — user signs in with their Google account

const SCOPES = 'https://www.googleapis.com/auth/drive.file';
// drive.file = only files created by THIS app (safer than full drive access)

let gapiLoaded = false;
let tokenClient = null;
let accessToken = null;

// ── Load Google API scripts ───────────────────────────────
export const initGoogleDrive = () => new Promise((resolve, reject) => {
  if (gapiLoaded) { resolve(); return; }

  // Load GAPI
  const gapiScript = document.createElement('script');
  gapiScript.src = 'https://apis.google.com/js/api.js';
  gapiScript.onload = () => {
    window.gapi.load('client', async () => {
      await window.gapi.client.init({
        apiKey: process.env.REACT_APP_GOOGLE_API_KEY,
        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
      });
      gapiLoaded = true;
      resolve();
    });
  };
  gapiScript.onerror = reject;
  document.head.appendChild(gapiScript);

  // Load GSI (Google Sign In)
  const gsiScript = document.createElement('script');
  gsiScript.src = 'https://accounts.google.com/gsi/client';
  gsiScript.onload = () => {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: process.env.REACT_APP_GOOGLE_CLIENT_ID,
      scope: SCOPES,
      callback: (resp) => {
        if (resp.error) return;
        accessToken = resp.access_token;
        window.gapi.client.setToken({ access_token: accessToken });
      },
    });
  };
  document.head.appendChild(gsiScript);
});

// ── Get OAuth token (shows Google sign-in popup) ─────────
const getToken = () => new Promise((resolve, reject) => {
  if (accessToken) { resolve(accessToken); return; }
  if (!tokenClient) { reject(new Error('Google Drive not initialized')); return; }
  tokenClient.callback = (resp) => {
    if (resp.error) { reject(new Error(resp.error)); return; }
    accessToken = resp.access_token;
    window.gapi.client.setToken({ access_token: accessToken });
    resolve(accessToken);
  };
  tokenClient.requestAccessToken({ prompt: '' });
});

// ── Find or create QB_Reports folder in Drive ────────────
const getOrCreateFolder = async (token) => {
  // Search for existing folder
  const searchResp = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=name='QB_Reports' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const search = await searchResp.json();
  if (search.files?.length > 0) return search.files[0].id;

  // Create folder
  const createResp = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'QB_Reports',
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });
  const folder = await createResp.json();
  return folder.id;
};

// ── Upload CSV to Google Drive ────────────────────────────
export const uploadToDrive = async (csvContent, filename) => {
  await initGoogleDrive();
  const token = await getToken();
  const folderId = await getOrCreateFolder(token);

  // Create file with multipart upload
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

  const metadata = {
    name: filename,
    parents: [folderId],
    mimeType: 'text/csv',
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', blob);

  const uploadResp = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    }
  );

  if (!uploadResp.ok) {
    const err = await uploadResp.json();
    throw new Error(err.error?.message || 'Upload failed');
  }
  const file = await uploadResp.json();
  return `https://drive.google.com/file/d/${file.id}/view`;
};

// ── Upload Excel (.xlsx) binary to Google Drive ───────────
export const uploadExcelToDrive = async (xlsxBuffer, filename) => {
  await initGoogleDrive();
  const token    = await getToken();
  const folderId = await getOrCreateFolder(token);

  const blob     = new Blob([xlsxBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const metadata = {
    name: filename,
    parents: [folderId],
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', blob);

  const resp = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form }
  );
  if (!resp.ok) { const e = await resp.json(); throw new Error(e.error?.message || 'Upload failed'); }
  const file = await resp.json();
  return `https://drive.google.com/file/d/${file.id}/view`;
};

// ── Build CSV string from rows ────────────────────────────
export const rowsToCSV = (rows) => {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]).join(',');
  const body    = rows.map(r =>
    Object.values(r).map(v => `"${String(v??'').replace(/"/g,'""')}"`).join(',')
  ).join('\n');
  return headers + '\n' + body;
};
