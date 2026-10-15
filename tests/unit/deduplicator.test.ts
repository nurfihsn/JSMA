import { FindingsDeduplicator } from "../../src/findings/deduplicator";
import { Finding, generateFindingId } from "../../src/findings/schema";

describe("FindingsDeduplicator Engine", () => {
    it("Harus menggabungkan finding yang persis sama berdasarkan Type dan Evidence", () => {
        const deduplicator = new FindingsDeduplicator();

        const finding1: Finding = {
            id: generateFindingId("API_ENDPOINT", "/api/v1/admin"),
            category: "API_ENDPOINT",
            severity: "HIGH",
            confidence: "CERTAIN",
            title: "Test",
            evidence: "/api/v1/admin",
            sourceFile: "fileA.js",
            line: 10,
            occurrences: 1,
            relatedLocations: [],
        };

        const finding2: Finding = {
            id: generateFindingId("API_ENDPOINT", "/api/v1/admin"),
            category: "API_ENDPOINT",
            severity: "HIGH",
            confidence: "CERTAIN",
            title: "Test",
            evidence: "/api/v1/admin",
            sourceFile: "fileB.js",
            line: 42,
            occurrences: 1,
            relatedLocations: [],
        };

        deduplicator.addFinding(finding1);
        deduplicator.addFinding(finding2);

        const results = deduplicator.getResults();

        expect(results.length).toBe(1);
        expect(results[0].occurrences).toBe(2);
        expect(results[0].relatedLocations).toContain("fileB.js:42");
    });
});
