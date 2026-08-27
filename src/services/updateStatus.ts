import * as Updates from 'expo-updates';
import { useEffect, useRef } from 'react';

/** What the client is running right now. Fixed for the life of the process. */
export type RunningUpdate = {
  isEnabled: boolean;
  isEmbeddedLaunch: boolean;
  isEmergencyLaunch: boolean;
  emergencyLaunchReason: string | null;
  updateId: string | null;
  runtimeVersion: string | null;
  createdAt: Date | null;
};

/** What the launch-time check against the manifest endpoint has found so far. */
export type UpdateCheck = {
  isChecking: boolean;
  isDownloading: boolean;
  isUpdateAvailable: boolean;
  isUpdatePending: boolean;
  availableUpdateId?: string;
  downloadedUpdateId?: string;
  checkError?: Error;
  downloadError?: Error;
  lastCheckAt?: Date;
};

const tag = '[ota]';

/**
 * The leading characters of an id. `pnpm ota:publish` prints the same prefix,
 * so a line here can be matched against a publish by eye.
 */
export function shortId(
  value: string | null | undefined,
  length = 8,
): string | null {
  if (!value) return null;
  return value.slice(0, length);
}

/**
 * expo-updates reports an Invalid Date when the native constant is absent, and
 * `toISOString` throws on one.
 */
function isoTime(date: Date | null): string | null {
  if (!date || Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function describeRunningUpdate(running: RunningUpdate): string {
  if (!running.isEnabled) {
    return `${tag} updates disabled — this is a development build`;
  }
  const runtime = shortId(running.runtimeVersion, 12) ?? 'unknown runtime';
  // An emergency launch means the downloaded update failed to start and the
  // client fell back to the built-in bundle. Reporting it as an ordinary
  // embedded launch would hide a broken publish.
  if (running.isEmergencyLaunch) {
    const reason = running.emergencyLaunchReason ?? 'no reason reported';
    return `${tag} emergency launch — fell back to the built-in bundle · runtime ${runtime} · ${reason}`;
  }
  if (running.isEmbeddedLaunch || !running.updateId) {
    return `${tag} running the built-in bundle · runtime ${runtime}`;
  }
  const published = isoTime(running.createdAt) ?? 'unknown publish time';
  return `${tag} running update ${shortId(running.updateId)} · published ${published} · runtime ${runtime}`;
}

/**
 * One line per meaningful state, or null while there is nothing to report.
 * Failures come first: a silent check failure is the case this logging exists
 * for, because the device just keeps running the old bundle.
 */
export function describeUpdateCheck(check: UpdateCheck): string | null {
  if (check.checkError) {
    return `${tag} check failed: ${check.checkError.message}`;
  }
  if (check.downloadError) {
    return `${tag} download failed: ${check.downloadError.message}`;
  }
  if (check.isUpdatePending) {
    const id = shortId(check.downloadedUpdateId ?? check.availableUpdateId);
    return `${tag} update ${id} downloaded — starts on the next launch`;
  }
  if (check.isDownloading) {
    return `${tag} downloading update ${shortId(check.availableUpdateId)}`;
  }
  if (check.isUpdateAvailable) {
    return `${tag} update ${shortId(check.availableUpdateId)} available`;
  }
  // Only after a check has actually completed. Saying "no update" while the
  // request is still open would be a guess.
  if (check.lastCheckAt && !check.isChecking) {
    return `${tag} no update available`;
  }
  return null;
}

/** The same two facts, trimmed for a settings row. */
export function runningUpdateSummary(running: RunningUpdate): {
  update: string | null;
  runtime: string | null;
} {
  const runtime = shortId(running.runtimeVersion, 12);
  if (running.isEmbeddedLaunch || !running.updateId) {
    return { update: null, runtime };
  }
  const date = isoTime(running.createdAt)?.slice(0, 10);
  const id = shortId(running.updateId);
  return { update: date ? `${id} · ${date}` : id, runtime };
}

/** Reads the module constants expo-updates fixes at launch. */
export function readRunningUpdate(): RunningUpdate {
  return {
    isEnabled: Updates.isEnabled,
    isEmbeddedLaunch: Updates.isEmbeddedLaunch,
    isEmergencyLaunch: Updates.isEmergencyLaunch,
    emergencyLaunchReason: Updates.emergencyLaunchReason,
    updateId: Updates.updateId,
    runtimeVersion: Updates.runtimeVersion,
    createdAt: Updates.createdAt,
  };
}

/**
 * Follows the check expo-updates already runs at launch. Calling
 * `checkForUpdateAsync` here instead would ask the Worker the same question a
 * second time.
 */
export function useUpdateCheck(): UpdateCheck {
  const state = Updates.useUpdates();
  return {
    isChecking: state.isChecking,
    isDownloading: state.isDownloading,
    isUpdateAvailable: state.isUpdateAvailable,
    isUpdatePending: state.isUpdatePending,
    availableUpdateId:
      state.availableUpdate && 'updateId' in state.availableUpdate
        ? state.availableUpdate.updateId
        : undefined,
    downloadedUpdateId:
      state.downloadedUpdate && 'updateId' in state.downloadedUpdate
        ? state.downloadedUpdate.updateId
        : undefined,
    checkError: state.checkError,
    downloadError: state.downloadError,
    lastCheckAt: state.lastCheckForUpdateTimeSinceRestart,
  };
}

/**
 * Logs what is running once per launch, then each new check result. Mount it
 * once, at the root.
 */
export function useUpdateLog(log: (line: string) => void = console.log): void {
  const check = useUpdateCheck();
  const lastLine = useRef<string>(undefined);
  useEffect(() => {
    log(describeRunningUpdate(readRunningUpdate()));
    // Once per launch. `log` is stable in practice and a changed logger must
    // not reprint the launch line.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const line = describeUpdateCheck(check);
    if (!line || line === lastLine.current) return;
    lastLine.current = line;
    log(line);
  });
}
