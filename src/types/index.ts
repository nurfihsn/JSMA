export interface Finding {
    id: string;
    type: 'SECRET' | 'ENDPOINT' | 'ROUTE' | 'HOST';
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
    confidence: number;
    sourceFile: string;
    line: number;
    evidence: string;
    title: string;
    occurrences?: number;
    otherLocations?: string[];
}

export interface ExtractedFile {
    path: string;
    content: string;
    isVendor: boolean;
}