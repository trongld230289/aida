# Dependency Graph Analyzer - AIDA Extension

## 🔍 Overview

The Dependency Graph Analyzer is a powerful feature of the AIDA VS Code extension that analyzes your Angular/TypeScript project's dependency structure and provides insights for improving code quality and architecture.

## 🚀 Usage

### Basic Commands

To use the dependency analyzer, open VS Code Chat and type:

```
@dependency
```

### Available Commands

#### Health Check
```
@dependency health
@dependency status
@dependency summary
```
Get an overall health assessment of your project's dependencies.

#### Circular Dependencies
```
@dependency circular
@dependency cycles
@dependency loops
```
Find and analyze circular dependencies in your codebase.

#### Analysis
```
@dependency analyze
@dependency analyze quick
@dependency analyze detailed
```
Perform comprehensive dependency analysis with different levels of detail.

#### Suggestions
```
@dependency suggest
@dependency recommend
@dependency improve
```
Get AI-powered recommendations for improving your architecture.

#### Natural Language
You can also use natural language:
- "Check my dependency health"
- "Find circular dependencies in my code"
- "Suggest architecture improvements"
- "Quick analysis summary"

## 📊 Features

### 1. Dependency Health Assessment
- Overall health score (0-100%)
- File count and dependency metrics
- Circular dependency detection
- Code complexity analysis

### 2. Architecture Analysis
- Module structure evaluation
- Layer analysis
- Coupling and cohesion metrics
- Angular-specific insights

### 3. Circular Dependency Detection
- Advanced cycle detection algorithm
- Severity assessment (critical, high, medium, low)
- Resolution strategies and suggestions
- Hotspot identification

### 4. Quality Metrics
- **Maintainability Index**: Overall code maintainability (0-100)
- **Testability Score**: How easy it is to test your code (0-100)
- **Reusability Score**: Code reusability potential (0-100)
- **Complexity Metrics**: Average and distribution of code complexity
- **Coupling Analysis**: Afferent/Efferent coupling measurements

### 5. Performance Insights
- Bundle size impact analysis
- Lazy loading opportunities
- Tree-shaking potential
- Critical path identification

### 6. AI-Powered Recommendations
- Prioritized action items
- Architecture improvement suggestions
- Quick wins identification
- Best practices compliance

## 🎯 Supported File Types

- **TypeScript** (.ts): Components, services, modules, interfaces
- **JavaScript** (.js): Legacy and utility files
- **HTML Templates** (.html): Angular component templates
- **Stylesheets** (.scss, .css): Component and global styles
- **Configuration** (.json): Project configuration files

## 📈 Understanding the Results

### Health Score Interpretation
- **90-100%**: 🟢 Excellent - Clean architecture
- **70-89%**: 🟡 Good - Minor improvements needed
- **50-69%**: 🟠 Fair - Several issues to address
- **0-49%**: 🔴 Poor - Significant refactoring required

### Circular Dependency Severity
- **Critical**: Core modules involved, immediate attention required
- **High**: Major components affected, schedule resolution soon
- **Medium**: Moderate impact, address when convenient
- **Low**: Minor cycles, low priority

### Complexity Levels
- **High** (>10): Complex modules needing breakdown
- **Medium** (5-10): Moderately complex, monitor growth
- **Low** (<5): Simple, well-structured modules

## 🛠️ Architecture Patterns Detected

The analyzer recognizes common Angular patterns:
- **Components**: UI presentation logic
- **Services**: Business logic and data management
- **Modules**: Feature organization and lazy loading
- **Directives**: DOM manipulation and reusable behaviors
- **Pipes**: Data transformation utilities
- **Interfaces**: Type contracts and abstractions

## 🔧 Integration Features

### VS Code Integration
- **Chat Interface**: Natural language queries
- **Progress Indicators**: Real-time analysis feedback
- **Quick Actions**: One-click follow-up commands
- **Error Handling**: Graceful failure with helpful messages

### Follow-up Actions
After any analysis, you'll see suggested follow-up actions:
- 📊 Check Health
- ⚠️ Find Circular Dependencies
- 💡 Get Suggestions
- 🔍 Detailed Analysis

## 📋 Examples

### Example 1: Quick Health Check
```
User: @dependency health
AIDA: 🏥 Dependency Health: 78% 🟡

### Project Overview
• Files Analyzed: 245
• Total Dependencies: 342
• Circular Issues: 2 ❌
• Average Complexity: 6.3

### Health Assessment
👍 Good structure with minor improvements needed
```

### Example 2: Circular Dependencies
```
User: @dependency circular
AIDA: ⚠️ Found 3 Circular Dependencies

**Circular dependency cycles detected:**

1. `user.service.ts` → `auth.service.ts` → `user.service.ts`
2. `header.component.ts` → `nav.component.ts` → `header.component.ts`

### 🔧 Fix Strategies:
• Extract shared functionality into separate services
• Use interfaces to define contracts
• Apply dependency injection with forwardRef()
```

### Example 3: AI Suggestions
```
User: @dependency suggest
AIDA: 💡 AI-Powered Suggestions

🔄 **Priority**: Resolve circular dependencies to improve code quality
🏗️ **Architecture**: Consider organizing into feature modules
⚡ **Complexity**: 12 modules need simplification
```

## ⚙️ Configuration

The analyzer works out of the box, but you can customize behavior by:

1. **File Exclusions**: Automatically excludes `node_modules`, `dist`, `coverage`
2. **Analysis Depth**: Supports quick vs. detailed analysis modes
3. **Output Format**: Optimized for VS Code Chat interface

## 🎬 Best Practices

1. **Regular Health Checks**: Run `@dependency health` weekly
2. **Monitor Circular Dependencies**: Check for cycles before major releases
3. **Follow Recommendations**: Implement suggested improvements gradually
4. **Track Trends**: Monitor metrics over time to measure improvement

## 🐛 Troubleshooting

### Common Issues

1. **No workspace found**: Ensure you have a folder/workspace open in VS Code
2. **Analysis fails**: Check that you're in a TypeScript/Angular project
3. **No dependencies found**: Verify project structure and file extensions

### Performance Notes

- Analysis time scales with project size
- Large projects (>500 files) may take 10-30 seconds
- Results are cached for 1 minute to improve performance

## 🆕 What's Next

Future enhancements planned:
- Visual dependency graph rendering
- Integration with git history for trend analysis
- Custom rule definitions
- Team collaboration features
- Performance benchmarking

---

## 💡 Tips & Tricks

- Use natural language for more intuitive queries
- Combine commands: "Check health then suggest improvements"
- Regular monitoring helps maintain clean architecture
- Focus on circular dependencies first - they have the biggest impact

Happy analyzing! 🎯