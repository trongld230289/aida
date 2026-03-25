# Base Commit Logic Documentation

## 🎯 Overview

This document explains the **Base Commit Logic** used in AIDA Azure DevOps PR review functionality to ensure accurate diff calculation that matches Azure DevOps UI behavior.

## 🚫 The Problem (Before Fix)

### Incorrect Logic:
```javascript
// WRONG: Comparing HEAD of target branch vs PR commit
baseCommit = HEAD of main branch (latest commit)
sourceCommit = PR's last commit

// Result: Shows ALL differences between current main and PR
// Example: +495/-532 lines for a simple 1-line change
```

### Why This Was Wrong:
- Compares against **current state** of main branch
- Shows accumulated changes from **multiple commits** 
- Doesn't match Azure DevOps UI behavior
- Creates **massive diff counts** for simple changes

## ✅ The Solution (After Fix)

### Correct Logic:
```javascript
// CORRECT: Using merge base (branch point)
baseCommit = Merge base (common ancestor)
sourceCommit = PR's last commit

// Result: Shows ONLY changes made in feature branch
// Example: +1/-1 lines for actual 1-line change
```

## 🌳 Git Tree Visualization

```
main branch:        A---B---C---D---E (HEAD of main)
                         \
feature branch:           F---G---H (PR commit)
                         ↑
                    merge base (C)
```

### Commit Roles:
- **A, B, C**: Common history
- **C**: **Merge Base** (branch point where feature diverged)
- **D, E**: New commits in main after branch point
- **F, G, H**: Feature branch commits
- **H**: Source commit (PR's last commit)

## 🔍 Comparison Logic

### ❌ Old Logic (Wrong):
```
Compare: E (main HEAD) vs H (PR commit)
Shows: Changes in D,E + Changes in F,G,H = HUGE DIFF
```

### ✅ New Logic (Correct):
```
Compare: C (merge base) vs H (PR commit)  
Shows: Only changes in F,G,H = ACTUAL PR CHANGES
```

## 🛠 Implementation Details

### Azure DevOps API Call:
```javascript
const mergeBaseUrl = `https://dev.azure.com/${org}/${project}/_apis/git/repositories/${repo}/commits/${sourceCommit}/mergebases?otherCommitId=${targetCommit}&api-version=7.0`;
```

### Code Flow:
1. **Get PR commits**: `sourceCommit` and `targetCommit`
2. **Find merge base**: Common ancestor using Azure DevOps API
3. **Compare files**: `mergeBase` vs `sourceCommit`
4. **Count changes**: Only lines changed in feature branch

### Error Handling:
```javascript
try {
    // Try to find merge base
    mergeBaseCommit = response.data.value[0].commitId;
} catch (error) {
    // Fallback to target commit if API fails
    mergeBaseCommit = targetCommit;
}
```

## 📊 Before vs After Examples

### Example: PR 1461 (Simple change: "ACCOUNT" → "SHIPPER")

| Method | Base Commit | Result | Explanation |
|--------|-------------|---------|-------------|
| **Before** | HEAD of main | +495/-532 | Wrong: Shows all accumulated changes |
| **After** | Merge base | +1/-1 | Correct: Shows only actual PR change |

## 🔧 Code Locations

### Main Function:
- **File**: `review/pr-review-handler.ts`
- **Function**: `getAzureDevOpsPR()`
- **Lines**: ~850-950

### Key Variables:
```javascript
let mergeBaseCommit = null;           // Store merge base
const sourceCommit = pr.lastMergeSourceCommit?.commitId;   // PR commit
const targetCommit = pr.lastMergeTargetCommit?.commitId;   // Main HEAD
```

### Cache Update:
```javascript
// Store merge base for Monaco diff view
global.prDiffCache.targetCommit = data.targetCommit; // Now points to merge base
global.prDiffCache.mergeBaseCommit = data.mergeBaseCommit;
```

## 🎯 Benefits

1. **Accurate Counts**: Matches Azure DevOps UI exactly
2. **Consistent View**: Both summary and Monaco diff use same logic
3. **Performance**: Smaller diffs = faster processing
4. **User Experience**: Shows relevant changes only

## 🔍 Debugging

### Debug Logs:
```javascript
console.log(`🎯 Source commit (PR): ${sourceCommit.substring(0, 7)}`);
console.log(`🎯 Target commit (main): ${targetCommit.substring(0, 7)}`);
console.log(`✅ Found merge base: ${baseCommit.substring(0, 7)}`);
console.log(`📊 This shows ONLY changes made in feature branch`);
```

### Validation:
- Check console logs for merge base detection
- Compare counts with Azure DevOps UI
- Verify Monaco diff view shows same changes

## 💡 Technical Notes

### Why Merge Base Works:
- **Git Concept**: Common ancestor before branches diverged
- **Azure DevOps Behavior**: Built-in diff calculation uses merge base
- **Consistency**: Ensures extension matches official UI

### API Dependencies:
- **Azure DevOps REST API**: For merge base calculation
- **File Content API**: For retrieving file versions
- **Monaco Editor**: For visual diff display

---

## 📝 Changelog

| Date | Change | Author |
|------|--------|---------|
| 2025-11-05 | Initial implementation of merge base logic | AIDA Extension |
| 2025-11-05 | Fixed Monaco diff view cache | AIDA Extension |

---

*This documentation helps maintain understanding of the base commit logic for future development and debugging.*