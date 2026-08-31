/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.test.ts"],
  transform: {
    // isolatedModules: transpile-only (skip full type-check) so tests run fast
    // and aren't blocked by strict unused-var rules meant for app code.
    "^.+\\.ts$": ["ts-jest", { isolatedModules: true }],
  },
  clearMocks: true,
};
