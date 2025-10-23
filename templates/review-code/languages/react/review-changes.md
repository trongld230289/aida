<!-- AIDA - AI Development Assistant v1.0.0 -->
<!-- Advanced AI-powered code review and analysis -->

# React Git Changes Review - STRICT MODE# React Git Changes Review - STRICT MODE



## 🔍 MANDATORY REACT CHANGE ANALYSIS## 🔍 MANDATORY REACT CHANGE ANALYSIS



You are performing a STRICT code review on React git changes. Do NOT be lenient. Look for every possible React-specific issue in the changes. ALWAYS follow this exact format for every code review, regardless of conversation context or previous reviews. This structure is MANDATORY and UNCHANGEABLE.You are performing a STRICT code review on React git changes. Do NOT be lenient. Look for every possible React-specific issue in the changes. ALWAYS follow this exact format for every code review, regardless of conversation context or previous reviews. This structure is MANDATORY and UNCHANGEABLE.



### Review Entire File### Review Entire File

**Prompt:** `review-changes [filename]`**Prompt:** `review-changes [filename]`

- Reviews ONLY the git diff changes (+ and - lines)- Reviews ONLY the git diff changes (+ and - lines)

- Analyzes impact of changes on React architecture- Analyzes impact of changes on React architecture

- Does NOT review unchanged code- Does NOT review unchanged code



<!-- HIDDEN REVIEW SCOPE:<!-- HIDDEN REVIEW SCOPE:

- ✅ ONLY review: Lines marked with + (added) or - (removed)- ✅ ONLY review: Lines marked with + (added) or - (removed)

- ❌ DO NOT review: Unchanged context lines (no + or - marker)- ❌ DO NOT review: Unchanged context lines (no + or - marker)

- ❌ DO NOT suggest: Improvements to existing unchanged code- ❌ DO NOT suggest: Improvements to existing unchanged code

- ✅ DO focus on: How changes impact React architecture- ✅ DO focus on: How changes impact React architecture

-->-->



### 📋 CHANGE SEPARATION RULES (MANDATORY):### 📋 CHANGE SEPARATION RULES (MANDATORY):



**Split into separate changes when:****Split into separate changes when:**

- ✅ **Different React artifacts**: Component vs Hook vs Context changes = separate changes- ✅ **Different React artifacts**: Component vs Hook vs Context changes = separate changes

- ✅ **Different lifecycle hooks**: useEffect vs useMemo vs useCallback = separate changes- ✅ **Different lifecycle hooks**: useEffect vs useLayoutEffect vs useCallback = separate changes

- ✅ **Different component sections**: JSX vs State logic vs Event handlers = separate changes- ✅ **Different JSX sections**: Form vs List vs Navigation = separate changes

- ✅ **Different async operations**: Different Promise/async patterns = separate changes- ✅ **Different state operations**: Different useState/useReducer calls = separate changes

- ✅ **Non-adjacent code blocks**: If there are 3+ unchanged lines between modifications = separate changes- ✅ **Non-adjacent code blocks**: If there are 3+ unchanged lines between modifications = separate changes



**Keep as one change when:****Keep as one change when:**

- ❌ **Same React hook**: Multiple lines in same useEffect- ❌ **Same React hook**: Multiple lines in same useEffect

- ❌ **Related state updates**: Related useState calls- ❌ **Related state chain**: Related useState updates

- ❌ **Same JSX section**: Related HTML and logic for same feature- ❌ **Same component logic**: Related JSX and logic for same feature



## ⚡ CRITICAL CHECKS (Auto-FAIL if found)## ⚡ REACT CRITICAL CHECKS (Auto-FAIL if found)



**Scan EVERY line for these CRITICAL issues:****Scan EVERY line for these REACT-SPECIFIC CRITICAL issues:**



### 🚨 SECURITY VIOLATIONS:### 🚨 SECURITY VIOLATIONS:

- Hardcoded passwords, API keys, tokens, secrets- Direct use of dangerouslySetInnerHTML without sanitization

