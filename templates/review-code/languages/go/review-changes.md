<!-- AIDA - AI Development Assistant v1.0.0 -->
<!-- Advanced AI-powered code review and analysis -->

# Go Code Review Checklist for Git Changes

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

## GO-SPECIFIC VIOLATIONS
- [ ] Go naming violations
- [ ] Poor error handling
- [ ] Goroutine misuse
- [ ] Race conditions
- [ ] Missing context usage

## Review Template
**SECURITY ASSESSMENT:** [PASS/FAIL]
**FUNCTIONALITY ASSESSMENT:** [PASS/FAIL]
**GO COMPLIANCE:** [PASS/FAIL]
**OVERALL VERDICT:** [APPROVE/REQUEST_CHANGES/REJECT]