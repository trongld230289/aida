# AIDA Extension — Architecture Overview

> **Last updated:** After refactoring Phases 0–6  
> **Entry point:** `extension.js` (848 lines)  
> **Build:** Webpack with two editions (public / company)

---

## Module Map

```
extension.js                          ← VS Code entry point (activate/deactivate)
│
├── scripts/core/                     ← Shared infrastructure (extracted from review-common.js)
│   ├── index.js                         Barrel re-export for all core modules
│   ├── ai-provider.js                   AI provider integration (callAI, detectProvider, …)
│   ├── model-selector.js                Model selection & listing
│   ├── token-estimator.js               Token counting & cost estimation
│   ├── template-engine.js               Review template loading & processing
│   ├── source-control-config.js         PR URL parsing, token management
│   ├── business-docs.js                 Business document folder scanning
│   ├── review-ui.js                     Review output formatting & UI helpers
│   ├── abort-signal.js                  Global abort signal for cancellation
│   └── shared-state.js                  Cross-module shared state (chatSessions, etc.)
│
├── scripts/review/                   ← Code review domain
│   ├── review-common.js                 Barrel — re-exports core/ + language-detection
│   ├── review-file.js                   Single file review
│   ├── review-changes.js                Staged/unstaged changes review
│   ├── review-all-changes.js            All workspace changes review
│   ├── review-pr.js                     Pull Request review orchestrator
│   ├── pr-fetch-azure.js                Azure DevOps PR fetcher
│   ├── pr-fetch-github.js               GitHub PR fetcher
│   ├── pr-fetch-gitlab.js               GitLab MR fetcher
│   ├── pr-file-fetcher.js               Provider-agnostic file fetcher
│   ├── pr-utils.js                      PR utility functions
│   ├── diff-utils.js                    Diff parsing & content reconstruction
│   ├── monaco-webview.js                Monaco diff editor webview generator
│   └── templates/
│       └── monaco-diff-viewer.html      Monaco diff editor HTML template
│
├── scripts/chatbot/                  ← AI Chatbot sidebar
│   ├── chatbot-sidebar.js               Main sidebar class & initialization
│   ├── chatbot-agent.js                 Agent logic (mixed into sidebar prototype)
│   ├── chatbot-context.js               Context handling (mixed into sidebar prototype)
│   ├── chatbot-view-provider.js         Webview view provider
│   ├── chatbot-service.js               Chat API service layer
│   ├── chatbot-algorithm.js             Response algorithm & processing
│   ├── context-detector.js              Workspace context detection
│   ├── language-processor.js            NLP processing
│   ├── ml-classifier.js                 Intent classification
│   ├── template-loader.js               HTML template loader with caching
│   ├── patterns/                        Language-specific chat patterns
│   └── templates/
│       ├── sidebar-template.html        Main sidebar HTML
│       ├── sidebar-script.js            Sidebar client-side JS
│       ├── sidebar-fallback.html        Fallback when template load fails
│       └── sidebar-error.html           Error display template
│
├── scripts/dependency/               ← Dependency analysis
│   ├── dependency.js                    Main dependency analysis logic
│   ├── dependency-graph-service.js      Graph service layer
│   ├── file-dependency-analyzer.js      Single file dependency analysis
│   ├── pr-dependency-analyzer.js        PR-level dependency analysis
│   └── templates/
│       └── ai-analysis.html             AI analysis panel template
│
├── scripts/dependency-graph/         ← Dependency graph visualization
│   ├── graph-model.js                   Graph data model
│   ├── graph-view.html                  Graph visualization webview
│   ├── graph-watcher.js                 File watcher for live updates
│   ├── dependency-utils.js              Graph utility functions
│   ├── language-rules.js                Language-specific dependency rules
│   ├── symbol-analyzer.js               Code symbol analysis
│   ├── vscode-api-analyzer.js           VS Code API usage analysis
│   ├── change-impact-analyzer.js        Change impact analysis
│   ├── barrel-resolver.js               Barrel file resolution
│   ├── asset-loader-factory.js          Asset loading for webviews
│   └── environment-check.js             Environment validation
│
├── scripts/tracking/                 ← Usage analytics (company edition only)
│   ├── tracking-enums.js                Event type enums
│   ├── tracking-event-model.js          Event model
│   └── usage-tracking.js                Tracking API client
│
├── scripts/scan/                     ← Code scanning
│   └── scan-app.js                      Application-wide code scan
│
├── scripts/daily/                    ← Daily report generation
│   ├── daily-report.js                  Report generator
│   ├── azure-devops-data.js             Azure DevOps data fetcher
│   └── templates/
│       ├── daily-report.html            Full report HTML template
│       └── daily-report-wrapper.html    Webview wrapper template
│
├── scripts/test/                     ← Test utilities
│
└── scripts/ (root)                   ← Cross-domain utilities
    ├── settings.js                      Extension settings management
    ├── language-detection.js            Programming language detection
    ├── language-support-config.js       Language support configuration
    ├── ignore-rules.js                  File/folder ignore patterns
    ├── capability-check.js              Feature capability checking
    ├── virtual-content-provider.js      Virtual document provider
    ├── create-app.js                    Application scaffolding
    ├── daily-report.js                  Daily report chat participant
    └── sync-review-templates.js         Template synchronization
```

---

## Key Design Decisions

### Barrel Files
- `scripts/core/index.js` re-exports all core modules
- `scripts/review/review-common.js` is a thin barrel re-exporting core/ + language-detection  
  → Existing callers can still `require('./review-common')` without changes

### Template System
- Large inline HTML templates extracted into `.html` files in `templates/` subdirectories
- Runtime loading via `fs.readFileSync()` with `{{PLACEHOLDER}}` replacement
- Webpack `CopyPlugin` copies template files to `dist/` alongside bundled JS

### Build Editions
- `npm run build` → Public edition (no tracking, marketplace)
- `npm run build:company` → Company edition (tracking enabled)
- Controlled by `edition.config.js` + Webpack `DefinePlugin`

### Circular Dependency Resolution
- `scripts/core/shared-state.js` holds shared state (chatSessions, handleEnterTwiceLogic)
- Scripts never `require('../../extension')` — all shared state accessed via `shared-state.js`

---

## Metrics After Refactoring

| File | Lines | Notes |
|------|-------|-------|
| `extension.js` | 848 | Target ≤1,000 ✅ |
| `review-common.js` | 91 | Thin barrel ✅ |
| `chatbot-sidebar.js` | 1,171 | Target ≤1,500 ✅ |
| `review-pr.js` | 1,407 | Target ≤1,500 ✅ |
| `monaco-webview.js` | 370 | Was 1,413 (template extracted) |
| `dependency.js` | 1,872 | Largest file |
