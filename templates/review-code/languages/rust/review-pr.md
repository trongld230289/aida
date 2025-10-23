<!-- AIDA - AI Development Assistant v1.0.0 -->
<!-- Advanced AI-powered code review and analysis -->

# Rust Code Review Checklist for Pull Requests

## Instructions
Review the entire pull request and provide comprehensive feedback. Focus on:
1. Critical security and safety issues (zero tolerance)
2. Rust-specific patterns and best practices
3. Code quality and maintainability
4. Performance implications

## CRITICAL VIOLATIONS (ZERO TOLERANCE)

### SECURITY VIOLATIONS
- [ ] Hardcoded credentials, API keys, or secrets
- [ ] SQL injection vulnerabilities
- [ ] Path traversal vulnerabilities
- [ ] Unsafe deserialization of untrusted data
- [ ] Missing input validation and sanitization
- [ ] Insecure cryptographic implementations
- [ ] Buffer overflow possibilities in unsafe code
- [ ] Integer overflow without proper handling
- [ ] Missing authentication/authorization checks
- [ ] Exposure of sensitive data in logs

### NULL SAFETY VIOLATIONS
- [ ] Unsafe unwrap() calls on Option/Result
- [ ] Missing proper error handling for Result types
- [ ] Panic-prone code without proper checks
- [ ] Unsafe pointer dereferences
- [ ] Missing null pointer checks in unsafe code

### ERROR HANDLING VIOLATIONS
- [ ] Unhandled Result types (missing ? or match)
- [ ] Inappropriate use of panic! in library code
- [ ] Silent failures without proper error propagation
- [ ] Missing error context and helpful messages
- [ ] Not implementing proper error types

### RESOURCE LEAKS
- [ ] Missing Drop implementations for custom types
- [ ] Unsafe resource management in unsafe blocks
- [ ] Memory leaks in unsafe code
- [ ] File handles not properly closed
- [ ] Network connections not cleaned up

## RUST-SPECIFIC VIOLATIONS

### Memory Safety Issues
- [ ] Unsafe code without proper justification
- [ ] Data races in unsafe blocks
- [ ] Use-after-free possibilities
- [ ] Double-free scenarios
- [ ] Dangling pointer usage
- [ ] Improper lifetime annotations

### Ownership and Borrowing Issues
- [ ] Unnecessary cloning for performance
- [ ] Incorrect lifetime specifications
- [ ] Fighting the borrow checker inappropriately
- [ ] Missing Cow (Clone on Write) usage
- [ ] Inefficient ownership transfers

### Pattern Matching Issues
- [ ] Non-exhaustive match statements
- [ ] Missing wildcard patterns for future compatibility
- [ ] Inappropriate use of if let vs match
- [ ] Not leveraging pattern destructuring
- [ ] Missing guard clauses in patterns

### Error Handling Patterns
- [ ] Using unwrap() instead of proper error handling
- [ ] Not implementing std::error::Error trait
- [ ] Missing error chain propagation
- [ ] Inappropriate use of expect() messages
- [ ] Not using Result<T, E> for fallible operations

### Performance Issues
- [ ] Unnecessary allocations
- [ ] String operations that could use &str
- [ ] Missing zero-copy optimizations
- [ ] Inefficient iterator usage
- [ ] Not using const generics where appropriate

### Concurrency Issues
- [ ] Data races in concurrent code
- [ ] Deadlock possibilities with multiple mutexes
- [ ] Missing Send/Sync bounds where needed
- [ ] Inappropriate use of Arc without Mutex
- [ ] Channel usage anti-patterns

### API Design Issues
- [ ] Not following Rust naming conventions
- [ ] Missing documentation comments
- [ ] Poor error type design
- [ ] Not implementing standard traits
- [ ] Inconsistent API patterns

## Review Template

**SECURITY ASSESSMENT:** [PASS/FAIL]
- Security issues found: [List any critical security violations]

**SAFETY ASSESSMENT:** [PASS/FAIL]
- Memory safety maintained: [Yes/No]
- Unsafe code properly justified: [Yes/No/N/A]
- Ownership patterns correct: [Yes/No]

**FUNCTIONALITY ASSESSMENT:** [PASS/FAIL]
- Code correctly implements intended functionality
- All edge cases properly handled
- Error scenarios accounted for

**RUST IDIOMATIC ASSESSMENT:** [PASS/FAIL]
- Follows Rust conventions and idioms
- Proper use of type system
- Efficient resource usage

**PERFORMANCE ASSESSMENT:** [PASS/FAIL]
- No obvious performance bottlenecks
- Efficient memory usage
- Proper async patterns if applicable

**OVERALL VERDICT:** [APPROVE/REQUEST_CHANGES/REJECT]

**CRITICAL ISSUES TO FIX:**
[List all zero-tolerance violations that must be addressed]

**RUST IMPROVEMENTS:**
[List suggestions for more idiomatic Rust code]

**RECOMMENDATIONS:**
[List general suggestions for improvement]

**ADDITIONAL NOTES:**
[Any other relevant feedback]