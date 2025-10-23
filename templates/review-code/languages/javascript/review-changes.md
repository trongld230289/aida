<!-- AIDA - AI Development Assistant v1.0.0 -->
<!-- Advanced AI-powered code review and analysis -->

# JavaScript Code Review Checklist for Git Changes

## Instructions
Review the git diff and provide feedback on the changes. Focus on:
1. Critical security and safety issues (zero tolerance)
2. JavaScript-specific patterns and best practices
3. Code quality and maintainability
4. Performance implications

## CRITICAL VIOLATIONS (ZERO TOLERANCE)

### SECURITY VIOLATIONS
- [ ] Hardcoded credentials, API keys, or secrets
- [ ] SQL injection vulnerabilities
- [ ] XSS vulnerabilities (innerHTML, eval, etc.)
- [ ] Path traversal vulnerabilities
- [ ] Unsafe eval() or Function() usage
- [ ] Prototype pollution vulnerabilities
- [ ] Missing input validation and sanitization
- [ ] Insecure random number generation
- [ ] Exposure of sensitive data in logs or client-side
- [ ] Missing CSRF protection

### NULL SAFETY VIOLATIONS
- [ ] Accessing properties on null/undefined objects
- [ ] Missing null/undefined checks
- [ ] Unsafe optional chaining usage
- [ ] Unhandled null returns from functions
- [ ] Missing validation for function parameters

### ERROR HANDLING VIOLATIONS
- [ ] Unhandled promise rejections
- [ ] Missing try-catch blocks for risky operations
- [ ] Throwing non-Error objects
- [ ] Not logging critical errors
- [ ] Silent failures without proper handling

### RESOURCE LEAKS
- [ ] Event listeners not removed
- [ ] Timers/intervals not cleared
- [ ] File descriptors not closed
- [ ] Memory leaks in closures
- [ ] DOM elements not properly cleaned up

## JAVASCRIPT-SPECIFIC VIOLATIONS

### Syntax and Language Issues
- [ ] Using var instead of let/const
- [ ] Missing strict mode ('use strict')
- [ ] Improper use of this keyword
- [ ] Missing semicolons (if required by style guide)
- [ ] Using == instead of === for comparisons
- [ ] Improper use of hoisting
- [ ] Missing function parameter validation

### ES6+ Feature Issues
- [ ] Not using arrow functions appropriately
- [ ] Improper destructuring usage
- [ ] Missing template literals for string interpolation
- [ ] Not using const for immutable values
- [ ] Improper use of spread operator
- [ ] Missing default parameters

### Async/Await Issues
- [ ] Missing await for async operations
- [ ] Not handling async errors properly
- [ ] Using async without await
- [ ] Mixing promises with async/await inconsistently
- [ ] Missing Promise.all for parallel operations
- [ ] Callback hell instead of promises/async

### Function Issues
- [ ] Functions doing too many things
- [ ] Inconsistent return types
- [ ] Missing parameter validation
- [ ] Pure functions with side effects
- [ ] Not using pure functions where appropriate
- [ ] Improper closure usage

### Object and Array Issues
- [ ] Mutating objects/arrays unexpectedly
- [ ] Not using Object.freeze for immutables
- [ ] Inefficient array operations
- [ ] Missing array bounds checking
- [ ] Improper use of map/filter/reduce
- [ ] Not using proper iteration methods

### Type Safety Issues
- [ ] Inconsistent type usage
- [ ] Missing type checking for parameters
- [ ] Unsafe type coercion
- [ ] Not validating object shapes
- [ ] Missing JSDoc type annotations

### Performance Issues
- [ ] Inefficient DOM manipulations
- [ ] Memory leaks in event handlers
- [ ] Unnecessary function recreations in loops
- [ ] Not debouncing/throttling expensive operations
- [ ] Blocking the main thread
- [ ] Inefficient regular expressions

### Module Issues
- [ ] Missing proper imports/exports
- [ ] Circular dependencies
- [ ] Not using module patterns correctly
- [ ] Mixing CommonJS and ES6 modules
- [ ] Missing proper encapsulation

### Browser Compatibility Issues
- [ ] Using unsupported ES6+ features without polyfills
- [ ] Missing feature detection
- [ ] Not handling browser differences
- [ ] Using deprecated APIs

## QUALITY CHECKS

### Code Structure
- [ ] Follows consistent coding style
- [ ] Proper function and variable naming
- [ ] Appropriate code organization
- [ ] Single responsibility principle

### Documentation
- [ ] Clear and helpful comments
- [ ] JSDoc documentation for functions
- [ ] README updates if needed
- [ ] Code is self-documenting

### Testing
- [ ] Unit tests for new functionality
- [ ] Integration tests where appropriate
- [ ] Edge case testing
- [ ] Error scenario testing

## Review Template

**SECURITY ASSESSMENT:** [PASS/FAIL]
- Security issues found: [List any critical security violations]

**FUNCTIONALITY ASSESSMENT:** [PASS/FAIL]
- Code correctly implements intended functionality
- All edge cases are properly handled
- Error scenarios are accounted for

**QUALITY ASSESSMENT:** [PASS/FAIL]
- Code follows JavaScript best practices
- Proper use of ES6+ features
- Clean, maintainable, and readable

**PERFORMANCE ASSESSMENT:** [PASS/FAIL]
- No obvious performance bottlenecks
- Efficient algorithms and data structures
- Proper async operations handling

**OVERALL VERDICT:** [APPROVE/REQUEST_CHANGES/REJECT]

**CRITICAL ISSUES TO FIX:**
[List all zero-tolerance violations that must be addressed]

**RECOMMENDATIONS:**
[List suggestions for improvement]

**ADDITIONAL NOTES:**
[Any other relevant feedback]