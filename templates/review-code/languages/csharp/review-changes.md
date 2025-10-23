<!-- AIDA - AI Development Assistant v1.0.0 -->
<!-- Advanced AI-powered code review and analysis -->

# C# Code Review Checklist for Git Changes

## Instructions
Review the git diff and provide feedback on the changes. Focus on:
1. Critical security and safety issues (zero tolerance)
2. C#-specific patterns and best practices
3. Code quality and maintainability
4. Performance implications

## CRITICAL VIOLATIONS (ZERO TOLERANCE)

### SECURITY VIOLATIONS
- [ ] Hardcoded credentials, API keys, or secrets
- [ ] SQL injection vulnerabilities
- [ ] XSS vulnerabilities in web applications
- [ ] Path traversal vulnerabilities
- [ ] Unsafe deserialization
- [ ] Missing input validation and sanitization
- [ ] Insecure cryptographic implementations
- [ ] Authentication bypass vulnerabilities
- [ ] Authorization failures
- [ ] Information disclosure through exceptions

### NULL SAFETY VIOLATIONS
- [ ] Null reference exceptions possible
- [ ] Missing null checks for reference types
- [ ] Unsafe nullable reference type usage
- [ ] Missing null-conditional operators (?.)
- [ ] Unhandled null returns from methods

### ERROR HANDLING VIOLATIONS
- [ ] Unhandled exceptions in critical code paths
- [ ] Generic exception catching without specific handling
- [ ] Missing using statements for IDisposable resources
- [ ] Resource disposal issues
- [ ] Silent exception swallowing

### RESOURCE LEAKS
- [ ] IDisposable objects not properly disposed
- [ ] File handles not closed properly
- [ ] Database connections not disposed
- [ ] Memory leaks in event handlers
- [ ] Unmanaged resource leaks

## C#-SPECIFIC VIOLATIONS

### Language and Style Issues
- [ ] C# naming convention violations
- [ ] Missing async/await in changed code
- [ ] Improper LINQ usage
- [ ] Not using nullable reference types
- [ ] Missing XML documentation
- [ ] Incorrect access modifiers

### Performance Issues in Changes
- [ ] Boxing/unboxing introduced
- [ ] Inefficient string operations
- [ ] Unnecessary allocations
- [ ] Blocking synchronous calls
- [ ] Missing ConfigureAwait(false)

## Review Template

**SECURITY ASSESSMENT:** [PASS/FAIL]
- Security issues found: [List any critical security violations]

**FUNCTIONALITY ASSESSMENT:** [PASS/FAIL]
- Changes correctly implement intended functionality
- All edge cases properly handled
- Error scenarios accounted for

**C# BEST PRACTICES ASSESSMENT:** [PASS/FAIL]
- Follows C# coding conventions
- Proper use of language features
- Clean implementation

**PERFORMANCE ASSESSMENT:** [PASS/FAIL]
- No performance regressions
- Efficient resource usage
- Proper patterns used

**OVERALL VERDICT:** [APPROVE/REQUEST_CHANGES/REJECT]

**CRITICAL ISSUES TO FIX:**
[List all zero-tolerance violations that must be addressed]

**RECOMMENDATIONS:**
[List suggestions for improvement]

**ADDITIONAL NOTES:**
[Any other relevant feedback]