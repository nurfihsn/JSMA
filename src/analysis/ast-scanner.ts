import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import { ExtractedFile, Finding } from '../types';
import crypto from 'crypto';

export function analyzeFile(file: ExtractedFile): Finding[] {
    const findings: Finding[] = [];

    if (file.isVendor) return findings;

    try {
        const ast = parse(file.content, {
            sourceType: 'unambiguous',
            plugins: ['typescript', 'jsx'],
            errorRecovery: true,
        });

        traverse(ast, {
            CallExpression(path) {
                const callee = path.node.callee;
                let isHttpCall = false;

                if (callee.type === 'Identifier' && callee.name === 'fetch') isHttpCall = true;
                else if (callee.type === 'MemberExpression' && callee.object.type === 'Identifier' && callee.object.name === 'axios') isHttpCall = true;

                if (isHttpCall && path.node.arguments.length > 0) {
                    const arg0 = path.node.arguments[0];
                    if (arg0.type === 'StringLiteral') {
                        let severity: Finding['severity'] = 'LOW';

                        if (/(admin|internal|debug|v1|graphql)/i.test(arg0.value)) severity = 'HIGH';

                        findings.push(createFinding('ENDPOINT', severity, 0.9, file.path, arg0.loc?.start.line || 0, `HTTP Call to: ${arg0.value}`, `Static Endpoint Discovered`));
                    }
                }
            },

            StringLiteral(path) {
                const val = path.node.value;
                if (val.length < 5) return;

                if (val.includes('.internal') || val.includes('localhost:')) {
                    findings.push(createFinding('HOST', 'MEDIUM', 0.9, file.path, path.node.loc?.start.line || 0, val, 'Internal host/domain hardcoded'));
                }

                if (/^(AKIA|Bearer |ghp_|sk_live_)/.test(val)) {
                    findings.push(createFinding('SECRET', 'CRITICAL', 0.95, file.path, path.node.loc?.start.line || 0, `${val.substring(0, 15)}...`, 'Hardcoded Credential / Token'));
                }
            },

            JSXOpeningElement(path) {
                if (path.node.name.type === 'JSXIdentifier' && (path.node.name.name === 'Route' || path.node.name.name === 'Link')) {
                    const pathAttr = path.node.attributes.find(
                        attr => attr.type === 'JSXAttribute' && attr.name.name === (path.node.name.name === 'Route' ? 'path' : 'to')
                    );

                    if (pathAttr && pathAttr.value && pathAttr.value.type === 'StringLiteral') {
                        const routePath = pathAttr.value.value;
                        if (routePath.length > 1 && !routePath.includes('*')) {
                            let severity: Finding['severity'] = 'LOW';
                            if (/(admin|debug|dev|test|internal|staging|management)/i.test(routePath)) severity = 'HIGH';
                            else if (/(user|profile|dashboard|api)/i.test(routePath)) severity = 'MEDIUM';

                            findings.push(createFinding('ROUTE', severity, 0.85, file.path, path.node.loc?.start.line || 0, `UI Route: ${routePath}`, 'Frontend UI Route Discovered'));
                        }
                    }
                }
            },

            ObjectProperty(path) {
                if (path.node.key.type === 'Identifier' && path.node.key.name === 'path') {
                    if (path.node.value.type === 'StringLiteral') {
                        const routePath = path.node.value.value;
                        if (routePath.length > 1) {
                            let severity: Finding['severity'] = 'LOW';
                            if (/(admin|debug|dev|test|internal|staging|management)/i.test(routePath)) severity = 'HIGH';

                            findings.push(createFinding('ROUTE', severity, 0.8, file.path, path.node.loc?.start.line || 0, `Route Object: ${routePath}`, 'Frontend UI Route Discovered'));
                        }
                    }
                }
            }
        });
    } catch (e) {

    }

    return findings;
}

function createFinding(type: Finding['type'], severity: Finding['severity'], confidence: number, sourceFile: string, line: number, evidence: string, title: string): Finding {
    const id = crypto.createHash('md5').update(`${type}-${sourceFile}-${line}-${evidence}`).digest('hex');
    return { id, type, severity, confidence, sourceFile, line, evidence, title, occurrences: 1 };
}