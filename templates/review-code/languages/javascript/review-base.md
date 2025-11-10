<!-- AIDA - Javascript Review Base Template -->
<!-- PLACEHOLDER: {{REVIEW_BASE}} -->

## 🔥 MANDATORY PROJECT RULES - MUST CHECK FIRST:
<!-- ADD PROJECT-SPECIFIC RULES HERE - These will be checked alongside Angular rules -->
<!-- Additional project rules can be added here:
- **🚫 CRITICAL**: Never use `isSuccess` as variable name - reserved for business logic
-->

### 🚨 SECURITY VIOLATIONS:
- Use of eval() with user input
- innerHTML with unescaped user content (XSS)
- Missing input validation and sanitization
- Hardcoded API keys, secrets, credentials
- Unsafe regular expressions (ReDoS)
- Missing CSRF protection in AJAX calls
- Unsafe use of document.write()
- Missing Content Security Policy considerations
- Prototype pollution vulnerabilities
- Unsafe dynamic imports or require()
- Missing authentication checks on client-side
- Exposed sensitive data in localStorage/sessionStorage

### 🚨 ASYNC/PROMISE VIOLATIONS:
- Unhandled promise rejections
- Missing async/await error handling
- Callback hell patterns
- Race conditions in async operations
- Missing Promise.all() for concurrent operations
- Memory leaks from unresolved promises
- Missing timeout handling for async operations
- Improper error propagation in promise chains
- Blocking main thread with synchronous operations
- Missing cancellation for async operations

### 🚨 MEMORY & PERFORMANCE VIOLATIONS:
- Memory leaks from event listeners not removed
- Inefficient DOM manipulation patterns
- Missing debouncing/throttling for frequent events
- Large object creation in loops
- Missing lazy loading for heavy resources
- Inefficient array/object operations
- Missing caching for expensive computations
- Blocking rendering with heavy JavaScript
- Missing virtual scrolling for large lists
- Inefficient string concatenation

### 🚨 DOM & EVENT VIOLATIONS:
- Direct DOM manipulation without framework patterns
- Missing event delegation for dynamic content
- Event listeners not properly removed
- Missing passive event listeners for performance
- Unsafe use of document.getElementById without checks
- Missing input validation for form elements
- Improper focus management
- Missing accessibility attributes
- Memory leaks from circular references
- Missing error boundaries for UI components

### 🚨 ES6+ & MODERN JS VIOLATIONS:
- Using var instead of let/const
- Missing proper module imports/exports
- Improper arrow function usage
- Missing template literals for string interpolation
- Not using destructuring where appropriate
- Missing default parameters
- Improper use of spread operator
- Missing proper class syntax
- Not using modern array methods
- Missing proper error handling with try/catch

### 🚨 CODE QUALITY & MAINTAINABILITY VIOLATIONS:
- Hardcoded strings for roles, error messages, or business values
- Magic numbers without named constants
- String comparisons without constants/enums
- Repeated string literals across files
- Missing centralized configuration for business values
- Hardcoded URLs or API endpoints
- Business logic constants scattered in components

### 🚨 TYPE SAFETY VIOLATIONS:
- Missing type checking for function parameters
- Unsafe type coercion (== instead of ===)
- Missing null/undefined checks
- Improper use of typeof operator
- Missing input validation
- Unsafe array/object access
- Missing proper error objects
- Type confusion in conditional statements
- Missing validation for external API responses
- Unsafe JSON parsing without try/catch
