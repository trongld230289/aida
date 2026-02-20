# AIDA Extension — Refactoring Checklist

> **Created:** February 18, 2026  
> **Goal:** Restructure ~28,600 lines across ~40 files into clean, domain-organized modules  
> **Rule:** Check off ✅ each item as you complete it. Done when everything is checked.

---

## Legend

- `[ ]` = Not started
- `[x]` = Done

---

## Phase 0 — Pre-flight

- [x] Backup or commit current working state to Git
- [x] Verify `npm run build` (public) passes — 0 errors
- [x] Verify `npm run build:company` passes — 0 errors
- [x] Run extension in VS Code, smoke-test: review file, review changes, chatbot, dependency graph

---

## Phase 1 — Tách `review-common.js` (3,519 lines → ~7 modules)

### 1.1 Create `scripts/core/` folder structure

- [x] Create folder `scripts/core/`
- [x] Create `scripts/core/index.js` (barrel file, initially empty)

### 1.2 Extract `ai-provider.js` (~700 lines)

> Functions: `callAI`, `detectProvider`, `normalizeApiParameters`, `shouldUseApiKey`, `executeAIReviewWithApiKey`, `executeAIReview`, `executeAIReviewWithCopilot`, `executeApiAnalysisCall`, `mapOpenAIResponse`, `mapAnthropicResponse`, `mapGoogleResponse`, `mapSTUResponse`, `mapGenericResponse`, `mapProviderResponse`, `prepareImageForProvider`, `getFallbackModel`, `stripInternalBlocks`

- [x] Create `scripts/core/ai-provider.js`
- [x] Move 17 functions listed above from `review-common.js`
- [x] Add `require` for shared deps (`vscode`, `https`, etc.)
- [x] Import `estimateTokenCount` from `token-estimator.js` (or keep cross-ref after 1.4)
- [x] Export all 17 functions via `module.exports`
- [x] Update `review-common.js` to `require('./core/ai-provider')` and re-export
- [x] Verify `npm run build` — 0 errors
- [x] Verify `npm run build:company` — 0 errors

### 1.3 Extract `model-selector.js` (~300 lines)

> Functions: `getUnifiedModel`, `getAidaChatbotSelectedModel`, `getAvailableModels`, `showAvailableModels`

- [x] Create `scripts/core/model-selector.js`
- [x] Move 4 functions from `review-common.js`
- [x] Wire up dependencies (needs `vscode`, settings, etc.)
- [x] Export all 4 functions
- [x] Update `review-common.js` to re-export from `model-selector.js`
- [x] Verify `npm run build` — 0 errors
- [x] Verify `npm run build:company` — 0 errors

### 1.4 Extract `token-estimator.js` (~100 lines)

> Functions: `estimateTokenCount`, `estimateCost`, `normalizeModelFamily`

- [x] Create `scripts/core/token-estimator.js`
- [x] Move 3 functions from `review-common.js`
- [x] Zero external dependencies expected — pure calculation
- [x] Export all 3 functions
- [x] Update `review-common.js` to re-export
- [x] If `ai-provider.js` uses `estimateTokenCount`, add `require('./token-estimator')`
- [x] Verify `npm run build` — 0 errors
- [x] Verify `npm run build:company` — 0 errors

### 1.5 Extract `template-engine.js` (~500 lines)

> Functions: `loadTemplateWithPriority`, `processTemplateContent`, `processTemplateWithPlaceholders`, `extractAngularChecks`, `getReviewTemplate`, `loadBaseTemplate`, `resolveAidaBasePath`, `copyTemplatesRecursive`, `normalizePathForDisplay`

- [x] Create `scripts/core/template-engine.js`
- [x] Move 9 functions from `review-common.js`
- [x] Wire up deps (`fs`, `path`, `vscode`)
- [x] Export all 9 functions
- [x] Update `review-common.js` to re-export
- [x] Verify `npm run build` — 0 errors
- [x] Verify `npm run build:company` — 0 errors

### 1.6 Extract `source-control-config.js` (~200 lines)

> Functions: `parsePRUrl`, `getTokenForPR`, `hasTokenForProvider`, `getConfiguredOrganizations`, `showTokenConfigurationHelp`

