# AIDA Extension — Deep Refactor Checklist

> **Date**: February 20, 2026
> **Scope**: Full codebase review & team handoff readiness
> **Strategy**: TypeScript-first — refactor code trước, Jest + ESLint sau cùng

---

## Codebase Metrics (Before)

| Metric | Value |
|--------|-------|
| Total JS files | 63 |
| Total lines | ~25,900 |
| Extension size (scripts/) | 1,140 KB |
| Unit tests | **0** |
| Lint config | **Không có** |
| TypeScript files | **1** (graph-view.ts) |
| Files > 1000 lines | **7** (God files) |

### God Files (> 1000 lines)

| File | Lines | Vấn đề |
|------|-------|--------|
| `sidebar-script.js` | 1,540 | Frontend script monolith |
| `dependency.js` | 1,515 | Cache + UI + analysis + participant trong 1 file |
| `chatbot-agent.js` | 1,500 | Planning + execution + Angular code generation |
| `pr-dependency-analyzer.js` | 1,337 | PR impact analysis |
| `review-pr.js` | 1,218 | 3 provider functions copy-paste ~90% giống nhau |
| `chatbot-algorithm.js` | 1,178 | Context decision engine |
| `ai-provider.js` | 1,107 | API calling + response parsing + fallback |

---

## Phase 1 — TypeScript Foundation (5-7 days)

> Migrate sang TypeScript, tạo nền tảng type-safe cho tất cả phases sau.
> AIDA đã có sẵn `ts-loader`, `typescript`, `@types/vscode` trong devDependencies.

### 1.1 — Setup TypeScript Config

```jsonc
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": ".",
    "strict": false,           // Phase 1: loose, tăng dần
    "allowJs": true,           // Mixed JS + TS
    "checkJs": false,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true,
    "types": ["node"],
    "skipLibCheck": true
  },
  "include": ["scripts/**/*", "extension.ts"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] Tạo `tsconfig.json` cho extension
- [ ] Update `webpack.config.js` entry: `'./extension.js'` → `'./extension.ts'` (giữ `allowJs` cho mixed)
- [ ] Verify webpack build thành công với mixed JS + TS codebase

### 1.2 — Migrate Core Modules sang TypeScript

Ưu tiên các file nhỏ, pure logic, dễ migrate nhất:

| File | Lines | Migrate to | Lý do ưu tiên |
|------|-------|------------|---------------|
| `core/abort-signal.js` | 25 | `abort-signal.ts` | Nhỏ nhất, trivial |
| `core/token-estimator.js` | 76 | `token-estimator.ts` | Pure logic |
| `core/shared-state.js` | 68 | `shared-state.ts` | State types critical |
| `core/settings.js` | 52 | `settings.ts` | Config types |
| `core/aida-config.js` | ~100 | `aida-config.ts` | Config constants |
| `core/review-ui.js` | 151 | `review-ui.ts` | UI helpers |
| `core/ignore-rules.js` | ~100 | `ignore-rules.ts` | Pure logic |
| `core/index.js` | 30 | `index.ts` | Barrel file |

- [ ] Rename + convert `abort-signal.js` → `.ts`
- [ ] Rename + convert `token-estimator.js` → `.ts`
- [ ] Rename + convert `shared-state.js` → `.ts`
- [ ] Rename + convert `settings.js` → `.ts` + fix `isProd` → getter function
- [ ] Rename + convert `aida-config.js` → `.ts`
- [ ] Rename + convert `review-ui.js` → `.ts`
- [ ] Rename + convert `ignore-rules.js` → `.ts`
- [ ] Rename + convert `index.js` → `.ts`
- [ ] Define core interfaces: `IAidaConfig`, `ITokenEstimate`, `ISharedState`
- [ ] Build + manual smoke test pass

---

## Phase 2 — Eliminate Global State + Tách extension.ts (3-5 days)

> Loại bỏ `global.*` hoàn toàn, tách God file `extension.js` thành modules.

### 2.1 — Tạo `AidaContext` class

```typescript
// scripts/core/aida-context.ts
export class AidaContext {
  private static instance: AidaContext;
  
