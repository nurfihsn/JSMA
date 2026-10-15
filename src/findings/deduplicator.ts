import { Finding } from "./schema";

export class FindingsDeduplicator {
    private findingsMap: Map<string, Finding> = new Map();

    addFinding(finding: Finding): void {
        const existing = this.findingsMap.get(finding.id);

        if (existing) {
            existing.occurrences += 1;
            const locationStr = `${finding.sourceFile}:${finding.line}`;

            if (
                !existing.relatedLocations.includes(locationStr) &&
                existing.relatedLocations.length < 5
            ) {
                existing.relatedLocations.push(locationStr);
            }
        } else {
            this.findingsMap.set(finding.id, finding);
        }
    }

    getResults(): Finding[] {
        const weight = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, INFO: 0 };
        return Array.from(this.findingsMap.values()).sort((a, b) => {
            return weight[b.severity] - weight[a.severity];
        });
    }
}
