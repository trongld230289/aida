# 📚 AIDA User Guide

**Complete guide to using AIDA - AI Development Assistant**

Welcome to AIDA! This comprehensive guide will help you get the most out of your AI Development Assistant.

## 📖 Table of Contents

- [Getting Started](#-getting-started)
- [Basic Usage](#-basic-usage)
- [Chat Interface](#-chat-interface)
- [Chat Commands](#-chat-commands)
- [Code Review Features](#-code-review-features)
- [Pull Request Analysis](#-pull-request-analysis)
- [Configuration](#-configuration)
- [Advanced Features](#-advanced-features)
- [Templates](#-templates)
- [Troubleshooting](#-troubleshooting)
- [Tips & Best Practices](#-tips--best-practices)

## 🚀 Getting Started

### Installation

1. **From VS Code Marketplace:**
   ```
   Ctrl+Shift+X → Search "AIDA" → Install
   ```

2. **From Command Line:**
   ```bash
   code --install-extension trongld232.aida-dev
   ```

### First Time Setup

1. **Open Settings:** `Ctrl+,` → Search "AIDA"
2. **Choose Your AI Provider:**
   - **With GitHub Copilot:** No additional setup needed
   - **With Your Own API:** Configure API keys (see [Configuration](#-configuration))
   - **Without Copilot:** Enable AIDA Chatbot mode

## 💡 Basic Usage

### Quick Actions

#### Right-Click Context Menu
- **Review File:** Right-click any file → `AIDA: Review File`
- **Review Changes:** Right-click in Git view → `AIDA: Review Changes`

#### Command Palette (`Ctrl+Shift+P`)
- `AIDA: Review File` - Analyze current file
- `AIDA: Review Changes` - Analyze git changes
- `AIDA: Review Pull Request` - Review PR by URL
- `AIDA: Open AIDA Chat` - Open chat interface

#### Keyboard Shortcuts
- `Ctrl+Shift+A` - Open AIDA Chat

## 💬 Chat Interface

### Opening the Chat
1. **Activity Bar:** Click the AIDA icon (💬)
2. **Keyboard:** Press `Ctrl+Shift+A`
3. **Command Palette:** `AIDA: Open AIDA Chat`

### Chat Features
- **Conversation History:** All conversations are saved
- **Image Support:** Drag & drop screenshots, error messages
- **Smart Context:** Auto-detects current file and project
- **Multi-language:** Supports English and Vietnamese
- **Autocomplete:** Smart participant suggestions

### Chat Controls
- **Clear Chat:** Click clear button or type `/clear`
- **Settings:** Access configuration via settings button
- **Close:** Click X to close chat panel

## 🤖 Chat Commands

### @review-file - File Analysis

**Basic Usage:**
```
@review-file
```
Reviews the currently active file.

**With File Path:**
```
@review-file src/components/Header.tsx
@review-file utils/helpers.js
```

**What it analyzes:**
- ✅ Code quality and best practices
- 🔒 Security vulnerabilities
- ⚡ Performance optimizations
- 🐛 Bug detection
- 📋 Framework-specific patterns
- 🎯 TypeScript/JavaScript standards

### @review-changes - Git Analysis

**Usage:**
```
@review-changes
```

**What it analyzes:**
- 📊 Uncommitted changes analysis
- 🚨 Breaking change detection
- ⚠️ Risk assessment
- 💡 Improvement suggestions
- 🔄 Impact on codebase

### @review-pr - Pull Request Analysis

**GitHub:**
```
@review-pr https://github.com/user/repo/pull/123
```

**GitLab:**
```
@review-pr https://gitlab.com/user/repo/-/merge_requests/45
```

**Azure DevOps:**
```
@review-pr https://dev.azure.com/org/project/_git/repo/pullrequest/67
```

**What it analyzes:**
- 🔍 Cross-platform PR analysis
- 👥 Team collaboration insights
- 📝 Automated review comments
- ✅ Merge readiness assessment
- 🎯 Code quality scores

### @sync-review-templates - Template Management

**Usage:**
```
@sync-review-templates
```

**What it does:**
- 📥 Downloads latest templates
- 🎯 Sets up language-specific templates
- 🔄 Updates existing templates
- 📁 Creates AIDA folder structure

## 🔍 Code Review Features

### Supported Languages
- **Frontend:** TypeScript, JavaScript, HTML, CSS, SCSS
- **Frameworks:** Angular, React, Vue, Node.js
- **Backend:** Python, C#, Go, PHP, Java
- **Others:** JSON, YAML, Markdown

### Review Categories

#### 🛡️ Security Analysis
- Input validation checks
- Authentication/authorization
- Data sanitization
- XSS/CSRF prevention
- Dependency vulnerabilities

#### ⚡ Performance Review
- Algorithm efficiency
- Memory usage
- Database queries
- Bundle size optimization
- Async/await patterns

#### 📋 Best Practices
- Code organization
- Naming conventions
- Error handling
- Documentation
- Testing recommendations

#### 🔧 Framework-Specific
- **Angular:** Component architecture, RxJS patterns
- **React:** Hooks usage, state management
- **Vue:** Composition API, reactivity
- **Node.js:** Express patterns, middleware

## 🚀 Pull Request Analysis

### Platform Support
- **GitHub:** Public and private repositories
- **GitLab:** GitLab.com and self-hosted
- **Azure DevOps:** Azure DevOps Services

### Setup Requirements

#### GitHub
```json
{
  "aida.github.personalAccessToken": "ghp_your-token"
}
```
**Permissions:** `repo` or `public_repo`

#### GitLab
```json
{
  "aida.gitlab.personalAccessToken": "glpat-your-token"
}
```
**Permissions:** `read_api` or `api`

#### Azure DevOps
```json
{
  "aida.azureDevOps.personalAccessToken": "your-token",
  "aida.azureDevOps.organization": "your-org",
  "aida.azureDevOps.defaultProject": "your-project"
}
```
**Permissions:** `Code (read)` and `Pull Request (read)`

### Analysis Features
- **Diff Visualization:** Monaco editor integration
- **Impact Assessment:** Risk scoring and analysis
- **Team Insights:** Collaboration patterns
- **Quality Metrics:** Code health scoring
- **Merge Readiness:** Automated recommendations

## ⚙️ Configuration

### Basic Configuration

#### For GitHub Copilot Users
```json
{
  "aida.useApiKeyInsteadOfCopilot": false
}
```

#### For Non-Copilot Users
```json
{
  "aida.hasNoGithubCopilot": true,
  "aida.useApiKeyInsteadOfCopilot": true
}
```

### AI Provider Setup

#### OpenAI Configuration
```json
{
  "aida.ai.apiKey": "sk-your-openai-key",
  "aida.ai.apiHost": "https://api.openai.com/v1/chat/completions",
  "aida.ai.model": "gpt-4o"
}
```

#### Claude Configuration
```json
{
  "aida.ai.apiKey": "sk-ant-your-claude-key",
  "aida.ai.apiHost": "https://api.anthropic.com/v1/messages",
  "aida.ai.model": "claude-3-sonnet-20240229"
}
```

#### Custom AI Service
```json
{
  "aida.ai.apiKey": "your-custom-key",
  "aida.ai.apiHost": "https://your-ai-service.com/v1/chat",
  "aida.ai.model": "your-model"
}
```

### Advanced Settings
```json
{
  "aida.ai.temperature": 0.1,
  "aida.ai.maxTokens": 4096,
  "aida.ai.timeout": 30000,
  "aida.review.autoDetectLanguage": true,
  "aida.review.templatePath": "AIDA/templates/review-code",
  "aida.debug.enabled": false,
  "aida.debug.logLevel": "info"
}
```

## 🎯 Advanced Features

### Custom Templates

#### Creating Custom Templates
1. **Sync Base Templates:**
   ```
   @sync-review-templates
   ```

2. **Customize Templates:**
   - Navigate to `AIDA/templates/review-code/`
   - Edit language-specific templates
   - Add custom review criteria

#### Template Structure
```
AIDA/
└── templates/
    └── review-code/
        ├── languages/
        │   ├── angular/
        │   ├── react/
        │   └── typescript/
        └── fallback/
            ├── review-base.md
            ├── review-file.md
            ├── review-changes.md
            └── review-pr.md
```

### Project Scanning (Experimental)
```
@scan-app
```
- **API Pattern Analysis:** Detect duplicate endpoints
- **Architecture Review:** Project structure analysis
- **Code Duplication:** Find redundant code

### Template Customization

#### Language Detection
AIDA automatically detects:
- **File Extensions:** `.ts`, `.js`, `.py`, `.cs`, etc.
- **Framework Patterns:** Component structure, imports
- **Project Context:** package.json, requirements.txt

#### Custom Review Criteria
Edit template files to add:
- Company-specific coding standards
- Custom security checks
- Performance benchmarks
- Documentation requirements

## 🔧 Templates

### Available Templates

#### Framework Templates
- **Angular:** Component architecture, services, modules
- **React:** Components, hooks, state management
- **Vue:** Composition API, reactivity patterns
- **Node.js:** Express patterns, middleware, async

#### Language Templates
- **TypeScript:** Type safety, generics, decorators
- **JavaScript:** ES6+, async/await, modules
- **Python:** PEP 8, type hints, best practices
- **C#:** SOLID principles, async patterns
- **Go:** Idiomatic Go, error handling

### Template Customization

#### Modifying Templates
1. **Sync Templates:** `@sync-review-templates`
2. **Edit Files:** Modify in `AIDA/templates/review-code/`
3. **Custom Checks:** Add your review criteria
4. **Save Changes:** Templates auto-update

#### Template Variables
```markdown
# Review Template for {{LANGUAGE}}
## File: {{FILE_PATH}}
## Project: {{PROJECT_NAME}}

### Custom Checks
- [ ] Company coding standards
- [ ] Security requirements
- [ ] Performance benchmarks
```

## 🛠️ Troubleshooting

### Common Issues

#### Chat Not Working
**Problem:** Chat interface doesn't respond
**Solutions:**
1. Check AI provider configuration
2. Verify API keys are valid
3. Check internet connection
4. Restart VS Code

#### API Key Issues
**Problem:** "Invalid API key" errors
**Solutions:**
1. Verify key format (starts with `sk-` for OpenAI)
2. Check key permissions
3. Ensure no extra spaces
4. Test key with direct API call

#### Template Sync Fails
**Problem:** Templates don't download
**Solutions:**
1. Check internet connection
2. Verify workspace permissions
3. Clear VS Code cache
4. Manually create AIDA folder

#### PR Analysis Fails
**Problem:** Cannot analyze pull requests
**Solutions:**
1. Verify personal access tokens
2. Check repository permissions
3. Ensure PR URL is correct
4. Test token with git operations

### Debug Mode
Enable debug logging:
```json
{
  "aida.debug.enabled": true,
  "aida.debug.logLevel": "debug"
}
```

Check logs in VS Code Output panel → AIDA.

### Performance Issues
If AIDA feels slow:
1. **Reduce Token Limits:**
   ```json
   {
     "aida.ai.maxTokens": 2048
   }
   ```

2. **Increase Timeout:**
   ```json
   {
     "aida.ai.timeout": 60000
   }
   ```

3. **Use Faster Models:**
   - OpenAI: `gpt-3.5-turbo`
   - Claude: `claude-3-haiku`

## 💡 Tips & Best Practices

### Efficient Code Review

#### Before Review
1. **Clean Your Code:** Remove debug logs, comments
2. **Stage Changes:** Review only what you intend to commit
3. **Context:** Have relevant files open

#### During Review
1. **Be Specific:** Ask targeted questions
2. **Iterative:** Review small chunks at a time
3. **Document:** Save important insights

#### After Review
1. **Apply Suggestions:** Implement recommended changes
2. **Learn:** Understand the reasoning behind suggestions
3. **Share:** Document team best practices

### Chat Best Practices

#### Effective Prompts
```
@review-file
Focus on security vulnerabilities and performance issues

@review-changes
Check for breaking changes and API compatibility

@review-pr https://github.com/user/repo/pull/123
Analyze code quality and test coverage
```

#### Context Management
- Keep relevant files open
- Use descriptive commit messages
- Provide additional context in chat

### Team Collaboration

#### Shared Templates
1. **Version Control:** Store templates in git
2. **Team Standards:** Create shared review criteria
3. **Documentation:** Document custom templates

#### Code Review Workflow
1. **Pre-Review:** Use `@review-changes` before committing
2. **PR Creation:** Use insights for better PR descriptions
3. **Team Review:** Share AIDA analysis with team
4. **Learning:** Build team knowledge from insights

### Performance Optimization

#### Smart Usage
- **Batch Reviews:** Review multiple files together
- **Targeted Analysis:** Focus on specific concerns
- **Template Efficiency:** Use appropriate templates

#### Resource Management
- **Model Selection:** Choose appropriate AI models
- **Token Limits:** Balance detail vs. speed
- **Caching:** Leverage template and context caching

## 📞 Getting Help

### Documentation
- **README:** Basic setup and features
- **API Reference:** Configuration options
- **Template Guide:** Custom template creation
- **Troubleshooting:** Common issues and solutions

### Community Support
- **GitHub Issues:** Bug reports and feature requests
- **GitHub Discussions:** Community questions and tips
- **Email:** Direct contact for urgent issues

### Contributing
We welcome contributions! See our Contributing Guide for:
- Code contributions
- Template improvements
- Documentation updates
- Bug reports

---

**Happy coding with AIDA! 🤖✨**

> "Your AI Development Assistant - Making code review intelligent and effortless."