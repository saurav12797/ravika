/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/src/__tests__/setup.ts'],
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        diagnostics: false,
        tsconfig: {
          module: 'commonjs',
          esModuleInterop: true,
          strict: true,
          paths: { '@/*': ['./src/*'] },
          baseUrl: '.',
          types: ['jest', 'node'],
        },
      },
    ],
  },
  modulePathIgnorePatterns: ['<rootDir>/functions/lib'],
};
