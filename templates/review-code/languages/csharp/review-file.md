<!-- AIDA - AI Development Assistant v1.0.0 -->
<!-- Advanced AI-powered code review and analysis -->

# C# File Review Checklist

## Instructions
Perform a comprehensive review of the C# file. Analyze the code for:
1. Critical security and safety issues (zero tolerance)
2. C# language compliance and best practices
3. Code quality and maintainability
4. Performance considerations

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

### Language and Conventions
- [ ] C# naming convention violations
- [ ] Missing XML documentation for public APIs
- [ ] Incorrect access modifier usage
- [ ] Not following coding standards
- [ ] Inconsistent code formatting

### Object-Oriented Design
- [ ] SOLID principles violations
- [ ] Improper inheritance usage
- [ ] Missing interface implementations
- [ ] Poor encapsulation practices
- [ ] Incorrect abstract class usage

### Async/Await Patterns
- [ ] Missing async/await where appropriate
- [ ] Synchronous blocking of async operations
- [ ] Missing ConfigureAwait(false) in libraries
- [ ] Async void methods (except event handlers)
- [ ] Deadlock-prone async patterns

### Collection and LINQ Operations
- [ ] Inefficient collection operations
- [ ] Multiple enumeration of IEnumerable
- [ ] Inappropriate collection types
- [ ] Missing null checks in LINQ
- [ ] Deferred execution issues

### Performance Anti-patterns
- [ ] Boxing/unboxing in hot paths
- [ ] Inefficient string concatenation
- [ ] Unnecessary object allocations
- [ ] Missing optimization opportunities
- [ ] Large object heap issues

### Memory Management
- [ ] Event handler memory leaks
- [ ] Static event registrations
- [ ] Finalizer issues
- [ ] Circular references
- [ ] Weak reference misuse

### Threading and Concurrency
- [ ] Race conditions
- [ ] Deadlock possibilities
- [ ] Thread safety violations
- [ ] Missing synchronization
- [ ] Concurrent collection misuse

## Review Template

**FILE OVERVIEW:**
- File type: [Class/Interface/Struct/Enum/etc.]
- Primary responsibility: [Brief description]
- Dependencies: [List major dependencies]

**SECURITY ASSESSMENT:** [PASS/FAIL]
- Critical security issues: [List any violations]
- Security recommendations: [Suggestions]

**C# COMPLIANCE ASSESSMENT:** [PASS/FAIL]
- Naming conventions: [Followed/Violated]
- Language feature usage: [Appropriate/Suboptimal]
- Coding standards: [Consistent/Inconsistent]

**ARCHITECTURE ASSESSMENT:** [PASS/FAIL]
- Object-oriented design: [Good/Poor]
- SOLID principles: [Followed/Violated]
- Separation of concerns: [Clear/Unclear]

**PERFORMANCE ASSESSMENT:** [PASS/FAIL]
- Algorithm efficiency: [Optimal/Suboptimal]
- Memory usage: [Efficient/Wasteful]
- Async patterns: [Correct/Incorrect]

**MAINTAINABILITY ASSESSMENT:** [PASS/FAIL]
- Code clarity: [Excellent/Good/Poor]
- Documentation: [Complete/Adequate/Missing]
- Structure: [Well-organized/Needs improvement]

**OVERALL VERDICT:** [APPROVE/REQUEST_CHANGES/REJECT]

**CRITICAL ISSUES TO FIX:**
[List all zero-tolerance violations that must be addressed immediately]

**C# BEST PRACTICES IMPROVEMENTS:**
[List suggestions for better C# implementation]

**ARCHITECTURE RECOMMENDATIONS:**
[Suggestions for improving design and structure]

**PERFORMANCE OPTIMIZATIONS:**
[Suggestions for improving performance]

**POSITIVE ASPECTS:**
[Highlight good practices and well-written code]

**ADDITIONAL NOTES:**
[Any other relevant observations or suggestions]