# 🔍 Change-Impact Analysis - Usage Guide

## Overview

Change-Impact Analysis is integrated into the `@dependency` chat participant to automatically detect **"Hidden Impacts"** - files that are affected by your PR changes but NOT included in the PR files list.

## How It Works

When you analyze a PR using `@dependency <pr-url>`, the system:

1. ✅ **Step 1**: Fetches PR file changes from GitHub/Azure DevOps/GitLab
2. ✅ **Step 2**: Extracts changed symbols (functions, classes, constants, keys)
3. ✅ **Step 3**: Scans workspace for files using those symbols
4. ✅ **Step 4**: Identifies files NOT in PR but affected by changes
5. ✅ **Step 5**: Shows warnings and recommendations

## Usage

### Analyze PR with Change-Impact Detection

```
@dependency https://dev.azure.com/org/project/_git/repo/pullrequest/123
```

Or GitHub PR:
```
@dependency https://github.com/owner/repo/pull/456
```

The system will automatically:
- Analyze PR dependencies
- **Run Change-Impact Analysis**
- Show hidden impacts if found

### Example Output

```markdown
✨ Analysis Complete!

📊 Impact Summary:
- PR Files: 10/10
- Dependencies: 15
- Dependents: 8
- Total Graph Nodes: 33
- Total Changes: +45/-12

🔍 Running Change-Impact Analysis...

⚠️ ALERT: Found 1 Hidden Impact(s)!

These files are affected by your changes but NOT included in the PR:

📄 `src/app/components/maintain-equipment-paging.component.ts`
   → Impacted by: limitedEquipment, removeEquipmentFromTab

💡 Recommendation: Review these files and consider:
- Adding them to your PR if they need updates
- Running tests on these files
- Checking for regression issues
```

## What Gets Detected

### Changed Symbols Extracted:

1. **Exports**
   - Functions
   - Classes
   - Interfaces
   - Constants

2. **Resource Keys** (message-resources.ts)
   - New keys added
   - Modified keys

3. **Constants** (constants.ts, constants-api.ts)
   - New values
   - Modified values

4. **Type Definitions**
   - Interfaces
   - Enums

### Files Scanned:

- `.ts` - TypeScript files
- `.js` - JavaScript files  
- `.html` - Angular templates
- `.vue` - Vue components
- `.tsx`, `.jsx` - React components

## Real-World Scenario

### Your PR Contains:
```typescript
// message-resources.ts
export const MessageResources = {
  limitedEquipment: "Equipment limit reached",      // ← NEW
  removeEquipmentFromTab: "Remove from tab"         // ← NEW
}
```

### Hidden Impact Detected:
```typescript
// maintain-equipment-paging.component.ts (NOT in PR)
import { MessageResources } from './message-resources';

ngOnInit() {
  // Using the new key
  this.message = MessageResources.limitedEquipment;  // ← IMPACT
}
```

**Result**: System alerts you that `maintain-equipment-paging.component.ts` should be reviewed!

## Benefits

✅ **Prevent Regressions**: Catch files that should be tested
✅ **Complete PRs**: Don't miss related changes
✅ **Better Code Review**: Reviewers see full impact
✅ **Safer Deployments**: Reduce production bugs

## Technical Details

- **No AI Tokens Used**: Uses VS Code Language Server APIs
- **Fast**: Leverages existing dependency cache
- **Accurate**: Symbol-level analysis, not just file dependencies
- **Smart**: Understands exports, imports, and resource keys

## Limitations

- Requires workspace dependency cache (run `@dependency` first)
- Only detects **direct symbol usage** (not runtime/dynamic)
- Skips `node_modules`, `dist`, `coverage` folders

## Tips

1. **First Time**: Run `@dependency` once to build cache
2. **Large PRs**: May take 10-30 seconds
3. **False Positives**: Review each warning carefully
4. **Update PR**: Add hidden impact files if needed

## Architecture

```
@dependency <pr-url>
    ↓
[PR File Fetcher] → Get PR files
    ↓
[Symbol Extractor] → Find changed symbols
    ↓
[Workspace Scanner] → Search for symbol usage
    ↓
[Impact Detector] → Compare with PR files
    ↓
[Hidden Impact Alert] → Show warnings
```

## Related Commands

- `@dependency` - Build workspace dependency cache
- `@dependency <file-path>` - Analyze specific file
- `@dependency re-analyze` - Rebuild cache

## Support

For issues or questions:
- Check VS Code Output → AIDA
- Review console logs
- Report bugs in extension issues

---

**Last Updated**: December 2025  
**Feature**: Change-Impact Analysis v1.0
