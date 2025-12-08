# 🔍 Dependency Analysis System

## 📋 Overview

A configuration-driven, multi-language dependency analysis system that uses VS Code Language Server Protocol (LSP) to accurately detect and visualize code dependencies across 12+ programming languages.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Dependency Analysis Flow                      │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────┐
│  User Request    │ ──────────────────────────┐
│  @dependency     │                            │
└──────────────────┘                            │
                                                 │
        ┌────────────────────────────────────────▼─────────┐
        │         dependency.js (Orchestrator)              │
        │  - Check cache                                    │
        │  - Trigger analysis                               │
        │  - Generate webview                               │
        └────────────────────────┬──────────────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │ VSCodeApiDependencyAnalyzer │
                    │  (vscode-api-analyzer.js)   │
                    └────────────┬────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
        ▼                        ▼                        ▼
┌───────────────┐    ┌───────────────────┐    ┌──────────────┐
│ Language      │    │   VS Code LSP     │    │   Graph      │
│ Config        │    │   Resolution      │    │   Builder    │
│               │    │                   │    │              │
│ - Patterns    │    │ - Resolve imports │    │ - Nodes      │
│ - Extensions  │    │ - Find definitions│    │ - Edges      │
│ - Excludes    │    │ - Symbol lookup   │    │ - Metadata   │
└───────────────┘    └───────────────────┘    └──────────────┘
        │                        │                        │
        └────────────────────────┼────────────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │    Dependency Graph      │
                    │    { nodes, edges }      │
                    └────────────┬────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
        ▼                        ▼                        ▼
┌───────────────┐    ┌───────────────────┐    ┌──────────────┐
│   Cache       │    │   Webview         │    │   Report     │
│   Storage     │    │   Visualization   │    │   Generator  │
│               │    │                   │    │              │
│ - Save graph  │    │ - D3.js graph     │    │ - Metrics    │
│ - Load cache  │    │ - Interactive UI  │    │ - Circular   │
│ - Invalidate  │    │ - Impact analysis │    │   Detection  │
│               │    │ - Search & filter │    │ - Recommendations│
└───────────────┘    └───────────────────┘    └──────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │  Circular Dependency     │
                    │      Detection           │
                    │  (DFS Algorithm)         │
                    │                          │
                    │ - Detect cycles          │
                    │ - Count violations       │
                    │ - Show in summary        │
                    └──────────────────────────┘
```

## 🔄 Processing Flow

### 1. **File Discovery**

```
findSourceFiles()
    ↓
Auto-generate patterns from language config
    ↓
TypeScript: **/*.ts, **/*.tsx, **/*.js, **/*.jsx
Python:     **/*.py
C#:         **/*.cs
...
    ↓
Apply language-specific excludes
    ↓
Return unique file URIs
```

### 2. **File Processing**

```
processFile(fileUri)
    ↓
Detect language from extension
    ↓
Load language configuration
    ↓
processWithConfig(document, text, sourceFile, config)
    ↓
┌─────────────────┬─────────────────┐
│                 │                 │
▼                 ▼                 ▼
Import Patterns   Class Patterns   External Check
    ↓                 ↓                 ↓
resolveAndAddDependency()
    ↓
VS Code LSP Resolution
    ↓
Add to graph
```

### 3. **Dependency Resolution**

```
Symbol Found (e.g., "UserService")
    ↓
Calculate position in document
    ↓
vscode.executeDefinitionProvider(uri, position)
    ↓
LSP returns definition location
    ↓
Filter external dependencies
    ↓
