"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
async function postJson(path, payload) {
    const baseUrl = vscode.workspace.getConfiguration("nexa").get("apiBaseUrl", "http://127.0.0.1:8000");
    const response = await fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`API ${path} failed (${response.status}): ${text}`);
    }
    return (await response.json());
}
function getChatMode() {
    return vscode.workspace.getConfiguration("nexa").get("mode", "auto");
}
function getCurrentFileContext() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return "No additional editor context provided. The user may be asking a general question.";
    }
    const doc = editor.document;
    const text = doc.getText();
    return `File: ${doc.fileName}\n\n${text.slice(0, 12000)}`;
}
class NexaChatViewProvider {
    constructor(extensionUri) {
        this.extensionUri = extensionUri;
    }
    resolveWebviewView(webviewView) {
        webviewView.webview.options = { enableScripts: true };
        webviewView.webview.html = this.getHtml(webviewView.webview);
        webviewView.webview.onDidReceiveMessage(async (message) => {
            if (message.type !== "ask") {
                return;
            }
            try {
                const result = await postJson("/generate", {
                    prompt: `${message.prompt ?? ""}\n\nContext:\n${getCurrentFileContext()}`,
                    mode: getChatMode(),
                    conversation_id: "vscode-chat"
                });
                webviewView.webview.postMessage({ type: "response", text: result.response });
            }
            catch (error) {
                const text = error instanceof Error ? error.message : String(error);
                webviewView.webview.postMessage({ type: "response", text: `Error: ${text}` });
            }
        });
    }
    getHtml(webview) {
        const nonce = Date.now().toString();
        const csp = `default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';`;
        return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="${csp}" />
    <style>
      body { font-family: var(--vscode-font-family); padding: 8px; }
      textarea { width: 100%; height: 90px; margin-bottom: 8px; }
      button { width: 100%; padding: 8px; }
      pre { white-space: pre-wrap; margin-top: 10px; background: var(--vscode-editor-background); padding: 8px; border-radius: 6px; }
    </style>
  </head>
  <body>
    <textarea id="prompt" placeholder="Ask about your code..."></textarea>
    <button id="ask">Ask Nexa</button>
    <pre id="out">Ready.</pre>
    <script nonce="${nonce}">
      const vscode = acquireVsCodeApi();
      const askBtn = document.getElementById('ask');
      const promptInput = document.getElementById('prompt');
      const out = document.getElementById('out');

      askBtn.addEventListener('click', () => {
        const prompt = promptInput.value.trim();
        if (!prompt) return;
        out.textContent = 'Thinking...';
        vscode.postMessage({ type: 'ask', prompt });
      });

      window.addEventListener('message', (event) => {
        const msg = event.data;
        if (msg.type === 'response') {
          out.textContent = msg.text;
        }
      });
    </script>
  </body>
</html>`;
    }
}
NexaChatViewProvider.viewType = "nexa.chatView";
function activate(context) {
    const askCommand = vscode.commands.registerCommand("nexa.askAI", async () => {
        const prompt = await vscode.window.showInputBox({
            title: "Ask Nexa",
            prompt: "Ask about the current file or task"
        });
        if (!prompt) {
            return;
        }
        try {
            const result = await postJson("/generate", {
                prompt: `${prompt}\n\nContext:\n${getCurrentFileContext()}`,
                mode: getChatMode(),
                conversation_id: "vscode-command"
            });
            await vscode.window.showInformationMessage("Nexa replied. See output channel.");
            const output = vscode.window.createOutputChannel("Nexa AI");
            output.show(true);
            output.appendLine(`> ${prompt}`);
            output.appendLine(result.response);
        }
        catch (error) {
            const text = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(text);
        }
    });
    const editSelectionCommand = vscode.commands.registerCommand("nexa.editSelection", async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage("Open a file and select code first.");
            return;
        }
        const selection = editor.selection;
        const selectedText = editor.document.getText(selection);
        if (!selectedText.trim()) {
            vscode.window.showWarningMessage("Select some code first.");
            return;
        }
        const instruction = await vscode.window.showInputBox({
            title: "Nexa Edit Selection",
            prompt: "How should the selected code be changed?"
        });
        if (!instruction) {
            return;
        }
        try {
            const result = await postJson("/edit", {
                instruction,
                code: selectedText
            });
            await editor.edit((editBuilder) => {
                editBuilder.replace(selection, result.edited);
            });
            vscode.window.showInformationMessage("Selection updated by Nexa.");
        }
        catch (error) {
            const text = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(text);
        }
    });
    const explainFileCommand = vscode.commands.registerCommand("nexa.explainFile", async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage("No active file.");
            return;
        }
        try {
            const result = await postJson("/explain", {
                file_path: editor.document.fileName
            });
            const doc = await vscode.workspace.openTextDocument({
                language: "markdown",
                content: `# Nexa Explanation\n\n${result.explanation}`
            });
            await vscode.window.showTextDocument(doc, { preview: false });
        }
        catch (error) {
            const text = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(text);
        }
    });
    const provider = new NexaChatViewProvider(context.extensionUri);
    const chatView = vscode.window.registerWebviewViewProvider(NexaChatViewProvider.viewType, provider);
    context.subscriptions.push(askCommand, editSelectionCommand, explainFileCommand, chatView);
}
function deactivate() { }
//# sourceMappingURL=extension.js.map