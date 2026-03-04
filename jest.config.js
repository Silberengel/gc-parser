module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
  ],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: 'tsconfig.test.json',
    }],
  },
  // Don't transform AsciiDoctor packages - they use Opal runtime which breaks with Jest transformation
  // AsciiDoctor uses CommonJS and Opal runtime, so we need to exclude it from transformation
  // The pattern matches paths to ignore (not transform)
  transformIgnorePatterns: [
    'node_modules/(?!(@asciidoctor)/)',
  ],
  // Ensure CommonJS modules are handled correctly
  moduleNameMapper: {},
};
