# AIDA Extension — Architecture Overview

> **Last updated:** February 25, 2026 (after deep refactor → TypeScript migration)  
> **Entry point:** `extension.ts` (~143 lines)  
> **Build:** Webpack with two editions (public / company)

---

## Module Map

```
extension.ts                          ← VS Code entry point (activate/deactivate)
│                                       Uses AidaContext (centralized state, replaces global.*)
│
├── scripts/commands/                 ← Command registration (extracted from extension.ts)
│   ├── chat-commands.ts                 Chat participant commands
│   ├── review-commands.ts               Review file/changes/all-changes commands + context menu
│   ├── pr-commands.ts                   PR review commands
│   ├── dependency-commands.ts           Dependency analysis commands
│   └── utility-commands.ts              Utility/misc commands
│
├── scripts/core/                     ← Shared infrastructure
│   ├── aida-context.ts                  Centralized state (replaces global.*)
│   ├── aida-config.ts                   Extension configuration management
│   ├── ai-provider.ts                   AI provider integration (callAI, detectProvider, …)
│   ├── ai-api-client.ts                 Direct AI API client
│   ├── ai-copilot-client.ts             Copilot-specific API client
│   ├── model-selector.ts                Model selection & listing
│   ├── token-estimator.ts               Token counting & cost estimation
│   ├── template-engine.ts               Review template loading & processing
│   ├── source-control-config.ts         PR URL parsing, token management
│   ├── business-docs.ts                 Business document folder scanning
│   ├── review-ui.ts                     Review output formatting & UI helpers
│   ├── abort-signal.ts                  Global abort signal for cancellation
│   ├── shared-state.ts                  Cross-module shared state (chatSessions, etc.)
│   ├── settings.ts                      Extension settings management
│   ├── capability-check.ts              Feature capability checking
│   ├── error-utils.ts                   Error handling utilities
│   ├── file-loader.ts                   File reading/loading utilities
│   ├── ignore-rules.ts                  File/folder ignore patterns
│   ├── language-support-config.ts       Language support configuration
│   ├── prompts.ts                       Centralized prompt templates
│   ├── provider-detection.ts            AI provider auto-detection
│   ├── response-mappers.ts              AI response transformation
│   ├── virtual-content-provider.ts      Virtual document provider
│   └── interfaces/                      Core TypeScript interfaces
│       ├── index.ts
│       ├── aida-config.interface.ts
│       ├── ai-provider.interface.ts
│       ├── context.interface.ts
│       ├── review.interface.ts
│       ├── shared-state.interface.ts
│       ├── template.interface.ts
│       └── token-estimator.interface.ts
│
├── scripts/review/                   ← Code review domain
│   ├── review-common.ts                 Barrel — re-exports core/ + language-detection
│   ├── review-file.ts                   Single file review (Copilot chat participant)
│   ├── review-changes.ts                Staged/unstaged changes review
│   ├── review-all-changes.ts            All workspace changes review
│   ├── review-pr.ts                     Pull Request review (Copilot chat participant)
│   ├── pr-review-handler.ts             PR review orchestrator (shared logic)
│   ├── pr-quick-review.ts              Quick PR review mode
│   ├── pr-diff-handler.ts               PR diff processing
│   ├── pr-fetch-base.ts                 Base PR fetcher interface
│   ├── pr-fetch-azure.ts                Azure DevOps PR fetcher
│   ├── pr-fetch-github.ts               GitHub PR fetcher
│   ├── pr-fetch-gitlab.ts               GitLab MR fetcher
│   ├── pr-file-fetcher.ts               Provider-agnostic file fetcher
│   ├── pr-utils.ts                      PR utility functions
│   ├── diff-utils.ts                    Diff parsing & content reconstruction
│   ├── language-detection.ts            Programming language detection
│   ├── monaco-webview.ts                Monaco diff editor webview generator
│   ├── sync-review-templates.ts         Template synchronization
│   ├── interfaces/                      Review-specific interfaces
│   │   ├── index.ts
│   │   ├── detection.interface.ts
│   │   ├── file-target.interface.ts
│   │   └── pr.interface.ts
│   └── templates/
│       └── monaco-diff-viewer.html      Monaco diff editor HTML template
│
├── scripts/chatbot/                  ← AI Chatbot sidebar
│   ├── chatbot-sidebar.ts               Main sidebar class & initialization
│   ├── sidebar-core.ts                  Core sidebar logic (extracted from chatbot-sidebar)
│   ├── sidebar-history.ts               Chat history persistence
│   ├── sidebar-messaging.ts             Message routing & streaming
│   ├── sidebar-participants.ts          Participant dispatch (routes to review/dependency)
│   ├── chatbot-agent.ts                 Agent logic
│   ├── chatbot-context.ts               Context handling
│   ├── chatbot-view-provider.ts         Webview view provider
│   ├── chatbot-service.ts               Chat API service layer
│   ├── chatbot-algorithm.ts             Response algorithm & processing
│   ├── context-decision.ts              Context routing decisions
│   ├── context-detector.ts              Workspace context detection
│   ├── context-engine-core.ts           Context engine core logic
│   ├── intent-scorers.ts                Intent scoring for NLP
│   ├── semantic-detection.ts            Semantic intent detection
│   ├── language-processor.ts            NLP processing
│   ├── ml-classifier.ts                 Intent classification
│   ├── template-loader.ts               HTML template loader with caching
│   ├── interfaces/                      Chatbot-specific interfaces
│   │   ├── index.ts
│   │   ├── agent-tool.interface.ts
│   │   ├── chat-host.interface.ts
│   │   └── language-processor.interface.ts
│   ├── tools/                           Agent tool implementations
│   │   ├── agent-analysis.ts
│   │   ├── agent-executor.ts
│   │   ├── agent-planner.ts
│   │   ├── agent-refactoring.ts
│   │   └── agent-tools.ts
│   ├── patterns/                        Language-specific chat patterns
│   │   ├── en-patterns.ts
│   │   ├── universal-patterns.ts
│   │   └── vi-patterns.ts
│   └── templates/
│       ├── sidebar-template.html        Main sidebar HTML
│       ├── sidebar-script.js            Sidebar client-side JS
│       ├── sidebar-fallback.html        Fallback when template load fails
│       └── sidebar-error.html           Error display template
│
├── scripts/dependency/               ← Dependency analysis & graph visualization
│   ├── dependency.ts                    Main dependency analysis logic (chat participant)
│   ├── dependency-handlers.ts           Command handlers for dependency features
│   ├── dependency-ai-analysis-service.ts  AI-powered analysis service
│   ├── dependency-cache-service.ts      Analysis result caching
│   ├── dependency-graph-service.ts      Graph service layer
│   ├── dependency-graph-webview.ts      Graph webview management
│   ├── file-dependency-analyzer.ts      Single file dependency analysis
│   ├── pr-dependency-analyzer.ts        PR-level dependency analysis
│   ├── pr-analyzer-core.ts              Core PR analysis logic
│   ├── pr-barrel-resolver-helpers.ts    Barrel file resolution for PRs
│   ├── pr-graph-builder.ts              PR dependency graph builder
│   ├── pr-symbol-extractor.ts           Symbol extraction from PR diffs
│   ├── graph/                           Graph visualization modules
│   │   ├── graph-model.ts               Graph data model
│   │   ├── graph-watcher.ts             File watcher for live updates
│   │   ├── dependency-utils.ts          Graph utility functions
│   │   ├── language-rules.ts            Language-specific dependency rules
│   │   ├── symbol-analyzer.ts           Code symbol analysis
│   │   ├── vscode-api-analyzer.ts       VS Code API usage analysis
│   │   ├── barrel-resolver.ts           Barrel file resolution
│   │   └── asset-loader-factory.ts      Asset loading for webviews
│   ├── interfaces/                      Dependency-specific interfaces
│   │   ├── index.ts
│   │   ├── analysis.interface.ts
│   │   ├── graph.interface.ts
│   │   └── pr-analysis.interface.ts
│   ├── views/                           Webview templates
│   │   ├── graph-view.html              Graph visualization webview
│   │   ├── graph-view-script.js         Graph view client-side JS
│   │   └── impact-analysis.html         Impact analysis webview
│   └── templates/
│       └── ai-analysis.html             AI analysis panel template
│
├── scripts/tracking/                 ← Usage analytics (company edition only)
│   ├── tracking-enums.ts                Event types, AI providers, sources, ReviewMode
│   ├── tracking-event-model.ts          Event model & App Insights payload builder
│   └── usage-tracking.ts               Identity resolution, trackEvent, sendToAppInsights
│
├── scripts/types/                    ← Shared TypeScript type definitions
│   └── vendor.d.ts                      Third-party type declarations
│
├── scripts/test/                     ← Test utilities
│   └── test-get-copilot-models.ts       Copilot model listing test
│
├── scripts/__tests__/                ← Unit tests (Vitest)
│   ├── aida-config.test.ts
│   ├── aida-context.test.ts
│   ├── error-utils.test.ts
│   ├── file-loader.test.ts
│   ├── ignore-rules.test.ts
│   ├── language-detection.test.ts
│   ├── language-processor.test.ts
│   ├── ml-classifier.test.ts
│   └── token-estimator.test.ts
│
├── scripts/__mocks__/                ← Test mocks
│   └── vscode.ts                        VS Code API mock
│
└── scripts/global.d.ts              ← Global type declarations
```

