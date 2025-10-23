<!-- AIDA - AI Development Assistant v1.0.0 -->
<!-- Advanced AI-powered code review and analysis -->

# NestJS File Review Checklist

## Instructions
Perform a comprehensive review of the NestJS file. Analyze the code for:
1. Critical security and safety issues (zero tolerance)
2. NestJS framework compliance and best practices
3. Code quality and architectural patterns
4. Performance and maintainability

## CRITICAL VIOLATIONS (ZERO TOLERANCE)

### SECURITY VIOLATIONS
- [ ] Hardcoded credentials, API keys, or secrets
- [ ] SQL injection vulnerabilities
- [ ] XSS vulnerabilities in responses  
- [ ] Path traversal vulnerabilities
- [ ] Insecure direct object references
- [ ] Missing authentication/authorization checks
- [ ] Unsafe eval() or dynamic code execution
- [ ] Unvalidated file uploads
- [ ] Missing input sanitization
- [ ] Exposure of sensitive data in responses/logs

### NULL SAFETY VIOLATIONS
- [ ] Accessing properties on potentially null/undefined objects
- [ ] Missing null checks for database results
- [ ] Unhandled null returns from dependencies
- [ ] Missing validation for required inputs
- [ ] Unsafe type assertions without guards

### ERROR HANDLING VIOLATIONS
- [ ] Unhandled promise rejections
- [ ] Missing try-catch blocks for async operations
- [ ] Exposing internal error details to clients
- [ ] Not logging critical errors
- [ ] Missing error handling in lifecycle methods

### RESOURCE LEAKS
- [ ] Database connections not properly managed
- [ ] Event listeners not cleaned up
- [ ] Timers/intervals not cleared  
- [ ] File handles not closed
- [ ] Memory leaks in observables/subscriptions

## NESTJS-SPECIFIC VIOLATIONS

### Controller Analysis
- [ ] Missing or incorrect @Controller decorator
- [ ] Improper HTTP method decorators (@Get, @Post, etc.)
- [ ] Missing validation pipes on endpoints
- [ ] Incorrect status code handling
- [ ] Missing Swagger/OpenAPI documentation
- [ ] Business logic in controller (should be in service)
- [ ] Missing proper exception filters usage

### Service Analysis  
- [ ] Missing @Injectable decorator
- [ ] Circular dependency issues
- [ ] Incorrect dependency injection patterns
- [ ] Not using proper service scopes
- [ ] Missing error handling in service methods
- [ ] Blocking operations in async methods

### Module Analysis
- [ ] Missing @Module decorator
- [ ] Incorrect imports/exports configuration
- [ ] Circular module dependencies
- [ ] Not following module organization patterns
- [ ] Missing provider declarations
- [ ] Improper use of forRoot/forFeature

### Guard Analysis
- [ ] Not implementing CanActivate interface properly
- [ ] Missing return type (boolean/Promise<boolean>/Observable<boolean>)
- [ ] Improper authentication/authorization logic
- [ ] Not extracting user context properly
- [ ] Missing role-based access control

### Interceptor Analysis
- [ ] Not implementing NestInterceptor interface
- [ ] Improper Observable handling
- [ ] Missing response transformation logic
- [ ] Performance issues with heavy operations
- [ ] Not handling errors in interceptor

### Pipe Analysis
- [ ] Not implementing PipeTransform interface
- [ ] Missing validation logic
- [ ] Not throwing proper BadRequestException
- [ ] Incorrect type transformations
- [ ] Missing custom validation decorators

### Middleware Analysis
- [ ] Not calling next() function
- [ ] Missing proper error handling
- [ ] Blocking the request pipeline
- [ ] Not following Express middleware pattern
- [ ] Performance bottlenecks

### Database Integration
- [ ] Missing proper repository pattern
- [ ] SQL injection in raw queries
- [ ] Missing transaction handling
- [ ] Improper entity relationships
- [ ] Missing connection error handling
- [ ] Not using TypeORM/Mongoose patterns correctly

### Testing Considerations
- [ ] Missing testable structure
- [ ] Hard-to-mock dependencies
- [ ] Missing proper error scenario coverage
- [ ] Not following testing best practices

## ARCHITECTURE & DESIGN

### Dependency Injection
- [ ] Proper use of DI container
- [ ] Correct provider configurations
- [ ] Avoiding service locator pattern
- [ ] Clean dependency graphs

### Design Patterns
- [ ] Repository pattern implementation
- [ ] Factory pattern usage
- [ ] Strategy pattern for business logic
- [ ] Observer pattern with events

### Code Organization
- [ ] Single Responsibility Principle
- [ ] Open/Closed Principle adherence  
- [ ] Dependency Inversion compliance
- [ ] Interface Segregation following

## PERFORMANCE ANALYSIS

### Database Operations
- [ ] Efficient query patterns
- [ ] Proper indexing usage
- [ ] Avoiding N+1 query problems
- [ ] Connection pooling optimization

### Async Operations
- [ ] Proper Promise handling
- [ ] Avoiding callback hell
- [ ] Efficient Observable usage
- [ ] Parallel processing where applicable

### Memory Management
- [ ] No memory leaks
- [ ] Efficient data structures
- [ ] Proper garbage collection
- [ ] Resource cleanup

## QUALITY METRICS

### Code Clarity
- [ ] Clear and descriptive naming
- [ ] Adequate comments and documentation
- [ ] Consistent code formatting
- [ ] Self-documenting code structure

### Maintainability  
- [ ] Modular code design
- [ ] Low coupling, high cohesion
- [ ] Easy to extend and modify
- [ ] Following NestJS conventions

### Type Safety
- [ ] Proper TypeScript usage
- [ ] Strong typing throughout
- [ ] Avoiding 'any' type usage
- [ ] Generic type implementation

## Review Template

**FILE OVERVIEW:**
- File type: [Controller/Service/Module/Guard/Interceptor/Pipe/etc.]
- Primary responsibility: [Brief description]
- Dependencies: [List major dependencies]

**SECURITY ASSESSMENT:** [PASS/FAIL]
- Critical security issues: [List any violations]
- Security recommendations: [Suggestions]

**NESTJS COMPLIANCE:** [PASS/FAIL]  
- Framework pattern adherence: [Assessment]
- Decorator usage: [Correct/Incorrect]
- DI implementation: [Proper/Needs improvement]

**ARCHITECTURE ASSESSMENT:** [PASS/FAIL]
- Design pattern usage: [Evaluation]
- Separation of concerns: [Good/Needs improvement]  
- SOLID principles: [Followed/Violated]

**PERFORMANCE ASSESSMENT:** [PASS/FAIL]
- Efficiency analysis: [No issues/Concerns found]
- Resource usage: [Optimal/Suboptimal]
- Async handling: [Correct/Incorrect]

**QUALITY ASSESSMENT:** [PASS/FAIL]
- Code clarity: [Excellent/Good/Poor]
- Maintainability: [High/Medium/Low]
- Type safety: [Strong/Weak]

**OVERALL VERDICT:** [APPROVE/REQUEST_CHANGES/REJECT]

**CRITICAL ISSUES TO FIX:**
[List all zero-tolerance violations that must be addressed immediately]

**HIGH PRIORITY IMPROVEMENTS:**
[List important improvements needed]

**RECOMMENDATIONS:**
[List suggestions for better implementation]

**ADDITIONAL NOTES:**
[Any other relevant observations or suggestions]