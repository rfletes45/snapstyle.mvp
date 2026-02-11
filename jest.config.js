/**
 * Jest Configuration for SnapStyle MVP
 * Phase 7: Testing Requirements
 *
 * Configures Jest for:
 * - TypeScript support via ts-jest
 * - React Native testing
 * - Path alias resolution
 * - Coverage reporting
 */

module.exports = {
  preset: "jest-expo",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  transformIgnorePatterns: [
    "node_modules/(?!(react-native|@react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|expo-modules-core|uuid)/)",
  ],
  moduleNameMapper: {
    "^@/constants/(.*)$": "<rootDir>/constants/$1",
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  testPathIgnorePatterns: ["/node_modules/", "/android/", "/ios/"],
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/**/index.ts",
    "!src/**/*.stories.{ts,tsx}",
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 80,
      statements: 80,
    },
    // Stricter requirements for game logic
    "src/services/gameValidation/**/*.ts": {
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95,
    },
    "src/utils/physics/**/*.ts": {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
  testMatch: [
    "**/__tests__/**/*.(test|spec).(ts|tsx|js)",
    "**/*.test.(ts|tsx|js)",
    "**/*.spec.(ts|tsx|js)",
  ],
  globals: {
    __DEV__: true,
  },
  verbose: true,
  testTimeout: 10000,
};
