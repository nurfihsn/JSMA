import { NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import { Finding, generateFindingId } from "../../findings/schema";

export function evaluateForEndpoints(
    path: NodePath<t.CallExpression>,
    sourceFile: string,
): Finding | null {
    const callee = path.node.callee;
    let isHttpCall = false;

    if (t.isIdentifier(callee, { name: "fetch" })) {
        isHttpCall = true;
    } else if (
        t.isMemberExpression(callee) &&
        t.isIdentifier(callee.object, { name: "axios" })
    ) {
        isHttpCall = true;
    }

    if (isHttpCall && path.node.arguments.length > 0) {
        const arg0 = path.node.arguments[0];

        if (t.isStringLiteral(arg0)) {
            const url = arg0.value;
            let severity: Finding["severity"] = "LOW";

            if (/(admin|internal|debug|v1|graphql|api)/i.test(url)) {
                severity = "HIGH";
            }

            return {
                id: generateFindingId("API_ENDPOINT", url),
                category: "API_ENDPOINT",
                severity,
                confidence: "CERTAIN",
                title: "Static API Call Discovered",
                evidence: url,
                sourceFile,
                line: path.node.loc?.start.line || 0,
                occurrences: 1,
                relatedLocations: [],
            };
        }
    }
    return null;
}
