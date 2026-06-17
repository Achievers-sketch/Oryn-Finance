module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/stress/**/*.test.js'],
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.js'],
  moduleFileExtensions: ['js', 'json'],
  verbose: true,
  testTimeout: 60000,
  clearMocks: true,
  restoreMocks: true,
};
