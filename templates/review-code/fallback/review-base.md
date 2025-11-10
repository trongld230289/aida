<!-- AIDA - Fallback Review Base Template -->
<!-- PLACEHOLDER: {{REVIEW_BASE}} -->

## 🔥 MANDATORY PROJECT RULES - MUST CHECK FIRST:
<!-- ADD PROJECT-SPECIFIC RULES HERE - These will be checked alongside Angular rules -->
<!-- Additional project rules can be added here:
- **🚫 CRITICAL**: Never use `isSuccess` as variable name - reserved for business logic
-->

### 🚨 SECURITY VIOLATIONS:
- Hardcoded passwords, API keys, or sensitive credentials
- SQL injection vulnerabilities in database queries
- Command injection through system calls with user input
- Path traversal vulnerabilities in file operations
- XSS vulnerabilities through unsanitized user input
- CSRF protection missing for state-changing operations
- Insecure random number generation for security purposes
- Weak cryptographic algorithms or implementations
- Unvalidated redirects and forwards
- Sensitive data logged in plain text

### 🚨 INPUT VALIDATION VIOLATIONS:
- User input not validated before processing
- File uploads without proper validation
- Missing size limits on input data
- Unsafe deserialization of untrusted data
- Regular expressions vulnerable to ReDoS attacks
- Missing encoding/escaping of output data
- Buffer overflow vulnerabilities
- Integer overflow/underflow not handled
- Type confusion vulnerabilities
- Missing boundary checks

### 🚨 ERROR HANDLING VIOLATIONS:
- Errors silently ignored or swallowed
- Sensitive information exposed in error messages
- Stack traces exposed to end users
- Missing error recovery mechanisms
- Inconsistent error handling patterns
- Errors not properly logged for debugging
- Exception handling missing for critical operations
- Resource cleanup not performed on errors
- Error states not tested
- Cascading failures not prevented

### 🚨 RESOURCE MANAGEMENT VIOLATIONS:
- Memory leaks from unreleased resources
- File handles not properly closed
- Network connections not cleaned up
- Database connections not returned to pool
- Infinite loops or unbounded recursion
- Large objects not disposed properly
- Event listeners not removed
- Timers/intervals not cleared
- Thread pools not managed correctly
- Cache not bounded or cleared

### 🚨 CODE QUALITY & MAINTAINABILITY VIOLATIONS:
- Hardcoded strings for roles, error messages, or business values
- Magic numbers without named constants
- String comparisons without constants/enums
- Repeated string literals across files
- Missing centralized configuration for business values
- Hardcoded URLs or API endpoints
- Business logic constants scattered in components

### 🚨 PERFORMANCE VIOLATIONS:
- Inefficient algorithms with poor time complexity
- Database queries in loops (N+1 problem)
- Blocking operations on main execution thread
- Large data structures loaded entirely into memory
- Expensive operations without caching
- Redundant computations not optimized
- Missing indexes for database queries
- Uncompressed large data transfers
- Synchronous I/O operations blocking flow
- Resource-intensive operations without throttling

### 🚨 CONCURRENCY VIOLATIONS:
- Race conditions in shared data access
- Deadlocks from improper lock ordering
- Thread safety violations in shared code
- Atomic operations not used where needed
- Shared mutable state without synchronization
- Lock contention causing performance issues
- Resource starvation scenarios
- Producer-consumer imbalances
- Missing timeout handling in locks
- Concurrent modification exceptions

### 🚨 DATA INTEGRITY VIOLATIONS:
- Data validation missing at boundaries
- Inconsistent data states allowed
- Missing transaction boundaries
- Data corruption not detected
- Backup and recovery not implemented
- Data retention policies not enforced
- Audit trails missing for critical operations
- Data synchronization issues
- Referential integrity not maintained
- Data versioning conflicts not handled

### 🚨 CODE QUALITY VIOLATIONS:
- Functions exceeding reasonable complexity limits
- Code duplication without abstraction
- Magic numbers and strings without constants
- Inconsistent naming conventions
- Missing documentation for complex logic
- Dead code not removed
- Commented-out code committed
- TODO/FIXME comments for critical issues
- Tight coupling between modules
- Circular dependencies