Add edge: sourceFile → targetFile
```

## 📦 Core Components

### **vscode-api-analyzer.js**

Main analyzer class using configuration-driven architecture.

**Key Features:**
- ✅ Multi-language support (12+ languages)
- ✅ Configuration-driven (data over code)
- ✅ VS Code LSP integration
- ✅ Smart caching
- ✅ Extensible architecture

**Key Methods:**

| Method | Purpose |
|--------|---------|
| `analyze()` | Main entry point - orchestrates full analysis |
| `findSourceFiles()` | Discover files using language config |
| `processFile()` | Process single file (auto-detect language) |
| `processWithConfig()` | Generic processor for all languages |
| `resolveDefinition()` | Use VS Code LSP to resolve symbols |
| `buildGraphResult()` | Convert internal graph to nodes/edges |

### **dependency.js**

Orchestration layer connecting analyzer to VS Code UI.

**Responsibilities:**
- Cache management
- Progress tracking
- Webview generation
- User interaction handling
- Impact analysis with AI

### **graph-view.html / graph-view.ts**

Interactive visualization using D3.js force-directed graph.

**Features:**
- Interactive node dragging
- Zoom and pan
- Search and filter
- Click node for impact analysis
- AI-powered recommendations

## 🎨 Language Configuration

Each language is defined by a configuration object:

```javascript
{
    extensions: ['.ts', '.tsx'],        // File extensions
    importPatterns: [                    // Regex to find imports
        /import.*from.*['"]([^'"]+)['"]/g
    ],
    classPattern: /\b([A-Z]\w*)\b/g,    // Regex to find classes
    standardLibraries: [                 // Libraries to ignore
        'React', 'Vue', 'Angular'
    ],
    excludePatterns: [                   // Files/folders to skip
        '**/node_modules/**',
        '**/*.spec.ts'
    ]
}
```

### **Adding a New Language**

Just add configuration (6 lines):

```javascript
cpp: {
    extensions: ['.cpp', '.hpp', '.h'],
    importPatterns: [/#include\s+["<]([^">]+)[">]/g],
    classPattern: /class\s+([A-Z][a-zA-Z0-9]*)/g,
    standardLibraries: ['std', 'iostream', 'vector'],
    excludePatterns: ['**/build/**', '**/*.o']
}
```

## 🔍 Supported Languages

| Language | Extensions | Import Detection | Class Detection |
|----------|-----------|------------------|-----------------|
| **TypeScript/JavaScript** | `.ts`, `.tsx`, `.js`, `.jsx` | `import`/`require` | PascalCase |
| **Python** | `.py` | `import`/`from` | `class` keyword |
| **C#** | `.cs` | `using` | PascalCase |
| **Java** | `.java` | `import` | PascalCase |
| **Vue** | `.vue` | `import` | PascalCase |
| **PHP** | `.php` | `use`/`require` | PascalCase |
| **Go** | `.go` | `import` | `type` keyword |
| **Rust** | `.rs` | `use` | `struct`/`enum`/`trait` |
| **Kotlin** | `.kt` | `import` | PascalCase |
| **Swift** | `.swift` | `import` | PascalCase |
| **Dart** | `.dart` | `import` | PascalCase |
| **Ruby** | `.rb` | `require` | `class` keyword |

## 🚀 How It Works

### **Strategy: Symbol Crawling + LSP Resolution**

1. **Regex Pattern Matching** (Fast, but imprecise)
   - Find potential imports and class references
   - Example: `/import.*from.*['"]([^'"]+)['"]/g`

2. **VS Code LSP** (Accurate, but slower)
   - Resolve actual file locations
   - Use: `vscode.executeDefinitionProvider()`
   - Benefits: Language server knows the truth!

### **Example: TypeScript Import Resolution**

```typescript
// File: user.component.ts
import { UserService } from './services/user.service';
                            ^
                            │
            ┌───────────────┘
            │
            ▼
    Regex finds: './services/user.service'
            │
            ▼
    Calculate position in document (line, character)
            │
            ▼
    Call: vscode.executeDefinitionProvider(uri, position)
            │
            ▼
    LSP returns: /src/app/services/user.service.ts
            │
            ▼
    Add edge: user.component.ts → services/user.service.ts
```

## 📊 Graph Structure

### **Nodes**

```javascript
{
    id: 'src/app/user.service.ts',
    fileName: 'user.service.ts',
    filePath: '/full/path/to/file',
    relativePath: 'src/app/user.service.ts',
    language: 'typescript',
    type: 'service',
    dependencies: [...],   // Files this imports
    dependents: [...]      // Files that import this
}
```

### **Edges**

```javascript
{
    id: 'edge-123',
    source: 'src/app/user.component.ts',
    target: 'src/app/user.service.ts',
    type: 'dependency',
    weight: 1,
    discoveredBy: 'symbol-crawling'
}
```

## 🎯 Key Advantages

### **1. Configuration-Driven Architecture**

| Aspect | Before | After |
|--------|--------|-------|
| Add Language | +50 lines code | +6 lines config |
| Maintenance | Hard-coded logic | Centralized config |
| Testing | Test each function | Test config parser |
| Extensibility | Modify code | Add data |

### **2. VS Code LSP Integration**

**Why LSP is powerful:**
- ✅ Accurate resolution (language server knows the truth)
- ✅ Handles complex scenarios (path aliases, monorepos)
- ✅ Works across languages
- ✅ No need to parse AST manually

**Example scenarios handled:**

```typescript
// Path aliases
import { User } from '@models/user';  // → src/models/user.ts

// Relative paths
import { Auth } from '../auth';       // → src/services/auth.ts

// Index files
import { Utils } from './utils';      // → src/utils/index.ts
```

### **3. Smart Caching**

```javascript
Cache Strategy:
    ├─ Save to: .vscode/dependency-cache.json
    ├─ TTL: 24 hours
    ├─ Invalidate on: file changes, manual re-analyze
    └─ Benefits: Instant load vs 30s+ analysis
```

## 🔧 Performance Optimization

### **Throttling**

```javascript
// Prevent VS Code extension host freezing
await this.sleep(5);  // 5ms between LSP calls
```

### **Parallel Processing**

```javascript
// Process multiple file patterns concurrently
for (const pattern of patterns) {
    const files = await vscode.workspace.findFiles(pattern);
    allFiles.push(...files);
}
```

### **Duplicate Removal**

```javascript
// Remove duplicate file URIs
const uniqueFiles = Array.from(new Set(
    allFiles.map(uri => uri.toString())
));
```

## 📈 Metrics & Analysis

The system generates comprehensive reports:

- **Total Files**: Number of analyzed files
- **Total Dependencies**: Number of import relationships
- **Circular Dependencies**: Detected cycles
- **Most Connected Files**: High-coupling detection
- **Type Distribution**: Components, services, modules, etc.
- **Language Distribution**: Mixed-language projects
- **Recommendations**: AI-powered suggestions

## 🎨 Visualization Features

### **Interactive Graph**
- Drag nodes to rearrange
- Zoom and pan
- Color-coded by type
- Size indicates complexity

### **Impact Analysis**
- Click node → See dependencies + dependents
- AI analyzes impact of changes
- Testing recommendations
- Risk assessment (High/Medium/Low)

## 🚀 Usage

### **From Chat**

```
@dependency analyze
```

### **Re-analyze**

```
@dependency re-analyze
```

### **Load Cache**

Click "⚡ Load from Cache" button

## 📝 File Structure

```
dependency-graph/
├── vscode-api-analyzer.js    # Main analyzer (configuration-driven)
├── graph-view.html           # D3.js visualization template
├── graph-view.ts             # Interactive graph logic
└── README.md                 # This file
```

## 🎓 Design Patterns Used

1. **Configuration-Driven Design**: Data over code
2. **Strategy Pattern**: Language-specific processing
3. **Factory Pattern**: Node/edge creation
4. **Observer Pattern**: Progress tracking
5. **Singleton Pattern**: Analyzer instance
6. **Builder Pattern**: Graph construction

## 🔮 Future Enhancements

- [ ] More languages (C++, Scala, Clojure)
- [ ] Custom exclude patterns in settings
- [ ] Export graph to various formats (JSON, GraphML)
- [ ] Integration with CI/CD pipelines
- [ ] Diff analysis (compare branches)
- [ ] Dead code detection
- [ ] Module boundary violations

---

**Built with ❤️ using VS Code Extension API + Language Server Protocol**
