<!-- AIDA - GO Review Base Template -->
<!-- PLACEHOLDER: {{REVIEW_BASE}} -->

## 🔥 MANDATORY PROJECT RULES - MUST CHECK FIRST:
<!-- ADD PROJECT-SPECIFIC RULES HERE - These will be checked alongside Angular rules -->
<!-- Additional project rules can be added here:
- **🚫 CRITICAL**: Never use `isSuccess` as variable name - reserved for business logic
-->

### 🚨 SECURITY VIOLATIONS:
- Hardcoded secrets, API keys, credentials in code
- SQL injection via string concatenation
- Command injection via exec.Command without proper validation
- Path traversal vulnerabilities
- Missing input validation and sanitization
- Unsafe use of reflect package
- Missing authentication/authorization checks
- Unsafe file operations and path handling
- Use of crypto/rand vs math/rand for security
- Missing TLS configuration for HTTP clients
- Exposed sensitive data in logs or errors
- Missing rate limiting for HTTP handlers

### 🚨 CONCURRENCY VIOLATIONS:
- Race conditions in goroutines
- Missing mutex protection for shared data
- Goroutine leaks (missing cleanup/cancellation)
- Deadlocks from improper channel usage
- Missing context cancellation handling
- Improper use of sync.WaitGroup
- Channel operations without proper buffering
- Missing timeout handling for concurrent operations
- Unsafe concurrent map access
- Missing graceful shutdown for goroutines

### 🚨 ERROR HANDLING VIOLATIONS:
- Ignored error return values
- Generic error messages without context
- Missing error wrapping with fmt.Errorf
- Panic usage instead of proper error handling
- Missing validation before operations
- Silent error swallowing
- Improper error type assertions
- Missing error logging with context
- Not following Go error conventions
- Missing custom error types where appropriate

### 🚨 MEMORY & RESOURCE VIOLATIONS:
- Missing defer statements for resource cleanup
- Memory leaks from unclosed files/connections
- Missing context timeout for HTTP requests
- Large slice/map allocations without optimization
- Missing connection pooling for databases
- Inefficient string concatenation
- Missing proper buffer management
- Resource leaks from goroutines
- Missing proper slice capacity management
- Unsafe pointer operations

### 🚨 CODE QUALITY & MAINTAINABILITY VIOLATIONS:
- Hardcoded strings for roles, error messages, or business values
- Magic numbers without named constants
- String comparisons without constants/enums
- Repeated string literals across files
- Missing centralized configuration for business values
- Hardcoded URLs or API endpoints
- Business logic constants scattered in components

### 🚨 HTTP & API VIOLATIONS:
- Missing request timeout configuration
- Improper HTTP status code usage
- Missing content-type validation
- Unsafe JSON marshaling/unmarshaling
- Missing request size limits
- Improper middleware implementation
- Missing CORS handling
- Unsafe cookie handling
- Missing request context propagation
- Improper router parameter validation

### 🚨 CODE STRUCTURE VIOLATIONS:
- Non-idiomatic Go code patterns
- Missing package documentation
- Improper interface design (too large/small)
- Missing receiver naming conventions
- Improper struct field ordering
- Missing build tags where appropriate
- Circular import dependencies
- Missing proper package organization
- Improper use of init() functions
- Missing proper constant declarations
