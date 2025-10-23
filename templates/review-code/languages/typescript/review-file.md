<!-- AIDA - AI Development Assistant v1.0.0 -->
<!-- Advanced AI-powered code review and analysis -->

# TypeScript File Review Checklist

## Instructions
Perform a comprehensive review of the TypeScript file. Analyze the code for:
1. Critical security and safety issues (zero tolerance)
2. TypeScript type system compliance and best practices
3. Code quality and architectural patterns
4. Performance and maintainability considerations

## CRITICAL VIOLATIONS (ZERO TOLERANCE)

### SECURITY VIOLATIONS
- [ ] Hardcoded credentials, API keys, or secrets
- [ ] SQL injection vulnerabilities
- [ ] XSS vulnerabilities (innerHTML, unsafe DOM operations)
- [ ] Path traversal vulnerabilities
- [ ] Unsafe eval() or Function() constructor usage
- [ ] Prototype pollution vulnerabilities
- [ ] Missing input validation and sanitization
- [ ] Insecure random number generation for security
- [ ] Exposure of sensitive data in client-side code
- [ ] Missing authentication/authorization mechanisms

### NULL SAFETY VIOLATIONS
- [ ] Accessing properties on potentially null/undefined objects
- [ ] Missing null/undefined checks with strict null checks enabled
- [ ] Unsafe non-null assertions (!) without proper type guards
- [ ] Optional chaining used without appropriate fallback handling
- [ ] Missing nullish coalescing operator for default values

### ERROR HANDLING VIOLATIONS
- [ ] Unhandled promise rejections
- [ ] Missing try-catch blocks for risky async operations
- [ ] Throwing non-Error objects
- [ ] Not logging critical errors appropriately
- [ ] Missing error boundaries or proper error propagation

### RESOURCE LEAKS
- [ ] Event listeners not removed on cleanup
- [ ] Timers/intervals not cleared properly
- [ ] Observable subscriptions not unsubscribed
- [ ] File handles not closed (Node.js contexts)
- [ ] Memory leaks in closures or circular references

## TYPESCRIPT-SPECIFIC VIOLATIONS

### Type System Violations
- [ ] Overuse of 'any' type defeating type safety
- [ ] Missing type annotations for function parameters
- [ ] Missing return type annotations for public functions
- [ ] Unsafe type assertions (as Type) without validation
- [ ] Using 'unknown' without proper type narrowing
- [ ] Ignoring TypeScript errors with @ts-ignore
- [ ] Missing generic type parameters where beneficial

### Interface and Type Definition Issues
- [ ] Missing interfaces for complex object shapes
- [ ] Inconsistent interface naming conventions (not PascalCase)
- [ ] Not extending interfaces appropriately
- [ ] Missing readonly modifiers for immutable properties
- [ ] Not using mapped types for transformations
- [ ] Missing utility types (Partial, Required, Pick, Omit)
- [ ] Improper use of intersection vs union types

### Advanced TypeScript Features
- [ ] Not using generics where they improve type safety
- [ ] Missing generic constraints with 'extends' keyword
- [ ] Improper variance in generic type parameters
- [ ] Not leveraging conditional types appropriately
- [ ] Missing template literal types for string patterns
- [ ] Not using discriminated unions for type safety
- [ ] Missing branded/nominal typing where needed

### Module System Issues
- [ ] Missing proper import/export type declarations
- [ ] Circular dependencies in type definitions
- [ ] Not using type-only imports where appropriate
- [ ] Inconsistent module resolution patterns
- [ ] Missing re-exports in barrel files
- [ ] Not leveraging namespace imports effectively

### Class and Object-Oriented Issues
- [ ] Missing access modifiers (private/protected/public)
- [ ] Not using readonly for immutable class properties
- [ ] Missing abstract class/method declarations where appropriate
- [ ] Improper inheritance and polymorphism patterns
- [ ] Missing proper constructor parameter properties
- [ ] Not implementing interfaces correctly

### Function and Method Issues
- [ ] Missing overload signatures for polymorphic functions
- [ ] Not using assertion signatures where appropriate
- [ ] Missing proper this parameter typing
- [ ] Not leveraging function type guards
- [ ] Inconsistent parameter and return type patterns

### Enum and Constant Issues
- [ ] Using string enums inappropriately
- [ ] Missing const assertions for enum-like objects
- [ ] Not using union types instead of enums where better
- [ ] Inconsistent enum naming and value conventions