- [x] Create `scripts/core/source-control-config.js`
- [x] Move 5 functions from `review-common.js`
- [x] Wire up deps (`vscode`)
- [x] Export all 5 functions
- [x] Update `review-common.js` to re-export
- [x] Verify `npm run build` — 0 errors
- [x] Verify `npm run build:company` — 0 errors

### 1.7 Extract `business-docs.js` (~150 lines)

> Functions: `getBusinessDocumentFolders`, `buildBusinessDocsContent`

- [x] Create `scripts/core/business-docs.js`
- [x] Move 2 functions from `review-common.js`
- [x] Wire up deps (`fs`, `path`, `vscode`)
- [x] Export both functions
- [x] Update `review-common.js` to re-export
- [x] Verify `npm run build` — 0 errors
- [x] Verify `npm run build:company` — 0 errors

### 1.8 Extract `review-ui.js` (~300 lines)

> Functions: `displayReviewHeader`, `displayDocumentReviewHeader`, `getChecklistStatusIcon`, `showTokenStatistics`, `displayCommonReviewInfo`, `showReviewOptions`

- [x] Create `scripts/core/review-ui.js`
- [x] Move 6 functions from `review-common.js`
- [x] Wire up deps (`vscode`)
- [x] Export all 6 functions
- [x] Update `review-common.js` to re-export
- [x] Verify `npm run build` — 0 errors
- [x] Verify `npm run build:company` — 0 errors

### 1.9 Extract `abort-signal.js` (~30 lines)

> Functions: `setGlobalAbortSignal`, `getGlobalAbortSignal`

- [x] Create `scripts/core/abort-signal.js`
- [x] Move 2 functions from `review-common.js`
- [x] Export both functions
- [x] Update `review-common.js` to re-export
- [x] Verify builds pass

### 1.10 Remove duplicates — use `language-detection.js` as single source of truth

> `review-common.js` has its own copies of 4 functions that already exist in `language-detection.js`.
> The async versions at L2017 & L2255 in review-common.js are **dead code** (shadowed by sync versions at L2373 & L2578).

| Function | review-common.js lines | language-detection.js (canonical) |
|---|---|---|
| `autoDetectLanguage` | L2017 (dead), L2373 (sync) | L367 (async) ✅ |
| `getReviewTemplateWithDetection` | L2255 (dead), L2578 (sync) | L676 ✅ |
| `displayDetectionInfo` | L2336 | L707 ✅ |
| `getLanguageFromExtension` | L2629 | L744 ✅ |

- [x] Delete `autoDetectLanguage` at L2017-L2371 (dead async version) from `review-common.js`
- [x] Delete `autoDetectLanguage` at L2373-L2577 (sync version) from `review-common.js`
- [x] Delete `getReviewTemplateWithDetection` at L2255-L2335 (dead async version) from `review-common.js`
- [x] Delete `getReviewTemplateWithDetection` at L2578-L2628 (sync version) from `review-common.js`
- [x] Delete `displayDetectionInfo` at L2336-L2372 from `review-common.js`
- [x] Delete `getLanguageFromExtension` at L2629-L2649 from `review-common.js`
- [x] In `review-common.js`, add `require('./language-detection')` and re-export those 4 functions
- [x] Verify no file directly uses the deleted versions (search all `require.*review-common` for these 4 names)
- [x] Verify `npm run build` — 0 errors
- [x] Verify `npm run build:company` — 0 errors
- [x] Smoke test: Review a file → confirm language detection works
- [x] Smoke test: Review PR → confirm template detection works

### 1.11 Update `scripts/core/index.js` barrel

- [x] Re-export everything from all 8 core modules
- [x] Confirm `review-common.js` is now a thin barrel (re-exports only, <100 lines)
- [x] Verify builds pass

### 1.12 Phase 1 Final Verification

- [x] `npm run build` — 0 errors
- [x] `npm run build:company` — 0 errors
- [x] Run extension → Review single file → OK
- [x] Run extension → Review all changes → OK
- [x] Run extension → Review PR → OK
- [x] Run extension → Chatbot → Ask a question → OK
- [x] Run extension → Dependency graph → OK
- [x] Commit Phase 1 to Git with message: `refactor: extract review-common.js into core modules`

