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

- [ ] Backup or commit current working state to Git
- [ ] Verify `npm run build` (public) passes — 0 errors
- [ ] Verify `npm run build:company` passes — 0 errors
- [ ] Run extension in VS Code, smoke-test: review file, review changes, chatbot, dependency graph

---

## Phase 1 — Tách `review-common.js` (3,519 lines → ~7 modules)

### 1.1 Create `scripts/core/` folder structure

- [ ] Create folder `scripts/core/`
- [ ] Create `scripts/core/index.js` (barrel file, initially empty)

### 1.2 Extract `ai-provider.js` (~700 lines)

> Functions: `callAI`, `detectProvider`, `normalizeApiParameters`, `shouldUseApiKey`, `executeAIReviewWithApiKey`, `executeAIReview`, `executeAIReviewWithCopilot`, `executeApiAnalysisCall`, `mapOpenAIResponse`, `mapAnthropicResponse`, `mapGoogleResponse`, `mapSTUResponse`, `mapGenericResponse`, `mapProviderResponse`, `prepareImageForProvider`, `getFallbackModel`, `stripInternalBlocks`

- [ ] Create `scripts/core/ai-provider.js`
- [ ] Move 17 functions listed above from `review-common.js`
- [ ] Add `require` for shared deps (`vscode`, `https`, etc.)
- [ ] Import `estimateTokenCount` from `token-estimator.js` (or keep cross-ref after 1.4)
- [ ] Export all 17 functions via `module.exports`
- [ ] Update `review-common.js` to `require('./core/ai-provider')` and re-export
- [ ] Verify `npm run build` — 0 errors
- [ ] Verify `npm run build:company` — 0 errors

### 1.3 Extract `model-selector.js` (~300 lines)

> Functions: `getUnifiedModel`, `getAidaChatbotSelectedModel`, `getAvailableModels`, `showAvailableModels`

- [ ] Create `scripts/core/model-selector.js`
- [ ] Move 4 functions from `review-common.js`
- [ ] Wire up dependencies (needs `vscode`, settings, etc.)
- [ ] Export all 4 functions
- [ ] Update `review-common.js` to re-export from `model-selector.js`
- [ ] Verify `npm run build` — 0 errors
- [ ] Verify `npm run build:company` — 0 errors

### 1.4 Extract `token-estimator.js` (~100 lines)

> Functions: `estimateTokenCount`, `estimateCost`, `normalizeModelFamily`

- [ ] Create `scripts/core/token-estimator.js`
- [ ] Move 3 functions from `review-common.js`
- [ ] Zero external dependencies expected — pure calculation
- [ ] Export all 3 functions
- [ ] Update `review-common.js` to re-export
- [ ] If `ai-provider.js` uses `estimateTokenCount`, add `require('./token-estimator')`
- [ ] Verify `npm run build` — 0 errors
- [ ] Verify `npm run build:company` — 0 errors

### 1.5 Extract `template-engine.js` (~500 lines)

> Functions: `loadTemplateWithPriority`, `processTemplateContent`, `processTemplateWithPlaceholders`, `extractAngularChecks`, `getReviewTemplate`, `loadBaseTemplate`, `resolveAidaBasePath`, `copyTemplatesRecursive`, `normalizePathForDisplay`

- [ ] Create `scripts/core/template-engine.js`
- [ ] Move 9 functions from `review-common.js`
- [ ] Wire up deps (`fs`, `path`, `vscode`)
- [ ] Export all 9 functions
- [ ] Update `review-common.js` to re-export
- [ ] Verify `npm run build` — 0 errors
- [ ] Verify `npm run build:company` — 0 errors

### 1.6 Extract `source-control-config.js` (~200 lines)

> Functions: `parsePRUrl`, `getTokenForPR`, `hasTokenForProvider`, `getConfiguredOrganizations`, `showTokenConfigurationHelp`

- [ ] Create `scripts/core/source-control-config.js`
- [ ] Move 5 functions from `review-common.js`
- [ ] Wire up deps (`vscode`)
- [ ] Export all 5 functions
- [ ] Update `review-common.js` to re-export
- [ ] Verify `npm run build` — 0 errors
- [ ] Verify `npm run build:company` — 0 errors

### 1.7 Extract `business-docs.js` (~150 lines)

> Functions: `getBusinessDocumentFolders`, `buildBusinessDocsContent`

