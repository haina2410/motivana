import { renderHook } from '@testing-library/react-native';

import {
  describeRunningUpdate,
  describeUpdateCheck,
  runningUpdateSummary,
  shortId,
  useUpdateLog,
  type RunningUpdate,
  type UpdateCheck,
} from '../updateStatus';

const embedded: RunningUpdate = {
  isEnabled: true,
  isEmbeddedLaunch: true,
  isEmergencyLaunch: false,
  emergencyLaunchReason: null,
  updateId: null,
  runtimeVersion: '263fefa6c9f9e86a055f9ff1e12284cac127f758',
  createdAt: null,
};

const downloaded: RunningUpdate = {
  ...embedded,
  isEmbeddedLaunch: false,
  updateId: '8f1c2a04-1b2c-4d5e-8f90-a1b2c3d4e5f6',
  createdAt: new Date('2026-08-27T09:00:12.000Z'),
};

const idle: UpdateCheck = {
  isChecking: false,
  isDownloading: false,
  isUpdateAvailable: false,
  isUpdatePending: false,
};

describe('shortId', () => {
  it('keeps the leading characters, which is what the publish log prints', () => {
    expect(shortId('8f1c2a04-1b2c-4d5e-8f90-a1b2c3d4e5f6')).toBe('8f1c2a04');
    expect(shortId('263fefa6c9f9e86a055f9ff1e12284cac127f758', 12)).toBe(
      '263fefa6c9f9',
    );
  });

  it('reports absence rather than an empty string', () => {
    expect(shortId(null)).toBeNull();
    expect(shortId(undefined)).toBeNull();
    expect(shortId('')).toBeNull();
  });
});

describe('describeRunningUpdate', () => {
  it('names the built-in bundle when no update has been applied', () => {
    const line = describeRunningUpdate(embedded);

    expect(line).toContain('built-in bundle');
    expect(line).toContain('263fefa6c9f9');
    expect(line).not.toContain('undefined');
  });

  // The runtime version is the whole reason a device does or does not receive
  // an update, so it has to appear even when nothing else is known.
  it('names the running update and its publish time', () => {
    const line = describeRunningUpdate(downloaded);

    expect(line).toContain('8f1c2a04');
    expect(line).toContain('2026-08-27T09:00:12.000Z');
    expect(line).toContain('263fefa6c9f9');
  });

  it('says updates are off instead of reporting a missing runtime', () => {
    const line = describeRunningUpdate({
      ...embedded,
      isEnabled: false,
      runtimeVersion: null,
    });

    expect(line).toContain('disabled');
    expect(line).not.toContain('null');
  });

  // An emergency launch means the last update crashed on start and the client
  // fell back. Reading it as an ordinary embedded launch hides a real failure.
  it('reports an emergency launch with its reason', () => {
    const line = describeRunningUpdate({
      ...downloaded,
      isEmergencyLaunch: true,
      emergencyLaunchReason: 'could not read the manifest',
    });

    expect(line).toContain('emergency');
    expect(line).toContain('could not read the manifest');
  });
});

describe('describeUpdateCheck', () => {
  it('says nothing before the first check finishes', () => {
    expect(describeUpdateCheck({ ...idle, isChecking: true })).toBeNull();
    expect(describeUpdateCheck(idle)).toBeNull();
  });

  it('confirms a finished check that found nothing', () => {
    const line = describeUpdateCheck({
      ...idle,
      lastCheckAt: new Date('2026-08-27T09:05:00.000Z'),
    });

    expect(line).toContain('no update');
  });

  it('names the update it found, is downloading, and has downloaded', () => {
    const found = {
      ...idle,
      isUpdateAvailable: true,
      availableUpdateId: 'ab12',
    };

    expect(describeUpdateCheck(found)).toContain('ab12');
    expect(describeUpdateCheck({ ...found, isDownloading: true })).toContain(
      'downloading',
    );
    const pending = describeUpdateCheck({
      ...found,
      isUpdatePending: true,
      downloadedUpdateId: 'ab12',
    });
    expect(pending).toContain('next launch');
  });

  // A silent check failure is the exact case this logging exists for: the
  // device keeps running old code and nothing anywhere says why.
  it('reports a check failure ahead of any other state', () => {
    const line = describeUpdateCheck({
      ...idle,
      isUpdateAvailable: true,
      availableUpdateId: 'ab12',
      checkError: new Error('502 from the manifest endpoint'),
    });

    expect(line).toContain('502 from the manifest endpoint');
  });

  it('reports a download failure', () => {
    const line = describeUpdateCheck({
      ...idle,
      downloadError: new Error('asset 404'),
    });

    expect(line).toContain('asset 404');
  });
});

describe('runningUpdateSummary', () => {
  it('leaves the update blank when the built-in bundle is running', () => {
    expect(runningUpdateSummary(embedded)).toEqual({
      update: null,
      runtime: '263fefa6c9f9',
    });
  });

  it('pairs the short update id with a plain calendar date', () => {
    expect(runningUpdateSummary(downloaded)).toEqual({
      update: '8f1c2a04 · 2026-08-27',
      runtime: '263fefa6c9f9',
    });
  });

  // expo-updates hands back an Invalid Date when the native constant is
  // missing, and `toISOString` throws on one. Unguarded, that takes down the
  // settings screen for every reader.
  it('drops an unreadable publish time instead of throwing', () => {
    const broken = { ...downloaded, createdAt: new Date(NaN) };

    expect(runningUpdateSummary(broken)).toEqual({
      update: '8f1c2a04',
      runtime: '263fefa6c9f9',
    });
    expect(describeRunningUpdate(broken)).toContain('unknown publish time');
  });
});

describe('useUpdateLog', () => {
  // Mutation caught: an effect without an empty dependency list reprints the
  // launch line on every render, burying the check results under it.
  it('states what is running once, however often the tree re-renders', () => {
    const log = jest.fn();

    const { rerender } = renderHook(() => useUpdateLog(log));
    rerender(undefined);
    rerender(undefined);

    const launchLines = log.mock.calls
      .map(([line]) => String(line))
      .filter((line) => /running|disabled|emergency/.test(line));
    expect(launchLines).toHaveLength(1);
    expect(launchLines[0]).toContain('[ota]');
  });
});
