<!-- AIDA - AI Development Assistant v1.0.0 -->
<!-- Advanced AI-powered code review and analysis -->

# Go Code Review Checklist for Pull Requests

## CRITICAL VIOLATIONS (ZERO TOLERANCE)

### SECURITY VIOLATIONS
- [ ] Hardcoded credentials, API keys, or secrets
- [ ] SQL injection vulnerabilities
- [ ] Command injection vulnerabilities
- [ ] Path traversal vulnerabilities
- [ ] Missing input validation and sanitization
- [ ] Insecure cryptographic implementations
- [ ] Buffer overflow possibilities
- [ ] Race conditions in security-critical code
- [ ] Missing authentication/authorization checks
- [ ] Exposure of sensitive data in logs

### NULL SAFETY VIOLATIONS
- [ ] Nil pointer dereferences
- [ ] Missing nil checks for pointers/interfaces
- [ ] Unsafe type assertions without checks
- [ ] Unhandled nil returns from functions
- [ ] Missing validation for slice/map operations

### ERROR HANDLING VIOLATIONS
- [ ] Ignoring error returns (using _ for errors)
- [ ] Not checking errors from critical operations
- [ ] Silent failures without proper logging
- [ ] Missing error wrapping with context
- [ ] Inappropriate panic usage in libraries

### RESOURCE LEAKS
- [ ] File handles not closed (missing defer)
- [ ] Database connections not properly closed
- [ ] HTTP response bodies not closed
- [ ] Goroutine leaks
- [ ] Memory leaks in long-running processes

## GO-SPECIFIC VIOLATIONS
- [ ] Not following Go naming conventions
- [ ] Missing proper error handling patterns
- [ ] Inappropriate use of goroutines
- [ ] Race conditions in concurrent code
- [ ] Missing context usage for cancellation
- [ ] Not using channels appropriately
- [ ] Memory allocation inefficiencies
- [ ] Missing defer statements for cleanup
- [ ] Improper interface usage
- [ ] Not leveraging Go's composition patterns

## Review Template
**SECURITY ASSESSMENT:** [PASS/FAIL]
**FUNCTIONALITY ASSESSMENT:** [PASS/FAIL]
**GO IDIOMATIC ASSESSMENT:** [PASS/FAIL]
**CONCURRENCY ASSESSMENT:** [PASS/FAIL]
**PERFORMANCE ASSESSMENT:** [PASS/FAIL]
**OVERALL VERDICT:** [APPROVE/REQUEST_CHANGES/REJECT]