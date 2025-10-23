<!-- AIDA - AI Development Assistant v1.0.0 -->
<!-- Advanced AI-powered code review and analysis -->

# React Single File Review - STRICT MODE# React Framework Review Template



## 🔍 MANDATORY REACT FILE ANALYSIS  ## 🎯 React-Specific Review Guidelines



You are performing a STRICT code review on a React file. Do NOT be lenient. Look for every possible React-specific issue. ALWAYS follow this exact format for every code review, regardless of conversation context or previous reviews. This structure is MANDATORY and UNCHANGEABLE.This template focuses specifically on React framework best practices, patterns, and common pitfalls. Use this for reviewing React components, hooks, contexts, and utilities.



### Review Entire File## File Information

**Prompt:** `review-file [filename]`**File:** [FILE_NAME]

- Reviews the COMPLETE file content**Path:** [FILE_PATH]

- Analyzes React architecture and patterns**React Version:** [REACT_VERSION]

- Provides comprehensive React-specific feedback**TypeScript:** [TS_ENABLED]

**Type:** Component | Hook | Context | Utility | HOC

### 📋 COMPONENT SEPARATION RULES (MANDATORY):

---

**Split into separate components when:**

- ✅ **Different responsibilities**: Data fetching vs UI rendering vs Business logic## 🔍 React Code Analysis

- ✅ **Different React patterns**: Hooks vs Class components vs HOCs

- ✅ **Different state scopes**: Local vs Global vs Shared state### 1. **React Architecture & Patterns**

- ✅ **Different lifecycle needs**: Different useEffect dependencies

- ✅ **Reusable logic**: Custom hooks vs Utility functions#### 🏗️ Component Architecture

- **Functional vs Class Components**

**Keep in same component when:**  - Is functional component used appropriately?

- ❌ **Tightly coupled UI**: Parent-child rendering logic  - Proper hooks implementation?

- ❌ **Shared state**: Components sharing same useState/useContext  - Correct prop destructuring?

- ❌ **Sequential operations**: Related useEffect chains

#### 📦 Component Organization

## ⚡ CRITICAL CHECKS (Auto-FAIL if found)- Single responsibility principle

- Proper component composition

**Scan EVERY line for these CRITICAL issues:**- Custom hooks extraction

- Context usage patterns

### 🚨 SECURITY VIOLATIONS:

- Hardcoded passwords, API keys, tokens, secrets#### 🔄 State Management

- SQL injection vulnerabilities (dynamic SQL construction)```javascript

- XSS vulnerabilities (dangerouslySetInnerHTML without sanitization)// Example: Proper state management

- Unsafe file operations, path traversalconst [state, setState] = useState(initialState);

- Authentication/authorization bypassesconst [loading, setLoading] = useState(false);



### 🚨 NULL SAFETY VIOLATIONS:// Good: Functional updates

- `.` access without null checks (`obj.property` without `obj?.property`)setState(prevState => ({

- Array access without length checks (`arr[0]` without `arr?.length`)  ...prevState,

- Function calls without existence checks  newValue: value

- `any` type usage without proper validation}));

- Missing null/undefined guards

// Bad: Direct mutation

### 🚨 ERROR HANDLING VIOLATIONS:state.property = value; // Never do this!

- `try` blocks without `catch````

- Promise/fetch without error handling

- HTTP calls without error callbacks#### ❌ Common Issues

- File operations without error checks- Mixed concerns in components

- Missing error boundaries- Props drilling beyond 3 levels

- Missing key props in lists

### 🚨 RESOURCE LEAKS:- Incorrect state updates

- useEffect without cleanup functions

- Event listeners without removal---

- Timers without clearInterval/clearTimeout  

- WebSocket connections without close### 2. **React Hooks & Lifecycle**

- AbortController without abort

#### 🪝 Hook Implementation

## 📊 DETAILED COMPONENT ANALYSIS```javascript

// Check for proper hook usage

### 📄 File: [ACTUAL_FILENAME]useEffect(() => {

**Component Type**: [Functional/Class/Hook/Utility]  // Side effects here

**Primary Purpose**: [Brief description]  const subscription = subscribe();

  

#### React-Specific Issues Found:  // Cleanup function

- **Line X**: [EXACT ISSUE] - `[CODE_SNIPPET]`  return () => {

- **Line Y**: [EXACT ISSUE] - `[CODE_SNIPPET]`    subscription.unsubscribe();

  };

#### STRICT EVALUATION:}, []); // Dependency array

- **🚨 Security**: [FOUND_ISSUES or "CLEAN"]

