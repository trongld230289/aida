# Version Update Guide

## Overview
When releasing a new version of AIDA extension, you need to update version numbers across multiple files to ensure consistency.

## Required Files to Update (5 files)

### 1. `package.json`
```json
{
  "version": "X.X.X"
}
```
**Location**: Line ~4
**What to update**: Main version field

### 2. `package-lock.json`
```json
{
  "name": "aida-dev",
  "version": "X.X.X",
  ...
  "packages": {
    "": {
      "name": "aida-dev", 
      "version": "X.X.X"
    }
  }
}
```
**Location**: Line ~3 and ~8
**What to update**: Both version fields (root and packages[""])

### 3. `extension.ts`
```typescript
console.log('AIDA Extension v1.X.X activated');
```
**Location**: Around line 15-20 in activate function
**What to update**: Version in console log message

### 4. `README.md`
```markdown
## Version X.X.X
```
**Location**: Multiple locations
**What to update**: All version references in documentation

### 5. `CHANGELOG.md`
```markdown
## [X.X.X] - YYYY-MM-DD
### Added/Changed/Fixed
- Description of changes
```
**Location**: Top of file
**What to update**: Add new version entry with changes

## Update Process

### Step 1: Decide New Version
Follow semantic versioning:
- **MAJOR** (X.0.0): Breaking changes
- **MINOR** (0.X.0): New features, backwards compatible  
- **PATCH** (0.0.X): Bug fixes, backwards compatible

### Step 2: Search and Replace
Use grep to find all old version references:
```bash
grep -r "1.0.27" . --include="*.json" --include="*.ts" --include="*.md"
```

### Step 3: Update Files Systematically
1. **package.json** - Main version field
2. **package-lock.json** - Root version + packages[""] version  
3. **extension.ts** - Console log message
4. **README.md** - All version references
5. **CHANGELOG.md** - Add new version entry

### Step 4: Verify Updates
```bash
grep -r "OLD_VERSION" . --include="*.json" --include="*.ts" --include="*.md"
```
Should only return CHANGELOG.md references (historical versions)

### Step 5: Test Extension
```bash
npm run build
```
Verify webpack builds successfully and no TypeScript errors.

## Example Update Commands

Replace `1.0.27` with `1.0.28`:

```bash
# 1. Find all occurrences
grep -r "1.0.27" . --include="*.json" --include="*.ts" --include="*.md"

# 2. Update package.json
# Update line: "version": "1.0.27" → "version": "1.0.28"

# 3. Update package-lock.json (2 locations)
# Update version fields in root and packages[""]

# 4. Update extension.ts
# Update console.log message

# 5. Update README.md
# Update version references

# 6. Update CHANGELOG.md  
# Add new version entry at top
```

## Checklist
- [ ] package.json version updated
- [ ] package-lock.json version updated (2 locations)
- [ ] extension.ts console log updated
- [ ] README.md version references updated
- [ ] CHANGELOG.md new version entry added
- [ ] All files verified with grep search
- [ ] Extension tested with `npm run build`
- [ ] No syntax errors
- [ ] Webpack build successful

## Notes
- Always update CHANGELOG.md with meaningful descriptions
- Test extension after version update
- Keep version format consistent (X.X.X)
- Verify webpack builds successfully after updates
- Historical version references in CHANGELOG.md should remain unchanged
- **Do NOT update `templates/review-code/**/*.md` version** — these stay at their own version (currently v1.0.0) and are only updated when explicitly requested by the user

---
**Last Updated**: May 6, 2026  
**Current Version**: 1.1.26