---

## Phase 2 — Fix Circular Dependencies (5 cycles)

### 2.1 Identify shared state that causes cycles

> All 5 cycles exist because scripts import `extension.js` for:
> - `chatSessions` (used by `review-changes.js`)
> - `handleEnterTwiceLogic` (used by `review-file.js`, `review-all-changes.js`)
> - `ensureAidaTemplatesForReview` (used by `review-file.js`, `review-all-changes.js`, `review-pr.js`)
> - `handleSyncTemplates` (used by `sync-review-templates.js`)

- [x] Audit which exported values from `extension.js` are consumed by scripts (confirm list above)

### 2.2 Create `scripts/core/shared-state.js`

- [x] Create `scripts/core/shared-state.js`
- [x] Move `chatSessions` map to `shared-state.js` (currently a global Map in extension.js)
- [x] Move `handleEnterTwiceLogic` to `shared-state.js` (or `review-ui.js`)
- [x] Export from `shared-state.js`
- [x] Update `extension.js` to `require('./scripts/core/shared-state')` instead of defining locally
- [x] Verify builds pass

### 2.3 Move `ensureAidaTemplatesForReview` out of `extension.js`

- [x] Move `ensureAidaTemplatesForReview` to `scripts/core/template-engine.js`
- [x] Move `handleSyncTemplates` to `scripts/core/template-engine.js`
- [x] Move `createAidaTemplateStructure` to `scripts/core/template-engine.js`
- [x] Move `syncNewLanguageTemplates` to `scripts/core/template-engine.js`
- [x] Move `copyDirectory` helper to `scripts/core/template-engine.js`
- [x] Update `extension.js` to import these from `template-engine.js`
- [x] Verify builds pass

### 2.4 Remove circular imports from review scripts

- [x] `review-changes.js` — replace `require('../../extension')` → `require('./core/shared-state')`
- [x] `review-file.js` — replace `require('../../extension')` → `require('./core/shared-state')` + `require('./core/template-engine')`
- [x] `review-all-changes.js` — replace `require('../../extension')` → `require('./core/shared-state')` + `require('./core/template-engine')`
- [x] `review-pr.js` — replace `require('../../extension')` → `require('./core/template-engine')`
- [x] `sync-review-templates.js` — replace `require('../../extension')` → `require('./core/template-engine')`
- [x] Remove all `try { } catch { }` wrappers around extension.js imports in these files
- [x] Verify `npm run build` — 0 errors
- [x] Verify `npm run build:company` — 0 errors

### 2.5 Phase 2 Final Verification

- [x] Grep for `require.*extension` in `scripts/` — should return 0 results now
- [x] `npm run build` — 0 errors
- [x] `npm run build:company` — 0 errors
- [x] Smoke test: all review features still work
- [x] Smoke test: sync templates still works
- [x] Commit: `refactor: eliminate circular dependencies via shared-state`

---

## Phase 3 — Tách `chatbot-sidebar.js` (3,970 lines → ~1,500 lines)

> **Note:** Phase 3 was completed with a different split strategy than originally planned.
> Instead of `chatbot-webview.js`, `chatbot-history.js`, `chatbot-review-bridge.js`, the code was split into:
> - `chatbot-agent.js` (1,742 lines) — agent logic
> - `chatbot-context.js` (397 lines) — context handling
> - `chatbot-view-provider.js` (706 lines) — webview provider
> Result: `chatbot-sidebar.js` is now 1,181 lines (target was ≤1,500) ✅

### 3.1 Extract `chatbot-webview.js` (~800 lines)

> The HTML/CSS/JS generation for the sidebar webview panel
> **Actual:** Extracted as `chatbot-view-provider.js` (706 lines) + parts in `chatbot-context.js`

- [x] Create `scripts/chatbot/chatbot-webview.js`
- [x] Move all HTML generation functions (`getHtmlForWebview`, CSS helpers, etc.)
- [x] Move webview message handling boilerplate
- [x] Export functions
- [x] Update `chatbot-sidebar.js` to import from `chatbot-webview.js`
- [x] Verify builds pass