- **🚨 Null Safety**: [FOUND_ISSUES or "CLEAN"] useMemo(() => {

- **🚨 Error Handling**: [FOUND_ISSUES or "CLEAN"]  // Expensive computation

- **🚨 Resource Management**: [FOUND_ISSUES or "CLEAN"]  return expensiveCalculation(dep);

- **⚠️ Performance**: [FOUND_ISSUES or "CLEAN"]}, [dep]);

- **⚠️ Code Quality**: [FOUND_ISSUES or "CLEAN"]

useCallback(() => {

#### VERDICT:  // Memoized callback

- 🚨 **CRITICAL**: [Reason - blocks deployment]  return handleClick;

- ⚠️ **WARNING**: [Reason - needs fix]  }, [dependency]);

- ✅ **PASS**: [Only if NO issues found]```



---#### ⚠️ Common Mistakes

- Missing dependency arrays

## 🎯 REACT-SPECIFIC ANALYSIS SECTIONS- Infinite re-render loops

- Heavy computations without useMemo

### 🔄 Hooks & State Management Review- Missing useCallback for child props

```

**React Hooks Score: [X/5]**---



✅ Proper useEffect dependencies### 3. **Performance & Optimization**

✅ Correct useState usage

✅ Custom hooks following conventions#### ⚡ React Performance