- [ ] Create `scripts/core/business-docs.js`
- [ ] Move 2 functions from `review-common.js`
- [ ] Wire up deps (`fs`, `path`, `vscode`)
- [ ] Export both functions
- [ ] Update `review-common.js` to re-export
- [ ] Verify `npm run build` — 0 errors
- [ ] Verify `npm run build:company` — 0 errors

### 1.8 Extract `review-ui.js` (~300 lines)

> Functions: `displayReviewHeader`, `displayDocumentReviewHeader`, `getChecklistStatusIcon`, `showTokenStatistics`, `displayCommonReviewInfo`, `showReviewOptions`

- [ ] Create `scripts/core/review-ui.js`
- [ ] Move 6 functions from `review-common.js`
- [ ] Wire up deps (`vscode`)
- [ ] Export all 6 functions
- [ ] Update `review-common.js` to re-export
- [ ] Verify `npm run build` — 0 errors
- [ ] Verify `npm run build:company` — 0 errors

### 1.9 Extract `abort-signal.js` (~30 lines)

> Functions: `setGlobalAbortSignal`, `getGlobalAbortSignal`

- [ ] Create `scripts/core/abort-signal.js`
- [ ] Move 2 functions from `review-common.js`
- [ ] Export both functions
- [ ] Update `review-common.js` to re-export
- [ ] Verify builds pass

### 1.10 Remove duplicates — use `language-detection.js` as single source of truth

> `review-common.js` has its own copies of 4 functions that already exist in `language-detection.js`.
> The async versions at L2017 & L2255 in review-common.js are **dead code** (shadowed by sync versions at L2373 & L2578).

| Function | review-common.js lines | language-detection.js (canonical) |
|---|---|---|
| `autoDetectLanguage` | L2017 (dead), L2373 (sync) | L367 (async) ✅ |
| `getReviewTemplateWithDetection` | L2255 (dead), L2578 (sync) | L676 ✅ |
| `displayDetectionInfo` | L2336 | L707 ✅ |
| `getLanguageFromExtension` | L2629 | L744 ✅ |

- [ ] Delete `autoDetectLanguage` at L2017-L2371 (dead async version) from `review-common.js`
- [ ] Delete `autoDetectLanguage` at L2373-L2577 (sync version) from `review-common.js`
- [ ] Delete `getReviewTemplateWithDetection` at L2255-L2335 (dead async version) from `review-common.js`
- [ ] Delete `getReviewTemplateWithDetection` at L2578-L2628 (sync version) from `review-common.js`
- [ ] Delete `displayDetectionInfo` at L2336-L2372 from `review-common.js`
- [ ] Delete `getLanguageFromExtension` at L2629-L2649 from `review-common.js`
- [ ] In `review-common.js`, add `require('./language-detection')` and re-export those 4 functions
- [ ] Verify no file directly uses the deleted versions (search all `require.*review-common` for these 4 names)
- [ ] Verify `npm run build` — 0 errors
- [ ] Verify `npm run build:company` — 0 errors
- [ ] Smoke test: Review a file → confirm language detection works
- [ ] Smoke test: Review PR → confirm template detection works

### 1.11 Update `scripts/core/index.js` barrel

- [ ] Re-export everything from all 8 core modules
- [ ] Confirm `review-common.js` is now a thin barrel (re-exports only, <100 lines)
- [ ] Verify builds pass

### 1.12 Phase 1 Final Verification

- [ ] `npm run build` — 0 errors
- [ ] `npm run build:company` — 0 errors
- [ ] Run extension → Review single file → OK
- [ ] Run extension → Review all changes → OK
- [ ] Run extension → Review PR → OK
- [ ] Run extension → Chatbot → Ask a question → OK
- [ ] Run extension → Dependency graph → OK
- [ ] Commit Phase 1 to Git with message: `refactor: extract review-common.js into core modules`

---

## Phase 2 — Fix Circular Dependencies (5 cycles)

### 2.1 Identify shared state that causes cycles

> All 5 cycles exist because scripts import `extension.js` for:
> - `chatSessions` (used by `review-changes.js`)
> - `handleEnterTwiceLogic` (used by `review-file.js`, `review-all-changes.js`)
> - `ensureAidaTemplatesForReview` (used by `review-file.js`, `review-all-changes.js`, `review-pr.js`)
> - `handleSyncTemplates` (used by `sync-review-templates.js`)