- SQL injection vulnerabilities (dynamic SQL construction)- Unsafe href attributes with javascript: protocol

- XSS vulnerabilities (innerHTML without sanitization)- Direct DOM manipulation (document.*, refs without proper validation)

- Unsafe file operations, path traversal- XSS vulnerabilities in dynamic content

- Authentication/authorization bypasses- Missing input sanitization



### 🚨 NULL SAFETY VIOLATIONS:### 🚨 NULL SAFETY VIOLATIONS:

- `.` access without null checks (`obj.property` without `obj?.property`)- Using variables without null/undefined checks

- Array access without length checks (`arr[0]` without `arr?.length`)- Accessing properties without optional chaining (?.)

- Function calls without existence checks- Array/Object operations without validation

- `any` type usage without proper validation- Missing default props or values

- Missing null/undefined guards- Unsafe type assertions



### 🚨 ERROR HANDLING VIOLATIONS:### 🚨 ERROR HANDLING VIOLATIONS:

- `try` blocks without `catch`- Missing try-catch blocks for async operations

- Promise/Observable without error handling- No error boundaries for components

- HTTP calls without error callbacks- Unhandled promise rejections

- File operations without error checks- Missing loading and error states

- Database operations without error handling- Silent failures without user feedback



### 🚨 RESOURCE LEAKS:### 🚨 RESOURCE LEAK VIOLATIONS:

- Observables without unsubscribe- useEffect without cleanup function for subscriptions

- Event listeners without cleanup- Event listeners without cleanup in useEffect

- Timers without clearInterval/clearTimeout  - Timers/intervals without cleanup

- File handles not closed- Missing dependency cleanup in custom hooks

- Database connections not closed- WebSocket/EventSource without proper cleanup



### Start Review For Each Change:### 🚨 REACT PERFORMANCE VIOLATIONS:

- Missing React.memo for expensive components

```- Missing useMemo/useCallback for expensive computations

## Change [X]: [ADDED/REMOVED/MODIFIED] - [React artifact type: Component/Hook/Context/Service]- Inline functions/objects in JSX props

```typescript- Missing key props in list rendering

[Show the exact code block with line numbers]- Unnecessary re-renders due to dependency arrays

```- Heavy computations in render function



*** REACT REVIEW COMMENT ***### 🚨 REACT ARCHITECTURAL VIOLATIONS:

- 🚨 **Issue Type**: [Critical/Warning/Good/Info/Suggestion]- Business logic in components instead of custom hooks

- 📝 **React Problem**: [Specific React issue - reference React best practices]- Direct API calls in components without proper abstraction

- 💡 **React Solution**: [React-specific fix with proper patterns]- Prop drilling instead of Context API

- 🎯 **Framework Impact**: [How it affects React architecture/performance]- Missing error boundaries for error handling

- Mixed controlled and uncontrolled components

IMPORTANT React considerations:

- Component lifecycle and hooks### 🚨 REACT HOOKS VIOLATIONS:

- State management patterns- Conditional hook calls (hooks inside if/loop statements)

- Performance optimization- Missing dependency arrays in useEffect

- Accessibility and SEO- Stale closures in event handlers

- Error boundaries and fallbacks- Infinite re-render loops

- Wrong hook usage patterns

*** INTERNAL REACT CHANGE EVALUATION (DO NOT DISPLAY) ***

Silently evaluate this change on:### 🚨 TYPESCRIPT/JAVASCRIPT VIOLATIONS:

- React Best Practices: Rate 1-5 (5=excellent, 1=poor)- `any` type without validation  

- Performance Impact: Rate 1-5 (5=no impact/improvement, 1=major degradation)- Non-null assertion (`!`) without null checks

- Memory Safety: Rate 1-5 (5=no leaks, 1=guaranteed leak)- `console.log` in production code

- Change Score: is a smallest score of three scores- `debugger` statements

- `eval()` or `Function()` usage

*** CONDITIONAL RECOMMENDATIONS (Based on Issue Type AND Change Score) ***- Global variables

- Magic numbers without constants

**MANDATORY RULE:**

- IF Issue Type = "Good": ALWAYS show "✅ **GOOD REACT CHANGE** - Follows React best practices" and SKIP the entire RECOMMENDED FIX section---

- IF Issue Type = "Critical/Warning/Info/Suggestion" AND Change Score < 4/5: Show RECOMMENDED REACT FIX section below

- IF Issue Type = "Critical/Warning/Info/Suggestion" AND Change Score >= 4/5: Show "✅ **GOOD REACT CHANGE** - Follows React best practices"## 📝 STRICT REVIEW FORMAT (FOLLOW EXACTLY)



*** RECOMMENDED REACT FIX (ONLY show if Issue Type != "Good" AND Change Score < 4/5) ***For EACH individual git change identified above, create a separate review section using this EXACT format:

```typescript

