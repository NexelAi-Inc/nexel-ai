# Nexa VS Code Extension

## Features

- Ask AI from command palette
- Edit current selection with AI
- Explain current file
- Sidebar chat panel

## Prerequisites

Run Nexa backend first from repo root:

```powershell
.\run_api.ps1
```

## Build + install locally

```powershell
npm install
npm run build
npm run package
code --install-extension .\nexa-vscode-0.1.2.vsix
```