  readonly extensionPath: string;
  readonly extensionContext: vscode.ExtensionContext;
  
  private _selectedBusinessDocs: BusinessDocCategory[] = [];
  private _prDiffCache = new Map<string, DiffData>();
  private _businessDocsState: Map<string, BusinessDocsState>;
  
  get selectedBusinessDocs() { return [...this._selectedBusinessDocs]; }
  set selectedBusinessDocs(docs: BusinessDocCategory[]) { this._selectedBusinessDocs = docs; }
  
  // Token storage → VS Code SecretStorage (thay vì global)
  async storeToken(key: string, token: string): Promise<void> {
    await this.extensionContext.secrets.store(key, token);
  }
  async getToken(key: string): Promise<string | undefined> {
    return this.extensionContext.secrets.get(key);
  }
}
```

**Replace global state:**

| Global Variable | Replace with |
|----------------|-------------|
| `global.extensionPath` | `AidaContext.instance.extensionPath` |
| `global.aidaExtensionContext` | `AidaContext.instance.extensionContext` |
| `global.selectedBusinessDocs` | `AidaContext.instance.selectedBusinessDocs` |
| `global.businessDocsState` | `AidaContext.instance.businessDocsState` |
| `global.prDiffCache` | `AidaContext.instance.prDiffCache` |
| `global.prDiffCache.accessToken` | `AidaContext.instance.storeToken()` (**SecretStorage**) |

- [ ] Tạo `scripts/core/aida-context.ts` với full types
- [ ] Tạo `scripts/core/interfaces/` folder cho shared interfaces
- [ ] Replace `global.extensionPath` → `AidaContext`
- [ ] Replace `global.aidaExtensionContext` → `AidaContext`
- [ ] Replace `global.selectedBusinessDocs` → `AidaContext`
- [ ] Replace `global.businessDocsState` → `AidaContext`
- [ ] Replace `global.prDiffCache` → `AidaContext`
- [ ] Migrate `global.prDiffCache.accessToken` → `vscode.SecretStorage`
- [ ] Verify 0 remaining `global.*` references

### 2.2 — Tách `extension.ts` thành Command Modules

| Tách thành | Chứa gì |
|-----------|---------|
| `commands/review-commands.ts` | `reviewFile`, `reviewChanges`, `reviewAllChanges`, context variants |
| `commands/chat-commands.ts` | `openChat`, `clearChatSidebar`, `openSettingsSidebar`, `closeChatSidebar` |
| `commands/pr-commands.ts` | `reviewPullRequest`, `viewPrDiff`, `showEnhancedReviewOptions` |
| `commands/dependency-commands.ts` | `analyzeDependency` |
| `commands/utility-commands.ts` | `setupAzureDevOps`, `showAvailableModels`, `confirmReviewDocs` |
| `extension.ts` | Chỉ còn `activate()` + `deactivate()` |

**Target**: `extension.ts` < 100 lines.

- [ ] Tạo `commands/` folder
- [ ] Extract `commands/review-commands.ts`
- [ ] Extract `commands/chat-commands.ts`
- [ ] Extract `commands/pr-commands.ts`
- [ ] Extract `commands/dependency-commands.ts`
- [ ] Extract `commands/utility-commands.ts`
- [ ] `extension.ts` refactor chỉ còn orchestration
- [ ] Verify tất cả commands work qua manual test
- [ ] Update `ARCHITECTURE.md`

---

## Phase 3 — Review + Dependency-Graph TypeScript Migration (5-7 days)

> Migrate review + dependency-graph modules, fix code duplication.

### 3.1 — Migrate Review Modules

| File | Migrate to | Key interfaces |
|------|------------|---------------|
| `review/review-common.js` | `review-common.ts` | Barrel re-export |
| `review/review-changes.js` (837L) | `review-changes.ts` | `IReviewResult`, `IGitDiff` |
| `review/review-file.js` (531L) | `review-file.ts` | Reuse `IReviewResult` |
| `review/review-pr.js` (1,218L) | `review-pr.ts` | `IProvider`, `IDiffData`, `IPrReviewOptions` |
| `review/diff-utils.js` | `diff-utils.ts` | `IDiffContent`, `IAzureDevOpsInfo` |
| `review/pr-file-fetcher.js` | `pr-file-fetcher.ts` | `IPrFileFetcher` interface |
| `review/pr-fetch-azure.js` | `pr-fetch-azure.ts` | Implements `IPrFileFetcher` |
| `review/pr-fetch-github.js` | `pr-fetch-github.ts` | Implements `IPrFileFetcher` |
| `review/pr-fetch-gitlab.js` | `pr-fetch-gitlab.ts` | Implements `IPrFileFetcher` |

- [ ] Migrate `review-common.js` → `.ts`
- [ ] Migrate `review-changes.js` → `.ts`
- [ ] Migrate `review-file.js` → `.ts`
- [ ] Migrate `review-pr.js` → `.ts`
- [ ] Migrate `diff-utils.js` → `.ts`
- [ ] Migrate `pr-file-fetcher.js` → `.ts`
- [ ] Migrate `pr-fetch-azure.js` → `.ts`
- [ ] Migrate `pr-fetch-github.js` → `.ts`
- [ ] Migrate `pr-fetch-gitlab.js` → `.ts`
- [ ] Define interfaces: `IReviewResult`, `IGitDiff`, `IPrFileFetcher`, `IDiffData`

### 3.2 — Fix `review-pr.ts` Duplication

3 functions `showAzureDevOpsDiffInWebview`, `showGitHubDiffInWebview`, `showGitLabDiffInWebview` share 90%+ code.

```typescript
// review/providers/provider-strategy.ts
interface IProviderStrategy {
  readonly name: 'azure' | 'github' | 'gitlab';
  extractDiffFields(prData: any): IDiffData;
  getCachePrefix(prId: string): string;
  getApiEndpoint(config: IProviderConfig): string;
}

