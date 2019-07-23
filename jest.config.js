module.exports = {
  roots: [
    '<rootDir>/src',
    '<rootDir>/test'
  ],
  testMatch: [
    '<rootDir>/test/unit/**/*.(ts|js)'
  ],
  transform: {
    '^.+\\.jsx?$': 'babel-jest',
    '^.+\\.tsx?$': 'ts-jest'
  },
  setupFilesAfterEnv: [
    '<rootDir>/test/helpers/setup-browser-env.js'
  ],
  collectCoverage: true,
  collectCoverageFrom: [
    '<rootDir>/src/**/*.{js,jsx,ts,tsx}',
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
    'lcov', 'text', 'text-summary', 'cobertura'
  ],
  coverageDirectory: './coverage'
};
