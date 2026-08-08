#!/usr/bin/env node

import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { extractSources } from '../sourcemap/extractor';
import { analyzeFile } from '../analysis/ast-scanner';
import { Finding, ExtractedFile } from '../types';
import { findAndDownloadSourceMap } from '../discovery/detector';

const program = new Command();

program
    .name('jsma')
    .description('JS-SourceMap-Archaeologist - Security Intelligence from Source Maps')
    .version('0.1.0');

function collectHeaders(value: string, previous: string[]) {
    return previous.concat([value]);
}

function dumpSources(files: ExtractedFile[], outDir: string) {
    console.log(`[i] Dumping reconstructed files to directory: ${outDir}`);
    let dumpedCount = 0;
    files.forEach(f => {
        const safePath = f.path.replace(/^(\.\.[\/\\])+/, '');
        const fullPath = path.resolve(outDir, safePath);
        if (fullPath.startsWith(path.resolve(outDir))) {
            fs.mkdirSync(path.dirname(fullPath), { recursive: true });
            fs.writeFileSync(fullPath, f.content, 'utf-8');
            dumpedCount++;
        }
    });
    console.log(chalk.green(`[+] Successfully saved ${dumpedCount} files to disk.`));
}

function runAnalysisPipeline(rawMap: string, targetName: string, outDir?: string, jsonOut?: string) {
    console.log(`[i] Parsing source map...`);

    if (!rawMap.includes('"sourcesContent"')) {
        console.log(chalk.yellow(`[!] Warning: This source map does NOT contain inline source code (sourcesContent is missing). AST Analysis cannot be performed.`));
    }

    const files = extractSources(rawMap);
    console.log(chalk.green(`[+] Reconstructed ${files.length} source files (${files.filter(f => !f.isVendor).length} non-vendor)`));

    if (outDir) dumpSources(files, outDir);

    const allFindings: Finding[] = [];

    if (files.length > 0) {
        console.log(`[i] Running AST Security Analysis...`);
        files.forEach(f => {
            const fileFindings = analyzeFile(f);
            allFindings.push(...fileFindings);
        });
    }

    if (jsonOut) {
        const report = {
            target: targetName,
            timestamp: new Date().toISOString(),
            metrics: {
                totalFiles: files.length,
                analyzedFiles: files.filter(f => !f.isVendor).length,
                totalFindings: allFindings.length
            },
            findings: allFindings
        };
        fs.writeFileSync(jsonOut, JSON.stringify(report, null, 2), 'utf-8');
        console.log(chalk.green(`[+] JSON report saved to: ${jsonOut}`));
    }

    console.log(chalk.cyan(`\n────────────────────────────────────\nSecurity Intelligence\n────────────────────────────────────\n`));

    if (allFindings.length === 0) {
        console.log(chalk.gray(`[i] No security findings discovered in non-vendor files.`));
    }

    allFindings.forEach(f => {
        let color = chalk.white;
        if (f.severity === 'CRITICAL') color = chalk.red.bold;
        else if (f.severity === 'HIGH') color = chalk.red;
        else if (f.severity === 'MEDIUM') color = chalk.yellow;
        else if (f.severity === 'LOW') color = chalk.blue;

        console.log(color(`[${f.severity}] ${f.title}`));
        console.log(`       File: ${f.sourceFile}:${f.line}`);
        console.log(`       Evidence: ${f.evidence}`);
        console.log(`       Confidence: ${f.confidence}`);
        console.log('');
    });

    console.log(chalk.green(`\n[+] Analysis complete. Found ${allFindings.length} issues.`));
}

program
    .command('local')
    .description('Analyze a local .map file')
    .argument('<file>', 'Path to local .map file')
    .option('-o, --out-dir <dir>', 'Dump reconstructed source files to a directory')
    .option('-j, --json-out <file>', 'Save findings to a JSON file')
    .action((file, options) => {
        console.log(chalk.cyan(`[+] JS-SourceMap-Archaeologist v0.1.0`));
        try {
            const rawMap = fs.readFileSync(file, 'utf-8');
            runAnalysisPipeline(rawMap, file, options.outDir, options.jsonOut);
        } catch (err: any) {
            console.error(chalk.red(`[-] Error: ${err.message}`));
        }
    });

program
    .command('scan')
    .description('Scan a remote JavaScript file for source maps')
    .argument('<url>', 'URL of the target JavaScript file')
    .option('-o, --out-dir <dir>', 'Dump reconstructed source files to a directory')
    .option('-j, --json-out <file>', 'Save findings to a JSON file')
    .option('-H, --header <value>', 'Custom HTTP header', collectHeaders, [])
    .action(async (url, options) => {
        console.log(chalk.cyan(`[+] JS-SourceMap-Archaeologist v0.1.0`));
        const customHeaders: Record<string, string> = {};
        if (options.header && options.header.length > 0) {
            options.header.forEach((h: string) => {
                const parts = h.split(':');
                if (parts.length >= 2) customHeaders[parts[0].trim()] = parts.slice(1).join(':').trim();
            });
        }

        try {
            new URL(url);
            const rawMap = await findAndDownloadSourceMap(url, customHeaders);
            runAnalysisPipeline(rawMap, url, options.outDir, options.jsonOut);
        } catch (err: any) {
            console.error(chalk.red(`[-] Error: ${err.message}`));
        }
    });

program.parse();