// review/pr-diff-viewer.ts  
async function showDiffInWebview(
  provider: IProviderStrategy,
  diffData: IDiffData, 
  options: IDiffViewOptions
): Promise<void> { /* single impl */ }
```

- [ ] Define `IProviderStrategy` interface
- [ ] Create `providers/azure-strategy.ts`
- [ ] Create `providers/github-strategy.ts`
- [ ] Create `providers/gitlab-strategy.ts`
- [ ] Create `pr-diff-viewer.ts` — single implementation
- [ ] Remove 3 duplicate functions from `review-pr.ts`
- [ ] Verify PR review works for all 3 providers

### 3.3 — Replace `execSync` → Async

```typescript
// review/git-operations.ts
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

export async function getGitDiff(filePath: string): Promise<IGitDiffResult> {
  const { stdout } = await execAsync(`git diff -- "${filePath}"`, { 
    cwd: workspaceRoot, maxBuffer: 10 * 1024 * 1024
  });
  return { success: true, diff: stdout };
}
```

- [ ] Create `review/git-operations.ts` with async wrappers
- [ ] Replace all `execSync` in `review-changes.ts`
- [ ] Verify git diff review still works

### 3.4 — Migrate Dependency-Graph Modules

- [ ] Migrate `graph-model.js` → `.ts` + add reverse dependency index
- [ ] Migrate `language-rules.js` → `.ts` + **fix duplicate `csharp` key**
- [ ] Migrate `barrel-resolver.js` → `.ts` + extract magic numbers → constants
- [ ] Migrate `symbol-analyzer.js` → `.ts` + extract Angular heuristics → config
- [ ] Implement `graph-model.serialize()` (currently stub returning empty arrays)
- [ ] Build + smoke test pass

---

## Phase 4 — Chatbot TypeScript Migration + Bug Fixes (5-7 days)

> Migrate chatbot sang TypeScript, define mixin interfaces, fix known bugs.

### 4.1 — Define Chatbot Interfaces

```typescript
export interface IChatHost {
  webviewView: vscode.WebviewView | null;
  chatHistory: IChatMessage[];
  chatbotService: IChatbotService;
  abortController: AbortController | null;
  delay(ms: number): Promise<void>;
  show(): void;
  saveChatHistory(): void;
  sendMessage(message: string): Promise<void>;
}

export interface IAgentTool {
  name: string;
  description: string;
  execute(params: Record<string, unknown>): Promise<IToolResult>;
}

