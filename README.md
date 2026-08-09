#### How It Works

```text
Target JS
   ↓
Source Map Discovery
   ↓
Extract .map
   ↓
Source Reconstruction
   ↓
Source Analysis
   ├── Secret Detection
   ├── Entropy Analysis
   └── API Endpoint Extraction
   ↓
Findings
```

#### Technology Stack

| Component | Technology | Purpose |
| --- | --- | --- |
| Runtime | Node.js | CLI |
| Source map parsing | Mozilla `source-map` | Reconstruction |
| Secret detection | TruffleHog-style regexes | Pattern scanning |

#### Installation

*Note: The package name and repository are placeholders until the initial release.*

**Prerequisites:**

* Node.js (v16 or higher)
* npm or yarn

**Via npm:**

```bash
npm install -g <placeholder-package-name>
```

**From Source:**

```bash
git clone https://github.com/nurfihsn/js-source-map-archaeologist.git
cd js-source-map-archaeologist
npm install
npm run build
npm link
```

#### Usage

*Note: Commands and flags are proposals for the MVP.*

**Remote Target Analysis:**

```bash
jsma scan https://example.com/static/js/main.js
```

**Local Source Map Analysis:**

```bash
jsma analyze ./local-path/main.js.map --output ./reconstructed-source/

```

**Example Output:**

```text
[*] Attempting to fetch source map from https://example.com/static/js/main.js.map
[*] Source map found. Reconstructing source tree...
[*] Reconstructed 142 files.
[*] Initiating security analysis...

[FINDING] Potential API Endpoint
  - File: webpack:/src/api/config.js
  - Line: 12
  - Match: "https://internal-dev-api.example.com/v1/"

[FINDING] Potential Hardcoded Secret
  - File: webpack:/src/components/Auth.jsx
  - Line: 45
  - Match: "AKIA[REDACTED]"
  - Type: AWS Access Key ID

[*] Scan complete. Results saved to jsma-report.json.

```