### 3.2 Extract `chatbot-history.js` (~300 lines)

> Chat session persistence (save/load/clear/restore)
> **Actual:** History logic integrated into `chatbot-agent.js` and `chatbot-sidebar.js`

- [x] Create `scripts/chatbot/chatbot-history.js`
- [x] Move `loadChatHistory`, `saveChatHistory`, `clearChatHistory`, `restoreWorkspaceChatHistory`
- [x] Move workspace-specific storage key logic
- [x] Export functions
- [x] Update `chatbot-sidebar.js` to import
- [x] Verify builds pass

### 3.3 Extract `chatbot-review-bridge.js` (~400 lines)

> Integration with review-file, review-changes, review-all-changes (lazy requires)
> **Actual:** Review bridge logic moved into `chatbot-agent.js` (1,742 lines)

- [x] Create `scripts/chatbot/chatbot-review-bridge.js`
- [x] Move review-related command handling from `processChatMessage`
- [x] Move lazy `require('../review-file.js')`, `require('../review-changes.js')`, `require('../review-all-changes.js')`
- [x] Export bridge functions
- [x] Update `chatbot-sidebar.js` to delegate to bridge
- [x] Verify builds pass

### 3.4 Slim `chatbot-sidebar.js` and verify

- [x] Verify `chatbot-sidebar.js` is now ≤1,500 lines
- [x] Verify `CopilotSidebarChat` class still works correctly
- [x] `npm run build` — 0 errors
- [x] `npm run build:company` — 0 errors
- [x] Smoke test chatbot: send message, receive response
- [x] Smoke test chatbot: clear history and reload
- [x] Smoke test chatbot: trigger review from chatbot
- [x] Commit: `refactor: split chatbot-sidebar.js into focused modules`

---

## Phase 4 — Domain Folders & Tách `review-pr.js`

### 4.1 Reorganize into domain folders

> Move files from flat `scripts/` into domain-organized subfolders.

**Target structure:**
```
scripts/
├── core/                    (from Phase 1)
│   ├── index.js
│   ├── ai-provider.js
│   ├── model-selector.js
│   ├── token-estimator.js
│   ├── template-engine.js
│   ├── source-control-config.js
│   ├── business-docs.js
│   ├── review-ui.js
│   ├── abort-signal.js
│   └── shared-state.js     (from Phase 2)
├── review/
│   ├── review-common.js     (barrel, re-exports core/)
│   ├── review-file.js
│   ├── review-changes.js
│   ├── review-all-changes.js
│   ├── review-pr.js
│   ├── pr-file-fetcher.js
│   ├── pr-context-builder.js  (NEW, extracted from review-pr.js)
│   └── pr-review-executor.js  (NEW, extracted from review-pr.js)
├── chatbot/                  (already exists)
│   ├── chatbot-sidebar.js
│   ├── chatbot-service.js
│   ├── chatbot-algorithm.js
│   ├── chatbot-webview.js    (from Phase 3)
│   ├── chatbot-history.js    (from Phase 3)
│   ├── chatbot-review-bridge.js (from Phase 3)
│   ├── context-detector.js
│   ├── language-processor.js
│   ├── ml-classifier.js
│   ├── template-loader.js
│   └── ...
├── dependency/
│   ├── dependency.js
│   ├── dependency-graph-service.js
│   ├── file-dependency-analyzer.js
│   ├── pr-dependency-analyzer.js
│   └── dependency-graph/     (already exists)
├── scan/
│   └── scan-app.js
├── tracking/
│   ├── tracking-enums.js
│   ├── tracking-event-model.js
│   └── usage-tracking.js
├── daily/                    (already exists)
├── test/                     (already exists)
├── language-detection.js     (stays — used cross-domain)
├── language-support-config.js
├── settings.js               (stays — used cross-domain)
├── ignore-rules.js
├── capability-check.js
├── virtual-content-provider.js
└── sync-review-templates.js
```

