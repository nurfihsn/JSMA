import fs from "fs";
import path from "path";
import { Finding } from "../findings/schema";

export class HtmlReporter {
    static generate(
        targetName: string,
        metrics: any,
        findings: Finding[],
        outputPath: string,
    ): void {
        const absolutePath = path.resolve(outputPath);
        const dir = path.dirname(absolutePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        const dateGenerated = new Date().toLocaleString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });

        const tableRows = findings
            .map((f) => {
                const severityStyle = this.getSeverityStyle(f.severity);
                const extraOccurrences =
                    f.occurrences > 1
                        ? `<span class="badge badge-neutral mt-1">+${f.occurrences - 1} more</span>`
                        : "";

                return `
                <tr>
                    <td>
                        <span class="badge" style="background-color: ${severityStyle.bg}; color: ${severityStyle.text}; border-color: ${severityStyle.border};">
                            ${f.severity}
                        </span>
                    </td>
                    <td class="text-light">${f.category}</td>
                    <td>
                        <div class="location-text">${f.sourceFile}:${f.line}</div>
                        ${extraOccurrences}
                    </td>
                    <td>
                        <div class="code-block">${this.escapeHtml(f.evidence)}</div>
                    </td>
                </tr>
                `;
            })
            .join("");

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>JSMA Security Report - ${targetName}</title>
    <style>
        :root {
            --bg-base: #0f172a;
            --bg-surface: #1e293b;
            --bg-surface-hover: #334155;
            --border-color: #334155;
            --text-main: #f8fafc;
            --text-muted: #94a3b8;
            --text-light: #cbd5e1;
            --primary: #3b82f6;
            --radius-md: 0.5rem;
            --radius-lg: 0.75rem;
            --font-sans: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            --font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            background-color: var(--bg-base);
            color: var(--text-main);
            font-family: var(--font-sans);
            line-height: 1.5;
            padding: 2rem 1rem;
            -webkit-font-smoothing: antialiased;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
        }

        header {
            margin-bottom: 2rem;
            padding-bottom: 1.5rem;
            border-bottom: 1px solid var(--border-color);
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
        }

        h1 { font-size: 1.875rem; font-weight: 700; letter-spacing: -0.025em; }
        .subtitle { color: var(--text-muted); font-size: 0.875rem; }

        /* Summary Cards Grid */
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 1.5rem;
            margin-bottom: 2.5rem;
        }

        .card {
            background-color: var(--bg-surface);
            border: 1px solid var(--border-color);
            border-radius: var(--radius-lg);
            padding: 1.5rem;
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
        }

        .card-label { color: var(--text-muted); font-size: 0.875rem; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; }
        .card-value { font-size: 1.5rem; font-weight: 600; color: var(--text-main); word-break: break-all; }

        /* Table Styles */
        .table-container {
            background: var(--bg-surface);
            border: 1px solid var(--border-color);
            border-radius: var(--radius-lg);
            overflow-x: auto; /* Responsive constraint */
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }

        table {
            width: 100%;
            border-collapse: collapse;
            text-align: left;
            min-width: 800px;
        }

        th {
            background-color: rgba(15, 23, 42, 0.4);
            color: var(--text-muted);
            font-size: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            padding: 1rem 1.5rem;
            border-bottom: 1px solid var(--border-color);
            font-weight: 600;
        }

        td {
            padding: 1rem 1.5rem;
            border-bottom: 1px solid var(--border-color);
            vertical-align: top;
        }

        tr:last-child td { border-bottom: none; }
        tr:hover td { background-color: rgba(255, 255, 255, 0.02); }

        .text-light { color: var(--text-light); font-weight: 500; }
        .location-text { color: var(--text-muted); font-family: var(--font-mono); font-size: 0.875rem; word-break: break-all; }

        /* Badges */
        .badge {
            display: inline-flex;
            align-items: center;
            padding: 0.25rem 0.625rem;
            border-radius: 9999px;
            font-size: 0.75rem;
            font-weight: 600;
            border: 1px solid transparent;
            text-transform: uppercase;
        }

        .badge-neutral {
            background-color: var(--bg-surface-hover);
            color: var(--text-light);
            border-color: var(--border-color);
        }

        .mt-1 { margin-top: 0.5rem; }

        /* Code Block */
        .code-block {
            background-color: #020617; /* Slate 950 */
            color: #4ade80; /* Green 400 */
            font-family: var(--font-mono);
            font-size: 0.8125rem;
            padding: 0.75rem 1rem;
            border-radius: var(--radius-md);
            border: 1px solid var(--border-color);
            overflow-x: auto;
            white-space: pre-wrap;
            word-break: break-word;
            max-width: 400px;
        }

        /* Empty State */
        .empty-state {
            text-align: center;
            padding: 3rem 1rem;
            color: var(--text-muted);
        }

        @media (max-width: 768px) {
            body { padding: 1rem; }
            .card-value { font-size: 1.25rem; }
            .code-block { max-width: 250px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>JSMA Security Intelligence</h1>
            <div class="subtitle">Generated on ${dateGenerated}</div>
        </header>

        <div class="summary-grid">
            <div class="card">
                <div class="card-label">Target Name</div>
                <div class="card-value">${targetName}</div>
            </div>
            <div class="card">
                <div class="card-label">Files Analyzed</div>
                <div class="card-value">${metrics.analyzedFiles}</div>
            </div>
            <div class="card">
                <div class="card-label">Total Findings</div>
                <div class="card-value">${findings.length} Issues</div>
            </div>
        </div>

        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th style="width: 120px;">Severity</th>
                        <th style="width: 150px;">Category</th>
                        <th style="width: 250px;">Location</th>
                        <th>Evidence</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows || `<tr><td colspan="4"><div class="empty-state">No security findings detected.</div></td></tr>`}
                </tbody>
            </table>
        </div>
    </div>
</body>
</html>`;

        fs.writeFileSync(absolutePath, html, "utf-8");
    }

    private static getSeverityStyle(severity: string) {
        const s = severity.toUpperCase();
        if (s === "CRITICAL")
            return {
                bg: "rgba(239, 68, 68, 0.1)",
                text: "#ef4444",
                border: "rgba(239, 68, 68, 0.2)",
            }; // Red
        if (s === "HIGH")
            return {
                bg: "rgba(249, 115, 22, 0.1)",
                text: "#f97316",
                border: "rgba(249, 115, 22, 0.2)",
            }; // Orange
        if (s === "MEDIUM")
            return {
                bg: "rgba(234, 179, 8, 0.1)",
                text: "#eab308",
                border: "rgba(234, 179, 8, 0.2)",
            }; // Yellow
        return {
            bg: "rgba(59, 130, 246, 0.1)",
            text: "#3b82f6",
            border: "rgba(59, 130, 246, 0.2)",
        }; // Blue
    }

    private static escapeHtml(unsafe: string): string {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}
