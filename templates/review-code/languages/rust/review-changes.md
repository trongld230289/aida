<!-- AIDA - AI Development Assistant v1.0.0 -->
<!-- Advanced AI-powered code review and analysis -->

# Rust Code Review Checklist for Git Changes

## CRITICAL VIOLATIONS (ZERO TOLERANCE)

### SECURITY VIOLATIONS
- [ ] Hardcoded credentials, API keys, or secrets
- [ ] SQL injection vulnerabilities
- [ ] Path traversal vulnerabilities
- [ ] Unsafe deserialization
- [ ] Missing input validation
- [ ] Buffer overflow in unsafe code
- [ ] Integer overflow issues
- [ ] Missing auth checks
- [ ] Sensitive data exposure

### NULL SAFETY VIOLATIONS
- [ ] Unsafe unwrap() calls
- [ ] Missing Result handling
- [ ] Panic-prone code
- [ ] Unsafe pointer usage
- [ ] Missing null checks in unsafe

### ERROR HANDLING VIOLATIONS
- [ ] Unhandled Result types
- [ ] Inappropriate panic! usage
- [ ] Silent failures
- [ ] Missing error context
- [ ] Poor error types

### RESOURCE LEAKS
- [ ] Missing Drop implementations
- [ ] Unsafe resource management
- [ ] Memory leaks
- [ ] File handles not closed
- [ ] Connection cleanup missing

## RUST-SPECIFIC VIOLATIONS
- [ ] Unsafe code without justification
- [ ] Ownership/borrowing issues
- [ ] Non-exhaustive matches
- [ ] Performance anti-patterns
- [ ] Concurrency problems

## Review Template
**SECURITY ASSESSMENT:** [PASS/FAIL]
**SAFETY ASSESSMENT:** [PASS/FAIL]
**FUNCTIONALITY ASSESSMENT:** [PASS/FAIL]
**RUST IDIOMATIC ASSESSMENT:** [PASS/FAIL]
**OVERALL VERDICT:** [APPROVE/REQUEST_CHANGES/REJECT]