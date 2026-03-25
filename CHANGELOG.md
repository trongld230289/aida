# Changelog

All notable changes to the "AIDA - AI Development Assistant" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.34/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.20] - 2026-03-22

### Changed
- **🔑 Removed Public Key from README**: All activation keys now require contacting the project owner — no public key exposed in documentation

## [1.1.19] - 2026-03-21

### Added
- **🔑 Public Activation Key**: Added `aida-public-key` for external/public users — bypasses encryption, domain check, and expiry validation. Usage tracking is disabled (no App Insights config)
- **📤 `isPublicKey()` export**: New helper in `activation-key.ts` to detect public key usage

### Changed
- **📧 Removed company emails from README**: Replaced personal emails with GitHub Issues contact link
- **⚙️ Settings description updated**: `aida.activationKey` now documents the public key option

## [1.1.18] - 2026-03-21

### Fixed
- **🔧 Chatbot "is not a function" Error**: Fixed mixin method shadowing in `sidebar-core.ts` — class field initializers (`= null`) were creating instance own-properties that shadowed prototype methods from `Object.assign`. Changed to definite assignment (`!:`) declarations

### Changed
- **📦 Installation Flow**: Updated to marketplace install (Extensions → search `aida-dev`) instead of offline `.vsix`
- **📝 README Rewrite**: Cleaner structure matching the HTML presentation slides — punchy intro, streamlined quick start, consolidated settings
- **🔑 Activation Key Required**: Highlighted as mandatory in all docs (README, HTML slides)
- **🛡️ Trust Accounts**: Added GitHub & Microsoft trust account steps to README and HTML presentation

## [1.1.17] - 2026-03-20

### Changed
- **🔑 Single Edition — Activation Key Always Required**: Removed dual public/company edition system. Every build now requires a valid activation key to unlock features
- **🏗️ Simplified Build Pipeline**: Single `npm run build` replaces `build:company` / `build:dev`. No more `--env edition=` flag
- **📦 Simplified Packaging**: Single `npm run package` replaces `package:company`. Removed `readme-edition.js` and `package-company.js` scripts
- **📊 Tracking Always Enabled**: Usage tracking always active (config delivered via activation key)
- **⚙️ edition.config.js**: Removed `public`/`company` editions object. Single config with `ENCRYPTION_SECRET: 'CEP_AIDA'`
- **🧹 Removed Build Constants**: `__IS_COMPANY_VERSION__`, `__EDITION_TYPE__` no longer exist. Removed from `edition.config.js`, `webpack.config.js`, `activation-key.ts`, `usage-tracking.ts`, `global.d.ts`

### Removed
- `scripts/package-company.js` — no longer needed
- `scripts/readme-edition.js` — no longer needed
- `npm run build:company` / `build:dev` / `webpack:company` / `package:company` scripts
- `<!-- COMPANY_ONLY_START -->` README marker system

## [1.1.16] - 2026-03-04

### Added
- **🔑 Activation Key System**: Company edition now requires an encrypted activation key for tracking. iKey removed from VSIX build — delivered via `aida.activationKey` VS Code setting
- **🛡️ 3-Layer Security**: (1) No iKey in VSIX, (2) AES-256-CBC encrypted key, (3) Windows domain check
- **⚙️ New Setting**: `aida.activationKey` — paste activation key from admin
- **📋 New Commands**: `Clear Activation Key`, `Show Activation Status`
- **🔧 Admin CLI Tool**: `generate-activation-key.js` for generating encrypted keys per company

### Changed
- **📊 Tracking gated behind activation**: Company edition tracking requires valid activation key (domain + expiry check)
- **🏗️ edition.config.js**: App Insights credentials removed from build, replaced with `ENCRYPTION_SECRET`

### Security
- VSIX no longer contains App Insights instrumentation key
- Public edition has no encryption secret (completely safe)

## [1.1.15] - 2026-02-25

### Changed
- **🔄 Identity System Rewrite**: Replaced 5-priority sequential identity chain with 3 parallel sources collected via `Promise.all()` — Windows, Microsoft, GitHub
- **🆕 Windows Display Name**: Added `getWindowsDisplayName()` using Win32 `GetUserNameEx(NameDisplay)` via `secur32.dll` to retrieve Active Directory display name (e.g., "Trong Duc Le")
- **📊 Tracking Schema**: New fields — `windowsId`, `windowsDomain`, `windowsUsername`, `computerName`, `windowsDisplayName`, `microsoftAccount`, `githubAccount`, `machineId`; removed `userEmail`, `userType`