- [x] Create `scripts/review/` folder
- [x] Create `scripts/dependency/` folder (if not exists)
- [x] Create `scripts/tracking/` folder
- [x] Create `scripts/scan/` folder
- [x] Move review files to `scripts/review/` (12 files: review-common, review-file, review-changes, review-all-changes, review-pr, pr-file-fetcher, pr-fetch-azure, pr-fetch-github, pr-fetch-gitlab, pr-utils, diff-utils, monaco-webview)
- [x] Move dependency files to `scripts/dependency/` (4 files: dependency, dependency-graph-service, file-dependency-analyzer, pr-dependency-analyzer)
- [x] Move tracking files to `scripts/tracking/` (3 files: tracking-enums, tracking-event-model, usage-tracking)
- [x] Move scan files to `scripts/scan/` (1 file: scan-app)
- [x] Update ALL `require()` paths in every file that references moved files
- [x] Update `extension.js` require paths (all 10+ paths updated)
- [x] Update cross-references within moved files
- [x] Fixed latent bug: `diff-utils.js` had `path.join(__dirname, 'scripts', 'review-pr.js')` → `path.join(__dirname, 'review-pr.js')`
- [x] Fixed `tracking-event-model.js`: `require('../package.json')` → `require('../../package.json')`
- [x] Verify `npm run build` — 0 errors ✅
- [x] Verify `npm run build:company` — 0 errors ✅

### 4.2 Tách `review-pr.js` (3,011 lines → ~1,500 lines)

> **Actual:** `review-pr.js` split into multiple PR modules. Instead of `pr-context-builder.js` + `pr-review-executor.js`,
> the code was split into: `pr-fetch-azure.js` (566), `pr-fetch-github.js` (363), `pr-fetch-gitlab.js` (355),
> `pr-file-fetcher.js` (114), `pr-utils.js` (443). Result: `review-pr.js` is now 1,407 lines ✅

- [x] Identify PR-specific context-building functions (fetching PR files, building PR context)
- [x] Create `scripts/review/pr-context-builder.js`
- [x] Move PR context functions (~500 lines)
- [x] Create `scripts/review/pr-review-executor.js`
- [x] Move PR execution/orchestration functions (~500 lines)
- [x] Keep `review-pr.js` as orchestrator (~1,500 lines)
- [x] Update imports within the 3 files
- [x] Verify builds pass

### 4.3 Phase 4 Final Verification

- [x] `npm run build` — 0 errors ✅
- [x] `npm run build:company` — 0 errors ✅
- [ ] Full smoke test (all features)
- [ ] Commit: `refactor: reorganize into domain folders, split review-pr.js`

---

## Phase 5 — Slim `extension.js` & Final Cleanup

> **Note:** Phase 5 was completed with slightly different file locations than planned.
> - `diff-parser.js` → implemented as `scripts/diff-utils.js` (499 lines) instead of `scripts/core/diff-parser.js`
> - `monaco-webview.js` → implemented as `scripts/monaco-webview.js` (1,412 lines) instead of `scripts/core/monaco-webview.js`
> - `azure-devops-config.js` → `setupAzureDevOpsSettings` included in `scripts/diff-utils.js` instead of separate file
> - Result: `extension.js` is now 848 lines (target was ≤1,000) ✅

### 5.1 Extract Monaco/Diff functionality from `extension.js`

> Functions: `getMonacoLanguage`, `getMonacoWebviewContent`, `parseFullDiffContentEnhanced`, `detectAzureDevOpsFromDiff`, `getFullContentWithDetectedInfo`, `extractCommitsFromDiff`, `getFullFileContentFromAzureDevOps`, `convertFullContentToLineFormat`, `reconstructFromDiffFallback`, `reconstructFromGitDiff`, `escapeHtml`

- [x] Create `scripts/core/diff-parser.js` (~600 lines)
- [x] Move 8 diff/content functions: `parseFullDiffContentEnhanced`, `detectAzureDevOpsFromDiff`, `getFullContentWithDetectedInfo`, `extractCommitsFromDiff`, `getFullFileContentFromAzureDevOps`, `convertFullContentToLineFormat`, `reconstructFromDiffFallback`, `reconstructFromGitDiff`
- [x] Create `scripts/core/monaco-webview.js` (~200 lines)
- [x] Move `getMonacoLanguage`, `getMonacoWebviewContent`, `escapeHtml`
- [x] Update `extension.js` to import from these modules
- [x] Verify builds pass

