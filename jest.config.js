const expoPreset = require('jest-expo/jest-preset');

module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  collectCoverageFrom: ['app/**/*.{ts,tsx}', 'src/**/*.{ts,tsx}'],
  // /.claude/worktrees/ holds temporary agent checkouts: running their copies
  // of these suites doubles every run and reports another tree's result as ours.
  // /ota/ is an independent Cloudflare Worker package. It uses vitest with the
  // workers pool, which the jest-expo preset cannot run.
  testPathIgnorePatterns: [
    '/node_modules/',
    '/android/',
    '/.claude/worktrees/',
    '/ota/',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'mjs', 'json', 'node'],
  // The OTA helpers are .mjs so the publish scripts can import them directly.
  // The jest-expo transform only matches .ts/.tsx/.js/.jsx, so .mjs needs its
  // own entry or the import fails to resolve. Reuse the preset's own
  // babel-jest config (it points at expo's babel preset) rather than a bare
  // 'babel-jest' string, which has no presets and can't parse `import`.
  transform: {
    ...expoPreset.transform,
    '^.+\\.mjs$': expoPreset.transform['\\.[jt]sx?$'],
  },
};
