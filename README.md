# Nexel Ai

Nexel Ai is the public website for the Nexel product. It is a React + Vite frontend designed for Netlify hosting.

The signed-in workspace is branded as Nexel Chat and should connect to the separate API/backend repo:

https://github.com/NexelAi-Inc/Nexel-Chat

## Local development

```powershell
cd web
npm install
npm run dev
```

## Production build

```powershell
cd web
npm run build
```

## Netlify

This repo includes root `netlify.toml` for Netlify.

Use:

```text
Build command: cd web && npm install && npm run build
Publish directory: web/dist
```

Set these environment variables in Netlify:

```text
VITE_API_BASE_URL=https://your-nexel-chat-api-host.example.com
VITE_FIREBASE_DATABASE_URL=https://nexel-ai-default-rtdb.firebaseio.com
```

If `VITE_API_BASE_URL` is blank, the app will call same-origin API routes, which only works when the frontend and API are hosted together.
