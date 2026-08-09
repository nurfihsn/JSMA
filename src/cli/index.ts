#!/usr/bin/env node

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import { extractSources } from '../sourcemap/extractor';
import { analyzeFile } from '../analysis/ast-scanner';
import { Finding, ExtractedFile } from '../types';
import { findAndDownloadSourceMap } from '../discovery/detector';

const program = new Command();
const VERSION = '0.1.1';

function printBanner() {
    console.log(chalk.cyan.bold(`
       ██╗███████╗███╗   ███╗ █████╗ 
       ██║██╔════╝████╗ ████║██╔══██╗
       ██║███████╗██╔████╔██║███████║
  ██   ██║╚════██║██║╚██╔╝██║██╔══██║
  ╚█████╔╝███████║██║ ╚═╝ ██║██║  ██║
   ╚════╝ ╚══════╝╚═╝     ╚═╝╚═╝  ╚═╝
  SourceMap Security Archaeologist v${VERSION}
`));
}

function getSeverityColor(severity: string) {
    switch (severity) {
        case 'CRITICAL': return chalk.bgRed.white.bold(` ${severity} `);
        case 'HIGH': return chalk.red.bold(severity);
        case 'MEDIUM': return chalk.yellow.bold(severity);
        case 'LOW': return chalk.blue.bold(severity);
        default: return chalk.gray(severity);
    }
}

function collectHeaders(value: string, previous: string[]) {
    return previous.concat([value]);
}

function dumpSources(files: ExtractedFile[], targetOutDir: string, spinner: ora.Ora) {
    let dumpedCount = 0;
    files.forEach(f => {
        const safePath = f.path.replace(/^(\.\.[\/\\])+/, '');
        const fullPath = path.resolve(targetOutDir, safePath);
        if (fullPath.startsWith(path.resolve(targetOutDir))) {
            fs.mkdirSync(path.dirname(fullPath), { recursive: true });
            fs.writeFileSync(fullPath, f.content, 'utf-8');
            dumpedCount++;
        }
    });
    spinner.succeed(`Saved ${dumpedCount} files to ${chalk.cyan(targetOutDir)}`);
}

function runAnalysisPipeline(rawMap: string, targetName: string, outDir?: string) {
    const spinner = ora('Parsing Source Map...').start();

    if (!rawMap.includes('"sourcesContent"')) {
        spinner.warn(chalk.yellow(`Source map missing inline code (sourcesContent). AST Analysis skipped.`));
        return { target: targetName, metrics: { totalFiles: 0, analyzedFiles: 0, totalFindings: 0 }, findings: [] };
    }

    const files = extractSources(rawMap);
    const nonVendorFiles = files.filter(f => !f.isVendor);
    spinner.succeed(`Reconstructed ${chalk.bold(files.length)} files (${chalk.green(nonVendorFiles.length + ' non-vendor')})`);

    if (outDir) {
        spinner.start('Dumping files to disk...');
        dumpSources(files, outDir, spinner);
    }

    const allFindings: Finding[] = [];
    if (files.length > 0) {
        spinner.start('Running AST Security Analysis...');
        files.forEach(f => {
            allFindings.push(...analyzeFile(f));
        });

        const dedupedFindings = new Map<string, Finding>();

        allFindings.forEach(f => {
            const signature = `${f.type}-${f.evidence}`;

            if (dedupedFindings.has(signature)) {
                const existing = dedupedFindings.get(signature)!;
                existing.occurrences = (existing.occurrences || 1) + 1;

                if (!existing.otherLocations) existing.otherLocations = [];
                const locStr = `${f.sourceFile}:${f.line}`;

                if (!existing.otherLocations.includes(locStr) && existing.otherLocations.length < 3) {
                    existing.otherLocations.push(locStr);
                }
            } else {
                f.otherLocations = [];
                dedupedFindings.set(signature, f);
            }
        });

        const finalFindings = Array.from(dedupedFindings.values());

        spinner.succeed(`Analysis complete. Found ${chalk.bold(finalFindings.length)} unique issues (from ${allFindings.length} total hits).`);

        if (finalFindings.length > 0) {
            const table = new Table({
                head: [chalk.white.bold('Severity'), chalk.white.bold('Type'), chalk.white.bold('Location'), chalk.white.bold('Evidence')],
                style: { head: [], border: ['gray'] },
                wordWrap: true,
                colWidths: [14, 18, 40, 40]
            });

            const severityWeight: Record<string, number> = { 'CRITICAL': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1, 'INFO': 0 };
            finalFindings.sort((a, b) => severityWeight[b.severity] - severityWeight[a.severity]);

            finalFindings.forEach(f => {
                let locationDisplay = `${chalk.cyan(f.sourceFile)}\nLine: ${f.line}`;

                if (f.occurrences && f.occurrences > 1) {
                    locationDisplay += chalk.gray(`\n(+${f.occurrences - 1} other places)`);
                }

                table.push([
                    getSeverityColor(f.severity),
                    f.type,
                    locationDisplay,
                    chalk.gray(f.evidence.length > 100 ? f.evidence.substring(0, 97) + '...' : f.evidence)
                ]);
            });
            console.log(table.toString());
        } else if (nonVendorFiles.length > 0) {
            console.log(chalk.gray(`  └─ No security findings discovered.`));
        }

        return {
            target: targetName,
            metrics: { totalFiles: files.length, analyzedFiles: nonVendorFiles.length, totalFindings: finalFindings.length },
            findings: finalFindings
        };
    }
}

