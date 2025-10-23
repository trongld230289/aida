<!-- AIDA - AI Development Assistant v1.0.0 -->
<!-- Advanced AI-powered code review and analysis -->

# Node.js Code Review Checklist for Git Changes

## CRITICAL VIOLATIONS (ZERO TOLERANCE)

### SECURITY VIOLATIONS
- [ ] Hardcoded credentials, API keys, or secrets
- [ ] SQL/NoSQL injection vulnerabilities
- [ ] Command injection vulnerabilities
- [ ] Path traversal vulnerabilities
- [ ] Prototype pollution vulnerabilities
- [ ] Missing input validation
- [ ] Insecure random generation
- [ ] Sensitive data exposure
- [ ] Missing auth checks

### NULL SAFETY VIOLATIONS
- [ ] Accessing properties on null/undefined
- [ ] Missing null checks
- [ ] Unsafe optional chaining
- [ ] Unhandled null returns
- [ ] Missing parameter validation

### ERROR HANDLING VIOLATIONS
- [ ] Unhandled promise rejections
- [ ] Missing try-catch blocks
- [ ] Poor callback error handling
- [ ] Silent failures
- [ ] Missing error event handlers

### RESOURCE LEAKS
- [ ] Event listeners not removed
- [ ] File descriptors not closed
- [ ] DB connections not closed
- [ ] Memory leaks
- [ ] Stream cleanup missing

## NODE.JS-SPECIFIC VIOLATIONS
- [ ] Event loop blocking
- [ ] Missing stream usage
- [ ] Callback hell patterns
- [ ] Missing error handling
- [ ] Security issues

## Review Template
**SECURITY ASSESSMENT:** [PASS/FAIL]
**FUNCTIONALITY ASSESSMENT:** [PASS/FAIL]
**NODE.JS COMPLIANCE:** [PASS/FAIL]
**OVERALL VERDICT:** [APPROVE/REQUEST_CHANGES/REJECT]