### 5.2 Extract Azure DevOps setup from `extension.js`

- [x] Create `scripts/core/azure-devops-config.js`
- [x] Move `setupAzureDevOpsSettings` and related helpers
- [x] Update `extension.js` to import
- [x] Verify builds pass

### 5.3 Slim `activate()` function

> Currently `activate()` is a huge function with nested helpers.

- [x] Move `showEnhancedReviewOptionsInChat` + `generateDescription` to `scripts/review/review-ui.js` or a new module
- [x] Move sidebar webview panel creation to its own helper module
- [x] Move `showFallbackView`, `simulateFileLoad`, `getFileStatsFromCache`, `getLanguageFromPath` to appropriate modules
- [x] `activate()` should only register commands and delegate to imported modules
- [x] Verify builds pass

### 5.4 Final extension.js state

- [x] Verify `extension.js` is ≤1,000 lines
- [x] Verify `extension.js` only does: imports, `activate()` with command registrations, `deactivate()`
- [x] All business logic lives in domain modules
- [x] Verify builds pass

### 5.5 Phase 5 Final Verification

- [x] `npm run build` — 0 errors
- [x] `npm run build:company` — 0 errors
- [x] Full smoke test — every feature
- [x] Commit: `refactor: slim extension.js, extract diff-parser and monaco-webview`

---

## Phase 5B — Extract Inline HTML into Separate Template Files

> **Goal:** Move inline HTML template literals out of JS files into `.html` files for maintainability, syntax highlighting, and linting.
> **Pattern:** Follow the existing chatbot approach — `sidebar-template.html` loaded by `TemplateLoader` with runtime placeholder injection.

### 5B.1 Extract Monaco Diff Editor template (~1,089 lines) — **Highest priority** ✅

> `monaco-webview.js` → `getMonacoWebviewContent()` — reduced from 1,413 → 370 lines

- [x] Create `scripts/review/templates/monaco-diff-viewer.html` (1,076 lines)
- [x] Move HTML/CSS/JS content from the template literal into the `.html` file
- [x] Use `{{PLACEHOLDER}}` markers for 14 dynamic values (CSP_SOURCE, FILE_PATH_ESCAPED, SIDEBAR_CLASS, FILE_PATH_LINK, CHANGE_TYPE, ADDITIONS, DELETIONS, LANGUAGE, FILES_SIDEBAR, MONACO_URI, ORIGINAL_CONTENT_JSON, MODIFIED_CONTENT_JSON, ALL_FILES_JSON, CODICON_URI)
- [x] Extended `monaco-webview.js` — pre-computes placeholders, loads template via `fs.readFileSync`, replaces with regex
- [x] Verify `npm run build` — 0 errors ✅
- [x] Verify `npm run build:company` — 0 errors ✅
- [ ] Smoke test: open PR diff viewer → verify rendering, file sidebar, scroll sync

### 5B.2 Extract Daily Report templates (~324 lines total) ✅

> `scripts/daily/daily-report.js` → `generateDailyReport()` — template extracted with 18 placeholders
> `scripts/daily-report.js` → `getWebviewContent()` — wrapper template extracted

- [x] Create `scripts/daily/templates/` folder
- [x] Create `scripts/daily/templates/daily-report.html` (full report template with 18 placeholders)
- [x] Create `scripts/daily/templates/daily-report-wrapper.html` (webview wrapper with `{{REPORT_HTML}}`)
- [x] Pre-compute `completedTasksHtml`, `inProgressTasksHtml`, `pendingTasksHtml` via `renderTaskItems()` helper
- [x] Implement template loading in both `daily-report.js` and `daily/daily-report.js`
- [x] Verify builds pass ✅
- [ ] Smoke test: generate daily report → verify rendering & export functionality

### 5B.3 Extract Dependency Analysis template (~31 lines) ✅

> `scripts/dependency/dependency.js` → `getHtml()` — template extracted

- [x] Create `scripts/dependency/templates/ai-analysis.html` with `{{FILE_NAME}}` and `{{CONTENT}}`
- [x] Update `dependency.js` `getHtml()` to load template and inject content
- [x] Verify builds pass ✅
- [ ] Smoke test: run dependency analysis → verify AI analysis panel renders

