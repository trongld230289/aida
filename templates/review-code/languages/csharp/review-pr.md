<!-- AIDA - AI Development Assistant v1.0.0 -->
<!-- Advanced AI-powered code review and analysis -->

# C# Code Review Checklist for Pull Requests

## Instructions
Review the entire pull request and provide comprehensive feedback. Focus on:
1. Critical security and safety issues (zero tolerance)
2. C#-specific patterns and best practices
3. Code quality and maintainability
4. Performance implications

## CRITICAL VIOLATIONS (ZERO TOLERANCE)

### SECURITY VIOLATIONS
- [ ] Hardcoded credentials, API keys, or secrets
- [ ] SQL injection vulnerabilities
- [ ] XSS vulnerabilities in web applications
- [ ] Path traversal vulnerabilities
- [ ] Unsafe deserialization
- [ ] Missing input validation and sanitization
- [ ] Insecure cryptographic implementations
- [ ] Authentication bypass vulnerabilities
- [ ] Authorization failures
- [ ] Information disclosure through exceptions

### NULL SAFETY VIOLATIONS
- [ ] Null reference exceptions possible
- [ ] Missing null checks for reference types
- [ ] Unsafe nullable reference type usage
- [ ] Missing null-conditional operators (?.)
- [ ] Unhandled null returns from methods

### ERROR HANDLING VIOLATIONS
- [ ] Unhandled exceptions in critical code paths
- [ ] Generic exception catching without specific handling
- [ ] Missing using statements for IDisposable resources
- [ ] Resource disposal issues
- [ ] Silent exception swallowing

### RESOURCE LEAKS
- [ ] IDisposable objects not properly disposed
- [ ] File handles not closed properly
- [ ] Database connections not disposed
- [ ] Memory leaks in event handlers
- [ ] Unmanaged resource leaks

## C#-SPECIFIC VIOLATIONS

### Language Feature Issues
- [ ] Not following C# naming conventions
- [ ] Missing async/await patterns where appropriate
- [ ] Improper LINQ usage or performance issues
- [ ] Not using nullable reference types appropriately
- [ ] Missing XML documentation for public APIs
- [ ] Incorrect access modifier usage

### Object-Oriented Design Issues
- [ ] Violating SOLID principles
- [ ] Improper inheritance usage
- [ ] Missing interface implementations
- [ ] Incorrect use of abstract classes
- [ ] Poor encapsulation practices

### Performance Issues
- [ ] Boxing/unboxing in performance-critical code
- [ ] Inefficient string concatenation
- [ ] Unnecessary object allocations
- [ ] Synchronous operations where async would be better
- [ ] Missing ConfigureAwait(false) in libraries

### Memory Management Issues
- [ ] Event handler memory leaks
- [ ] Static event handler registrations
- [ ] Large object heap issues
- [ ] Finalizer implementation problems
- [ ] Circular reference issues

### Collection and LINQ Issues
- [ ] Inefficient collection operations
- [ ] Multiple enumeration of IEnumerable
- [ ] Not using appropriate collection types
- [ ] Missing null checks in LINQ operations
- [ ] Deferred execution issues

### Threading and Concurrency Issues
- [ ] Race conditions
- [ ] Deadlock possibilities
- [ ] Thread safety violations
- [ ] Improper async/await usage
- [ ] Missing synchronization primitives

## Review Template

**SECURITY ASSESSMENT:** [PASS/FAIL]
- Security issues found: [List any critical security violations]

**FUNCTIONALITY ASSESSMENT:** [PASS/FAIL]
- Code correctly implements intended functionality
- All edge cases properly handled
- Error scenarios accounted for

**C# BEST PRACTICES ASSESSMENT:** [PASS/FAIL]
- Follows C# coding conventions
- Proper use of language features
- Clean object-oriented design

**PERFORMANCE ASSESSMENT:** [PASS/FAIL]
- No obvious performance bottlenecks
- Efficient resource usage
- Proper async patterns

**OVERALL VERDICT:** [APPROVE/REQUEST_CHANGES/REJECT]

**CRITICAL ISSUES TO FIX:**
[List all zero-tolerance violations that must be addressed]

**C# IMPROVEMENTS:**
[List suggestions for better C# practices]

**RECOMMENDATIONS:**
[List general suggestions for improvement]

**ADDITIONAL NOTES:**
[Any other relevant feedback]