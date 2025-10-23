<!-- AIDA - AI Development Assistant v1.0.0 -->
<!-- Advanced AI-powered code review and analysis -->

# Node.js Code Review Checklist for Pull Requests

## CRITICAL VIOLATIONS (ZERO TOLERANCE)

### SECURITY VIOLATIONS
- [ ] Hardcoded credentials, API keys, or secrets
- [ ] SQL injection vulnerabilities
- [ ] NoSQL injection vulnerabilities
- [ ] Command injection vulnerabilities
- [ ] Path traversal vulnerabilities
- [ ] Prototype pollution vulnerabilities
- [ ] Missing input validation and sanitization
- [ ] Insecure random number generation
- [ ] Exposure of sensitive data in logs/responses
- [ ] Missing authentication/authorization checks

### NULL SAFETY VIOLATIONS
- [ ] Accessing properties on null/undefined objects
- [ ] Missing null/undefined checks
- [ ] Unsafe optional chaining usage
- [ ] Unhandled null returns from functions
- [ ] Missing parameter validation

### ERROR HANDLING VIOLATIONS
- [ ] Unhandled promise rejections
- [ ] Missing try-catch blocks for async operations
- [ ] Not handling callback errors properly
- [ ] Silent failures without logging
- [ ] Missing error event handlers for streams

### RESOURCE LEAKS
- [ ] Event listeners not removed
- [ ] File descriptors not closed
- [ ] Database connections not properly closed
- [ ] Memory leaks in event emitters
- [ ] Stream resources not cleaned up

## NODE.JS-SPECIFIC VIOLATIONS
- [ ] Blocking the event loop with synchronous operations
- [ ] Not using streams for large data processing
- [ ] Callback hell instead of promises/async-await
- [ ] Missing process.on('uncaughtException') handling
- [ ] Not using cluster for CPU-intensive tasks
- [ ] Improper middleware error handling in Express
- [ ] Missing environment variable validation
- [ ] Security headers not implemented
- [ ] Not using HTTPS in production
- [ ] Missing rate limiting implementation

## Review Template
**SECURITY ASSESSMENT:** [PASS/FAIL]
**FUNCTIONALITY ASSESSMENT:** [PASS/FAIL]
**NODE.JS BEST PRACTICES:** [PASS/FAIL]
**PERFORMANCE ASSESSMENT:** [PASS/FAIL]
**OVERALL VERDICT:** [APPROVE/REQUEST_CHANGES/REJECT]