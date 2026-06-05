# Deployment & redirect URL checklist

When you change the public URL of GanttSmart (domain, IP, or dev vs production), several systems must agree on the same URLs. If any one is wrong, auth flows fail with errors like **Invalid redirect_uri**, **redirect URL not allowed**, or redirects to `localhost`.

Use this document as a single checklist. Current production example:

| Environment | Base URL |
|---|---|
| **Production** | `https://gantt.agencyrobotics.com` |
| **Local dev** | `http://localhost:5173` |

---

## Quick checklist

Copy this when changing domains. Replace `https://gantt.agencyrobotics.com` with your new URL.

- [ ] **`.env.deploy`** — `VITE_LINEAR_REDIRECT_URI`
- [ ] **`.env`** (local) — `VITE_LINEAR_REDIRECT_URI` if you still develop locally
- [ ] **Redeploy** — run `./deploy.sh` (Vite bakes `VITE_*` into the bundle at build time)
- [ ] **Supabase** → Authentication → URL Configuration → Site URL
- [ ] **Supabase** → Authentication → URL Configuration → Redirect URLs
- [ ] **Supabase** → Authentication → Providers → Google (enabled + Client ID/Secret)
- [ ] **Google Cloud Console** → OAuth client → Authorized redirect URIs (Supabase callback only)
- [ ] **Linear** → OAuth application → Redirect URIs
- [ ] **Supabase** → Edge Functions → `linear-oauth-callback` → secret `LINEAR_REDIRECT_URI`
- [ ] **Lightsail** → instance firewall → HTTP (80) and HTTPS (443) open
- [ ] **Host nginx** → `server_name` matches your domain (on the instance)
- [ ] **Certbot** — certificate covers your domain (re-run if domain changed)

---

## OAuth flows (what redirects where)

Understanding the two auth flows helps avoid mixing up URLs.

### Google sign-in (Supabase Auth)

```
User on your app
  → Google
  → Supabase (https://<project-ref>.supabase.co/auth/v1/callback)
  → back to your app (/app)
```

| Step | Who sets the URL | Value |
|---|---|---|
| Start sign-in | App (`useAuth.ts`) | `redirectTo: ${window.location.origin}/app` (dynamic) |
| Google → Supabase | **Google Cloud Console** | `https://<project-ref>.supabase.co/auth/v1/callback` |
| Supabase → your app | **Supabase URL Configuration** | Site URL + Redirect URLs must include your app origin |

The app does **not** configure Google’s redirect URI in code. That URI always points at **Supabase**, not your domain.

### Linear connect (OAuth + Edge Function)

```
User on your app
  → Linear authorize
  → your app (/callback)
  → Supabase Edge Function (linear-oauth-callback)
  → token saved, user sent to /app
```

| Step | Who sets the URL | Value |
|---|---|---|
| Start connect | App (`LinearConnect.tsx`) | `VITE_LINEAR_REDIRECT_URI` → `{origin}/callback` |
| Linear → your app | **Linear OAuth app** | Same as `VITE_LINEAR_REDIRECT_URI` (exact match) |
| Token exchange | **Edge Function secret** | `LINEAR_REDIRECT_URI` must match the URI used above |

---

## 1. Repo / build-time config

These values are inlined into the JavaScript bundle during `npm run build`. Changing them requires a **redeploy** (`./deploy.sh`); setting runtime env vars on the server does not update them.

| File | Variable | Production example | Local dev example |
|---|---|---|---|
| `.env.deploy` | `VITE_LINEAR_REDIRECT_URI` | `https://gantt.agencyrobotics.com/callback` | — |
| `.env` | `VITE_LINEAR_REDIRECT_URI` | — | `http://localhost:5173/callback` |
| `.env.deploy` | `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` | same |
| `.env.deploy` | `VITE_SUPABASE_ANON_KEY` | Supabase anon/publishable key | same |
| `.env.deploy` | `VITE_LINEAR_CLIENT_ID` | Linear OAuth client ID | same |

Templates: `.env.example` (dev), `.env.deploy.example` (production).

**Code references (dynamic — no file edit, but Supabase must allow the origin):**

| File | Behavior |
|---|---|
| `src/hooks/useAuth.ts` | Google OAuth `redirectTo`: `` `${window.location.origin}/app` `` |
| `src/components/ShareDialog.tsx` | Share links: `` `${window.location.origin}/share/...` `` |

---

## 2. Supabase Dashboard

