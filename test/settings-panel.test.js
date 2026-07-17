const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

test('registers the Codex toolbar command and renders the volume panel', async () => {
  const commands = new Map();
  let createdPanel;
  const disposable = { dispose() {} };
  const statusBar = {
    hide() {},
    show() {},
    dispose() {},
    text: '',
    tooltip: '',
    command: ''
  };
  const output = { appendLine() {}, dispose() {} };
  const vscodeMock = {
    ConfigurationTarget: { Global: 1, Workspace: 2 },
    StatusBarAlignment: { Right: 2 },
    ViewColumn: { Active: -1 },
    Uri: {
      joinPath(base, ...parts) {
        return { fsPath: [base.fsPath, ...parts].join('\\') };
      }
    },
    commands: {
      registerCommand(id, callback) {
        commands.set(id, callback);
        return disposable;
      },
      executeCommand() {
        return Promise.resolve();
      }
    },
    window: {
      state: { focused: true },
      createOutputChannel() { return output; },
      createStatusBarItem() { return statusBar; },
      createWebviewPanel(viewType, title, column, options) {
        const webview = {
          html: '',
          onDidReceiveMessage() { return disposable; },
          postMessage() { return Promise.resolve(true); }
        };
        createdPanel = {
          viewType,
          title,
          column,
          options,
          webview,
          onDidDispose() { return disposable; },
          reveal() {}
        };
        return createdPanel;
      },
      onDidStartTerminalShellExecution() { return disposable; },
      onDidEndTerminalShellExecution() { return disposable; },
      onDidChangeActiveTextEditor() { return disposable; },
      onDidChangeTextEditorSelection() { return disposable; },
      onDidChangeTextEditorVisibleRanges() { return disposable; },
      onDidChangeActiveTerminal() { return disposable; },
      showInformationMessage() { return Promise.resolve(); },
      showErrorMessage() { return Promise.resolve(); }
    },
    workspace: {
      workspaceFolders: undefined,
      getConfiguration() {
        return {
          get(key, fallback) { return key === 'enabled' ? false : fallback; },
          update() { return Promise.resolve(); }
        };
      },
      onDidChangeTextDocument() { return disposable; },
      onDidChangeConfiguration() { return disposable; }
    }
  };

  const originalLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request === 'vscode') {
      return vscodeMock;
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    const extensionPath = require.resolve('../dist/extension.js');
    delete require.cache[extensionPath];
    const extension = require(extensionPath);
    extension.activate({
      extensionUri: { fsPath: 'C:\\extension' },
      logUri: { fsPath: 'C:\\logs\\window\\exthost' },
      subscriptions: []
    });

    const openPanel = commands.get('codexFinishNotifier.openSettingsPanel');
    assert.equal(typeof openPanel, 'function');
    await openPanel();
    assert.equal(createdPanel.viewType, 'codexFinishNotifier.settingsPanel');
    assert.match(createdPanel.webview.html, /type="range"/);
    assert.match(createdPanel.webview.html, /Choose audio/);
    assert.match(createdPanel.webview.html, /All settings/);

    const manifest = require('../package.json');
    assert.equal(manifest.contributes.menus['editor/title'][0].when, 'resourceScheme == openai-codex');
    assert.match(manifest.contributes.menus['view/title'][0].when, /chatgpt\.sidebarView/);
  } finally {
    Module._load = originalLoad;
  }
});
