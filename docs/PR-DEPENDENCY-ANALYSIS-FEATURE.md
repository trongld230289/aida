# 🔍 PR Dependency Analysis Feature

## Overview

Tính năng phân tích dependencies cho Pull Requests - cho phép visualize impact của PR changes thông qua dependency graph.

## 🎯 Cách sử dụng

### Basic Usage

```
@dependency https://github.com/owner/repo/pull/123
```

hoặc

```
@dependency https://dev.azure.com/org/project/_git/repo/pullrequest/456
```

hoặc

```
@dependency https://gitlab.com/namespace/project/-/merge_requests/789
```

### Workflow

1. **Input PR URL** vào chat với `@dependency`
2. **System sẽ fetch** file changes từ PR
3. **Phân tích dependencies** cho các files đã thay đổi
4. **Mở graph viewer** với highlighting cho PR files

## 🎨 Visual Features

### Node Styling

#### PR Files (Files trong PR)
- **Added (➕)**: Màu xanh lá (`#28a745`)
- **Modified (✏️)**: Màu vàng (`#ffc107`)
- **Deleted (❌)**: Màu đỏ (`#dc3545`)
- **Renamed (↔️)**: Màu xanh dương (`#17a2b8`)

#### Related Files
- **Dependency (📦)**: Màu xám - Files mà PR files import
- **Dependent (🔗)**: Màu xanh - Files import PR files
- **Both (🔄)**: Màu tím - Vừa dependency vừa dependent

### Node Details Panel

Khi click vào node, panel hiển thị:
- **PR Status Badge** (nếu là PR file)
- **Change Stats**: +additions / -deletions
- **Node Type**: Dependency/Dependent/Both
- **File Path**
- **Dependencies List** (Files mà node này import)
- **Dependents List** (Files import node này)

### Tooltip

Hover vào node để xem:
- PR Status icon + label
- Change statistics
- File name & path
- Node type trong graph

## 📊 Impact Summary

Sau khi analyze, system hiển thị:

```
✨ Analysis Complete!

📊 Impact Summary:
- PR Files: 12/15
- Dependencies: 42
- Dependents: 28
- Total Graph Nodes: 85
- Total Changes: +350/-120

🎯 Risk Level: MEDIUM

💡 Recommendations:
- Test 28 dependent file(s) for regressions
- Consider notifying affected teams
```

### Risk Levels

- **LOW**: < 10 dependents hoặc < 500 changes
- **MEDIUM**: 10-20 dependents hoặc 500-1000 changes
- **HIGH**: > 20 dependents hoặc > 1000 changes

## 🔧 Technical Implementation

### Architecture

```
User Input → PR URL Parser → File Fetcher → Dependency Analyzer → Graph Builder → Visualizer
```

### Key Components

#### 1. `pr-file-fetcher.ts`
- Parse PR URL (GitHub/Azure/GitLab)
- Fetch file changes từ API
- Normalize file structure across providers

#### 2. `pr-dependency-analyzer.ts`
- Load/build full dependency graph (với cache)
- Match PR files với graph nodes
- Scan dependencies/dependents cho PR files only
- Build filtered graph

#### 3. `dependency.ts` (Updated)
- Detect PR URL trong user message
- Orchestrate PR analysis workflow
- Display results trong chat
- Create PR-enhanced webview

#### 4. `graph-view.html` (Enhanced)
- Render PR-specific node styles
- Show PR metadata trong tooltips
- Display PR info trong detail panel
- Handle PR status colors

#### 5. `graph-view.html` (Enhanced)
- Add CSS cho PR node styling
- Add PR legend
- Support PR mode display

## 🚀 Performance

### Optimization Features

1. **Cache Reuse**: Leverage existing dependency cache
2. **Filtered Analysis**: Only scan deps/dependents cho PR files
3. **Background Processing**: Non-blocking workflow
4. **Lazy Loading**: Progressive graph building

### Performance Targets

- **< 5 seconds** cho PRs với < 50 files
- **< 10 seconds** cho PRs với < 100 files
- **Cache hit**: Instant load nếu graph đã có

## 🔐 Token Configuration

### GitHub
```json
{
  "aida.github.token": "ghp_..."
}
```

### Azure DevOps
```json
{
  "aida.azureDevOps.tokens": {
    "organization-name": "your-pat-token"
  }
}
```

### GitLab
```json
{
  "aida.gitlab.token": "glpat-..."
}
```

## 📝 Example Use Cases

### 1. Impact Analysis Before Review
```
Developer: @dependency https://github.com/company/project/pull/1234

AIDA: 
✅ Found 15 files in PR
🔗 Found 42 dependencies
📤 Found 28 dependents
🎯 Risk Level: MEDIUM
💡 Test 28 dependent files for regressions
```

### 2. Understanding PR Scope
- Visual graph shows tất cả affected files
- Easy identify core modules được touch
- See ripple effect của changes

### 3. Code Review Planning
- Prioritize review based on impact
- Identify files cần extra testing
- Suggest reviewers based on ownership

## 🎁 Benefits

### For Developers
- ✅ **Visual Impact**: See ngay impact của changes
- ✅ **Risk Assessment**: Biết được risk level
- ✅ **Test Planning**: List ra files cần test

### For Reviewers
- ✅ **Context**: Hiểu scope của PR
- ✅ **Priority**: Focus vào high-impact files
- ✅ **Coverage**: Ensure all affected areas reviewed

### For Team Leads
- ✅ **Metrics**: Quantify PR impact
- ✅ **Planning**: Estimate review effort
- ✅ **Quality**: Reduce regression risk

## 🔮 Future Enhancements

- [ ] **Multi-PR Compare**: So sánh impact của multiple PRs
- [ ] **Impact Score**: Calculate numeric impact score
- [ ] **Auto Reviewer Suggestion**: Suggest reviewers dựa trên graph
- [ ] **Historical Trends**: Track dependency changes over time
- [ ] **Export Reports**: Export graph as PNG/SVG/PDF
- [ ] **AI Impact Analysis**: Deep analysis với AI
- [ ] **Integration**: Link với PR review workflow

## 🐛 Troubleshooting

### Issue: "No token found"
**Solution**: Configure token trong settings cho provider tương ứng

### Issue: "No files found in PR"
**Solution**: 
- Check PR URL đúng format
- Verify token có quyền access repo
- Check PR status (closed/merged PRs có thể không có data)

### Issue: "No graph cache found"
**Solution**: Run `@dependency` trước để build workspace cache

### Issue: Graph không hiển thị
**Solution**:
- Check console cho errors
- Verify graph data structure
- Try refresh webview

## 📚 Related Documentation

- [Dependency Graph Feature](./ANALYSIS_METHODS.md)
- [AIDA Extension Guide](../README.md)
- [Review PR Feature](../scripts/review/review-pr.ts)

## 🤝 Contributing

Để contribute hoặc report issues:
1. Check existing implementation
2. Test với sample PRs
3. Document changes
4. Create PR với clear description

---

**Created**: December 8, 2025  
**Status**: ✅ Implemented  
**Version**: 1.0.0
