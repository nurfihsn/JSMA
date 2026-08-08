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

                if (callee.type === 'Identifier' && callee.name === 'fetch') {
                    isHttpCall = true;
                } else if (callee.type === 'MemberExpression' &&
                    callee.object.type === 'Identifier' &&
                    callee.object.name === 'axios') {
                    isHttpCall = true;
                }

                if (isHttpCall && path.node.arguments.length > 0) {
                    const arg0 = path.node.arguments[0];
                    if (arg0.type === 'StringLiteral') {
                        findings.push(createFinding(
                            'ENDPOINT',
                            'HIGH',
                            0.9,
                            file.path,
                            arg0.loc?.start.line || 0,
                            `HTTP Call to: ${arg0.value}`,
                            `Discovered static endpoint`
                        ));
                    }
                }
            },

            StringLiteral(path) {
                const val = path.node.value;
                if (val.length < 5) return;

                if (val.includes('.internal') || val.includes('localhost:')) {
                    findings.push(createFinding(
                        'HOST',
                        'MEDIUM',
                        0.9,
                        file.path,
                        path.node.loc?.start.line || 0,
                        val,
                        'Internal host/domain hardcoded'
                    ));
                }

                if (/^(AKIA|Bearer |ghp_|sk_live_)/.test(val)) {
                    findings.push(createFinding(
                        'SECRET',
                        'CRITICAL',
                        0.95,
                        file.path,
                        path.node.loc?.start.line || 0,
                        `${val.substring(0, 15)}...`,
                        'Hardcoded Credential / Token'
                    ));
                }
            }
        });
    } catch (e) {

    }

    return findings;
}

function createFinding(type: Finding['type'], severity: Finding['severity'], confidence: number, sourceFile: string, line: number, evidence: string, title: string): Finding {
    const id = crypto.createHash('md5').update(`${type}-${sourceFile}-${line}-${evidence}`).digest('hex');
    return { id, type, severity, confidence, sourceFile, line, evidence, title };
}