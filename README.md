# Nexel Ai

Nexel Ai is the public company website for the Nexel product. It is a React + Vite frontend designed for Netlify hosting.

The signed-in GPT workspace is not in this repo. It lives in the separate Nexel Chat repo:

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
VITE_NEXEL_CHAT_URL=https://your-nexel-chat-site.example.com
```

If `VITE_NEXEL_CHAT_URL` is blank, the company site links to the Nexel Chat GitHub repo.
