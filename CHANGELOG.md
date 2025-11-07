# Changelog

All notable changes to **AIDA - AI Development Assistant** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.12/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.12] - 2025-11-06

### 🎨 UI/UX Improvements & Code Cleanup

#### 🔧 Changed
- **📋 Context Menu Order**: Reordered context menus to show "Review Changes" before "Review File"
- **🧹 Code Cleanup**: Removed debug console logs from review changes functionality
- **📂 Source Control UX**: Fixed file suggestion to show correct requested file instead of currently opened file
- **🎯 Menu Grouping**: Improved menu positioning for better user experience

#### 🐛 Fixed
- **📄 File Detection**: Fixed issue where "Review Changes" suggested wrong file in no-changes scenarios
- **🔄 Menu Structure**: Cleaned up editor context menu by removing redundant "Review All Changes"

## [1.0.11] - 2025-11-06

### 🐛 Bug Fixes & Stability Improvements

#### 🔧 Fixed
- **🎭 Monaco Editor**: Fixed Monaco Editor loading issues in PR review feature
- **📦 Package Dependencies**: Added proper Monaco Editor files inclusion in package
- **⚠️ Error Handling**: Enhanced error handling with fallback views for Monaco Editor failures
- **🔄 Webpack Configuration**: Improved external dependencies handling for better compatibility

#### 🔧 Changed
- **📊 Presentation**: Added detailed ROI calculation formulas with VN market rates ($20-30/hour)
- **📋 Package Structure**: Updated file inclusion patterns for better extension packaging

## [1.0.10] - 2025-11-06

### ✨ Minor Updates & Improvements

#### 🔧 Changed
- **📊 Presentation Updates**: Enhanced AIDA presentation with improved navigation and content
- **🎨 UI Improvements**: Better styling and visual consistency across components
- **📝 Documentation**: Updated presentation materials and roadmap timeline

---

## [1.0.9] - 2025-11-06

### ✨ New Features & Template Updates

#### 🚀 Added
- **🔍 @review-all-changes**: New command to review ALL git changes in workspace at once
  - Uses same `review-changes.md` template as `@review-changes`
  - Automatically filters out config files (.gitignore, package-lock.json, .env, etc.)
  - Available in GitHub Copilot Chat, AIDA Chatbot, Command Palette (Ctrl+Shift+P), and Context Menu
  - Single API call optimization combining all diffs for efficiency
  - Full streaming support in AIDA chatbot sidebar

#### 🔧 Enhanced
- **📋 Review Templates**: Updated all review templates with improved analysis patterns
- **🎯 Command Integration**: Added @review-all-changes to all access points:
  - GitHub Copilot Chat: `@review-all-changes`
  - AIDA Chatbot: `@review-all-changes` with streaming
  - Command Palette: "AIDA: Review All Changes"
  - Right-click Context Menu: "AIDA: Review All Changes"

## [1.0.6] - 2025-10-31

### 🐛 Content Validation Fixes

#### 🔧 Fixed
- **📝 Documentation Cleanup**: Removed potentially flagged content causing extension validation errors
- **🔗 API References**: Updated to use standard Claude API endpoints instead of custom domains
- **🏷️ Model Names**: Standardized AI model naming conventions
- **✨ Content Sanitization**: Cleaned up all suspicious content that could trigger marketplace validation

#### 📝 Updated
- **Claude Integration**: Updated to use official Anthropic API endpoints
- **Configuration Examples**: Cleaned up all configuration examples for better compliance

## [1.0.5] - 2025-10-31

### 🎯 Enhanced Chat Interface & User Experience

#### ✨ Added
- **🤖 Smart Autocomplete**: Enhanced chat autocomplete with single-result auto-selection via Enter key
- **💬 Improved Chat UX**: Clean visual design with highlighted participant names and removed animations
- **🔄 Smart /clear Command**: Clears chat view while preserving user input history
- **📝 Enhanced Documentation**: Updated README with comprehensive configuration examples and usage guides
- **🎨 Visual Polish**: Improved chat interface styling with better user experience

#### 🔧 Improved
- **📖 Documentation Accuracy**: Synchronized all language lists and command descriptions across documentation
- **⚙️ Configuration Examples**: Complete configuration guide with all available settings
- **🎯 Template Organization**: Validated and organized template structure across 9 supported languages

#### 🐛 Fixed
- **🎨 Animation Issues**: Removed distracting pulse animations from chat interface
- **📝 Typos**: Fixed documentation typos and inconsistencies
- **🔧 Language Categorization**: Corrected language support lists to match actual implementation

## [1.0.4] - 2025-10-30

### 🔧 Enhanced Features & Template Improvements

#### ✨ Added
- **📝 Comprehensive Review Templates**: Complete suite of language and framework-specific templates
  - Framework templates: Angular, Vue.js, React, NestJS, Express.js
  - Language templates: TypeScript, JavaScript, Python, C#, Go, PHP, Rust, Node.js
  - Generic fallback template for universal code analysis
- **🛡️ Advanced Security Analysis**: Enhanced security violation detection across all languages
- **⚡ Performance Optimization**: Improved performance checks and recommendations
- **🎯 Framework-Specific Patterns**: Deep framework understanding with best practice enforcement
- **📊 Enhanced Health Metrics**: Comprehensive scoring system with 5-star ratings
- **🔍 Critical Check Categories**: 9-10 critical violation categories per template

