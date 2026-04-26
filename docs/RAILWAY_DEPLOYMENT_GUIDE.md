# Railway Deployment Guide — Colyseus Realtime Game Server

> **Purpose**: Deploy the Colyseus game server to Railway so that realtime
> multiplayer games (Sketch Party, Pong, Knockout) work across devices —
> including TestFlight, App Store, and any internet-connected device.
>
> **Why this is needed**: The Colyseus server currently runs locally on your
> dev machine. TestFlight builds cannot reach `localhost`. Railway gives you
> a public `wss://` endpoint that any device can connect to.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Generate Firebase Service Account Key](#2-generate-firebase-service-account-key)
3. [Create Railway Project](#3-create-railway-project)
4. [Deploy the Colyseus Server](#4-deploy-the-colyseus-server)
5. [Configure Environment Variables](#5-configure-environment-variables)
6. [Expose a Public Domain](#6-expose-a-public-domain)
7. [Update the Client App](#7-update-the-client-app)
8. [Rebuild and Test](#8-rebuild-and-test)
9. [Verify End-to-End](#9-verify-end-to-end)
10. [Ongoing Operations](#10-ongoing-operations)
11. [Troubleshooting](#11-troubleshooting)
12. [Architecture Summary](#12-architecture-summary)

---

## 1. Prerequisites

Before starting, make sure you have:

- [ ] A **Railway account** — sign up at [railway.app](https://railway.app) (free Hobby tier works to start)
- [ ] **Railway CLI** installed (optional but helpful):
  ```powershell
  npm install -g @railway/cli
  railway login
  ```
- [ ] **Git** — your `colyseus-server/` code pushed to a Git repository (GitHub, GitLab, etc.)
- [ ] Access to the **Firebase Console** for project `gamerapp-37e70`
- [ ] **EAS CLI** installed for rebuilding the app:
  ```powershell
  npm install -g eas-cli
  eas login
  ```

### What Railway Provides

Railway automatically handles:

- **TLS termination** — your server runs plain HTTP/WS internally, Railway wraps it in HTTPS/WSS externally
- **PORT injection** — Railway sets the `PORT` env var; the server reads it
- **Public domain** — Railway gives you a `*.up.railway.app` domain with automatic HTTPS
- **Container builds** — Railway builds the Dockerfile we created
- **Logs & monitoring** — real-time log streaming in the Railway dashboard

This means **iOS App Transport Security (ATS) is satisfied** automatically — the client connects via `wss://` which is secure.

---

## 2. Generate Firebase Service Account Key

The Colyseus server needs to verify Firebase Auth tokens and read/write Firestore session docs. On Railway, there's no `gcloud` CLI — instead, you provide a service account key.

### Step-by-step:

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Select project **gamerapp-37e70**
3. Click the **gear icon** → **Project settings**
4. Go to the **Service accounts** tab
5. Click **"Generate new private key"**
6. Save the downloaded JSON file (e.g., `gamerapp-37e70-firebase-key.json`)

### Base64-encode the key:

The key needs to be stored as a single-line environment variable. Base64 encode it:

**macOS / Linux:**

```bash
base64 -w0 < gamerapp-37e70-firebase-key.json
```

**Windows PowerShell:**

```powershell
[Convert]::ToBase64String([System.IO.File]::ReadAllBytes("firebase-service-account.local.json"))
```

Copy the output — you'll paste it as `FIREBASE_SERVICE_ACCOUNT_BASE64` in Railway.

> **Security**: Never commit this key to Git. Delete the local JSON file after copying the base64 string. The key is stored securely in Railway's encrypted environment variables.

---

## 3. Create Railway Project

### Option A: Railway Dashboard (recommended for first time)

1. Go to [railway.app/dashboard](https://railway.app/dashboard)
2. Click **"New Project"**
3. Choose **"Deploy from GitHub repo"**
4. Connect your GitHub account if not already connected
5. Select your repository (the one containing `colyseus-server/`)
6. **Important**: Railway needs to know which directory to build. See step 4.

### Option B: Railway CLI

```powershell
cd colyseus-server
railway init
# Follow the prompts to create a new project
```

---

## 4. Deploy the Colyseus Server

Since the `colyseus-server/` lives inside a monorepo, you need to tell Railway to build from that subdirectory.

### Configure Root Directory

In the Railway dashboard:

1. Click on your service
2. Go to **Settings**
3. Under **Build**, find **"Root Directory"**
4. Set it to: **`colyseus-server`**
5. Railway will now look for the `Dockerfile` inside `colyseus-server/`

### What Gets Built

The Dockerfile we created does:

1. **Stage 1 (builder)**: installs all deps → compiles TypeScript → produces `dist/`
2. **Stage 2 (production)**: installs only production deps → copies `dist/` → runs `node dist/index.js`

Railway auto-detects the Dockerfile and builds it. The `railway.toml` file provides additional configuration (health check path, restart policy).

### Trigger Deploy

If you connected via GitHub, Railway deploys automatically on every push to your default branch. For the first deploy:

1. Push your latest changes (including the new `Dockerfile`, `railway.toml`, `.dockerignore`)
2. Railway starts building immediately
3. Watch the build logs in the Railway dashboard

Or via CLI:

```powershell
cd colyseus-server
railway up
```

---

## 5. Configure Environment Variables

In the Railway dashboard, click on your service → **Variables** tab.

Add these environment variables:

| Variable                          | Value                                                     | Required           |
| --------------------------------- | --------------------------------------------------------- | ------------------ |
| `FIREBASE_SERVICE_ACCOUNT_BASE64` | _(the base64 string from step 2)_                         | **Yes**            |
| `FIREBASE_PROJECT_ID`             | `gamerapp-37e70`                                          | **Yes**            |
| `COLYSEUS_DEV_BYPASS`             | `0`                                                       | **Yes**            |
| `PORT`                            | _(Railway sets this automatically — do NOT set manually)_ | Auto               |
| `HOST`                            | `0.0.0.0`                                                 | Optional (default) |

### Why each variable matters:

- **`FIREBASE_SERVICE_ACCOUNT_BASE64`** — the server uses this to initialize `firebase-admin`, which is needed to verify player auth tokens and read/write Firestore session docs
- **`FIREBASE_PROJECT_ID`** — ensures the server talks to the correct Firebase project
- **`COLYSEUS_DEV_BYPASS=0`** — **critical** — forces real Firebase token verification. Without this, the server would auto-detect "no credentials" and skip auth (dev mode), which would be a security issue in production
- **`PORT`** — Railway injects this automatically. The server reads `process.env.PORT`. Do not override it.

### How to set via CLI:

```powershell
railway variables set FIREBASE_PROJECT_ID=gamerapp-37e70
railway variables set COLYSEUS_DEV_BYPASS=0
railway variables set FIREBASE_SERVICE_ACCOUNT_BASE64=eyJ0eXBlIjoic2Vydmlj...
```

After setting variables, Railway auto-redeploys.

---

## 6. Expose a Public Domain

Railway needs a public domain so your app can reach it.

### Generate Railway Domain

1. Click on your service in the Railway dashboard
2. Go to **Settings** → **Networking**
3. Click **"Generate Domain"**
4. Railway gives you something like: `colyseus-server-production-xxxx.up.railway.app`

### (Optional) Custom Domain

If you own a domain, you can add a custom one:

1. In **Settings** → **Networking**, click **"Custom Domain"**
2. Enter your domain (e.g., `colyseus.yourdomain.com`)
3. Railway shows you a CNAME record to add to your DNS
4. Add the CNAME record in your DNS provider
5. Wait for DNS propagation (usually 1–15 minutes)
6. Railway auto-provisions a TLS certificate

### Verify the Server is Running

Open your browser and visit:

```
https://colyseus-server-production-xxxx.up.railway.app/health
```

You should see:

```json
{
  "status": "ok",
  "framework": "v2",
  "devBypass": "0",
  "rooms": [
    { "gameId": "knockout_game", "roomName": "knockout_game" },
    { "gameId": "sketch_party_game", "roomName": "sketch_party" },
    { "gameId": "pong_game", "roomName": "pong_game" }
  ]
}
```

**Key checks:**

- `"devBypass": "0"` — confirms production auth is active
- All three rooms are listed
- The response comes over HTTPS (TLS is working)

### Your Colyseus URL

Your production Colyseus URL is:

```
wss://colyseus-server-production-xxxx.up.railway.app
```

Use `wss://` (not `https://`) — the Colyseus client uses WebSocket protocol. Railway's TLS termination handles the upgrade from `wss://` to plain `ws://` internally.

---

## 7. Update the Client App

Now point your app builds to the Railway server.

### Update `eas.json`

Open `eas.json` and replace the placeholder URL in both `preview` and `production`:

```json
{
  "preview": {
    "env": {
      "COLYSEUS_URL": "wss://colyseus-server-production-xxxx.up.railway.app"
    }
  },
  "production": {
    "env": {
      "COLYSEUS_URL": "wss://colyseus-server-production-xxxx.up.railway.app"
    }
  }
}
```

Replace `colyseus-server-production-xxxx.up.railway.app` with your actual Railway domain.

### How This Works

The flow is:

1. `eas.json` sets `COLYSEUS_URL` as a build-time environment variable
2. `app.config.ts` reads it: `colyseusUrl: process.env.COLYSEUS_URL ?? undefined`
3. The value gets baked into the app binary's `extra` config at build time
4. At runtime, `getColyseusUrl()` in `realtimeClient.ts` reads `Constants.expoConfig.extra.colyseusUrl`
5. The Colyseus client connects to `wss://your-railway-domain.up.railway.app`

### Alternative: Use EAS Secrets (recommended)

Instead of hardcoding the URL in `eas.json`, you can use EAS Secrets. This keeps the URL out of your git history:

```powershell
eas secret:create --name COLYSEUS_URL --value "wss://colyseus-server-production-xxxx.up.railway.app" --scope project
```

Then simplify `eas.json` — remove the `env` blocks, since EAS Secrets are automatically available as environment variables during builds:

```json
"preview": {
  "distribution": "internal",
  "ios": { "buildConfiguration": "Release" }
},
"production": {
  "autoIncrement": true,
  "ios": { "buildConfiguration": "Release" }
}
```

The `COLYSEUS_URL` secret will be injected automatically into all build profiles.

---

## 8. Rebuild and Test

### Build for TestFlight

```powershell
# Preview build (internal testing via TestFlight)
eas build --platform ios --profile preview

# Or production build
eas build --platform ios --profile production
```

### Submit to TestFlight

```powershell
eas submit --platform ios --profile production
```

Or use the build link from EAS to manually upload via Transporter.

### Local Development Still Works

Local dev builds continue to work unchanged:

- The Expo dev client has `hostUri`, so `getColyseusUrl()` auto-detects your LAN IP
- Your local Colyseus server runs on `localhost:2567`
- No `COLYSEUS_URL` env var is set for dev builds

---

## 9. Verify End-to-End

### Verification Checklist

| #   | Test                          | How to verify                                                             |
| --- | ----------------------------- | ------------------------------------------------------------------------- |
| 1   | **Health check**              | Visit `https://your-railway-domain/health` in a browser                   |
| 2   | **Dev bypass is OFF**         | Health response shows `"devBypass": "0"`                                  |
| 3   | **Local dev still works**     | Run `expo start`, play a realtime game locally                            |
| 4   | **TestFlight build connects** | Install via TestFlight, open a realtime game, check Railway logs          |
| 5   | **Cross-device lobby**        | Device A creates invite → Device B joins lobby                            |
| 6   | **Cross-device game start**   | Host starts game → both devices enter gameplay screen                     |
| 7   | **Colyseus room join**        | Both devices connect to Colyseus (check Railway logs for "Join verified") |
| 8   | **Gameplay works**            | Play a round of Sketch Party / Pong / Knockout across devices             |
| 9   | **Game resolution**           | Game ends → results appear → XP/PB/achievements update                    |
| 10  | **Different networks**        | Test with devices on different Wi-Fi networks (e.g., one on cellular)     |

### Reading Railway Logs

In the Railway dashboard, click your service → **Logs** tab. You'll see:

```
[Colyseus] Server listening on http://0.0.0.0:PORT
[Colyseus] Health check: http://0.0.0.0:PORT/health
[SessionGuard:sketch_party_game] Verifying join: uid=abc123, sessionId=xyz, hasToken=true
[SessionGuard:sketch_party_game] Token verified for uid=abc123
[SessionGuard:sketch_party_game] ✓ Join verified: uid=abc123, role=participant
```

If something fails, the logs will show exactly which step rejected the join.

---

## 10. Ongoing Operations

### Redeploying

Railway auto-deploys when you push to your connected Git branch. To manually trigger:

```powershell
cd colyseus-server
railway up
```

### Monitoring

- **Railway dashboard**: CPU, memory, network usage
- **Logs**: Real-time streaming, searchable
- **Health check**: Railway pings `/health` and auto-restarts if it fails

### Scaling

Railway's Hobby plan runs one instance. For production scale:

- Upgrade to Railway's Pro plan for more resources
- The server already binds to `0.0.0.0` and uses `PORT` from env — it's container-ready
- For horizontal scaling (multiple server instances), you'd need Colyseus's Redis presence driver (`@colyseus/redis-driver`), but single-instance is fine for most use cases

### Cost

Railway's Hobby plan includes $5/month of free usage. A Colyseus server for a small user base typically costs $5–15/month. Monitor usage in the Railway dashboard.

### Updating Environment Variables

If you need to rotate the Firebase service account key:

1. Generate a new key from Firebase Console
2. Base64-encode it
3. Update `FIREBASE_SERVICE_ACCOUNT_BASE64` in Railway dashboard
4. Railway auto-redeploys

---

## 11. Troubleshooting

### "Connection error" on TestFlight device

**Symptom**: Realtime game screen shows connection error or spins forever.

**Check**:

1. Open Railway logs — do you see any incoming connection attempt?
   - **No** → the client isn't reaching Railway. Check the `COLYSEUS_URL` in your build.
   - **Yes** → the connection reaches the server. Check for auth rejection in logs.

2. Verify the URL in the build:
   - In the app, the console log should show: `[Colyseus:config] Using explicit colyseusUrl: wss://...`
   - If it shows `Using fallback URL: http://localhost:2567` → the build doesn't have `COLYSEUS_URL` set

3. Rebuild the app after setting the URL:
   ```powershell
   eas build --platform ios --profile preview
   ```

### "Firebase token verification failed"

**Symptom**: Railway logs show `[SessionGuard] REJECTED — Firebase token verification failed`.

**Check**:

1. Is `FIREBASE_SERVICE_ACCOUNT_BASE64` set correctly?
2. Is it from the correct project (`gamerapp-37e70`)?
3. Is `COLYSEUS_DEV_BYPASS` set to `0`?
4. Is the user signed in on the device? Firebase ID tokens expire after 1 hour — the app refreshes them automatically via `getIdToken()`.

### "DEV BYPASS active" in production

**Symptom**: Health check shows `"devBypass": "auto"` or the logs show "DEV BYPASS active".

**Fix**: Set `COLYSEUS_DEV_BYPASS=0` in Railway environment variables. This forces production auth even if credential detection has issues.

### "Game session not found"

**Symptom**: Railway logs show `[SessionGuard] REJECTED — session doc not found`.

**Check**: The Cloud Function `startGameFromInviteV4` creates the session in Firestore. If the session doesn't exist:

1. Was the game actually started from the lobby?
2. Is the server using the correct `FIREBASE_PROJECT_ID`?
3. Check Firestore in the Firebase Console — does `GameSessionsV4/{sessionId}` exist?

### Build fails on Railway

**Symptom**: Railway build logs show TypeScript errors.

**Fix**:

1. Test the build locally first:
   ```powershell
   cd colyseus-server
   npm run build
   ```
2. If it builds locally but fails on Railway, check that all source files are committed to Git (Railway builds from Git, not your local filesystem)

### WebSocket doesn't upgrade

**Symptom**: HTTPS works (health check responds) but WebSocket connections fail.

This shouldn't happen with Railway — it supports WebSocket upgrades natively. But if it does:

1. Make sure you're using `wss://` in the client, not `https://`
2. Check Railway dashboard → Settings → ensure the service has a public domain

---

## 12. Architecture Summary

### Before (local dev only)

```
┌─────────────┐        ┌─────────────┐
│  Device A   │───LAN──│  Your Mac   │
│  (Expo Dev) │        │  Colyseus   │
└─────────────┘        │  :2567      │
                       └─────────────┘
┌─────────────┐             │
│  Device B   │───LAN───────┘
│  (Expo Dev) │
└─────────────┘

Works: Both devices on same Wi-Fi, same LAN IP
Fails: TestFlight device on different network → can't reach your Mac
```

### After (Railway production)

```
┌─────────────┐
│  Device A   │──── wss:// ────┐
│  (TestFlight│                │
└─────────────┘                ▼
                    ┌───────────────────┐
                    │    Railway        │
                    │  TLS termination  │
                    │    ┌───────────┐  │
                    │    │ Colyseus  │  │
                    │    │  Server   │  │
                    │    └───────────┘  │
                    └───────────────────┘
┌─────────────┐                ▲
│  Device B   │──── wss:// ────┘      ┌──────────────┐
│  (TestFlight│                       │   Firebase    │
└─────────────┘                       │  (Firestore,  │
                                      │   Auth, CF)   │
                                      └──────────────┘
                                           ▲
            Both devices and Railway ──────┘
            talk to the same Firebase project
```

### What Each Piece Owns

| Component              | Owns                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------- |
| **Railway (Colyseus)** | Live game state, room management, real-time messaging, physics, scoring, reconnection |
| **Firebase Auth**      | User identity and ID tokens (verified by Colyseus on room join)                       |
| **Firestore**          | Invites, lobbies, sessions, results, PBs, achievements, leaderboards                  |
| **Cloud Functions**    | Invite/lobby/session lifecycle, move validation (turn-based), resolution pipeline     |
| **Client App**         | UI, navigation, Colyseus WebSocket client, Firestore subscriptions                    |

---

## Quick Reference Card

### Railway Environment Variables

```
FIREBASE_SERVICE_ACCOUNT_BASE64 = <base64-encoded service account JSON>
FIREBASE_PROJECT_ID             = gamerapp-37e70
COLYSEUS_DEV_BYPASS             = 0
```

### Client Env (EAS Secret or eas.json)

```
COLYSEUS_URL = wss://<your-railway-domain>.up.railway.app
```

### Commands

```powershell
# Deploy to Railway
cd colyseus-server
railway up

# Check health
curl https://<your-railway-domain>.up.railway.app/health

# Build app for TestFlight
eas build --platform ios --profile preview

# Set EAS secret (alternative to eas.json env)
eas secret:create --name COLYSEUS_URL --value "wss://<your-railway-domain>.up.railway.app" --scope project

# View Railway logs
railway logs
```