export interface IExecutionPlan {
  steps: IExecutionStep[];
  context: IPlanContext;
  estimatedTime: number;
}
```

- [ ] Create `chatbot/interfaces/chat-host.interface.ts`
- [ ] Create `chatbot/interfaces/agent-tool.interface.ts`
- [ ] Create `chatbot/interfaces/execution-plan.interface.ts`
- [ ] Create `chatbot/interfaces/chatbot-service.interface.ts`

### 4.2 — Migrate Chatbot Modules

| File | Lines | Migrate to | Notes |
|------|-------|------------|-------|
| `chatbot-service.js` | 703 | `chatbot-service.ts` | Implements `IChatbotService` |
| `chatbot-sidebar.js` | 982 | `chatbot-sidebar.ts` | Implements `IChatHost` |
| `chatbot-agent.js` | 1,500 | **Split** ↓ | Decompose God file |
| `chatbot-algorithm.js` | 1,178 | `chatbot-algorithm.ts` | Type decision objects |
| `chatbot-context.js` | 398 | `chatbot-context.ts` | Mixin typed `this: IChatHost` |
| `chatbot-view-provider.js` | 614 | `chatbot-view-provider.ts` | Fix dead code |
| `context-detector.js` | 770 | `context-detector.ts` | Type ensemble result |
| `ml-classifier.js` | 380 | `ml-classifier.ts` | Type training data |
| `language-processor.js` | 166 | `language-processor.ts` | Type pattern dispatch |

- [ ] Migrate `chatbot-service.js` → `.ts`
- [ ] Migrate `chatbot-sidebar.js` → `.ts`
- [ ] Migrate `chatbot-algorithm.js` → `.ts`
- [ ] Migrate `chatbot-context.js` → `.ts` (typed `this: IChatHost`)
- [ ] Migrate `chatbot-view-provider.js` → `.ts`
- [ ] Migrate `context-detector.js` → `.ts`
- [ ] Migrate `ml-classifier.js` → `.ts`
- [ ] Migrate `language-processor.js` → `.ts`

### 4.3 — Decompose `chatbot-agent.js` (1,500 lines → 3 files)

| Tách thành | Responsibility | Est. lines |
|-----------|---------------|------------|
| `agent-planner.ts` | Plan creation & step breakdown | ~400 |
| `agent-executor.ts` | Step execution engine | ~500 |
| `code-templates/angular.ts` | Angular component/service templates | ~300 |
| `code-templates/index.ts` | Template registry | ~50 |

- [ ] Extract `agent-planner.ts` from `chatbot-agent.js`
- [ ] Extract `agent-executor.ts` from `chatbot-agent.js`
- [ ] Extract `code-templates/angular.ts` — hardcoded templates → external files
- [ ] Create `code-templates/index.ts` registry
- [ ] Delete original `chatbot-agent.js`
- [ ] Verify chatbot agent functionality works

### 4.4 — Fix Known Bugs

- [ ] **BUG**: Remove dead code after `break` in `chatbot-view-provider` (unreachable `runDiffCommand`)
- [ ] **BUG**: Remove test text in `system_prompt.md` line 1 ("Always say good bye when user say hello")
- [ ] **BUG**: `settings.ts` `isProd` evaluated once → convert to getter
- [ ] **BUG**: Extract magic numbers → `constants.ts` (`MODEL_PRIORITY`, `LRU_MAX_SIZE=500`, `LRU_TTL=5min`, `MAX_BARREL_DEPTH=10`, etc.)
- [ ] **BUG**: Remove hardcoded static diff example in `chatbot-agent` (~L500-560)
- [ ] Build + smoke test pass

---

## Phase 5 — Strict Mode + Template Dedup (3-5 days)

> Enable `strict: true`, template cleanup.

### 5.1 — Enable TypeScript Strict Mode

```jsonc
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

- [ ] Enable `strict: true` trong `tsconfig.json`
- [ ] Fix all `noImplicitAny` errors
- [ ] Fix all `strictNullChecks` errors
- [ ] Fix all `noUnusedLocals` / `noUnusedParameters` errors
- [ ] Remove remaining `any` types (or justify with `// eslint-disable-next-line` comment)
- [ ] Build pass with strict mode