### Removed
- **🗑️ IdentityProvider enum**: Removed from `tracking-enums.ts` — no longer needed with parallel collection
- **🗑️ Git Email / Machine ID providers**: Removed `getGitIdentity()`, `getGitEmail()`, `resolveIdentity()` from `usage-tracking.ts`

## [1.1.14] - 2026-02-23

### Fixed
- **🐛 Emoji Encoding**: Fixed double-encoded UTF-8 emoji characters across 22 TypeScript source files (CP1252/Latin-1 double-encoding from v1.1.13 TypeScript migration)
- **🐛 Streaming Render**: Fixed broken HTML/markdown rendering during AI review streaming — fragments now flush on line boundaries to prevent incomplete syntax glitches (e.g., partial `**bold**`, broken lists)

## [1.1.13] - 2026-02-21

### Changed
- **♻️ TypeScript Migration**: Converted all JavaScript source files to TypeScript (.js → .ts)
- **♻️ Entry Point**: Migrated extension.js → extension.ts with ES module imports
- **♻️ Build Config**: Updated webpack entry from extension.js to extension.ts

## [1.1.12] - 2026-02-20

### Changed
- **♻️ Refactoring**: Major codebase restructuring — domain folder organization, template extraction, circular dependency fixes
- **♻️ Token Estimator**: Replaced hardcoded model list with dynamic slug-ify normalization (auto-supports new Copilot models)
- **♻️ Architecture**: Split monolithic files into domain modules (review/, dependency/, tracking/, scan/, chatbot/, daily/)
- **♻️ Templates**: Extracted 7 inline HTML templates into separate `.html` files for maintainability

### Added
- **📄 Architecture Docs**: Created `docs/ARCHITECTURE.md` with full module map and design decisions
- **📄 Build Guide**: Updated `docs/BUILD-GUIDE.md` with template files section

## [1.1.11] - 2026-01-14

### Fixed
- **🐛 Business Documents**: Implemented workspace AIDA folder detection in resolveAidaBasePath function
- **🐛 Review Options**: Fixed business documents not being found from workspace AIDA/business-docs/ folder
- **🐛 Path Resolution**: Added Priority 2 check for workspace AIDA folder before extension fallback

### Added
- **🆕 Workspace Detection**: Added automatic detection of workspace AIDA folder structure
- **🆕 Business Docs Support**: Enhanced review workflow now properly detects business documents

## [1.1.10] - 2026-01-14

### Fixed
- **🐛 Business Documents**: Fixed workspace AIDA folder detection for business documents
- **🐛 Review Options**: Fixed review options dialog not showing when business documents exist
- **🐛 Path Resolution**: Added workspace AIDA folder priority in `resolveAidaBasePath()` function

### Changed
- **♻️ Path Priority**: Business documents now properly detected from workspace `AIDA/business-docs/` folder
- **♻️ Review Flow**: Enhanced review options dialog now shows correctly when business documents are available

## [1.1.9] - 2026-01-13

### Fixed
- **🐛 Dependency Analysis**: Fixed model selection not using AIDA Chatbot selected model
- **🐛 Model Context**: Fixed `getUnifiedModel` receiving null context from dependency analysis

### Changed
- **♻️ Dependency Analysis**: Now passes `global.aidaExtensionContext` to respect user's model selection

## [1.1.8] - 2026-01-13

### Fixed
- **🐛 Model Selection**: Fixed AIDA Chatbot model selection not being used by review commands
- **🐛 Model Selection**: Review commands now respect user's model selection from AIDA Chatbot
- **🐛 Model List Reload**: Fixed model list not reloading immediately when toggling "Use External AI"

### Added
- **🆕 Global Context**: Added `global.aidaExtensionContext` for review commands to access workspaceState
- **🆕 Default Model**: First-time AIDA Chatbot users now default to Claude Opus 4.5
- **🆕 Helper Function**: Added `getAidaChatbotSelectedModel()` for unified model retrieval

### Changed
- **♻️ Model Priority**: Simplified model selection priority - AIDA Chatbot selection takes precedence
- **♻️ Code Cleanup**: Removed hardcoded model preference lists in favor of user selection

## [1.1.7] - 2026-01-13

### Fixed
- **🐛 Dependency Analysis**: Fixed CSS Peek "Request textDocument/definition failed" error handling
- **🐛 Dependency Analysis**: Excluded Migrations folder from C# scanning (auto-generated files)
- **🔇 Logging**: Added comprehensive LSP error filtering for CSS Peek extension

