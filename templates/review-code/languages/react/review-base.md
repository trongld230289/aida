<!-- AIDA - React Review Base Template -->
<!-- PLACEHOLDER: {{REVIEW_BASE}} -->

## 🔥 MANDATORY PROJECT RULES - MUST CHECK FIRST:
<!-- ADD PROJECT-SPECIFIC RULES HERE - These will be checked alongside Angular rules -->
<!-- Additional project rules can be added here:
- **🚫 CRITICAL**: Never use `isSuccess` as variable name - reserved for business logic
-->

### 🚨 SECURITY VIOLATIONS:
- Unescaped user input in JSX (XSS vulnerabilities)
- Use of dangerouslySetInnerHTML without sanitization
- Missing input validation in form components
- Client-side authentication logic only
- Hardcoded API keys or secrets in React files
- Missing CSRF protection in forms
- Unsafe external script loading
- Missing Content Security Policy considerations
- Eval-like functions in JSX expressions
- Unsafe href attributes without validation

### 🚨 REACT HOOKS VIOLATIONS:
- Hooks called conditionally or in loops
- Missing dependencies in useEffect dependency arrays
- Infinite loops in useEffect hooks
- Missing cleanup functions in useEffect
- Stale closure issues in event handlers
- Direct state mutation instead of using setState
- Improper use of useCallback and useMemo
- Missing error boundaries for async operations
- useEffect without dependency array for one-time effects
- Custom hooks violating Rules of Hooks

### 🚨 PERFORMANCE VIOLATIONS:
- Missing React.memo for expensive components
- Unnecessary re-renders due to object/array recreation
- Heavy computations in render functions
- Missing key props in lists
- Inline function definitions in JSX
- Missing lazy loading for large components
- Improper use of Context API causing unnecessary re-renders
- Large bundle sizes from unnecessary imports
- Missing useMemo for expensive calculations
- Creating objects/arrays in render without memoization

### 🚨 JSX & COMPONENT VIOLATIONS:
- Missing keys in mapped elements
- Incorrect conditional rendering patterns
- Improper event handling (inline vs callback refs)
- Missing accessibility attributes (a11y)
- Nested ternary operators making code unreadable
- Direct DOM manipulation instead of React patterns
- Missing PropTypes or TypeScript types
- Improper component composition patterns
- Fragment misuse or unnecessary divs
- Missing error boundaries for component trees

### 🚨 STATE MANAGEMENT VIOLATIONS:
- Direct state mutations
- Missing action creators in Redux/Zustand
- Improper reducer implementations
- Missing error handling in async state updates
- Inconsistent state structure
- Missing normalization for complex state
- Memory leaks from unremoved event listeners
- Missing loading and error states
- Prop drilling instead of proper state management
- Overly complex component state

### 🚨 CODE QUALITY & MAINTAINABILITY VIOLATIONS:
- Hardcoded strings for roles, error messages, or business values
- Magic numbers without named constants
- String comparisons without constants/enums
- Repeated string literals across files
- Missing centralized configuration for business values
- Hardcoded URLs or API endpoints
- Business logic constants scattered in components

### 🚨 ASYNC OPERATIONS VIOLATIONS:
- Missing error handling for API calls
- Race conditions in useEffect
- Missing loading states for async operations
- Improper cleanup of async operations
- Missing cancellation for aborted requests
- Memory leaks from uncancelled promises
- Blocking UI during async operations
- Missing AbortController usage
- Unhandled promise rejections
- Missing timeout handling
