<!-- AIDA - AI Development Assistant v1.0.0 -->
<!-- Advanced AI-powered code review and analysis -->

# Python Code Review Checklist for Git Changes

## Instructions
Review the git diff and provide feedback on the changes. Focus on:
1. Critical security and safety issues (zero tolerance)
2. Python-specific patterns and best practices
3. Code quality and maintainability
4. Performance implications

## CRITICAL VIOLATIONS (ZERO TOLERANCE)

### SECURITY VIOLATIONS
- [ ] Hardcoded credentials, API keys, or secrets
- [ ] SQL injection vulnerabilities (raw SQL queries)
- [ ] Code injection via eval(), exec(), or similar
- [ ] Path traversal vulnerabilities
- [ ] Unsafe deserialization (pickle, yaml.load)
- [ ] Missing input validation and sanitization
- [ ] Insecure random number generation for security
- [ ] Exposure of sensitive data in logs or responses
- [ ] Missing authentication/authorization checks
- [ ] Unsafe file operations without validation

### NULL SAFETY VIOLATIONS
- [ ] Accessing attributes on None objects
- [ ] Missing None checks for function returns
- [ ] Unsafe dictionary key access without checks
- [ ] Missing validation for optional parameters
- [ ] Unhandled AttributeError for None objects

### ERROR HANDLING VIOLATIONS
- [ ] Bare except clauses catching all exceptions
- [ ] Not handling specific exceptions appropriately
- [ ] Silent failures without logging
- [ ] Re-raising exceptions without context
- [ ] Missing finally blocks for cleanup

### RESOURCE LEAKS
- [ ] Files not closed properly (not using context managers)
- [ ] Database connections not closed
- [ ] Network connections left open
- [ ] Missing cleanup in exception scenarios
- [ ] Memory leaks in long-running processes

## PYTHON-SPECIFIC VIOLATIONS

### Code Style Issues
- [ ] PEP 8 violations in changed code
- [ ] Incorrect indentation (not 4 spaces)
- [ ] Line length exceeding 79/88 characters
- [ ] Missing blank lines between functions/classes
- [ ] Incorrect naming conventions

### Language Feature Issues
- [ ] Mutable default arguments introduced
- [ ] Not using list/dict comprehensions appropriately
- [ ] Inefficient string operations in loops
- [ ] Missing type hints for new functions
- [ ] Not using context managers for resources

### Import and Module Issues
- [ ] Circular import dependencies
- [ ] Star imports (from module import *)
- [ ] Not using absolute imports
- [ ] Importing entire modules unnecessarily

### Performance Issues
- [ ] Inefficient algorithms in changed code
- [ ] Not using generators for large datasets
- [ ] Blocking operations without async handling
- [ ] Unnecessary object creation in loops

## Review Template

**SECURITY ASSESSMENT:** [PASS/FAIL]
- Security issues found: [List any critical security violations]

**FUNCTIONALITY ASSESSMENT:** [PASS/FAIL]
- Code correctly implements intended functionality
- All edge cases properly handled
- Error scenarios accounted for

**PYTHONIC ASSESSMENT:** [PASS/FAIL]
- Code follows Python idioms and conventions
- Proper use of Python language features
- PEP 8 compliance

**PERFORMANCE ASSESSMENT:** [PASS/FAIL]
- No obvious performance bottlenecks
- Efficient algorithms and data structures
- Proper resource management

**OVERALL VERDICT:** [APPROVE/REQUEST_CHANGES/REJECT]

**CRITICAL ISSUES TO FIX:**
[List all zero-tolerance violations that must be addressed]

**PYTHONIC IMPROVEMENTS:**
[List suggestions for more idiomatic Python code]

**RECOMMENDATIONS:**
[List general suggestions for improvement]

**ADDITIONAL NOTES:**
[Any other relevant feedback]