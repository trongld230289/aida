# Refactor Plan: Dependency Analysis Module

## 1. Current Status
- **Architecture**: Hybrid approach using Regex for candidate finding + VS Code LSP for resolution.
- **Flow**: `DependencyGraphService` manages a singleton full graph. `FileDependencyAnalyzer` and `PRDependencyAnalyzer` consume this full graph.
- **Pain Points**:
    - **Performance**: Single file analysis triggers a full workspace scan if cache is missing.
    - **Accuracy**: Angular Modules (`.module.ts`) are currently ignored, breaking dependency chains in Angular projects.
    - **Maintainability**: `VSCodeApiDependencyAnalyzer.js` is a "God Class" handling configuration, parsing, and graph building for all languages.
    - **UX**: Graph view can be cluttered with isolated nodes.

## 2. Refactoring Objectives

### 🚀 Phase 1: Critical Fixes & Performance (High Priority)
1.  **Enable Angular Modules**:
    - Remove `**/*.module.ts` from `ignorePatterns` in `vscode-api-analyzer.js`.
    - Ensure module imports/exports are correctly traced.

2.  **Implement "Local Scan" Strategy**:
    - **Goal**: Analyze a single file instantly without building the full graph.
    - **Logic**:
        - Create `analyzeSingleFile(filePath)` method.
        - Parse *only* the target file to find outgoing dependencies (Imports).
        - Use `vscode.executeReferenceProvider` on the target file's symbols to find incoming dependents (Usages).
        - Build a mini-graph containing only these nodes.
    - **Benefit**: Reduces analysis time from ~30s+ (full scan) to <2s (local scan).

### 🏗️ Phase 2: Architecture Cleanup (Medium Priority)
3.  **Apply Strategy Pattern for Parsers**:
    - Break down `VSCodeApiDependencyAnalyzer` into language-specific strategies.
    - Structure:
        ```
        /parsers
          ├── IParser.js
          ├── TypeScriptParser.js
          ├── PythonParser.js
          └── ...
        ```
    - `VSCodeApiDependencyAnalyzer` becomes a context manager that delegates to the correct parser based on file extension.

### 🎨 Phase 3: UX/UI Refinements (Low Priority)
4.  **Graph Visualization Improvements**:
    - **Filter Isolated Nodes**: Add a toggle in the Webview to hide nodes with 0 edges.
    - **Smart Layout**: Improve D3 force simulation to better handle large graphs (prevent "cloud" of disconnected nodes).
    - **Fix Auto-Select**: Replace `setTimeout` with D3 event listeners for reliable node selection.

## 3. Implementation Steps

### Step 1: Fix Angular Support
- [ ] Edit `vscode-api-analyzer.js`: Remove `.module.ts` from ignore list.

### Step 2: Optimize File Analysis
- [ ] Modify `FileDependencyAnalyzer.js`:
    - Add `analyzeFileFast(filePath)` method.
    - Implement "On-demand" scanning logic using `vscode.executeDocumentSymbolProvider` and `vscode.executeReferenceProvider`.
    - Fallback to full graph only if "Deep Analysis" is requested.

### Step 3: Refactor Parsers
- [ ] Create `LanguageParser` base class.
- [ ] Extract `typescript` config and logic to `TypeScriptParser`.
- [ ] Extract `python` config and logic to `PythonParser`.
- [ ] Update `VSCodeApiDependencyAnalyzer` to load parsers dynamically.
