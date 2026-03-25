# 📋 Implementation Plan: PR Dependency Analysis Integration

## 🎯 Objective
Tích hợp phân tích PR vào Dependency Graph, cho phép:
- Gọi `@dependency <pr-url>` để lấy file changes từ PR
- Sử dụng các file trong PR làm **initial nodes** cho dependency graph
- View dependencies/dependents của các file đã thay đổi trong PR
- Reuse graph view hiện tại thay vì scan toàn bộ workspace

---

## 🏗️ Architecture Overview

```
User Input: @dependency https://github.com/owner/repo/pull/123
    ↓
1. Parse PR URL (reuse review-pr.js logic)
    ↓
2. Fetch PR File Changes (GitHub/Azure/GitLab API)
    ↓
3. Convert PR Files → Graph Nodes
    ↓
4. Scan Dependencies/Dependents for PR Files only
    ↓
5. Build Filtered Graph (PR files + their deps/dependents)
    ↓
6. Display in Graph Viewer (reuse existing graph-view.html)
```

---

## 📦 Components to Implement

### **Phase 1: PR URL Detection & File Extraction**

#### 1.1 Modify `dependency.js` - Chat Participant
**File:** `.vscode/extensions/aida/scripts/dependency.js`

**Changes:**
```javascript
// In initializeDependencyGraph() - Chat participant handler
async (request, chatContext, stream, token) => {
    const userMessage = request.prompt.trim();
    
    // ✅ NEW: Detect PR URL in message
    if (isPRUrl(userMessage)) {
        await handlePRDependencyAnalysis(userMessage, stream, token);
        return;
    }
    
    // Existing cache/analyze logic...
}
```

**New Functions:**
```javascript
/**
 * Check if message contains PR URL
 */
function isPRUrl(message) {
    const patterns = [
        /github\.com\/[^\/]+\/[^\/]+\/pull\/\d+/i,
        /dev\.azure\.com\/[^\/]+\/[^\/]+\/_git\/[^\/]+\/pullrequest\/\d+/i,
        /gitlab\.com\/.+\/-\/merge_requests\/\d+/i
    ];
    return patterns.some(pattern => pattern.test(message));
}

/**
 * Handle PR dependency analysis workflow
 */
async function handlePRDependencyAnalysis(prUrl, stream, token) {
    stream.markdown('## 🔍 PR Dependency Analysis\n\n');
    stream.markdown(`📌 **Analyzing PR:** ${prUrl}\n\n`);
    
    // Step 1: Parse PR URL
    const prInfo = parsePRUrlFromDependency(prUrl);
    
    // Step 2: Fetch PR files
    stream.markdown('⏳ Fetching PR file changes...\n\n');
    const prFiles = await fetchPRFiles(prInfo);
    
    if (!prFiles || prFiles.length === 0) {
        stream.markdown('❌ No files found in PR\n\n');
        return;
    }
    
    stream.markdown(`✅ Found **${prFiles.length} files** in PR\n\n`);
    
    // Step 3: Analyze dependencies for PR files
    stream.markdown('🔗 Analyzing dependencies...\n\n');
    const graph = await analyzePRFileDependencies(prFiles);
    
    // Step 4: Display graph
    stream.markdown('✨ **Graph ready!** Opening viewer...\n\n');
    await displayPRDependencyGraph(graph, prInfo);
}
```

---

### **Phase 2: PR File Fetching (Reuse review-pr.js)**

#### 2.1 Extract Reusable Functions from `review-pr.js`
**File:** `.vscode/extensions/aida/scripts/review-pr.js`

**Extract to new file:** `.vscode/extensions/aida/scripts/pr-file-fetcher.js`

```javascript
/**
 * Unified PR file fetcher for all providers
 */
class PRFileFetcher {
    /**
     * Fetch file changes from PR URL
     * @param {object} prInfo - Parsed PR info {repoType, prId, owner, repo, etc.}
     * @returns {Array} File change objects
     */
    async fetchFiles(prInfo) {
        switch (prInfo.repoType) {
            case 'github':
                return this.fetchGitHubFiles(prInfo);
            case 'azure':
                return this.fetchAzureFiles(prInfo);
            case 'gitlab':
                return this.fetchGitLabFiles(prInfo);
            default:
                throw new Error(`Unsupported repo type: ${prInfo.repoType}`);
        }
    }
    
    async fetchGitHubFiles(prInfo) {
        // Reuse logic from review-pr.js - fetchGitHubPR()
        // Return normalized file list
    }
    
    async fetchAzureFiles(prInfo) {
        // Reuse logic from review-pr.js - fetchAzureDevOpsPR()
        // Return normalized file list
    }
    
    async fetchGitLabFiles(prInfo) {
        // Reuse logic from review-pr.js - fetchGitLabMR()
        // Return normalized file list
    }
    
    /**
     * Normalize file change object across providers
     */
    normalizeFileChange(file, provider) {
        return {
            path: file.path || file.filename,
            status: this.normalizeStatus(file.status, provider),
            additions: file.additions || 0,
            deletions: file.deletions || 0,
            changes: file.changes || 0,
            patch: file.patch || file.diff || '',
            provider: provider
        };
    }
    
    normalizeStatus(status, provider) {
        const statusMap = {
            github: { added: 'add', removed: 'delete', modified: 'edit', renamed: 'rename' },
            azure: { add: 'add', delete: 'delete', edit: 'edit', rename: 'rename' },
            gitlab: { new: 'add', deleted: 'delete', modified: 'edit', renamed: 'rename' }
        };
        // Map to unified status: add, delete, edit, rename
        return statusMap[provider][status.toLowerCase()] || status;
    }
}

module.exports = { PRFileFetcher };
```

