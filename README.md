# Codex Finish Notifier

VS Code extension that plays a gentle completion sound and shows a compact CLI-style status bar pulse when Codex work finishes.

## What Works Automatically

- Detects `codex` CLI commands in terminals when VS Code shell integration is active.
- Detects Codex work from the OpenAI Codex VS Code extension using local completion markers, plus a guarded chat-stream fallback for chat-only turns.
- Plays the bundled notification MP3, or a custom audio clip, when the command ends.
- Blinks a green `>>> CODEX DONE <<<` style status bar banner until you focus/interact with VS Code or dismiss it.

The OpenAI Codex VS Code extension does not expose a public VS Code extension API event for "turn completed", so this extension watches local VS Code extension-host output from the OpenAI Codex extension. Strong completion markers are used when available; chat-only turns fall back to a guarded stream/read-state settled check.

## Commands

- `Codex Notifier: Notify Codex Done` starts the completion alert manually.
- `Codex Notifier: Test Completion Alert` tests the sound and visual pulse.
- `Codex Notifier: Select Notification Sound` opens a file picker for a custom audio clip.
- `Codex Notifier: Dismiss Completion Alert` stops the current alert.
- `Codex Notifier: Mark Codex Started` shows a "Codex working" status item for manually tracked work.

## Codex Toolbar Settings

Select the settings-gear button in the Codex task or sidebar title toolbar to open the quick settings panel. It provides a volume slider, notifier and sound toggles, custom audio selection/reset, a test button, and a shortcut to all extension settings.

## Settings

- `codexFinishNotifier.enabled`: turn the extension on/off.
- `codexFinishNotifier.playSound`: enable/disable the completion sound.
- `codexFinishNotifier.soundVolume`: sound volume from `0` (muted) to `100`. Default is `50`.
- `codexFinishNotifier.soundPath`: optional custom audio path. Leave empty for the bundled MP3; relative paths use the first workspace folder.
- `codexFinishNotifier.flashMode`: `workbenchColors`, `editorOverlay`, or `off`. `workbenchColors` and `editorOverlay` now keep the visual alert limited to the status bar.
- `codexFinishNotifier.stopOnInteraction`: stop flashing when the user focuses or interacts with VS Code.
- `codexFinishNotifier.flashIntervalMs`: pulse speed. Default is `900`; larger values blink slower.
- `codexFinishNotifier.maxFlashSeconds`: optional safety timeout. `0` or `1` keeps the alert active until interaction or dismissal.
- `codexFinishNotifier.detectTerminalCodex`: detect terminal Codex CLI completion.
- `codexFinishNotifier.detectOpenAiCodexLog`: detect Codex completion from the OpenAI Codex extension's local turn-state output.
- `codexFinishNotifier.openAiCodexDetectionMode`: `chatHeuristic` catches chat-only turns after stream/read-state activity settles; `conservative` only uses stronger local completion markers.
- `codexFinishNotifier.detectCodexProcess`: detect completion by watching short-lived Codex process exit. Off by default because the OpenAI Codex extension app-server is long-lived.
- `codexFinishNotifier.processPollIntervalMs`: how often to check Codex process state.
- `codexFinishNotifier.terminalCommandPattern`: regex for terminal commands to treat as Codex work.
- `codexFinishNotifier.taskbarFlash`: on Windows, flash the VS Code taskbar icon while the alert is active.

`workbenchColors` is the default because VS Code only exposes custom status bar background colors through `workbench.colorCustomizations`. The extension temporarily updates only `statusBar.background` and `statusBar.foreground`, then restores the previous values when dismissed. Use `off` if you want sound/taskbar flashing without the green status bar pulse.

The notifier keeps one audio player active at a time and ignores duplicate completion signals while an alert is active. This prevents overlapping playback when terminal and Codex-log detection report the same completion.

## Run Locally

1. Run `npm install`.
2. Run `npm run compile`.
3. Open this folder in VS Code.
4. Press `F5` and choose `Run Extension`.
5. In the extension host window, run `Codex Notifier: Test Completion Alert` from the Command Palette.

## Notes

Mouse movement alone is not exposed as a global VS Code extension event. The extension stops on supported interaction signals: window focus, active editor changes, mouse clicks that move the editor selection, scrolling/visible range changes, text document edits, active terminal changes, terminal command starts, and visible editor changes.
