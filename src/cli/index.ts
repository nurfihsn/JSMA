#!/usr/bin/env node

import { Command } from "commander";
import fs from "fs";
import path from "path";
import chalk from "chalk";
import ora from "ora";
import Table from "cli-table3";

import { JSMAOrchestrator } from "../core/orchestrator";
import { SourceMapDiscovery } from "../discovery/discovery";
import { JsonReporter } from "../reporters/json";
import { HtmlReporter } from "../reporters/html";

const program = new Command();
const VERSION = "1.0.0-Elite";

function printBanner() {
    console.log(
        chalk.cyan.bold(`
       ██╗███████╗███╗   ███╗ █████╗ 
       ██║██╔════╝████╗ ████║██╔══██╗
       ██║███████╗██╔████╔██║███████║
  ██   ██║╚════██║██║╚██╔╝██║██╔══██║
  ╚█████╔╝███████║██║ ╚═╝ ██║██║  ██║
   ╚════╝ ╚══════╝╚═╝     ╚═╝╚═╝  ╚═╝
  SourceMap Security Framework v${VERSION}
`),
    );
}

function getSeverityColor(severity: string) {
    switch (severity) {
        case "CRITICAL":
            return chalk.bgRed.white.bold(` ${severity} `);
        case "HIGH":
            return chalk.red.bold(severity);
        case "MEDIUM":
            return chalk.yellow.bold(severity);
        case "LOW":
            return chalk.blue.bold(severity);
        default:
            return chalk.gray(severity);
    }
}

function collectHeaders(value: string, previous: string[]) {
    return previous.concat([value]);
}

function printFindingsTable(findings: any[]) {
    if (findings.length === 0) return;

    const table = new Table({
        head: [
            chalk.white.bold("Severity"),
            chalk.white.bold("Type"),
            chalk.white.bold("Location"),
            chalk.white.bold("Evidence"),
        ],
        style: { head: [], border: ["gray"] },
        wordWrap: true,
        colWidths: [14, 18, 40, 45],
    });

    findings.forEach((f) => {
        let locationDisplay = `${chalk.cyan(f.sourceFile)}\nLine: ${f.line}`;
        if (f.occurrences > 1) {
            locationDisplay += chalk.magenta(`\n[+${f.occurrences - 1} occurrences]`);
        }

        table.push([
            getSeverityColor(f.severity),
            f.category,
            locationDisplay,
            chalk.gray(
                f.evidence.length > 100
                    ? f.evidence.substring(0, 97) + "..."
                    : f.evidence,
            ),
        ]);
    });
    console.log(table.toString());
}

program
    .name("jsma")
    .description(
        "Enterprise Grade JavaScript Source Map Static Analysis Framework",
    )
    .version(VERSION);

program
    .command("local")
    .description("Analyze a local .map file")
    .argument("<file>", "Path to local .map file")
    .option(
        "-o, --out-dir <dir>",
        "Dump reconstructed source files safely",
    )
    .option("-j, --json-out <file>", "Save findings to JSON")
    .option("--html-out <file>", "Save findings to an interactive HTML Dashboard")
    .action(async (file, options) => {
        printBanner();
        console.log(chalk.bold.blue(`[+] Local Target: `) + file + "\n");
        const spinner = ora("Initializing Pipeline...").start();

        try {
            const rawMap = fs.readFileSync(file, "utf-8");
            spinner.text = "Running AST Security Analysis...";

            const result = await JSMAOrchestrator.executeScan(
                file,
                true,
                rawMap,
                options.outDir,
            );

            spinner.succeed(
                `Analysis complete. Found ${chalk.bold(result.findings.length)} unique issues.`,
            );
            printFindingsTable(result.findings);

            if (options.jsonOut) {
                JsonReporter.generate(result, options.jsonOut);
                console.log(
                    chalk.green(`\n[✓] JSON report saved to: ${options.jsonOut}`),
                );
            }

            if (options.htmlOut) {
                HtmlReporter.generate(
                    file,
                    result.metrics,
                    result.findings,
                    options.htmlOut,
                );
                console.log(
                    chalk.green(`[✓] HTML Dashboard saved to: ${options.htmlOut}`),
                );
            }
        } catch (err: any) {
            spinner.fail(chalk.red(`Analysis Failed: ${err.message}`));
        }
    });

