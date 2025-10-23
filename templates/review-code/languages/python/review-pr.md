<!-- AIDA - AI Development Assistant v1.0.0 -->
<!-- Advanced AI-powered code review and analysis -->

# Python Code Review Checklist for Pull Requests

## Instructions
Review the entire pull request and provide comprehensive feedback. Focus on:
1. Critical security and safety issues (zero tolerance)
2. Python-specific patterns and best practices
3. Code quality and maintainability
4. Performance implications

## CRITICAL VIOLATIONS (ZERO TOLERANCE)

### SECURITY VIOLATIONS
- [ ] Hardcoded credentials, API keys, or secrets
- [ ] SQL injection vulnerabilities (raw SQL queries)
- [ ] Code injection via eval(), exec(), or similar
- [ ] Path traversal vulnerabilities
- [ ] Unsafe deserialization (pickle, yaml.load)
- [ ] Missing input validation and sanitization
- [ ] Insecure random number generation for security
- [ ] Exposure of sensitive data in logs or responses
- [ ] Missing authentication/authorization checks
- [ ] Unsafe file operations without validation

### NULL SAFETY VIOLATIONS
- [ ] Accessing attributes on None objects
- [ ] Missing None checks for function returns
- [ ] Unsafe dictionary key access without checks
- [ ] Missing validation for optional parameters
- [ ] Unhandled AttributeError for None objects

### ERROR HANDLING VIOLATIONS
- [ ] Bare except clauses catching all exceptions
- [ ] Not handling specific exceptions appropriately
- [ ] Silent failures without logging
- [ ] Re-raising exceptions without context
- [ ] Missing finally blocks for cleanup

### RESOURCE LEAKS
- [ ] Files not closed properly (not using context managers)
- [ ] Database connections not closed
- [ ] Network connections left open
- [ ] Missing cleanup in exception scenarios
- [ ] Memory leaks in long-running processes

## PYTHON-SPECIFIC VIOLATIONS

### Code Style and PEP 8 Issues
- [ ] Incorrect indentation (not 4 spaces)
- [ ] Line length exceeding 79/88 characters
- [ ] Missing blank lines between functions/classes
- [ ] Incorrect naming conventions (snake_case, PascalCase)
- [ ] Missing docstrings for public functions/classes
- [ ] Incorrect import organization

### Data Structure Issues
- [ ] Using mutable default arguments
- [ ] Not using list/dict comprehensions where appropriate
- [ ] Inefficient loops that could be replaced with built-ins
- [ ] Not using sets for membership testing
- [ ] Incorrect use of global variables

### Function and Method Issues
- [ ] Functions doing too many things (violating SRP)
- [ ] Missing type hints for function parameters
- [ ] Inconsistent return types
- [ ] Not using *args/**kwargs appropriately
- [ ] Missing proper parameter validation

### Class Design Issues
- [ ] Missing __init__ method proper implementation
- [ ] Not using property decorators appropriately
- [ ] Missing __str__ and __repr__ methods
- [ ] Incorrect inheritance patterns
- [ ] Not following composition over inheritance

### Import and Module Issues
- [ ] Circular imports
- [ ] Importing entire modules unnecessarily
- [ ] Not using absolute imports
- [ ] Star imports (from module import *)
- [ ] Missing __init__.py files in packages

### Exception Handling Issues
- [ ] Catching exceptions too broadly
- [ ] Not using appropriate exception types
- [ ] Missing custom exception classes
- [ ] Swallowing exceptions without action
- [ ] Not providing helpful error messages

### Performance Issues
- [ ] Inefficient string concatenation in loops
- [ ] Not using generators for large datasets
- [ ] Unnecessary object creation in loops
- [ ] Not leveraging built-in functions (map, filter, etc.)
- [ ] Blocking operations without async handling

### Concurrency Issues
- [ ] Race conditions in threaded code
- [ ] Not using thread-safe operations
- [ ] Missing proper async/await usage
- [ ] Blocking the event loop in async code
- [ ] Not handling concurrent exceptions

### Testing Issues
- [ ] Missing unit tests for new functionality
- [ ] Tests not covering edge cases
- [ ] Missing integration tests
- [ ] Not using proper test fixtures
- [ ] Tests with unclear assertions

## QUALITY CHECKS

### Code Organization
- [ ] Proper package and module structure
- [ ] Clear separation of concerns
- [ ] Appropriate use of design patterns
- [ ] Consistent coding style

### Documentation
- [ ] Clear and helpful docstrings
- [ ] Type hints for better IDE support
- [ ] README updates if needed
- [ ] Code comments for complex logic

### Dependency Management
- [ ] Proper requirements.txt or pyproject.toml
- [ ] Version pinning for production dependencies
- [ ] Virtual environment usage
- [ ] Security vulnerability checks

## Review Template

**SECURITY ASSESSMENT:** [PASS/FAIL]
- Security issues found: [List any critical security violations]

**FUNCTIONALITY ASSESSMENT:** [PASS/FAIL]
- Code correctly implements intended functionality
- All edge cases properly handled
- Error scenarios accounted for

**PYTHONIC ASSESSMENT:** [PASS/FAIL]
- Code follows Python idioms and conventions
- Proper use of Python language features
- PEP 8 compliance

**PERFORMANCE ASSESSMENT:** [PASS/FAIL]
- No obvious performance bottlenecks
- Efficient algorithms and data structures
- Proper resource management

**OVERALL VERDICT:** [APPROVE/REQUEST_CHANGES/REJECT]

**CRITICAL ISSUES TO FIX:**
[List all zero-tolerance violations that must be addressed]

**PYTHONIC IMPROVEMENTS:**
[List suggestions for more idiomatic Python code]

**RECOMMENDATIONS:**
[List general suggestions for improvement]

**ADDITIONAL NOTES:**
[Any other relevant feedback]