- [ ] Audit which exported values from `extension.js` are consumed by scripts (confirm list above)

### 2.2 Create `scripts/core/shared-state.js`

- [ ] Create `scripts/core/shared-state.js`
- [ ] Move `chatSessions` map to `shared-state.js` (currently a global Map in extension.js)
- [ ] Move `handleEnterTwiceLogic` to `shared-state.js` (or `review-ui.js`)
- [ ] Export from `shared-state.js`
- [ ] Update `extension.js` to `require('./scripts/core/shared-state')` instead of defining locally
- [ ] Verify builds pass

### 2.3 Move `ensureAidaTemplatesForReview` out of `extension.js`

- [ ] Move `ensureAidaTemplatesForReview` to `scripts/core/template-engine.js`
- [ ] Move `handleSyncTemplates` to `scripts/core/template-engine.js`
- [ ] Move `createAidaTemplateStructure` to `scripts/core/template-engine.js`
- [ ] Move `syncNewLanguageTemplates` to `scripts/core/template-engine.js`
- [ ] Move `copyDirectory` helper to `scripts/core/template-engine.js`
- [ ] Update `extension.js` to import these from `template-engine.js`
- [ ] Verify builds pass

### 2.4 Remove circular imports from review scripts

- [ ] `review-changes.js` — replace `require('../../extension')` → `require('./core/shared-state')`
- [ ] `review-file.js` — replace `require('../../extension')` → `require('./core/shared-state')` + `require('./core/template-engine')`
- [ ] `review-all-changes.js` — replace `require('../../extension')` → `require('./core/shared-state')` + `require('./core/template-engine')`
- [ ] `review-pr.js` — replace `require('../../extension')` → `require('./core/template-engine')`
- [ ] `sync-review-templates.js` — replace `require('../../extension')` → `require('./core/template-engine')`
- [ ] Remove all `try { } catch { }` wrappers around extension.js imports in these files
- [ ] Verify `npm run build` — 0 errors
- [ ] Verify `npm run build:company` — 0 errors

### 2.5 Phase 2 Final Verification

- [ ] Grep for `require.*extension` in `scripts/` — should return 0 results now
- [ ] `npm run build` — 0 errors
- [ ] `npm run build:company` — 0 errors
- [ ] Smoke test: all review features still work
- [ ] Smoke test: sync templates still works
- [ ] Commit: `refactor: eliminate circular dependencies via shared-state`

---

## Phase 3 — Tách `chatbot-sidebar.js` (3,970 lines → ~1,500 lines)

### 3.1 Extract `chatbot-webview.js` (~800 lines)

> The HTML/CSS/JS generation for the sidebar webview panel

- [ ] Create `scripts/chatbot/chatbot-webview.js`
- [ ] Move all HTML generation functions (`getHtmlForWebview`, CSS helpers, etc.)
- [ ] Move webview message handling boilerplate
- [ ] Export functions
- [ ] Update `chatbot-sidebar.js` to import from `chatbot-webview.js`
- [ ] Verify builds pass

### 3.2 Extract `chatbot-history.js` (~300 lines)

> Chat session persistence (save/load/clear/restore)

- [ ] Create `scripts/chatbot/chatbot-history.js`
- [ ] Move `loadChatHistory`, `saveChatHistory`, `clearChatHistory`, `restoreWorkspaceChatHistory`
- [ ] Move workspace-specific storage key logic
- [ ] Export functions
- [ ] Update `chatbot-sidebar.js` to import
- [ ] Verify builds pass

### 3.3 Extract `chatbot-review-bridge.js` (~400 lines)

> Integration with review-file, review-changes, review-all-changes (lazy requires)

- [ ] Create `scripts/chatbot/chatbot-review-bridge.js`
- [ ] Move review-related command handling from `processChatMessage`
- [ ] Move lazy `require('../review-file.js')`, `require('../review-changes.js')`, `require('../review-all-changes.js')`
- [ ] Export bridge functions
- [ ] Update `chatbot-sidebar.js` to delegate to bridge
- [ ] Verify builds pass

### 3.4 Slim `chatbot-sidebar.js` and verify

- [ ] Verify `chatbot-sidebar.js` is now ≤1,500 lines
- [ ] Verify `CopilotSidebarChat` class still works correctly
- [ ] `npm run build` — 0 errors
- [ ] `npm run build:company` — 0 errors
- [ ] Smoke test chatbot: send message, receive response
- [ ] Smoke test chatbot: clear history and reload
- [ ] Smoke test chatbot: trigger review from chatbot
- [ ] Commit: `refactor: split chatbot-sidebar.js into focused modules`

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