program
    .name('jsma')
    .description('JS-SourceMap-Archaeologist - Security Intelligence from Source Maps')
    .version(VERSION);

program
    .command('local')
    .description('Analyze a local .map file')
    .argument('<file>', 'Path to local .map file')
    .option('-o, --out-dir <dir>', 'Dump reconstructed source files')
    .option('-j, --json-out <file>', 'Save findings to JSON')
    .action((file, options) => {
        printBanner();
        console.log(chalk.bold.blue(`[+] Target: `) + file + '\n');
        try {
            const rawMap = fs.readFileSync(file, 'utf-8');
            const result = runAnalysisPipeline(rawMap, file, options.outDir);

            if (options.jsonOut) {
                fs.writeFileSync(options.jsonOut, JSON.stringify(result, null, 2), 'utf-8');
                console.log(chalk.green(`\n[✓] JSON report saved to: ${options.jsonOut}`));
            }
        } catch (err: any) {
            console.error(chalk.red(`\n[✖] Error: ${err.message}`));
        }
    });

program
    .command('scan')
    .description('Scan a URL or text file containing multiple URLs')
    .argument('<input>', 'Target URL or .txt file')
    .option('-o, --out-dir <dir>', 'Dump reconstructed files')
    .option('-j, --json-out <file>', 'Save master JSON report')
    .option('-H, --header <value>', 'Custom HTTP header', collectHeaders, [])
    .action(async (input, options) => {
        printBanner();

        const customHeaders: Record<string, string> = {};
        if (options.header && options.header.length > 0) {
            options.header.forEach((h: string) => {
                const parts = h.split(':');
                if (parts.length >= 2) customHeaders[parts[0].trim()] = parts.slice(1).join(':').trim();
            });
        }

        let urls: string[] = [];
        if (input.startsWith('http://') || input.startsWith('https://')) {
            urls.push(input);
        } else {
            try {
                const fileContent = fs.readFileSync(input, 'utf-8');
                urls = fileContent.split('\n').map(line => line.trim()).filter(line => line.startsWith('http'));
                console.log(chalk.gray(`[i] Batch mode: Loaded ${urls.length} URLs\n`));
            } catch (err: any) {
                console.error(chalk.red(`[✖] Failed to read file ${input}`));
                return;
            }
        }

        if (urls.length === 0) return console.log(chalk.red(`[✖] No valid URLs found.`));

        const allResults = [];
        let successCount = 0;

        for (let i = 0; i < urls.length; i++) {
            const url = urls[i];
            console.log(chalk.bold.bgBlue.white(` TARGET ${i + 1}/${urls.length} `) + chalk.blue(` ${url}`));

            const spinner = ora('Fetching target...').start();

            try {
                const parsedUrl = new URL(url);
                let targetOutDir = options.outDir;
                if (options.outDir && urls.length > 1) {
                    const safeName = parsedUrl.hostname + '_' + path.basename(parsedUrl.pathname);
                    targetOutDir = path.join(options.outDir, safeName);
                }

                spinner.text = 'Downloading Source Map...';
                const rawMap = await findAndDownloadSourceMap(url, customHeaders);
                spinner.stop();

                const result = runAnalysisPipeline(rawMap, url, targetOutDir);
                allResults.push(result);
                successCount++;

            } catch (err: any) {
                spinner.fail(chalk.red(`Fetch failed`));
                const reason = err.cause ? (err.cause.message || err.cause.code) : err.message;
                console.log(chalk.gray(`  └─ Reason: ${reason}`));
            }
            console.log('');
        }

        console.log(chalk.cyan(`╔════════════════════════════════════════════╗`));
        console.log(chalk.cyan(`║ `) + chalk.bold(`SCAN SUMMARY`) + chalk.cyan(`                               ║`));
        console.log(chalk.cyan(`╠════════════════════════════════════════════╣`));
        console.log(chalk.cyan(`║ `) + `Total Targets : ${urls.length.toString().padEnd(26)}` + chalk.cyan(`║`));
        console.log(chalk.cyan(`║ `) + `Successful    : ${chalk.green(successCount.toString().padEnd(26))}` + chalk.cyan(`║`));
        console.log(chalk.cyan(`║ `) + `Failed        : ${chalk.red((urls.length - successCount).toString().padEnd(26))}` + chalk.cyan(`║`));
        console.log(chalk.cyan(`╚════════════════════════════════════════════╝\n`));

        if (options.jsonOut) {
            const masterReport = { scanDate: new Date().toISOString(), totalTargets: urls.length, successful: successCount, results: allResults };
            fs.writeFileSync(options.jsonOut, JSON.stringify(masterReport, null, 2), 'utf-8');
            console.log(chalk.green(`[✓] Master JSON report saved to: `) + chalk.bold(options.jsonOut));
        }
    });

program.parse();