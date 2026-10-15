import crypto from "crypto";

export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
export type Confidence = "CERTAIN" | "FIRM" | "TENTATIVE";
export type FindingCategory =
    | "SECRET"
    | "API_ENDPOINT"
    | "FRONTEND_ROUTE"
    | "INFRASTRUCTURE";

export interface Finding {
    id: string;
    category: FindingCategory;
    severity: Severity;
    confidence: Confidence;
    title: string;
    evidence: string;
    sourceFile: string;
    line: number;
    context?: string;
    occurrences: number;
    relatedLocations: string[];
}

export function generateFindingId(category: string, evidence: string): string {
    return crypto
        .createHash("sha256")
        .update(`${category}:${evidence}`)
        .digest("hex");
}
