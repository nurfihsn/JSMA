import { NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import { Finding, generateFindingId } from "../../findings/schema";

export function evaluateForRoutes(
    path: NodePath<t.Node>,
    sourceFile: string,
): Finding | null {
    let routePath = "";

    // <Route path="/admin" />
    if (path.isJSXOpeningElement()) {
        const nameNode = path.node.name;
        if (
            t.isJSXIdentifier(nameNode) &&
            (nameNode.name === "Route" || nameNode.name === "Link")
        ) {
            const pathAttr = path.node.attributes.find(
                (attr) =>
                    t.isJSXAttribute(attr) &&
                    attr.name.name === (nameNode.name === "Route" ? "path" : "to"),
            );
            if (
                pathAttr &&
                t.isJSXAttribute(pathAttr) &&
                t.isStringLiteral(pathAttr.value)
            ) {
                routePath = pathAttr.value.value;
            }
        }
    }
    // { path: '/admin', element: <Admin/> }
    else if (path.isObjectProperty()) {
        if (
            t.isIdentifier(path.node.key, { name: "path" }) &&
            t.isStringLiteral(path.node.value)
        ) {
            routePath = path.node.value.value;
        }
    }

    if (!routePath || routePath === "/" || routePath.includes("*")) return null;

    let severity: Finding["severity"] = "LOW";
    if (
        /(admin|debug|dev|test|internal|staging|management|sys)/i.test(routePath)
    ) {
        severity = "HIGH";
    } else if (/(user|profile|dashboard|api)/i.test(routePath)) {
        severity = "MEDIUM";
    }

    return {
        id: generateFindingId("FRONTEND_ROUTE", routePath),
        category: "FRONTEND_ROUTE",
        severity,
        confidence: "FIRM",
        title: "Frontend UI Route Discovered",
        evidence: routePath,
        sourceFile,
        line: path.node.loc?.start.line || 0,
        occurrences: 1,
        relatedLocations: [],
    };
}
