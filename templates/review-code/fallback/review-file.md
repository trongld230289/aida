<!-- AIDA - AI Development Assistant v1.0.0 -->
<!-- Advanced AI-powered code review and analysis -->

# Generic File Review Checklist

## CRITICAL VIOLATIONS (ZERO TOLERANCE)

### SECURITY VIOLATIONS
- [ ] Hardcoded credentials, API keys, or secrets
- [ ] Injection vulnerabilities (SQL, code, command, etc.)
- [ ] Cross-site scripting (XSS) vulnerabilities
- [ ] Path traversal vulnerabilities
- [ ] Unsafe deserialization
- [ ] Missing input validation
- [ ] Insecure crypto implementations
- [ ] Authentication bypass
- [ ] Authorization failures
- [ ] Sensitive data exposure

### NULL SAFETY VIOLATIONS
- [ ] Null pointer/reference access
- [ ] Missing null validation
- [ ] Unsafe operations on nullable values
- [ ] Unhandled null returns
- [ ] Missing parameter validation

### ERROR HANDLING VIOLATIONS
- [ ] Unhandled errors or exceptions
- [ ] Generic error catching
- [ ] Silent failures
- [ ] Missing error context
- [ ] Inappropriate error suppression

### RESOURCE LEAKS
- [ ] Resources not properly closed
- [ ] Memory leaks
- [ ] File handles not closed
- [ ] Connection cleanup missing
- [ ] Missing cleanup in errors

## GENERAL ANALYSIS
- [ ] Code follows best practices
- [ ] Proper error handling
- [ ] Performance considerations
- [ ] Security implementation
- [ ] Documentation and maintainability

## Review Template
**SECURITY ASSESSMENT:** [PASS/FAIL]
**FUNCTIONALITY ASSESSMENT:** [PASS/FAIL]
**QUALITY ASSESSMENT:** [PASS/FAIL]
**OVERALL VERDICT:** [APPROVE/REQUEST_CHANGES/REJECT]