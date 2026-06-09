# Codex Finish Notifier

VS Code extension that plays a gentle completion sound and shows a compact CLI-style status bar pulse when Codex work finishes.

## What Works Automatically

- Detects `codex` CLI commands in terminals when VS Code shell integration is active.
- Handles Codex `Stop` hooks by watching `.codex/last-notify.log`, with `vscode://local-dev.codex-finish-notifier/done` kept as a fallback for repo-local Codex turns.
- Plays the bundled notification MP3 when the command ends.
- Blinks a green `>>> CODEX DONE <<<` style status bar banner until you focus/interact with VS Code or dismiss it.

The OpenAI Codex VS Code extension does not expose a public VS Code extension API event for "turn completed". This repo includes a `.codex/hooks.json` `Stop` hook that writes `.codex/last-notify.log`; the extension watches that file and runs the same alert path as the test command. Codex may ask you to review and trust that hook once with `/hooks`.

## Commands

- `Codex Notifier: Notify Codex Done` starts the completion alert manually.
- `Codex Notifier: Test Completion Alert` tests the sound and visual pulse.
- `Codex Notifier: Dismiss Completion Alert` stops the current alert.
- `Codex Notifier: Mark Codex Started` shows a "Codex working" status item for manually tracked work.

## Settings

- `codexFinishNotifier.enabled`: turn the extension on/off.
- `codexFinishNotifier.playSound`: enable/disable the completion sound.
- `codexFinishNotifier.flashMode`: `workbenchColors`, `editorOverlay`, or `off`. `workbenchColors` and `editorOverlay` now keep the visual alert limited to the status bar.
- `codexFinishNotifier.stopOnInteraction`: stop flashing when the user focuses or interacts with VS Code.
- `codexFinishNotifier.flashIntervalMs`: pulse speed. Default is `900`; larger values blink slower.
- `codexFinishNotifier.maxFlashSeconds`: optional safety timeout. `0` or `1` keeps the alert active until interaction or dismissal.
- `codexFinishNotifier.detectTerminalCodex`: detect terminal Codex CLI completion.
- `codexFinishNotifier.terminalCommandPattern`: regex for terminal commands to treat as Codex work.
- `codexFinishNotifier.taskbarFlash`: on Windows, flash the VS Code taskbar icon while the alert is active.

`workbenchColors` is the default because VS Code only exposes custom status bar background colors through `workbench.colorCustomizations`. The extension temporarily updates only `statusBar.background` and `statusBar.foreground`, then restores the previous values when dismissed. Use `off` if you want sound/taskbar flashing without the green status bar pulse.

## Run Locally

1. Run `npm install`.
2. Run `npm run compile`.
3. Open this folder in VS Code.
4. Press `F5` and choose `Run Extension`.
5. In the extension host window, run `Codex Notifier: Test Completion Alert` from the Command Palette.

## Notes

Mouse movement alone is not exposed as a global VS Code extension event. The extension stops on supported interaction signals: window focus, active editor changes, mouse clicks that move the editor selection, scrolling/visible range changes, text document edits, active terminal changes, terminal command starts, and visible editor changes.