### Configuration and Tooling Issues
- [ ] Not following strict TypeScript compiler options
- [ ] Missing essential tsconfig.json configurations
- [ ] Inconsistent target/lib/module settings
- [ ] Not utilizing path mapping for cleaner imports
- [ ] Missing project references for monorepo structures

## CODE ARCHITECTURE ANALYSIS

### Type Safety Architecture
- [ ] Comprehensive type coverage throughout file
- [ ] Proper abstraction layers with interfaces
- [ ] Clean separation between types and implementation
- [ ] Effective use of generics for reusability

### Dependency Management
- [ ] Clear dependency injection patterns
- [ ] Proper abstraction of external dependencies
- [ ] Type-safe configuration management
- [ ] Clean import organization and structure

### Error Handling Architecture
- [ ] Consistent error handling patterns
- [ ] Type-safe error propagation
- [ ] Proper use of Result/Either patterns if applicable
- [ ] Clear error boundary definitions

### Performance Considerations
- [ ] Type-only imports to reduce bundle size
- [ ] Avoiding heavy type computations at runtime
- [ ] Efficient type inference patterns
- [ ] Proper tree-shaking compatibility

## QUALITY METRICS

### Code Readability
- [ ] Clear and descriptive type names
- [ ] Self-documenting type definitions
- [ ] Consistent coding style and formatting
- [ ] Appropriate use of comments and JSDoc

### Maintainability Factors
- [ ] Modular and extensible type definitions
- [ ] Low coupling between type dependencies
- [ ] High cohesion within type modules
- [ ] Easy to refactor and extend

### Developer Experience
- [ ] Excellent IntelliSense and autocomplete support
- [ ] Clear compiler error messages
- [ ] Good debugging experience with source maps
- [ ] Helpful type hints and documentation

### Testing Integration
- [ ] Types work seamlessly with testing frameworks
- [ ] Proper mock type definitions
- [ ] Type-safe test utilities and helpers
- [ ] Runtime type validation where appropriate

## Review Template

**FILE OVERVIEW:**
- File type: [Component/Service/Utility/Types/etc.]
- Primary responsibility: [Brief description]
- Key dependencies: [List major type dependencies]
- Complexity assessment: [Simple/Moderate/Complex]

**SECURITY ASSESSMENT:** [PASS/FAIL]
- Critical security issues: [List any violations]
- Security recommendations: [Improvement suggestions]

**TYPE SAFETY ASSESSMENT:** [PASS/FAIL]
- Type coverage: [Excellent/Good/Adequate/Poor]
- TypeScript feature utilization: [Appropriate/Underutilized/Overused]
- Type safety violations: [None/List specific issues]

**ARCHITECTURE ASSESSMENT:** [PASS/FAIL]
- Type system design: [Well-structured/Needs improvement]
- Abstraction levels: [Appropriate/Too abstract/Too concrete]
- Separation of concerns: [Clear/Unclear]

**FUNCTIONALITY ASSESSMENT:** [PASS/FAIL]
- Logic correctness: [Verified/Has issues]
- Edge case handling: [Complete/Incomplete]
- Error scenario coverage: [Comprehensive/Limited]

**PERFORMANCE ASSESSMENT:** [PASS/FAIL]
- Compilation performance: [Good/Acceptable/Poor]
- Runtime performance: [Optimal/Adequate/Suboptimal]
- Bundle size impact: [Minimal/Reasonable/Concerning]

**MAINTAINABILITY ASSESSMENT:** [PASS/FAIL]
- Code clarity: [Excellent/Good/Fair/Poor]
- Documentation quality: [Complete/Adequate/Insufficient]
- Extensibility: [High/Medium/Low]

**OVERALL VERDICT:** [APPROVE/REQUEST_CHANGES/REJECT]

**CRITICAL ISSUES TO FIX:**
[List all zero-tolerance violations that must be addressed immediately]

**HIGH PRIORITY TYPE SAFETY IMPROVEMENTS:**
[List important TypeScript-specific improvements needed]

**ARCHITECTURE RECOMMENDATIONS:**
[Suggestions for improving type system design and structure]

**PERFORMANCE OPTIMIZATIONS:**
[Suggestions for improving compilation and runtime performance]

**POSITIVE ASPECTS:**
[Highlight excellent TypeScript usage and well-designed types]

**ADDITIONAL NOTES:**
[Any other relevant observations, context-specific feedback, or learning opportunities]