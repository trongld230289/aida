# 🤖 AIDA - AI Development Assistant

**Advanced AI Development Assistant with AIDA Chatbot for VS Code and Cursor IDE**

> Transform your development workflow with AIDA - Your intelligent coding companion featuring built-in chatbot, support for your own AI API (OpenAI/Claude), and comprehensive development tools. Compatible with both VS Code and Cursor IDE. No GitHub Copilot required!

[![Version](https://img.shields.io/badge/version-1.1.12-blue.svg)](https://marketplace.visualstudio.com/items?itemName=trongld232.aida-dev)
[![VS Code](https://img.shields.io/badge/VS%20Code-1.90+-green.svg)](https://code.visualstudio.com/)
[![Cursor IDE](https://img.shields.io/badge/Cursor%20IDE-Compatible-brightgreen.svg)](https://cursor.sh/)
[![License](https://img.shields.io/badge/license-MIT-orange.svg)](LICENSE)

## 🌟 What is AIDA?

**AIDA (AI Development Assistant)** is an intelligent VS Code and Cursor IDE extension that acts as your personal development companion. It features a built-in AIDA Chatbot and supports your own AI API keys, giving you flexibility to use OpenAI, Claude, or GitHub Copilot:

- 🤖 **AIDA Chatbot** - Built-in chat interface with image support and conversation history
- 🖥️ **Cross-IDE Support** - Works seamlessly with both VS Code and Cursor IDE
- 🔧 **Flexible AI Integration** - Use your own OpenAI/Claude API or GitHub Copilot
- 🔍 **Intelligent Code Review** - AI-powered analysis with framework-specific insights
- 🚀 **Smart PR Analysis** - Cross-platform support for GitHub, GitLab, and Azure DevOps
- � **Interactive Chat Participants** - Natural language interaction with your code

## ✨ Key Features

### 🔍 **Smart Code Review**
- **Multi-language Support**: TypeScript, JavaScript, Python, C#, Go
- **Framework Awareness**: Angular, React, Vue, Node.js
- **Security Analysis**: Automated security vulnerability detection
- **Performance Insights**: Code efficiency and optimization suggestions
- **Project Rules**: Support for both **Technical Project Rules** and **Business Project Rules**

### 🤖 **AIDA Chatbot (Full GitHub Copilot Experience)**
- **Native Experience**: Built-in sidebar chat interface identical to GitHub Copilot
- **Full Feature Parity**: Supports all review modes, dependency analysis, and context awareness
- **Image Support**: Analyze code screenshots, error messages, and UI designs
- **Flexible AI Backend**: Use OpenAI API, Claude API, or your custom AI service
- **Smart Context**: Automatically detects current file and project context
- **Multi-language**: Supports Vietnamese and English conversations

### 🔧 **AI Integration Options**
- **Your Own API Keys**: OpenAI GPT-4/5, Claude Sonnet, or custom AI endpoints
- **GitHub Copilot**: Full compatibility with existing Copilot subscriptions
- **Local AI Models**: Support for company-hosted AI services
- **Hybrid Mode**: Mix and match different AI providers for different tasks

### 🚀 **Pull Request Intelligence**
- **Cross-Platform**: Full support for **GitHub**, **GitLab**, and **Azure DevOps**
- **AI-Powered Analysis**: Context-aware code change reviews
- **Visual Diff Viewer**: Monaco Editor integration with syntax highlighting
- **Template System**: Customizable review templates for different technologies

### 💬 **Chat Participants**
- **@review-file**: Comprehensive file analysis and suggestions
- **@review-changes**: Git diff analysis with intelligent insights
- **@review-all-changes**: Analyze ALL git changes in workspace at once
- **@review-pr**: Complete pull request review with team collaboration
- **@sync-review-templates**: Sync AIDA review templates to workspace
- **@dependency**: Visualize and analyze project dependencies

## 🚀 Quick Start
### 1. Installation
```bash
# Install from VS Code/Cursor Marketplace
ext install trongld232.aida-dev

# Or install from VSIX
code --install-extension aida-dev-1.0.34.vsix
```
### 2. User Cases
#### 1. With Github Copilot
1. **Just Use After Install**

#### 2. Use External AI API With Github Copilot
1. **Open Settings**: `Ctrl+,` → Search "AIDA"
2. **Enable AIDA Chatbot**: Set `Use Api Key Instead Of Copilot` to `true`
3. **Configure AI API**: Add your OpenAI or Claude key

#### 3. Setup AIDA Chatbot (For Non-Copilot Users)
1. **Open Settings**: `Ctrl+,` → Search "AIDA"
2. **Enable AIDA Chatbot**: Set `Has No Github Copilot` to `true`
3. **Configure AI API**: Add your OpenAI or Claude key
4. **Open AIDA Chat**: Click AIDA icon in Activity Bar or use `Ctrl+Shift+A`

### 3. AI Provider Configuration
```json
{
  // For OpenAI (GPT-4, GPT-5)
  "aida.ai.apiKey": "sk-your-openai-key",
  "aida.ai.apiHost": "https://api.openai.com/v1/chat/completions",
  "aida.ai.model": "gpt-4o",

  // For Claude API
  "aida.ai.apiKey": "sk-ant-your-claude-key", 
  "aida.ai.apiHost": "https://api.anthropic.com/v1/messages",
  "aida.ai.model": "claude-3-sonnet-20240229",

  // AIDA Chatbot Configuration
  "aida.useApiKeyInsteadOfCopilot": true,
  "aida.hasNoGithubCopilot": true,

  // Platform Integration Tokens To Review Pull Request
  "aida.github.personalAccessToken": "ghp_your-github-token",
  "aida.gitlab.personalAccessToken": "glpat-your-gitlab-token",
  "aida.azureDevOps.personalAccessToken": "your-azure-devops-token",
  "aida.azureDevOps.organization": "your-organization-name",
  "aida.azureDevOps.defaultProject": "your-default-project",
}
```

### 4. Start Using AIDA
- **Review Files**: Right-click any file → `AIDA: Review File`
- **Analyze Changes**: Right-click in Git view → `AIDA: Review Changes`  
- **Chat Interface**: Open AIDA Chat and type commands with `@` prefix

## 💬 AIDA Chat Commands

AIDA Chat provides intelligent code analysis through simple chat commands. Open the chat interface and use these participants:

### 📁 **@review-file** - Analyze Any File
**Usage:** `type: @review-file [file-path] in chat input`
```
@review-file src/components/UserProfile.tsx
@review-file    // Reviews current active file
```
**What it does:**
- ✅ Code quality & security analysis
- 🚀 Performance optimization suggestions  
- 📋 Best practices recommendations
- 🔍 Bug detection and fixes

### 🔄 **@review-changes** - Analyze Git Changes
**Usage:** `type: @review-changes in chat input`
```
@review-changes
```
**What it does:**
- 📊 Smart analysis of your uncommitted changes
- ⚠️ Impact assessment and risk evaluation
- 💡 Improvement suggestions and fixes
- 🚨 Breaking change detection

### 🚀 **@review-pr** - Analyze Pull Requests
**Usage:** `type: @review-pr [pr-url] in chat input`
```
@review-pr https://github.com/user/repo/pull/123
@review-pr https://gitlab.com/user/repo/-/merge_requests/45
```
**What it does:**
- 🔍 Cross-platform PR analysis (GitHub, GitLab, Azure DevOps)
- 👥 Team collaboration insights
- 📝 Automated review comments
- ✅ Merge readiness assessment

### 🎯 **Alternative Ways to Use AIDA**

**Right-click Context Menu:**
- Right-click on any file → `AIDA: Review File`
- Right-click in Git changes → `AIDA: Review Changes`

**Command Palette** (`Ctrl + Shift + P`):
- `AIDA: Review File` - Analyze current file
- `AIDA: Review Changes` - Analyze git changes  
- `AIDA: Review Pull Request` - Review PR by URL
- `AIDA: Open AIDA Chat` - Open chat interface

### 🔧 **@sync-review-templates** - Sync Templates
**Usage:** `@sync-review-templates`
```
@sync-review-templates
```
**What it does:**
- 📥 Downloads latest AIDA review templates to your workspace
- 🎯 Sets up language-specific templates (Angular, React, Vue, etc.)
- 🔄 Updates existing templates with improvements

### �️ **Context Menu Actions**
Right-click on files in the **Explorer** or **Editor** to access quick actions:
- **Review File**: Instant AI code review for the selected file
- **Review Changes**: Analyze Git changes for the selected file
- **Analyze Dependency**: Visualize dependencies for the selected file

### �🕸️ **@dependency** - Dependency Analysis
**Usage:**
```
@dependency                     // Analyze workspace (uses cache if available)
@dependency re-analyze          // Force fresh analysis (ignore cache)
@dependency pr <pr-url>         // Analyze dependencies in a Pull Request
```
**What it does:**
- 📊 Visualizes project dependencies in an interactive graph
- 🔍 Analyzes relationships between modules, components, and services
- 🤖 AI-powered impact analysis for changes
- ⚠️ Detects circular dependencies and architectural issues
- 💾 **Smart Caching**: Analysis results are cached for 24 hours for instant loading

*Note: Experimental features are controlled by developers and not available in production releases.*

## 🎯 Advanced Usage

### Custom Review Templates
AIDA uses intelligent template selection based on your project:

- **Framework-Specific**: Angular, React, Vue, Node.js
- **Language-Specific**: TypeScript, JavaScript, Python, C#, Go
- **Custom Templates**: Create your own in `AIDA/templates/review-code/`

### Project Structure
```
your-project/
├── AIDA/
│   └── templates/
│       └── review-code/
│           ├── languages/
│           └── fallback/

```

### Command Palette Actions
- `AIDA: Setup Azure DevOps Token` - Configure Azure DevOps integration
- `AIDA: Show Available Language Models` - View supported AI models
- `AIDA: Review File` - Review current file
- `AIDA: Review Changes` - Review git changes
- `AIDA: Review Pull Request` - Review PR by URL
- `AIDA: Open AIDA Chat` - Open AIDA sidebar chat interface 

## 🔧 Development & Contributing

### Contributing
We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## 📚 Documentation

- **[User Guide](https://github.com/trongld230289/aida/blob/main/docs/USER_GUIDE.md)** - Complete guide to using AIDA with step-by-step tutorials, chat commands, and best practices
- **[API Reference](https://github.com/trongld230289/aida/blob/main/docs/API.md)** - business documentation for developers, configuration options, and programmatic integration
- **[Template Guide](https://github.com/trongld230289/aida/blob/main/docs/TEMPLATES.md)** - Create and customize code review templates for your team's coding standards
- **[Troubleshooting](https://github.com/trongld230289/aida/blob/main/docs/TROUBLESHOOTING.md)** - Quick solutions to common issues, debugging tips, and getting help

## 🆘 Support & Community

### Getting Help
- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/trongld230289/aida/issues)
- 💡 **Feature Requests**: [GitHub Discussions](https://github.com/trongld230289/aida/discussions)
- 📧 **Direct Contact**: trongld232@gmail.com

### Community
- 🌟 **Star us on GitHub**: [github.com/trongld230289/aida](https://github.com/trongld230289/aida)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Made with ❤️ by [Trong Le](https://github.com/trongld230289)**

> "AIDA - Your AI Development Assistant. Code smarter, ship faster." 🚀