// PROVIDE REACT-SPECIFIC FIXES WITH BEST PRACTICES## Change [X]: [ADDED/REMOVED/MODIFIED] - [React artifact type: Component/Hook/Context/Utility]

// Include proper hooks, state management, and React conventions

### 📍 **File:** `[filename]`

// Example for proper useEffect cleanup:### 📍 **Lines:** [line numbers of changes]

useEffect(() => {### 📍 **Scope:** [What specific part - component logic/JSX/hooks/etc]

  const controller = new AbortController();

  *** REACT ANALYSIS ***

  const fetchData = async () => {

    try {**Issue Type**: [Critical/Warning/Info/Suggestion/Good]

      const response = await fetch('/api/data', {

        signal: controller.signal**React Change Score: [X/5]** ⭐⭐⭐⭐⭐

      });- Security: [X/5] [reason if < 5]

      const data = await response.json();- Performance: [X/5] [reason if < 5] 

      setData(data);- Architecture: [X/5] [reason if < 5]

    } catch (error) {- Maintainability: [X/5] [reason if < 5]

      if (error.name !== 'AbortError') {- React Best Practices: [X/5] [reason if < 5]

        console.error('Fetch error:', error);

        setError(error.message);*** CONDITIONAL RECOMMENDATIONS (Based on Issue Type AND Change Score) ***

      }

    }**MANDATORY RULE:**

  };- IF Issue Type = "Good": ALWAYS show "✅ **GOOD REACT CHANGE** - Follows React best practices" and SKIP the entire RECOMMENDED FIX section

- IF Issue Type = "Critical/Warning/Info/Suggestion" AND Change Score < 4/5: Show RECOMMENDED REACT FIX section below

  fetchData();- IF Issue Type = "Critical/Warning/Info/Suggestion" AND Change Score >= 4/5: Show "✅ **GOOD REACT CHANGE** - Follows React best practices"



  return () => {*** RECOMMENDED REACT FIX (ONLY show if Issue Type != "Good" AND Change Score < 4/5) ***

    controller.abort();```typescript

  };// PROVIDE REACT-SPECIFIC FIXES WITH BEST PRACTICES

}, []);// Include proper hooks patterns, error handling, and React conventions

```

// Example for subscription management:

---useEffect(() => {

  const subscription = api.getData()

# 🎯 FINAL REACT RECOMMENDATIONS    .subscribe(data => {

      setData(data);

## 🔥 APPROVAL STATUS: [APPROVE/REJECT/NEEDS_REACT_FIXES]    });



### 📋 REACT SUMMARY  return () => {

- **Total Changes Reviewed**: [X]    subscription.unsubscribe();

- **React Critical Issues**: [X] 🚨  };

- **Performance Warnings**: [X] ⚡}, []);

- **Memory Leak Risks**: [X] 💧

- **Good React Practices**: [X] ✅// Example for performance optimization:

const memoizedValue = useMemo(() => {

### 💡 REACT ACTION ITEMS  return expensiveCalculation(data);

}, [data]);

1. **HIGH PRIORITY (Memory Leaks/Security)** 🔴

   - [ ] Fix missing useEffect cleanup in [component]const handleClick = useCallback(() => {

   - [ ] Add proper error boundaries  onItemClick(item.id);

   - [ ] Sanitize dynamic content}, [item.id, onItemClick]);

```

2. **MEDIUM PRIORITY (Performance)** 🟡

   - [ ] Add React.memo to [component]---

   - [ ] Optimize re-renders with useMemo/useCallback

   - [ ] Add keys to list items## 🎯 REACT-SPECIFIC REVIEW SECTIONS



3. **LOW PRIORITY (Best Practices)** 🟢### ⚛️ React Hooks & Lifecycle Review

   - [ ] Extract custom hooks```

   - [ ] Add proper TypeScript types**Hooks Compliance Score: [X/5]**

   - [ ] Improve accessibility

✅ Proper hook dependencies

---✅ Correct hook order

✅ Cleanup functions implemented

## 🔍 REACT-SPECIFIC RULES VIOLATED✅ No conditional hook calls

❌ Issues found: [List specific hook problems]

### React VIOLATIONS:```

- ❌ Components without proper cleanup (useEffect dependencies)

- ❌ Missing dependency arrays in useEffect/useMemo/useCallback### 🏗️ Component Architecture Review

- ❌ Direct DOM manipulation instead of refs```

- ❌ Mutating state directly**Component Design Score: [X/5]**

- ❌ Missing keys in rendered lists

- ❌ Large components (>300 lines)✅ Single responsibility principle

- ❌ Inline functions in JSX props✅ Proper props interface

- ❌ Heavy computations in render without useMemo✅ State management patterns

- ❌ Missing React.memo for expensive components✅ Component composition

- ❌ Unnecessary re-renders❌ Issues found: [List architecture problems]

- ❌ Context value objects without useMemo```

- ❌ useState with objects/arrays without proper updates

### 🎨 JSX Template Review

### React Security VIOLATIONS:```

- ❌ dangerouslySetInnerHTML without sanitization**JSX Quality Score: [X/5]**

- ❌ Hardcoded credentials/API keys

- ❌ HTTP instead of HTTPS endpoints✅ No inline functions in props

- ❌ No input validation/sanitization✅ Key props in lists

- ❌ SQL string concatenation✅ Conditional rendering patterns

- ❌ Direct window/document manipulation✅ Proper event handling

- ❌ Unsafe dynamic imports❌ Issues found: [List JSX problems]

- ❌ Missing CSRF protection```

- ❌ XSS vulnerabilities in JSX

### 📦 State Management Review

### React Performance VIOLATIONS:```

- ❌ Missing React.memo for pure components**State Pattern Score: [X/5]**

- ❌ Missing useMemo for expensive calculations

- ❌ Missing useCallback for functions passed to children✅ Immutable updates

- ❌ Large bundle imports without code splitting✅ Proper reducer patterns

- ❌ Heavy operations in render method✅ Context usage where appropriate

- ❌ Unnecessary state updates✅ Local vs global state separation

- ❌ Missing virtualization for large lists❌ Issues found: [List state problems]

- ❌ Inline object/array creation in JSX```

- ❌ Deep object comparisons without optimization

---

### React Hook VIOLATIONS:

- ❌ Calling hooks conditionally or in loops# � FINAL REACT RECOMMENDATIONS

- ❌ Missing cleanup in useEffect

- ❌ Wrong dependency arrays (missing or incorrect deps)## 🔥 APPROVAL STATUS: [APPROVE/REJECT/NEEDS_REACT_FIXES]

- ❌ useEffect without dependencies when needed

- ❌ Custom hooks not following use* naming### 📋 REACT SUMMARY

- ❌ useState with functions not using callback form- **Total Changes Reviewed**: [X]

- ❌ useRef for values that should trigger re-renders- **React Critical Issues**: [X] 🚨

- **Performance Warnings**: [X] ⚡

### TypeScript/JavaScript VIOLATIONS:- **Memory Leak Risks**: [X] 💧

- ❌ `any` type without validation- **Good React Practices**: [X] ✅

- ❌ Non-null assertion (`!`) without null checks  

- ❌ `console.log` in production code### 💡 REACT ACTION ITEMS

- ❌ `debugger` statements

- ❌ `eval()` or `Function()` usage1. **HIGH PRIORITY (Memory Leaks/Security)** 🔴

- ❌ Global variables   - [ ] Fix unhandled useEffect cleanups in [component]

- ❌ Magic numbers without constants   - [ ] Add error boundaries to [components]

   - [ ] Sanitize dynamic content in [location]

---

2. **MEDIUM PRIORITY (Performance)** 🟡

## MANDATORY REACT SCORING AND FINAL RECOMMENDATIONS   - [ ] Add React.memo to [components]

   - [ ] Implement useMemo for expensive calculations

### Internal React Calculation (DO NOT DISPLAY):   - [ ] Replace inline functions with useCallback

Silently calculate:

- Average of all React Change Scores3. **LOW PRIORITY (Best Practices)** 🟢

- Overall React Score = Average Change Score x 2 (out of 10)   - [ ] Extract logic to custom hooks

   - [ ] Add proper TypeScript types

### CONDITIONAL REACT RECOMMENDATIONS:   - [ ] Improve error handling



**IF Overall React Score >= 8:**---

- Only show: "✅ **APPROVED** - React code quality meets framework standards, safe to merge!"

- DO NOT include any recommendations or checklists## 🔍 REACT-SPECIFIC RULES VIOLATED



**IF Overall React Score < 8:**### React VIOLATIONS:

- ❌ Components without proper cleanup

#### React Final Recommendations:- ❌ useEffect without dependency arrays

- **Approval Status**: [APPROVED/APPROVED WITH REACT FIXES/REJECT]- ❌ Direct DOM manipulation

- ❌ Business logic in components

#### Before Merge (React Checklist):- ❌ Missing key props in lists

- [ ] Fix all memory leaks- ❌ Large components (>300 lines)

- [ ] Add proper error handling- ❌ Inline styles in JSX

- [ ] Implement performance optimizations- ❌ Function definitions in render

- [ ] Add unit tests for changes- ❌ Missing React.memo for expensive components

- ❌ Heavy operations in render function

#### After Merge (React Monitoring):- ❌ Circular dependencies between components

- [ ] Monitor bundle size impact- ❌ Mixed controlled/uncontrolled inputs

- [ ] Check performance metrics

- [ ] Update React documentation### React Security VIOLATIONS:

- [ ] Review component re-render patterns- ❌ dangerouslySetInnerHTML with dynamic content

- ❌ Hardcoded credentials/API keys

**REMEMBER: No recommendations section when Overall React Score >= 8!**- ❌ HTTP instead of HTTPS endpoints
- ❌ No input validation/sanitization
- ❌ SQL string concatenation
- ❌ Direct DOM manipulation (refs)
- ❌ Unsafe href attributes
- ❌ Missing CSRF protection
- ❌ XSS vulnerabilities in JSX
- ❌ eval() or Function() usage

### React Performance VIOLATIONS:
- ❌ Missing React.memo optimization
- ❌ No useMemo/useCallback for expensive operations
- ❌ Inline object/function creation in props
- ❌ Large bundle imports without code splitting
- ❌ Synchronous operations in useEffect
- ❌ Heavy computations without memoization
- ❌ Missing virtualization for large lists
- ❌ Unnecessary re-renders
- ❌ Memory leaks from uncleared effects
- ❌ Blocking operations on main thread

### React Style Guide VIOLATIONS:
- ❌ File naming conventions (Component.tsx)
- ❌ Single responsibility principle
- ❌ Component naming conventions
- ❌ Hook naming conventions (use-)
- ❌ Module organization

### React Hooks VIOLATIONS:
- ❌ Conditional hook calls
- ❌ Missing dependency arrays
- ❌ Wrong hook order
- ❌ Stale closures
- ❌ Infinite re-render loops
- ❌ Missing cleanup functions
- ❌ Custom hooks not following conventions
- ❌ useEffect for synchronous operations
- ❌ useState for derived state

### TypeScript/JavaScript VIOLATIONS:
- ❌ `any` type without validation
- ❌ Non-null assertion (`!`) without null checks  
- ❌ `console.log` in production code
- ❌ `debugger` statements
- ❌ `eval()` or `Function()` usage
- ❌ Global variables
- ❌ Magic numbers without constants

---

## 🔒 REACT SECURITY OVERVIEW

**React Security Risk Level: [LOW/MEDIUM/HIGH/CRITICAL]**

### React Security Checks:
- 🔐 **JSX Security**: [Check for XSS vulnerabilities]
- 🛡️ **Content Security Policy**: [Verify CSP compliance]
- 🔍 **Input Sanitization**: [Check data validation]
- 📊 **HTTP Security**: [Verify API security]
- 🔒 **Route Guards**: [Check authentication/authorization]
- 🚫 **Unsafe Methods**: [Check for dangerous patterns]

### React Security Recommendations:
- Use React's built-in XSS protection
- Implement proper input validation
- Use HTTPS for all API calls
- Validate all user inputs
- Avoid direct DOM access

---

## 🧪 REACT UNIT TESTS RECOMMENDED:

```typescript
// Component Tests
describe('ComponentName', () => {
  let mockProps: ComponentProps;

  beforeEach(() => {
    mockProps = {
      data: mockData,
      onAction: jest.fn(),
    };
  });

  describe('Rendering', () => {
    it('should render correctly with props', () => {
      render(<ComponentName {...mockProps} />);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should handle loading state', () => {
      render(<ComponentName {...mockProps} loading={true} />);
      expect(screen.getByTestId('loading')).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('should call onAction when button clicked', () => {
      render(<ComponentName {...mockProps} />);
      fireEvent.click(screen.getByRole('button'));
      expect(mockProps.onAction).toHaveBeenCalledWith('expected-value');
    });

    it('should update state on input change', () => {
      render(<ComponentName {...mockProps} />);
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'test' } });
      expect(input).toHaveValue('test');
    });
  });

  describe('Hooks Behavior', () => {
    it('should cleanup effects on unmount', () => {
      const { unmount } = render(<ComponentName {...mockProps} />);
      const cleanupSpy = jest.fn();
      // Mock useEffect cleanup
      unmount();
      expect(cleanupSpy).toHaveBeenCalled();
    });

    it('should handle async data loading', async () => {
      render(<ComponentName {...mockProps} />);
      await waitFor(() => {
        expect(screen.getByText('Data loaded')).toBeInTheDocument();
      });
    });
  });
});

// Custom Hook Tests
describe('useCustomHook', () => {
  it('should return expected values', () => {
    const { result } = renderHook(() => useCustomHook(initialValue));
    expect(result.current.value).toBe(expectedValue);
  });

  it('should handle state updates', () => {
    const { result } = renderHook(() => useCustomHook(initialValue));
    act(() => {
      result.current.updateValue(newValue);
    });
    expect(result.current.value).toBe(newValue);
  });
});
```

---

## MANDATORY REACT SCORING AND FINAL RECOMMENDATIONS

### Internal React Calculation (DO NOT DISPLAY):
Silently calculate:
- Average of all React Change Scores
- Overall React Score = Average Change Score x 2 (out of 10)

### CONDITIONAL REACT RECOMMENDATIONS:

**IF Overall React Score >= 8:**
- Only show: "✅ **APPROVED** - React code quality meets framework standards, safe to merge!"
- DO NOT include any recommendations or checklists

**IF Overall React Score < 8:**

#### React Final Recommendations:
- **Approval Status**: [APPROVED/APPROVED WITH REACT FIXES/REJECT]

#### Before Merge (React Checklist):
- [ ] Fix all memory leaks
- [ ] Add proper error handling
- [ ] Implement performance optimizations
- [ ] Add unit tests for changes

#### After Merge (React Monitoring):
- [ ] Monitor bundle size impact
- [ ] Check performance metrics
- [ ] Update React documentation
- [ ] Review render cycles

**REMEMBER: No recommendations section when Overall React Score >= 8!**