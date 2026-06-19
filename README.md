# Resume Tailor

A small web app that tailors your existing resume and writes a matching cover
letter from a job description. Built with **React + Vite + TypeScript**, hosted
on **Firebase Hosting**, with a **Firebase Cloud Function** that proxies calls
to **Google Gemini 2.0 Flash** (free tier: 1500 requests/day).

- Your resume is parsed in the browser (PDF / DOCX / TXT) and stored in
  **IndexedDB** on your device. It is never uploaded to any server you don't
  control.
- The job description and resume text are sent to your Cloud Function only when
  you click *Generate*. The function calls Gemini with your API key (kept
  server-side as a Firebase secret).
- Output: tailored resume + cover letter. Copy, or download as `.md`, `.pdf`,
  or `.docx`.

---

## Prerequisites

- Node.js 20+ and npm
- A Google account
- Firebase CLI: `npm install -g firebase-tools`
- A Gemini API key — get one free at <https://aistudio.google.com/app/apikey>

> **Note:** Firebase Cloud Functions require the **Blaze (pay-as-you-go) plan**.
> With low traffic you will almost certainly stay inside the free quota (the
> Gemini free tier alone covers 1500 requests/day), but a billing account must
> be attached.

---

## One-time setup

```powershell
# 1. Install web app + functions dependencies
cd resume-tailor
npm install
cd functions; npm install; cd ..

# 2. Create a Firebase project (or use an existing one)
firebase login
firebase projects:create resume-tailor-<your-suffix>   # or use the console

# 3. Point this repo at the project
#    Edit .firebaserc and replace REPLACE_WITH_YOUR_FIREBASE_PROJECT_ID
#    with the project ID you just created.

# 4. Upgrade the project to the Blaze plan (required for Cloud Functions).
#    Do this in the Firebase console:
#    https://console.firebase.google.com/project/<your-project>/usage/details

# 5. Store your Gemini API key as a Firebase secret
firebase functions:secrets:set GEMINI_API_KEY
#    paste your key when prompted
```

## Run locally

```powershell
# In one terminal: start the functions emulator
cd functions
npm run build
cd ..
firebase emulators:start --only functions,hosting
# App is served at http://localhost:5000
```

The `firebase.json` hosting rewrite forwards `/api/generate` to the
`generate` Cloud Function, so the same URL works locally (via the emulator)
and in production.

If you'd rather run Vite's dev server (`npm run dev`, port 5173) you'll need
the emulator running too — point Vite at it by creating `.env.local`:

```
VITE_GENERATE_URL=http://127.0.0.1:5001/<your-project-id>/us-central1/generate
```

## Deploy

```powershell
npm run build
firebase deploy
```

That pushes the static site to Firebase Hosting and the function to Cloud
Functions. Your app is live at `https://<your-project-id>.web.app`.

---

## Project structure

```
resume-tailor/
├── src/                 # React app
│   ├── api/             # client call to /api/generate
│   ├── components/      # ResumeUpload, JobInput, OutputPanel
│   ├── lib/             # parseResume, storage (IndexedDB), exporters
│   ├── App.tsx
│   └── main.tsx
├── functions/           # Firebase Cloud Function (Gemini proxy)
│   └── src/index.ts
├── firebase.json
├── .firebaserc
└── vite.config.ts
```

## Continuous deployment (GitHub Actions)

`.github/workflows/deploy.yml` builds the web app + functions on every push and:

- **Pull requests → `main`**: deploys a Firebase Hosting **preview channel**
  (auto-expires in 7 days) and comments the URL on the PR.
- **Push to `main`**: deploys hosting **and** functions to live.

### One-time GitHub setup

In your repo: **Settings → Secrets and variables → Actions → New repository secret**.
Add the two secrets below.

1. `FIREBASE_PROJECT_ID` — your Firebase project ID (e.g. `resume-tailor-abc`).
2. `FIREBASE_SERVICE_ACCOUNT` — the **full JSON** of a service account key with
   permissions to deploy. Easiest way to generate one:

   ```powershell
   firebase init hosting:github
   ```

   This walks you through creating a service account, sets `FIREBASE_SERVICE_ACCOUNT_<PROJECT_ID>`
   automatically, and scaffolds a workflow. **Delete the workflow it creates**
   (we already have `deploy.yml`) and **rename** the secret it created to
   `FIREBASE_SERVICE_ACCOUNT`, or update `deploy.yml` to reference the auto-generated name.

   Alternatively, create the service account manually in the Google Cloud
   Console with roles **Firebase Hosting Admin**, **Cloud Functions Admin**,
   **Service Account User**, and **Cloud Run Admin**, then download a JSON
   key and paste its contents as the secret value.

The `GEMINI_API_KEY` secret stays in Firebase (set via
`firebase functions:secrets:set GEMINI_API_KEY`) — it does **not** go in
GitHub.

---

## Privacy

- Resume file content lives only in your browser's IndexedDB (`resume-tailor`
  database, `resumes` store).
- Each generate request sends the resume text + job description to the Cloud
  Function, which forwards them to Gemini. Nothing is persisted on the server
  by this app.
