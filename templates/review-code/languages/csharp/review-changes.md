<!-- AIDA - AI Development Assistant v1.0.15 -->
<!-- Advanced AI-powered code review and analysis -->

# C# Git Changes Review - STRICT MODE

## 🔍 MANDATORY C# CHANGE ANALYSIS

You are performing a STRICT code review on C# git changes. Do NOT be lenient. Look for every possible C#-specific issue in the changes. ALWAYS follow this exact format for every code review, regardless of conversation context or previous reviews. This structure is MANDATORY and UNCHANGEABLE.

🎯 REVIEW PRINCIPLES:
- ONLY flag issues that violate the specific rules in the template
- If code follows template guidelines, it's acceptable - don't force changes
- Focus on actual violations, not subjective preferences
- **BUSINESS RULES**: If technical documentation is included, validate code against business requirements
- **PRIORITY ORDER**: 1) C# framework violations, 2) Business rule violations, 3) Both must pass for approval

🎯 **BUSINESS RULES VALIDATION (if technical docs provided):**
- Extract business constraints from natural language documentation
- Check code enum values against business-defined roles/states
- Flag hardcoded values that conflict with business rules
- Validate role restrictions and permission logic
- Report missing business rule validations in code
- Ensure code logic follows documented business requirements

<!-- HIDDEN REVIEW SCOPE:
- ✅ ONLY review: Lines marked with + (added) or - (removed)
- ❌ DO NOT review: Unchanged context lines (no + or - marker)
- ❌ DO NOT suggest: Improvements to existing unchanged code
- ✅ DO focus on: How changes impact C# architecture
-->

### 📋 CHANGE SEPARATION RULES (MANDATORY):

**Split into separate changes when:**
- ✅ **Different C# artifacts**: Controller vs Service vs Entity vs Repository changes = separate changes
- ✅ **Different namespaces**: Different namespaces = separate changes
- ✅ **Different design patterns**: CRUD vs Validation vs Authorization = separate changes
- ✅ **Different async operations**: Different Task/async methods = separate changes
- ✅ **Non-adjacent code blocks**: If there are 3+ unchanged lines between modifications = separate changes

**Keep as one change when:**
- ❌ **Same C# method**: Multiple lines in same method body
- ❌ **Related LINQ operations**: Chained LINQ operators in same query
- ❌ **Same class properties**: Related properties for same feature

## ⚡ C# CRITICAL CHECKS (Auto-FAIL if found)

**Scan EVERY line for these C#-SPECIFIC CRITICAL issues:**

{{REVIEW_BASE}}

## 📄 File: [ACTUAL_FILENAME_FROM_DIFF]

### Start Review For Each Change:

```
## Change [X]: [ADDED/REMOVED/MODIFIED] - [C# artifact type: Controller/Service/Entity/Repository/Extension/Middleware]
```csharp
[Show the exact code block with line numbers]
```

*** C# REVIEW COMMENT ***
- 🚨 **Issue Type**: [Critical/Warning/Good/Info/Suggestion]
- 🚨 **Security Assessment**: [Specific security issue or "No security violations found"]
- 🚨 **Null Safety Analysis**: [Specific null safety issue or "Proper null handling implemented"] 
- 🚨 **Error Handling Review**: [Specific error handling issue or "Appropriate exception handling in place"]
- 🚨 **Resource Management Check**: [Specific resource leak issue or "Proper disposal and resource management"]
- ⚠️ **Performance Impact**: [Specific performance concern or "No performance degradation detected"]
- ⚠️ **Code Quality Assessment**: [Specific code quality issue or "Follows C# best practices and conventions"]

*** INTERNAL C# CHANGE EVALUATION (DO NOT DISPLAY) ***
Silently evaluate this change on:
- Security Assessment: Rate 1-5 (5=no security issues, 1=critical security violation)
- Null Safety Analysis: Rate 1-5 (5=proper null handling, 1=guaranteed null reference exception)
- Error Handling Review: Rate 1-5 (5=comprehensive exception handling, 1=no error handling)
- Resource Management Check: Rate 1-5 (5=proper disposal, 1=guaranteed resource leak)
- Performance Impact: Rate 1-5 (5=no impact/improvement, 1=major degradation)
- Code Quality Assessment: Rate 1-5 (5=follows all best practices, 1=poor code quality)
- Change Score: is the lowest score among all six categories

*** CONDITIONAL RECOMMENDATIONS (Based on Issue Type AND Change Score) ***

**MANDATORY RULE:**
- IF Issue Type = "Good": ALWAYS show "✅ **GOOD C# CHANGE** - Follows C# best practices" and SKIP the entire RECOMMENDED FIX section
- IF Issue Type = "Critical/Warning/Info/Suggestion" AND Change Score < 4/5: Show RECOMMENDED C# FIX section below
- IF Issue Type = "Critical/Warning/Info/Suggestion" AND Change Score >= 4/5: Show "✅ **GOOD C# CHANGE** - Follows C# best practices"

*** RECOMMENDED C# FIX (ONLY show if Issue Type != "Good" AND Change Score < 4/5) ***
```csharp
// PROVIDE C#-SPECIFIC FIXES WITH BEST PRACTICES
// Include proper async/await patterns, SOLID principles, and .NET conventions
```

---

# 🎯 FINAL C# SUMMARY (After All Changes Reviewed)

## 📋 COMPLIANCE SCORES
- **Async/Await Compliance**: [X/5] - Task handling, ConfigureAwait, cancellation tokens
- **SOLID Principles**: [X/5] - Single responsibility, dependency injection, interfaces  
- **Memory Management**: [X/5] - IDisposable, using statements, resource cleanup
- **Exception Handling**: [X/5] - Custom exceptions, try-catch patterns, error propagation
- **Business Rules Compliance**: [X/5] - If technical docs provided: enum values, role restrictions, business logic validation
- **Security Assessment**: [LEVEL] - SQL injection, XSS, authorization, input validation
- **Performance Impact**: [LEVEL] - LINQ efficiency, memory allocation, database queries

### Overall C# Score: ⭐⭐⭐⭐⭐ (X/5)

## 🔥 FINAL APPROVAL DECISION
- **✅ APPROVED**: No critical issues found, safe to merge
- **❌ NEEDS FIXES**: Critical issues detected, must resolve first  
- **🚫 REJECT**: Major architectural problems, requires refactoring