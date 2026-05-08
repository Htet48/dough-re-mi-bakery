# Google Drive Export Setup Guide

## Step 1 — Enable Google Drive API

1. Go to: https://console.cloud.google.com/
2. Select your **dough-re-mi-bakery** project
3. Go to **APIs & Services → Library**
4. Search "Google Drive API" → Enable it

## Step 2 — Create OAuth 2.0 Credentials

1. Go to **APIs & Services → Credentials**
2. Click **+ Create Credentials → OAuth client ID**
3. Application type: **Web application**
4. Name: `Dough-Re-Mi Bakery Drive Export`
5. Authorized JavaScript origins — add BOTH:
   ```
   http://localhost:3000
   https://dough-re-mi-bakery.web.app
   ```
6. Click **Create** → Copy the **Client ID**

## Step 3 — Create API Key

1. Click **+ Create Credentials → API Key**
2. Copy the **API Key**
3. (Optional) Restrict it to Google Drive API only

## Step 4 — Add to your .env file

Create `.env` file in your project root (same folder as package.json):
```
REACT_APP_GOOGLE_API_KEY=AIzaSy...your-api-key-here
REACT_APP_GOOGLE_CLIENT_ID=123456789-abc...your-client-id.apps.googleusercontent.com
```

## Step 5 — Rebuild and deploy

```bash
npm run build
firebase deploy --only hosting
```

## How it works for users

1. Click any **⬇ Export** button → click the ▾ chevron
2. Choose **Save to Google Drive**
3. Google sign-in popup appears (first time only)
4. File uploads to **DRM_Reports** folder in their Google Drive
5. Toast shows "Saved to Google Drive!" with link to open it

## Notes
- Users sign in with their OWN Google account
- Files go to THEIR Google Drive (not admin's)
- The app only has permission to files it creates (drive.file scope)
- No Google Workspace account needed — any Gmail works
