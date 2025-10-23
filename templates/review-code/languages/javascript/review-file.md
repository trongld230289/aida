<!-- AIDA - AI Development Assistant v1.0.0 -->
<!-- Advanced AI-powered code review and analysis -->

# JavaScript File Review Checklist

## Instructions
Perform a comprehensive review of the JavaScript file. Analyze the code for:
1. Critical security and safety issues (zero tolerance)
2. JavaScript language compliance and best practices
3. Code quality and maintainability
4. Performance considerations

## CRITICAL VIOLATIONS (ZERO TOLERANCE)

### SECURITY VIOLATIONS
- [ ] Hardcoded credentials, API keys, or secrets
- [ ] SQL injection vulnerabilities
- [ ] XSS vulnerabilities (innerHTML, eval, document.write)
- [ ] Path traversal vulnerabilities
- [ ] Unsafe eval() or Function() constructor usage
- [ ] Prototype pollution attacks
- [ ] Missing input validation and sanitization
- [ ] Insecure randomization (Math.random for security)
- [ ] Exposure of sensitive data in client-side code
- [ ] Missing CSRF protection mechanisms

### NULL SAFETY VIOLATIONS
- [ ] Accessing properties on null/undefined objects
- [ ] Missing null/undefined checks before operations
- [ ] Unsafe optional chaining without fallbacks
- [ ] Unhandled null returns from functions
- [ ] Missing parameter validation in functions

### ERROR HANDLING VIOLATIONS
- [ ] Unhandled promise rejections
- [ ] Missing try-catch blocks for risky operations
- [ ] Throwing non-Error objects
- [ ] Not logging critical errors properly
- [ ] Silent failures without error propagation

### RESOURCE LEAKS
- [ ] Event listeners not removed on cleanup
- [ ] Timers/intervals not cleared properly
- [ ] File descriptors not closed (Node.js)
- [ ] Memory leaks in closures
- [ ] DOM elements not properly removed

## JAVASCRIPT-SPECIFIC VIOLATIONS

### Language and Syntax Issues
- [ ] Using var instead of let/const
- [ ] Missing 'use strict' directive
- [ ] Improper this binding and context
- [ ] Missing semicolons (if required by style)
- [ ] Using == instead of === comparisons
- [ ] Relying on problematic hoisting behavior
- [ ] Implicit type coercion bugs

### Modern JavaScript (ES6+) Issues
- [ ] Not using arrow functions appropriately
- [ ] Missing destructuring for cleaner code
- [ ] Not using template literals for strings
- [ ] Using var instead of const for constants
- [ ] Missing spread operator usage
- [ ] Not using default parameters
- [ ] Missing rest parameters

### Async Programming Issues
- [ ] Missing await for async operations
- [ ] Improper async error handling
- [ ] Using async without any await
- [ ] Mixing callback and promise patterns
- [ ] Not using Promise.all for parallel ops
- [ ] Callback hell anti-pattern
- [ ] Race conditions in async code

### Function Design Issues
- [ ] Functions with too many responsibilities
- [ ] Inconsistent return value types
- [ ] Missing input parameter validation
- [ ] Pure functions with side effects
- [ ] Not leveraging higher-order functions
- [ ] Improper closure usage patterns
- [ ] Missing function documentation

### Object and Array Handling
- [ ] Unintended object/array mutations
- [ ] Not using Object.freeze for immutables
- [ ] Inefficient array operations (nested loops)
- [ ] Missing array bounds validation
- [ ] Not using map/filter/reduce appropriately
- [ ] Improper object property access
- [ ] Missing object shape validation

### Type Safety and Validation
- [ ] Inconsistent type handling
- [ ] Missing runtime type checking
- [ ] Unsafe implicit type conversions
- [ ] Not validating function inputs
- [ ] Missing JSDoc type annotations
- [ ] Assuming object structure without checks

### Performance Anti-Patterns
- [ ] Inefficient DOM manipulation patterns
- [ ] Memory leaks in event handlers
- [ ] Function recreation in loops
- [ ] Not debouncing expensive operations
- [ ] Blocking main thread operations
- [ ] Inefficient regular expression usage
- [ ] Unnecessary object creation

### Module and Import Issues
- [ ] Missing proper import/export statements
- [ ] Circular dependency problems
- [ ] Not following module patterns
- [ ] Mixing CommonJS and ES6 modules
- [ ] Poor encapsulation practices
- [ ] Missing dependency management

### Browser/Environment Issues
- [ ] Using unsupported features without polyfills
- [ ] Missing feature detection code
- [ ] Not handling browser differences
- [ ] Using deprecated browser APIs
- [ ] Missing graceful degradation

## CODE QUALITY ANALYSIS

### Structure and Organization
- [ ] Clear and logical code organization
- [ ] Consistent indentation and formatting
- [ ] Proper separation of concerns
- [ ] Following established patterns

### Naming and Documentation
- [ ] Descriptive variable and function names
- [ ] Consistent naming conventions
- [ ] Adequate inline comments
- [ ] JSDoc documentation for public APIs

### Maintainability Factors
- [ ] Code is easy to understand and modify
- [ ] Low coupling between components
- [ ] High cohesion within modules
- [ ] Following DRY principles

### Testing Considerations
- [ ] Code is structured for testability
- [ ] Dependencies can be easily mocked
- [ ] Functions are pure where possible
- [ ] Error paths are testable

## Review Template

**FILE OVERVIEW:**
- File purpose: [Brief description of file's responsibility]
- Dependencies: [List major dependencies and imports]
- Complexity level: [Simple/Moderate/Complex]

**SECURITY ASSESSMENT:** [PASS/FAIL]
- Critical security issues: [List any violations]
- Security recommendations: [Suggestions for improvement]

**LANGUAGE COMPLIANCE:** [PASS/FAIL]
- Modern JavaScript usage: [Good/Needs improvement]
- Syntax and style: [Consistent/Inconsistent]
- Best practices: [Followed/Violated]

**FUNCTIONALITY ASSESSMENT:** [PASS/FAIL]
- Logic correctness: [Correct/Has issues]
- Error handling: [Adequate/Insufficient]
- Edge case coverage: [Complete/Missing scenarios]

**PERFORMANCE ASSESSMENT:** [PASS/FAIL]
- Algorithm efficiency: [Optimal/Suboptimal]
- Memory usage: [Efficient/Wasteful]
- Async operations: [Proper/Problematic]

**MAINTAINABILITY ASSESSMENT:** [PASS/FAIL]
- Code clarity: [Excellent/Good/Poor]
- Documentation: [Complete/Adequate/Missing]
- Structure: [Well-organized/Needs improvement]

**OVERALL VERDICT:** [APPROVE/REQUEST_CHANGES/REJECT]

**CRITICAL ISSUES TO FIX:**
[List all zero-tolerance violations that must be addressed immediately]

**HIGH PRIORITY IMPROVEMENTS:**
[List important improvements needed]

**RECOMMENDATIONS:**
[List suggestions for better implementation]

**POSITIVE ASPECTS:**
[Highlight good practices and well-written code]

**ADDITIONAL NOTES:**
[Any other relevant observations or context-specific feedback]