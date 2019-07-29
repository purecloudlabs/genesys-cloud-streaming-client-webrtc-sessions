const esModules = ['stanza'].join('|');

module.exports = {
  roots: [
    '<rootDir>/src',
    '<rootDir>/test',
    '<rootDir>/node_modules'
  ],
  testMatch: [
    '<rootDir>/test/unit/**/*.(ts|js)'
  ],
  transform: {
    '^.+\\.js?$': 'babel-jest',
    '^.+\\.ts?$': 'ts-jest'
  },
  transformIgnorePatterns: [
    `/node_modules/(?!${esModules}).+\\.js$`
  ],
  setupFilesAfterEnv: [
    '<rootDir>/test/helpers/setup-browser-env.ts'
  ],
  collectCoverage: true,
  collectCoverageFrom: [
    '<rootDir>/src/**/*.{js,ts}',
    '!**/node_modules/**',
    '!**/types/**'
  ],
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100
    }
  },
  coverageReporters: [
    'lcov',
    'text',
    'text-summary',
    'cobertura'
  ],
  coverageDirectory: './coverage'
};
