<!-- AIDA - AI Development Assistant v1.0.0 -->
<!-- Advanced AI-powered code review and analysis -->

# Quick PR Review - STRICT MODE

## 🔍 MANDATORY CODE ANALYSIS

You are performing a STRICT code review. Do NOT be lenient. Look for every possible issue. ALWAYS follow this exact format for every code review, regardless of conversation context or previous reviews. This structure is MANDATORY and UNCHANGEABLE.

### 📋 CHANGE SEPARATION RULES (MANDATORY):

**Split into separate changes when:**
- ✅ **Different Vue artifacts**: Component vs Composable vs Store vs Route changes = separate changes
- ✅ **Different components**: Different .vue files = separate changes
- ✅ **Different composables**: Different composable functions = separate changes
- ✅ **Different stores**: Different Pinia/Vuex modules = separate changes
- ✅ **Non-adjacent code blocks**: If there are 3+ unchanged lines between modifications = separate changes

**Keep as one change when:**
- ❌ **Same component**: Multiple sections in same .vue file (template, script, style)
- ❌ **Related composable**: Multiple functions in same composable file
- ❌ **Same store module**: Multiple actions/mutations in same store

## ⚡ CRITICAL CHECKS (Auto-FAIL if found)

**Scan EVERY line for these CRITICAL issues:**

{{REVIEW_BASE}}

# 🔍 DETAILED FILE ANALYSIS - STRICT VERIFICATION MODE
**ANALYZE EACH FILE INDIVIDUALLY - BE HARSH:**
## 📄 File: [ACTUAL_FILENAME_FROM_DIFF]

### 🚨 Critical Issue [X]: [Description]
**Violation**: [Specific issue description]

```typescript
[actual code line from diff]
```

- **Risk**: [Performance impact]
- **Fix**: [Optimization suggestion]

#### STRICT EVALUATION:
- **🚨 Security**: [FOUND_ISSUES or "CLEAN"]
- **🚨 Null Safety**: [FOUND_ISSUES or "CLEAN"] 
- **🚨 Error Handling**: [FOUND_ISSUES or "CLEAN"]
- **🚨 Resource Management**: [FOUND_ISSUES or "CLEAN"]
- **⚠️ Performance**: [FOUND_ISSUES or "CLEAN"]
- **⚠️ Code Quality**: [FOUND_ISSUES or "CLEAN"]

---

# 🎯 FINAL ANGULAR SUMMARY (After All Changes Reviewed)

## 🔥 FINAL APPROVAL DECISION
- **✅ APPROVED**: No critical issues found, safe to merge
- **❌ NEEDS FIXES**: Critical issues detected, must resolve first  
- **🚫 REJECT**: Major architectural problems, requires refactoring