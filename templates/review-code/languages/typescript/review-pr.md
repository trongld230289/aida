<!-- AIDA - AI Development Assistant v1.0.0 -->
<!-- Advanced AI-powered code review and analysis -->

# TypeScript Code Review Checklist for Pull Requests

## Instructions
Review the entire pull request and provide comprehensive feedback. Focus on:
1. Critical security and safety issues (zero tolerance)
2. TypeScript-specific features and type safety
3. Code quality and maintainability
4. Performance implications

## CRITICAL VIOLATIONS (ZERO TOLERANCE)

### SECURITY VIOLATIONS
- [ ] Hardcoded credentials, API keys, or secrets
- [ ] SQL injection vulnerabilities
- [ ] XSS vulnerabilities (innerHTML usage, unsafe DOM manipulation)
- [ ] Path traversal vulnerabilities
- [ ] Unsafe eval() or Function() constructor usage
- [ ] Prototype pollution vulnerabilities
- [ ] Missing input validation and sanitization
- [ ] Insecure random number generation for security purposes
- [ ] Exposure of sensitive data in logs or client responses
- [ ] Missing authentication/authorization checks

### NULL SAFETY VIOLATIONS
- [ ] Accessing properties on potentially null/undefined objects
- [ ] Missing null/undefined checks with strict null checks enabled
- [ ] Unsafe non-null assertions (!) without proper guards
- [ ] Optional chaining used without proper fallback handling
- [ ] Missing nullish coalescing for default values

### ERROR HANDLING VIOLATIONS
- [ ] Unhandled promise rejections
- [ ] Missing try-catch blocks for async operations
- [ ] Throwing non-Error objects
- [ ] Not logging critical errors
- [ ] Missing error boundaries or proper error propagation

### RESOURCE LEAKS
- [ ] Event listeners not removed on component unmount
- [ ] Timers/intervals not cleared properly
- [ ] Observable subscriptions not unsubscribed
- [ ] File handles not closed (Node.js)
- [ ] Memory leaks in closures or circular references

## TYPESCRIPT-SPECIFIC VIOLATIONS

### Type Safety Issues
- [ ] Using 'any' type instead of proper typing
- [ ] Missing type annotations for function parameters
- [ ] Missing return type annotations for functions
- [ ] Unsafe type assertions (as Type) without validation
- [ ] Using 'unknown' without proper type guards
- [ ] Missing generic type constraints
- [ ] Improper union/intersection type usage

### Interface and Type Definition Issues
- [ ] Missing interfaces for object shapes
- [ ] Inconsistent interface naming conventions
- [ ] Not extending interfaces appropriately
- [ ] Missing readonly modifiers where appropriate
- [ ] Not using mapped types for transformations
- [ ] Missing utility types (Partial, Required, Pick, etc.)

### Generic Programming Issues
- [ ] Not using generics where they would improve type safety
- [ ] Missing generic constraints with 'extends'
- [ ] Improper variance in generic types
- [ ] Not leveraging conditional types appropriately
- [ ] Missing template literal types where useful

### Module and Import Issues
- [ ] Missing proper import/export type definitions
- [ ] Circular dependencies in type definitions
- [ ] Not using namespace imports appropriately
- [ ] Missing re-exports in barrel files
- [ ] Inconsistent module resolution strategy

### Configuration Issues
- [ ] Strict mode not enabled in tsconfig.json
- [ ] Missing essential compiler options
- [ ] Inconsistent target/lib configurations
- [ ] Missing path mapping for cleaner imports
- [ ] Not leveraging project references

### Decorator Issues (if using)
- [ ] Missing experimental decorators configuration
- [ ] Improper decorator usage patterns
- [ ] Missing type safety in custom decorators
- [ ] Not following decorator factory patterns

### Advanced Type Issues
- [ ] Not using discriminated unions for type safety
- [ ] Missing branded/nominal typing where needed
- [ ] Not leveraging assertion signatures
- [ ] Missing proper overload signatures
- [ ] Not using const assertions appropriately

### Class and OOP Issues
- [ ] Missing access modifiers (private/protected/public)
- [ ] Not using readonly for immutable properties
- [ ] Missing abstract class/method usage where appropriate
- [ ] Improper inheritance patterns
- [ ] Missing proper constructor signatures

### Enum Issues
- [ ] Using string enums inappropriately
- [ ] Missing const assertions for enum-like objects
- [ ] Not using union types instead of enums where better
- [ ] Inconsistent enum naming conventions

## QUALITY CHECKS

### Code Architecture
- [ ] Proper separation of concerns with types
- [ ] Clean architecture with proper abstractions
- [ ] Dependency inversion with interfaces
- [ ] Single responsibility principle adherence

### Performance Considerations
- [ ] Type-only imports used where appropriate
- [ ] Avoiding heavy type computations at runtime
- [ ] Proper tree-shaking with ES modules
- [ ] Efficient type inference patterns

### Developer Experience
- [ ] Clear error messages from type system
- [ ] Good IntelliSense and autocomplete support
- [ ] Helpful JSDoc comments with types
- [ ] Consistent coding patterns across team

### Testing Integration
- [ ] Types work well with testing frameworks
- [ ] Mock types properly defined
- [ ] Type-safe test utilities
- [ ] Runtime type validation where needed

## Review Template

**SECURITY ASSESSMENT:** [PASS/FAIL]
- Security issues found: [List any critical security violations]

**TYPE SAFETY ASSESSMENT:** [PASS/FAIL]
- Type coverage: [Excellent/Good/Poor]
- Proper TypeScript usage: [Yes/No]
- Type safety violations: [None/List issues]

**FUNCTIONALITY ASSESSMENT:** [PASS/FAIL]
- Code correctly implements intended functionality
- All edge cases properly handled with types
- Error scenarios accounted for

**ARCHITECTURE ASSESSMENT:** [PASS/FAIL]
- Proper use of TypeScript features
- Clean type definitions and interfaces
- Good abstraction levels

**PERFORMANCE ASSESSMENT:** [PASS/FAIL]
- No type-related performance issues
- Efficient compile-time patterns
- Proper runtime considerations

**OVERALL VERDICT:** [APPROVE/REQUEST_CHANGES/REJECT]

**CRITICAL ISSUES TO FIX:**
[List all zero-tolerance violations that must be addressed]

**TYPE SAFETY IMPROVEMENTS:**
[List TypeScript-specific improvements needed]

**RECOMMENDATIONS:**
[List suggestions for better TypeScript usage]

**ADDITIONAL NOTES:**
[Any other relevant feedback about TypeScript usage]