### 5.2 — Template Deduplication

Hiện tại 9 language folders × 4 templates = **36 near-identical files**.

```
templates/review-code/
├── base/
│   ├── review-base.md           ← shared base
│   ├── review-changes.md        ← shared changes template
│   ├── review-file.md           ← shared file template
│   └── review-pr.md             ← shared PR template
├── partials/
│   ├── angular-rules.md         ← language-specific rules only
│   ├── react-rules.md
│   ├── python-rules.md
│   ├── csharp-rules.md
│   └── fallback-rules.md
└── legacy/                      ← keep old during transition
```

Compose: `base/review-file.md` + `{{LANGUAGE_RULES}}` → `partials/angular-rules.md`

- [ ] Create `base/` templates (extract shared content)
- [ ] Create `partials/` (extract language-specific rules)
- [ ] Update `template-engine.ts` compose logic
- [ ] Validate AI output quality unchanged (compare before/after)
- [ ] Move old templates → `legacy/` (keep 1 sprint, then delete)
- [ ] Delete `legacy/` folder after validation

---

## Phase 6 — Jest + ESLint + CI (3-5 days)

> Code refactor xong → giờ add testing infrastructure + quality gates.

### 6.1 — Setup Jest

```bash
npm install --save-dev jest ts-jest @types/jest
```

```typescript
// jest.config.ts
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/scripts'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^vscode$': '<rootDir>/scripts/__mocks__/vscode.ts'
  },
  collectCoverageFrom: [
    'scripts/**/*.ts',
    '!scripts/**/*.d.ts',
    '!scripts/**/index.ts'
  ]
};
```

- [ ] Install Jest dependencies: `jest`, `ts-jest`, `@types/jest`
- [ ] Create `jest.config.ts`
- [ ] Create `scripts/__mocks__/vscode.ts` (mock VS Code API)
- [ ] Add `"test": "jest"` script to `package.json`
- [ ] Verify `npm test` runs successfully (0 tests initially)

### 6.2 — Write Tests (target: 50+ tests)

| Module | Test file | Tests to write |
|--------|-----------|---------------|
| `token-estimator.ts` | `__tests__/token-estimator.test.ts` | `estimateTokens`, `normalizeModelFamily`, `estimateCost` |
| `shared-state.ts` | `__tests__/shared-state.test.ts` | `handleEnterTwiceLogic`, `chatSessions` CRUD |
| `ignore-rules.ts` | `__tests__/ignore-rules.test.ts` | `shouldIgnoreFile` patterns |
| `graph-model.ts` | `__tests__/graph-model.test.ts` | `addNode`, `addEdge`, `getDependents`, `getDependencies`, `serialize` |
| `language-rules.ts` | `__tests__/language-rules.test.ts` | Config validation, no duplicate keys |
| `aida-context.ts` | `__tests__/aida-context.test.ts` | Singleton, getters/setters, token storage |
| `git-operations.ts` | `__tests__/git-operations.test.ts` | Async diff, error handling |
| `ml-classifier.ts` | `__tests__/ml-classifier.test.ts` | Training, classification, fallback |
| `provider-strategy` | `__tests__/provider-strategy.test.ts` | Azure/GitHub/GitLab strategy |
| `template-engine.ts` | `__tests__/template-engine.test.ts` | Template loading, placeholder replacement, compose |

- [ ] Write tests for `token-estimator.ts` (5+ tests)
- [ ] Write tests for `shared-state.ts` (5+ tests)
- [ ] Write tests for `ignore-rules.ts` (5+ tests)
- [ ] Write tests for `graph-model.ts` (8+ tests)
- [ ] Write tests for `language-rules.ts` (5+ tests)
- [ ] Write tests for `aida-context.ts` (5+ tests)
- [ ] Write tests for `git-operations.ts` (5+ tests)
- [ ] Write tests for `ml-classifier.ts` (5+ tests)
- [ ] Write tests for provider strategies (5+ tests)
- [ ] Write tests for `template-engine.ts` (5+ tests)
- [ ] All tests pass: `npm test`

