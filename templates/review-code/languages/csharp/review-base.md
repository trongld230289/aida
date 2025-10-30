<!-- AIDA - C# Review Base Template -->
<!-- PLACEHOLDER: {{REVIEW_BASE}} -->

## 🔥 MANDATORY PROJECT RULES - MUST CHECK FIRST:
<!-- ADD PROJECT-SPECIFIC RULES HERE - These will be checked alongside Angular rules -->
<!-- Additional project rules can be added here:
- **🚫 CRITICAL**: Never use `isSuccess` as variable name - reserved for business logic
-->

### 🚨 SECURITY VIOLATIONS:
- Hardcoded passwords, API keys, connection strings, secrets
- SQL injection vulnerabilities (string concatenation in SQL)
- XSS vulnerabilities (unescaped output)
- Path traversal vulnerabilities
- Authentication/authorization bypasses
- Insecure deserialization
- Weak cryptography implementations
- No input validation/sanitization
- Missing authentication attributes
- Unsafe reflection usage
- File operations without validation
- HTTP instead of HTTPS endpoints

### 🚨 RESOURCE LEAKS & MEMORY VIOLATIONS:
- IDisposable objects without using statements
- Unmanaged resources without proper disposal
- Event handlers without unsubscription
- Missing async/await patterns causing blocking
- Memory leaks from static references
- Missing cancellation token usage
- Stream/FileStream without proper disposal
- Database connections without disposal
- HttpClient instances not properly managed
- Timer objects without disposal

### 🚨 NULL SAFETY & ERROR HANDLING VIOLATIONS:
- Nullable reference access without null checks
- Missing null-conditional operators (?.)
- Null-forgiving operator (!) without validation
- Missing try-catch blocks for risky operations
- Exception swallowing (empty catch blocks)
- Generic exceptions instead of specific ones
- Missing async exception handling
- Unhandled Task exceptions
- Missing validation for method parameters
- Dereference without null checks

### 🚨 C# ARCHITECTURE VIOLATIONS:
- Violation of SOLID principles
- Missing dependency injection patterns
- Circular dependencies
- Static classes used incorrectly
- Missing interface implementations
- Poor separation of concerns
- Large methods (>50 lines)
- Deep nesting levels (>4 levels)
- Missing async/await in I/O operations
- Synchronous calls to async methods
- Missing ConfigureAwait(false) in libraries
- Controller methods without proper HTTP verbs

### 🚨 PERFORMANCE VIOLATIONS:
- String concatenation in loops
- Missing StringBuilder usage
- Inefficient LINQ operations
- Missing async/await for I/O operations
- Boxing/unboxing of value types
- Unnecessary object allocations
- Missing caching for expensive operations
- N+1 database query problems
- Synchronous database operations
- Missing pagination for large datasets
- Inefficient collections usage

### 🚨 ASYNC/AWAIT VIOLATIONS:
- Missing async/await keywords
- Async void methods (except event handlers)
- Blocking on async code (.Result, .Wait())
- Missing ConfigureAwait(false) in libraries
- Not using CancellationToken
- Async methods without Task return type
- Deadlock-prone async patterns
- Mixed async/sync code paths
- Missing exception handling in async methods

### 🚨 .NET FRAMEWORK/CORE VIOLATIONS:
- Deprecated API usage
- Missing using statements for namespaces
- Incorrect attribute usage
- Missing XML documentation
- Non-standard naming conventions
- Missing sealed classes where appropriate
- Incorrect access modifiers
- Missing readonly keywords
- Improper generic constraints
