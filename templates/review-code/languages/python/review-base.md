<!-- AIDA - Python Review Base Template -->
<!-- PLACEHOLDER: {{REVIEW_BASE}} -->

## 🔥 MANDATORY PROJECT RULES - MUST CHECK FIRST:
<!-- ADD PROJECT-SPECIFIC RULES HERE - These will be checked alongside Angular rules -->
<!-- Additional project rules can be added here:
- **🚫 CRITICAL**: Never use `isSuccess` as variable name - reserved for business logic
-->

### 🚨 SECURITY VIOLATIONS:
- Hardcoded passwords, API keys, secrets in code
- SQL injection via string formatting
- Use of `eval()`, `exec()` with user input
- Pickle deserialization of untrusted data
- Command injection via `os.system()`, `subprocess` without shell=False
- Path traversal vulnerabilities
- Missing input validation/sanitization
- Unsafe file operations
- Use of `assert` for data validation
- Missing authentication/authorization checks
- Weak random number generation for security purposes
- Unsafe regular expressions (ReDoS)

### 🚨 RESOURCE LEAKS & MEMORY VIOLATIONS:
- Files opened without context managers (`with` statement)
- Database connections not properly closed
- Missing `try/finally` for cleanup
- Circular references in classes
- Large objects not being garbage collected
- Memory leaks from global variables
- Unclosed network connections
- Missing resource cleanup in exception handling
- Thread/process resources not properly managed
- Missing cleanup of temporary files

### 🚨 ERROR HANDLING VIOLATIONS:
- Bare `except:` clauses
- Catching `Exception` without re-raising
- Silent exception swallowing
- Missing exception logging
- Using exceptions for control flow
- Not handling specific exception types
- Missing finally blocks for cleanup
- Ignoring return codes from system calls
- Missing validation before risky operations
- Improper exception chaining

### 🚨 PYTHON SYNTAX & STYLE VIOLATIONS:
- PEP 8 violations (line length, naming, spacing)
- Missing docstrings for public methods/classes
- Inconsistent indentation (mixing tabs/spaces)
- Unused imports or variables
- Missing type hints in function signatures
- Mutable default arguments
- Use of deprecated Python features
- Non-Pythonic code patterns
- Missing `__all__` in modules
- Incorrect string formatting methods

### 🚨 PERFORMANCE VIOLATIONS:
- Inefficient loops (nested loops over large data)
- Missing list/dict comprehensions where appropriate
- Inappropriate data structure choices
- Missing generators for large datasets
- Inefficient string concatenation
- Missing caching for expensive operations
- Blocking I/O operations without async
- Memory-intensive operations on large datasets
- Unnecessary object creation in loops
- Missing optimization for frequently called functions

### 🚨 ASYNC/AWAIT VIOLATIONS:
- Missing async/await for I/O operations
- Blocking calls in async functions
- Missing error handling in async code
- Not using asyncio.gather() for concurrent operations
- Async context managers not used properly
- Missing cancellation handling
- Deadlocks in async code
- Mixing sync and async code improperly
- Missing timeout handling in async operations
- Race conditions in async code
