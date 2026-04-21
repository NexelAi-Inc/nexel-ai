# Nexel Ai

Nexel Ai is the public company website for the Nexel product. It is a React + Vite frontend designed for Netlify hosting.

The signed-in GPT workspace is hosted separately as Nexel Chat:

https://nexelchat.netlify.app/

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
VITE_NEXEL_CHAT_URL=https://nexelchat.netlify.app/
```

Set `VITE_NEXEL_CHAT_URL` to your deployed Nexel Chat workspace URL. The company site's `Log in`, `Try Nexel Chat`, and workspace links use that value.
