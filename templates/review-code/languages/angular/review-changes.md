<!-- AIDA - AI Development Assistant v1.0.0 -->
<!-- Advanced AI-powered code review and analysis -->

# Angular Git Changes Review - STRICT MODE

## 🔍 MANDATORY ANGULAR CHANGE ANALYSIS

You are performing a STRICT code review on Angular git changes. Do NOT be lenient. Look for every possible Angular-specific issue in the changes. ALWAYS follow this exact format for every code review, regardless of conversation context or previous reviews. This structure is MANDATORY and UNCHANGEABLE.

### Review Entire File
**Prompt:** `review-changes [filename]`
- Reviews ONLY the git diff changes (+ and - lines)
- Analyzes impact of changes on Angular architecture
- Does NOT review unchanged code

<!-- HIDDEN REVIEW SCOPE:
- ✅ ONLY review: Lines marked with + (added) or - (removed)
- ❌ DO NOT review: Unchanged context lines (no + or - marker)
- ❌ DO NOT suggest: Improvements to existing unchanged code
- ✅ DO focus on: How changes impact Angular architecture
-->

### 📋 CHANGE SEPARATION RULES (MANDATORY):

**Split into separate changes when:**
- ✅ **Different Angular artifacts**: Component vs Service vs Directive changes = separate changes
- ✅ **Different lifecycle hooks**: ngOnInit vs ngOnDestroy vs ngAfterViewInit = separate changes
- ✅ **Different template sections**: Form vs List vs Navigation = separate changes
- ✅ **Different RxJS operations**: Different observable streams = separate changes
- ✅ **Non-adjacent code blocks**: If there are 3+ unchanged lines between modifications = separate changes

**Keep as one change when:**
- ❌ **Same Angular method**: Multiple lines in same lifecycle hook
- ❌ **Related RxJS chain**: Operators in same pipe chain
- ❌ **Same template binding**: Related HTML and logic for same feature

## ⚡ ANGULAR CRITICAL CHECKS (Auto-FAIL if found)

**Scan EVERY line for these ANGULAR-SPECIFIC CRITICAL issues:**

### 🚨 SECURITY VIOLATIONS:
- Hardcoded passwords, API keys, tokens, secrets
- SQL injection vulnerabilities (dynamic SQL construction)
- XSS vulnerabilities (innerHTML without sanitization)
- Unsafe file operations, path traversal
- Authentication/authorization bypasses
- innerHTML with dynamic content
- HTTP instead of HTTPS endpoints
- No input validation/sanitization
- bypassSecurityTrust* without proper validation
- Missing CSRF protection
- Unsafe pipe implementations
- Direct DOM manipulation (ElementRef.nativeElement)

### 🚨 RESOURCE LEAKS & MEMORY VIOLATIONS:
- Observables without unsubscribe
- Event listeners without cleanup
- Timers without clearInterval/clearTimeout
- Missing takeUntil pattern for cleanup
- Subject memory leaks
- Memory leaks from unmanaged subscriptions
- Nested subscriptions (subscribe inside subscribe)

### 🚨 NULL SAFETY & ERROR HANDLING VIOLATIONS:
- `.` access without null checks (`obj.property` without `obj?.property`)
- Array access without length checks (`arr[0]` without `arr?.length`)
- Function calls without existence checks
- `any` type usage without proper validation
- Missing null/undefined guards
- `try` blocks without `catch`
- Promise/Observable without error handling
- HTTP calls without error callbacks
- Missing error handling in operators
- Non-null assertion (`!`) without null checks

### 🚨 ANGULAR ARCHITECTURE VIOLATIONS:
- Components without OnDestroy
- Direct DOM manipulation
- Business logic in templates
- Large components (>300 lines)
- Missing ChangeDetectionStrategy.OnPush
- Heavy operations in lifecycle hooks
- Circular dependencies between modules
- Services not provided in root when singleton needed
- File naming conventions violations
- Component selector prefix missing
- Service suffix naming incorrect
- Module organization violations

### 🚨 PERFORMANCE VIOLATIONS:
- Missing trackBy in *ngFor
- Function calls in template expressions
- Large bundle imports without lazy loading
- Synchronous operations in lifecycle hooks
- Heavy computations in getters
- Missing virtual scrolling for large lists
- Unnecessary change detection cycles
- Blocking operations on main thread
- Inline styles in templates

