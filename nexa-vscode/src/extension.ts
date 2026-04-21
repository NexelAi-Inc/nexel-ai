import * as vscode from "vscode";

async function postJson<T>(path: string, payload: unknown): Promise<T> {
  const baseUrl = vscode.workspace.getConfiguration("nexa").get<string>("apiBaseUrl", "http://127.0.0.1:8000");
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API ${path} failed (${response.status}): ${text}`);
  }

  return (await response.json()) as T;
}

function getChatMode(): string {
  return vscode.workspace.getConfiguration("nexa").get<string>("mode", "auto");
}

function getCurrentFileContext(): string {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return "No additional editor context provided. The user may be asking a general question.";
  }

  const doc = editor.document;
  const text = doc.getText();
  return `File: ${doc.fileName}\n\n${text.slice(0, 12000)}`;
}

class NexaChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "nexa.chatView";

  constructor(private readonly extensionUri: vscode.Uri) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = this.getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (message: { type?: string; prompt?: string }) => {
      if (message.type !== "ask") {
        return;
      }

      try {
        const result = await postJson<{ response: string }>("/generate", {
          prompt: `${message.prompt ?? ""}\n\nContext:\n${getCurrentFileContext()}`,
          mode: getChatMode(),
          conversation_id: "vscode-chat"
        });
        webviewView.webview.postMessage({ type: "response", text: result.response });
      } catch (error) {
        const text = error instanceof Error ? error.message : String(error);
        webviewView.webview.postMessage({ type: "response", text: `Error: ${text}` });
      }
    });
  }

  private getHtml(webview: vscode.Webview): string {
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

export function activate(context: vscode.ExtensionContext): void {
  const askCommand = vscode.commands.registerCommand("nexa.askAI", async () => {
    const prompt = await vscode.window.showInputBox({
      title: "Ask Nexa",
      prompt: "Ask about the current file or task"
    });

    if (!prompt) {
      return;
    }

    try {
      const result = await postJson<{ response: string }>("/generate", {
        prompt: `${prompt}\n\nContext:\n${getCurrentFileContext()}`,
        mode: getChatMode(),
        conversation_id: "vscode-command"
      });
      await vscode.window.showInformationMessage("Nexa replied. See output channel.");
      const output = vscode.window.createOutputChannel("Nexa AI");
      output.show(true);
      output.appendLine(`> ${prompt}`);
      output.appendLine(result.response);
    } catch (error) {
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
      const result = await postJson<{ edited: string }>("/edit", {
        instruction,
        code: selectedText
      });

      await editor.edit((editBuilder: vscode.TextEditorEdit) => {
        editBuilder.replace(selection, result.edited);
      });
      vscode.window.showInformationMessage("Selection updated by Nexa.");
    } catch (error) {
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
      const result = await postJson<{ explanation: string }>("/explain", {
        file_path: editor.document.fileName
      });

      const doc = await vscode.workspace.openTextDocument({
        language: "markdown",
        content: `# Nexa Explanation\n\n${result.explanation}`
      });
      await vscode.window.showTextDocument(doc, { preview: false });
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(text);
    }
  });

  const provider = new NexaChatViewProvider(context.extensionUri);
  const chatView = vscode.window.registerWebviewViewProvider(NexaChatViewProvider.viewType, provider);

  context.subscriptions.push(askCommand, editSelectionCommand, explainFileCommand, chatView);
}

export function deactivate(): void {}
