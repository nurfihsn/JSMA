import { NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import { Finding, generateFindingId } from "../../findings/schema";

function calculateEntropy(str: string): number {
    const len = str.length;
    const frequencies: Record<string, number> = {};
    for (let i = 0; i < len; i++) {
        frequencies[str[i]] = (frequencies[str[i]] || 0) + 1;
    }
    return Object.values(frequencies).reduce((sum, freq) => {
        const p = freq / len;
        return sum - p * Math.log2(p);
    }, 0);
}

export function evaluateStringForSecrets(
    path: NodePath<t.StringLiteral>,
    sourceFile: string,
): Finding | null {
    const value = path.node.value;
    if (value.length < 8 || value.length > 256) return null;

    let confidence: Finding["confidence"] = "TENTATIVE";
    let severity: Finding["severity"] = "INFO";
    let title = "Suspicious String";
    let context = "High entropy or pattern matched string.";

    if (/^AKIA[0-9A-Z]{16}$/.test(value)) {
        title = "AWS Access Key ID";
        severity = "CRITICAL";
        confidence = "FIRM";
    } else if (
        /^eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*$/.test(value)
    ) {
        title = "Hardcoded JWT Token";
        severity = "HIGH";
        confidence = "FIRM";
    }

    const parent = path.parent;
    if (t.isVariableDeclarator(parent) && t.isIdentifier(parent.id)) {
        const varName = parent.id.name.toLowerCase();
        if (/(secret|token|password|apikey|credential)/.test(varName)) {
            confidence = "CERTAIN";
            if (severity === "INFO") {
                severity = "HIGH";
                title = "Generic Secret Token";
            }
            context = `Assigned to sensitive variable name: '${varName}'`;
        }
    } else if (t.isObjectProperty(parent) && t.isIdentifier(parent.key)) {
        const keyName = parent.key.name.toLowerCase();
        if (/(secret|token|password|apikey|credential)/.test(keyName)) {
            confidence = "CERTAIN";
            if (severity === "INFO") {
                severity = "HIGH";
                title = "Generic Secret Property";
            }
            context = `Assigned to sensitive object property: '${keyName}'`;
        }
    }

    if (
        confidence === "TENTATIVE" &&
        severity === "INFO" &&
        calculateEntropy(value) < 4.0
    ) {
        return null;
    }

    return {
        id: generateFindingId("SECRET", value),
        category: "SECRET",
        severity,
        confidence,
        title,
        evidence: `${value.substring(0, 5)}...[REDACTED]`,
        sourceFile,
        line: path.node.loc?.start.line || 0,
        context,
        occurrences: 1,
        relatedLocations: [],
    };
}
