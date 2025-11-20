# 🔧 AIDA API Reference

**Complete API reference and configuration options for AIDA - AI Development Assistant**

business documentation for developers, advanced users, and enterprise integrations.

## 📖 Table of Contents

- [Configuration API](#-configuration-api)
- [Extension Commands](#-extension-commands)
- [Chat Participants API](#-chat-participants-api)
- [Template System API](#-template-system-api)
- [AI Provider Integration](#-ai-provider-integration)
- [Event System](#-event-system)
- [Extension Points](#-extension-points)
- [Programmatic Usage](#-programmatic-usage)
- [Advanced Configuration](#-advanced-configuration)
- [Enterprise Integration](#-enterprise-integration)
- [Development API](#-development-api)

## ⚙️ Configuration API

### Core Settings

#### `aida.ai.apiKey`
- **Type**: `string`
- **Default**: `""`
- **Description**: AI API key for OpenAI, Claude, or custom AI service
- **Scope**: `application`
- **Security**: Stored securely in VS Code settings

```json
{
  "aida.ai.apiKey": "sk-your-api-key-here"
}
```

#### `aida.ai.apiHost`
- **Type**: `string`
- **Default**: `"https://api.openai.com/v1/chat/completions"`
- **Description**: AI API endpoint URL
- **Scope**: `application`
- **Examples**:
  - OpenAI: `"https://api.openai.com/v1/chat/completions"`
  - Claude: `"https://api.anthropic.com/v1/messages"`
  - Custom: `"https://your-ai-service.com/v1/chat"`

#### `aida.ai.model`
- **Type**: `string`
- **Default**: `"gpt-4o"`
- **Description**: AI model name to use for analysis
- **Scope**: `application`
- **Supported Models**:
  - OpenAI: `gpt-4o`, `gpt-4`, `gpt-3.5-turbo`
  - Claude: `claude-3-sonnet-20240229`, `claude-3-haiku-20240307`

#### `aida.ai.temperature`
- **Type**: `number`
- **Default**: `0.1`
- **Range**: `0.0 - 2.0`
- **Description**: Controls AI response creativity (lower = more focused)
- **Scope**: `application`

#### `aida.ai.maxTokens`
- **Type**: `number`
- **Default**: `4096`
- **Range**: `1 - 128000`
- **Description**: Maximum tokens for AI responses
- **Scope**: `application`

#### `aida.ai.timeout`
- **Type**: `number`
- **Default**: `30000`
- **Unit**: milliseconds
- **Description**: Request timeout for AI API calls
- **Scope**: `application`

### Chat Configuration

#### `aida.hasNoGithubCopilot`
- **Type**: `boolean`
- **Default**: `false`
- **Description**: Enable AIDA chat when GitHub Copilot is unavailable
- **Scope**: `application`

#### `aida.useApiKeyInsteadOfCopilot`
- **Type**: `boolean`
- **Default**: `false`
- **Description**: Use custom AI API instead of GitHub Copilot
- **Scope**: `application`

### Platform Integration

#### `aida.github.personalAccessToken`
- **Type**: `string`
- **Default**: `""`
- **Description**: GitHub PAT for PR analysis
- **Required Scopes**: `repo` or `public_repo`
- **Scope**: `application`

#### `aida.gitlab.personalAccessToken`
- **Type**: `string`
- **Default**: `""`
- **Description**: GitLab PAT for MR analysis
- **Required Scopes**: `read_api` or `api`
- **Scope**: `application`

#### `aida.azureDevOps.personalAccessToken`
- **Type**: `string`
- **Default**: `""`
- **Description**: Azure DevOps PAT for PR analysis
- **Required Scopes**: `Code (read)`, `Pull Request (read)`
- **Scope**: `application`

#### `aida.azureDevOps.organization`
- **Type**: `string`
- **Default**: `""`
- **Description**: Default Azure DevOps organization name
- **Scope**: `application`

#### `aida.azureDevOps.defaultProject`
- **Type**: `string`
- **Default**: `""`
- **Description**: Default Azure DevOps project name
- **Scope**: `application`

### Review Configuration

#### `aida.review.autoDetectLanguage`
- **Type**: `boolean`
- **Default**: `true`
- **Description**: Automatically detect file language for template selection
- **Scope**: `window`

#### `aida.review.templatePath`
- **Type**: `string`
- **Default**: `"AIDA/templates/review-code"`
- **Description**: Path to custom review templates
- **Scope**: `window`

### Debug Configuration

#### `aida.debug.enabled`
- **Type**: `boolean`
- **Default**: `false`
- **Description**: Enable debug logging
- **Scope**: `application`

#### `aida.debug.logLevel`
- **Type**: `string`
- **Default**: `"info"`
- **Enum**: `["error", "warn", "info", "debug"]`
- **Description**: Logging verbosity level
- **Scope**: `application`

## 🎮 Extension Commands

### Command Reference

#### `aida.reviewFile`
- **Title**: "Review File"
- **Category**: "AIDA"
- **Description**: Analyze current file for code quality, security, and best practices
- **Keybinding**: None (Context menu)
- **Parameters**: None

```typescript
await vscode.commands.executeCommand('aida.reviewFile');
```

#### `aida.reviewChanges`
- **Title**: "Review Changes"
- **Category**: "AIDA"
- **Description**: Analyze git changes in current workspace
- **Keybinding**: None (Context menu)
- **Parameters**: None

```typescript
await vscode.commands.executeCommand('aida.reviewChanges');
```

#### `aida.reviewPullRequest`
- **Title**: "Review Pull Request"
- **Category**: "AIDA"
- **Description**: Analyze pull request by URL
- **Parameters**: `url?: string`

```typescript
await vscode.commands.executeCommand('aida.reviewPullRequest', 'https://github.com/user/repo/pull/123');
```

#### `aida.openChat`
- **Title**: "Open AIDA Chat"
- **Category**: "AIDA"
- **Description**: Open AIDA chat interface
- **Keybinding**: `Ctrl+Shift+A` (Windows/Linux), `Cmd+Shift+A` (Mac)

```typescript
await vscode.commands.executeCommand('aida.openChat');
```

#### `aida.setupAzureDevOps`
- **Title**: "Setup Azure DevOps Token"
- **Category**: "AIDA"
- **Description**: Configure Azure DevOps integration

#### `aida.showAvailableModels`
- **Title**: "Show Available Language Models"
- **Category**: "AIDA"
- **Description**: Display supported AI models

### Chat Commands

#### `aida.clearChatSidebar`
- **Title**: "Clear Chat"
- **Icon**: `$(clear-all)`
- **Description**: Clear chat history

#### `aida.openSettingsSidebar`
- **Title**: "Settings"
- **Icon**: `$(settings-gear)`
- **Description**: Open AIDA settings

#### `aida.closeChatSidebar`
- **Title**: "Close Chat"
- **Icon**: `$(close)`
- **Description**: Close chat panel

## 🤖 Chat Participants API

### Participant Registration

```typescript
interface ChatParticipant {
  id: string;
  name: string;
  description: string;
  isSticky: boolean;
}
```

### Available Participants

#### `review-file`
```json
{
  "id": "review-file",
  "name": "review-file",
  "description": "📄 Review current opening file or 🔗 specify file path",
  "isSticky": true
}
```

#### `review-changes`
```json
{
  "id": "review-changes", 
  "name": "review-changes",
  "description": "🔄 Review changes for current opening file or 🔗 specify file path",
  "isSticky": true
}
```

#### `review-pr`
```json
{
  "id": "review-pr",
  "name": "review-pr", 
  "description": "🔍 Review Pull Request by URL",
  "isSticky": true
}
```

#### `sync-review-templates`
```json
{
  "id": "sync-review-templates",
  "name": "sync-review-templates",
  "description": "🔄 Sync AIDA review templates to workspace", 
  "isSticky": true
}
```

#### `scan-app`
```json
{
  "id": "scan-app",
  "name": "scan-app",
  "description": "🤖 AI-powered code scanning and duplicate detection",
  "isSticky": true
}
```

### Custom Participant Implementation

```typescript
interface ParticipantHandler {
  handler: (request: ChatRequest, context: ChatContext, stream: ChatResponseStream, token: CancellationToken) => Promise<ChatResult>;
}

class CustomParticipant implements ParticipantHandler {
  async handler(request: ChatRequest, context: ChatContext, stream: ChatResponseStream, token: CancellationToken): Promise<ChatResult> {
    // Custom participant logic
    return { followUp: [], metadata: {} };
  }
}
```

## 📝 Template System API

### Template Structure

```typescript
interface TemplateConfig {
  templatePath: string;
  fallbackPath: string;
  languageDetection: boolean;
  customVariables: Record<string, any>;
}
```

### Template Variables

```typescript
interface TemplateVariables {
  FILE_NAME: string;
  FILE_PATH: string;
  FILE_EXTENSION: string;
  PROJECT_NAME: string;
  LANGUAGE: string;
  FRAMEWORK: string;
  DATE: string;
  TIME: string;
  REVIEWER: string;
}
```

### Template Loading API

```typescript
class TemplateLoader {
  async loadTemplate(language: string, type: TemplateType): Promise<string>;
  async syncTemplates(): Promise<void>;
  resolveVariables(template: string, variables: TemplateVariables): string;
}

enum TemplateType {
  ReviewBase = 'review-base',
  ReviewFile = 'review-file', 
  ReviewChanges = 'review-changes',
  ReviewPR = 'review-pr'
}
```

### Language Detection API

```typescript
interface LanguageDetector {
  detectLanguage(filePath: string): string;
  detectFramework(projectPath: string): string;
  getTemplateForFile(filePath: string): string;
}
```

## 🔗 AI Provider Integration

### Provider Interface

```typescript
interface AIProvider {
  name: string;
  apiKey: string;
  apiHost: string;
  model: string;
  
  sendRequest(prompt: string, options: RequestOptions): Promise<AIResponse>;
  validateConfig(): boolean;
  getSupportedModels(): string[];
}
```

### Request Options

```typescript
interface RequestOptions {
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
  stream?: boolean;
  systemPrompt?: string;
}
```

### Response Format

```typescript
interface AIResponse {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  finishReason: string;
}
```

### Custom Provider Implementation

```typescript
class CustomAIProvider implements AIProvider {
  constructor(
    public name: string,
    public apiKey: string,
    public apiHost: string,
    public model: string
  ) {}

  async sendRequest(prompt: string, options: RequestOptions): Promise<AIResponse> {
    // Custom API implementation
    return {
      content: "AI response",
      usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
      model: this.model,
      finishReason: "stop"
    };
  }

  validateConfig(): boolean {
    return !!(this.apiKey && this.apiHost && this.model);
  }

  getSupportedModels(): string[] {
    return ['custom-model-1', 'custom-model-2'];
  }
}
```

## 📡 Event System

### Event Types

```typescript
enum AidaEvent {
  ChatOpened = 'aida.chat.opened',
  ChatClosed = 'aida.chat.closed',
  ReviewStarted = 'aida.review.started',
  ReviewCompleted = 'aida.review.completed',
  TemplatesSynced = 'aida.templates.synced',
  ConfigChanged = 'aida.config.changed'
}
```

### Event Listeners

```typescript
interface EventEmitter {
  on(event: AidaEvent, listener: (data: any) => void): void;
  emit(event: AidaEvent, data: any): void;
  off(event: AidaEvent, listener: (data: any) => void): void;
}

// Usage
aida.events.on(AidaEvent.ReviewCompleted, (data) => {
  console.log('Review completed:', data.result);
});
```

### Event Data Schemas

```typescript
interface ReviewStartedEvent {
  type: 'file' | 'changes' | 'pr';
  filePath?: string;
  prUrl?: string;
  timestamp: number;
}

interface ReviewCompletedEvent {
  type: 'file' | 'changes' | 'pr';
  result: ReviewResult;
  duration: number;
  timestamp: number;
}

interface ConfigChangedEvent {
  setting: string;
  oldValue: any;
  newValue: any;
  timestamp: number;
}
```

## 🔌 Extension Points

### Menu Contributions

#### Editor Context Menu
```json
{
  "editor/context": [
    {
      "command": "aida.reviewFile",
      "group": "navigation@1",
      "when": "editorTextFocus"
    }
  ]
}
```

#### Explorer Context Menu
```json
{
  "explorer/context": [
    {
      "command": "aida.reviewFile", 
      "group": "navigation@1",
      "when": "resourceExtname =~ /\\.(ts|js|tsx|jsx|py|cs|go)$/"
    }
  ]
}
```

### Keybinding Contributions

```json
{
  "keybindings": [
    {
      "command": "aida.openChat",
      "key": "ctrl+shift+a",
      "mac": "cmd+shift+a",
      "when": "editorTextFocus || explorerViewletVisible"
    }
  ]
}
```

### View Contributions

```json
{
  "views": {
    "aidaChatContainer": [
      {
        "type": "webview",
        "id": "aidaChatSidebar", 
        "name": "AIDA Chat",
        "when": "true",
        "icon": "$(comment-discussion)"
      }
    ]
  }
}
```

## 💻 Programmatic Usage

### Extension API

```typescript
interface AidaAPI {
  // Core functionality
  reviewFile(filePath: string): Promise<ReviewResult>;
  reviewChanges(): Promise<ReviewResult>;
  reviewPullRequest(url: string): Promise<ReviewResult>;
  
  // Chat interface
  openChat(): Promise<void>;
  sendChatMessage(message: string): Promise<string>;
  
  // Templates
  syncTemplates(): Promise<void>;
  loadTemplate(language: string, type: string): Promise<string>;
  
  // Configuration
  getConfig(): Promise<AidaConfig>;
  updateConfig(config: Partial<AidaConfig>): Promise<void>;
  
  // Events
  events: EventEmitter;
}
```

### Usage Example

```typescript
import * as vscode from 'vscode';

// Get AIDA extension
const aidaExtension = vscode.extensions.getExtension('trongld232.aida-dev');
if (aidaExtension) {
  const aida: AidaAPI = aidaExtension.exports;
  
  // Review current file
  const result = await aida.reviewFile(vscode.window.activeTextEditor?.document.fileName);
  
  // Listen for events
  aida.events.on(AidaEvent.ReviewCompleted, (data) => {
    vscode.window.showInformationMessage(`Review completed: ${data.result.score}/10`);
  });
}
```

### Integration with Other Extensions

```typescript
// Custom extension integration
export function activate(context: vscode.ExtensionContext) {
  // Wait for AIDA to activate
  const aida = vscode.extensions.getExtension('trongld232.aida-dev');
  
  if (aida) {
    aida.activate().then(() => {
      const aidaAPI = aida.exports;
      
      // Register custom command that uses AIDA
      const disposable = vscode.commands.registerCommand('myext.reviewWithAida', async () => {
        const result = await aidaAPI.reviewFile(vscode.window.activeTextEditor?.document.fileName);
        // Process result
      });
      
      context.subscriptions.push(disposable);
    });
  }
}
```

## 🏢 Advanced Configuration

### Enterprise Settings

```json
{
  "aida.enterprise.mode": true,
  "aida.enterprise.apiEndpoint": "https://internal-ai.company.com",
  "aida.enterprise.authMethod": "oauth2",
  "aida.enterprise.templateRepository": "https://git.company.com/aida-templates",
  "aida.enterprise.auditLogging": true,
  "aida.enterprise.restrictedModels": ["gpt-4", "claude-3-sonnet"],
  "aida.enterprise.allowCustomTemplates": false
}
```

### Proxy Configuration

```json
{
  "aida.network.proxy": "http://proxy.company.com:8080",
  "aida.network.noProxy": ["localhost", "*.internal.com"],
  "aida.network.strictSSL": true,
  "aida.network.timeout": 60000
}
```

### Security Configuration

```json
{
  "aida.security.encryptApiKeys": true,
  "aida.security.allowDataCollection": false,
  "aida.security.auditTrail": true,
  "aida.security.restrictFileAccess": ["/secrets", "/config"],
  "aida.security.allowedDomains": ["api.openai.com", "api.anthropic.com"]
}
```

## 🏢 Enterprise Integration

### Single Sign-On (SSO)

```typescript
interface SSOConfig {
  provider: 'azure' | 'okta' | 'google' | 'custom';
  clientId: string;
  tenantId?: string;
  scopes: string[];
  redirectUri: string;
}

class SSOProvider {
  async authenticate(config: SSOConfig): Promise<AuthToken>;
  async refresh(token: AuthToken): Promise<AuthToken>;
  async logout(): Promise<void>;
}
```

### Custom Template Repository

```typescript
interface TemplateRepository {
  url: string;
  branch: string;
  authentication: {
    type: 'token' | 'ssh' | 'oauth';
    credentials: string;
  };
}

class EnterpriseTemplateManager {
  async syncFromRepository(repo: TemplateRepository): Promise<void>;
  async validateTemplates(): Promise<ValidationResult[]>;
  async deployTemplates(target: DeploymentTarget): Promise<void>;
}
```

### Audit Logging

```typescript
interface AuditLog {
  timestamp: Date;
  userId: string;
  action: string;
  resource: string;
  details: Record<string, any>;
  success: boolean;
  errorMessage?: string;
}

class AuditLogger {
  async log(entry: AuditLog): Promise<void>;
  async query(filter: AuditFilter): Promise<AuditLog[]>;
  async export(format: 'json' | 'csv' | 'xml'): Promise<string>;
}
```

## 🔧 Development API

### Extension Development Hooks

```typescript
interface DevelopmentAPI {
  // Testing utilities
  testing: {
    mockAIResponse(response: string): void;
    clearMocks(): void;
    getLastRequest(): AIRequest;
  };
  
  // Debug utilities
  debug: {
    enableVerboseLogging(): void;
    getPerformanceMetrics(): PerformanceMetrics;
    dumpState(): ExtensionState;
  };
  
  // Template development
  templates: {
    validateTemplate(content: string): ValidationResult;
    previewTemplate(template: string, variables: any): string;
    testTemplate(template: string, testData: any): TestResult;
  };
}
```

### Custom AI Model Integration

```typescript
interface CustomModel {
  name: string;
  endpoint: string;
  authentication: AuthConfig;
  requestFormat: RequestFormatter;
  responseParser: ResponseParser;
  capabilities: ModelCapabilities;
}

interface ModelCapabilities {
  maxTokens: number;
  supportsStreaming: boolean;
  supportsImages: boolean;
  supportsFunctions: boolean;
  languages: string[];
}

class ModelRegistry {
  register(model: CustomModel): void;
  unregister(modelName: string): void;
  list(): CustomModel[];
  validate(model: CustomModel): ValidationResult;
}
```

### Plugin Architecture

```typescript
interface AidaPlugin {
  name: string;
  version: string;
  dependencies: string[];
  
  activate(context: PluginContext): Promise<void>;
  deactivate(): Promise<void>;
  
  contributes: {
    commands?: CommandContribution[];
    participants?: ParticipantContribution[];
    templates?: TemplateContribution[];
    providers?: ProviderContribution[];
  };
}

class PluginManager {
  async loadPlugin(plugin: AidaPlugin): Promise<void>;
  async unloadPlugin(pluginName: string): Promise<void>;
  listPlugins(): AidaPlugin[];
  getPlugin(name: string): AidaPlugin | undefined;
}
```

## 📊 Performance API

### Metrics Collection

```typescript
interface PerformanceMetrics {
  requests: {
    total: number;
    successful: number;
    failed: number;
    averageResponseTime: number;
  };
  
  chat: {
    sessionsStarted: number;
    messagesExchanged: number;
    averageSessionDuration: number;
  };
  
  templates: {
    syncCount: number;
    loadTime: number;
    cacheHitRate: number;
  };
  
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
}

class PerformanceMonitor {
  getMetrics(): PerformanceMetrics;
  startProfiling(): void;
  stopProfiling(): ProfileResult;
  exportMetrics(format: 'json' | 'prometheus'): string;
}
```

### Caching API

```typescript
interface CacheManager {
  set(key: string, value: any, ttl?: number): Promise<void>;
  get(key: string): Promise<any>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  size(): Promise<number>;
}

// Usage
const cache = aida.cache;
await cache.set('template:typescript', templateContent, 3600); // 1 hour TTL
const template = await cache.get('template:typescript');
```

---

**Complete API reference for building advanced integrations with AIDA! 🔧📚**

> "Build powerful integrations and extend AIDA to meet your specific needs."