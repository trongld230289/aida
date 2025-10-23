<!-- AIDA - AI Development Assistant v1.0.0 -->
<!-- Advanced AI-powered code review and analysis -->

# NestJS Code Review Checklist for Git Changes

## Instructions
Review the git diff and provide feedback on the changes. Focus on:
1. Critical security and safety issues (zero tolerance)
2. NestJS-specific patterns and best practices
3. Code quality and maintainability
4. Performance implications

## CRITICAL VIOLATIONS (ZERO TOLERANCE)

### SECURITY VIOLATIONS
- [ ] Hardcoded credentials, API keys, or secrets
- [ ] SQL injection vulnerabilities
- [ ] XSS vulnerabilities in responses
- [ ] Path traversal vulnerabilities
- [ ] Insecure direct object references
- [ ] Missing authentication/authorization on routes
- [ ] Unsafe eval() or dynamic code execution
- [ ] Unvalidated file uploads
- [ ] Missing rate limiting on sensitive endpoints
- [ ] Exposure of sensitive data in logs or responses

### NULL SAFETY VIOLATIONS
- [ ] Accessing properties on potentially null/undefined objects
- [ ] Missing null checks for database queries
- [ ] Unhandled null returns from services
- [ ] Missing validation for required parameters
- [ ] Unsafe type assertions without checks

### ERROR HANDLING VIOLATIONS
- [ ] Unhandled promise rejections
- [ ] Missing try-catch blocks for async operations
- [ ] Exposing internal error details to clients
- [ ] Not logging critical errors
- [ ] Missing error handling in pipes/guards/interceptors

### RESOURCE LEAKS
- [ ] Database connections not properly closed
- [ ] Event listeners not cleaned up
- [ ] Timers/intervals not cleared
- [ ] File handles not closed
- [ ] Memory leaks in subscriptions

## NestJS-SPECIFIC VIOLATIONS

### Controller Issues
- [ ] Missing @Controller decorator
- [ ] Incorrect HTTP method decorators
- [ ] Missing validation pipes on request body/params
- [ ] Not using proper status codes
- [ ] Missing swagger documentation decorators
- [ ] Improper exception handling in controllers

### Service Issues
- [ ] Missing @Injectable decorator
- [ ] Circular dependency issues
- [ ] Not using proper scopes (singleton/request/transient)
- [ ] Missing proper constructor injection
- [ ] Business logic in controllers instead of services

### Module Issues
- [ ] Missing imports/exports declarations
- [ ] Circular module imports
- [ ] Not using forRoot/forFeature patterns correctly
- [ ] Missing provider declarations

### Guard Issues
- [ ] Not implementing CanActivate interface
- [ ] Missing return boolean/Promise<boolean>
- [ ] Not handling authentication properly
- [ ] Missing role-based checks

### Interceptor Issues
- [ ] Not implementing NestInterceptor interface
- [ ] Missing proper Observable handling
- [ ] Not transforming responses correctly
- [ ] Performance issues with interceptor logic

### Pipe Issues
- [ ] Not implementing PipeTransform interface
- [ ] Missing validation logic
- [ ] Not throwing proper validation exceptions
- [ ] Type transformation errors

### Middleware Issues
- [ ] Not calling next() function
- [ ] Missing proper error handling
- [ ] Not following middleware pattern
- [ ] Performance bottlenecks

### Decorator Issues
- [ ] Custom decorators not working properly
- [ ] Missing parameter decorators
- [ ] Incorrect metadata setting
- [ ] Type safety issues in decorators

### Database Issues
- [ ] Missing repository pattern usage
- [ ] SQL injection in raw queries
- [ ] Missing transaction handling
- [ ] Not using proper entity relationships
- [ ] Missing database connection error handling

### Testing Issues
- [ ] Missing unit tests for new functionality
- [ ] Missing integration tests for endpoints
- [ ] Not mocking dependencies properly
- [ ] Missing test coverage for error scenarios

## QUALITY CHECKS

### Code Structure
- [ ] Follows NestJS folder structure conventions
- [ ] Proper separation of concerns
- [ ] Consistent naming conventions
- [ ] Appropriate use of TypeScript features

### Performance
- [ ] Efficient database queries
- [ ] Proper caching implementation
- [ ] Async/await usage optimization
- [ ] Memory usage considerations

### Maintainability
- [ ] Clear and descriptive variable/function names
- [ ] Adequate documentation and comments
- [ ] Modular and reusable code design
- [ ] Follows SOLID principles

## Review Template

**SECURITY ASSESSMENT:** [PASS/FAIL]
- Security issues found: [List any critical security violations]

**FUNCTIONALITY ASSESSMENT:** [PASS/FAIL] 
- Code correctly implements the intended NestJS patterns
- All edge cases are properly handled
- Error scenarios are accounted for

**QUALITY ASSESSMENT:** [PASS/FAIL]
- Code follows NestJS best practices and conventions
- Proper use of decorators and dependency injection
- Clean, maintainable, and well-structured

**PERFORMANCE ASSESSMENT:** [PASS/FAIL]
- No obvious performance bottlenecks
- Efficient resource usage
- Proper async operations handling

**OVERALL VERDICT:** [APPROVE/REQUEST_CHANGES/REJECT]

**CRITICAL ISSUES TO FIX:**
[List all zero-tolerance violations that must be addressed]

**RECOMMENDATIONS:**
[List suggestions for improvement]

**ADDITIONAL NOTES:**
[Any other relevant feedback]