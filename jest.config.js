module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    testMatch: ["**/tests/**/*.test.ts", "**/test/**/*.test.ts", "**/*.test.ts"],
    transform: {
        "^.+\\.ts?$": [
            "ts-jest",
            {
                diagnostics: { ignoreCodes: [151002] },
            },
        ],
    },
};