---

## Key Design Decisions

### AidaContext (Centralized State)
- `scripts/core/aida-context.ts` replaces scattered `global.*` state
- `installGlobalBridge()` provides backward compatibility during migration
- All modules access shared state via `ctx` import instead of `require('../../extension')`

### Command Extraction
- `scripts/commands/` folder isolates all `vscode.commands.registerCommand` calls
- `extension.ts` only does `activate()` + `deactivate()` (~143 lines)
- Each command module registers related commands and returns disposables

### Review Mode: Quick vs Enhanced
- `ReviewMode` enum in `tracking-enums.ts`: `QUICK` (no business docs) / `ENHANCED` (with business docs)
- `getReviewMode()` checks `global.selectedBusinessDocs` array
- All review events (review-file, review-changes, review-all-changes, review-pr) track `reviewMode`

### TypeScript Interfaces
- Each domain has an `interfaces/` subfolder with `.interface.ts` files
- Shared interfaces in `core/interfaces/`

### Template System
- Large inline HTML templates extracted into `.html` files in `templates/` subdirectories
- Runtime loading via `fs.readFileSync()` with `{{PLACEHOLDER}}` replacement
- Webpack `CopyPlugin` copies template files to `dist/` alongside bundled JS

### Build Editions
- `npm run build` → Public edition (no tracking, marketplace)
- `npm run build:company` → Company edition (tracking enabled)
- Controlled by `edition.config.js` + Webpack `DefinePlugin`

### Circular Dependency Resolution
- `scripts/core/shared-state.ts` holds shared state (chatSessions, handleEnterTwiceLogic)
- Scripts never import from `extension.ts` — all shared state accessed via `shared-state.ts` or `aida-context.ts`

---

## Metrics After TypeScript Migration

| File | Lines | Notes |
|------|-------|-------|
| `extension.ts` | ~143 | Minimal entry point ✅ |
| `review-common.ts` | ~91 | Thin barrel ✅ |
| `chatbot-sidebar.ts` | — | Split into sidebar-core, sidebar-messaging, sidebar-participants, sidebar-history |
| `review-pr.ts` | — | Shared logic extracted to pr-review-handler.ts |
| `monaco-webview.ts` | — | Template extracted to HTML |
| `dependency.ts` | — | Split into dependency-handlers, pr-analyzer-core, etc. |
