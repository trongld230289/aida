# 🛠️ Dependency Graph Improvement Plan (Remaining Tasks)

## 1. Performance Optimization: Disable LSP calls when "Continue Anyway" is selected
**Status:** 🔴 Pending
**Priority:** High
**Description:**
Currently, when a user selects "Continue Anyway" (bypassing the environment check), the analyzer still attempts to call VS Code LSP APIs (`vscode.executeDefinitionProvider`, etc.). Since the required extensions are missing, these calls will fail/timeout, causing:
- Unnecessary delays (waiting for timeouts).
- Console errors.
- Poor user experience.

**Proposed Fix:**
1.  **Update `dependency.js`**:
    - Pass an `enableLsp` boolean flag to `performDependencyAnalysisInBackground`.
    - Logic: `const enableLsp = !skipCapabilityCheck;` (If we skipped the check, we assume LSP is unavailable).
2.  **Update `vscode-api-analyzer.js`**:
    - Accept `enableLsp` in the constructor or `analyze` method.
    - In `processFile` or `resolveImport`, check `if (!this.enableLsp) return null;` before making any `vscode.execute...` calls.
    - Fallback immediately to Regex/File-system resolution.

## 2. Logic Fix: Multi-root Workspace Support
**Status:** 🔴 Pending
**Priority:** Medium
**Description:**
The current implementation hardcodes the workspace path to the first folder:
```javascript
const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;
```
If a user has a multi-root workspace (e.g., Backend + Frontend folders added separately), the tool only scans the first one, completely ignoring the others.

**Proposed Fix:**
1.  **Detect Multi-root**: Check `vscode.workspace.workspaceFolders.length`.
2.  **User Selection**:
    - If `length > 1`, show a QuickPick or Chat Button options asking the user which folder to analyze (or "All").
3.  **Loop/Merge**:
    - If "All" is selected, run analysis for each root and merge the graphs (or keep them as separate clusters in one graph).

## 3. UI Polish: "Re-analyze" Button Context
**Status:** 🟡 Minor
**Description:**
The "Re-analyze" button currently triggers a fresh analysis. We should ensure the UI clearly reflects whether we are running in "LSP Mode" (High Accuracy) or "Regex Mode" (Low Accuracy/Fallback) so the user knows what to expect.

## 4. Logic Fix: PR Dependency Analysis in Multi-root Workspaces
**Status:** 🔴 Pending
**Priority:** High (Dependent on Task #2)
**Description:**
Currently, PR analysis (`pr-dependency-analyzer.js`) assumes all changed files belong to the first workspace folder. In a multi-root setup (e.g., separate roots for Frontend and Backend), if a PR touches files in the second root, the analyzer might fail to locate them or use the wrong context/analyzer.

**Proposed Fix:**
1.  **Map Files to Roots**: When processing changed files from a PR, iterate through `vscode.workspace.workspaceFolders` to identify which root each file belongs to.
2.  **Context Switching**: Instantiate or retrieve the correct `VSCodeApiDependencyAnalyzer` for the specific root where the file resides.
3.  **Aggregation**: If a PR spans multiple roots, run analysis for relevant roots and aggregate the results into a single impact report.

---
*Created: January 1, 2026*