program
    .command("scan")
    .description("Scan a URL or text file containing multiple URLs")
    .argument("<input>", "Target URL or .txt file")
    .option("-o, --out-dir <dir>", "Dump reconstructed files safely")
    .option("-j, --json-out <file>", "Save master JSON report")
    .option("--html-out <file>", "Save aggregated findings to an HTML Dashboard")
    .option(
        "-H, --header <value>",
        'Custom HTTP header (e.g. "Cookie: session=123")',
        collectHeaders,
        [],
    )
    .option(
        "-k, --insecure",
        "Bypass TLS certificate verification (Warning: Use for intended targets only)",
    )
    .action(async (input, options) => {
        printBanner();

        const customHeaders: Record<string, string> = {};
        if (options.header && options.header.length > 0) {
            options.header.forEach((h: string) => {
                const parts = h.split(":");
                if (parts.length >= 2)
                    customHeaders[parts[0].trim()] = parts.slice(1).join(":").trim();
            });
        }

        let urls: string[] = [];
        if (input.startsWith("http://") || input.startsWith("https://")) {
            urls.push(input);
        } else {
            try {
                const fileContent = fs.readFileSync(input, "utf-8");
                urls = fileContent
                    .split("\n")
                    .map((line) => line.trim())
                    .filter((line) => line.startsWith("http"));
                console.log(chalk.gray(`[i] Batch mode: Loaded ${urls.length} URLs\n`));
            } catch (err: any) {
                return console.error(chalk.red(`[✖] Failed to read file ${input}`));
            }
        }

        if (urls.length === 0)
            return console.log(chalk.red(`[✖] No valid URLs found.`));
        if (options.insecure)
            console.log(
                chalk.yellow(
                    `[!] Warning: Running in Insecure TLS mode (--insecure).\n`,
                ),
            );

        const allResults = [];
        let successCount = 0;

        for (let i = 0; i < urls.length; i++) {
            const url = urls[i];
            console.log(
                chalk.bold.bgBlue.white(` TARGET ${i + 1}/${urls.length} `) +
                chalk.blue(` ${url}`),
            );

            const spinner = ora("Downloading Source Map...").start();

            try {
                const rawMap = await SourceMapDiscovery.discover(
                    url,
                    customHeaders,
                    options.insecure,
                );
                spinner.text = "Running AST Orchestrator...";

                const parsedUrl = new URL(url);
                let targetOutDir = options.outDir;
                if (options.outDir && urls.length > 1) {
                    const safeName =
                        parsedUrl.hostname + "_" + path.basename(parsedUrl.pathname);
                    targetOutDir = path.join(options.outDir, safeName);
                }

                const result = await JSMAOrchestrator.executeScan(
                    url,
                    false,
                    rawMap,
                    targetOutDir,
                );

                spinner.succeed(
                    `Analysis complete. Reconstructed ${result.metrics.analyzedFiles} developer files.`,
                );
                printFindingsTable(result.findings);

                allResults.push(result);
                successCount++;
            } catch (err: any) {
                spinner.fail(chalk.red(`Target skipped.`));
                const reason = err.cause
                    ? err.cause.message || err.cause.code
                    : err.message;
                console.log(chalk.gray(`  └─ Reason: ${reason}`));
            }
            console.log("");
        }

        console.log(chalk.cyan(`╔════════════════════════════════════════════╗`));
        console.log(
            chalk.cyan(`║ `) +
            chalk.bold(`ENTERPRISE SCAN SUMMARY`) +
            chalk.cyan(`                    ║`),
        );
        console.log(chalk.cyan(`╠════════════════════════════════════════════╣`));
        console.log(
            chalk.cyan(`║ `) +
            `Total Targets : ${urls.length.toString().padEnd(26)}` +
            chalk.cyan(`║`),
        );
        console.log(
            chalk.cyan(`║ `) +
            `Successful    : ${chalk.green(successCount.toString().padEnd(26))}` +
            chalk.cyan(`║`),
        );
        console.log(chalk.cyan(`╚════════════════════════════════════════════╝\n`));

        if (options.jsonOut) {
            const masterReport = {
                scanDate: new Date().toISOString(),
                totalTargets: urls.length,
                successful: successCount,
                results: allResults,
            };
            JsonReporter.generate(masterReport, options.jsonOut);
            console.log(
                chalk.green(`[✓] Master Security JSON saved to: `) +
                chalk.bold(options.jsonOut),
            );
        }

        if (options.htmlOut) {
            const aggregatedFindings = allResults.flatMap((r) => r.findings);
            const aggregatedMetrics = {
                analyzedFiles: allResults.reduce(
                    (acc, r) => acc + r.metrics.analyzedFiles,
                    0,
                ),
                totalFindings: aggregatedFindings.length,
            };
            HtmlReporter.generate(
                "Batch Scan Execution",
                aggregatedMetrics,
                aggregatedFindings,
                options.htmlOut,
            );
            console.log(
                chalk.green(`[✓] Master HTML Dashboard saved to: `) +
                chalk.bold(options.htmlOut),
            );
        }
    });

program.parse();