- [ ] Create `scripts/review/` folder
- [ ] Create `scripts/dependency/` folder (if not exists)
- [ ] Create `scripts/tracking/` folder
- [ ] Create `scripts/scan/` folder
- [ ] Move review files to `scripts/review/`:
  - [ ] `review-common.js` → `scripts/review/review-common.js`
  - [ ] `review-file.js` → `scripts/review/review-file.js`
  - [ ] `review-changes.js` → `scripts/review/review-changes.js`
  - [ ] `review-all-changes.js` → `scripts/review/review-all-changes.js`
  - [ ] `review-pr.js` → `scripts/review/review-pr.js`
  - [ ] `pr-file-fetcher.js` → `scripts/review/pr-file-fetcher.js`
- [ ] Move dependency files to `scripts/dependency/`:
  - [ ] `dependency.js` → `scripts/dependency/dependency.js`
  - [ ] `dependency-graph-service.js` → `scripts/dependency/dependency-graph-service.js`
  - [ ] `file-dependency-analyzer.js` → `scripts/dependency/file-dependency-analyzer.js`
  - [ ] `pr-dependency-analyzer.js` → `scripts/dependency/pr-dependency-analyzer.js`
- [ ] Move tracking files to `scripts/tracking/`:
  - [ ] `tracking-enums.js` → `scripts/tracking/tracking-enums.js`
  - [ ] `tracking-event-model.js` → `scripts/tracking/tracking-event-model.js`
  - [ ] `usage-tracking.js` → `scripts/tracking/usage-tracking.js`
- [ ] Move scan files to `scripts/scan/`:
  - [ ] `scan-app.js` → `scripts/scan/scan-app.js`
- [ ] Update ALL `require()` paths in every file that references moved files
- [ ] Update `extension.js` require paths:
  - [ ] `./scripts/review-common` → `./scripts/review/review-common`
  - [ ] `./scripts/review-changes` → `./scripts/review/review-changes`
  - [ ] `./scripts/review-file` → `./scripts/review/review-file`
  - [ ] `./scripts/review-all-changes` → `./scripts/review/review-all-changes`
  - [ ] `./scripts/review-pr` → `./scripts/review/review-pr`
  - [ ] `./scripts/dependency` → `./scripts/dependency/dependency`
  - [ ] `./scripts/scan-app` → `./scripts/scan/scan-app`
  - [ ] `./scripts/usage-tracking` → `./scripts/tracking/usage-tracking`
  - [ ] `./scripts/tracking-enums` → `./scripts/tracking/tracking-enums`
  - [ ] `./scripts/sync-review-templates` → `./scripts/sync-review-templates` (stays)
- [ ] Update cross-references within moved files
- [ ] Verify `npm run build` — 0 errors
- [ ] Verify `npm run build:company` — 0 errors

### 4.2 Tách `review-pr.js` (3,011 lines → ~1,500 lines)

- [ ] Identify PR-specific context-building functions (fetching PR files, building PR context)
- [ ] Create `scripts/review/pr-context-builder.js`
- [ ] Move PR context functions (~500 lines)
- [ ] Create `scripts/review/pr-review-executor.js`
- [ ] Move PR execution/orchestration functions (~500 lines)
- [ ] Keep `review-pr.js` as orchestrator (~1,500 lines)
- [ ] Update imports within the 3 files
- [ ] Verify builds pass

### 4.3 Phase 4 Final Verification

- [ ] `npm run build` — 0 errors
- [ ] `npm run build:company` — 0 errors
- [ ] Full smoke test (all features)
- [ ] Commit: `refactor: reorganize into domain folders, split review-pr.js`

---

## Phase 5 — Slim `extension.js` & Final Cleanup

### 5.1 Extract Monaco/Diff functionality from `extension.js`

> Functions: `getMonacoLanguage`, `getMonacoWebviewContent`, `parseFullDiffContentEnhanced`, `detectAzureDevOpsFromDiff`, `getFullContentWithDetectedInfo`, `extractCommitsFromDiff`, `getFullFileContentFromAzureDevOps`, `convertFullContentToLineFormat`, `reconstructFromDiffFallback`, `reconstructFromGitDiff`, `escapeHtml`

