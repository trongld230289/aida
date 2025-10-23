<!-- AIDA - AI Development Assistant v1.0.0 -->
<!-- Advanced AI-powered code review and analysis -->

# Node.js Framework File Review Checklist

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

## NODE.JS FRAMEWORK-SPECIFIC ANALYSIS
- [ ] Event loop performance optimization
- [ ] Stream usage patterns and best practices
- [ ] Async/await implementation
- [ ] Error handling patterns
- [ ] Security middleware implementation
- [ ] Route handling and validation
- [ ] Middleware chain efficiency
- [ ] Session and state management

## Review Template
**SECURITY ASSESSMENT:** [PASS/FAIL]
**FUNCTIONALITY ASSESSMENT:** [PASS/FAIL]
**NODE.JS FRAMEWORK COMPLIANCE:** [PASS/FAIL]
**OVERALL VERDICT:** [APPROVE/REQUEST_CHANGES/REJECT]