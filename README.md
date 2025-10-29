# 🤖 AIDA - AI Development Assistant

**Advanced AI Development Assistant with AIDA Chatbot for VS Code**

> Transform your development workflow with AIDA - Your intelligent coding companion featuring built-in chatbot, support for your own AI API (OpenAI/Claude), and comprehensive development tools. No GitHub Copilot required!

[![Version](https://img.shields.io/badge/version-1.0.4-blue.svg)](https://marketplace.visualstudio.com/items?itemName=trongld232.aida-dev)
[![VS Code](https://img.shields.io/badge/VS%20Code-1.90+-green.svg)](https://code.visualstudio.com/)
[![License](https://img.shields.io/badge/license-MIT-orange.svg)](LICENSE)

## 🌟 What is AIDA?

**AIDA (AI Development Assistant)** is an intelligent VS Code extension that acts as your personal development companion. It features a built-in AIDA Chatbot and supports your own AI API keys, giving you flexibility to use OpenAI, Claude, or GitHub Copilot:

- 🤖 **AIDA Chatbot** - Built-in chat interface with image support and conversation history
- 🔧 **Flexible AI Integration** - Use your own OpenAI/Claude API or GitHub Copilot
- 🔍 **Intelligent Code Review** - AI-powered analysis with framework-specific insights
- 🚀 **Smart PR Analysis** - Cross-platform support for GitHub, GitLab, and Azure DevOps
- 📊 **Project Scanning** - Comprehensive codebase analysis and architecture insights
- 💬 **Interactive Chat Participants** - Natural language interaction with your code
- 🛠️ **Development Workflows** - Automated daily reports and project management

## ✨ Key Features

### 🔍 **Smart Code Review**
- **Multi-language Support**: TypeScript, JavaScript, Python, C#, Java, Go, Rust
- **Framework Awareness**: Angular, React, Vue, Express, NestJS, ASP.NET
- **Security Analysis**: Automated security vulnerability detection
- **Performance Insights**: Code efficiency and optimization suggestions

### 🤖 **AIDA Chatbot (No Copilot Required)**
- **Built-in Chat Interface**: Copilot-style sidebar chat with conversation history
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
- **Cross-Platform**: GitHub, GitLab, Azure DevOps integration
- **AI-Powered Analysis**: Context-aware code change reviews
- **Visual Diff Viewer**: Monaco Editor integration with syntax highlighting
- **Template System**: Customizable review templates for different technologies

### 📊 **Project Scanning**
- **Architecture Analysis**: Understand your project structure instantly
- **Duplicate Detection**: Find redundant code and suggest consolidation
- **API Pattern Analysis**: Identify and optimize API endpoint patterns
- **Dependency Insights**: Track and manage project dependencies

### 💬 **Chat Participants**
- **@review-file**: Comprehensive file analysis and suggestions
- **@review-changes**: Git diff analysis with intelligent insights
- **@review-pr**: Complete pull request review with team collaboration
- **@sync-review-templates**: Sync AIDA review templates to workspace
- **@scan-app**: AI-powered code scanning and duplicate detection

## 🚀 Quick Start
### 1. Installation
```bash
# Install from VS Code Marketplace
ext install trongld232.aida-dev

# Or install from VSIX
code --install-extension aida-dev-1.0.4.vsix
```

### 2. Setup AIDA Chatbot (Optional - For Non-Copilot Users)
1. **Open Settings**: `Ctrl+,` → Search "AIDA"
2. **Enable AIDA Chatbot**: Set `aida.hasNoGithubCopilot` to `true`
3. **Configure AI API**: Add your OpenAI or Claude API key
4. **Open AIDA Chat**: Click AIDA icon in Activity Bar or use `Ctrl+Shift+A`

### 3. AI Provider Configuration
```json
{
  // For OpenAI (GPT-4, GPT-5)
  "aida.ai.apiKey": "sk-your-openai-key",
  "aida.ai.apiHost": "https://api.openai.com",
  "aida.ai.model": "gpt-4o",

  // For Anthropic Claude
  "aida.ai.apiKey": "sk-ant-your-claude-key", 
  "aida.ai.apiHost": "https://api.anthropic.com",
  "aida.ai.model": "claude-3-5-sonnet-20241022",

  // Use your API instead of Copilot
  "aida.useApiKeyInsteadOfCopilot": true
}
```

### 4. Start Using AIDA
- **Review Files**: Right-click any file → `AIDA: Review File`
- **Analyze Changes**: Right-click in Git view → `AIDA: Review Changes`
- **Chat Interface**: Open chat and use `@review-file`, `@scan-app`, etc.

## 💬 Chat Participants

### 📁 **@review-file** - Intelligent File Analysis
```
@review-file src/components/UserProfile.tsx
```
- Comprehensive code quality analysis
- Security vulnerability scanning
- Performance optimization suggestions
- Best practices recommendations

### 🔍 **@review-changes** - Git Diff Intelligence
```
@review-changes
```
- Smart analysis of your git changes
- Impact assessment and risk evaluation
- Suggested improvements and fixes
- Breaking change detection

### 🚀 **@review-pr** - Pull Request Assistant
```
@review-pr https://github.com/user/repo/pull/123
```
- Cross-platform PR analysis (GitHub, GitLab, Azure DevOps)
- Team collaboration insights
- Automated review comments
- Merge readiness assessment

## 🧪 **Experimental Features**

AIDA includes experimental features currently in development:

- **@scan-app**: Project-wide code analysis and architecture insights
- **@daily-report**: Automated progress tracking and reporting

*Note: Experimental features are controlled by developers and not available in production releases.*

## ⚙️ Configuration

### AI Provider Setup

#### OpenAI Configuration
```json
{
  "aida.ai.apiKey": "sk-...",
  "aida.ai.apiHost": "https://api.openai.com",
  "aida.ai.model": "gpt-4o"
}
```

#### Anthropic (Claude) Configuration
```json
{
  "aida.ai.apiKey": "sk-ant-...",
  "aida.ai.apiHost": "https://api.anthropic.com",
  "aida.ai.model": "claude-3-sonnet-20240229"
}
```

#### Custom AI Endpoint
```json
{
  "aida.ai.apiKey": "your-key",
  "aida.ai.apiHost": "https://your-ai-service.com",
  "aida.ai.model": "your-model"
}
```



### Platform Integration

#### GitHub Setup
```json
{
  "aida.github.personalAccessToken": "ghp_..."
}
```

#### GitLab Setup
```json
{
  "aida.gitlab.personalAccessToken": "glpat-..."
}
```

#### Azure DevOps Setup
```json
{
  "aida.azureDevOps.personalAccessToken": "your-token",
  "aida.azureDevOps.organization": "your-org",
  "aida.azureDevOps.defaultProject": "your-project"
}
```

## 🎯 Advanced Usage

### Custom Review Templates
AIDA uses intelligent template selection based on your project:

- **Framework-Specific**: Angular, React, Vue, Express, NestJS
- **Language-Specific**: TypeScript, JavaScript, Python, C#, Java, Go, Rust
- **Custom Templates**: Create your own in `VIDA/templates/review-code/`

### Project Structure
```
your-project/
├── VIDA/
│   └── templates/
│       └── review-code/
│           ├── languages/
│           └── fallback/

```

### Command Palette Actions
- `AIDA: Setup AI Configuration` - Configure AI providers
- `AIDA: Setup Azure DevOps` - Azure DevOps integration
- `AIDA: Show Available Models` - View supported AI models
- `AIDA: Review File` - Analyze current file
- `AIDA: Review Changes` - Analyze git changes

## 🔧 Development & Contributing

### Building from Source
```bash
git clone https://github.com/trongld230289/aida.git
cd aida
npm install
npm run compile
```

### Running in Development
1. Open project in VS Code
2. Press `F5` to launch Extension Development Host
3. Test AIDA features in the new window

### Contributing
We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## 📚 Documentation

- **[User Guide](docs/USER_GUIDE.md)** - Comprehensive usage documentation
- **[API Reference](docs/API.md)** - Extension API and configuration options
- **[Template Guide](docs/TEMPLATES.md)** - Custom template creation
- **[Troubleshooting](docs/TROUBLESHOOTING.md)** - Common issues and solutions

## 🆘 Support & Community

### Getting Help
- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/trongld230289/aida/issues)
- 💡 **Feature Requests**: [GitHub Discussions](https://github.com/trongld230289/aida/discussions)
- 📧 **Direct Contact**: trongld232@gmail.com

### Community
- 🌟 **Star us on GitHub**: [github.com/trongld230289/aida](https://github.com/trongld230289/aida)
- 🐦 **Follow Updates**: [@trongld232](https://twitter.com/trongld232)

## 📋 Changelog

### v1.0.0 - Initial Release (October 23, 2025)
- 🎉 **Initial AIDA Release** - Complete rebrand from AI Self Check
- 🤖 **AI Development Assistant** - Advanced intelligent coding companion
- 🔍 **Enhanced Code Review** - Multi-language and framework support
- 🚀 **PR Intelligence** - Cross-platform pull request analysis
- 📊 **Project Scanning** - Comprehensive codebase analysis
- 💬 **Chat Participants** - Natural language code interaction
- 🛠️ **Development Workflows** - Automated reporting and project management

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Made with ❤️ by [Trong Le](https://github.com/trongld230289)**

> "AIDA - Your AI Development Assistant. Code smarter, ship faster." 🚀