import { exportedWallpaperUri } from '../exportCache';

jest.mock('expo-file-system', () => {
  const state = { existing: new Set<string>(), throws: false };
  class MockDirectory {
    base: string;
    name: string;
    constructor(base: string, name: string) {
      this.base = base;
      this.name = name;
    }
  }
  class MockFile {
    directory: MockDirectory;
    name: string;
    constructor(directory: MockDirectory, name: string) {
      if (state.throws) throw new Error('the cache is gone');
      this.directory = directory;
      this.name = name;
    }
    get uri() {
      return `${this.directory.base}/${this.directory.name}/${this.name}`;
    }
    get exists() {
      return state.existing.has(this.name);
    }
  }
  return {
    fileSystemState: state,
    Paths: { cache: 'file:///cache' },
    Directory: MockDirectory,
    File: MockFile,
  };
});

const { fileSystemState } = jest.requireMock('expo-file-system') as {
  fileSystemState: { existing: Set<string>; throws: boolean };
};

beforeEach(() => {
  fileSystemState.existing.clear();
  fileSystemState.throws = false;
});

// Mutation caught: reporting a uri for a missing file would leave the reader
// looking at a broken image where the preview belongs.
test('reports the exported wallpaper only when the cache still holds it', () => {
  fileSystemState.existing.add('midnight-focus-q1-1080x2400-abc.png');

  expect(exportedWallpaperUri('midnight-focus-q1-1080x2400-abc')).toBe(
    'file:///cache/motivana-exports/midnight-focus-q1-1080x2400-abc.png',
  );
  expect(
    exportedWallpaperUri('midnight-focus-q2-1080x2400-abc'),
  ).toBeUndefined();
});

// Mutation caught: letting the file-system error through would stop the launch
// on a device that cleared its cache directory.
test('reports nothing when the cache cannot be read', () => {
  fileSystemState.throws = true;

  expect(
    exportedWallpaperUri('midnight-focus-q1-1080x2400-abc'),
  ).toBeUndefined();
});
