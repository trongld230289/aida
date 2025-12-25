# BarrelResolver - Quick Reference

## 🚀 Quick Start

```javascript
const { BarrelResolver } = require('./dependency-graph/barrel-resolver');

// Create instance
const resolver = new BarrelResolver();

// Use it
const result = await resolver.resolveBarrelReferences(
    symbolUri, 
    symbolPosition, 
    symbolName, 
    new Set(), 
    0
);
```

## 📦 Module Location

```
.vscode/extensions/aida/scripts/dependency-graph/barrel-resolver.js
```

## 🔑 Key Methods

| Method | Purpose | Returns |
|--------|---------|---------|
| `resolveBarrelReferences()` | Resolve references qua barrel chain | `{references, barrelChain}` |
| `getBarrelExportSymbolImproved()` | Parse barrel export line | `{name, position, isWildcard}` |
| `findImportsOfBarrelFileImproved()` | Tìm files import từ barrel | `Location[]` |
| `buildImportPatterns()` | Build import regex patterns | `RegExp[]` |
| `loadTSConfigAliases()` | Load tsconfig path aliases | `Map<string, string>` |
| `isBarrelExport()` | Check if location is barrel | `boolean` |
| `clearCache()` | Clear all caches | `void` |

## 💡 Common Patterns

### 1. Resolve Barrel Chain
```javascript
const result = await resolver.resolveBarrelReferences(
    symbolUri,      // URI of file with symbol
    symbolPosition, // Position of symbol
    'MySymbol',     // Symbol name
    new Set(),      // Visited barrels (empty initially)
    0               // Level (starts at 0)
);

console.log(`Found ${result.references.length} references`);
console.log(`Barrel chain depth: ${result.barrelChain.length}`);
```

### 2. Parse Barrel Export
```javascript
const symbolInfo = await resolver.getBarrelExportSymbolImproved(
    barrelLocation,  // vscode.Location
    'OriginalName'   // Original symbol (optional)
);

if (symbolInfo.isWildcard) {
    console.log('Wildcard export');
} else {
    console.log(`Named export: ${symbolInfo.name}`);
}
```

### 3. Find Wildcard Usages
```javascript
const usages = await resolver.findImportsOfBarrelFileImproved(
    barrelUri,   // URI of barrel file
    'MySymbol',  // Symbol to find
    0            // Level (for logging)
);

console.log(`Found ${usages.length} usages`);
```

## 🎯 Supported Export Patterns

```typescript
// ✅ Wildcard
export * from './module';

// ✅ Simple named
export { MyClass } from './module';

// ✅ Aliased
export { MyClass as RenamedClass } from './module';

// ✅ Multiple exports
export { Class1, Class2, Class3 } from './module';
```

## 🔌 Integration Examples

### In PR Dependency Analyzer
```javascript
class PRDependencyAnalyzer {
    constructor(workspaceRoot) {
        this.barrelResolver = new BarrelResolver();
    }
    
    async resolveBarrelReferences(...args) {
        return await this.barrelResolver.resolveBarrelReferences(...args);
    }
}
```

### In Any New Analyzer
```javascript
const { BarrelResolver } = require('./dependency-graph/barrel-resolver');

class MyAnalyzer {
    constructor() {
        this.barrelResolver = new BarrelResolver();
    }
    
    async analyze() {
        const result = await this.barrelResolver.resolveBarrelReferences(...);
        // Use result
    }
}
```

## ⚙️ Configuration

### Timeout (default: 10s)
```javascript
// In resolveBarrelReferences(), line ~50
setTimeout(() => reject(new Error('Reference provider timeout')), 10000)
```

### Max Depth (default: 10 levels)
```javascript
// In resolveBarrelReferences(), line ~33
if (currentLevel > 10) {
    console.warn('⚠️ Barrel chain depth exceeded 10 levels');
    return { references: [], barrelChain: [] };
}
```

### Search Limit (default: 1000 files)
```javascript
// In findImportsOfBarrelFileImproved(), line ~323
const files = await vscode.workspace.findFiles(
    pattern,
    '**/node_modules/**',
    1000  // <-- Change this
);
```

## 🐛 Debugging Tips

### Enable Verbose Logging
Look for console.log statements with indentation:
```javascript
console.log(`         ${indent}📍 Level ${currentLevel}: ...`);
console.log(`         ${indent}🔄 Barrel: ${path.basename(refPath)}`);
console.log(`         ${indent}⭐ Wildcard: finding imports...`);
```

### Check Cache
```javascript
console.log('Reference cache size:', resolver.referenceCache.size);
console.log('TSConfig cache size:', resolver.tsconfigAliasCache.size);
```

### Clear Cache on Issues
```javascript
resolver.clearCache();
```

## 📚 Documentation

- **Full Docs:** [BARREL-RESOLVER.md](./dependency-graph/BARREL-RESOLVER.md)
- **Refactoring Summary:** [BARREL-RESOLVER-REFACTORING.md](./BARREL-RESOLVER-REFACTORING.md)

## ✨ Features

- ✅ Recursive barrel resolution
- ✅ Wildcard export handling
- ✅ Named export handling
- ✅ Alias support
- ✅ Multi-export parsing
- ✅ TSConfig path aliases
- ✅ Angular patterns (@shared, @app)
- ✅ Timeout protection
- ✅ Depth limiting
- ✅ Caching (references + aliases)

## ⚡ Performance

- **Timeout:** 10s per reference lookup
- **Max Depth:** 10 barrel levels
- **Caching:** Reference results + TSConfig aliases
- **File Limit:** 1000 files per workspace search

## 🚨 Common Issues

### Issue: Timeout errors
**Solution:** Increase timeout in `resolveBarrelReferences()` line ~50

### Issue: Missing references
**Solution:** Check barrel patterns in `isBarrelExport()` method

### Issue: Slow performance
**Solution:** Check cache usage, verify file search limits

### Issue: Wrong symbol resolution
**Solution:** Debug `getBarrelExportSymbolImproved()` pattern matching

## 🔗 Related

- **Source:** [barrel-resolver.js](./dependency-graph/barrel-resolver.js)
- **Used By:** [pr-dependency-analyzer.js](./pr-dependency-analyzer.js)
- **Future Use:** vscode-api-analyzer.js, symbol-analyzer.js