✅ No conditional hook calls```javascript

❌ Issues found: [List specific hook problems]// Best Practice: Component memoization

```const MemoizedComponent = React.memo(({ prop1, prop2 }) => {

  return <div>{prop1} {prop2}</div>;

### 🏗️ Component Architecture Review  });

```

**Component Design Score: [X/5]**// Good: Conditional rendering

{showComponent && <ExpensiveComponent />}

✅ Single responsibility principle

✅ Proper props interface// Bad: Always rendering

✅ Separation of concerns{showComponent ? <ExpensiveComponent /> : null}

✅ Reusability patterns

❌ Issues found: [List architecture problems]// Good: Key optimization

```{items.map(item => (

  <Item key={item.id} data={item} />

### 📝 JSX & Rendering Review))}

``````

**JSX Quality Score: [X/5]**

#### 📊 Performance Best Practices

✅ No inline functions in props- React.memo usage for pure components

✅ Keys in list rendering- useMemo for expensive calculations

✅ Proper event handling- useCallback for event handlers

✅ Accessibility attributes- Proper key props in lists

❌ Issues found: [List JSX problems]- Code splitting with React.lazy

```

#### ❌ Performance Anti-patterns

### 💻 Performance Review- Creating objects/arrays in render

```- Inline function definitions

**Performance Score: [X/5]**- Missing React.memo on pure components

- Incorrect dependency arrays

✅ React.memo usage where needed

✅ useMemo for expensive calculations  ---

✅ useCallback for function props

✅ No unnecessary re-renders### 4. **State Management & Context**

❌ Issues found: [List performance problems]

```#### 🏪 State Patterns

```javascript

---// Good: Context pattern

const ThemeContext = createContext();

## 🔥 CRITICAL ISSUES (Must fix immediately)

const ThemeProvider = ({ children }) => {

### 🚨 SECURITY ISSUES:  const [theme, setTheme] = useState('light');

[List each security violation with exact line numbers and code]  

  const value = useMemo(() => ({

### 🚨 NULL SAFETY ISSUES:      theme,

[List each null safety violation with exact line numbers and code]    setTheme

  }), [theme]);

### 🚨 ERROR HANDLING ISSUES:

[List each error handling issue with exact line numbers and code]  return (

    <ThemeContext.Provider value={value}>

### 🚨 RESOURCE LEAK ISSUES:      {children}

[List each resource leak with exact line numbers and code]    </ThemeContext.Provider>

  );

## ⚠️ WARNING ISSUES (Should fix)};



### ⚠️ PERFORMANCE ISSUES:// Custom hook for context

[List performance bottlenecks, expensive operations, unnecessary re-renders]const useTheme = () => {

  const context = useContext(ThemeContext);

### ⚠️ CODE QUALITY ISSUES:  if (!context) {

[List naming violations, complex functions, code smells]    throw new Error('useTheme must be used within ThemeProvider');

  }

---  return context;

};

## 🔍 SPECIFIC RULES VIOLATED```



### React Hook VIOLATIONS:#### 🔄 useReducer Pattern

- ❌ Calling hooks conditionally or in loops```javascript

- ❌ Missing cleanup in useEffect// Complex state logic

- ❌ Wrong dependency arrays (missing or incorrect deps)const initialState = { count: 0, loading: false };

- ❌ useEffect without dependencies when needed

- ❌ Custom hooks not following use* namingfunction reducer(state, action) {

- ❌ useState with functions not using callback form  switch (action.type) {

- ❌ useRef for values that should trigger re-renders    case 'increment':

      return { ...state, count: state.count + 1 };

### React Component VIOLATIONS:    case 'setLoading':

- ❌ Components without proper cleanup      return { ...state, loading: action.payload };

- ❌ Missing keys in rendered lists    default:

- ❌ Inline functions in JSX props      throw new Error();

- ❌ Heavy computations in render without useMemo  }

- ❌ Missing React.memo for expensive components}

- ❌ Unnecessary re-renders

- ❌ Large components (>300 lines)const [state, dispatch] = useReducer(reducer, initialState);

- ❌ Mixed concerns in single component```



### React Performance VIOLATIONS:---

- ❌ Missing React.memo for pure components

- ❌ Missing useMemo for expensive calculations### 5. **JSX & Templates**

- ❌ Missing useCallback for functions passed to children

- ❌ Inline object/array creation in JSX#### 📝 JSX Best Practices

- ❌ Deep object comparisons without optimization```javascript

- ❌ Context value objects without useMemo// Good: Conditional rendering

{user ? (

### TypeScript/JavaScript VIOLATIONS:  <UserProfile user={user} />

- ❌ `any` type without validation) : (

- ❌ Non-null assertion (`!`) without null checks    <LoginForm />

- ❌ `console.log` in production code)}

- ❌ `debugger` statements

- ❌ `eval()` or `Function()` usage// Good: List rendering

- ❌ Global variables{items.map(item => (

- ❌ Magic numbers without constants  <ListItem 

    key={item.id} 

---    item={item}

    onSelect={handleSelect}

## 🧪 REACT UNIT TESTS RECOMMENDED:  />

))}

```typescript

// Component Tests// Good: Event handling

import { render, screen, fireEvent, waitFor } from '@testing-library/react'const handleSubmit = useCallback((event) => {

import { ComponentName } from './ComponentName'  event.preventDefault();

  // Handle form submission

describe('ComponentName', () => {}, []);

  it('should render correctly with props', () => {```

    render(<ComponentName prop1="value" />)

    expect(screen.getByRole('button')).toBeInTheDocument()#### ❌ JSX Anti-patterns

  })- Missing keys in lists

- Inline object creation

  it('should handle user interactions', async () => {- Complex logic in JSX

    const mockHandler = jest.fn()- Direct array index as key

    render(<ComponentName onAction={mockHandler} />)

    ---

    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => {### 6. **Error Handling & Boundaries**

      expect(mockHandler).toHaveBeenCalledTimes(1)

    })#### 🛡️ Error Boundaries

  })```javascript

class ErrorBoundary extends Component {

  it('should handle async operations', async () => {  constructor(props) {

    render(<ComponentName />)    super(props);

        this.state = { hasError: false };

    await waitFor(() => {  }

      expect(screen.getByText('Loaded Data')).toBeInTheDocument()

    })  static getDerivedStateFromError(error) {

  })    return { hasError: true };

  }

  it('should cleanup resources on unmount', () => {

    const { unmount } = render(<ComponentName />)  componentDidCatch(error, errorInfo) {

    const spy = jest.spyOn(AbortController.prototype, 'abort')    console.error('Error caught:', error, errorInfo);

      }

    unmount()

    expect(spy).toHaveBeenCalled()  render() {

  })    if (this.state.hasError) {

})      return <h1>Something went wrong.</h1>;

    }

// Hook Tests      return this.props.children;

import { renderHook, act } from '@testing-library/react'  }

import { useCustomHook } from './useCustomHook'}

```

describe('useCustomHook', () => {

  it('should handle state updates', () => {---

    const { result } = renderHook(() => useCustomHook())

    ### 7. **Custom Hooks**

    act(() => {

      result.current.updateValue('new value')#### 🪝 Hook Creation

    })```javascript

    // Good: Custom hook pattern

    expect(result.current.value).toBe('new value')const useLocalStorage = (key, initialValue) => {

  })  const [storedValue, setStoredValue] = useState(() => {

})    try {

```      const item = window.localStorage.getItem(key);

      return item ? JSON.parse(item) : initialValue;

---    } catch (error) {

      return initialValue;

## 📊 FILE SUMMARY    }

  });

### Files Status:

- 🚨 **CRITICAL**: [If ANY critical issue found]  const setValue = useCallback((value) => {

- ⚠️ **WARNING**: [If ANY warning issue found]    try {

- ✅ **PASS**: [ONLY if NO issues found]      setStoredValue(value);

      window.localStorage.setItem(key, JSON.stringify(value));

### Overall Assessment:    } catch (error) {

**File Quality**: [BASED ON STRICTEST RULE]      console.error(error);

- 🚨 **NEEDS MAJOR FIXES**: Critical issues found    }

- ⚠️ **NEEDS IMPROVEMENTS**: Warning issues found    }, [key]);

- ✅ **PRODUCTION READY**: No issues found

  return [storedValue, setValue];

### MANDATORY Action Items:};

1. Fix ALL security vulnerabilities immediately```

2. Add null checks for ALL property access

3. Add error handling for ALL async operations---

4. Implement proper cleanup for ALL resources

5. Remove ALL debugging code### 8. **React Testing**



---#### 🧪 Testing Patterns

```javascript

## 🎯 STRICT CHECKLIST// Component testing

import { render, screen, fireEvent } from '@testing-library/react';

**ZERO tolerance policy:**import userEvent from '@testing-library/user-event';



- [❌/✅] **🚨 Security**: NO secrets, NO XSS, NO injectionstest('renders and handles click', async () => {

- [❌/✅] **🚨 Null Safety**: ALL property access protected    render(<Button onClick={mockClick}>Click me</Button>);

- [❌/✅] **🚨 Error Handling**: ALL operations have error handling  

- [❌/✅] **🚨 Resource Management**: ALL resources properly cleaned  const button = screen.getByText('Click me');

- [❌/✅] **⚠️ Performance**: NO expensive operations, NO memory leaks  await userEvent.click(button);

- [❌/✅] **⚠️ Code Quality**: NO `any`, NO magic numbers  

- [❌/✅] **⚠️ Best Practices**: Follows ALL React conventions  expect(mockClick).toHaveBeenCalled();

});

---

// Hook testing

## 🚨 FINAL VERDICTimport { renderHook, act } from '@testing-library/react';



**FILE STATUS**: [PRODUCTION_READY/NEEDS_FIXES/REJECTED]test('useCounter hook', () => {

  const { result } = renderHook(() => useCounter());

**Reasoning**: [Based on concrete violations found]  

  act(() => {

**Critical Blockers**: [Number] issues that MUST be fixed    result.current.increment();

  });

**Review Standards**: STRICT MODE - Found [X] violations  

  expect(result.current.count).toBe(1);

---});

```

## 💡 REACT IMPROVEMENT RECOMMENDATIONS

---

### Architecture Improvements:

- [ ] Extract custom hooks for reusable logic## 📊 React Health Metrics

- [ ] Split large components into smaller ones

- [ ] Implement proper error boundaries### Performance Score

- [ ] Add loading and error states- **Component Optimization**: ⭐⭐⭐⭐⭐ (X/5)

- **Hook Usage**: ⭐⭐⭐⭐⭐ (X/5)

### Performance Optimizations:- **State Management**: ⭐⭐⭐⭐⭐ (X/5)

- [ ] Add React.memo where appropriate- **Bundle Size**: ⭐⭐⭐⭐⭐ (X/5)

- [ ] Optimize expensive calculations with useMemo

- [ ] Use useCallback for function props### Overall React Score: ⭐⭐⭐⭐⭐ (X/10)

- [ ] Implement code splitting

---

### Testing Improvements:

- [ ] Add unit tests for all components## 🎯 React-Specific Action Items

- [ ] Add integration tests for user flows

- [ ] Add accessibility tests### High Priority

- [ ] Mock external dependencies1. [ ] Add React.memo to pure components

2. [ ] Implement proper error boundaries

---3. [ ] Optimize re-renders with useCallback/useMemo



**⚠️ NOTE**: This is a STRICT review focusing on React best practices. Any violation should result in WARNING or CRITICAL status. Do NOT be lenient.### Medium Priority
4. [ ] Extract custom hooks for reusable logic
5. [ ] Add TypeScript interfaces for props
6. [ ] Implement code splitting with React.lazy

### Low Priority
7. [ ] Add comprehensive test coverage
8. [ ] Consider state management library (Redux/Zustand)
9. [ ] Optimize bundle size with tree shaking

---

## 💡 React Upgrade Recommendations

### Modern React Features
- React 18 concurrent features
- Suspense for data fetching
- Server components (if applicable)

### Development Tools
- React DevTools usage
- ESLint with React hooks rules
- Strict mode enforcement