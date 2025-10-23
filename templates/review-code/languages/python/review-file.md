<!-- AIDA - AI Development Assistant v1.0.0 -->
<!-- Advanced AI-powered code review and analysis -->

# Python File Review Checklist

## Instructions
Perform a comprehensive review of the Python file. Analyze the code for:
1. Critical security and safety issues (zero tolerance)
2. Python language compliance and best practices
3. Code quality and maintainability
4. Performance considerations

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

### Language Feature Issues
- [ ] Using mutable default arguments
- [ ] Not using list/dict comprehensions where appropriate
- [ ] Inefficient loops that could be replaced with built-ins
- [ ] Not using sets for membership testing
- [ ] Incorrect use of global variables
- [ ] Missing type hints for function parameters

### Function and Method Issues
- [ ] Functions doing too many things (violating SRP)
- [ ] Inconsistent return types
- [ ] Not using *args/**kwargs appropriately
- [ ] Missing proper parameter validation
- [ ] Not using property decorators appropriately

### Class Design Issues
- [ ] Missing __init__ method proper implementation
- [ ] Missing __str__ and __repr__ methods
- [ ] Incorrect inheritance patterns
- [ ] Not following composition over inheritance
- [ ] Missing abstract base class usage where appropriate

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

### Testing and Documentation
- [ ] Missing docstrings for public APIs
- [ ] Inadequate code comments
- [ ] Missing type hints
- [ ] Code not structured for testing
- [ ] Missing error scenario documentation

## Review Template

**FILE OVERVIEW:**
- File type: [Module/Class/Script/Package]
- Primary responsibility: [Brief description]
- Dependencies: [List major dependencies]

**SECURITY ASSESSMENT:** [PASS/FAIL]
- Critical security issues: [List any violations]
- Security recommendations: [Suggestions]

**PYTHONIC ASSESSMENT:** [PASS/FAIL]
- PEP 8 compliance: [Good/Needs improvement]
- Language feature usage: [Appropriate/Suboptimal]
- Code style: [Consistent/Inconsistent]

**FUNCTIONALITY ASSESSMENT:** [PASS/FAIL]
- Logic correctness: [Correct/Has issues]
- Error handling: [Adequate/Insufficient]
- Edge case coverage: [Complete/Missing scenarios]

**PERFORMANCE ASSESSMENT:** [PASS/FAIL]
- Algorithm efficiency: [Optimal/Suboptimal]
- Resource usage: [Efficient/Wasteful]
- Memory management: [Good/Poor]

**MAINTAINABILITY ASSESSMENT:** [PASS/FAIL]
- Code clarity: [Excellent/Good/Poor]
- Documentation: [Complete/Adequate/Missing]
- Structure: [Well-organized/Needs improvement]

**OVERALL VERDICT:** [APPROVE/REQUEST_CHANGES/REJECT]

**CRITICAL ISSUES TO FIX:**
[List all zero-tolerance violations that must be addressed immediately]

**PYTHONIC IMPROVEMENTS:**
[List suggestions for more idiomatic Python code]

**RECOMMENDATIONS:**
[List suggestions for better implementation]

**POSITIVE ASPECTS:**
[Highlight good practices and well-written code]

**ADDITIONAL NOTES:**
[Any other relevant observations or suggestions]