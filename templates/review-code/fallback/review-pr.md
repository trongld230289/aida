<!-- AIDA - AI Development Assistant v1.0.0 -->
<!-- Advanced AI-powered code review and analysis -->

# Generic Code Review Checklist for Pull Requests

## Instructions
Review the entire pull request and provide comprehensive feedback. Focus on:
1. Critical security and safety issues (zero tolerance)
2. General programming best practices
3. Code quality and maintainability
4. Performance implications

## CRITICAL VIOLATIONS (ZERO TOLERANCE)

### SECURITY VIOLATIONS
- [ ] Hardcoded credentials, API keys, or secrets
- [ ] Injection vulnerabilities (SQL, code, command, etc.)
- [ ] Cross-site scripting (XSS) vulnerabilities
- [ ] Path traversal vulnerabilities
- [ ] Unsafe deserialization of untrusted data
- [ ] Missing input validation and sanitization
- [ ] Insecure cryptographic implementations
- [ ] Authentication bypass vulnerabilities
- [ ] Authorization failures
- [ ] Exposure of sensitive data in logs or responses

### NULL SAFETY VIOLATIONS
- [ ] Null pointer/reference access without checks
- [ ] Missing null/undefined/nil validation
- [ ] Unsafe operations on nullable values
- [ ] Unhandled null returns from functions
- [ ] Missing parameter validation

### ERROR HANDLING VIOLATIONS
- [ ] Unhandled errors or exceptions
- [ ] Generic error catching without specific handling
- [ ] Silent failures without proper logging
- [ ] Missing error propagation or context
- [ ] Inappropriate error suppression

### RESOURCE LEAKS
- [ ] Resources not properly closed or disposed
- [ ] Memory leaks in long-running processes
- [ ] File handles not closed properly
- [ ] Database/network connections not cleaned up
- [ ] Missing cleanup in error scenarios

## GENERAL CODE QUALITY VIOLATIONS

### Logic and Flow Issues
- [ ] Infinite loops or recursion without termination
- [ ] Race conditions in concurrent code
- [ ] Deadlock possibilities
- [ ] Logic errors or incorrect algorithms
- [ ] Missing edge case handling

### Performance Issues
- [ ] Inefficient algorithms or data structures
- [ ] Unnecessary computations in loops
- [ ] Memory allocation inefficiencies
- [ ] Blocking operations without proper handling
- [ ] Missing optimization opportunities

### Code Structure Issues
- [ ] Functions or methods doing too many things
- [ ] Deep nesting levels (> 4 levels)
- [ ] Code duplication without abstraction
- [ ] Tight coupling between components
- [ ] Missing separation of concerns

### Documentation and Maintainability
- [ ] Missing documentation for public APIs
- [ ] Unclear or misleading variable/function names
- [ ] Magic numbers without explanation
- [ ] Complex logic without comments
- [ ] Inconsistent coding style

## Review Template

**SECURITY ASSESSMENT:** [PASS/FAIL]
- Security issues found: [List any critical security violations]

**FUNCTIONALITY ASSESSMENT:** [PASS/FAIL]
- Code correctly implements intended functionality
- All edge cases properly handled
- Error scenarios accounted for

**QUALITY ASSESSMENT:** [PASS/FAIL]
- Code follows general programming best practices
- Proper structure and organization
- Clean and maintainable implementation

**PERFORMANCE ASSESSMENT:** [PASS/FAIL]
- No obvious performance bottlenecks
- Efficient resource usage
- Appropriate algorithms and data structures

**OVERALL VERDICT:** [APPROVE/REQUEST_CHANGES/REJECT]

**CRITICAL ISSUES TO FIX:**
[List all zero-tolerance violations that must be addressed]

**RECOMMENDATIONS:**
[List suggestions for improvement]

**ADDITIONAL NOTES:**
[Any other relevant feedback]