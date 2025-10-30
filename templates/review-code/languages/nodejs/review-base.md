<!-- AIDA - Nodejs Review Base Template -->
<!-- PLACEHOLDER: {{REVIEW_BASE}} -->

## 🔥 MANDATORY PROJECT RULES - MUST CHECK FIRST:
<!-- ADD PROJECT-SPECIFIC RULES HERE - These will be checked alongside Angular rules -->
<!-- Additional project rules can be added here:
- **🚫 CRITICAL**: Never use `isSuccess` as variable name - reserved for business logic
-->

### 🚨 SECURITY VIOLATIONS:
- Hardcoded secrets, API keys, database credentials
- SQL injection via string concatenation
- NoSQL injection vulnerabilities
- Missing input validation and sanitization
- Use of eval() with user input
- Command injection via child_process without proper escaping
- Path traversal vulnerabilities
- Missing authentication/authorization middleware
- Unsafe file operations and uploads
- Missing CORS configuration
- Exposed sensitive headers or stack traces
- Missing rate limiting for APIs

### 🚨 ASYNC/PROMISE VIOLATIONS:
- Unhandled promise rejections
- Missing async/await error handling
- Callback hell patterns
- Race conditions in async operations
- Missing Promise.all() for concurrent operations
- Blocking synchronous operations in event loop
- Memory leaks from unresolved promises
- Missing timeout handling for external calls
- Improper error propagation in async chains
- Missing cancellation for long-running operations

### 🚨 ERROR HANDLING VIOLATIONS:
- Missing error middleware in Express
- Silent error swallowing
- Generic error responses exposing internal details
- Missing error logging with proper context
- Uncaught exceptions not handled
- Missing graceful shutdown handling
- Improper error status codes
- Missing validation error handling
- Not using Error objects properly
- Missing circuit breaker patterns for external services

### 🚨 PERFORMANCE VIOLATIONS:
- Synchronous file operations blocking event loop
- Missing connection pooling for databases
- Memory leaks from event listeners not removed
- Inefficient database queries (N+1 problems)
- Missing caching for expensive operations
- Large payload processing without streaming
- Missing compression middleware
- Inefficient JSON parsing/stringifying
- Missing pagination for large datasets
- Blocking CPU-intensive operations

### 🚨 EXPRESS.JS VIOLATIONS:
- Missing helmet security middleware
- Improper route parameter validation
- Missing body parser limits
- Unsafe middleware ordering
- Missing CSRF protection
- Improper session configuration
- Missing request timeout handling
- Unsafe cookie configuration
- Missing content type validation
- Improper static file serving

### 🚨 DEPENDENCY & MODULE VIOLATIONS:
- Using deprecated npm packages
- Missing peer dependency handling
- Unsafe require() patterns
- Missing package-lock.json updates
- Security vulnerabilities in dependencies
- Missing proper module exports
- Circular dependency issues
- Missing environment variable validation
- Unsafe global variable usage
- Missing proper configuration management
