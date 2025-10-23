<!-- AIDA - AI Development Assistant v1.0.0 -->
<!-- Advanced AI-powered code review and analysis -->

# TypeScript Code Review Checklist for Git Changes

## Instructions
Review the git diff and provide feedback on the changes. Focus on:
1. Critical security and safety issues (zero tolerance)
2. TypeScript-specific type safety and language features
3. Code quality and maintainability
4. Performance implications

## CRITICAL VIOLATIONS (ZERO TOLERANCE)

### SECURITY VIOLATIONS
- [ ] Hardcoded credentials, API keys, or secrets
- [ ] SQL injection vulnerabilities
- [ ] XSS vulnerabilities (innerHTML, unsafe DOM manipulation)
- [ ] Path traversal vulnerabilities
- [ ] Unsafe eval() or Function() constructor usage
- [ ] Prototype pollution vulnerabilities
- [ ] Missing input validation and sanitization
- [ ] Insecure random number generation for security
- [ ] Exposure of sensitive data in responses/logs
- [ ] Missing authentication/authorization checks

### NULL SAFETY VIOLATIONS
- [ ] Accessing properties on potentially null/undefined objects
- [ ] Missing null/undefined checks with strict null checks
- [ ] Unsafe non-null assertions (!) without guards
- [ ] Optional chaining without proper fallback handling
- [ ] Missing nullish coalescing for defaults

### ERROR HANDLING VIOLATIONS
- [ ] Unhandled promise rejections
- [ ] Missing try-catch blocks for async operations
- [ ] Throwing non-Error objects
- [ ] Not logging critical errors
- [ ] Missing error boundaries or error propagation

### RESOURCE LEAKS
- [ ] Event listeners not removed
- [ ] Timers/intervals not cleared
- [ ] Observable subscriptions not unsubscribed
- [ ] File handles not closed (Node.js)
- [ ] Memory leaks in closures

## TYPESCRIPT-SPECIFIC VIOLATIONS

### Type Safety Issues
- [ ] Introducing 'any' types instead of proper typing
- [ ] Missing type annotations for new functions
- [ ] Missing return type annotations
- [ ] Unsafe type assertions without validation
- [ ] Using 'unknown' without type guards
- [ ] Weakening existing type safety

### Interface and Type Changes
- [ ] Breaking changes to existing interfaces
- [ ] Missing interface updates for new properties
- [ ] Inconsistent interface naming
- [ ] Not using readonly where appropriate
- [ ] Missing utility type usage (Partial, Required, etc.)

### Generic Type Issues
- [ ] Not using generics for reusable code
- [ ] Missing generic constraints
- [ ] Improper generic variance
- [ ] Not leveraging conditional types

### Import/Export Changes
- [ ] Missing type-only imports/exports
- [ ] Creating circular dependencies
- [ ] Not using proper module patterns
- [ ] Missing barrel file updates

### Compiler Configuration
- [ ] Disabling strict mode checks
- [ ] Ignoring TypeScript errors with @ts-ignore
- [ ] Weakening compiler options
- [ ] Missing path mapping updates

### Class and OOP Changes
- [ ] Missing access modifiers
- [ ] Not using readonly for immutable properties
- [ ] Improper inheritance modifications
- [ ] Missing abstract implementations

### Advanced TypeScript Features
- [ ] Not using discriminated unions appropriately
- [ ] Missing branded types where needed
- [ ] Not leveraging assertion signatures
- [ ] Missing const assertions

## CHANGE-SPECIFIC ANALYSIS

### Added Code Review
- [ ] New code follows existing TypeScript patterns
- [ ] Proper type annotations added
- [ ] No introduction of type safety regressions
- [ ] Consistent with project coding standards

### Modified Code Review
- [ ] Type safety maintained or improved
- [ ] Breaking changes properly handled
- [ ] Backward compatibility considered
- [ ] Refactoring improves type safety

### Deleted Code Review
- [ ] No orphaned type definitions
- [ ] Dependent types properly updated
- [ ] No breaking changes introduced
- [ ] Clean removal without loose ends

## QUALITY CHECKS

### Type Coverage
- [ ] Maintains or improves type coverage
- [ ] No regression in type safety
- [ ] Proper use of TypeScript features
- [ ] Clear type definitions

### Code Quality
- [ ] Follows TypeScript best practices
- [ ] Consistent naming conventions
- [ ] Proper abstraction levels
- [ ] Clean and maintainable code

### Performance Impact
- [ ] No negative impact on compilation time
- [ ] Efficient type checking patterns
- [ ] Proper tree-shaking support
- [ ] No runtime performance regressions

## Review Template

**SECURITY ASSESSMENT:** [PASS/FAIL]
- Security issues found: [List any critical security violations]

**TYPE SAFETY ASSESSMENT:** [PASS/FAIL]
- Type safety maintained: [Yes/No]
- New type definitions: [Appropriate/Needs improvement]
- TypeScript feature usage: [Proper/Improper]

**FUNCTIONALITY ASSESSMENT:** [PASS/FAIL]
- Changes implement intended functionality correctly
- Edge cases properly handled with types
- Error scenarios accounted for

**QUALITY ASSESSMENT:** [PASS/FAIL]
- Code follows TypeScript best practices
- Consistent with existing codebase
- Maintainable and readable

**PERFORMANCE ASSESSMENT:** [PASS/FAIL]
- No compilation performance issues
- Runtime performance maintained
- Efficient patterns used

**OVERALL VERDICT:** [APPROVE/REQUEST_CHANGES/REJECT]

**CRITICAL ISSUES TO FIX:**
[List all zero-tolerance violations that must be addressed]

**TYPE SAFETY IMPROVEMENTS:**
[List TypeScript-specific improvements needed]

**RECOMMENDATIONS:**
[List suggestions for better TypeScript implementation]

**ADDITIONAL NOTES:**
[Any other relevant feedback about the changes]