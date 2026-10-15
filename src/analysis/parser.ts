import { parse } from "@babel/parser";
import traverse from "@babel/traverse";
import * as t from "@babel/types";
import { Finding } from "../findings/schema";
import { evaluateStringForSecrets } from "./detectors/secrets";
import { evaluateForRoutes } from "./detectors/routes";
import { evaluateForEndpoints } from "./detectors/endpoints";

export function analyzeFileAst(content: string, filePath: string): Finding[] {
    const findings: Finding[] = [];

    if (filePath.includes("node_modules") || filePath.includes("vendor")) {
        return findings;
    }

    try {
        const ast = parse(content, {
            sourceType: "unambiguous",
            plugins: ["typescript", "jsx"],
            errorRecovery: true,
        });

        traverse(ast, {
            StringLiteral(path) {
                const secretFinding = evaluateStringForSecrets(path, filePath);
                if (secretFinding) findings.push(secretFinding);
            },
            CallExpression(path) {
                const endpointFinding = evaluateForEndpoints(path, filePath);
                if (endpointFinding) findings.push(endpointFinding);
            },
            enter(path) {
                const routeFinding = evaluateForRoutes(path, filePath);
                if (routeFinding) findings.push(routeFinding);
            },
        });
    } catch (err) { }

    return findings;
}