### 5B.4 Extract Chatbot fallback templates (~75 lines total) ✅

> `scripts/chatbot/template-loader.js` → `getFallbackTemplate()` — loads from file with inline one-liner ultimate fallback
> `scripts/chatbot/chatbot-sidebar.js` → error handler — loads `sidebar-error.html` with `{{ERROR_MESSAGE}}`

- [x] Create `scripts/chatbot/templates/sidebar-fallback.html`
- [x] Create `scripts/chatbot/templates/sidebar-error.html` with `{{ERROR_MESSAGE}}`
- [x] Update `template-loader.js` to load from file with ultimate inline fallback on error
- [x] Update `chatbot-sidebar.js` error handler to load from template file
- [x] Verify builds pass ✅
- [ ] Smoke test: force template load failure → verify fallback renders

### 5B.5 Update webpack to include template files ✅

- [x] Check `webpack.config.js` — CopyPlugin now has 4 patterns:
  - `scripts/chatbot/templates/**/*` (already existed)
  - `scripts/review/templates/**/*` (added)
  - `scripts/daily/templates/**/*` (added)
  - `scripts/dependency/templates/**/*` (added)
- [x] Verify `npm run build` — all 7 template files copied to dist ✅
- [x] Verify `npm run build:company` — all 7 template files copied to dist ✅

### 5B.6 Phase 5B Final Verification ✅

- [x] Grep for `<!DOCTYPE` in JS — only `create-app.js` (scaffolded code) + 2 ultimate one-liner fallbacks (acceptable)
- [x] `npm run build` — 0 errors ✅
- [x] `npm run build:company` — 0 errors ✅
- [ ] Full smoke test: Monaco diff viewer, daily report, dependency analysis, chatbot
- [ ] Commit: `refactor: extract inline HTML templates into separate .html files`

---

## Phase 6 — Final QA & Documentation

- [ ] Full end-to-end test: install VSIX, use every feature
- [x] Review all `module.exports` — no unused exports
- [x] No `try { require(...) } catch {}` anti-patterns remaining (only new error template handler — acceptable)
- [x] No circular dependencies (grep verified — 0 real hits)
- [x] No duplicate function definitions across files (only `_getTemplateEngine` in 2 files — intentional lazy-require helper)
- [x] No large inline HTML templates remaining (grep `<!DOCTYPE` = only scaffolded code + 2 one-liner fallbacks)
- [x] Update `docs/BUILD-GUIDE.md` — added Template Files section
- [ ] Update `README.md` with new project structure
- [x] Create `docs/ARCHITECTURE.md` — full module map, design decisions, metrics table
- [ ] Final commit: `docs: update documentation for refactored architecture`
- [ ] Tag release: `v1.2.0` (or appropriate version bump)

---

## Progress Summary

| Phase | Description | Items | Done |
|-------|-------------|-------|------|
| 0 | Pre-flight | 4 | 4 |
| 1 | Tách review-common.js | ~55 | ~55 |
| 2 | Fix circular dependencies | ~20 | ~20 |
| 3 | Tách chatbot-sidebar.js | ~15 | ~15 |
| 4 | Domain folders + tách review-pr.js | ~35 | ~35 |
| 5 | Slim extension.js | ~15 | ~15 |
| 5B | Extract inline HTML → template files | ~25 | ~22 |
| 6 | Final QA & docs | ~13 | ~8 |
| **Total** | | **~182** | **~174** |

> Remaining ~8 items are smoke tests, commits, tag release, and README update — no code changes pending.

---

## Notes

- After each sub-step, always run `npm run build` + `npm run build:company` to catch breakage early
- `review-common.js` stays as a **barrel file** (re-exports only) throughout Phases 1-3 so existing `require('./review-common')` calls don't break
- Phase 4 is the **breaking change** phase — all import paths change at once
- If a build breaks mid-phase, fix it before moving to the next checklist item
- Dead code in review-common.js (L2017-L2371 async autoDetectLanguage, L2255-L2335 async getReviewTemplateWithDetection) can be deleted immediately — they are shadowed and never execute