---

### **Phase 3: PR File → Dependency Graph Nodes**

#### 3.1 Create PR-specific Dependency Analyzer
**File:** `.vscode/extensions/aida/scripts/pr-dependency-analyzer.js`

```javascript
const { VSCodeApiDependencyAnalyzer } = require('./dependency-graph/vscode-api-analyzer');
const { SymbolAnalyzer } = require('./dependency-graph/symbol-analyzer');

class PRDependencyAnalyzer {
    constructor(workspaceRoot) {
        this.workspaceRoot = workspaceRoot;
        this.vscodeAnalyzer = new VSCodeApiDependencyAnalyzer();
        this.symbolAnalyzer = new SymbolAnalyzer();
        this.fullGraph = null; // Cache full graph for lookup
    }
    
    /**
     * Build dependency graph for PR files
     * @param {Array} prFiles - PR file changes [{path, status}]
     * @returns {object} Graph {nodes, edges}
     */
    async analyzePRFiles(prFiles) {
        // Step 1: Load or build full graph (with cache)
        this.fullGraph = await this.getFullGraph();
        
        // Step 2: Find PR file nodes in full graph
        const prNodes = this.findPRNodes(prFiles);
        
        // Step 3: Scan dependencies/dependents for each PR node
        const relevantNodeIds = new Set(prNodes.map(n => n.id));
        
        for (const node of prNodes) {
            // Get direct dependencies
            const deps = this.getDependencies(node.id);
            deps.forEach(depId => relevantNodeIds.add(depId));
            
            // Get direct dependents
            const dependents = this.getDependents(node.id);
            dependents.forEach(depId => relevantNodeIds.add(depId));
        }
        
        // Step 4: Build filtered graph
        return this.buildFilteredGraph(relevantNodeIds, prNodes);
    }
    
    /**
     * Get or build full workspace graph
     */
    async getFullGraph() {
        const cacheFile = path.join(this.workspaceRoot, '.vscode', 'dependency-cache.json');
        
        // Try load from cache
        if (fs.existsSync(cacheFile)) {
            const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
            if (cache.version === CACHE_VERSION) {
                return cache.graph;
            }
        }
        
        // Build new graph
        const graph = await this.vscodeAnalyzer.analyzeWorkspace(this.workspaceRoot);
        
        // Save cache
        fs.writeFileSync(cacheFile, JSON.stringify({
            version: CACHE_VERSION,
            timestamp: Date.now(),
            graph: graph
        }));
        
        return graph;
    }
    
    /**
     * Find nodes matching PR files
     */
    findPRNodes(prFiles) {
        const nodes = [];
        
        for (const prFile of prFiles) {
            // Normalize path
            const normalizedPath = prFile.path.replace(/\\/g, '/');
            
            // Find in full graph
            const node = this.fullGraph.nodes.find(n => 
                n.relativePath === normalizedPath ||
                n.relativePath.endsWith(normalizedPath)
            );
            
            if (node) {
                nodes.push({
                    ...node,
                    prStatus: prFile.status, // Mark as PR file
                    prChanges: {
                        additions: prFile.additions,
                        deletions: prFile.deletions
                    }
                });
            } else {
                // Handle new files not in cache
                nodes.push(this.createNodeForNewFile(prFile));
            }
        }
        
        return nodes;
    }
    
    /**
     * Create node for newly added file in PR
     */
    createNodeForNewFile(prFile) {
        return {
            id: `pr_new_${prFile.path}`,
            fileName: path.basename(prFile.path),
            relativePath: prFile.path,
            category: 'file',
            prStatus: 'add',
            prChanges: {
                additions: prFile.additions,
                deletions: 0
            },
            metadata: {
                isNewFile: true,
                angularEntities: {}
            }
        };
    }
    
    /**
     * Get dependencies of a node
     */
    getDependencies(nodeId) {
        const edges = this.fullGraph.edges.filter(e => e.source === nodeId);
        return edges.map(e => e.target);
    }
    
    /**
     * Get dependents of a node
     */
    getDependents(nodeId) {
        const edges = this.fullGraph.edges.filter(e => e.target === nodeId);
        return edges.map(e => e.source);
    }
    
    /**
     * Build filtered graph with only relevant nodes
     */
    buildFilteredGraph(relevantNodeIds, prNodes) {
        const nodes = this.fullGraph.nodes.filter(n => relevantNodeIds.has(n.id));
        
        // Merge PR node metadata
        const prNodeMap = new Map(prNodes.map(n => [n.id, n]));
        nodes.forEach(node => {
            if (prNodeMap.has(node.id)) {
                Object.assign(node, prNodeMap.get(node.id));
            }
        });
        
        const edges = this.fullGraph.edges.filter(e => 
            relevantNodeIds.has(e.source) && relevantNodeIds.has(e.target)
        );
        
        return { nodes, edges };
    }
}

module.exports = { PRDependencyAnalyzer };
```