#### 🔄 Improved
- **🤖 Template System**: Consolidated and standardized all review templates
- **📈 Code Analysis**: More detailed analysis with extensive code examples
- **🎨 Action Items**: Better prioritization with Critical, Important, and Improvement categories
- **💡 Upgrade Recommendations**: Enhanced migration paths and performance improvements
- **🔒 Security Focus**: Strengthened security violation detection and mitigation strategies

#### 🏗️ Technical Enhancements
- **Template Structure**: Consistent 1000+ line templates with comprehensive coverage
- **Framework Detection**: Improved auto-detection for template selection
- **Code Examples**: Extensive real-world code examples in each template
- **Documentation**: Enhanced inline documentation and usage examples

## [1.0.3] - 2025-10-29

### 🎉 Initial AIDA Release

**BREAKING CHANGES**: Complete rebrand from "AI Self Check" to "AIDA - AI Development Assistant"

#### ✨ Added
- **🤖 AI Development Assistant**: Complete transformation to intelligent coding companion
- **🔍 Enhanced Code Review**: Multi-language support (TypeScript, JavaScript, Python, C#, Java, Go, Rust)
- **🚀 Framework Intelligence**: Deep understanding of Angular, React, Vue, Express, NestJS, ASP.NET
- **📊 Project Scanning**: Comprehensive codebase analysis with architecture insights
- **💬 Chat Participants**: Natural language interaction with code through VS Code Chat
  - `@review-file` - Intelligent file analysis
  - `@review-changes` - Git diff intelligence
  - `@review-pr` - Pull request assistant
  - `@scan-app` - Project scanner
  - `@daily-report` - Progress tracking
- **🛠️ Cross-Platform PR Support**: GitHub, GitLab, Azure DevOps integration
- **📈 Development Workflows**: Automated daily reports and project management
- **🎯 Smart Template System**: Framework and language-specific review templates
- **🔧 Advanced Configuration**: Multiple AI provider support (OpenAI, Anthropic, Custom)

#### 🔄 Changed
- **Extension Name**: `ai-self-check` → `aida`
- **Display Name**: "AI Self Check" → "AIDA - AI Development Assistant"
- **Version Reset**: Starting fresh at v1.0.0
- **Command Prefix**: `aiSelfCheck.*` → `aida.*`
- **Configuration Keys**: All settings now use `aida.*` prefix
- **Category Names**: "AI Self Check" → "AIDA"

#### 🏗️ Technical Changes
- **Package Structure**: Updated all internal references to use AIDA branding
- **Command IDs**: Migrated from `aiSelfCheck.*` to `aida.*`
- **Configuration Schema**: Updated all settings to use `aida.*` namespace
- **Template System**: Enhanced VIDA template structure with better organization
- **Error Handling**: Improved error messages with AIDA branding
- **Logging**: Enhanced debug output with AIDA identification

#### 📚 Documentation
- **New README**: Comprehensive documentation with feature overview
- **Setup Guide**: Detailed configuration instructions for all AI providers
- **Usage Examples**: Complete examples for all chat participants
- **Configuration Reference**: Full settings documentation
- **Migration Guide**: Upgrade path from AI Self Check (implicit through settings)

#### 🔧 Developer Experience
- **Extension Development**: Improved development workflow with better debugging
- **Template Customization**: Enhanced template system for custom review rules
- **API Integration**: Streamlined platform integration (GitHub, GitLab, Azure DevOps)
- **Error Diagnostics**: Better error reporting and troubleshooting information

#### 🛡️ Security & Reliability
- **Token Management**: Secure handling of API keys and personal access tokens
- **Error Boundaries**: Improved error handling and graceful degradation
- **Performance**: Optimized AI API calls and caching strategies
- **Privacy**: Local processing where possible, secure cloud communication

---

## Migration from AI Self Check

If you were using the previous "AI Self Check" extension:

### Automatic Migration
- Settings will be automatically migrated from `aiSelfCheck.*` to `aida.*`
- Templates will be preserved in the `VIDA/templates/` structure
- All functionality remains the same with enhanced capabilities

### Manual Steps Required
1. **Update Settings**: Review your VS Code settings and update any references
2. **Command Palette**: Use new `AIDA:` prefixed commands
3. **Right-Click Menus**: Look for "AIDA" category instead of "AI Self Check"

### New Configuration Format
```json
{
  // Old format (deprecated)
  "aiSelfCheck.ai.apiKey": "your-key",
  
  // New format (recommended)
  "aida.ai.apiKey": "your-key"
}
```

---

## Upcoming Features

### 🔮 Planned for v1.1.0
- **🔍 Advanced Code Scanning**: More sophisticated pattern detection
- **🤝 Team Collaboration**: Shared templates and review guidelines
- **📊 Analytics Dashboard**: Code quality metrics and trends
- **🎨 Custom Themes**: Personalized AIDA appearance options
- **🔌 Plugin System**: Extension ecosystem for custom analyzers

### 🚀 Roadmap
- **Multi-Repository Support**: Cross-project analysis and insights
- **CI/CD Integration**: Automated code review in build pipelines
- **Advanced AI Models**: Support for latest AI capabilities
- **Mobile Companion**: AIDA insights on mobile devices
- **Enterprise Features**: Advanced security and compliance tools

---

## Contributing

We welcome contributions to AIDA! Please see our [Contributing Guide](CONTRIBUTING.md) for details on:

- 🐛 Bug reporting and fixes
- 💡 Feature requests and development
- 📚 Documentation improvements
- 🧪 Testing and quality assurance

---

**Made with ❤️ by [Trong Le](https://github.com/trongld230289)**