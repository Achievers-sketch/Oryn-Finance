# Dependency Security Remediation Guide

This document defines the process for identifying, triaging, and remediating security vulnerabilities in the Oryn Finance codebase. This covers NPM packages (for both `frontend` and `backend`) and Cargo packages (for smart contracts).

---

## 🔍 Security Monitoring Architecture

Our automated security pipeline consists of three defensive layers:

1. **Dependabot Alerts**: Monitors dependencies in real-time, opens automated pull requests for vulnerable packages, and alerts developers of security advisories.
2. **GitHub Actions Security Audit**: Runs `npm audit` on every pull request and push to the `main` branch, failing the pipeline if any **High** or **Critical** vulnerabilities are introduced.
3. **CodeQL SAST Scan**: Automatically performs semantic analysis of our TypeScript/JavaScript source code to detect potential security issues like Injection, XSS, and broken access controls.

---

## 🛠️ Step-by-Step Remediation Process

When a dependency vulnerability is detected, follow this step-by-step remediation process:

### Step 1: Triage and Prioritization
Analyze the vulnerability report to determine the severity and applicability. 

| Severity | Target SLA for Resolution | Description |
| :--- | :--- | :--- |
| **Critical** | **Within 24 Hours** | Vulnerability is highly exploitable and impacts core functionality or user assets. |
| **High** | **Within 3 Days** | Vulnerability has a known exploit but has mitigating factors. |
| **Medium** | **Within 14 Days** | Vulnerability is difficult to exploit or requires specific, non-default conditions. |
| **Low** | **Within 30 Days** | Vulnerability has minimal impact and no active exploits. |

### Step 2: Automated Patching

#### For NPM Packages (`frontend` or `backend`)
First, try resolving the vulnerability automatically using NPM's built-in audit engine:
```bash
# Navigate to the package directory
cd frontend   # or cd backend

# Run audit fix to automatically upgrade to non-vulnerable versions
npm audit fix
```

#### For Cargo Packages (`contracts`)
To update cargo dependencies, run:
```bash
cd contracts
cargo update
```

### Step 3: Manual Upgrades
If `npm audit fix` cannot resolve the issue without breaking changes, you must update the package manually:
1. Identify the package introducing the vulnerability from the `npm audit` report.
2. Check the recommended safe version.
3. Run `npm install package-name@latest` or update the package version in `package.json` and run `npm install`.

### Step 4: Overriding Transitive Dependencies
If a vulnerability exists in a nested (transitive) dependency and the top-level package has not released a fix, use NPM's `overrides` field in `package.json` to force a safe version:

Add the override to `package.json`:
```json
{
  "name": "oryn-backend",
  "dependencies": {
    "vulnerable-package": "^1.0.0"
  },
  "overrides": {
    "vulnerable-package": {
      "nested-transitive-package": "1.2.3"
    }
  }
}
```
Then run:
```bash
npm install
```

### Step 5: Handling Exceptions & False Positives
In rare cases, a vulnerability may not affect our application (e.g., a vulnerability in a development tool, or a vulnerability in code paths we do not use) and cannot be easily resolved.

To document and bypass the warning:
1. Ensure the exception is approved by the Security Lead.
2. Document the exception in `SECURITY_REMEDIATION.md` under the **Active Exceptions** list below, explaining:
   - CVE / GHSA ID
   - Affected Package
   - Rationale for non-exploitability
   - Anticipated timeline for a permanent fix

---

## 📝 Active Security Exceptions

*No active exceptions. All detected vulnerabilities must be remediated.*
