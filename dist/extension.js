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
const node_child_process_1 = require("node:child_process");
const configSection = 'codexFinishNotifier';
let statusBar;
let output;
let activeExecutions = new WeakSet();
let extensionUri;
let flashTimer;
let maxFlashTimer;
let inputWatcher;
let isPulseOn = false;
let alertActive = false;
let ignoreInteractionUntil = 0;
let workbenchRestore;
let pulseGeneration = 0;
let workbenchUpdateQueue = Promise.resolve();
let pulseStep = 0;
const stopHookFileNotifications = new Map();
function activate(context) {
    extensionUri = context.extensionUri;
    output = vscode.window.createOutputChannel('Codex Finish Notifier');
    statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 90);
    statusBar.command = 'codexFinishNotifier.dismissAlert';
    statusBar.tooltip = 'Codex Finish Notifier';
    context.subscriptions.push(output, statusBar);
    context.subscriptions.push(vscode.commands.registerCommand('codexFinishNotifier.notifyDone', () => notifyDone('manual command')), vscode.commands.registerCommand('codexFinishNotifier.testAlert', () => notifyDone('test command')), vscode.commands.registerCommand('codexFinishNotifier.dismissAlert', () => stopAlert()), vscode.commands.registerCommand('codexFinishNotifier.markStarted', () => markStarted('manual command')), vscode.commands.registerCommand('type', onTypeCommand), vscode.window.registerUriHandler({ handleUri }), registerStopHookFileWatcher(), vscode.window.onDidStartTerminalShellExecution(onTerminalExecutionStarted), vscode.window.onDidEndTerminalShellExecution(onTerminalExecutionEnded), vscode.window.onDidChangeActiveTextEditor(() => dismissOnInteraction('active editor changed')), vscode.window.onDidChangeTextEditorSelection(onTextEditorSelectionChanged), vscode.window.onDidChangeTextEditorVisibleRanges(() => dismissOnInteraction('editor scrolled')), vscode.window.onDidChangeActiveTerminal(() => dismissOnInteraction('active terminal changed')), vscode.workspace.onDidChangeTextDocument(onTextDocumentChanged), vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration(configSection)) {
            refreshStatus();
            if (alertActive) {
                restartFlash();
            }
        }
    }), { dispose: stopAlert });
    refreshStatus();
    output.appendLine('Codex Finish Notifier activated.');
}
function registerStopHookFileWatcher() {
    const watcher = vscode.workspace.createFileSystemWatcher('**/.codex/last-notify.log', false, false, true);
    const subscriptions = [
        watcher,
        watcher.onDidCreate(onStopHookFileChanged),
        watcher.onDidChange(onStopHookFileChanged)
    ];
    return vscode.Disposable.from(...subscriptions);
}
function onStopHookFileChanged(uri) {
    const key = uri.toString();
    const now = Date.now();
    const previous = stopHookFileNotifications.get(key) ?? 0;
    if (now - previous < 1000) {
        return;
    }
    stopHookFileNotifications.set(key, now);
    void notifyDone(`Codex Stop hook file: ${vscode.workspace.asRelativePath(uri, false)}`);
}
function handleUri(uri) {
    const normalizedPath = uri.path.replace(/^\/+/, '').toLowerCase();
    if (uri.authority.toLowerCase() === 'done' || normalizedPath === 'done') {
        void notifyDone('Codex Stop hook');
    }
}
function deactivate() {
    stopAlert();
}
function getConfig() {
    const cfg = vscode.workspace.getConfiguration(configSection);
    return {
        enabled: cfg.get('enabled', true),
        playSound: cfg.get('playSound', true),
        flashMode: cfg.get('flashMode', 'workbenchColors'),
        stopOnInteraction: cfg.get('stopOnInteraction', true),
        flashIntervalMs: clamp(cfg.get('flashIntervalMs', 900), 500, 3000),
        maxFlashSeconds: clamp(cfg.get('maxFlashSeconds', 0), 0, 600),
        terminalCommandPattern: cfg.get('terminalCommandPattern', '(^|\\b)(codex|npx\\s+codex|pnpm\\s+codex|npm\\s+exec\\s+codex)(\\b|\\s)'),
        detectTerminalCodex: cfg.get('detectTerminalCodex', true),
        notifyWhenWindowFocused: cfg.get('notifyWhenWindowFocused', true),
        taskbarFlash: cfg.get('taskbarFlash', true),
        workbenchColorTarget: cfg.get('workbenchColorTarget', 'workspace')
    };
}
function onTypeCommand(args) {
    dismissOnInteraction('keyboard input');
    return vscode.commands.executeCommand('default:type', args);
}
function clamp(value, min, max) {
    if (!Number.isFinite(value)) {
        return min;
    }
    return Math.min(Math.max(value, min), max);
}
function onTerminalExecutionStarted(event) {
    dismissOnInteraction('terminal command started');
    const cfg = getConfig();
    if (!cfg.enabled || !cfg.detectTerminalCodex) {
        return;
    }
    const commandLine = event.execution.commandLine.value;
    if (matchesCodexCommand(commandLine, cfg.terminalCommandPattern)) {
        activeExecutions.add(event.execution);
        markStarted(`terminal: ${commandLine}`);
    }
}
function onTerminalExecutionEnded(event) {
    const cfg = getConfig();
    if (!cfg.enabled || !cfg.detectTerminalCodex) {
        return;
    }
    const commandLine = event.execution.commandLine.value;
    const startedAsCodex = activeExecutions.has(event.execution);
    const endedAsCodex = matchesCodexCommand(commandLine, cfg.terminalCommandPattern);
    if (startedAsCodex || endedAsCodex) {
        notifyDone(`terminal exit ${event.exitCode ?? 'unknown'}: ${commandLine}`);
    }
}
function onTextEditorSelectionChanged(event) {
    dismissOnInteraction(event.kind === undefined ? 'editor selection changed' : 'mouse or keyboard selection');
}
function onTextDocumentChanged(event) {
    if (!isSettingsDocument(event.document)) {
        dismissOnInteraction('document changed');
    }
}
function isSettingsDocument(document) {
    return /(?:^|[\\/])(?:settings|tasks|launch)\.json$/i.test(document.uri.fsPath);
}
function matchesCodexCommand(commandLine, pattern) {
    try {
        return new RegExp(pattern, 'i').test(commandLine);
    }
    catch (error) {
        output.appendLine(`Invalid terminalCommandPattern: ${String(error)}`);
        return /\bcodex\b/i.test(commandLine);
    }
}
function markStarted(source) {
    const cfg = getConfig();
    if (!cfg.enabled) {
        return;
    }
    stopAlert();
    statusBar.text = '$(sync~spin) Codex working';
    statusBar.tooltip = `Codex work detected from ${source}. Run "Codex Notifier: Notify Codex Done" if this was started manually.`;
    statusBar.show();
    output.appendLine(`Codex work started from ${source}.`);
}
async function notifyDone(source) {
    const cfg = getConfig();
    if (!cfg.enabled) {
        return;
    }
    output.appendLine(`Codex completion detected from ${source}.`);
    ignoreInteractionUntil = Date.now() + 350;
    setAlertStatusFrame(0);
    statusBar.tooltip = 'Codex work finished. Click to dismiss the alert.';
    statusBar.show();
    if (cfg.playSound) {
        playGentleSound();
    }
    if (cfg.taskbarFlash) {
        flashTaskbar(true);
    }
    startFlash();
    if (cfg.notifyWhenWindowFocused || !vscode.window.state.focused) {
        void vscode.window
            .showInformationMessage('Codex finished working.', 'Dismiss')
            .then((choice) => {
            if (choice === 'Dismiss') {
                stopAlert();
            }
        });
    }
}
function playGentleSound() {
    try {
        const soundPath = vscode.Uri.joinPath(extensionUri, 'media', 'notification.mp3').fsPath;
        const quotedSoundPath = toPowerShellSingleQuotedString(soundPath);
        if (process.platform === 'win32') {
            spawnSound('powershell.exe', [
                '-Sta',
                '-NoProfile',
                '-NonInteractive',
                '-ExecutionPolicy',
                'Bypass',
                '-WindowStyle',
                'Hidden',
                '-Command',
                `
$SoundPath = ${quotedSoundPath}
Add-Type -AssemblyName PresentationCore
$player = New-Object System.Windows.Media.MediaPlayer
$player.Open([Uri]$SoundPath)
$player.Volume = 0.75
$player.Play()
Start-Sleep -Milliseconds 1800
$player.Close()
`
            ]);
            return;
        }
        if (process.platform === 'darwin') {
            spawnSound('afplay', [soundPath]);
            return;
        }
        const player = spawnSound('mpg123', ['-q', soundPath]);
        player.on('error', () => {
            spawnSound('ffplay', ['-nodisp', '-autoexit', '-loglevel', 'quiet', soundPath]);
        });
    }
    catch (error) {
        output.appendLine(`Unable to play completion sound: ${String(error)}`);
    }
}
function spawnSound(command, args) {
    const child = (0, node_child_process_1.spawn)(command, args, { windowsHide: true, stdio: 'ignore' });
    child.on('error', (error) => output.appendLine(`Unable to run sound command "${command}": ${String(error)}`));
    return child;
}
function toPowerShellSingleQuotedString(value) {
    return `'${value.replace(/'/g, "''")}'`;
}
function flashTaskbar(enable) {
    if (process.platform !== 'win32') {
        return;
    }
    const workspaceName = getWorkspaceWindowHint();
    const script = `
param([string]$WorkspaceName, [string]$Mode)
Add-Type @"
using System;
using System.Runtime.InteropServices;

public static class CodexNotifierTaskbar {
  [StructLayout(LayoutKind.Sequential)]
  public struct FLASHWINFO {
    public UInt32 cbSize;
    public IntPtr hwnd;
    public UInt32 dwFlags;
    public UInt32 uCount;
    public UInt32 dwTimeout;
  }

  [DllImport("user32.dll")]
  private static extern bool FlashWindowEx(ref FLASHWINFO pwfi);

  public const UInt32 FLASHW_STOP = 0x00000000;
  public const UInt32 FLASHW_TRAY = 0x00000002;
  public const UInt32 FLASHW_TIMER = 0x00000004;

  public static bool Flash(IntPtr handle, UInt32 flags) {
    FLASHWINFO info = new FLASHWINFO();
    info.cbSize = Convert.ToUInt32(Marshal.SizeOf(typeof(FLASHWINFO)));
    info.hwnd = handle;
    info.dwFlags = flags;
    info.uCount = 0;
    info.dwTimeout = 0;
    return FlashWindowEx(ref info);
  }
}
"@

$windows = Get-Process Code -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 }
if ($WorkspaceName) {
  $escapedWorkspaceName = [WildcardPattern]::Escape($WorkspaceName)
  $matches = $windows | Where-Object { $_.MainWindowTitle -like "*$escapedWorkspaceName*" }
  if ($matches) {
    $windows = $matches
  }
}

$flags = if ($Mode -eq "start") {
  [CodexNotifierTaskbar]::FLASHW_TRAY -bor [CodexNotifierTaskbar]::FLASHW_TIMER
} else {
  [CodexNotifierTaskbar]::FLASHW_STOP
}

foreach ($window in $windows) {
  [CodexNotifierTaskbar]::Flash($window.MainWindowHandle, $flags) | Out-Null
}
`;
    const child = (0, node_child_process_1.spawn)('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-WindowStyle',
        'Hidden',
        '-Command',
        script,
        workspaceName,
        enable ? 'start' : 'stop'
    ], { windowsHide: true, stdio: 'ignore' });
    child.on('error', (error) => output.appendLine(`Unable to ${enable ? 'flash' : 'stop flashing'} taskbar: ${String(error)}`));
}
function getWorkspaceWindowHint() {
    return vscode.workspace.workspaceFolders?.[0]?.name ?? '';
}
function startFlash() {
    stopFlashOnly();
    const cfg = getConfig();
    const generation = ++pulseGeneration;
    if (cfg.maxFlashSeconds > 1) {
        maxFlashTimer = setTimeout(() => stopAlert(), cfg.maxFlashSeconds * 1000);
    }
    alertActive = true;
    startInputWatcher(generation);
    if (cfg.flashMode === 'off') {
        return;
    }
    isPulseOn = false;
    pulseStep = 0;
    flashTimer = setInterval(() => {
        if (generation !== pulseGeneration || !alertActive) {
            return;
        }
        pulseStep = (pulseStep + 1) % statusPulse.length;
        isPulseOn = statusPulse[pulseStep].status > 0;
        setAlertStatusFrame(pulseStep);
        applyPulse(statusPulse[pulseStep], generation);
    }, cfg.flashIntervalMs);
    setAlertStatusFrame(pulseStep);
    applyPulse(statusPulse[pulseStep], generation);
}
function startInputWatcher(generation) {
    if (process.platform !== 'win32') {
        return;
    }
    stopInputWatcher();
    const script = `
$IgnoreMs = 250
Add-Type @"
using System;
using System.Runtime.InteropServices;

public static class CodexNotifierInput {
  [StructLayout(LayoutKind.Sequential)]
  public struct LASTINPUTINFO {
    public UInt32 cbSize;
    public UInt32 dwTime;
  }

  [DllImport("user32.dll")]
  private static extern bool GetLastInputInfo(ref LASTINPUTINFO info);

  public static UInt32 GetLastInputTick() {
    LASTINPUTINFO info = new LASTINPUTINFO();
    info.cbSize = Convert.ToUInt32(Marshal.SizeOf(typeof(LASTINPUTINFO)));
    if (!GetLastInputInfo(ref info)) {
      return 0;
    }
    return info.dwTime;
  }
}
"@

$baseline = [CodexNotifierInput]::GetLastInputTick()
Start-Sleep -Milliseconds $IgnoreMs
while ($true) {
  Start-Sleep -Milliseconds 120
  $latest = [CodexNotifierInput]::GetLastInputTick()
  if ($latest -ne 0 -and $baseline -ne 0 -and $latest -ne $baseline) {
    exit 7
  }
}
`;
    inputWatcher = (0, node_child_process_1.spawn)('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-WindowStyle',
        'Hidden',
        '-Command',
        script
    ], { windowsHide: true, stdio: 'ignore' });
    inputWatcher.on('exit', (code) => {
        inputWatcher = undefined;
        if (code === 7 && generation === pulseGeneration && alertActive) {
            output.appendLine('Completion alert dismissed by Windows keyboard or mouse input.');
            stopAlert();
        }
    });
    inputWatcher.on('error', (error) => output.appendLine(`Unable to start input watcher: ${String(error)}`));
}
function stopInputWatcher() {
    if (!inputWatcher) {
        return;
    }
    const watcher = inputWatcher;
    inputWatcher = undefined;
    watcher.kill();
}
function restartFlash() {
    if (!alertActive) {
        return;
    }
    stopFlashOnly();
    startFlash();
}
const statusPulse = [
    { label: ' >>> CODEX DONE <<< ', status: 1.00 },
    { label: '                    ', status: 0.00 },
    { label: '  >> CODEX DONE <<  ', status: 1.00 },
    { label: '                    ', status: 0.00 },
    { label: '   > CODEX DONE <   ', status: 1.00 },
    { label: '                    ', status: 0.00 },
    { label: '  << CODEX DONE >>  ', status: 1.00 },
    { label: '                    ', status: 0.00 }
];
function setAlertStatusFrame(frame) {
    statusBar.text = statusPulse[frame % statusPulse.length].label;
    statusBar.tooltip = 'Codex work finished. Click to dismiss the alert.';
}
function applyPulse(step, generation) {
    const mode = getConfig().flashMode;
    if (mode === 'workbenchColors' || mode === 'editorOverlay') {
        queueWorkbenchPulse(step, generation);
    }
}
function queueWorkbenchPulse(step, generation) {
    workbenchUpdateQueue = workbenchUpdateQueue.then(() => applyWorkbenchPulse(step, generation), () => applyWorkbenchPulse(step, generation));
}
async function applyWorkbenchPulse(step, generation) {
    if (generation !== pulseGeneration || !alertActive) {
        return;
    }
    const cfg = getConfig();
    const target = cfg.workbenchColorTarget === 'global'
        ? vscode.ConfigurationTarget.Global
        : vscode.ConfigurationTarget.Workspace;
    const configuration = vscode.workspace.getConfiguration();
    const current = configuration.get('workbench.colorCustomizations');
    if (!workbenchRestore) {
        workbenchRestore = {
            target,
            originalValue: current ? { ...current } : undefined
        };
    }
    const next = { ...(current ?? {}) };
    const pulseColors = {
        'statusBar.background': greenTone(step.status, 0.92),
        'statusBar.foreground': step.status > 0 ? '#eafff2' : undefined
    };
    for (const [key, value] of Object.entries(pulseColors)) {
        if (value) {
            next[key] = value;
        }
        else if (workbenchRestore.originalValue && key in workbenchRestore.originalValue) {
            next[key] = workbenchRestore.originalValue[key];
        }
        else {
            delete next[key];
        }
    }
    try {
        await configuration.update('workbench.colorCustomizations', next, target);
    }
    catch (error) {
        output.appendLine(`Unable to apply workbench pulse: ${String(error)}`);
    }
}
function greenTone(intensity, maxOpacity) {
    if (intensity <= 0) {
        return undefined;
    }
    const opacity = clamp(Math.round(255 * Math.min(intensity, maxOpacity)), 4, 255);
    return `#2eb872${opacity.toString(16).padStart(2, '0')}`;
}
function dismissOnInteraction(reason) {
    const cfg = getConfig();
    if (!alertActive || !cfg.stopOnInteraction || Date.now() < ignoreInteractionUntil) {
        return;
    }
    output.appendLine(`Completion alert dismissed by ${reason}.`);
    stopAlert();
}
function stopAlert() {
    stopFlashOnly();
    flashTaskbar(false);
    closeNotificationToasts();
    alertActive = false;
    isPulseOn = false;
    statusBar.hide();
}
function closeNotificationToasts() {
    const commands = [
        'workbench.action.closeMessages',
        'notifications.hideToasts'
    ];
    for (const command of commands) {
        void vscode.commands.executeCommand(command).then(undefined, (error) => output.appendLine(`Unable to run notification close command "${command}": ${String(error)}`));
    }
}
function stopFlashOnly() {
    pulseGeneration += 1;
    stopInputWatcher();
    if (flashTimer) {
        clearInterval(flashTimer);
        flashTimer = undefined;
    }
    if (maxFlashTimer) {
        clearTimeout(maxFlashTimer);
        maxFlashTimer = undefined;
    }
    if (workbenchRestore) {
        const restore = workbenchRestore;
        workbenchRestore = undefined;
        workbenchUpdateQueue = workbenchUpdateQueue.then(() => restoreWorkbenchColors(restore), () => restoreWorkbenchColors(restore));
    }
}
async function restoreWorkbenchColors(restore) {
    try {
        await vscode.workspace
            .getConfiguration()
            .update('workbench.colorCustomizations', restore.originalValue, restore.target);
    }
    catch (error) {
        output.appendLine(`Unable to restore workbench colors: ${String(error)}`);
    }
}
function refreshStatus() {
    if (!getConfig().enabled) {
        statusBar.hide();
    }
}
//# sourceMappingURL=extension.js.map