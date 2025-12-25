# BarrelResolver Module

## Tổng quan

`BarrelResolver` là module xử lý barrel files (index.ts re-exports) trong TypeScript/JavaScript projects. Module này được tách ra từ `pr-dependency-analyzer.js` để có thể tái sử dụng bởi nhiều analyzers khác nhau.

## File Location

```
.vscode/extensions/aida/scripts/dependency-graph/barrel-resolver.js
```

## Chức năng chính

Module này cung cấp 4 nhóm chức năng chính:

### 1. Resolve Barrel References (Đệ quy)

**Method:** `resolveBarrelReferences(symbolUri, symbolPosition, symbolName, visitedBarrels, currentLevel)`

Resolve references qua các barrel files một cách đệ quy, xử lý cả named exports và wildcard exports.

**Features:**
- Đệ quy qua barrel chains (max depth: 10 levels)
- Phân biệt barrel exports vs real usages
- Timeout protection (10s)
- Reference caching
- Xử lý wildcard exports (`export * from`)
- Xử lý named exports (`export { Name }`)

**Example:**
```javascript
const { BarrelResolver } = require('./barrel-resolver');
const resolver = new BarrelResolver();

const result = await resolver.resolveBarrelReferences(
    symbolUri,      // vscode.Uri of file containing symbol
    symbolPosition, // vscode.Position of symbol
    'MySymbol',     // Symbol name
    new Set(),      // Visited barrels (empty initially)
    0               // Current level
);

// Result: { references: Location[], barrelChain: Array }
```

### 2. Parse Barrel Export Symbols

**Method:** `getBarrelExportSymbolImproved(barrelLocation, originalSymbolName)`

Parse barrel export lines để extract symbol name, position, và type (wildcard/named).

**Supported Patterns:**
```javascript
// Pattern 1: Wildcard
export * from './somewhere';

// Pattern 2: Simple named
export { Name } from './somewhere';

// Pattern 3: Alias
export { Name as Alias } from './somewhere';

// Pattern 4: Multiple exports
export { Name1, Name2, Name3 } from './somewhere';
```

**Example:**
```javascript
const symbolInfo = await resolver.getBarrelExportSymbolImproved(
    barrelLocation,      // vscode.Location of barrel export
    'MySymbol'           // Original symbol name (optional)
);

// Result: { name: string, position: Position, isWildcard: boolean }
```

### 3. Find Imports of Barrel File (Wildcard)

**Method:** `findImportsOfBarrelFileImproved(barrelUri, symbolName, currentLevel)`

Tìm tất cả files import từ barrel và sử dụng một symbol cụ thể. Dùng để xử lý wildcard exports.

**Features:**
- Search across workspace
- Match multiple import patterns (relative, absolute, aliases)
- TypeScript path alias support
- Angular-specific patterns (@shared, @app, etc.)
- Symbol usage detection (skip import/export lines)

**Example:**
```javascript
const imports = await resolver.findImportsOfBarrelFileImproved(
    barrelUri,   // vscode.Uri of barrel file
    'MySymbol',  // Symbol to search for
    0            // Current level (for logging)
);

// Result: Location[] of symbol usages
```

### 4. Build Import Patterns (Alias Matching)

**Method:** `buildImportPatterns(importerPath, barrelDir, barrelRelativeToWorkspace, pathAliases)`

Build regex patterns để match various import styles:
- Relative imports (`./utilities`, `../shared/utilities`)
- Absolute imports from workspace root
- TypeScript path aliases (`@shared/utilities`)
- Angular common patterns

**Example:**
```javascript
const patterns = resolver.buildImportPatterns(
    '/path/to/importer.ts',
    '/path/to/barrel/dir',
    'app/shared/utilities',
    new Map([['@shared', 'app/shared']]) // Path aliases
);

// Result: RegExp[] for matching imports
```

## Helper Methods

### loadTSConfigAliases(workspacePath)
Load TypeScript path aliases từ `tsconfig.json`. Kết quả được cache.

### isBarrelExport(location)
Check nếu một reference location là barrel export (re-export).

**Detection:**
- Export re-export syntax: `export { ... } from`
- Index file pattern: `index.ts/tsx/js/jsx`
- File content analysis (>80% export lines)

### clearCache()
Clear tất cả caches (references + tsconfig aliases).

## Sử dụng trong các Analyzers

### 1. PR Dependency Analyzer

File: `pr-dependency-analyzer.js`

```javascript
const { BarrelResolver } = require('./dependency-graph/barrel-resolver');

class PRDependencyAnalyzer {
    constructor(workspaceRoot) {
        this.barrelResolver = new BarrelResolver();
        // ...
    }

    async resolveBarrelReferences(...args) {
        return await this.barrelResolver.resolveBarrelReferences(...args);
    }
    
    // Delegate other methods...
}
```

### 2. VSCode API Analyzer

Nếu cần xử lý barrel files trong future:

```javascript
const { BarrelResolver } = require('./barrel-resolver');

class VSCodeApiDependencyAnalyzer {
    constructor() {
        this.barrelResolver = new BarrelResolver();
    }
    
    // Use barrel resolver as needed
}
```

### 3. Symbol Analyzer

Tương tự, có thể import và sử dụng khi cần.

## Architecture Benefits

### ✅ Separation of Concerns
- Logic xử lý barrel được tách riêng
- Mỗi analyzer focus vào core logic của nó
- BarrelResolver focus vào barrel handling

### ✅ Reusability
- Nhiều analyzers có thể dùng cùng một barrel resolver
- Không duplicate code
- Consistent behavior across analyzers

### ✅ Maintainability
- Update barrel logic ở một nơi
- Dễ test independently
- Clear API và documentation

### ✅ Caching Strategy
- Reference caching (prevent duplicate API calls)
- TSConfig alias caching (parse once per workspace)
- Shared cache across all usages

## Performance Considerations

- **Timeout Protection:** 10s timeout cho reference provider
- **Depth Limit:** Max 10 levels barrel chain
- **Caching:** Reference results + TSConfig aliases
- **Selective File Reading:** Only open needed files
- **Regex Optimization:** Pre-compiled patterns

## Error Handling

Module xử lý errors gracefully:
- Timeout errors → return empty results
- Parse errors → log và skip
- Cache corruption → auto-clear và retry
- File read errors → skip file

## Testing

Để test BarrelResolver independently:

```javascript
const { BarrelResolver } = require('./barrel-resolver');
const resolver = new BarrelResolver();

// Test các methods
// Mock vscode API nếu cần
```

## Migration Notes

### Từ Old Code
Code cũ trong `pr-dependency-analyzer.js` đã được:
1. Move to `barrel-resolver.js`
2. Keep same API và behavior
3. Add delegation methods trong PR analyzer để maintain compatibility

### Backward Compatibility
PR Dependency Analyzer vẫn expose các methods cũ:
- `resolveBarrelReferences()`
- `getBarrelExportSymbol()`
- `findImportsOfBarrelFile()`
- `buildImportPatterns()`
- etc.

Chúng chỉ delegate sang `BarrelResolver` internally.

## Future Enhancements

Có thể mở rộng:
- [ ] Support for CommonJS requires
- [ ] Dynamic import() statements
- [ ] Namespace imports handling
- [ ] Performance profiling
- [ ] Additional Angular patterns
- [ ] Configurable timeout/depth limits

## See Also

- [ANALYSIS_METHODS.md](./ANALYSIS_METHODS.md) - Analysis methods overview
- [pr-dependency-analyzer.js](../pr-dependency-analyzer.js) - Main usage example
- [change-impact-analyzer.js](./change-impact-analyzer.js) - Related analyzer
