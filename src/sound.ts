import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

export function resolveSoundPath(
  configuredPath: string,
  bundledPath: string,
  workspacePath: string | undefined,
  homePath: string
): string {
  let candidate = configuredPath.trim();
  if (!candidate) {
    return bundledPath;
  }

  if (/^file:/i.test(candidate)) {
    return fileURLToPath(candidate);
  }

  if (/^~(?=$|[\\/])/.test(candidate)) {
    candidate = path.join(homePath, candidate.slice(1));
  }

  if (path.isAbsolute(candidate)) {
    return path.normalize(candidate);
  }

  return path.resolve(workspacePath ?? homePath, candidate);
}

export function volumeToUnitInterval(volumePercent: number): string {
  return (clampVolume(volumePercent) / 100).toFixed(2);
}

export function volumeToMpg123Scale(volumePercent: number): string {
  return Math.round(32768 * clampVolume(volumePercent) / 100).toString();
}

function clampVolume(volumePercent: number): number {
  if (!Number.isFinite(volumePercent)) {
    return 0;
  }
  return Math.min(Math.max(volumePercent, 0), 100);
}
