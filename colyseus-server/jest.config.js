module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  testMatch: ["**/*.test.ts"],
  moduleFileExtensions: ["ts", "js", "mjs", "json"],
  transformIgnorePatterns: ["/node_modules/(?!(rou3|httpie)/)"],
  transform: {
    "^.+\\.tsx?$": "ts-jest",
    "^.+\\.mjs$": "babel-jest",
  },
};