Project: [Supabase Dashboard](https://supabase.com/dashboard) → your project.

### Authentication → URL Configuration

| Setting | Production | Local dev (keep both if you develop locally) |
|---|---|---|
| **Site URL** | `https://gantt.agencyrobotics.com` | — |
| **Redirect URLs** | `https://gantt.agencyrobotics.com/**` | `http://localhost:5173/**` |

`/**` allows paths like `/app` (Google return) and any other route Supabase may redirect to.

If Site URL is still `http://localhost:3000` or similar, users will be sent back to localhost after Google sign-in.

### Authentication → Providers → Google

- Enable **Sign in with Google**
- Set **Client ID** and **Client Secret** from Google Cloud (see section 3)
- Supabase shows the callback URL to use in Google Cloud (see below)

### Edge Functions → Secrets (`linear-oauth-callback`)

Set in Dashboard → Edge Functions → `linear-oauth-callback` → Secrets (or via Supabase CLI).

| Secret | Production example | Notes |
|---|---|---|
| `LINEAR_CLIENT_ID` | Same as `VITE_LINEAR_CLIENT_ID` | |
| `LINEAR_CLIENT_SECRET` | From Linear OAuth app | Never in frontend |
| `LINEAR_REDIRECT_URI` | `https://gantt.agencyrobotics.com/callback` | Must match `VITE_LINEAR_REDIRECT_URI` |

The edge function also allows these redirect URIs in code (for local dev):

- `http://localhost:5173/callback`
- `http://localhost:3000/callback`

See `supabase/functions/linear-oauth-callback/index.ts`. Add a new dev port there if needed.

---

## 3. Google Cloud Console

[Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials → your OAuth 2.0 Web client.

### Authorized redirect URIs

Add **only** the Supabase auth callback (from Supabase → Providers → Google):

```
https://<project-ref>.supabase.co/auth/v1/callback
```

Example:

```
https://qgyolulbggqzwrihpckk.supabase.co/auth/v1/callback
```

Do **not** put `https://gantt.agencyrobotics.com/...` here. Google redirects to Supabase; Supabase redirects to your app.

### OAuth consent screen

- **User type:** External (unless you use Google Workspace and want internal-only)
- **Authorized domains:** your app domain (e.g. `agencyrobotics.com`) may be required for branding; the redirect URI above is still the Supabase URL

---

## 4. Linear OAuth application

[Linear → Settings → API → OAuth applications](https://linear.app/settings/api/applications)

Open the app whose **Client ID** matches `VITE_LINEAR_CLIENT_ID`.

### Redirect URIs

Must match **exactly** (scheme, host, path, no trailing slash):

| Environment | Redirect URI |
|---|---|
| Production | `https://gantt.agencyrobotics.com/callback` |
| Local dev | `http://localhost:5173/callback` |

Typical error if missing: **Invalid redirect_uri parameter for the application.**

---

## 5. Lightsail / server (HTTPS)

These are not OAuth redirects but must match your domain for the app to load over HTTPS.

| Location | What to set |
|---|---|
| **DNS** | A record: `gantt` → instance public IP |
| **Lightsail firewall** | TCP 80 (HTTP), 443 (HTTPS) |
| **Host nginx** | `server_name gantt.agencyrobotics.com;` → `proxy_pass http://127.0.0.1:8080` |
| **Docker** | Container published on `8080:80` (see `deploy.sh`) |
| **Certbot** | `sudo certbot --nginx -d gantt.agencyrobotics.com` |

---

## 6. After any URL change

1. Update every row in the [Quick checklist](#quick-checklist).
2. From your Mac: `./deploy.sh`
3. Hard-refresh the browser (`Cmd+Shift+R`).
4. Test in order:
   - Load `https://gantt.agencyrobotics.com`
   - **Continue with Google** → should land on `/app`
   - **Connect Linear Account** → Linear → `/callback` → main app

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Redirect to `localhost` after Google | Supabase Site URL still localhost | Update Site URL + Redirect URLs in Supabase |
| `Unsupported provider: provider is not enabled` | Google provider off in Supabase | Enable Google under Authentication → Providers |
| `Invalid redirect_uri` on Linear | URI not in Linear OAuth app | Add exact `VITE_LINEAR_REDIRECT_URI` to Linear |
| `Edge Function returned a non-2xx status code` on `/callback` | Edge function secrets missing/wrong (especially `LINEAR_REDIRECT_URI`) | Set all secrets on `linear-oauth-callback`; redeploy app after fixing |
| `Linear token exchange failed` in error detail | `LINEAR_REDIRECT_URI` secret does not match what Linear authorized | Secret must be exactly `https://gantt.agencyrobotics.com/callback` |
| Linear connect works but token save fails | `LINEAR_REDIRECT_URI` secret wrong | Match Supabase edge function secret to app callback |
| Connect button does nothing on HTTP | `crypto.randomUUID` needs HTTPS | Use HTTPS (or localhost for dev); see `LinearConnect.tsx` |
| Old callback URL after deploy | Bundle not rebuilt | Confirm `.env.deploy` and run `./deploy.sh` |

---

## Related files

| Path | Role |
|---|---|
| `deploy.sh` | Builds with `.env.deploy` and runs container on `:8080` |
| `.env.deploy.example` | Production env template |
| `.env.example` | Local dev env template |
| `src/hooks/useAuth.ts` | Google `redirectTo` |
| `src/components/LinearConnect.tsx` | Starts Linear OAuth |
| `src/pages/Callback.tsx` | Linear OAuth return handler |
| `supabase/functions/linear-oauth-callback/index.ts` | Token exchange + redirect URI allowlist |
