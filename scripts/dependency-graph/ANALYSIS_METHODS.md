# Dependency Analysis Methods: Graph View vs. Deep Impact Analysis

This document explains the differences between the two analysis methods used in the AIDA Dependency Graph extension.

## 1. Graph View (Overview)

*   **Method:** Uses `VSCodeApiDependencyAnalyzer` (Symbol Crawling + Regex).
*   **Mechanism:** Scans the entire workspace text content, looking for import patterns like `import ... from`, `require(...)`, `using ...`, etc.
*   **Scope:** **File-to-File** dependency.
*   **Pros:**
    *   🚀 **Fast:** Quick scanning of large codebases.
    *   🌐 **Broad Coverage:** Captures static links, assets, and config files.
*   **Cons:**
    *   ⚠️ **Less Accurate:** Can produce false positives/negatives due to reliance on text matching.
    *   Does not verify if an imported module is actually *used*.

## 2. Deep Impact Analysis (Detailed)

*   **Method:** Uses `SymbolAnalyzer` (VS Code LSP API: `executeReferenceProvider`).
*   **Mechanism:** Queries the active Language Server (TypeScript, C#, Python, etc.) directly to ask: *"Where is this specific symbol (function, class, variable) used?"*.
*   **Scope:** **Symbol-to-File** dependency.
*   **Pros:**
    *   ✅ **High Precision:** 100% accurate according to the compiler/interpreter logic.
    *   🔍 **Granular:** Shows exactly *which* function or variable is being used and where.
*   **Cons:**
    *   🐢 **Slower:** Requires more processing time to query the Language Server for every symbol.
    *   **Strict:** Only counts files that *actively use* a public symbol.

## 3. Why do the numbers differ?

You may notice different dependency counts between the two views. This is expected:

*   **Graph View is often higher:** It counts **all imports**, including unused ones. If File A imports File B but never calls any function from it, Graph View still counts it as a dependency.
*   **Deep Impact is often lower:** It only counts **active usages**. If File A imports File B but doesn't use any of its symbols, Deep Impact ignores it (Reference Count = 0).
*   **Exceptions:** Deep Impact might find *more* connections in cases of implicit references (e.g., reflection, dynamic binding) that Regex patterns miss but the Language Server understands.

## 4. Conclusion: When to use which?

| Goal | Recommended Tool |
| :--- | :--- |
| **Architectural Overview** | 🕸️ **Graph View** <br> Use this to see the big picture, module relationships, and static structure. |
| **Refactoring & Bug Fixing** | 🔍 **Deep Impact Analysis** <br> Use this when you need to know *exactly* what will break if you change a specific file or function. |
