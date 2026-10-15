#### JSMA

JSMA is a pro grade security research tool designed to automatically discover JavaScript Source Maps, safely reconstruct the original source tree, and perform **AST based security analysis** to uncover hidden API endpoints, frontend routes, and hardcoded secrets. 

Unlike standard downloader scripts that rely on noisy regex patterns, JSMA understands JavaScript semantically. It cuts through the noise, ignores vendor libraries, deduplicates findings, and delivers high confidence intelligence directly to your terminal.

#### How It Works

```text
Target JS
   ↓
SafeNetworkClient (SSRF & Resource Exhaustion Protection)
   ↓
Extract .map (URL / Inline Base64 / Fallbacks)
   ↓
Safe Source Reconstruction (Strict LFI Prevention)
   ↓
Babel AST Analysis Engine
   ├── React/Vue Router Parser
   ├── HTTP Call Extraction
   └── Context-Aware Secret Analysis
   ↓
Smart Deduplication Engine
   ↓
Findings (Terminal Dashboard & JSON Report)
```

#### Technology Stack

| Component | Technology | Purpose |
| --- | --- | --- |
| Runtime | Node.js | CLI |
| Source Map Engine | `source-map-js` | Virtual tree reconstruction |
| AST Parser | `@babel/parser & traverse` | Semantic code analysis & routing discovery |
| UI & CLI | `commander, ora, cli-table3` | Terminal & loaders |


#### Key Features

* **Context Aware Secret Detection:** No more blind regex false positives. JSMA analyzes AST node parents to ensure strings are actually assigned to sensitive identifiers.
* **Smart Deduplication:** Groups identical endpoints called across multiple files to keep your terminal clean.
* **Safe Reconstruction:** The storage engine strictly normalizes paths and blocks directory traversal attempts or symlink overwrites.
* **Framework Aware AST:** Automatically detects React Router to hunt for hidden frontend panels.
* **Stealth Mode:** Bypasses strict TLS/SSL verification and injects Chrome User-Agents by default to prevent getting blocked by WAFs.
* **Batch Scanning:** Feed it a `.txt` file with hundreds of JS URLs, and it will scan them sequentially without crashing.
* **Noise Reduction:** Automatically ignores code from `node_modules` or vendor files to focus on custom developer logic.

#### Installation

**Prerequisites:**

* Node.js (v20 or higher recommended)
* npm or yarn

**From Source:**

```bash
git clone https://github.com/nurfihsn/JSMA.git
cd JSMA
npm install
npm run build
npm link
```
*Note: `npm link` allows you to use the `jsma` command globally from anywhere in your terminal.*

#### Usage

**Remote Target Analysis:**

```bash
jsma scan https://example.com/static/js/main.js
```

**Batch Scanning:**
Provide a text file containing a list of JavaScript URLs.

```bash
jsma scan alive-js-urls.txt -o ./reconstructed_dump -j master_report.json
```

**Authenticated Scan:**
Bypass authentication walls by injecting your session cookies or tokens.

```bash
jsma scan https://staging.target.com/app.js -H "Cookie: session_id=123" -H "Authorization: Bearer token"
```

**Local Source Map Analysis:**
If you already have a .map file downloaded locally.

```bash
jsma local ./local-path/main.js.map --out-dir ./reconstructed-source/
```

**Example Output:**

```text
       ██╗███████╗███╗   ███╗ █████╗ 
       ██║██╔════╝████╗ ████║██╔══██╗
       ██║███████╗██╔████╔██║███████║
  ██   ██║╚════██║██║╚██╔╝██║██╔══██║
  ╚█████╔╝███████║██║ ╚═╝ ██║██║  ██║
   ╚════╝ ╚══════╝╚═╝     ╚═╝╚═╝  ╚═╝
  SourceMap Security Framework v1.0.0-Elite

 [+] Local Target: react-dummy.map
 
✔ Analysis complete. Found 3 unique issues.

┌──────────────┬──────────────────┬────────────────────────────────────────┬────────────────────────────────────────┐
│ Severity     │ Type             │ Location                               │ Evidence                               │
├──────────────┼──────────────────┼────────────────────────────────────────┼────────────────────────────────────────┤
│ CRITICAL     │ SECRET           │ src/config/aws.ts                      │ AKIAIOSFODNN7EXAMPLE...                │
│              │                  │ Line: 12                               │                                        │
├──────────────┼──────────────────┼────────────────────────────────────────┼────────────────────────────────────────┤
│ HIGH         │ FRONTEND_ROUTE   │ src/App.jsx                            │ /admin/super-secret-panel              │
│              │                  │ Line: 45                               │                                        │
├──────────────┼──────────────────┼────────────────────────────────────────┼────────────────────────────────────────┤
│ HIGH         │ API_ENDPOINT     │ src/pages/Admin.jsx                    │ /api/v1/internal/admin                 │
│              │                  │ Line: 22                               │                                        │
│              │                  │ [+2 occurrences]                       │                                        │
└──────────────┴──────────────────┴────────────────────────────────────────┴────────────────────────────────────────┘
```
---

#### Disclaimer

This tool is intended for authorized security research, bug bounty programs, and penetration testing only. Do not use it against targets you do not have permission to test.