- [ ] Create `scripts/core/diff-parser.js` (~600 lines)
- [ ] Move 8 diff/content functions: `parseFullDiffContentEnhanced`, `detectAzureDevOpsFromDiff`, `getFullContentWithDetectedInfo`, `extractCommitsFromDiff`, `getFullFileContentFromAzureDevOps`, `convertFullContentToLineFormat`, `reconstructFromDiffFallback`, `reconstructFromGitDiff`
- [ ] Create `scripts/core/monaco-webview.js` (~200 lines)
- [ ] Move `getMonacoLanguage`, `getMonacoWebviewContent`, `escapeHtml`
- [ ] Update `extension.js` to import from these modules
- [ ] Verify builds pass

### 5.2 Extract Azure DevOps setup from `extension.js`

- [ ] Create `scripts/core/azure-devops-config.js`
- [ ] Move `setupAzureDevOpsSettings` and related helpers
- [ ] Update `extension.js` to import
- [ ] Verify builds pass

### 5.3 Slim `activate()` function

> Currently `activate()` is a huge function with nested helpers.

- [ ] Move `showEnhancedReviewOptionsInChat` + `generateDescription` to `scripts/review/review-ui.js` or a new module
- [ ] Move sidebar webview panel creation to its own helper module
- [ ] Move `showFallbackView`, `simulateFileLoad`, `getFileStatsFromCache`, `getLanguageFromPath` to appropriate modules
- [ ] `activate()` should only register commands and delegate to imported modules
- [ ] Verify builds pass

### 5.4 Final extension.js state

- [ ] Verify `extension.js` is ≤1,000 lines
- [ ] Verify `extension.js` only does: imports, `activate()` with command registrations, `deactivate()`
- [ ] All business logic lives in domain modules
- [ ] Verify builds pass

### 5.5 Phase 5 Final Verification

- [ ] `npm run build` — 0 errors
- [ ] `npm run build:company` — 0 errors
- [ ] Full smoke test — every feature
- [ ] Commit: `refactor: slim extension.js, extract diff-parser and monaco-webview`

---

## Phase 5B — Extract Inline HTML into Separate Template Files

> **Goal:** Move inline HTML template literals out of JS files into `.html` files for maintainability, syntax highlighting, and linting.
> **Pattern:** Follow the existing chatbot approach — `sidebar-template.html` loaded by `TemplateLoader` with runtime placeholder injection.

### 5B.1 Extract Monaco Diff Editor template (~1,089 lines) — **Highest priority**

> `extension.js` → `getMonacoWebviewContent()` returns a massive `<!DOCTYPE html>` template literal (L1369–L2457)
> This is the single largest inline HTML block in the entire codebase.

- [ ] Create `scripts/core/templates/monaco-diff-viewer.html`
- [ ] Move HTML/CSS/JS content from the template literal into the `.html` file
- [ ] Use `{{PLACEHOLDER}}` markers for dynamic values (`cspSource`, `diffData`, `codiconUri`, etc.)
- [ ] Create `scripts/core/monaco-webview-loader.js` (or extend `monaco-webview.js` from Phase 5.1)
- [ ] Implement loader: read `.html` file, replace placeholders with runtime values
- [ ] Update `getMonacoWebviewContent()` to use the loader instead of inline template
- [ ] Verify `npm run build` — 0 errors
- [ ] Verify `npm run build:company` — 0 errors
- [ ] Smoke test: open PR diff viewer → verify rendering, file sidebar, scroll sync

### 5B.2 Extract Daily Report templates (~324 lines total)

> `scripts/daily/daily-report.js` → `generateDailyReport()` (L50–L307, ~258 lines)
> `scripts/daily-report.js` → `getWebviewContent()` (L171–L236, ~66 lines)

- [ ] Create `scripts/daily/templates/` folder
- [ ] Create `scripts/daily/templates/daily-report.html` (the full report template)
- [ ] Create `scripts/daily/templates/daily-report-wrapper.html` (the webview wrapper with controls)
- [ ] Use `{{PLACEHOLDER}}` markers for dynamic data (`title`, `statistics`, `workItems`, etc.)
- [ ] Implement template loading in `daily-report.js` / `daily/daily-report.js`
- [ ] Update both functions to use loaded templates
- [ ] Verify builds pass
- [ ] Smoke test: generate daily report → verify rendering & export functionality

### 5B.3 Extract Dependency Analysis template (~31 lines)

