<!-- AIDA - Typescript Review Base Template -->
<!-- PLACEHOLDER: {{REVIEW_BASE}} -->

## 🔥 MANDATORY PROJECT RULES - MUST CHECK FIRST:
<!-- ADD PROJECT-SPECIFIC RULES HERE - These will be checked alongside Angular rules -->
<!-- Additional project rules can be added here:
- **🚫 CRITICAL**: Never use `isSuccess` as variable name - reserved for business logic
-->

### 🚨 SECURITY VIOLATIONS:
- Hardcoded passwords, API keys, tokens, secrets
- Unsafe eval() or Function() constructor usage
- XSS vulnerabilities from unescaped user input
- Command injection through child_process
- Path traversal vulnerabilities in file operations
- Missing input validation and sanitization
- Unsafe regular expressions (ReDoS)
- Exposed sensitive data in logs/errors
- Missing authentication/authorization checks
- Unsafe file upload handling
- Insecure random number generation
- Missing CSRF protection for web applications

### 🚨 TYPE SAFETY VIOLATIONS:
- Excessive use of `any` type without justification
- Missing type annotations for function parameters
- Missing return type annotations for functions
- Incorrect use of type assertions (`as` keyword)
- Missing generic type parameters where needed
- Type definitions that don't match runtime behavior
- Missing null/undefined handling in strict mode
- Unsafe type casting without proper validation
- Missing discriminated union patterns
- Type guards not properly implemented

### 🚨 ASYNC/PROMISE VIOLATIONS:
- Missing await for async operations
- Unhandled promise rejections
- Promise constructor anti-patterns
- Mixing async/await with .then/.catch incorrectly
- Missing error handling in async operations
- Race conditions in async operations
- Missing timeout handling for async operations
- Fire-and-forget async operations without error handling
- Async operations without proper cancellation
- Missing proper typing for async functions

### 🚨 MODULE DESIGN VIOLATIONS:
- Circular imports between modules
- Missing proper module exports
- Default exports when named exports are better
- Modules with too many exports (>20)
- Missing barrel exports (index.ts files)
- Incorrect import/export patterns
- Missing dependency injection patterns
- Global namespace pollution
- Missing proper module documentation
- Modules not following single responsibility

### 🚨 CODE QUALITY & MAINTAINABILITY VIOLATIONS:
- Hardcoded strings for roles, error messages, or business values
- Magic numbers without named constants
- String comparisons without constants/enums
- Repeated string literals across files
- Missing centralized configuration for business values
- Hardcoded URLs or API endpoints
- Business logic constants scattered in components

### 🚨 INTERFACE/TYPE VIOLATIONS:
- Interfaces with too many optional properties
- Missing readonly modifiers where appropriate
- Incorrect use of interface vs type alias
- Missing proper inheritance patterns
- Interface segregation principle violations
- Missing generic constraints where needed
- Incorrect use of mapped types
- Missing utility type usage (Partial, Pick, etc.)
- Type definitions not matching actual usage
- Missing branded types for type safety

### 🚨 ERROR HANDLING VIOLATIONS:
- Try-catch blocks without proper error typing
- Generic Error catching without specific handling
- Missing error boundaries for modules
- Error handling that breaks type safety
- Missing custom error types
- Not using Result/Either patterns for error handling
- Missing error logging with proper context
- Exception handling that masks real errors
- Missing validation with proper error messages
- Error propagation without proper typing

### 🚨 PERFORMANCE VIOLATIONS:
- Inefficient type checking patterns
- Missing readonly for immutable data
- Excessive object creation in hot paths
- Missing lazy loading for heavy modules
- Inefficient algorithm implementations
- Missing memoization for expensive computations
- Synchronous operations blocking execution
- Missing proper tree-shaking configuration
- Large bundle sizes without optimization
- Missing dead code elimination