---

### **Phase 4: Graph Visualization Enhancement**

#### 4.1 Update Graph View to Highlight PR Files
**File:** `.vscode/extensions/aida/scripts/dependency-graph/graph-view.ts`

**Changes:**
```typescript
// Add PR file highlighting
function renderNode(node: GraphNode) {
    const isPRFile = node.prStatus !== undefined;
    const prStatusClass = isPRFile ? `pr-status-${node.prStatus}` : '';
    
    const nodeColor = isPRFile 
        ? getPRStatusColor(node.prStatus)
        : getCategoryColor(node.category);
    
    // Render with special styling
    return `
        <div class="node ${prStatusClass}" style="border-color: ${nodeColor}">
            ${isPRFile ? renderPRBadge(node) : ''}
            <div class="node-name">${node.displayName}</div>
            ${isPRFile ? renderPRStats(node) : ''}
        </div>
    `;
}

function getPRStatusColor(status: string) {
    const colors = {
        add: '#28a745',     // Green
        delete: '#dc3545',  // Red
        edit: '#ffc107',    // Yellow
        rename: '#17a2b8'   // Blue
    };
    return colors[status] || '#6c757d';
}

function renderPRBadge(node: GraphNode) {
    const badges = {
        add: '➕ Added',
        delete: '❌ Deleted',
        edit: '✏️ Modified',
        rename: '↔️ Renamed'
    };
    return `<span class="pr-badge">${badges[node.prStatus]}</span>`;
}

function renderPRStats(node: GraphNode) {
    const changes = node.prChanges;
    return `
        <div class="pr-stats">
            <span class="additions">+${changes.additions}</span>
            <span class="deletions">-${changes.deletions}</span>
        </div>
    `;
}
```

**Add CSS:**
```css
/* PR file highlighting */
.node.pr-status-add {
    background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
    box-shadow: 0 0 10px rgba(40, 167, 69, 0.5);
}

.node.pr-status-delete {
    background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
    box-shadow: 0 0 10px rgba(220, 53, 69, 0.5);
}

.node.pr-status-edit {
    background: linear-gradient(135deg, #ffc107 0%, #ff9800 100%);
    box-shadow: 0 0 10px rgba(255, 193, 7, 0.5);
}

.pr-badge {
    position: absolute;
    top: -8px;
    right: -8px;
    padding: 2px 8px;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    border-radius: 12px;
    font-size: 10px;
    font-weight: bold;
}

.pr-stats {
    display: flex;
    justify-content: space-around;
    margin-top: 8px;
    font-size: 11px;
    font-weight: bold;
}

.pr-stats .additions {
    color: #28a745;
}

.pr-stats .deletions {
    color: #dc3545;
}
```

---

## 📝 Implementation Steps

### **Step 1: Setup PR File Fetcher** ✅
- [ ] Extract `parsePRUrlInfo()` from review-pr.js
- [ ] Create `pr-file-fetcher.js` with unified API
- [ ] Add token management for GitHub/Azure/GitLab
- [ ] Test with sample PRs

### **Step 2: Integrate PR Detection** ✅
- [ ] Add `isPRUrl()` to dependency.js
- [ ] Add `handlePRDependencyAnalysis()` flow
- [ ] Connect PR file fetcher
- [ ] Show progress messages

### **Step 3: Build PR Dependency Analyzer** ✅
- [ ] Create `pr-dependency-analyzer.js`
- [ ] Implement full graph caching
- [ ] Implement PR node matching
- [ ] Implement filtered graph building
- [ ] Test with sample PR files

