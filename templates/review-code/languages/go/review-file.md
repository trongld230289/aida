<!-- AIDA - AI Development Assistant v1.0.0 -->
<!-- Advanced AI-powered code review and analysis -->

# Go File Review Checklist

## CRITICAL VIOLATIONS (ZERO TOLERANCE)

### SECURITY VIOLATIONS
- [ ] Hardcoded credentials, API keys, or secrets
- [ ] SQL injection vulnerabilities
- [ ] Command injection vulnerabilities
- [ ] Path traversal vulnerabilities
- [ ] Missing input validation
- [ ] Insecure crypto usage
- [ ] Buffer overflow issues
- [ ] Race conditions
- [ ] Missing auth checks
- [ ] Sensitive data exposure

### NULL SAFETY VIOLATIONS
- [ ] Nil pointer dereferences
- [ ] Missing nil checks
- [ ] Unsafe type assertions
- [ ] Unhandled nil returns
- [ ] Missing slice/map validation

### ERROR HANDLING VIOLATIONS
- [ ] Ignoring error returns
- [ ] Not checking critical errors
- [ ] Silent failures
- [ ] Missing error context
- [ ] Inappropriate panic usage

### RESOURCE LEAKS
- [ ] File handles not closed
- [ ] DB connections not closed
- [ ] HTTP bodies not closed
- [ ] Goroutine leaks
- [ ] Memory leaks

## GO-SPECIFIC ANALYSIS
- [ ] Go idioms followed
- [ ] Proper error handling
- [ ] Concurrency patterns
- [ ] Performance optimization
- [ ] Interface usage

## Review Template
**SECURITY ASSESSMENT:** [PASS/FAIL]
**FUNCTIONALITY ASSESSMENT:** [PASS/FAIL]
**GO COMPLIANCE:** [PASS/FAIL]
**OVERALL VERDICT:** [APPROVE/REQUEST_CHANGES/REJECT]