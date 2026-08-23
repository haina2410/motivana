import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const repositoryRoot = resolve(__dirname, '../..');
const smokeScript = join(repositoryRoot, 'scripts/emulator-smoke.sh');
const packageName = 'org.haina2410.motivana';

type FakeAdbMode =
  | 'ready'
  | 'bad-apk'
  | 'offline'
  | 'missing-activity'
  | 'delayed-node'
  | 'loading'
  | 'fatal-log';

function createFakeAdb(directory: string, mode: FakeAdbMode): string {
  const fakeAdb = join(directory, 'adb');
  writeFileSync(
    fakeAdb,
    `#!/usr/bin/env bash
set -euo pipefail
mode="${mode}"
if [[ "$1" == "get-state" ]]; then
  if [[ "$mode" == "offline" ]]; then printf 'offline\\n'; else printf 'device\\n'; fi
  exit 0
fi
if [[ "$1" == "install" ]]; then
  if [[ "$mode" == "bad-apk" ]]; then printf 'Failure [INSTALL_PARSE_FAILED_NOT_APK]\\n' >&2; exit 1; fi
  printf 'Success\\n'
  exit 0
fi
if [[ "$1" == "exec-out" && "$2" == "screencap" ]]; then
  printf '\\211PNG\\r\\n\\032\\n'
  exit 0
fi
if [[ "$1" == "exec-out" && "$2" == "cat" ]]; then
  if [[ "$mode" == "loading" ]]; then
    printf '<hierarchy><node text="Motivana" content-desc="Motivana" /><node text="Preparing your wallpaper" content-desc="" /></hierarchy>\\n'
    exit 0
  fi
  if [[ "$mode" == "delayed-node" ]]; then
    state_file="${fakeAdb}.node-calls"
    calls="$(cat "$state_file" 2>/dev/null || printf 0)"
    printf '%s' $((calls + 1)) > "$state_file"
    if [[ "$calls" == '0' ]]; then
      printf '<hierarchy><node text="" content-desc="" /></hierarchy>\\n'
      exit 0
    fi
  fi
  printf '<hierarchy><node text="Motivana" content-desc="Motivana" /><node text="" content-desc="Wallpaper preview" /><node text="" content-desc="Save wallpaper" /><node text="" content-desc="Set wallpaper" /></hierarchy>\\n'
  exit 0
fi
if [[ "$1" == "logcat" ]]; then
  if [[ "$mode" == "fatal-log" ]]; then printf 'FATAL EXCEPTION: main\\nProcess: ${packageName}\\n'; fi
  exit 0
fi
if [[ "$1" == "shell" && "$2" == "dumpsys" ]]; then
  if [[ "$mode" == "missing-activity" ]]; then printf 'mCurrentFocus=Window{other.package/.MainActivity}\\n'; else printf 'mCurrentFocus=Window{${packageName}/.MainActivity}\\n'; fi
  exit 0
fi
if [[ "$1" == "shell" && "$2" == "pidof" ]]; then printf '4321\\n'; exit 0; fi
exit 0
`,
  );
  chmodSync(fakeAdb, 0o755);
  return fakeAdb;
}

function runSmoke(mode: FakeAdbMode, waitSeconds = '0') {
  const directory = mkdtempSync(join(tmpdir(), 'motivana-smoke-test-'));
  const apk = join(directory, 'app-debug.apk');
  const artifacts = join(
    repositoryRoot,
    'artifacts/qa',
    `.emulator-smoke-test-${process.pid}-${Math.random().toString(16).slice(2)}`,
  );
  writeFileSync(apk, 'fixture');
  const result = spawnSync('bash', [smokeScript, apk], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      ADB_BIN: createFakeAdb(directory, mode),
      MOTIVANA_SMOKE_ARTIFACTS: artifacts,
      MOTIVANA_SMOKE_SKIP_METRO: '1',
      MOTIVANA_SMOKE_WAIT_SECONDS: waitSeconds,
    },
  });
  return { artifacts, directory, result };
}

function clean({
  artifacts,
  directory,
}: {
  artifacts: string;
  directory: string;
}) {
  rmSync(artifacts, { force: true, recursive: true });
  rmSync(directory, { force: true, recursive: true });
}

test('captures sanitized evidence after a package-scoped happy-path smoke run', () => {
  const run = runSmoke('ready');
  try {
    expect(run.result.status).toBe(0);
    expect(existsSync(join(run.artifacts, 'home.png'))).toBe(true);
    expect(existsSync(join(run.artifacts, 'window.xml'))).toBe(false);
    expect(existsSync(join(run.artifacts, 'logcat.txt'))).toBe(false);
    expect(readFileSync(join(run.artifacts, 'summary.txt'), 'utf8')).toMatch(
      /ready=true/,
    );
  } finally {
    clean(run);
  }
});

test('waits for the loaded Motivana accessibility node after MainActivity appears', () => {
  const run = runSmoke('delayed-node', '2');
  try {
    expect(run.result.status).toBe(0);
    expect(existsSync(join(run.artifacts, 'home.png'))).toBe(true);
  } finally {
    clean(run);
  }
});

test('rejects a persistent loading screen even when the header is visible', () => {
  const run = runSmoke('loading', '1');
  try {
    expect(run.result.status).not.toBe(0);
    expect(`${run.result.stdout}${run.result.stderr}`).toMatch(
      /remained on loading|did not become ready/i,
    );
  } finally {
    clean(run);
  }
});

test.each([
  ['a malformed APK', 'bad-apk', /adb install failed/i],
  ['an offline ADB device', 'offline', /ADB device is not ready/i],
  [
    'a missing Motivana main activity',
    'missing-activity',
    /MainActivity did not appear/i,
  ],
  ['a package fatal-log fixture', 'fatal-log', /FATAL EXCEPTION/i],
] as const)('fails safely for %s', (_label, mode, expected) => {
  const run = runSmoke(mode);
  try {
    expect(run.result.status).not.toBe(0);
    expect(`${run.result.stdout}${run.result.stderr}`).toMatch(expected);
  } finally {
    clean(run);
  }
});