> `scripts/dependency.js` → `getHtml()` arrow function (L756–L786)

- [ ] Create `scripts/dependency/templates/ai-analysis.html`
- [ ] Move AI analysis panel HTML into the template file
- [ ] Use `{{CONTENT}}` placeholder for dynamic analysis markdown
- [ ] Update `dependency.js` to load template and inject content
- [ ] Verify builds pass
- [ ] Smoke test: run dependency analysis → verify AI analysis panel renders

### 5B.4 Extract Chatbot fallback templates (~75 lines total)

> `scripts/chatbot/template-loader.js` → `getFallbackTemplate()` (L59–L111, ~53 lines)
> `scripts/chatbot/chatbot-sidebar.js` → error fallback in `getHtmlForWebview()` (L2949–L2970, ~22 lines)

- [ ] Create `scripts/chatbot/templates/sidebar-fallback.html`
- [ ] Create `scripts/chatbot/templates/sidebar-error.html`
- [ ] Move fallback HTML from `template-loader.js` into `sidebar-fallback.html`
- [ ] Move error HTML from `chatbot-sidebar.js` into `sidebar-error.html`
- [ ] Update both files to load from `.html` files with `fs.readFileSync` fallback
- [ ] Verify builds pass
- [ ] Smoke test: force template load failure → verify fallback renders

### 5B.5 Update webpack to include template files

- [ ] Check `webpack.config.js` — ensure `.html` templates in `scripts/` are copied to `dist/`
- [ ] Add `CopyWebpackPlugin` entries (or equivalent) for new template directories:
  - `scripts/core/templates/`
  - `scripts/daily/templates/`
  - `scripts/dependency/templates/`
  - `scripts/chatbot/templates/` (already may be configured)
- [ ] Verify `npm run build` bundles template files correctly
- [ ] Verify `npm run build:company` bundles template files correctly

### 5B.6 Phase 5B Final Verification

- [ ] Grep for `` `<!DOCTYPE html>` `` in `scripts/` and `extension.js` — should return only `create-app.js` (scaffolded HTML, acceptable)
- [ ] `npm run build` — 0 errors
- [ ] `npm run build:company` — 0 errors
- [ ] Full smoke test: Monaco diff viewer, daily report, dependency analysis, chatbot
- [ ] Commit: `refactor: extract inline HTML templates into separate .html files`

---

## Phase 6 — Final QA & Documentation

- [ ] Full end-to-end test: install VSIX, use every feature
- [ ] Review all `module.exports` — no unused exports
- [ ] No `try { require(...) } catch {}` anti-patterns remaining
- [ ] No circular dependencies (grep `require.*extension` in scripts/ = 0 hits)
- [ ] No duplicate function definitions across files
- [ ] No large inline HTML templates remaining (grep `` `<!DOCTYPE` `` in JS = only scaffolded code)
- [ ] Update `docs/BUILD-GUIDE.md` if any build process changed
- [ ] Update `README.md` with new project structure
- [ ] Create `docs/ARCHITECTURE.md` describing the new module structure
- [ ] Final commit: `docs: update documentation for refactored architecture`
- [ ] Tag release: `v1.2.0` (or appropriate version bump)

---

## Progress Summary

| Phase | Description | Items | Done |
|-------|-------------|-------|------|
| 0 | Pre-flight | 4 | 0 |
| 1 | Tách review-common.js | ~55 | 0 |
| 2 | Fix circular dependencies | ~20 | 0 |
| 3 | Tách chatbot-sidebar.js | ~15 | 0 |
| 4 | Domain folders + tách review-pr.js | ~35 | 0 |
| 5 | Slim extension.js | ~15 | 0 |
| 5B | Extract inline HTML → template files | ~25 | 0 |
| 6 | Final QA & docs | ~13 | 0 |
| **Total** | | **~182** | **0** |

---

## Notes

- After each sub-step, always run `npm run build` + `npm run build:company` to catch breakage early
- `review-common.js` stays as a **barrel file** (re-exports only) throughout Phases 1-3 so existing `require('./review-common')` calls don't break
- Phase 4 is the **breaking change** phase — all import paths change at once
- If a build breaks mid-phase, fix it before moving to the next checklist item
- Dead code in review-common.js (L2017-L2371 async autoDetectLanguage, L2255-L2335 async getReviewTemplateWithDetection) can be deleted immediately — they are shadowed and never execute
