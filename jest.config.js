module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  collectCoverageFrom: ['app/**/*.{ts,tsx}', 'src/**/*.{ts,tsx}'],
  // /.claude/worktrees/ holds temporary agent checkouts: running their copies
  // of these suites doubles every run and reports another tree's result as ours.
  testPathIgnorePatterns: [
    '/node_modules/',
    '/android/',
    '/.claude/worktrees/',
  ],
};