### **Step 4: Enhance Graph View** ✅
- [ ] Add PR file metadata to node structure
- [ ] Update graph-view.ts with PR highlighting
- [ ] Add CSS for PR status badges
- [ ] Add PR stats display (+10/-5)
- [ ] Test visual rendering

### **Step 5: E2E Testing** ✅
- [ ] Test with GitHub PR
- [ ] Test with Azure DevOps PR
- [ ] Test with GitLab MR
- [ ] Test with PR containing new files
- [ ] Test with PR containing deleted files
- [ ] Test performance with large PRs (50+ files)

### **Step 6: Documentation** ✅
- [ ] Update AIDA README with `@dependency <pr-url>` usage
- [ ] Add examples for each provider
- [ ] Document token setup requirements
- [ ] Add troubleshooting guide

---

## 🔄 User Workflow Example

```
User: @dependency https://github.com/microsoft/vscode/pull/12345

AIDA:
## 🔍 PR Dependency Analysis

📌 **Analyzing PR:** https://github.com/microsoft/vscode/pull/12345

⏳ Fetching PR file changes...

✅ Found **15 files** in PR

📁 **Files Changed:**
- ➕ Added: src/new-feature.ts
- ✏️ Modified: src/existing.ts, src/utils.ts
- ❌ Deleted: src/old-code.ts

🔗 Analyzing dependencies...

✨ **Graph ready!** Opening viewer...

📊 **Impact Summary:**
- 15 PR files analyzed
- 42 dependencies found
- 28 dependents found
- Total graph: 85 nodes, 156 edges

[Open Graph View] [Export Report]
```

**Graph View:**
- PR files highlighted with colored badges (green=add, yellow=edit, red=delete)
- Dependencies shown as gray nodes
- Dependents shown as blue nodes
- Interactive: click to see file details
- Filter: Show only PR files / Show PR + deps / Show PR + dependents

---

## 🎨 Visual Mockup

```
┌─────────────────────────────────────────────────────┐
│ PR Dependency Graph: #12345                          │
│ ✏️ 12 Modified  ➕ 3 Added  ❌ 2 Deleted            │
├─────────────────────────────────────────────────────┤
│                                                      │
│    ┌──────────┐                                     │
│    │ util.ts  │ (dependency)                        │
│    └────┬─────┘                                     │
│         │                                            │
│         ↓                                            │
│    ┌──────────┐  ✏️ +20/-5                          │
│    │feature.ts│ (PR Modified)                       │
│    └────┬─────┘                                     │
│         │                                            │
│         ↓                                            │
│    ┌──────────┐                                     │
│    │ app.ts   │ (dependent)                         │
│    └──────────┘                                     │
│                                                      │
└─────────────────────────────────────────────────────┘
```

---

## 🚀 Performance Considerations

1. **Cache Reuse:** Leverage existing dependency cache if available
2. **Lazy Loading:** Only scan deps/dependents for PR files (not full workspace)
3. **Incremental Analysis:** Support analyzing additional files on demand
4. **Background Processing:** Show UI immediately, update graph progressively
5. **Memory Management:** Dispose large graphs after view closes

---

## 🔐 Security & Token Management

- Reuse existing token configuration from review-pr.js
- Support multiple org tokens for Azure DevOps
- Support GitHub PAT and OAuth tokens
- Support GitLab private tokens
- Validate token permissions before API calls

---

## 📊 Metrics to Track

- PR analysis time (should be < 5 seconds for PRs with < 50 files)
- Graph build time
- Cache hit rate
- User engagement (how often users click on nodes)
- Error rate per provider (GitHub/Azure/GitLab)

---

## 🎯 Success Criteria

✅ User can input PR URL and see dependency graph in < 10 seconds
✅ PR files clearly highlighted with status badges
✅ Graph accurately shows dependencies and dependents
✅ Works with GitHub, Azure DevOps, and GitLab
✅ Handles new/deleted files gracefully
✅ Reuses existing graph view components
✅ No duplicate scanning (uses cache when possible)

---

## 🔮 Future Enhancements (Post-MVP)

- [ ] Support comparing multiple PRs
- [ ] Show impact score (how many files affected)
- [ ] Integration with PR review workflow
- [ ] Export graph as PNG/SVG
- [ ] AI-powered impact analysis
- [ ] Suggest reviewers based on dependency graph
- [ ] Historical dependency trends

---

## 📚 Related Files

- `dependency/dependency.ts` - Main entry point
- `review/review-pr.ts` - PR fetching logic (reuse)
- `dependency/graph/vscode-api-analyzer.ts` - Dependency analysis
- `dependency/views/graph-view.html` - Graph visualization template

---

**Plan created:** December 8, 2025
**Status:** Ready for Implementation 🚀