### Added
- **🆕 C# Support**: Added full C# language configuration for dependency analysis
- **🔗 C# Patterns**: Enhanced detection for MediatR, constructor injection, base classes, and property access
- **📝 Documentation**: Updated LSP-ERROR-FIXES.md with CSS Peek error explanations

## [1.1.6] - 2026-01-13

### Fixed
- **🐛 Dependency Analysis**: Fixed Angular/CSS LSP "Invalid Selector" error handling
- **🔇 Logging**: Added filter for CSS peek errors and Angular decorator parsing issues
- **📝 Documentation**: Updated LSP-ERROR-FIXES.md to cover C#, Angular, and Python LSP errors

## [1.1.5] - 2026-01-13

### Fixed
- **🐛 Dependency Analysis**: Fixed C# LSP "Sequence contains no matching element" error handling
- **🔇 Logging**: Silenced expected LSP errors for external library symbols
- **📝 Error Messages**: Improved error filtering to only show relevant LSP issues

## [1.1.4] - 2026-01-13

### Changed
- Version update to 1.1.4

## [1.1.3] - 2025-12-31

### Improved
- **🔧 Configuration**: Unified ignore rules for PR Review and Dependency Analysis
- **🔧 Configuration**: Added centralized `ignore-rules.js` for easier management of excluded files/folders
- **🔍 PR Review**: Applied consistent ignore patterns (including C# specific rules) to PR reviews
- **🕸️ Dependency Analysis**: Updated dependency analyzer to use the shared ignore configuration

## [1.1.2] - 2025-12-30

### Fixed
- **🕸️ Dependency Analysis**: Fixed crash when analyzing single file dependency without existing cache
- **🕸️ Dependency Analysis**: Enforced cache check for PR analysis to ensure accuracy

## [1.1.1] - 2025-12-30

### Added
- **🕸️ Dependency Analysis**: Added `@dependency pr <url>` for analyzing PR dependencies
- **🕸️ Dependency Analysis**: Added `@dependency re-analyze` for forcing fresh analysis
- **🖱️ Context Menu**: Added right-click actions for Review File, Review Changes, and Analyze Dependency
- **📖 Documentation**: Updated README with detailed `@dependency` usage and context menu actions

## [1.1.0] - 2025-12-07

### Added
- **🕸️ Dependency Analysis**: New `@dependency` chat participant
  - Visualizes project dependencies in an interactive graph
  - Analyzes relationships between modules, components, and services
  - AI-powered impact analysis for changes
  - Detects circular dependencies and architectural issues

## [1.0.46] - 2025-12-07

### Fixed
- **🔧 C# Language Server Error Handling**: Improved dependency analysis robustness
  - Added defensive `.catch()` for LSP errors ("Sequence contains no matching element")
  - LSP resolution failures now logged as warnings instead of crashing analysis
  - Graceful handling when OmniSharp cannot resolve symbol definitions

### Changed
- **🎨 UI Enhancement**: Lighter progress indicator for dependency analysis
  - Changed from `ProgressLocation.Notification` (popup) to `ProgressLocation.Window` (status bar)
  - Less intrusive, non-blocking UI during background analysis
  - User can continue working without notification popups

## [1.0.45] - 2025-12-07

### Changed
- **🔧 Dependency Analysis Refactoring**: Configuration-driven architecture for multi-language support
  - Refactored `vscode-api-analyzer.js` from hard-coded if/else to configuration-driven design
  - Added support for 12+ languages: TypeScript, JavaScript, Python, C#, Java, Vue, PHP, Go, Rust, Kotlin, Swift, Dart, Ruby
  - Each language has dedicated configuration: extensions, import patterns, class patterns, standard libraries, exclude patterns
  - Reduced code from ~350 to ~180 lines (-49%) while adding 200% more language support
  - Generic `processWithConfig()` function replaces 5+ language-specific processors
  - Language-specific exclude patterns for more accurate file filtering
  - Auto-generated file patterns from configuration
  - Adding new language now requires only 6 lines of config instead of 50 lines of code

### Added
- **📚 Comprehensive Documentation**: Added `README.md` in dependency-graph folder
  - Complete architecture diagrams (ASCII art)
  - Processing flow explanations
  - Language configuration guide
  - Graph structure documentation
  - Performance optimization details
  - Design patterns used
  - Usage examples and best practices

### Technical Improvements
- Configuration-Driven Design: Data over code approach for better maintainability
- Strategy Pattern: Language-specific processing via configuration
- DRY Principle: Single generic processor for all languages
- Open/Closed Principle: Add languages without modifying existing code
- Performance: Auto-build extension map for O(1) language detection

## [1.0.44] - 2025-12-05

### Added
- **📊 Dependency Graph Visualization**: Interactive D3.js force-directed graph for project dependencies
  - Real-time statistics: file count, edge count, circular dependency detection
  - Node search with instant filtering and centering
  - Zoom, pan, and recenter controls for easy navigation
  - Visual node animations with pulse-glow effects on selection
  - Animated dependency lines (red for outgoing, orange for incoming)
  - Color-coded section headers matching dependency types
  - Export functionality with "Copy JSON" button for graph data backup

- **🤖 AI Impact Analysis**: Intelligent dependency analysis with GitHub Copilot integration
  - Click any node to analyze dependencies and dependents
  - AI-powered impact assessment for code changes
  - Automatic model selection (Claude Sonnet 4.5, Gemini, GPT-4)
  - Clean output format without streaming headers
  - File content analysis with security and performance insights

- **🔄 Circular Dependency Detection**: DFS-based algorithm to identify dependency cycles
  - Automatic detection on graph initialization
  - Visual counter in Analysis Summary section
  - Helps identify architectural issues in codebase

- **🎨 Enhanced UI/UX**: Modern, responsive design with consistent styling
  - Blue accent theme (#007acc) across all sections
  - Single-line Analysis Summary for cleaner layout
  - Responsive panels with proper scrolling
  - Blue gradient buttons with hover effects
  - Border-left styling for visual hierarchy

## [1.0.40] - 2025-12-01

### Changed
- **Version Update**: Updated extension version to 1.0.40

## [1.0.39] - 2025-11-29

### Changed
- **Token Configuration Help**: Enhanced multi-organization sample configuration display
- **Configuration Examples**: Improved sample JSON to clearly show support for multiple organizations per provider
- **Code Cleanup**: Removed unused `sampleConfigs` object and simplified token help generation

### Fixed
- **Package.json Structure**: Fixed JSON structure issues with chatParticipants placement
- **Extension Loading**: Resolved extension registration problems for chat participants

## [1.0.37] - 2025-11-28

### Changed
- **Path Normalization**: Refactored AIDA template path resolution to be simpler with config-based approach
- **Code Reusability**: Created `normalizePathForDisplay()` helper function for consistent path display
- **Cross-Platform Paths**: All path displays now use forward slash `/` for better cross-platform compatibility

### Added
- **Template Configuration**: Added `aida.templatesBasePath` config setting for custom template locations
- **Auto-Creation**: Automatically creates AIDA structure if configured path doesn't exist
- **Helper Functions**: Exported `normalizePathForDisplay`, `resolveAidaBasePath`, `copyTemplatesRecursive`

### Fixed
- **Path Separators**: Fixed mixed path separator issues (backslash/forward slash) in output display
- **Detection Reason**: Normalized detection reason to use consistent path format

## [1.0.36] - 2025-11-26

### Fixed
- **SSL Certificate Issues**: Added rejectUnauthorized: false option to fix corporate environment connectivity
- **GitLab Integration**: Resolved SSL certificate errors when accessing GitLab API in corporate networks
- **Azure DevOps Integration**: Fixed SSL certificate issues for Azure DevOps API requests
- **GitHub Integration**: Added SSL bypass for GitHub API requests in restricted environments

### Enhanced
- **Corporate Network Support**: Improved compatibility with corporate firewalls and proxy configurations
- **API Connectivity**: Better error handling for SSL certificate validation issues
- **Cross-Platform PR Review**: Enhanced reliability for PR/MR reviews across all supported platforms

### Technical
- Added rejectUnauthorized: false to HTTPS request options for GitLab, GitHub, and Azure DevOps
- Improved error messages for SSL-related connectivity issues
- Enhanced corporate environment compatibility

## [1.0.34] - 2025-11-25

### Fixed
- **Chat Participants**: Fixed issue where chat participants were only registered when useAidaChatbot=true
- **GitHub Copilot Integration**: Restored proper @review-changes and @review-file functionality in GitHub Copilot
- **Extension Logic**: Chat participants now always register regardless of useAidaChatbot setting

### Changed
- **Participant Registration**: Separated participant registration logic from UI selection logic
- **Error Handling**: Improved error messages for missing chat participants

### Technical
- Fixed "No activated agent with id 'review-changes'" error in GitHub Copilot
- Ensured chat participants are available for both AIDA and GitHub Copilot modes

## [1.0.33] - 2025-11-24

### Changed
- **Settings Improvement**: Renamed setting from "Has No GitHub Copilot" to "Use AIDA Chatbot" for better clarity
- **Logic Fix**: Fixed extension logic to properly respect user choice instead of auto-fallback based on Copilot status
- **Configuration**: Updated setting key from `aida.hasNoGithubCopilot` to `aida.useAidaChatbot` for more positive naming

### Fixed
- **Right-click Menu**: Fixed issue where right-click review commands always opened AIDA chatbot regardless of setting
- **Extension Logic**: Removed problematic OR condition that caused unwanted AIDA activation when Copilot was inactive

### Technical
- Simplified boolean logic for chat selection
- Updated all internal references to use new setting key
- Improved console logging for debugging

## [1.0.32] - 2025-11-24

### Improved
- **AI Model Selection**: Updated model preferences to match current VS Code Chat available models
- **Model Priority**: Enhanced auto-detection to prioritize Claude Sonnet 4, Claude Haiku 4.5, and other premium models
- **Code Quality**: Improved model selection logic based on latest available models in GitHub Copilot
- **PR Review Logic**: Optimized reviewable file filtering to use only filtered files for AI analysis instead of all file changes

### Technical
- Updated model preferences array to include: Claude Sonnet 4, Claude Haiku 4.5, Claude Sonnet 4.5, GPT-4.1, GPT-5, and other current generation models
- Enhanced PR review to focus only on reviewable files (excluding auto-generated, config files, etc.)
- Improved debugging and logging for model selection process

## [1.0.30] - 2025-11-24

### Fixed
- **Azure DevOps PR Analysis**: Fixed Azure DevOps URL parsing to support both classic and modern URL formats
- **Variable Scope Issues**: Resolved 'allFileChanges is not defined' errors in Azure DevOps PR analysis
- **File Change Detection**: Fixed issue where PR analysis showed 0 files when multiple files were actually processed
- **Debug Logging**: Enhanced error reporting and debugging capabilities for PR analysis operations

### Improved
- **URL Pattern Matching**: Added dual regex patterns to handle Azure DevOps URL variations  
- **Error Handling**: Better error messages and diagnostic information for failed PR operations
- **Code Quality**: Eliminated variable shadowing issues in async functions

## [1.0.29] - 2025-11-24

### Fixed
- Azure DevOps URL parsing: Added support for modern Azure DevOps URL format (`dev.azure.com/{org}/{project}/pullrequest/{id}`)
- Resolved variable scope issue in Azure DevOps PR analysis that caused `allFileChanges is not defined` error
- Enhanced Azure DevOps URL regex patterns to handle both classic and modern URL formats
- Improved error handling and variable initialization in Azure DevOps integration

### Improved  
- Azure DevOps PR analysis now supports both URL formats seamlessly
- Better compatibility with newer Azure DevOps project structures
- Enhanced help documentation with examples of both supported URL formats
- More robust error handling during PR data processing

## [1.0.28] - 2025-11-21

### Added
- Azure DevOps auto-detection: Organization and project are now automatically parsed from PR URLs
- Simplified Azure DevOps configuration: Only token required, no manual organization/project setup needed
- Enhanced Azure DevOps user experience with auto-detection status messages and fallback handling
- Consistent URL-based auto-detection across GitLab, GitHub, and Azure DevOps platforms

### Improved
- Azure DevOps setup process simplified - removed manual configuration requirements
- Progress notifications now show detected organization/project information
- Settings templates updated to reflect token-only configuration approach
- Extension documentation updated to highlight auto-detection capabilities

### Removed
- `aida.azureDevOps.organization` setting (now auto-detected from URL)
- `aida.azureDevOps.defaultProject` setting (now auto-detected from URL)
- Manual configuration step for Azure DevOps organization and project

### Changed
- Azure DevOps PR review workflow now matches GitLab simplicity
- Updated setup commands and help text to reflect auto-detection approach

## [1.0.27] - 2025-11-20

### Added
- Enhanced PR review filtering system with reusable `filterReviewableFiles()` function
- Dual file array support: `fileChanges` (all files for Monaco diff view) and `reviewableFileChanges` (filtered for AI review)
- Auto-filtering of Migration Designer files (*.Designer.cs) across Azure DevOps, GitHub, and GitLab
- Consistent logging and statistics across all PR providers

### Improved
- Monaco diff view now displays ALL files for complete context
- AI review analysis focuses only on relevant files (excludes auto-generated)
- Refactored duplicate filter code into centralized function
- Better extensibility for adding new filter patterns in the future

### Fixed
- Token limit analysis with proper soft/hard limit warnings for Copilot API
- Removed duplicate `performQuickReview` function to clean up codebase

## [1.0.26] - 2025-11-20

### 🔧 PR Review Improvements

#### ✨ Added
- **🚫 Smart File Filtering**: Added ability to exclude auto-generated files from AI review context
  - Migration Designer.cs files are now automatically ignored during PR reviews
  - Reduces AI context size and focuses review on meaningful code changes
  - Files still appear in diff display for full transparency
  - Extensible pattern matching for future auto-generated file types

#### 🛠️ Enhanced
- **📊 Better Logging**: Improved transparency with detailed file filtering logs
- **🎯 Focused AI Analysis**: AI now only analyzes files that provide review value
- **⚡ Performance**: Reduced token usage by filtering out boilerplate code

## [1.0.25] - 2025-11-18

### 🚀 New Features & GitLab Support Enhancement

#### ✨ Added
- **🦊 Enhanced GitLab Support**: Improved GitLab merge request URL pattern recognition
  - Support for nested namespaces like `d365ai/xyz/sample-project/middleware-service`
  - Fixed regex pattern to handle complex GitLab project structures
  - Better parsing of GitLab namespace/project hierarchies
- **🔧 PR Review Improvements**: Enhanced pull request analysis for GitLab
- **🛠️ Bug Fixes**: Resolved GitLab URL parsing issues

#### 🔧 Enhanced
- **🌐 Multi-level Namespace Support**: GitLab projects with multiple namespace levels now properly recognized
- **📋 Better URL Parsing**: More robust URL pattern matching for various GitLab instances
- **🎯 Improved Detection**: Enhanced project structure detection for nested GitLab namespaces

## [1.0.22] - 2025-11-17

### 🚀 New Features & Cross-IDE Support

#### ✨ Added
- **🖥️ Cursor IDE Support**: Full compatibility with Cursor IDE alongside VS Code
  - Works seamlessly with Cursor's AI-powered development environment
  - All AIDA features available in both VS Code and Cursor IDE
  - Cross-IDE template and configuration synchronization
- **📚 Enhanced Documentation**: Updated review documents with Cursor IDE integration
- **🔧 Cross-Platform Compatibility**: Improved extension compatibility across different IDE environments
- **🤖 Enhanced AIDA Chatbot**: Better integration with Cursor's AI features when available
- **🎯 Universal Commands**: All AIDA commands work identically in both VS Code and Cursor

#### 🔧 Enhanced
- **📋 Package Description**: Updated to highlight dual IDE support
- **🏷️ Version Badges**: Added Cursor IDE compatibility badge to documentation
- **📝 Installation Guide**: Updated installation instructions for both IDEs
- **⚙️ Configuration Examples**: Enhanced setup examples for Cursor IDE users

#### 🔄 Improved
- **🔗 Cross-IDE Integration**: Seamless experience across VS Code and Cursor environments
- **📊 Performance**: Optimized for both traditional VS Code and AI-enhanced Cursor workflows
- **🛠️ Development Workflow**: Enhanced development experience for users switching between IDEs

#### 🐛 Fixed
- **🔧 IDE Detection**: Improved detection and adaptation to different IDE environments
- **📋 Command Registration**: Ensured all commands work properly in both VS Code and Cursor
- **⚡ Extension Loading**: Optimized extension loading for different IDE architectures

## [1.0.17] - 2025-11-11

### 🚀 New Features & Enhancements

#### ✨ Added
- **🔧 Version Update**: Updated extension to version 1.0.17
- **📋 Package Management**: Updated package.json and package-lock.json to latest version
- **📚 Documentation**: Updated README.md with latest version references
- **🔄 Stability Improvements**: Enhanced extension stability and performance
- **🛠️ Development Workflow**: Improved development and build processes

#### 🔧 Changed
- **📦 Extension Package**: Updated all version references across extension files
- **🏷️ Version Badge**: Updated version badge in README from 1.0.15 to 1.0.17
- **📝 Installation Guide**: Updated VSIX installation command with new version

#### 🐛 Fixed
- **🔧 Version Consistency**: Ensured all version references are consistent across files
- **📋 Package Dependencies**: Updated package lock file to match new version
- **📚 Documentation Accuracy**: Fixed any outdated version references in documentation

## [1.0.15] - 2025-11-06

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