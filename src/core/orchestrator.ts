import { SourceMapConsumer } from "source-map-js";
import { SafeNetworkClient } from "../network/client";
import { writeArtifactSafely } from "../storage/safe-paths";
import { analyzeFileAst } from "../analysis/parser";
import { FindingsDeduplicator } from "../findings/deduplicator";
import { Finding } from "../findings/schema";

export interface ScanResult {
    target: string;
    metrics: { totalFiles: number; analyzedFiles: number; findings: number };
    findings: Finding[];
}

export class JSMAOrchestrator {
    static async executeScan(
        urlOrPath: string,
        isLocal: boolean,
        rawMapData: string,
        outDir?: string,
    ): Promise<ScanResult> {
        if (!rawMapData.includes('"sourcesContent"')) {
            throw new Error(
                "Source map missing inline code. Analysis aborted.",
            );
        }

        const mapData = JSON.parse(rawMapData);
        const consumer = new SourceMapConsumer(mapData);

        const deduplicator = new FindingsDeduplicator();
        let totalFiles = 0;
        let analyzedFiles = 0;

        consumer.sources.forEach((virtualPath) => {
            const content = consumer.sourceContentFor(virtualPath, true);
            if (!content) return;

            totalFiles++;
            const isVendor =
                virtualPath.includes("node_modules") || virtualPath.includes("~");

            if (outDir) {
                writeArtifactSafely(outDir, virtualPath, content).catch(() => { });
            }

            if (!isVendor) {
                analyzedFiles++;
                const fileFindings = analyzeFileAst(content, virtualPath);

                fileFindings.forEach((f) => deduplicator.addFinding(f));
            }
        });

        const finalFindings = deduplicator.getResults();

        return {
            target: urlOrPath,
            metrics: { totalFiles, analyzedFiles, findings: finalFindings.length },
            findings: finalFindings,
        };
    }
}