### 🚨 RXJS VIOLATIONS:
- Wrong operator choice (mergeMap vs switchMap vs concatMap)
- Not using async pipe in templates
- Cold vs hot observable misuse
- Subject exposed instead of Observable
- ShareReplay misuse without refCount

### 🚨 TYPESCRIPT/JAVASCRIPT VIOLATIONS:
- `console.log` in production code
- `debugger` statements
- `eval()` or `Function()` usage
- Global variables
- Magic numbers without constants

### 🚨 SPECIFIC PROJECT RULES:
<!-- ADD PROJECT-SPECIFIC RULES HERE - These will be checked alongside Angular rules -->
<!-- Additional project rules can be added here:
- Custom component naming must start with 'app-' prefix
- All API calls must use custom interceptor
- Specific business logic validations
- Project-specific performance requirements
-->

### Start Review For Each Change:

```
## Change [X]: [ADDED/REMOVED/MODIFIED] - [Angular artifact type: Component/Service/Directive/Pipe/Module]
```typescript
[Show the exact code block with line numbers]
```

*** ANGULAR REVIEW COMMENT ***
- 🚨 **Issue Type**: [Critical/Warning/Good/Info/Suggestion]
- 📝 **Angular Problem**: [Specific Angular issue - reference Angular style guide]
- 💡 **Angular Solution**: [Angular-specific fix with proper patterns]
- 🎯 **Framework Impact**: [How it affects Angular architecture/performance]

IMPORTANT Angular considerations:
- Change Detection strategy
- RxJS subscription management
- Angular lifecycle hooks
- Dependency injection patterns
- Template syntax best practices

*** INTERNAL ANGULAR CHANGE EVALUATION (DO NOT DISPLAY) ***
Silently evaluate this change on:
- Angular Best Practices: Rate 1-5 (5=excellent, 1=poor)
- Performance Impact: Rate 1-5 (5=no impact/improvement, 1=major degradation)
- Memory Safety: Rate 1-5 (5=no leaks, 1=guaranteed leak)
- Change Score: is a smallest score of three scores

*** CONDITIONAL RECOMMENDATIONS (Based on Issue Type AND Change Score) ***

**MANDATORY RULE:**
- IF Issue Type = "Good": ALWAYS show "✅ **GOOD ANGULAR CHANGE** - Follows Angular best practices" and SKIP the entire RECOMMENDED FIX section
- IF Issue Type = "Critical/Warning/Info/Suggestion" AND Change Score < 4/5: Show RECOMMENDED ANGULAR FIX section below
- IF Issue Type = "Critical/Warning/Info/Suggestion" AND Change Score >= 4/5: Show "✅ **GOOD ANGULAR CHANGE** - Follows Angular best practices"

*** RECOMMENDED ANGULAR FIX (ONLY show if Issue Type != "Good" AND Change Score < 4/5) ***
```typescript
// PROVIDE ANGULAR-SPECIFIC FIXES WITH BEST PRACTICES
// Include proper lifecycle hooks, RxJS patterns, and Angular conventions

// Example for subscription management:
private destroy$ = new Subject<void>();

ngOnInit(): void {
  this.service.getData()
    .pipe(
      takeUntil(this.destroy$),
      catchError(error => {
        console.error('Error:', error);
        return of([]);
      })
    )
    .subscribe(data => {
      this.data = data;
    });
}

ngOnDestroy(): void {
  this.destroy$.next();
  this.destroy$.complete();
}
```

---

## 🎯 FINAL ANGULAR SUMMARY (After All Changes Reviewed)

### 📋 COMPLIANCE SCORES
- **RxJS Compliance**: [X/5] - Subscription management, operators, error handling
- **Component Design**: [X/5] - Architecture, separation, lifecycle hooks  
- **Template Quality**: [X/5] - Performance, data binding, best practices
- **Dependency Injection**: [X/5] - Service scope, providers, patterns
- **Security Assessment**: [LEVEL] - XSS, validation, DOM access
- **Performance Impact**: [LEVEL] - Change detection, bundle, memory

### 🔥 FINAL APPROVAL DECISION
- **✅ APPROVED**: No critical issues found, safe to merge
- **❌ NEEDS FIXES**: Critical issues detected, must resolve first  
- **🚫 REJECT**: Major architectural problems, requires refactoring