### 6.3 — Setup ESLint

```bash
npm install --save-dev eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

```javascript
// eslint.config.js
export default [{
  files: ['scripts/**/*.ts'],
  rules: {
    'no-console': 'warn',                              // Dùng aidaLogging()
    'no-dupe-keys': 'error',                           // Bắt duplicate key bugs
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-require-imports': 'warn',
    'eqeqeq': 'error',
    'no-var': 'error',
    'prefer-const': 'error',
    'no-eval': 'error',
    'no-debugger': 'error',
  }
}];
```

- [ ] Install ESLint dependencies
- [ ] Create `eslint.config.js` (flat config)
- [ ] Add `"lint": "eslint scripts/ --ext .ts"` script
- [ ] Run `npm run lint` — fix all errors
- [ ] Add `"lint:fix": "eslint scripts/ --ext .ts --fix"` script

### 6.4 — Pre-commit Hook + CI

```bash
npm install --save-dev husky lint-staged
```

- [ ] Install `husky` + `lint-staged`
- [ ] Configure `lint-staged` in `package.json`
- [ ] Setup pre-commit hook: lint + related tests
- [ ] Create `.github/workflows/ci.yml` (if using GitHub Actions)
- [ ] CI pipeline: lint → test → build
- [ ] Code coverage threshold: ≥ 40%
- [ ] Verify: commit with `console.log` is blocked

### 6.5 — Documentation

- [ ] Create `CHANGELOG.md` với version history
- [ ] Update `ARCHITECTURE.md` — add sequence diagrams
- [ ] Document mixin `IChatHost` interface contracts
- [ ] Add data-flow diagram: "What happens when user sends a chat message?"

---

## Issue Resolution Tracker

| Issue | Phase | Status |
|-------|-------|--------|
| **P0: No TypeScript** | Phase 1 | ☐ |
| **P0: Global state everywhere** | Phase 2 | ☐ |
| **P0: Token security (PAT in global)** | Phase 2 | ☐ |
| **P1: extension.js God file (787L)** | Phase 2 | ☐ |
| **P1: review-pr.js copy-paste ×3** | Phase 3 | ☐ |
| **P1: execSync blocking main thread** | Phase 3 | ☐ |
| **P1: Circular deps (lazy require)** | Phase 1-3 | ☐ |
| **P1: Mixin no interface contract** | Phase 4 | ☐ |
| **P2: chatbot-agent.js God file (1500L)** | Phase 4 | ☐ |
| **P2: 5 known bugs** | Phase 4 | ☐ |
| **P2: Magic numbers scattered** | Phase 4 | ☐ |
| **P2: Template duplication ×36** | Phase 5 | ☐ |
| **P2: No CHANGELOG** | Phase 6 | ☐ |
| **P0: Zero tests** | Phase 6 | ☐ |
| **P0: No ESLint** | Phase 6 | ☐ |
| **P3: graph-model O(E)** | Phase 3 | ☐ |
| **P3: aidaLogging perf** | Phase 4 | ☐ |

---

## Timeline

| Phase | Duration | Milestone |
|-------|----------|-----------|
| Phase 1 | 5-7 days | TS foundation, core modules typed |
| Phase 2 | 3-5 days | No globals, clean extension.ts |
| Phase 3 | 5-7 days | Review + dependency typed, no duplication |
| Phase 4 | 5-7 days | Chatbot typed, bugs fixed, full TS |
| Phase 5 | 3-5 days | Strict mode, templates clean |
| Phase 6 | 3-5 days | Jest + ESLint + CI + docs |
| **Total** | **~5-6 weeks** | **1-2 developers** |

---

## What's Working Well (Giữ nguyên)

- Documentation: `ARCHITECTURE.md` + `REFACTORING-CHECKLIST.md` rất chi tiết
- Template system: Clean separation fallback/language-specific
- Graceful degradation: Multiple fallback layers everywhere
- Edition system: Public vs Company builds qua webpack DefinePlugin
- Module separation: `core/`, `review/`, `chatbot/`, `dependency-graph/`, `tracking/`
- LRU caching trong context detection
- Barrel resolver có proper loop protection + timeout
